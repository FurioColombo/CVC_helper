import { describe, expect, it } from "vitest"

import {
  getDefaultEvaluationSession,
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
})
