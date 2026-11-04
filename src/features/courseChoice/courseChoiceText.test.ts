import { describe, expect, it } from "vitest"

import {
  formatLastChange,
  joinNames,
  namesOf,
} from "@/features/courseChoice/courseChoiceText"

const now = new Date(2026, 10, 4, 15, 0)
const at = (day: number, hour: number, minute: number) =>
  new Date(2026, 10, day, hour, minute).toISOString()

describe("formatLastChange", () => {
  it.each([
    [at(4, 14, 20), "oggi, 14:20"],
    [at(4, 8, 5), "oggi, 8:05"],
    [at(3, 18, 42), "ieri, 18:42"],
    [new Date(2026, 9, 30, 9, 5).toISOString(), "30 ott 2026, 9:05"],
    [null, "non disponibile"],
    ["not a date", "non disponibile"],
  ])("%s reads %s", (iso, expected) => {
    expect(formatLastChange(iso, now)).toBe(expected)
  })

  it("says yesterday across a month's first day", () => {
    expect(
      formatLastChange(
        new Date(2026, 9, 31, 23, 59).toISOString(),
        new Date(2026, 10, 1, 0, 1),
      ),
    ).toBe("ieri, 23:59")
  })
})

describe("namesOf", () => {
  const course = (id: string, level: 1 | 2 | 3, students = 0) => ({
    id,
    family: "Deriva" as const,
    level,
    isoWeek: 45,
    students,
    lastChange: null,
  })

  it("is the code alone when it is unique", () => {
    expect(namesOf(course("a", 2), [course("a", 2), course("b", 3)])).toBe(
      "D2 - 45",
    )
  })

  it("adds what tells apart two courses sharing a code", () => {
    expect(
      namesOf(course("a", 2, 21), [course("a", 2, 21), course("b", 2, 23)]),
    ).toBe("D2 - 45 (21 allievi, non disponibile)")
  })
})

describe("joinNames", () => {
  it.each([
    [["A"], "A"],
    [["A", "B"], "A e B"],
    [["A", "B", "C"], "A, B e C"],
  ])("%j", (names, expected) => {
    expect(joinNames(names)).toBe(expected)
  })
})
