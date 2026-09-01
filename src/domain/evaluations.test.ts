import { describe, expect, it } from "vitest"

import {
  getAccumulatedEvaluationSessions,
  getDefaultEvaluationSession,
  sortStudentsByEvaluations,
  summarizeEvaluations,
} from "@/domain/evaluations"
import type { EvaluationSymbol } from "@/domain/config"

describe("evaluation domain", () => {
  it.each<{
    values: Array<EvaluationSymbol | null>
    expected: { count: number; mean: number | null }
  }>([
    { values: [], expected: { count: 0, mean: null } },
    { values: [null, null], expected: { count: 0, mean: null } },
    { values: ["="], expected: { count: 1, mean: 0 } },
    { values: ["++", null, "--"], expected: { count: 2, mean: 0 } },
    { values: ["++", "+", null], expected: { count: 2, mean: 1.5 } },
    { values: ["-", "--", null], expected: { count: 2, mean: -1.5 } },
  ])("excludes missing marks from $values", ({ values, expected }) => {
    expect(summarizeEvaluations(values)).toEqual(expected)
  })

  it.each([
    ["2026-08-29T12:00:00", "sat-pm"],
    ["2026-08-29T18:00:00", "sat-pm"],
    ["2026-08-30T13:00:00", "sun-am"],
    ["2026-09-02T17:59:00", "wed-am"],
    ["2026-09-02T18:00:00", "wed-pm"],
    ["2026-09-05T10:00:00", "fri-pm"],
  ] as const)(
    "selects the latest completed session at %s",
    (reference, expected) => {
      expect(
        getDefaultEvaluationSession("2026-08-29", new Date(reference)),
      ).toBe(expected)
    },
  )

  it("orders alphabetically or by strongest mean without rewarding count", () => {
    const students = [
      { id: "bea", firstName: "Bea", surname: "Verdi" },
      { id: "aldo", firstName: "Aldo", surname: "Rossi" },
      { id: "carlo", firstName: "Carlo", surname: "Neri" },
      { id: "dina", firstName: "Dina", surname: "Blu" },
    ]
    const evaluations = [
      { studentId: "aldo", sessionId: "sat-pm" as const, value: "+" as const },
      { studentId: "aldo", sessionId: "sun-am" as const, value: "+" as const },
      { studentId: "bea", sessionId: "sat-pm" as const, value: "++" as const },
      { studentId: "carlo", sessionId: "sat-pm" as const, value: null },
    ]

    expect(
      sortStudentsByEvaluations(students, evaluations, "alphabetical").map(
        ({ id }) => id,
      ),
    ).toEqual(["dina", "carlo", "aldo", "bea"])
    expect(
      sortStudentsByEvaluations(students, evaluations, "strongest").map(
        ({ id }) => id,
      ),
    ).toEqual(["bea", "aldo", "dina", "carlo"])
  })

  it("retains missing slots through the latest accumulated session", () => {
    expect(
      getAccumulatedEvaluationSessions([
        { studentId: "one", sessionId: "sat-pm", value: "+" },
        { studentId: "two", sessionId: "mon-am", value: null },
      ]),
    ).toEqual(["sat-pm", "sun-am", "sun-pm", "mon-am"])
    expect(getAccumulatedEvaluationSessions([])).toEqual([])
  })
})
