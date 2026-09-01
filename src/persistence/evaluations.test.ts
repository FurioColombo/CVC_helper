import { beforeEach, describe, expect, it, vi } from "vitest"

const database = vi.hoisted(() => ({
  execute: vi.fn(),
  getAll: vi.fn(),
  init: vi.fn(),
}))

vi.mock("@/persistence/db", () => ({ db: database }))

import { listEvaluations, saveEvaluation } from "@/persistence/evaluations"

describe("evaluation persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    database.init.mockResolvedValue(undefined)
    database.getAll.mockResolvedValue([])
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
      "UPDATE evaluations SET value = ?, note = ? WHERE id = ?",
      ["++", "Buona conduzione", "evaluation-1"],
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

  it("rejects foreign students and corrupt duplicate records", async () => {
    await expect(
      saveEvaluation("course-1", "student-2", "sat-pm", {
        value: "=",
        note: null,
      }),
    ).rejects.toThrow("does not belong")

    database.getAll
      .mockResolvedValueOnce([{ id: "student-1" }])
      .mockResolvedValueOnce([{ id: "one" }, { id: "two" }])
    await expect(
      saveEvaluation("course-1", "student-1", "sat-pm", {
        value: "+",
        note: null,
      }),
    ).rejects.toThrow("Duplicate")
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
    {
      label: "duplicate student",
      rows: ["one", "two"].map((id) => ({
        id,
        studentId: "student-1",
        sessionId: "sat-pm",
        value: "+",
        note: null,
      })),
    },
  ])("rejects a corrupt read with $label", async ({ rows }) => {
    database.getAll.mockResolvedValueOnce(rows)
    await expect(listEvaluations("course-1", "sat-pm")).rejects.toThrow(
      "Invalid persisted evaluation",
    )
  })
})
