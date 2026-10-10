import { describe, expect, it } from "vitest"

import { DUTY_DAYS, type DutyDayId } from "@/domain/config"
import {
  getDutyWarnings,
  type DutyAssignment,
  type DutyStudent,
} from "@/domain/duties"
import {
  defaultDutySettings,
  deriveExtraDayIds,
  dutySettingsForSave,
  getProposalStudentCount,
  normalizeProposalSettings,
  type DutySettings,
} from "@/domain/dutySettings"

const DAY_IDS = DUTY_DAYS.map(({ id }) => id)
const COURSE_START_DATE = "2026-08-29"

function withoutDays(...dayIds: DutyDayId[]) {
  return DAY_IDS.filter((dayId) => !dayIds.includes(dayId))
}

function students(count: number, inactiveCount = 0): DutyStudent[] {
  return Array.from({ length: count + inactiveCount }, (_, index) => ({
    id: `student-${String(index + 1).padStart(2, "0")}`,
    firstName: `Nome${index + 1}`,
    surname: `Cognome${String(index + 1).padStart(2, "0")}`,
    dateOfBirth: "2000-01-01",
    sex: index % 2 === 0 ? "female" : "male",
    active: index < count ? 1 : 0,
  }))
}

function settings(overrides: Partial<DutySettings> = {}): DutySettings {
  return {
    desiredPerDay: 0,
    fewerDayIds: [],
    balanceMinors: false,
    balanceSex: false,
    tieBreaker: "alphabetical",
    stayOverStudentIds: [],
    completedDayIds: [],
    acknowledgedWarningKeys: [],
    ...overrides,
  }
}

describe("deriveExtraDayIds", () => {
  it.each<{
    name: string
    studentCount: number
    remaining: DutyDayId[]
    extraDayIds?: DutyDayId[]
    fewerDayIds: DutyDayId[]
    expected: DutyDayId[]
  }>([
    {
      name: "puts the explicit extra days first, then the days not marked fewer",
      studentCount: 10,
      remaining: DAY_IDS,
      extraDayIds: ["friday", "sunday"],
      fewerDayIds: [],
      expected: ["friday", "sunday", "saturday"],
    },
    {
      name: "takes the days not marked fewer, in week order, without explicit ones",
      studentCount: 10,
      remaining: DAY_IDS,
      fewerDayIds: ["saturday", "sunday", "monday", "tuesday"],
      expected: ["wednesday", "thursday", "friday"],
    },
    {
      name: "falls back to the remaining days when every day is marked fewer",
      studentCount: 10,
      remaining: DAY_IDS,
      fewerDayIds: DAY_IDS,
      expected: ["saturday", "sunday", "monday"],
    },
    {
      name: "completes the explicit days with the legacy ones, then the rest",
      studentCount: 11,
      remaining: DAY_IDS,
      extraDayIds: ["friday"],
      fewerDayIds: ["saturday", "sunday", "monday", "tuesday", "wednesday"],
      expected: ["friday", "thursday", "saturday", "sunday"],
    },
    {
      name: "lists a day once however often it is named",
      studentCount: 9,
      remaining: DAY_IDS,
      extraDayIds: ["monday", "monday"],
      fewerDayIds: [],
      expected: ["monday", "saturday"],
    },
    {
      name: "keeps only remaining days: an explicit completed day is dropped",
      studentCount: 8,
      remaining: withoutDays("saturday"),
      extraDayIds: ["saturday", "friday"],
      fewerDayIds: [],
      expected: ["friday", "sunday"],
    },
    {
      name: "takes at most N mod D days",
      studentCount: 15,
      remaining: DAY_IDS,
      extraDayIds: ["friday", "thursday", "wednesday"],
      fewerDayIds: [],
      expected: ["friday"],
    },
    {
      name: "takes none when N divides evenly",
      studentCount: 14,
      remaining: DAY_IDS,
      extraDayIds: ["friday"],
      fewerDayIds: [],
      expected: [],
    },
    {
      name: "counts the days left, not the whole week",
      studentCount: 3,
      remaining: ["thursday", "friday"],
      fewerDayIds: [],
      expected: ["thursday"],
    },
    {
      name: "takes none when no day is left",
      studentCount: 5,
      remaining: [],
      extraDayIds: ["friday"],
      fewerDayIds: [],
      expected: [],
    },
  ])(
    "$name",
    ({ studentCount, remaining, extraDayIds, fewerDayIds, expected }) => {
      expect(
        deriveExtraDayIds(studentCount, remaining, {
          extraDayIds,
          fewerDayIds,
        }),
      ).toEqual(expected)
    },
  )
})

describe("getProposalStudentCount", () => {
  // Four active students and an inactive one.
  const records = students(4, 1)
  const ids = records.map(({ id }) => id)
  const [first, second, third, , inactive] = ids as [
    string,
    string,
    string,
    string,
    string,
  ]

  it.each<{
    name: string
    assignments: DutyAssignment[]
    completed: DutyDayId[]
    expected: number
  }>([
    {
      name: "counts every active student when no day is completed",
      assignments: [{ dayId: "saturday", studentId: first }],
      completed: [],
      expected: 4,
    },
    {
      name: "leaves out a student with a duty on a completed day",
      assignments: [{ dayId: "saturday", studentId: first }],
      completed: ["saturday"],
      expected: 3,
    },
    {
      name: "keeps a student whose duty is on a day still open",
      assignments: [
        { dayId: "saturday", studentId: first },
        { dayId: "friday", studentId: second },
      ],
      completed: ["saturday"],
      expected: 3,
    },
    {
      name: "leaves out a student with duties on a completed and an open day",
      assignments: [
        { dayId: "saturday", studentId: first },
        { dayId: "friday", studentId: first },
      ],
      completed: ["saturday"],
      expected: 3,
    },
    {
      name: "counts a student once however many completed duties they have",
      assignments: [
        { dayId: "saturday", studentId: first },
        { dayId: "sunday", studentId: first },
      ],
      completed: ["saturday", "sunday"],
      expected: 3,
    },
    {
      name: "ignores an inactive student and an assignment to a missing one",
      assignments: [
        { dayId: "saturday", studentId: inactive },
        { dayId: "saturday", studentId: "student-missing" },
      ],
      completed: ["saturday"],
      expected: 4,
    },
    {
      name: "counts the students with no duty once every day is completed",
      assignments: [
        { dayId: "saturday", studentId: first },
        { dayId: "sunday", studentId: second },
        { dayId: "monday", studentId: third },
      ],
      completed: DAY_IDS,
      expected: 1,
    },
  ])("$name", ({ assignments, completed, expected }) => {
    expect(getProposalStudentCount(records, assignments, completed)).toBe(
      expected,
    )
  })
})

describe("normalizeProposalSettings", () => {
  it("leaves out the completed days and the students already placed", () => {
    // Twelve active and two inactive students; three are placed on the two
    // completed days, a fourth on a day still open (so still to place).
    const records = students(12, 2)
    const ids = records.map(({ id }) => id)
    const assignments: DutyAssignment[] = [
      { dayId: "saturday", studentId: ids[0]! },
      { dayId: "saturday", studentId: ids[1]! },
      { dayId: "sunday", studentId: ids[2]! },
      { dayId: "thursday", studentId: ids[3]! },
    ]

    const result = normalizeProposalSettings(
      settings({
        desiredPerDay: 99,
        completedDayIds: ["saturday", "sunday"],
        extraDayIds: ["friday"],
        fewerDayIds: ["thursday"],
        stayOverStudentIds: [ids[5]!],
        balanceSex: true,
      }),
      records,
      assignments,
    )

    // 12 - 3 = 9 students over 5 open days: 1 each and 4 extra places.
    expect(result.desiredPerDay).toBe(1)
    expect(result.extraDayIds).toEqual([
      "friday",
      "monday",
      "tuesday",
      "wednesday",
    ])
    expect(result.fewerDayIds).toEqual(["thursday"])
    expect(result.completedDayIds).toEqual(["saturday", "sunday"])
    expect(result).toMatchObject({
      stayOverStudentIds: [ids[5]!],
      balanceSex: true,
    })
  })

  it("has nothing to distribute once every day is completed", () => {
    expect(
      normalizeProposalSettings(
        settings({
          desiredPerDay: 3,
          completedDayIds: DAY_IDS,
          extraDayIds: ["friday"],
          fewerDayIds: ["monday"],
        }),
        students(3),
        [],
      ),
    ).toMatchObject({ desiredPerDay: 0, extraDayIds: [], fewerDayIds: [] })
  })

  it("derives the extra days again for display even when the list is empty", () => {
    // Ten students: 1 each and 3 extra places. The stored empty list is not
    // trusted for display; the days not marked fewer are used.
    expect(
      normalizeProposalSettings(
        settings({ extraDayIds: [], fewerDayIds: ["monday"] }),
        students(10),
        [],
      ),
    ).toMatchObject({
      desiredPerDay: 1,
      extraDayIds: ["saturday", "sunday", "tuesday"],
      fewerDayIds: ["monday", "wednesday", "thursday", "friday"],
    })
  })
})

describe("defaultDutySettings", () => {
  it.each([
    { active: 0, inactive: 0, desiredPerDay: 0, extraCount: 0 },
    { active: 6, inactive: 0, desiredPerDay: 0, extraCount: 6 },
    { active: 7, inactive: 0, desiredPerDay: 1, extraCount: 0 },
    { active: 15, inactive: 0, desiredPerDay: 2, extraCount: 1 },
    { active: 15, inactive: 4, desiredPerDay: 2, extraCount: 1 },
    { active: 0, inactive: 5, desiredPerDay: 0, extraCount: 0 },
  ])(
    "gives $desiredPerDay per day and $extraCount extra for $active active ($inactive inactive) students",
    ({ active, inactive, desiredPerDay, extraCount }) => {
      expect(defaultDutySettings(students(active, inactive))).toEqual({
        desiredPerDay,
        // The extra places go to the first days of the week.
        extraDayIds: DAY_IDS.slice(0, extraCount),
        fewerDayIds: DAY_IDS.slice(extraCount),
        balanceMinors: true,
        balanceSex: false,
        tieBreaker: "alphabetical",
        stayOverStudentIds: [],
        completedDayIds: [],
        acknowledgedWarningKeys: [],
      })
    },
  )
})

describe("dutySettingsForSave", () => {
  const records = students(10)

  it("derives the extra days when they were never chosen", () => {
    const stored = settings({
      desiredPerDay: 7,
      fewerDayIds: ["saturday", "sunday", "monday", "tuesday"],
    })
    const saved = dutySettingsForSave(stored, records, [], COURSE_START_DATE)

    expect(saved).toMatchObject({
      desiredPerDay: 1,
      extraDayIds: ["wednesday", "thursday", "friday"],
      fewerDayIds: ["saturday", "sunday", "monday", "tuesday"],
    })
    expect(saved).toEqual(normalizeProposalSettings(stored, records, []))
  })

  it.each<{ name: string; extraDayIds: DutyDayId[] }>([
    { name: "an empty extra-day list", extraDayIds: [] },
    // Not what ten students need (three days): saved as given all the same.
    { name: "a list of the wrong size", extraDayIds: ["friday"] },
  ])("saves $name as given", ({ extraDayIds }) => {
    const saved = dutySettingsForSave(
      settings({ desiredPerDay: 7, fewerDayIds: ["monday"], extraDayIds }),
      records,
      [],
      COURSE_START_DATE,
    )

    expect(saved).toMatchObject({
      desiredPerDay: 7,
      extraDayIds,
      fewerDayIds: ["monday"],
    })
  })

  describe("acknowledged warnings", () => {
    // One student per day, except that the one who stays over for Friday is on
    // Saturday: that raises the advisory "Preferenza venerdì non soddisfatta".
    // The third student is on Sunday too, which raises major warnings (assigned
    // twice, an unexpected headcount).
    const week = students(7)
    const stayOver = week[0]!
    const assignments: DutyAssignment[] = [
      { dayId: "saturday", studentId: week[0]!.id },
      { dayId: "sunday", studentId: week[1]!.id },
      { dayId: "monday", studentId: week[2]!.id },
      { dayId: "tuesday", studentId: week[3]!.id },
      { dayId: "wednesday", studentId: week[4]!.id },
      { dayId: "thursday", studentId: week[5]!.id },
      { dayId: "friday", studentId: week[6]!.id },
      { dayId: "sunday", studentId: week[2]!.id },
    ]
    const stored = settings({
      desiredPerDay: 1,
      fewerDayIds: [],
      extraDayIds: [],
      stayOverStudentIds: [stayOver.id],
    })
    const warnings = getDutyWarnings(
      week,
      assignments,
      { ...stored, extraDayIds: [], courseStartDate: COURSE_START_DATE },
      [],
    )
    const advisoryKey = warnings.find(
      ({ severity }) => severity === "advisory",
    )?.key
    const majorKey = warnings.find(({ severity }) => severity === "major")?.key

    it("is set up with one advisory and one major warning to tell apart", () => {
      expect(advisoryKey).toBeDefined()
      expect(majorKey).toBeDefined()
    })

    it("keeps only the keys of advisory warnings still raised", () => {
      const saved = dutySettingsForSave(
        {
          ...stored,
          acknowledgedWarningKeys: [
            majorKey!,
            "stale-warning",
            advisoryKey!,
            advisoryKey!,
          ],
        },
        week,
        assignments,
        COURSE_START_DATE,
      )

      // A major warning stays visible whatever was acknowledged, a key no
      // warning raises any more is stale, and a repeated key is saved once.
      expect(saved.acknowledgedWarningKeys).toEqual([advisoryKey])
    })

    it("drops an acknowledgement once the advisory it covered is gone", () => {
      // Friday now goes to the student who stays over: no advisory is raised.
      const fixed: DutyAssignment[] = assignments.map((assignment) => {
        if (assignment.studentId === stayOver.id) {
          return { ...assignment, dayId: "friday" }
        }
        if (assignment.dayId === "friday") {
          return { ...assignment, dayId: "saturday" }
        }
        return assignment
      })
      const saved = dutySettingsForSave(
        { ...stored, acknowledgedWarningKeys: [advisoryKey!] },
        week,
        fixed,
        COURSE_START_DATE,
      )

      expect(saved.acknowledgedWarningKeys).toEqual([])
    })

    it("prunes the keys on derived settings too", () => {
      // Eight students: one extra place, so the derived list is not empty.
      const saved = dutySettingsForSave(
        settings({ acknowledgedWarningKeys: ["stale-warning"] }),
        students(8),
        [],
        COURSE_START_DATE,
      )

      expect(saved.extraDayIds).toEqual(DAY_IDS.slice(0, 1))
      expect(saved.acknowledgedWarningKeys).toEqual([])
    })
  })
})
