import { describe, expect, it } from "vitest"

import {
  validateBoatRecords,
  validateCourseState,
  validateCrewRecords,
  validateDutyRecords,
  validateStudentRecords,
  validateVolunteerRecords,
} from "@/domain/invariants"
import { VOLUNTEER_ROLES } from "@/domain/config"
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

  it("enforces canonical session boat selection before exact assignment", () => {
    const state = buildD2FoundationScenario()
    state.sessionBoats = [
      ...state.sessionBoats,
      { ...state.sessionBoats[0]!, id: "duplicate-selection" },
      {
        id: "missing-selection",
        sessionId: "invalid-session",
        boatId: "missing-boat",
      },
    ]
    expect(validateCourseState(state).map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "duplicate-session-boat-selection",
        "invalid-session",
        "dangling-session-boat",
      ]),
    )

    state.sessionBoats = []
    expect(validateCourseState(state)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "crew-boat-not-selected" }),
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
        {
          id: "student-1",
          dateOfBirth: "2000-01-01",
          active: 1,
          sex: "male",
          size: "M",
        },
        {
          id: "student-1",
          dateOfBirth: "2000-01-01",
          active: 3,
          sex: "invalid",
          size: "XXL",
        },
      ]).map(({ code }) => code),
    ).toEqual([
      "duplicate-id",
      "invalid-student-active",
      "invalid-student-sex",
      "invalid-student-size",
    ])
  })

  it("accepts an age-only student and rejects missing or invalid age sources", () => {
    const issues = validateStudentRecords([
      { id: "age-only", dateOfBirth: "", declaredAgeAtCourseStart: 17 },
      { id: "missing-age", dateOfBirth: "" },
      { id: "fractional-age", dateOfBirth: "", declaredAgeAtCourseStart: 17.5 },
      { id: "too-old", dateOfBirth: "", declaredAgeAtCourseStart: 121 },
    ])

    expect(issues.map(({ code, path }) => ({ code, path }))).toEqual([
      {
        code: "missing-student-age-source",
        path: "students[1]",
      },
      {
        code: "invalid-student-declared-age",
        path: "students[2].declaredAgeAtCourseStart",
      },
      {
        code: "invalid-student-declared-age",
        path: "students[3].declaredAgeAtCourseStart",
      },
    ])
  })

  it("validates volunteer identity and role without applying student rules", () => {
    expect(
      validateVolunteerRecords([
        { id: "volunteer-1", name: "Anna Bianchi", role: "ADV" },
        { id: "volunteer-1", name: null, role: "student" },
      ]).map(({ code }) => code),
    ).toEqual([
      "duplicate-id",
      "invalid-volunteer-name",
      "invalid-volunteer-role",
    ])
  })

  it.each(VOLUNTEER_ROLES)("accepts %s as embarked volunteer staff", (role) => {
    const state = buildD2FoundationScenario()
    const volunteerId = `volunteer-${role.toLowerCase()}`
    state.volunteers.push({
      id: volunteerId,
      name: `${role} volontario`,
      role,
    })
    state.crews[0]!.volunteerIds.push(volunteerId)

    expect(validateCourseState(state)).toEqual([])
  })

  it("keeps CT invalid in every student-only persisted reference", () => {
    const state = buildD2FoundationScenario()
    const volunteerId = "volunteer-ct"
    state.volunteers.push({
      id: volunteerId,
      name: "Carla Timoniere",
      role: "CT",
    })
    state.crews[0]!.volunteerIds.push(volunteerId)
    state.crews[0]!.studentIds.push(volunteerId)
    state.dutyAssignments = [{ dayId: "saturday", studentId: volunteerId }]
    state.landAssignments.push({
      id: "land-ct",
      sessionId: "sun-am",
      studentId: volunteerId,
    })
    state.evaluations.push({
      id: "evaluation-ct",
      sessionId: "sun-am",
      studentId: volunteerId,
      value: "+",
    })

    const issues = validateCourseState(state)
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "dangling-duty-student" }),
        expect.objectContaining({ code: "dangling-crew-student" }),
        expect.objectContaining({ code: "dangling-land-student" }),
        expect.objectContaining({ code: "dangling-evaluation-student" }),
      ]),
    )
    expect(issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "dangling-crew-volunteer" }),
      ]),
    )
  })

  it("detects corrupt boat and fault records at subsystem reads", () => {
    expect(
      validateBoatRecords(
        [
          {
            id: "boat-1",
            type: "RS Quest",
            number: "7",
            availability: "available",
          },
          {
            id: "boat-2",
            type: "RS Quest",
            number: "07",
            availability: "retired",
          },
          {
            id: "boat-3",
            type: "Unknown",
            number: " ",
            availability: "available",
          },
        ],
        [
          {
            id: "fault-1",
            boatId: "boat-1",
            description: " ",
            state: "waiting",
            createdAt: "2026-08-30T12:00:00.000Z",
            updatedAt: "2026-08-29T12:00:00.000Z",
          },
        ],
      ).map(({ code }) => code),
    ).toEqual(
      expect.arrayContaining([
        "duplicate-boat-identity",
        "invalid-boat-availability",
        "invalid-boat-type",
        "invalid-boat-number",
        "invalid-fault-state",
        "invalid-fault-description",
        "invalid-fault-chronology",
      ]),
    )
  })

  it("accepts an unavailable boat with simultaneous open and resolved faults", () => {
    expect(
      validateBoatRecords(
        [
          {
            id: "boat-quest-2",
            type: "RS Quest",
            number: "2",
            availability: "unavailable",
          },
        ],
        [
          {
            id: "fault-open",
            boatId: "boat-quest-2",
            description: "Timone duro",
            state: "open",
            createdAt: "2026-08-29T10:00:00.000Z",
            updatedAt: "2026-08-29T10:00:00.000Z",
          },
          {
            id: "fault-resolved",
            boatId: "boat-quest-2",
            description: "Scotta sostituita",
            state: "resolved",
            createdAt: "2026-08-29T09:00:00.000Z",
            updatedAt: "2026-08-29T11:00:00.000Z",
          },
        ],
      ),
    ).toEqual([])
  })

  it("rejects parseable but non-ISO fault timestamps", () => {
    expect(
      validateBoatRecords(
        [
          {
            id: "boat-1",
            type: "RS Quest",
            number: "2",
            availability: "available",
          },
        ],
        [
          {
            id: "fault-1",
            boatId: "boat-1",
            description: "Timone duro",
            state: "open",
            createdAt: "August 29, 2026 10:00:00 UTC",
            updatedAt: "August 29, 2026 11:00:00 UTC",
          },
        ],
      ),
    ).toEqual([expect.objectContaining({ code: "invalid-fault-timestamp" })])
  })

  it("detects invalid, duplicate and dangling duty state", () => {
    expect(
      validateDutyRecords(
        [{ id: "student-1", active: 1, sex: "male", size: "M" }],
        [
          { dayId: "saturday", studentId: "student-1" },
          { dayId: "saturday", studentId: "student-1" },
          { dayId: "noday", studentId: "missing" },
        ],
        ["saturday", "saturday", "noday"],
      ).map(({ code }) => code),
    ).toEqual(
      expect.arrayContaining([
        "duplicate-duty-assignment",
        "invalid-duty-day",
        "dangling-duty-student",
        "duplicate-completed-duty-day",
        "invalid-completed-duty-day",
      ]),
    )
  })

  it("prevents simultaneous duplicate crew and A terra assignment", () => {
    const issues = validateCrewRecords(
      [{ id: "student-1", active: 1, sex: "male", size: "M" }],
      [{ id: "volunteer-1", name: "Anna", role: "ADV" }],
      [
        {
          id: "crew-1",
          sessionId: "sat-pm",
          studentIds: ["student-1"],
          volunteerIds: ["volunteer-1"],
          destination: "unassigned",
        },
        {
          id: "crew-2",
          sessionId: "sat-pm",
          studentIds: ["student-1"],
          volunteerIds: ["volunteer-1"],
          destination: "unassigned",
        },
      ],
      [
        {
          id: "land-1",
          sessionId: "sat-pm",
          studentId: "student-1",
        },
      ],
    ).map(({ code }) => code)

    expect(issues).toEqual(
      expect.arrayContaining([
        "duplicate-session-student",
        "duplicate-session-volunteer",
      ]),
    )
  })
})
