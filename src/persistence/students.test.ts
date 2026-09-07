import { beforeEach, describe, expect, it, vi } from "vitest"

const database = vi.hoisted(() => ({
  execute: vi.fn(),
  executeBatch: vi.fn(),
  getAll: vi.fn(),
  getOptional: vi.fn(),
  init: vi.fn(),
  writeTransaction: vi.fn(),
}))

const transaction = vi.hoisted(() => ({
  execute: vi.fn(),
  getAll: vi.fn(),
  getOptional: vi.fn(),
}))

vi.mock("@/persistence/db", () => ({ db: database }))

import {
  createStudent,
  createStudents,
  deleteUnusedStudent,
  listStudents,
  setStudentActive,
  StudentDeletionBlockedError,
  updateStudent,
  updateStudentKnowledge,
  type StudentInput,
} from "@/persistence/students"

const INPUT: StudentInput = {
  firstName: "Mario",
  surname: "Rossi",
  nickname: null,
  dateOfBirth: "2010-01-01",
  sex: "male",
  phone: "+39 333 1234567",
}

describe("student persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    database.init.mockResolvedValue(undefined)
    database.execute.mockResolvedValue(undefined)
    database.executeBatch.mockResolvedValue(undefined)
    database.getAll.mockResolvedValue([])
    database.getOptional.mockResolvedValue({ id: "student-1" })
    transaction.execute.mockResolvedValue([{ id: "student-1" }])
    transaction.getAll.mockResolvedValue([])
    transaction.getOptional.mockResolvedValue({ id: "student-1" })
    database.writeTransaction.mockImplementation(
      async (callback: (context: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    )
  })

  it("lists current-course students with active students first", async () => {
    await listStudents("course-1")

    expect(database.getAll).toHaveBeenCalledWith(
      expect.stringContaining("COALESCE(NULLIF(nickname, ''), firstName)"),
      ["course-1"],
    )
  })

  it("creates a student as active", async () => {
    const student = await createStudent("course-1", INPUT)

    expect(student).toEqual(
      expect.objectContaining({
        courseId: "course-1",
        active: 1,
        size: null,
        initialNote: null,
        courseNote: null,
        ...INPUT,
      }),
    )
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO students"),
      expect.arrayContaining([student.id, "course-1", "Mario", "Rossi", 1]),
    )
  })

  it("creates reviewed scan rows in one batch", async () => {
    const students = await createStudents("course-1", [
      INPUT,
      {
        ...INPUT,
        firstName: "Giulia",
        surname: "Bianchi",
        sex: "female",
      },
    ])

    expect(students).toHaveLength(2)
    expect(database.executeBatch).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO students"),
      expect.arrayContaining([
        expect.arrayContaining(["course-1", "Mario", "Rossi", "male", 1]),
        expect.arrayContaining(["course-1", "Giulia", "Bianchi", "female", 1]),
      ]),
    )
  })

  it("scopes edits and active-state changes to the course", async () => {
    await updateStudent("student-1", "course-1", {
      ...INPUT,
      nickname: "Marty",
      size: null,
      initialNote: null,
      courseNote: null,
    })
    await setStudentActive("student-1", "course-1", false)

    expect(database.execute).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("WHERE id = ? AND courseId = ?"),
      expect.arrayContaining(["student-1", "course-1"]),
    )
    expect(database.execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("UPDATE students SET active = ?"),
      [0, "student-1", "course-1"],
    )
  })

  it("autosaves size and initial note without replacing identity fields", async () => {
    await updateStudentKnowledge("student-1", "course-1", {
      size: "L",
      initialNote: "Esperienza Optimist",
    })

    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("SET size = ?, initialNote = ?"),
      ["L", "Esperienza Optimist", "student-1", "course-1"],
    )
  })

  it("deletes a never-used student in one transaction without cascades", async () => {
    await deleteUnusedStudent("student-1", "course-1")

    expect(database.writeTransaction).toHaveBeenCalledOnce()
    expect(transaction.getAll).toHaveBeenCalledTimes(5)
    expect(transaction.execute).toHaveBeenCalledOnce()
    expect(transaction.execute).toHaveBeenCalledWith(
      "DELETE FROM students WHERE id = ? AND courseId = ? RETURNING id",
      ["student-1", "course-1"],
    )
  })

  it.each([
    ["duty", 0, "saturday"],
    ["stay-over", 1, "stay-over"],
    ["crew", 2, "mon-am"],
    ["land", 3, "tue-pm"],
    ["evaluation", 4, "wed-am"],
  ] as const)(
    "blocks deletion for a %s reference found during the transaction",
    async (kind, queryIndex, referenceId) => {
      transaction.getAll.mockImplementation(async () => {
        const callIndex = transaction.getAll.mock.calls.length - 1
        return callIndex === queryIndex ? [{ referenceId }] : []
      })

      const error = await deleteUnusedStudent("student-1", "course-1").catch(
        (reason: unknown) => reason,
      )

      expect(error).toBeInstanceOf(StudentDeletionBlockedError)
      expect((error as StudentDeletionBlockedError).assessment).toEqual({
        canDelete: false,
        references: [{ kind, referenceId }],
      })
      expect(transaction.execute).not.toHaveBeenCalled()
    },
  )

  it("rejects a student outside the course before reading references", async () => {
    transaction.getOptional.mockResolvedValue(null)

    await expect(deleteUnusedStudent("student-1", "course-2")).rejects.toThrow(
      "Student does not belong to course",
    )
    expect(transaction.getAll).not.toHaveBeenCalled()
    expect(transaction.execute).not.toHaveBeenCalled()
  })

  it("rolls back when the owned row is not returned by deletion", async () => {
    transaction.execute.mockResolvedValue([])

    await expect(deleteUnusedStudent("student-1", "course-1")).rejects.toThrow(
      "did not remove exactly one row",
    )
  })
})
