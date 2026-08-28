import { describe, expect, it } from "vitest"

import { validateCourseState } from "@/domain/invariants"
import { buildD2FoundationScenario } from "@/domain/scenarios"

describe("course-state invariants", () => {
  it("accepts the deterministic foundation scenario", () => {
    expect(validateCourseState(buildD2FoundationScenario())).toEqual([])
  })

  it("detects duplicate assignments and dangling references", () => {
    const state = buildD2FoundationScenario()
    state.crews.push({
      id: "crew-sat-pm-2",
      sessionId: "sat-pm",
      studentIds: ["student-mario-rossi"],
      volunteerIds: ["missing-volunteer"],
      destination: "boat",
      boatId: "boat-quest-7",
    })
    state.evaluations.push({
      id: "evaluation-missing",
      sessionId: "invalid-session",
      studentId: "missing-student",
      value: "excellent",
    })

    const codes = validateCourseState(state).map(({ code }) => code)

    expect(codes).toEqual(
      expect.arrayContaining([
        "duplicate-session-student",
        "dangling-crew-volunteer",
        "duplicate-session-boat",
        "invalid-session",
        "dangling-evaluation-student",
        "invalid-evaluation-value",
      ]),
    )
  })

  it("detects a student assigned both to a crew and A terra", () => {
    const state = buildD2FoundationScenario()
    state.landAssignments.push({
      id: "land-mario-sat-pm",
      sessionId: "sat-pm",
      studentId: "student-mario-rossi",
    })

    expect(validateCourseState(state)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate-session-student" }),
      ]),
    )
  })
})
