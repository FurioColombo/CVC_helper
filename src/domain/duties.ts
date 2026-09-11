import {
  DUTY_DAYS,
  type DutyDayId,
  type DutyTieBreaker,
  type StudentSex,
} from "@/domain/config"
import { calculateAge, isMinor } from "@/domain/student"

export interface DutyStudent {
  id: string
  firstName: string
  surname: string
  dateOfBirth: string
  sex: StudentSex | null
  active: 0 | 1
}

export interface DutyAssignment {
  dayId: DutyDayId
  studentId: string
}

export interface DutyConfig {
  desiredPerDay: number
  fewerDayIds: DutyDayId[]
  /** Explicit days receiving the N mod D extra places in a 0.2 proposal. */
  extraDayIds: DutyDayId[]
  balanceMinors: boolean
  balanceSex: boolean
  tieBreaker: DutyTieBreaker
  stayOverStudentIds: string[]
  referenceDate: string
}

export interface DutyProposal {
  assignments: DutyAssignment[]
  capacities: Record<DutyDayId, number>
}

export interface DutyWarning {
  key: string
  severity: "major" | "advisory"
  title: string
  detail: string
  dayId?: DutyDayId
  dayIds?: DutyDayId[]
  studentId?: string
}

const DAY_IDS = DUTY_DAYS.map(({ id }) => id)

function emptyCapacities() {
  return Object.fromEntries(DAY_IDS.map((dayId) => [dayId, 0])) as Record<
    DutyDayId,
    number
  >
}

export interface DutyDistributionRequirement {
  base: number
  extraDayCount: number
}

function assertCanonicalDaySelection(dayIds: readonly DutyDayId[]) {
  if (
    !Array.isArray(dayIds) ||
    new Set(dayIds).size !== dayIds.length ||
    dayIds.some((dayId) => !DAY_IDS.includes(dayId))
  ) {
    throw new Error("Invalid duty day selection")
  }
}

export function getDutyDistributionRequirement(
  studentCount: number,
  dayIds: readonly DutyDayId[],
): DutyDistributionRequirement {
  if (!Number.isInteger(studentCount) || studentCount < 0) {
    throw new Error("Invalid eligible student count")
  }
  assertCanonicalDaySelection(dayIds)
  if (dayIds.length === 0) {
    if (studentCount > 0) throw new Error("No remaining duty days")
    return { base: 0, extraDayCount: 0 }
  }
  return {
    base: Math.floor(studentCount / dayIds.length),
    extraDayCount: studentCount % dayIds.length,
  }
}

export function calculateDutyCapacities(
  studentCount: number,
  dayIds: readonly DutyDayId[],
  extraDayIds: readonly DutyDayId[],
) {
  const capacities = emptyCapacities()
  const { base, extraDayCount } = getDutyDistributionRequirement(
    studentCount,
    dayIds,
  )
  assertCanonicalDaySelection(extraDayIds)
  const selectedDays = new Set(dayIds)
  if (
    extraDayIds.length !== extraDayCount ||
    extraDayIds.some((dayId) => !selectedDays.has(dayId))
  ) {
    throw new Error(
      `Select exactly ${extraDayCount} days with one extra student`,
    )
  }
  dayIds.forEach((dayId) => {
    capacities[dayId] = base
  })
  extraDayIds.forEach((dayId) => {
    capacities[dayId] += 1
  })
  return capacities
}

function getLegacyExtraDayIds(
  studentCount: number,
  dayIds: readonly DutyDayId[],
  fewerDayIds: readonly DutyDayId[],
) {
  const { extraDayCount } = getDutyDistributionRequirement(studentCount, dayIds)
  const fewer = new Set(fewerDayIds)
  return [
    ...dayIds.filter((dayId) => !fewer.has(dayId)),
    ...dayIds.filter((dayId) => fewer.has(dayId)),
  ].slice(0, extraDayCount)
}

export function calculateConfiguredDutyCapacities(
  studentCount: number,
  dayIds: readonly DutyDayId[],
  config: Pick<DutyConfig, "desiredPerDay" | "fewerDayIds" | "extraDayIds">,
) {
  return calculateDutyCapacities(studentCount, dayIds, config.extraDayIds)
}

function compareAlphabetically(left: DutyStudent, right: DutyStudent) {
  return (
    left.surname.localeCompare(right.surname, "it-IT", {
      sensitivity: "base",
    }) ||
    left.firstName.localeCompare(right.firstName, "it-IT", {
      sensitivity: "base",
    }) ||
    left.id.localeCompare(right.id)
  )
}

function compareStudents(
  left: DutyStudent,
  right: DutyStudent,
  tieBreaker: DutyTieBreaker,
) {
  if (tieBreaker === "similar-age") {
    return (
      left.dateOfBirth.localeCompare(right.dateOfBirth) ||
      compareAlphabetically(left, right)
    )
  }
  return compareAlphabetically(left, right)
}

export interface DutyStudentDayGroupEntry {
  student: DutyStudent
  dayIds: DutyDayId[]
}

export interface DutyStudentDayGroups {
  current: DutyStudentDayGroupEntry[]
  never: DutyStudentDayGroupEntry[]
  elsewhere: DutyStudentDayGroupEntry[]
}

function sortDutyDayIds(dayIds: Iterable<DutyDayId>) {
  return [...new Set(dayIds)].sort(
    (left, right) => DAY_IDS.indexOf(left) - DAY_IDS.indexOf(right),
  )
}

export function groupDutyStudentsForDay(
  students: DutyStudent[],
  assignments: DutyAssignment[],
  currentDayId: DutyDayId,
): DutyStudentDayGroups {
  const daysByStudent = new Map<string, DutyDayId[]>()
  assignments.forEach(({ dayId, studentId }) => {
    daysByStudent.set(studentId, [
      ...(daysByStudent.get(studentId) ?? []),
      dayId,
    ])
  })
  const groups: DutyStudentDayGroups = {
    current: [],
    never: [],
    elsewhere: [],
  }
  ;[...students].sort(compareAlphabetically).forEach((student) => {
    const dayIds = sortDutyDayIds(daysByStudent.get(student.id) ?? [])
    const entry = { student, dayIds }
    if (dayIds.includes(currentDayId)) groups.current.push(entry)
    else if (dayIds.length === 0) groups.never.push(entry)
    else groups.elsewhere.push(entry)
  })
  return groups
}

export function setStudentDutyForDay(
  assignments: DutyAssignment[],
  completedDayIds: readonly DutyDayId[],
  dayId: DutyDayId,
  studentId: string,
  assigned: boolean,
) {
  if (!DAY_IDS.includes(dayId) || !studentId) {
    throw new Error("Invalid duty assignment")
  }
  if (completedDayIds.includes(dayId)) {
    throw new Error("Completed duty history is immutable")
  }
  const exactMatch = ({
    dayId: candidateDayId,
    studentId: candidateStudentId,
  }: DutyAssignment) =>
    candidateDayId === dayId && candidateStudentId === studentId
  if (assigned) {
    return assignments.some(exactMatch)
      ? assignments.map((assignment) => ({ ...assignment }))
      : [
          ...assignments.map((assignment) => ({ ...assignment })),
          { dayId, studentId },
        ]
  }
  return assignments.filter((assignment) => !exactMatch(assignment))
}

export function getDutyCoverage(
  students: DutyStudent[],
  assignments: DutyAssignment[],
) {
  const activeStudentIds = new Set(
    students.filter(({ active }) => active === 1).map(({ id }) => id),
  )
  const assignedStudentIds = new Set(
    assignments
      .map(({ studentId }) => studentId)
      .filter((studentId) => activeStudentIds.has(studentId)),
  )
  const missingStudentIds = [...activeStudentIds].filter(
    (studentId) => !assignedStudentIds.has(studentId),
  )
  return {
    assigned: assignedStudentIds.size,
    total: activeStudentIds.size,
    missingStudentIds,
    complete: missingStudentIds.length === 0,
  }
}

function selectFridayStudents(
  candidates: DutyStudent[],
  allStudents: DutyStudent[],
  capacity: number,
  config: DutyConfig,
) {
  const selected: DutyStudent[] = []
  const pool = [...candidates]
  const overallMinorRatio =
    allStudents.length === 0
      ? 0
      : allStudents.filter((student) =>
          isMinor(student.dateOfBirth, config.referenceDate),
        ).length / allStudents.length
  const knownSex = allStudents.filter(
    ({ sex }) => sex === "male" || sex === "female",
  )
  const overallMaleRatio =
    knownSex.length === 0
      ? 0
      : knownSex.filter(({ sex }) => sex === "male").length / knownSex.length

  while (selected.length < capacity && pool.length > 0) {
    const progressiveSlots = selected.length + 1
    pool.sort((left, right) => {
      const score = (student: DutyStudent) => {
        const minors =
          selected.filter((item) =>
            isMinor(item.dateOfBirth, config.referenceDate),
          ).length +
          (isMinor(student.dateOfBirth, config.referenceDate) ? 1 : 0)
        const minorDeviation = Math.abs(
          minors - overallMinorRatio * progressiveSlots,
        )
        if (!config.balanceSex) return config.balanceMinors ? minorDeviation : 0
        const males =
          selected.filter(({ sex }) => sex === "male").length +
          (student.sex === "male" ? 1 : 0)
        const sexDeviation =
          student.sex === "male" || student.sex === "female"
            ? Math.abs(males - overallMaleRatio * progressiveSlots)
            : 1
        return (config.balanceMinors ? minorDeviation * 10 : 0) + sexDeviation
      }
      return (
        score(left) - score(right) ||
        compareStudents(left, right, config.tieBreaker)
      )
    })
    selected.push(pool.shift()!)
  }
  return selected
}

function compareBalanceScores(left: number[], right: number[]) {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index]! - right[index]!
    if (difference !== 0) return difference
  }
  return 0
}

function balanceScore(
  assignments: DutyAssignment[],
  studentsById: Map<string, DutyStudent>,
  dayIds: DutyDayId[],
  config: DutyConfig,
) {
  const counts = (predicate: (student: DutyStudent) => boolean) =>
    dayIds.map(
      (dayId) =>
        assignments.filter(({ dayId: assignedDay, studentId }) => {
          const student = studentsById.get(studentId)
          return (
            assignedDay === dayId && student !== undefined && predicate(student)
          )
        }).length,
    )
  const metrics = (values: number[]) =>
    values.length === 0
      ? [0, 0]
      : [
          Math.max(...values) - Math.min(...values),
          values.reduce((sum, value) => sum + value * value, 0),
        ]
  const score: number[] = []
  if (config.balanceMinors) {
    score.push(
      ...metrics(
        counts((student) => isMinor(student.dateOfBirth, config.referenceDate)),
      ),
    )
  }
  if (config.balanceSex) {
    const maleMetrics = metrics(counts(({ sex }) => sex === "male"))
    const femaleMetrics = metrics(counts(({ sex }) => sex === "female"))
    score.push(
      Math.max(maleMetrics[0]!, femaleMetrics[0]!),
      maleMetrics[0]! + femaleMetrics[0]!,
      maleMetrics[1]! + femaleMetrics[1]!,
    )
  }
  return score
}

function optimizeDutyBalance(
  assignments: DutyAssignment[],
  studentsById: Map<string, DutyStudent>,
  dayIds: DutyDayId[],
  requiredFridayStayOverCount: number,
  config: DutyConfig,
) {
  if (!config.balanceMinors && !config.balanceSex) return assignments
  const optimized = assignments.map((assignment) => ({ ...assignment }))
  const candidateIndexes = optimized
    .map((assignment, index) => ({ assignment, index }))
    .filter(({ assignment }) => dayIds.includes(assignment.dayId))
    .map(({ index }) => index)
  const stayOver = new Set(config.stayOverStudentIds)

  while (true) {
    const currentScore = balanceScore(optimized, studentsById, dayIds, config)
    let bestScore = currentScore
    let bestPair: [number, number] | null = null
    for (let left = 0; left < candidateIndexes.length; left += 1) {
      for (let right = left + 1; right < candidateIndexes.length; right += 1) {
        const leftIndex = candidateIndexes[left]!
        const rightIndex = candidateIndexes[right]!
        const leftAssignment = optimized[leftIndex]!
        const rightAssignment = optimized[rightIndex]!
        if (leftAssignment.dayId === rightAssignment.dayId) continue
        optimized[leftIndex] = {
          dayId: leftAssignment.dayId,
          studentId: rightAssignment.studentId,
        }
        optimized[rightIndex] = {
          dayId: rightAssignment.dayId,
          studentId: leftAssignment.studentId,
        }
        const fridayStayOverCount = optimized.filter(
          ({ dayId, studentId }) =>
            dayId === "friday" && stayOver.has(studentId),
        ).length
        if (fridayStayOverCount < requiredFridayStayOverCount) {
          optimized[leftIndex] = leftAssignment
          optimized[rightIndex] = rightAssignment
          continue
        }
        const candidateScore = balanceScore(
          optimized,
          studentsById,
          dayIds,
          config,
        )
        optimized[leftIndex] = leftAssignment
        optimized[rightIndex] = rightAssignment
        if (compareBalanceScores(candidateScore, bestScore) < 0) {
          bestScore = candidateScore
          bestPair = [leftIndex, rightIndex]
        }
      }
    }
    if (!bestPair) return optimized
    const [leftIndex, rightIndex] = bestPair
    const leftStudentId = optimized[leftIndex]!.studentId
    optimized[leftIndex] = {
      ...optimized[leftIndex]!,
      studentId: optimized[rightIndex]!.studentId,
    }
    optimized[rightIndex] = {
      ...optimized[rightIndex]!,
      studentId: leftStudentId,
    }
  }
}

export function generateDutyProposal(
  students: DutyStudent[],
  config: DutyConfig,
  existingAssignments: DutyAssignment[] = [],
  completedDayIds: DutyDayId[] = [],
): DutyProposal {
  const completed = new Set(completedDayIds)
  const preserved = existingAssignments.filter(({ dayId }) =>
    completed.has(dayId),
  )
  const alreadyCompleted = new Set(preserved.map(({ studentId }) => studentId))
  const eligible = students.filter(
    ({ id, active }) => active === 1 && !alreadyCompleted.has(id),
  )
  const remainingDays = DAY_IDS.filter((dayId) => !completed.has(dayId))
  const capacities = calculateConfiguredDutyCapacities(
    eligible.length,
    remainingDays,
    config,
  )
  const assignments = [...preserved]
  const assignedCounts = emptyCapacities()
  const minorCounts = emptyCapacities()
  const maleCounts = emptyCapacities()
  const femaleCounts = emptyCapacities()
  const agesByDay = new Map<DutyDayId, number[]>()
  const pinnedFridayStudentIds = new Set<string>()

  const byId = new Map(students.map((student) => [student.id, student]))
  preserved.forEach((assignment) => {
    const student = byId.get(assignment.studentId)
    if (!student) return
    assignedCounts[assignment.dayId] += 1
    if (isMinor(student.dateOfBirth, config.referenceDate)) {
      minorCounts[assignment.dayId] += 1
    }
    if (student.sex === "male") maleCounts[assignment.dayId] += 1
    if (student.sex === "female") femaleCounts[assignment.dayId] += 1
  })

  const remaining = [...eligible]
  if (remainingDays.includes("friday") && capacities.friday > 0) {
    const stayOver = new Set(config.stayOverStudentIds)
    const fridayCandidates = remaining.filter(({ id }) => stayOver.has(id))
    const fridayStudents = selectFridayStudents(
      fridayCandidates,
      eligible,
      capacities.friday,
      config,
    )
    fridayStudents.forEach((student) => {
      pinnedFridayStudentIds.add(student.id)
      assignments.push({ dayId: "friday", studentId: student.id })
      assignedCounts.friday += 1
      if (isMinor(student.dateOfBirth, config.referenceDate)) {
        minorCounts.friday += 1
      }
      if (student.sex === "male") maleCounts.friday += 1
      if (student.sex === "female") femaleCounts.friday += 1
      agesByDay.set("friday", [
        ...(agesByDay.get("friday") ?? []),
        calculateAge(student.dateOfBirth, config.referenceDate),
      ])
      remaining.splice(
        remaining.findIndex(({ id }) => id === student.id),
        1,
      )
    })
  }

  const remainingSexCounts = remaining.reduce(
    (counts, student) => {
      if (student.sex === "male" || student.sex === "female") {
        counts[student.sex] += 1
      }
      return counts
    },
    { male: 0, female: 0 },
  )
  remaining.sort((left, right) => {
    if (config.balanceMinors) {
      const leftMinor = isMinor(left.dateOfBirth, config.referenceDate)
      const rightMinor = isMinor(right.dateOfBirth, config.referenceDate)
      if (leftMinor !== rightMinor) return leftMinor ? -1 : 1
    }
    if (config.balanceSex) {
      const leftKnown = left.sex === "male" || left.sex === "female"
      const rightKnown = right.sex === "male" || right.sex === "female"
      if (leftKnown !== rightKnown) return leftKnown ? -1 : 1
      if (leftKnown && rightKnown && left.sex !== right.sex) {
        const leftSex = left.sex as "male" | "female"
        const rightSex = right.sex as "male" | "female"
        const abundanceDifference =
          remainingSexCounts[leftSex] - remainingSexCounts[rightSex]
        if (abundanceDifference !== 0) return abundanceDifference
      }
    }
    return compareStudents(left, right, config.tieBreaker)
  })

  for (const student of remaining) {
    const openDays = remainingDays.filter(
      (dayId) => assignedCounts[dayId] < capacities[dayId],
    )
    if (openDays.length === 0) break
    const studentIsMinor = isMinor(student.dateOfBirth, config.referenceDate)
    const age = calculateAge(student.dateOfBirth, config.referenceDate)
    openDays.sort((left, right) => {
      const minorDifference =
        config.balanceMinors && studentIsMinor
          ? minorCounts[left] - minorCounts[right]
          : 0
      if (minorDifference !== 0) return minorDifference
      if (
        config.balanceSex &&
        (student.sex === "male" || student.sex === "female")
      ) {
        const counts = student.sex === "male" ? maleCounts : femaleCounts
        const sexDifference = counts[left] - counts[right]
        if (sexDifference !== 0) return sexDifference
      }
      if (config.tieBreaker === "similar-age") {
        const ageDistance = (dayId: DutyDayId) => {
          const ages = agesByDay.get(dayId) ?? []
          if (ages.length === 0) return Number.POSITIVE_INFINITY
          return Math.min(
            ...ages.map((existingAge) => Math.abs(existingAge - age)),
          )
        }
        const ageDifference = ageDistance(left) - ageDistance(right)
        if (Number.isFinite(ageDifference) && ageDifference !== 0) {
          return ageDifference
        }
      }
      return DAY_IDS.indexOf(left) - DAY_IDS.indexOf(right)
    })
    const dayId = openDays[0]!
    assignments.push({ dayId, studentId: student.id })
    assignedCounts[dayId] += 1
    if (studentIsMinor) minorCounts[dayId] += 1
    if (student.sex === "male") maleCounts[dayId] += 1
    if (student.sex === "female") femaleCounts[dayId] += 1
    agesByDay.set(dayId, [...(agesByDay.get(dayId) ?? []), age])
  }

  return {
    assignments: optimizeDutyBalance(
      assignments,
      byId,
      remainingDays,
      pinnedFridayStudentIds.size,
      config,
    ),
    capacities,
  }
}

function sortedIds(ids: Iterable<string>) {
  return [...ids].sort().join(",")
}

function dutyDayLabel(dayId: DutyDayId) {
  return DUTY_DAYS.find(({ id }) => id === dayId)?.label ?? dayId
}

export function getVisibleDutyWarnings(
  warnings: DutyWarning[],
  acknowledgedWarningKeys: readonly string[],
) {
  const acknowledged = new Set(acknowledgedWarningKeys)
  return warnings.filter(
    ({ key, severity }) => severity === "major" || !acknowledged.has(key),
  )
}

export function pruneDutyWarningAcknowledgements(
  warnings: DutyWarning[],
  acknowledgedWarningKeys: readonly string[],
) {
  const activeAdvisories = new Set(
    warnings
      .filter(({ severity }) => severity === "advisory")
      .map(({ key }) => key),
  )
  return [...new Set(acknowledgedWarningKeys)].filter((key) =>
    activeAdvisories.has(key),
  )
}

export function getDutyWarnings(
  students: DutyStudent[],
  assignments: DutyAssignment[],
  config: DutyConfig,
  completedDayIds: DutyDayId[] = [],
): DutyWarning[] {
  const warnings: DutyWarning[] = []
  const completed = new Set(completedDayIds)
  const byId = new Map(students.map((student) => [student.id, student]))
  const daysByStudent = new Map<string, DutyDayId[]>()
  assignments.forEach(({ dayId, studentId }) => {
    daysByStudent.set(studentId, [
      ...(daysByStudent.get(studentId) ?? []),
      dayId,
    ])
  })

  students.forEach((student) => {
    const days = daysByStudent.get(student.id) ?? []
    const name = `${student.firstName} ${student.surname}`
    if (student.active === 1 && days.length === 0) {
      warnings.push({
        key: `missing:${student.id}`,
        severity: "major",
        title: `${name} non assegnato`,
        detail: "L’allievo non compare in nessuna comandata della settimana.",
        studentId: student.id,
      })
    }
    if (days.length > 1) {
      const orderedDays = sortDutyDayIds(days)
      warnings.push({
        key: `multiple:${student.id}:${sortedIds(orderedDays)}`,
        severity: "major",
        title: `${name} assegnato più volte`,
        detail: `Comandate: ${orderedDays.map(dutyDayLabel).join(", ")}. La scelta resta consentita.`,
        dayIds: orderedDays,
        studentId: student.id,
      })
    }
  })

  assignments.forEach(({ dayId, studentId }) => {
    const student = byId.get(studentId)
    if (student?.active === 0 && !completed.has(dayId)) {
      warnings.push({
        key: `disabled-future:${studentId}:${dayId}`,
        severity: "major",
        title: `${student.firstName} ${student.surname} è disabilitato`,
        detail: `L’assegnazione futura a ${dutyDayLabel(dayId)} resta consentita ma va verificata.`,
        dayId,
        studentId,
      })
    }
  })

  const completedStudents = new Set(
    assignments
      .filter(({ dayId }) => completed.has(dayId))
      .map(({ studentId }) => studentId),
  )
  const futureDays = DAY_IDS.filter((dayId) => !completed.has(dayId))
  const futureEligible = students.filter(
    ({ id, active }) => active === 1 && !completedStudents.has(id),
  )
  let expected: Record<DutyDayId, number>
  try {
    expected = calculateConfiguredDutyCapacities(
      futureEligible.length,
      futureDays,
      config,
    )
  } catch {
    expected = calculateDutyCapacities(
      futureEligible.length,
      futureDays,
      getLegacyExtraDayIds(
        futureEligible.length,
        futureDays,
        config.fewerDayIds,
      ),
    )
  }
  futureDays.forEach((dayId) => {
    const actual = assignments.filter(
      (assignment) => assignment.dayId === dayId,
    ).length
    if (actual !== expected[dayId]) {
      warnings.push({
        key: `headcount:${dayId}:${actual}:${expected[dayId]}`,
        severity: "major",
        title: `Numero non previsto per ${dutyDayLabel(dayId)}`,
        detail: `${actual} assegnati; proposta equilibrata ${expected[dayId]}.`,
        dayId,
      })
    }
  })

  if (futureDays.includes("friday")) {
    const stayOver = new Set(config.stayOverStudentIds)
    const fridayAssignments = assignments.filter(
      ({ dayId }) => dayId === "friday",
    )
    const futureEligibleIds = new Set(futureEligible.map(({ id }) => id))
    const actualStayOver = fridayAssignments.filter(
      ({ studentId }) =>
        stayOver.has(studentId) && futureEligibleIds.has(studentId),
    ).length
    const availableStayOver = futureEligible.filter(({ id }) =>
      stayOver.has(id),
    ).length
    const target = Math.min(availableStayOver, expected.friday)
    if (actualStayOver < target) {
      warnings.push({
        key: `friday-stayover:${actualStayOver}:${target}:${sortedIds(stayOver)}`,
        severity: "advisory",
        title: "Preferenza venerdì non soddisfatta",
        detail: `${actualStayOver} permanenti su ${target} posti utili del venerdì.`,
        dayId: "friday",
      })
    }
  }

  const advisoryBalance = (label: string, key: string, counts: number[]) => {
    if (counts.length > 1 && Math.max(...counts) - Math.min(...counts) > 1) {
      const minimum = Math.min(...counts)
      const maximum = Math.max(...counts)
      warnings.push({
        key: `${key}:${counts.join(",")}`,
        severity: "advisory",
        title: `${label} non distribuiti uniformemente`,
        detail: "La modifica resta consentita e può essere accettata.",
        dayIds: futureDays.filter(
          (_, index) => counts[index] === minimum || counts[index] === maximum,
        ),
      })
    }
  }
  if (config.balanceMinors) {
    advisoryBalance(
      "Minori",
      "minor-balance",
      futureDays.map(
        (dayId) =>
          assignments.filter(({ dayId: assignedDay, studentId }) => {
            const student = byId.get(studentId)
            return (
              assignedDay === dayId &&
              student !== undefined &&
              isMinor(student.dateOfBirth, config.referenceDate)
            )
          }).length,
      ),
    )
  }
  if (config.balanceSex) {
    for (const sex of ["male", "female"] as const) {
      advisoryBalance(
        sex === "male" ? "Uomini" : "Donne",
        `sex-balance-${sex}`,
        futureDays.map(
          (dayId) =>
            assignments.filter(
              ({ dayId: assignedDay, studentId }) =>
                assignedDay === dayId && byId.get(studentId)?.sex === sex,
            ).length,
        ),
      )
    }
  }

  return warnings
}
