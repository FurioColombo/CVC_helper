import { describe, expect, it } from "vitest"

import {
  resolveByKey,
  resolveCoursePlacements,
  resolvePeople,
} from "@/persistence/placementConflicts"

const early = "2026-09-19T10:00:00.000Z"
const late = "2026-09-19T11:00:00.000Z"

const member = (
  id: string,
  crewId: string,
  personId: string,
  updatedAt: string | null,
  personType = "student",
) => ({ id, crewId, personId, personType, updatedAt })
const land = (id: string, studentId: string, updatedAt: string | null) => ({
  id,
  studentId,
  sessionId: "sat-pm",
  updatedAt,
})
const sessionOf = () => "sat-pm"

describe("resolveByKey", () => {
  it.each([
    ["the later updatedAt", early, "a", late, "b", "b"],
    ["the later updatedAt, whatever the id", late, "z", early, "a", "z"],
    ["the greater id on a tie", late, "a", late, "b", "b"],
    ["a stamped row over a missing stamp", null, "z", early, "a", "a"],
  ])("keeps %s", (_name, firstAt, firstId, secondAt, secondId, winner) => {
    const rows = [
      { id: firstId, updatedAt: firstAt },
      { id: secondId, updatedAt: secondAt },
    ]
    const { kept, dropped } = resolveByKey(rows, () => "same")
    expect(kept.map(({ id }) => id)).toEqual([winner])
    expect(dropped).toHaveLength(1)
  })

  it("leaves distinct keys alone and keeps the row order", () => {
    const rows = [
      { id: "b", updatedAt: early },
      { id: "a", updatedAt: early },
    ]
    const { kept, dropped } = resolveByKey(rows, ({ id }) => id)
    expect(kept).toEqual(rows)
    expect(dropped).toEqual([])
  })
})

describe("resolvePeople", () => {
  it("settles the same student twice on land on the latest row", () => {
    const result = resolvePeople(
      [],
      [land("l1", "s1", early), land("l2", "s1", late)],
      sessionOf,
    )
    expect(result.land.map(({ id }) => id)).toEqual(["l2"])
    expect(result.droppedLand.map(({ id }) => id)).toEqual(["l1"])
  })

  it("settles the same student twice in a crew on the latest row", () => {
    const result = resolvePeople(
      [member("m1", "c1", "s1", late), member("m2", "c1", "s1", early)],
      [],
      sessionOf,
    )
    expect(result.members.map(({ id }) => id)).toEqual(["m1"])
    expect(result.droppedMembers.map(({ id }) => id)).toEqual(["m2"])
  })

  it("settles a student on land and in a crew on the latest edit", () => {
    const crewLater = resolvePeople(
      [member("m1", "c1", "s1", late)],
      [land("l1", "s1", early)],
      sessionOf,
    )
    expect(crewLater.members).toHaveLength(1)
    expect(crewLater.land).toEqual([])
    const landLater = resolvePeople(
      [member("m1", "c1", "s1", early)],
      [land("l1", "s1", late)],
      sessionOf,
    )
    expect(landLater.members).toEqual([])
    expect(landLater.land).toHaveLength(1)
  })

  it("settles a student in two crews on the latest edit", () => {
    const result = resolvePeople(
      [member("m1", "c1", "s1", early), member("m2", "c2", "s1", late)],
      [],
      sessionOf,
    )
    expect(result.members.map(({ crewId }) => crewId)).toEqual(["c2"])
  })

  it("breaks a tie between a crew and land with the greater id", () => {
    const result = resolvePeople(
      [member("m1", "c1", "s1", late)],
      [land("l1", "s1", late)],
      sessionOf,
    )
    // "m1" is greater than "l1"
    expect(result.members).toHaveLength(1)
    expect(result.land).toEqual([])
  })

  it("does not mix people, types or sessions", () => {
    const result = resolvePeople(
      [
        member("m1", "c1", "x", early, "student"),
        member("m2", "c1", "x", early, "volunteer"),
        member("m3", "c1", "s2", early),
      ],
      [
        land("l1", "s1", early),
        { ...land("l2", "x", late), sessionId: "sun-am" },
      ],
      (crewId) => (crewId === "c1" ? "sat-pm" : undefined),
    )
    expect(result.droppedMembers).toEqual([])
    expect(result.droppedLand).toEqual([])
  })

  it("leaves a member of an unknown crew for the validators", () => {
    const result = resolvePeople(
      [member("m1", "ghost", "s1", early)],
      [land("l1", "s1", late)],
      () => undefined,
    )
    expect(result.members).toHaveLength(1)
    expect(result.land).toHaveLength(1)
  })
})

describe("resolveCoursePlacements", () => {
  it("resolves every placement table and counts the dropped rows", () => {
    const tables = {
      courses: [{ family: "Deriva", level: 2 }],
      crews: [{ id: "c1", sessionId: "sat-pm" }],
      crewMembers: [member("m1", "c1", "s1", late)],
      landAssignments: [land("l1", "s1", early), land("l2", "s2", early)],
      sessionBoats: [
        { id: "b1", sessionId: "sat-pm", boatId: "boat", updatedAt: early },
        { id: "b2", sessionId: "sat-pm", boatId: "boat", updatedAt: late },
      ],
      dutyAssignments: [
        { id: "d1", dayId: "saturday", studentId: "s1", updatedAt: early },
        { id: "d2", dayId: "saturday", studentId: "s1", updatedAt: late },
      ],
      evaluations: [
        { id: "e1", sessionId: "sat-pm", studentId: "s1", updatedAt: late },
        { id: "e2", sessionId: "sat-pm", studentId: "s1", updatedAt: early },
      ],
    }
    const { tables: resolved, conflicts } = resolveCoursePlacements(tables)
    expect(conflicts).toBe(4)
    expect(resolved.landAssignments.map(({ id }) => id)).toEqual(["l2"])
    expect(resolved.sessionBoats.map(({ id }) => id)).toEqual(["b2"])
    expect(resolved.dutyAssignments.map(({ id }) => id)).toEqual(["d2"])
    expect(resolved.evaluations.map(({ id }) => id)).toEqual(["e1"])
    expect(resolved.crewMembers).toHaveLength(1)
  })
})
