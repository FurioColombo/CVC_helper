import { describe, expect, it } from "vitest"

import {
  buildCourseDetails,
  getCourseDateRange,
  getIsoWeekInfo,
} from "@/domain/course"

describe("course setup domain rules", () => {
  it("derives the ISO week and year from the local calendar date", () => {
    expect(getIsoWeekInfo(new Date(2026, 7, 29, 12))).toEqual({
      isoWeek: 35,
      year: 2026,
    })
  })

  it("handles dates whose ISO week belongs to the previous year", () => {
    expect(getIsoWeekInfo(new Date(2021, 0, 1, 12))).toEqual({
      isoWeek: 53,
      year: 2020,
    })
  })

  it("stores the Saturday-to-Saturday course dates for the ISO week", () => {
    expect(getCourseDateRange({ isoWeek: 35, year: 2026 })).toEqual({
      startDate: "2026-08-29",
      endDate: "2026-09-05",
    })
  })

  it("generates the canonical course label and dates", () => {
    expect(buildCourseDetails("Deriva", 2, new Date(2026, 7, 29, 12))).toEqual({
      family: "Deriva",
      level: 2,
      isoWeek: 35,
      year: 2026,
      startDate: "2026-08-29",
      endDate: "2026-09-05",
      label: "D2 35 2026",
    })
  })

  it("uses the cabin-course prefix for every selectable level", () => {
    expect(buildCourseDetails("Cabinato", 5, new Date(2021, 0, 1, 12))).toEqual(
      expect.objectContaining({
        label: "C5 53 2020",
        family: "Cabinato",
        level: 5,
      }),
    )
  })
})
