import { describe, expect, it } from "vitest"

import {
  assignCrewDestination,
  getCrewCompleteness,
  getEvenCrewTargets,
  getStandardCrewSize,
  movePerson,
  removePerson,
  setBoatGoingOut,
  swapPeople,
  type CrewPlan,
  type CrewPersonRef,
} from "@/domain/crews"

const STUDENT_1: CrewPersonRef = {
  personId: "student-1",
  personType: "student",
}
const STUDENT_2: CrewPersonRef = {
  personId: "student-2",
  personType: "student",
}
const VOLUNTEER: CrewPersonRef = {
  personId: "volunteer-1",
  personType: "volunteer",
}
const EMPTY_PLAN: CrewPlan = {
  crews: [
    {
      id: "crew-1",
      sessionId: "sat-pm",
      members: [],
      destination: "unassigned",
      boatId: null,
    },
    {
      id: "crew-2",
      sessionId: "sat-pm",
      members: [],
      destination: "unassigned",
      boatId: null,
    },
  ],
  landStudentIds: [],
  selectedBoatIds: [],
}

describe("crew composition rules", () => {
  it.each([
    ["Deriva", 2, 2],
    ["Deriva", 3, 2],
    ["Deriva", 4, 2],
    ["Deriva", 5, 2],
    ["Deriva", 1, null],
    ["Cabinato", 2, null],
  ] as const)(
    "returns the canonical %s level %s crew size",
    (family, level, expected) => {
      expect(getStandardCrewSize(family, level)).toBe(expected)
    },
  )

  it("proposes an even target for flexible crews without assigning people", () => {
    expect(getEvenCrewTargets(10, 3)).toEqual([4, 3, 3])
    expect(getEvenCrewTargets(2, 4)).toEqual([1, 1, 0, 0])
  })

  it("moves a person out of the source before assigning the destination", () => {
    const first = movePerson(
      EMPTY_PLAN,
      STUDENT_1,
      { kind: "crew", crewId: "crew-1" },
      2,
    )
    const moved = movePerson(
      first,
      STUDENT_1,
      { kind: "crew", crewId: "crew-2" },
      2,
    )

    expect(moved.crews[0]!.members).toEqual([])
    expect(moved.crews[1]!.members).toEqual([STUDENT_1])
  })

  it("swaps assigned people directly and sends a replaced pool person back to the pool", () => {
    let plan = movePerson(
      EMPTY_PLAN,
      STUDENT_1,
      { kind: "crew", crewId: "crew-1" },
      2,
    )
    plan = movePerson(plan, STUDENT_2, { kind: "crew", crewId: "crew-2" }, 2)
    const swapped = swapPeople(plan, STUDENT_1, STUDENT_2)
    const replaced = swapPeople(swapped, VOLUNTEER, STUDENT_1)

    expect(swapped.crews[0]!.members).toEqual([STUDENT_2])
    expect(swapped.crews[1]!.members).toEqual([STUDENT_1])
    expect(replaced.crews[1]!.members).toEqual([VOLUNTEER])
    expect(replaced.crews.flatMap(({ members }) => members)).not.toContainEqual(
      STUDENT_1,
    )
  })

  it("keeps A terra individual and rejects volunteers there", () => {
    const onLand = movePerson(EMPTY_PLAN, STUDENT_1, { kind: "land" }, 2)
    expect(onLand.landStudentIds).toEqual(["student-1"])
    expect(onLand.crews).toHaveLength(2)
    expect(() => movePerson(onLand, VOLUNTEER, { kind: "land" }, 2)).toThrow(
      "Only students",
    )
  })

  it("counts active students in crews or A terra but excludes staff", () => {
    let plan = movePerson(
      EMPTY_PLAN,
      STUDENT_1,
      { kind: "crew", crewId: "crew-1" },
      2,
    )
    plan = movePerson(plan, VOLUNTEER, { kind: "crew", crewId: "crew-1" }, 2)
    expect(getCrewCompleteness(["student-1", "student-2"], plan)).toEqual(
      expect.objectContaining({ accounted: 1, total: 2, complete: false }),
    )
    plan = movePerson(plan, STUDENT_2, { kind: "land" }, 2)
    expect(getCrewCompleteness(["student-1", "student-2"], plan)).toEqual(
      expect.objectContaining({ accounted: 2, total: 2, complete: true }),
    )
    expect(removePerson(plan, STUDENT_1).crews[0]!.members).toEqual([VOLUNTEER])
  })

  it("keeps session boat selection separate from exact crew assignment", () => {
    const selected = setBoatGoingOut(EMPTY_PLAN, "boat-2", true)
    expect(selected.selectedBoatIds).toEqual(["boat-2"])
    expect(
      selected.crews.every(({ destination }) => destination === "unassigned"),
    ).toBe(true)

    const assigned = assignCrewDestination(selected, "crew-1", {
      kind: "boat",
      boatId: "boat-2",
    })
    expect(assigned.crews[0]).toEqual(
      expect.objectContaining({ destination: "boat", boatId: "boat-2" }),
    )
    expect(() =>
      assignCrewDestination(assigned, "crew-2", {
        kind: "boat",
        boatId: "boat-2",
      }),
    ).toThrow("already assigned")
    expect(() => setBoatGoingOut(assigned, "boat-2", false)).toThrow(
      "assigned to a crew",
    )
  })

  it("treats Mezzi as a crew destination without retaining a boat", () => {
    const assigned = assignCrewDestination(
      setBoatGoingOut(EMPTY_PLAN, "boat-2", true),
      "crew-1",
      { kind: "boat", boatId: "boat-2" },
    )
    expect(
      assignCrewDestination(assigned, "crew-1", { kind: "mezzi" }).crews[0],
    ).toEqual(expect.objectContaining({ destination: "mezzi", boatId: null }))
  })
})
