import { describe, expect, it } from "vitest"

import {
  validateCourseState,
  validateStudentRecords,
} from "@/domain/invariants"
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

  it("detects invalid persisted student enums", () => {
    const state = buildD2FoundationScenario()
    state.students[0] = {
      ...state.students[0]!,
      active: 2,
      sex: "invalid",
      size: "XXL",
    }

    expect(validateCourseState(state)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-student-active" }),
        expect.objectContaining({ code: "invalid-student-sex" }),
        expect.objectContaining({ code: "invalid-student-size" }),
      ]),
    )
  })

  it("validates persisted student records independently at subsystem reads", () => {
    expect(
      validateStudentRecords([
        { id: "student-1", active: 1, sex: "male", size: "M" },
        { id: "student-1", active: 3, sex: "invalid", size: "XXL" },
      ]).map(({ code }) => code),
    ).toEqual([
      "duplicate-id",
      "invalid-student-active",
      "invalid-student-sex",
      "invalid-student-size",
    ])
  })
})
