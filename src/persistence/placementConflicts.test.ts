import { describe, expect, it } from "vitest"

import { dutySettingItems } from "@/persistence/dutyItems"
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

describe("resolveCoursePlacements: rows of something that is gone", () => {
  const whole = () => ({
    courses: [{ family: "Deriva", level: 2 }],
    students: [{ id: "s1" }],
    volunteers: [{ id: "v1" }],
    boats: [{ id: "boat" }],
    faults: [{ id: "f1", boatId: "boat" }],
    crews: [
      {
        id: "c1",
        sessionId: "sat-pm",
        boatId: null as string | null,
        destination: "unassigned",
      },
    ],
    crewMembers: [member("m1", "c1", "s1", early)],
    landAssignments: [] as ReturnType<typeof land>[],
    sessionBoats: [
      { id: "b1", sessionId: "sat-pm", boatId: "boat", updatedAt: early },
    ],
    dutyAssignments: [
      { id: "d1", dayId: "saturday", studentId: "s1", updatedAt: early },
    ],
    evaluations: [
      { id: "e1", sessionId: "sat-pm", studentId: "s1", updatedAt: early },
    ],
  })
  type Whole = ReturnType<typeof whole>

  it("leaves a course whose rows all exist alone", () => {
    const { conflicts, tables } = resolveCoursePlacements(whole())
    expect(conflicts).toBe(0)
    expect(tables.crewMembers).toHaveLength(1)
    expect(tables.faults).toHaveLength(1)
  })

  it.each([
    [
      "a member of a crew that is gone",
      (t: Whole) => ({
        ...t,
        crewMembers: [member("m2", "ghost", "s1", early)],
      }),
      (r: Whole) => expect(r.crewMembers).toEqual([]),
    ],
    [
      "a student member whose student is gone",
      (t: Whole) => ({ ...t, crewMembers: [member("m2", "c1", "s9", early)] }),
      (r: Whole) => expect(r.crewMembers).toEqual([]),
    ],
    [
      "a volunteer member whose volunteer is gone, even if a student has that id",
      (t: Whole) => ({
        ...t,
        crewMembers: [member("m2", "c1", "s1", early, "volunteer")],
      }),
      (r: Whole) => expect(r.crewMembers).toEqual([]),
    ],
    [
      "a land row of a student who is gone",
      (t: Whole) => ({ ...t, landAssignments: [land("l1", "s9", early)] }),
      (r: Whole) => expect(r.landAssignments).toEqual([]),
    ],
    [
      "a duty of a student who is gone",
      (t: Whole) => ({
        ...t,
        dutyAssignments: [
          { id: "d2", dayId: "sunday", studentId: "s9", updatedAt: early },
        ],
      }),
      (r: Whole) => expect(r.dutyAssignments).toEqual([]),
    ],
    [
      "an evaluation of a student who is gone",
      (t: Whole) => ({
        ...t,
        evaluations: [
          { id: "e2", sessionId: "sat-pm", studentId: "s9", updatedAt: early },
        ],
      }),
      (r: Whole) => expect(r.evaluations).toEqual([]),
    ],
    [
      "a session boat whose boat is gone",
      (t: Whole) => ({
        ...t,
        sessionBoats: [
          { id: "b2", sessionId: "sat-pm", boatId: "gone", updatedAt: early },
        ],
      }),
      (r: Whole) => expect(r.sessionBoats).toEqual([]),
    ],
    [
      "a fault of a boat that is gone",
      (t: Whole) => ({ ...t, faults: [{ id: "f2", boatId: "gone" }] }),
      (r: Whole) => expect(r.faults).toEqual([]),
    ],
    [
      "a crew whose boat is gone keeps its people without the boat",
      (t: Whole) => ({
        ...t,
        crews: [
          {
            id: "c1",
            sessionId: "sat-pm",
            boatId: "gone",
            destination: "boat",
          },
        ],
      }),
      (r: Whole) => {
        expect(r.crews).toEqual([
          {
            id: "c1",
            sessionId: "sat-pm",
            boatId: null,
            destination: "unassigned",
          },
        ])
        expect(r.crewMembers).toHaveLength(1)
      },
    ],
  ])("drops %s and counts it once", (_name, make, check) => {
    const { conflicts, tables } = resolveCoursePlacements(make(whole()))
    expect(conflicts).toBe(1)
    check(tables)
  })

  it("counts every orphan row", () => {
    const t = whole()
    const { conflicts } = resolveCoursePlacements({
      ...t,
      landAssignments: [land("l1", "s9", early), land("l2", "s8", early)],
      crewMembers: [member("m2", "ghost", "s1", early), ...t.crewMembers],
    })
    expect(conflicts).toBe(3)
  })

  it("does not check against a table that is not given", () => {
    const { students, volunteers, boats, faults, ...rest } = whole()
    void students
    void volunteers
    void boats
    void faults
    const { conflicts, tables } = resolveCoursePlacements({
      ...rest,
      landAssignments: [land("l1", "s9", early)],
      crewMembers: [
        member("m1", "c1", "s7", early),
        member("m2", "c1", "v9", early, "volunteer"),
      ],
      sessionBoats: [
        { id: "b2", sessionId: "sat-pm", boatId: "gone", updatedAt: early },
      ],
      crews: [
        { id: "c1", sessionId: "sat-pm", boatId: "gone", destination: "boat" },
      ],
    })
    expect(tables.landAssignments).toHaveLength(1)
    expect(tables.crewMembers).toHaveLength(2)
    expect(tables.sessionBoats).toHaveLength(1)
    expect(conflicts).toBe(0)
  })

  it("still drops a member of a crew that is gone when no other table is given", () => {
    const { students, volunteers, boats, faults, ...rest } = whole()
    void students
    void volunteers
    void boats
    void faults
    const { conflicts } = resolveCoursePlacements({
      ...rest,
      crewMembers: [member("m2", "ghost", "s1", early)],
    })
    expect(conflicts).toBe(1)
  })
})

describe("resolveCoursePlacements: stay-over students that are gone", () => {
  type Loose = Record<string, Array<Record<string, unknown>>>
  type Out = Loose & {
    dutySettings: Array<Record<string, unknown>>
    dutySettingItems: Array<Record<string, unknown>>
  }
  const resolve = (given: Loose) => {
    const result = resolveCoursePlacements(
      given as unknown as Parameters<typeof resolveCoursePlacements>[0],
    )
    return {
      conflicts: result.conflicts,
      tables: result.tables as unknown as Out,
    }
  }
  const settings = (stayOver: string[]) => ({
    id: "course-1",
    courseId: "course-1",
    stayOverStudentIds: JSON.stringify(stayOver),
    fewerDayIds: "[]",
  })
  const itemsOf = (lists: Parameters<typeof dutySettingItems>[1]) =>
    dutySettingItems("course-1", lists).map((item) => ({ ...item }))
  const course = (present: string[], extra: Loose): Loose => ({
    courses: [{ family: "Deriva", level: 2 }],
    students: present.map((id) => ({ id })),
    crews: [],
    crewMembers: [],
    landAssignments: [],
    sessionBoats: [],
    dutyAssignments: [],
    evaluations: [],
    ...extra,
  })
  const stayOverItems = (rows: Array<Record<string, unknown>>) =>
    rows
      .filter(({ kind }) => kind === "stay-over")
      .map(({ value, position }) => [value, position])

  it("drops one missing student among several, keeping order and renumbering", () => {
    const items = itemsOf({
      stayOverStudentIds: ["s1", "s2", "s3"],
      fewerDayIds: ["saturday", "sunday"],
    })
    const { tables, conflicts } = resolve(
      course(["s1", "s3"], {
        dutySettings: [settings(["s1", "s2", "s3"])],
        dutySettingItems: items,
      }),
    )
    expect(conflicts).toBe(1)
    expect(tables.dutySettings[0]!.stayOverStudentIds).toBe('["s1","s3"]')
    expect(stayOverItems(tables.dutySettingItems)).toEqual([
      ["s1", 0],
      ["s3", 1],
    ])
  })

  it("counts every missing student and leaves the rest from position 0", () => {
    const { tables, conflicts } = resolve(
      course(["s3"], {
        dutySettings: [settings(["s1", "s2", "s3"])],
        dutySettingItems: itemsOf({ stayOverStudentIds: ["s1", "s2", "s3"] }),
      }),
    )
    expect(conflicts).toBe(2)
    expect(tables.dutySettings[0]!.stayOverStudentIds).toBe('["s3"]')
    expect(stayOverItems(tables.dutySettingItems)).toEqual([["s3", 0]])
  })

  it("changes nothing when every student exists", () => {
    const given = course(["s1", "s2"], {
      dutySettings: [settings(["s1", "s2"])],
      dutySettingItems: itemsOf({ stayOverStudentIds: ["s1", "s2"] }),
    })
    const { tables, conflicts } = resolve(given)
    expect(conflicts).toBe(0)
    expect(tables.dutySettings).toEqual(given.dutySettings)
    expect(tables.dutySettingItems).toEqual(given.dutySettingItems)
  })

  it("leaves the items of other kinds alone, whatever their value", () => {
    const items = itemsOf({
      stayOverStudentIds: ["s2"],
      fewerDayIds: ["saturday"],
      acknowledgedWarningKeys: ["s2", "w1"],
    })
    const { tables } = resolve(
      course(["s1"], {
        dutySettings: [settings(["s2"])],
        dutySettingItems: items,
      }),
    )
    const stayOver = items.find(
      (item) => item.value === "s2" && item.kind !== "acknowledged-warning",
    )
    expect(tables.dutySettingItems).toHaveLength(items.length - 1)
    expect(tables.dutySettingItems).not.toContainEqual(stayOver)
    expect(
      tables.dutySettingItems.filter(({ value }) => value === "s2"),
    ).toHaveLength(items.filter(({ value }) => value === "s2").length - 1)
    for (const item of tables.dutySettingItems) {
      const before = items.find(({ id }) => id === item.id)
      expect(item).toEqual(before)
    }
  })

  it("trims the list when the item table is not given", () => {
    const { tables, conflicts } = resolve(
      course(["s1"], { dutySettings: [settings(["s1", "s2"])] }),
    )
    expect(conflicts).toBe(1)
    expect(tables.dutySettings[0]!.stayOverStudentIds).toBe('["s1"]')
    expect(tables).not.toHaveProperty("dutySettingItems")
  })

  it("does nothing when the students table is not given", () => {
    const { students, ...rest } = course([], {
      dutySettings: [settings(["s9"])],
      dutySettingItems: itemsOf({ stayOverStudentIds: ["s9"] }),
    })
    void students
    const { tables, conflicts } = resolve(rest)
    expect(conflicts).toBe(0)
    expect(tables.dutySettings[0]!.stayOverStudentIds).toBe('["s9"]')
    expect(tables.dutySettingItems).toHaveLength(1)
  })
})
