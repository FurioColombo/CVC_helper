import { describe, expect, it } from "vitest"

import {
  formatLastChange,
  joinNames,
  namesOf,
  twinTag,
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
    year: 2026,
    crews: 0,
    evaluations: 0,
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

  it("says one student in the singular", () => {
    expect(
      namesOf(course("a", 2, 1), [course("a", 2, 1), course("b", 2, 3)]),
    ).toBe("D2 - 45 (1 allievo, non disponibile)")
  })

  it("adds the year, crews and evaluations when they are what differs", () => {
    const first = {
      ...course("a", 2, 4),
      year: 2025,
      crews: 6,
      evaluations: 84,
    }
    const second = {
      ...course("b", 2, 4),
      year: 2026,
      crews: 1,
      evaluations: 1,
    }
    expect(namesOf(first, [first, second])).toBe(
      "D2 - 45 (2025, 4 allievi, 6 equipaggi, 84 valutazioni, non disponibile)",
    )
    expect(namesOf(second, [first, second])).toBe(
      "D2 - 45 (2026, 4 allievi, 1 equipaggio, 1 valutazione, non disponibile)",
    )
  })

  it("names two courses alike in everything by their id, on card and question", () => {
    const first = course("aaaaaa-1", 2, 4)
    const second = course("bbbbbb-2", 2, 4)
    expect(namesOf(first, [first, second])).toBe(
      "D2 - 45 (4 allievi, non disponibile, codice aaaaaa)",
    )
    expect(namesOf(second, [first, second])).not.toBe(
      namesOf(first, [first, second]),
    )
    expect(twinTag(first, [first, second])).toBe("codice aaaaaa")
    expect(twinTag(first, [first, course("c", 3)])).toBeNull()
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
