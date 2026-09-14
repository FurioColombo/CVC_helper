import { describe, expect, it } from "vitest"

import {
  assignAvailableSessionBoat,
  assignCrewDestination,
  copyPreviousBoatSelection,
  copyPreviousCrewPlan,
  formatCrewAnnouncement,
  getCrewCompleteness,
  getCrewSizeStatus,
  getEvenCrewTargets,
  getPreviousSessionId,
  getSessionBoatStates,
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

  it.each([
    ["Deriva", 2, 1, false, true],
    ["Deriva", 2, 2, true, false],
    ["Deriva", 2, 3, false, false],
    ["Deriva", 1, 5, true, true],
    ["Cabinato", 3, 7, true, true],
  ] as const)(
    "assesses %s level %s with %s people using the canonical size rule",
    (family, level, memberCount, complete, canAdd) => {
      expect(getCrewSizeStatus(memberCount, family, level)).toEqual(
        expect.objectContaining({ complete, canAdd }),
      )
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

  it("counts active students in crews or A terra but excludes embarked CT staff", () => {
    const ct: CrewPersonRef = {
      personId: "volunteer-ct-1",
      personType: "volunteer",
    }
    let plan = movePerson(
      EMPTY_PLAN,
      STUDENT_1,
      { kind: "crew", crewId: "crew-1" },
      2,
    )
    plan = movePerson(plan, ct, { kind: "crew", crewId: "crew-1" }, 2)
    expect(getCrewCompleteness(["student-1", "student-2"], plan)).toEqual(
      expect.objectContaining({ accounted: 1, total: 2, complete: false }),
    )
    plan = movePerson(plan, STUDENT_2, { kind: "land" }, 2)
    expect(getCrewCompleteness(["student-1", "student-2"], plan)).toEqual(
      expect.objectContaining({ accounted: 2, total: 2, complete: true }),
    )
    expect(removePerson(plan, STUDENT_1).crews[0]!.members).toEqual([ct])
  })

  it("keeps session boat selection separate and unlinks only the removed boat", () => {
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
    const removed = setBoatGoingOut(assigned, "boat-2", false)
    expect(removed.selectedBoatIds).toEqual([])
    expect(removed.crews[0]).toEqual(
      expect.objectContaining({
        members: EMPTY_PLAN.crews[0]!.members,
        destination: "unassigned",
        boatId: null,
      }),
    )
    expect(removed.crews[1]).toBe(assigned.crews[1])
  })

  it("assigns an available boat to a boatless crew and includes it in the outing", () => {
    const selected = setBoatGoingOut(EMPTY_PLAN, "boat-2", true)
    expect(
      assignAvailableSessionBoat(
        selected,
        "crew-1",
        "boat-2",
        new Set(["boat-2"]),
      ).crews[0],
    ).toEqual(
      expect.objectContaining({ destination: "boat", boatId: "boat-2" }),
    )
    expect(() =>
      assignAvailableSessionBoat(selected, "crew-1", "boat-2", new Set()),
    ).toThrow("not available")
    const directlyAssigned = assignAvailableSessionBoat(
      EMPTY_PLAN,
      "crew-1",
      "boat-2",
      new Set(["boat-2"]),
    )
    expect(directlyAssigned.selectedBoatIds).toEqual(["boat-2"])
    expect(directlyAssigned.crews[0]).toEqual(
      expect.objectContaining({ destination: "boat", boatId: "boat-2" }),
    )
  })

  it("sorts numeric boat states and keeps selection, assignment, availability and faults distinct", () => {
    const plan = assignCrewDestination(
      {
        ...EMPTY_PLAN,
        selectedBoatIds: ["boat-10", "boat-2"],
      },
      "crew-1",
      { kind: "boat", boatId: "boat-10" },
    )
    const states = getSessionBoatStates(
      [
        {
          id: "boat-10",
          type: "RS Quest",
          number: "10",
          availability: "unavailable",
        },
        {
          id: "boat-2",
          type: "RS Quest",
          number: "2",
          availability: "available",
        },
        {
          id: "boat-7",
          type: "RS Quest",
          number: "7",
          availability: "available",
        },
      ],
      plan,
      new Set(["boat-10", "boat-7"]),
    )

    expect(states.map(({ number }) => number)).toEqual(["2", "7", "10"])
    expect(states).toEqual([
      expect.objectContaining({
        boatId: "boat-2",
        selected: true,
        displayState: "available",
        hasUnresolvedFault: false,
      }),
      expect.objectContaining({
        boatId: "boat-7",
        selected: false,
        displayState: "available",
        hasUnresolvedFault: true,
      }),
      expect.objectContaining({
        boatId: "boat-10",
        selected: true,
        assignedCrewId: "crew-1",
        displayState: "unavailable",
        hasUnresolvedFault: true,
      }),
    ])
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

  it("derives the immediately previous session from the canonical sequence", () => {
    expect(getPreviousSessionId("sat-pm")).toBeNull()
    expect(getPreviousSessionId("sun-am")).toBe("sat-pm")
    expect(getPreviousSessionId("sun-pm")).toBe("sun-am")
    expect(getPreviousSessionId("mon-am")).toBe("sun-pm")
  })

  it("copies only the still-valid previous crew structure and reports removals", () => {
    let id = 0
    const copied = copyPreviousCrewPlan({
      previousPlan: {
        crews: [
          {
            id: "old-1",
            sessionId: "sun-am",
            members: [STUDENT_1, STUDENT_2, VOLUNTEER],
            destination: "boat",
            boatId: "boat-2",
          },
          {
            id: "old-2",
            sessionId: "sun-am",
            members: [
              { personId: "student-disabled", personType: "student" },
              { personId: "volunteer-missing", personType: "volunteer" },
            ],
            destination: "mezzi",
            boatId: null,
          },
        ],
        landStudentIds: ["student-old-land"],
        selectedBoatIds: ["boat-2"],
      },
      sessionId: "sun-pm",
      activeStudentIds: ["student-1", "student-2"],
      currentVolunteerIds: ["volunteer-1"],
      currentLandStudentIds: ["student-2"],
      dutyStudentIds: ["student-1"],
      selectedBoatIds: ["boat-7"],
      createId: () => `new-${++id}`,
    })

    expect(copied.plan).toEqual({
      crews: [
        {
          id: "new-1",
          sessionId: "sun-pm",
          members: [VOLUNTEER],
          destination: "unassigned",
          boatId: null,
        },
        {
          id: "new-2",
          sessionId: "sun-pm",
          members: [],
          destination: "unassigned",
          boatId: null,
        },
      ],
      landStudentIds: ["student-2"],
      selectedBoatIds: ["boat-7"],
    })
    expect(copied.removals).toEqual([
      { person: STUDENT_1, reason: "comandata" },
      { person: STUDENT_2, reason: "A terra" },
      {
        person: { personId: "student-disabled", personType: "student" },
        reason: "non disponibile",
      },
      {
        person: { personId: "volunteer-missing", personType: "volunteer" },
        reason: "non disponibile",
      },
    ])
  })

  it("copies only currently available boats while retaining exact assignments", () => {
    expect(
      copyPreviousBoatSelection(
        ["boat-2", "boat-7", "missing"],
        ["boat-2", "boat-9"],
        ["boat-7", "boat-7"],
      ),
    ).toEqual(["boat-2", "boat-7"])
  })

  it("formats every clean announcement state exactly", () => {
    expect(
      formatCrewAnnouncement({
        destination: "boat",
        exactBoatLabel: "Quest 7",
        memberLabels: ["Mario", "Luca"],
      }),
    ).toBe("Quest 7 — Mario / Luca")
    expect(
      formatCrewAnnouncement({
        destination: "unassigned",
        inferredBoatType: "Quest",
        memberLabels: ["Mario", "Luca"],
      }),
    ).toBe("Quest — Mario / Luca")
    expect(
      formatCrewAnnouncement({
        destination: "unassigned",
        memberLabels: ["Mario", "Luca"],
      }),
    ).toBe("Mario / Luca")
    expect(
      formatCrewAnnouncement({
        destination: "mezzi",
        memberLabels: ["Mario", "Luca"],
      }),
    ).toBe("Mezzi — Mario / Luca")
  })
})
