import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const database = vi.hoisted(() => ({
  execute: vi.fn(),
  getAll: vi.fn(),
  init: vi.fn(),
  writeTransaction: vi.fn(),
}))

vi.mock("@/persistence/db", () => ({ db: database }))

import {
  listCourseEvaluations,
  listEvaluations,
  listStudentEvaluations,
  saveEvaluation,
} from "@/persistence/evaluations"
import { TOUCH } from "@/persistence/stamp"

const NOW = "2026-09-20T09:12:45.875Z"

describe("evaluation persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(NOW))
    database.init.mockResolvedValue(undefined)
    database.getAll.mockResolvedValue([])
    database.writeTransaction.mockImplementation(
      async (write: (transaction: typeof database) => unknown) =>
        write(database),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("reads the exact course session and normalizes an empty note", async () => {
    database.getAll.mockResolvedValueOnce([
      {
        id: "evaluation-1",
        studentId: "student-1",
        sessionId: "wed-pm",
        value: "+",
        note: "  ",
      },
    ])

    await expect(listEvaluations("course-1", "wed-pm")).resolves.toEqual([
      {
        id: "evaluation-1",
        studentId: "student-1",
        sessionId: "wed-pm",
        value: "+",
        note: null,
      },
    ])
    expect(database.getAll).toHaveBeenCalledWith(
      expect.stringContaining("JOIN students"),
      ["course-1", "wed-pm"],
    )
  })

  it("reads and writes one evaluation inside a single transaction", async () => {
    database.getAll
      .mockResolvedValueOnce([{ id: "student-1" }])
      .mockResolvedValueOnce([])

    const record = await saveEvaluation("course-1", "student-1", "sun-am", {
      value: "+",
      note: null,
    })

    expect(database.writeTransaction).toHaveBeenCalledOnce()
    expect(database.getAll).toHaveBeenCalledTimes(2)
    // The row names its course directly (D1) and is stamped once.
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringMatching(
        /INSERT INTO evaluations\([^)]*courseId[^)]*createdAt, updatedAt\s*\)/,
      ),
      [record?.id, "course-1", "student-1", "sun-am", "+", null, NOW, NOW],
    )
  })

  it("updates only the exact student and session evaluation", async () => {
    database.getAll
      .mockResolvedValueOnce([{ id: "student-1" }])
      .mockResolvedValueOnce([{ id: "evaluation-1" }])

    await expect(
      saveEvaluation("course-1", "student-1", "sun-am", {
        value: "++",
        note: "  Buona conduzione  ",
      }),
    ).resolves.toEqual({
      id: "evaluation-1",
      studentId: "student-1",
      sessionId: "sun-am",
      value: "++",
      note: "Buona conduzione",
    })
    expect(database.execute).toHaveBeenCalledWith(
      `UPDATE evaluations SET value = ?, note = ?, ${TOUCH} WHERE id = ?`,
      ["++", "Buona conduzione", NOW, "evaluation-1"],
    )
  })

  it("removes a record when both mark and note return to missing", async () => {
    database.getAll
      .mockResolvedValueOnce([{ id: "student-1" }])
      .mockResolvedValueOnce([{ id: "evaluation-1" }])

    await expect(
      saveEvaluation("course-1", "student-1", "sat-pm", {
        value: null,
        note: "",
      }),
    ).resolves.toBeNull()
    expect(database.execute).toHaveBeenCalledWith(
      "DELETE FROM evaluations WHERE id = ?",
      ["evaluation-1"],
    )
  })

  it("rejects foreign students and settles a duplicate record on the latest", async () => {
    await expect(
      saveEvaluation("course-1", "student-2", "sat-pm", {
        value: "=",
        note: null,
      }),
    ).rejects.toThrow("does not belong")

    database.getAll
      .mockResolvedValueOnce([{ id: "student-1" }])
      .mockResolvedValueOnce([
        { id: "one", updatedAt: "2026-09-20T10:00:00.000Z" },
        { id: "two", updatedAt: "2026-09-20T09:00:00.000Z" },
      ])
    await expect(
      saveEvaluation("course-1", "student-1", "sat-pm", {
        value: "+",
        note: null,
      }),
    ).resolves.toMatchObject({ id: "one", value: "+" })
    // The losing row goes with this save; the latest one is updated.
    expect(database.execute).toHaveBeenCalledWith(
      "DELETE FROM evaluations WHERE id = ?",
      ["two"],
    )
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE evaluations SET"),
      ["+", null, NOW, "one"],
    )
  })

  it.each([
    {
      label: "wrong session",
      rows: [
        {
          id: "evaluation-1",
          studentId: "student-1",
          sessionId: "sun-am",
          value: "+",
          note: null,
        },
      ],
    },
    {
      label: "invalid value",
      rows: [
        {
          id: "evaluation-1",
          studentId: "student-1",
          sessionId: "sat-pm",
          value: "top",
          note: null,
        },
      ],
    },
  ])("rejects a corrupt read with $label", async ({ rows }) => {
    database.getAll.mockResolvedValueOnce(rows)
    await expect(listEvaluations("course-1", "sat-pm")).rejects.toThrow(
      "Invalid persisted evaluation",
    )
  })

  it("shows an evaluation stored twice once, on its latest row", async () => {
    database.getAll.mockResolvedValueOnce(
      [
        ["one", "2026-09-20T09:00:00.000Z", "-"],
        ["two", "2026-09-20T10:00:00.000Z", "+"],
      ].map(([id, updatedAt, value]) => ({
        id,
        updatedAt,
        studentId: "student-1",
        sessionId: "sat-pm",
        value,
        note: null,
      })),
    )
    await expect(listEvaluations("course-1", "sat-pm")).resolves.toEqual([
      {
        id: "two",
        studentId: "student-1",
        sessionId: "sat-pm",
        value: "+",
        note: null,
      },
    ])
  })

  it("loads the whole course and exact chronological student history", async () => {
    const rows = [
      {
        id: "late",
        studentId: "student-1",
        sessionId: "sun-am",
        value: "++",
        note: "Preciso",
      },
      {
        id: "early",
        studentId: "student-1",
        sessionId: "sat-pm",
        value: "+",
        note: null,
      },
    ]
    database.getAll.mockResolvedValueOnce(rows)
    await expect(listCourseEvaluations("course-1")).resolves.toHaveLength(2)
    expect(database.getAll).toHaveBeenLastCalledWith(
      expect.stringContaining("WHERE s.courseId = ?"),
      ["course-1"],
    )

    database.getAll.mockResolvedValueOnce(rows)
    await expect(
      listStudentEvaluations("course-1", "student-1"),
    ).resolves.toEqual([
      expect.objectContaining({ id: "early" }),
      expect.objectContaining({ id: "late" }),
    ])
    expect(database.getAll).toHaveBeenLastCalledWith(
      expect.stringContaining("AND s.id = ?"),
      ["course-1", "student-1"],
    )
  })
})
