import { describe, expect, it } from "vitest"

import { DUTY_DAYS } from "@/domain/config"
import {
  buildDutySummarySections,
  dutySummaryWarning,
  type DutySummaryDayLine,
} from "./dutySummaryModel"

const member = (label: string, isMinor = false) => ({ label, isMinor })

describe("buildDutySummarySections", () => {
  it("places the seven days in the canonical Sabato→Venerdì order, regardless of input order", () => {
    const shuffled: DutySummaryDayLine[] = [
      { dayId: "friday", members: [], completed: false, warning: null },
      { dayId: "monday", members: [], completed: false, warning: null },
      { dayId: "saturday", members: [], completed: false, warning: null },
    ]

    const sections = buildDutySummarySections({
      title: "Riepilogo comandate",
      lines: shuffled,
    })

    expect(sections.days).toHaveLength(7)
    expect(sections.days.map((day) => day.dayId)).toEqual([
      "saturday",
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
    ])
    expect(sections.days.map((day) => day.label)).toEqual(
      DUTY_DAYS.map((day) => day.label),
    )
    expect(sections.days.map((day) => day.shortLabel)).toEqual(
      DUTY_DAYS.map((day) => day.short),
    )
  })

  it("carries the title through unchanged", () => {
    const sections = buildDutySummarySections({
      title: "Riepilogo comandate",
      lines: [],
    })
    expect(sections.title).toBe("Riepilogo comandate")
  })

  it("shows every assigned person exactly once per duty, sorted by name", () => {
    const sections = buildDutySummarySections({
      title: "t",
      lines: [
        {
          dayId: "saturday",
          members: [member("Zeno Bruno"), member("Aldo Rossi")],
          completed: false,
          warning: null,
        },
      ],
    })

    const saturday = sections.days.find((day) => day.dayId === "saturday")!
    expect(saturday.members.map((m) => m.label)).toEqual([
      "Aldo Rossi",
      "Zeno Bruno",
    ])
    // Every other day, not supplied a line at all, is empty rather than
    // missing — the summary always shows the whole week.
    const otherDays = sections.days.filter((day) => day.dayId !== "saturday")
    expect(otherDays.every((day) => day.members.length === 0)).toBe(true)
  })

  it("keeps a minor flag through the sort", () => {
    const sections = buildDutySummarySections({
      title: "t",
      lines: [
        {
          dayId: "sunday",
          members: [member("Aldo Rossi", true)],
          completed: false,
          warning: null,
        },
      ],
    })
    const sunday = sections.days.find((day) => day.dayId === "sunday")!
    expect(sunday.members).toEqual([{ label: "Aldo Rossi", isMinor: true }])
  })

  it("shows an empty day (no line supplied, or a line with no members) as zero members, not completed", () => {
    const sections = buildDutySummarySections({
      title: "t",
      lines: [
        { dayId: "monday", members: [], completed: false, warning: null },
      ],
    })

    for (const day of sections.days) {
      expect(day.members).toEqual([])
      expect(day.completed).toBe(false)
      expect(day.warning).toBeNull()
    }
  })

  it("carries a day's completed flag and warning through unchanged", () => {
    const sections = buildDutySummarySections({
      title: "t",
      lines: [
        {
          dayId: "thursday",
          members: [member("Aldo Rossi")],
          completed: true,
          warning: { severity: "yellow", count: 1 },
        },
      ],
    })
    const thursday = sections.days.find((day) => day.dayId === "thursday")!
    expect(thursday.completed).toBe(true)
    expect(thursday.warning).toEqual({ severity: "yellow", count: 1 })
    // An untouched day stays not-completed with no warning.
    const friday = sections.days.find((day) => day.dayId === "friday")!
    expect(friday.completed).toBe(false)
    expect(friday.warning).toBeNull()
  })
})

describe("dutySummaryWarning", () => {
  it("returns null when the rota shows no warning for the day", () => {
    expect(dutySummaryWarning([])).toBeNull()
  })

  it("returns yellow with the exact count when every warning is advisory", () => {
    expect(
      dutySummaryWarning([{ severity: "advisory" }, { severity: "advisory" }]),
    ).toEqual({ severity: "yellow", count: 2 })
  })

  it("returns red when at least one warning is major, even mixed with advisory ones", () => {
    expect(
      dutySummaryWarning([{ severity: "advisory" }, { severity: "major" }]),
    ).toEqual({ severity: "red", count: 2 })
  })
})
