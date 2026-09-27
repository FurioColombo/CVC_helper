import { describe, expect, it } from "vitest"

import type { StudentScanCandidate } from "@/capabilities/studentScan"
import {
  ageConflictsWithStoredDate,
  candidateIsReady,
  needsReview,
  summarizeScanReview,
  toReviewCandidate,
  type ScanReviewCandidate,
} from "@/capabilities/studentScanReview"

const COURSE_START = "2026-08-29"

function row(
  overrides: Partial<StudentScanCandidate> = {},
  review: Partial<ScanReviewCandidate> = {},
): ScanReviewCandidate {
  const candidate: StudentScanCandidate = {
    sourceId: "line",
    firstName: "Giulia",
    surname: "Esposito",
    dateOfBirth: "2008-03-10",
    phone: "",
    sex: "female",
    confidence: { firstName: 95, surname: 95, dateOfBirth: 95, phone: 0 },
    ...overrides,
  }
  return { ...toReviewCandidate(candidate, 0, COURSE_START), ...review }
}

describe("scan review age against a stored birth date", () => {
  it.each([
    // printed age, birth date, conflict
    [18, "2008-03-10", false],
    [17, "2008-03-10", true], // a year off, but it turns an adult into a minor
    [19, "2008-03-10", false], // a year off, both adults
    [16, "2008-03-10", true], // two years off
    [24, "2002-02-12", false],
    [23, "2002-02-12", false],
  ])(
    "a printed age of %i with birth date %s conflicts: %s",
    (age, dateOfBirth, conflict) => {
      const candidate = row({
        dateOfBirth,
        ageReading: { value: age, confidence: 95 },
      })
      expect(ageConflictsWithStoredDate(candidate, COURSE_START)).toBe(conflict)
      expect(candidateIsReady(candidate, COURSE_START, false)).toBe(!conflict)
    },
  )

  it.each([
    ["17", true],
    ["19", true],
    ["18", false],
  ])(
    "an age typed as %s must match the birth date exactly (conflict: %s)",
    (typed, conflict) => {
      const candidate = row({}, { reviewAge: typed, ageManuallyEdited: true })
      expect(ageConflictsWithStoredDate(candidate, COURSE_START)).toBe(conflict)
      expect(candidateIsReady(candidate, COURSE_START, false)).toBe(!conflict)
    },
  )

  it("flags a half-typed date instead of calculating an age from it", () => {
    // The operator edits a row that already shows its age.
    const candidate = row({}, { dateOfBirth: "20140-02-16" })
    expect(needsReview(candidate, "dateOfBirth", COURSE_START)).toBe(true)
    expect(ageConflictsWithStoredDate(candidate, COURSE_START)).toBe(true)
    expect(candidateIsReady(candidate, COURSE_START, false)).toBe(false)
  })

  it("keeps an uncertain date marked when the printed age is uncertain too", () => {
    const candidate = row({
      confidence: { firstName: 95, surname: 95, dateOfBirth: 40, phone: 0 },
      ageReading: { value: 18, confidence: 30 },
    })
    expect(needsReview(candidate, "dateOfBirth", COURSE_START)).toBe(true)
    expect(candidateIsReady(candidate, COURSE_START, false)).toBe(false)
  })

  it("lets a reliable printed age vouch for an uncertain date", () => {
    const candidate = row({
      confidence: { firstName: 95, surname: 95, dateOfBirth: 40, phone: 0 },
      ageReading: { value: 18, confidence: 90 },
    })
    expect(needsReview(candidate, "dateOfBirth", COURSE_START)).toBe(false)
    expect(candidateIsReady(candidate, COURSE_START, false)).toBe(true)
  })
})

describe("scan review counters", () => {
  it("counts missing and marked fields once each and the rows they block", () => {
    const summary = summarizeScanReview(
      [
        row(),
        row({ surname: "" }),
        row({
          confidence: { firstName: 50, surname: 95, dateOfBirth: 95, phone: 0 },
        }),
      ],
      COURSE_START,
      false,
    )
    expect(summary).toEqual({
      missingFields: 1,
      fieldsMarkedForReview: 1,
      fieldsFlagged: 2,
      rowsToReview: 2,
      readyRows: 1,
    })
  })
})

describe("row warnings and implausible ages", () => {
  it.each(["possible-staff", "possible-merged-rows"] as const)(
    "keeps a %s row out of the ready rows until it is checked",
    (rowWarning) => {
      const candidate = row({ rowWarning })
      expect(candidateIsReady(candidate, COURSE_START, false)).toBe(false)
      expect(
        candidateIsReady(
          { ...candidate, confirmed: true },
          COURSE_START,
          false,
        ),
      ).toBe(true)
    },
  )

  it.each([
    [0, true],
    [3, true],
    [4, false],
    [99, false],
    [117, true],
  ])("marks a read age of %i for review: %s", (age, marked) => {
    const candidate = row({
      dateOfBirth: "",
      ageReading: { value: age, confidence: 95 },
    })
    expect(candidateIsReady(candidate, COURSE_START, false)).toBe(!marked)
  })

  it("keeps an implausible age marked after only the row is checked", () => {
    const candidate = row(
      { dateOfBirth: "", ageReading: { value: 0, confidence: 95 } },
      { confirmed: true },
    )
    expect(candidateIsReady(candidate, COURSE_START, false)).toBe(false)
    expect(
      candidateIsReady(
        { ...candidate, acknowledgedFields: { age: true } },
        COURSE_START,
        false,
      ),
    ).toBe(true)
  })

  it("holds an assistant's row whose age is a year off its date", () => {
    // 03/12/2010 read with day and month swapped: 15 at the course start,
    // while the sheet printed 16.
    const candidate = row({
      dateOfBirth: "2010-12-03",
      ageReading: { value: 16, confidence: 100 },
      rowWarning: "from-assistant",
    })
    expect(ageConflictsWithStoredDate(candidate, COURSE_START)).toBe(true)
    expect(
      candidateIsReady({ ...candidate, confirmed: true }, COURSE_START, false),
    ).toBe(false)
  })

  it("accepts an unusual age the operator typed", () => {
    const candidate = row(
      { dateOfBirth: "", ageReading: { value: 3, confidence: 95 } },
      { reviewAge: "3", ageManuallyEdited: true },
    )
    expect(candidateIsReady(candidate, COURSE_START, false)).toBe(true)
  })
})
