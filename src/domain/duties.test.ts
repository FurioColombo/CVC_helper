import { describe, expect, it } from "vitest"

import { DUTY_DAYS } from "@/domain/config"
import {
  calculateDutyCapacities,
  calculateConfiguredDutyCapacities,
  generateDutyProposal,
  getDutyWarnings,
  type DutyConfig,
  type DutyStudent,
} from "@/domain/duties"

const CONFIG: DutyConfig = {
  desiredPerDay: 3,
  fewerDayIds: ["saturday", "sunday", "monday", "tuesday", "wednesday"],
  balanceMinors: true,
  balanceSex: true,
  tieBreaker: "alphabetical",
  stayOverStudentIds: [],
  referenceDate: "2026-08-29",
}

function students(count: number): DutyStudent[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `student-${String(index + 1).padStart(2, "0")}`,
    firstName: `Nome${index + 1}`,
    surname: `Cognome${String(index + 1).padStart(2, "0")}`,
    dateOfBirth:
      index % 4 === 0
        ? "2010-01-01"
        : `2000-01-${String((index % 27) + 1).padStart(2, "0")}`,
    sex: index % 2 === 0 ? "female" : "male",
    active: 1,
  }))
}

describe("duty proposal rules", () => {
  it.each([
    [21, [3, 3, 3, 3, 3, 3, 3]],
    [23, [3, 3, 3, 3, 3, 4, 4]],
    [5, [0, 0, 0, 0, 0, 0, 0]],
  ] as const)("distributes %s students evenly", (count, expected) => {
    const capacities = calculateDutyCapacities(
      count,
      [
        "saturday",
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
      ],
      CONFIG.fewerDayIds,
    )
    const values = Object.values(capacities)
    if (count === 5) {
      expect(values.filter((value) => value === 1)).toHaveLength(5)
      expect(values.filter((value) => value === 0)).toHaveLength(2)
    } else {
      expect(values).toEqual(expected)
    }
    expect(values.reduce((total, value) => total + value, 0)).toBe(count)
  })

  it("fills Friday capacity with stay-over students but no more", () => {
    const records = students(21)
    const config = {
      ...CONFIG,
      stayOverStudentIds: records.slice(0, 8).map(({ id }) => id),
    }
    const proposal = generateDutyProposal(records, config)
    const friday = proposal.assignments.filter(
      ({ dayId }) => dayId === "friday",
    )

    expect(friday).toHaveLength(3)
    expect(
      friday.every(({ studentId }) =>
        config.stayOverStudentIds.includes(studentId),
      ),
    ).toBe(true)
  })

  it("keeps configured Friday capacity during an uneven remaining-week split", () => {
    const capacities = calculateConfiguredDutyCapacities(
      5,
      ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday"],
      { desiredPerDay: 1, fewerDayIds: [] },
    )

    expect(capacities.friday).toBe(1)
    expect(
      Object.values(capacities).reduce((sum, count) => sum + count, 0),
    ).toBe(5)
    expect(
      Math.max(...Object.values(capacities)) -
        Math.min(...Object.values(capacities)),
    ).toBe(1)
  })

  it("balances minors and sex after Friday preference", () => {
    const records = students(21)
    const proposal = generateDutyProposal(records, {
      ...CONFIG,
      stayOverStudentIds: records.slice(0, 6).map(({ id }) => id),
    })
    const counts = (predicate: (student: DutyStudent) => boolean) =>
      [
        "saturday",
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
      ].map(
        (dayId) =>
          proposal.assignments.filter((assignment) => {
            const student = records.find(
              ({ id }) => id === assignment.studentId,
            )!
            return assignment.dayId === dayId && predicate(student)
          }).length,
      )

    const minorCounts = counts(({ dateOfBirth }) =>
      dateOfBirth.startsWith("2010"),
    )
    const femaleCounts = counts(({ sex }) => sex === "female")
    expect(
      Math.max(...minorCounts) - Math.min(...minorCounts),
    ).toBeLessThanOrEqual(1)
    expect(
      Math.max(...femaleCounts) - Math.min(...femaleCounts),
    ).toBeLessThanOrEqual(1)
  })

  it("places alphabetically-last minors before the tie-breaker can concentrate them", () => {
    const records = students(21).map((student, index) => ({
      ...student,
      surname: index < 14 ? `Adulto${index}` : `ZMinore${index}`,
      dateOfBirth: index < 14 ? "2000-01-01" : "2010-01-01",
    }))
    const proposal = generateDutyProposal(records, {
      ...CONFIG,
      fewerDayIds: [],
      balanceSex: false,
    })
    const counts = DUTY_DAYS.map(
      ({ id }) =>
        proposal.assignments.filter(({ dayId, studentId }) => {
          const student = records.find(({ id }) => id === studentId)!
          return dayId === id && student.dateOfBirth === "2010-01-01"
        }).length,
    )

    expect(counts).toEqual([1, 1, 1, 1, 1, 1, 1])
  })

  it("places known-sex students before unknown values so sex balancing stays feasible", () => {
    const records = students(21).map((student, index) => ({
      ...student,
      surname: index < 7 ? `ASconosciuto${index}` : `ZConosciuto${index}`,
      dateOfBirth: "2000-01-01",
      sex:
        index < 7 ? null : index < 14 ? ("female" as const) : ("male" as const),
    }))
    const proposal = generateDutyProposal(records, {
      ...CONFIG,
      fewerDayIds: [],
      balanceMinors: false,
      balanceSex: true,
    })
    const countsFor = (sex: "female" | "male") =>
      DUTY_DAYS.map(
        ({ id }) =>
          proposal.assignments.filter(({ dayId, studentId }) => {
            const student = records.find(({ id }) => id === studentId)!
            return dayId === id && student.sex === sex
          }).length,
      )

    expect(countsFor("female")).toEqual([1, 1, 1, 1, 1, 1, 1])
    expect(countsFor("male")).toEqual([1, 1, 1, 1, 1, 1, 1])
  })

  it("uses the scarce sex first when one day has extra capacity", () => {
    const records = students(8).map((student, index) => ({
      ...student,
      surname: `Cognome${index}`,
      dateOfBirth: index < 2 ? "2010-01-01" : "2000-01-01",
      sex: index === 1 ? ("female" as const) : ("male" as const),
    }))
    const proposal = generateDutyProposal(records, {
      ...CONFIG,
      desiredPerDay: 1,
      fewerDayIds: [],
      stayOverStudentIds: [],
    })
    const maleCounts = DUTY_DAYS.map(
      ({ id }) =>
        proposal.assignments.filter(({ dayId, studentId }) => {
          const student = records.find(({ id }) => id === studentId)!
          return dayId === id && student.sex === "male"
        }).length,
    )
    const minorCounts = DUTY_DAYS.map(
      ({ id }) =>
        proposal.assignments.filter(({ dayId, studentId }) => {
          const student = records.find(({ id }) => id === studentId)!
          return dayId === id && student.dateOfBirth === "2010-01-01"
        }).length,
    )

    expect(maleCounts).toEqual([1, 1, 1, 1, 1, 1, 1])
    expect(Math.max(...minorCounts) - Math.min(...minorCounts)).toBe(1)
  })

  it("repairs combined minor and sex balance when global sex scarcity is tied", () => {
    const records = students(8).map((student, index) => ({
      ...student,
      surname: `Cognome${index}`,
      dateOfBirth: index < 5 ? "2010-01-01" : "2000-01-01",
      sex: index === 0 || index >= 5 ? ("male" as const) : ("female" as const),
    }))
    const proposal = generateDutyProposal(records, {
      ...CONFIG,
      desiredPerDay: 1,
      fewerDayIds: [],
      stayOverStudentIds: [],
    })
    const spreadFor = (predicate: (student: DutyStudent) => boolean) => {
      const counts = DUTY_DAYS.map(
        ({ id }) =>
          proposal.assignments.filter(({ dayId, studentId }) => {
            const student = records.find(({ id }) => id === studentId)!
            return dayId === id && predicate(student)
          }).length,
      )
      return Math.max(...counts) - Math.min(...counts)
    }

    expect(spreadFor(({ dateOfBirth }) => dateOfBirth === "2010-01-01")).toBe(1)
    expect(spreadFor(({ sex }) => sex === "male")).toBeLessThanOrEqual(1)
    expect(spreadFor(({ sex }) => sex === "female")).toBeLessThanOrEqual(1)
  })

  it("keeps Friday full of stay-overs while optimizing the selected subset", () => {
    const records = students(14).map((student, index) => ({
      ...student,
      surname: `Cognome${index}`,
      dateOfBirth: index < 8 ? "2010-01-01" : "2000-01-01",
      sex: index === 0 || index >= 8 ? ("male" as const) : ("female" as const),
    }))
    const config = {
      ...CONFIG,
      desiredPerDay: 2,
      fewerDayIds: [],
      stayOverStudentIds: records.map(({ id }) => id),
    }
    const proposal = generateDutyProposal(records, config)
    const countsFor = (predicate: (student: DutyStudent) => boolean) =>
      DUTY_DAYS.map(
        ({ id }) =>
          proposal.assignments.filter(({ dayId, studentId }) => {
            const student = records.find(({ id }) => id === studentId)!
            return dayId === id && predicate(student)
          }).length,
      )

    expect(
      proposal.assignments.filter(({ dayId }) => dayId === "friday"),
    ).toHaveLength(2)
    expect(countsFor(({ sex }) => sex === "male")).toEqual([
      1, 1, 1, 1, 1, 1, 1,
    ])
    expect(countsFor(({ sex }) => sex === "female")).toEqual([
      1, 1, 1, 1, 1, 1, 1,
    ])
    const minorCounts = countsFor(
      ({ dateOfBirth }) => dateOfBirth === "2010-01-01",
    )
    expect(Math.max(...minorCounts) - Math.min(...minorCounts)).toBe(1)
  })

  it("applies deterministic alphabetical and similar-age tie-breakers", () => {
    const records = students(14).map((student, index) => ({
      ...student,
      surname: `Cognome${String(index).padStart(2, "0")}`,
      dateOfBirth: index % 2 === 0 ? "1990-01-01" : "2000-01-01",
    }))
    const baseConfig = {
      ...CONFIG,
      desiredPerDay: 2,
      fewerDayIds: [],
      balanceMinors: false,
      balanceSex: false,
      stayOverStudentIds: [],
    }
    const alphabetical = generateDutyProposal(records, {
      ...baseConfig,
      tieBreaker: "alphabetical",
    })
    const similarAge = generateDutyProposal(records, {
      ...baseConfig,
      tieBreaker: "similar-age",
    })
    const repeated = generateDutyProposal(records, {
      ...baseConfig,
      tieBreaker: "similar-age",
    })
    const ageDistance = (proposal: typeof similarAge) =>
      DUTY_DAYS.reduce((total, { id }) => {
        const years = proposal.assignments
          .filter(({ dayId }) => dayId === id)
          .map(({ studentId }) =>
            Number(
              records
                .find(({ id: candidateId }) => candidateId === studentId)!
                .dateOfBirth.slice(0, 4),
            ),
          )
        return total + Math.max(...years) - Math.min(...years)
      }, 0)

    expect(
      alphabetical.assignments.filter(({ dayId }) => dayId === "saturday"),
    ).toEqual([
      { dayId: "saturday", studentId: records[0]!.id },
      { dayId: "saturday", studentId: records[1]!.id },
    ])
    expect(repeated.assignments).toEqual(similarAge.assignments)
    expect(ageDistance(similarAge)).toBeLessThan(ageDistance(alphabetical))
  })

  it("keeps both enabled balance dimensions even across a bounded category matrix", () => {
    const failures: Array<{
      count: number
      minors: number
      minorFemales: number
      adultFemales: number
      spreads: number[]
    }> = []
    for (const count of [8, 14]) {
      for (let minors = 0; minors <= count; minors += 1) {
        for (let minorFemales = 0; minorFemales <= minors; minorFemales += 1) {
          for (
            let adultFemales = 0;
            adultFemales <= count - minors;
            adultFemales += 1
          ) {
            const records = students(count).map((student, index) => {
              const minor = index < minors
              const female = minor
                ? index < minorFemales
                : index - minors < adultFemales
              return {
                ...student,
                dateOfBirth: minor ? "2010-01-01" : "2000-01-01",
                sex: female ? ("female" as const) : ("male" as const),
              }
            })
            const proposal = generateDutyProposal(records, {
              ...CONFIG,
              desiredPerDay: Math.max(1, Math.floor(count / 7)),
              fewerDayIds: [],
              stayOverStudentIds: [],
            })
            const spread = (predicate: (student: DutyStudent) => boolean) => {
              const counts = DUTY_DAYS.map(
                ({ id }) =>
                  proposal.assignments.filter(({ dayId, studentId }) => {
                    const student = records.find(
                      ({ id: candidateId }) => candidateId === studentId,
                    )!
                    return dayId === id && predicate(student)
                  }).length,
              )
              return Math.max(...counts) - Math.min(...counts)
            }
            const spreads = [
              spread(({ dateOfBirth }) => dateOfBirth === "2010-01-01"),
              spread(({ sex }) => sex === "female"),
              spread(({ sex }) => sex === "male"),
            ]
            if (spreads.some((value) => value > 1)) {
              failures.push({
                count,
                minors,
                minorFemales,
                adultFemales,
                spreads,
              })
            }
          }
        }
      }
    }

    expect(failures).toEqual([])
  })

  it("preserves completed history and excludes disabled or already-served students", () => {
    const records = students(10)
    records[8]!.active = 0
    const completed = [
      { dayId: "saturday" as const, studentId: records[0]!.id },
      { dayId: "saturday" as const, studentId: records[8]!.id },
    ]
    const proposal = generateDutyProposal(
      records,
      CONFIG,
      [...completed, { dayId: "friday", studentId: records[1]!.id }],
      ["saturday"],
    )

    expect(proposal.assignments).toEqual(expect.arrayContaining(completed))
    expect(
      proposal.assignments.filter(
        ({ studentId }) => studentId === records[0]!.id,
      ),
    ).toHaveLength(1)
    expect(
      proposal.assignments.filter(
        ({ studentId }) => studentId === records[8]!.id,
      ),
    ).toHaveLength(1)
    expect(proposal.assignments).not.toContainEqual({
      dayId: "friday",
      studentId: records[1]!.id,
    })
  })

  it("reports major overrides and capacity-aware advisory warnings", () => {
    const records = students(21)
    records[20]!.active = 0
    const assignments = generateDutyProposal(
      records.slice(0, 20),
      CONFIG,
    ).assignments
    assignments.push({ dayId: "friday", studentId: records[20]!.id })
    assignments.push({ dayId: "friday", studentId: records[0]!.id })
    const warnings = getDutyWarnings(
      records,
      assignments,
      { ...CONFIG, stayOverStudentIds: [records[1]!.id, records[2]!.id] },
      [],
    )

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "major",
          key: expect.stringContaining("multiple"),
        }),
        expect.objectContaining({
          severity: "major",
          key: expect.stringContaining("disabled-future"),
        }),
        expect.objectContaining({
          severity: "advisory",
          key: expect.stringContaining("friday-stayover"),
        }),
      ]),
    )
    const repeated = warnings.find(({ key }) => key.startsWith("multiple"))!
    expect(repeated.title).toBe("Nome1 Cognome01 assegnato più volte")
    expect(repeated.detail).toContain("Sabato, Venerdì")
    expect(repeated.detail).not.toMatch(/saturday|friday/)
  })

  it("does not warn when Friday capacity is full despite other stay-over students", () => {
    const records = students(21)
    const config = {
      ...CONFIG,
      stayOverStudentIds: records.slice(0, 8).map(({ id }) => id),
    }
    const proposal = generateDutyProposal(records, config)
    const warnings = getDutyWarnings(records, proposal.assignments, config, [])

    expect(warnings.some(({ key }) => key.startsWith("friday-stayover"))).toBe(
      false,
    )
  })

  it("does warn when Friday is occupied by an ineligible disabled stay-over", () => {
    const records = students(8)
    records[0]!.active = 0
    const config = {
      ...CONFIG,
      desiredPerDay: 1,
      fewerDayIds: [],
      stayOverStudentIds: [records[0]!.id, records[1]!.id],
    }
    const proposal = generateDutyProposal(records, config)
    const assignments = proposal.assignments.map((assignment) =>
      assignment.dayId === "friday"
        ? { ...assignment, studentId: records[0]!.id }
        : assignment,
    )
    const warnings = getDutyWarnings(records, assignments, config, [])

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: expect.stringContaining("friday-stayover"),
          severity: "advisory",
        }),
      ]),
    )
  })

  it("reports a repeated duty even when the student is now disabled", () => {
    const records = students(2)
    records[0]!.active = 0
    const warnings = getDutyWarnings(
      records,
      [
        { dayId: "saturday", studentId: records[0]!.id },
        { dayId: "friday", studentId: records[0]!.id },
      ],
      CONFIG,
      ["saturday"],
    )

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: expect.stringContaining("multiple"),
          severity: "major",
        }),
        expect.objectContaining({
          key: expect.stringContaining("disabled-future"),
          severity: "major",
        }),
      ]),
    )
  })

  it("skips optional balance advisories when their setting is disabled", () => {
    const records = students(7).map((student, index) => ({
      ...student,
      dateOfBirth: index < 3 ? "2010-01-01" : "2000-01-01",
    }))
    const assignments = records.map((student, index) => ({
      dayId: DUTY_DAYS[index]!.id,
      studentId: student.id,
    }))
    assignments[1]!.dayId = "saturday"
    assignments[2]!.dayId = "saturday"
    const warnings = getDutyWarnings(
      records,
      assignments,
      { ...CONFIG, balanceMinors: false, balanceSex: false },
      [],
    )

    expect(warnings.some(({ key }) => key.startsWith("minor-balance"))).toBe(
      false,
    )
    expect(warnings.some(({ key }) => key.startsWith("sex-balance"))).toBe(
      false,
    )
  })

  it("does not warn about disabled students in completed history", () => {
    const records = students(2)
    records[0]!.active = 0
    const warnings = getDutyWarnings(
      records,
      [{ dayId: "saturday", studentId: records[0]!.id }],
      CONFIG,
      ["saturday"],
    )

    expect(warnings.some(({ key }) => key.startsWith("disabled-future"))).toBe(
      false,
    )
  })
})
