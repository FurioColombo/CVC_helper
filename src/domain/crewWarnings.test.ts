import { describe, expect, it } from "vitest"

import {
  SIZE_WARNING_MATRIX,
  STUDENT_SIZES,
  type StudentSize,
} from "@/domain/config"
import {
  getBoatCrewWarnings,
  getCrewWarningSummary,
  getCrewWarnings,
  getTwoPersonSizeWarning,
  getWorstCrewWarningSeverity,
  type CrewHistoryEntry,
} from "@/domain/crewWarnings"

const CURRENT: CrewHistoryEntry = {
  crewId: "current",
  sessionId: "wed-pm",
  studentIds: ["student-1", "student-2"],
}

describe("crew warnings", () => {
  it.each(
    STUDENT_SIZES.flatMap((left) =>
      STUDENT_SIZES.map((right) => [left, right] as const),
    ),
  )("uses the canonical size matrix for %s + %s", (left, right) => {
    const warning = getTwoPersonSizeWarning(
      ["student-1", "student-2"],
      new Map<string, StudentSize | null>([
        ["student-1", left],
        ["student-2", right],
      ]),
    )
    const expected = SIZE_WARNING_MATRIX[left][right]
    expect(warning?.severity ?? "none").toBe(expected)
  })

  it("marks a pair from the previous three sessions red and reports history", () => {
    const warnings = getCrewWarnings(
      CURRENT,
      [
        {
          crewId: "previous",
          sessionId: "tue-am",
          studentIds: ["student-2", "student-1"],
        },
        {
          crewId: "older",
          sessionId: "sun-am",
          studentIds: ["student-1", "student-2"],
        },
      ],
      new Map(),
    )

    expect(warnings).toContainEqual(
      expect.objectContaining({
        kind: "pair-recent",
        severity: "red",
        previousCount: 2,
        lastSessionId: "tue-am",
      }),
    )
  })

  it("marks only older pair history yellow", () => {
    const warnings = getCrewWarnings(
      CURRENT,
      [
        {
          crewId: "older",
          sessionId: "sun-am",
          studentIds: ["student-1", "student-2"],
        },
      ],
      new Map(),
    )

    expect(warnings).toEqual([
      expect.objectContaining({ kind: "pair-older", severity: "yellow" }),
    ])
  })

  it.each([
    ["tue-am", "red"],
    ["mon-pm", "yellow"],
  ] as const)(
    "treats the exact previous-three boundary from %s as %s",
    (previousSessionId, severity) => {
      const warnings = getCrewWarnings(
        CURRENT,
        [
          {
            crewId: "boundary",
            sessionId: previousSessionId,
            studentIds: ["student-1", "student-2"],
          },
        ],
        new Map(),
      )
      expect(warnings[0]?.severity).toBe(severity)
    },
  )

  it("ignores future crews and incomplete size data", () => {
    expect(
      getCrewWarnings(
        CURRENT,
        [
          {
            crewId: "future",
            sessionId: "thu-am",
            studentIds: ["student-1", "student-2"],
          },
        ],
        new Map([["student-1", "XS"]]),
      ),
    ).toEqual([])
  })

  it("checks identical 3+ groups and every internal pair", () => {
    const current: CrewHistoryEntry = {
      crewId: "current",
      sessionId: "fri-pm",
      studentIds: ["student-1", "student-2", "student-3"],
    }
    const warnings = getCrewWarnings(
      current,
      [
        {
          crewId: "old-group",
          sessionId: "sun-am",
          studentIds: ["student-3", "student-1", "student-2"],
        },
        {
          crewId: "recent-pair",
          sessionId: "thu-pm",
          studentIds: ["student-1", "student-3"],
        },
      ],
      new Map(),
    )

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "group-repeat", severity: "red" }),
        expect.objectContaining({
          kind: "pair-recent",
          studentIds: expect.arrayContaining(["student-1", "student-3"]),
        }),
        expect.objectContaining({
          kind: "pair-older",
          studentIds: expect.arrayContaining(["student-2", "student-3"]),
        }),
      ]),
    )
    expect(getWorstCrewWarningSeverity(warnings)).toBe("red")
  })

  it("does not treat A terra as history because only real crews are inputs", () => {
    expect(getCrewWarnings(CURRENT, [], new Map())).toEqual([])
  })

  it.each([
    ["available", ["resolved"], [], null],
    ["available", ["open"], ["boat-fault"], "yellow"],
    ["available", ["reported"], ["boat-fault"], "yellow"],
    ["unavailable", ["resolved"], ["boat-unavailable"], "red"],
    [
      "unavailable",
      ["open", "reported", "resolved"],
      ["boat-unavailable", "boat-fault"],
      "red",
    ],
  ] as const)(
    "keeps %s boat and %s fault reasons separate",
    (availability, faultStates, kinds, severity) => {
      const boatWarnings = getBoatCrewWarnings({
        boatId: "boat-7",
        boatLabel: "RS Quest 7",
        availability,
        faultStates,
      })
      const summary = getCrewWarningSummary(boatWarnings)
      expect(summary.boatReasons.map(({ kind }) => kind)).toEqual(kinds)
      expect(summary.crewReasons).toEqual([])
      expect(summary.severity).toBe(severity)
      if (faultStates.some((state) => state === "open")) {
        expect(boatWarnings).toContainEqual(
          expect.objectContaining({
            kind: "boat-fault",
            unresolvedFaultCount: faultStates.filter(
              (state) => state !== "resolved",
            ).length,
          }),
        )
      }
    },
  )

  it("returns one highest-severity summary while retaining crew and boat reasons", () => {
    const crewWarnings = getCrewWarnings(
      CURRENT,
      [],
      new Map([
        ["student-1", "L"],
        ["student-2", "L"],
      ]),
    )
    const summary = getCrewWarningSummary([
      ...crewWarnings,
      ...getBoatCrewWarnings({
        boatId: "boat-7",
        boatLabel: "RS Quest 7",
        availability: "unavailable",
        faultStates: ["open"],
      }),
    ])

    expect(summary.severity).toBe("red")
    expect(summary.crewReasons).toHaveLength(1)
    expect(summary.boatReasons).toHaveLength(2)
  })
})
