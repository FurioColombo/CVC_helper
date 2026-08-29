import { beforeEach, describe, expect, it, vi } from "vitest"

const database = vi.hoisted(() => ({
  execute: vi.fn(),
  getAll: vi.fn(),
  init: vi.fn(),
}))

vi.mock("@/persistence/db", () => ({ db: database }))

import {
  createStudent,
  listStudents,
  setStudentActive,
  updateStudent,
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
    database.getAll.mockResolvedValue([])
  })

  it("lists current-course students with active students first", async () => {
    await listStudents("course-1")

    expect(database.getAll).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY active DESC"),
      ["course-1"],
    )
  })

  it("creates a student as active", async () => {
    const student = await createStudent("course-1", INPUT)

    expect(student).toEqual(
      expect.objectContaining({ courseId: "course-1", active: 1, ...INPUT }),
    )
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO students"),
      expect.arrayContaining([student.id, "course-1", "Mario", "Rossi", 1]),
    )
  })

  it("scopes edits and active-state changes to the course", async () => {
    await updateStudent("student-1", "course-1", {
      ...INPUT,
      nickname: "Marty",
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
})
