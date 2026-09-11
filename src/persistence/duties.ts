import {
  DUTY_DAYS,
  DUTY_TIE_BREAKERS,
  type DutyDayId,
  type DutyTieBreaker,
} from "@/domain/config"
import type { DutyAssignment } from "@/domain/duties"
import { db } from "@/persistence/db"

export interface DutySettingsRecord {
  desiredPerDay: number
  fewerDayIds: DutyDayId[]
  extraDayIds?: DutyDayId[]
  balanceMinors: boolean
  balanceSex: boolean
  tieBreaker: DutyTieBreaker
  stayOverStudentIds: string[]
  completedDayIds: DutyDayId[]
  acknowledgedWarningKeys: string[]
}

interface PersistedDutySettings {
  desiredPerDay: number
  fewerDayIds: string
  extraDayIds: string | null
  balanceMinors: number
  balanceSex: number
  tieBreaker: string
  stayOverStudentIds: string
  completedDayIds: string
  acknowledgedWarningKeys: string
}

const DAY_IDS = DUTY_DAYS.map(({ id }) => id)

function hasDuplicates(values: readonly string[]) {
  return new Set(values).size !== values.length
}

function parseStringArray(value: string) {
  const parsed: unknown = JSON.parse(value)
  if (
    !Array.isArray(parsed) ||
    parsed.some((item) => typeof item !== "string")
  ) {
    throw new Error("Invalid persisted duty settings")
  }
  return parsed
}

function parseSettings(record: PersistedDutySettings): DutySettingsRecord {
  const fewerDayIds = parseStringArray(record.fewerDayIds)
  const extraDayIds =
    record.extraDayIds == null
      ? undefined
      : parseStringArray(record.extraDayIds)
  const completedDayIds = parseStringArray(record.completedDayIds)
  if (
    !Number.isInteger(record.desiredPerDay) ||
    record.desiredPerDay < 0 ||
    ![0, 1].includes(record.balanceMinors) ||
    ![0, 1].includes(record.balanceSex) ||
    !DUTY_TIE_BREAKERS.includes(record.tieBreaker as DutyTieBreaker) ||
    fewerDayIds.some((dayId) => !DAY_IDS.includes(dayId as DutyDayId)) ||
    extraDayIds?.some((dayId) => !DAY_IDS.includes(dayId as DutyDayId)) ||
    completedDayIds.some((dayId) => !DAY_IDS.includes(dayId as DutyDayId)) ||
    hasDuplicates(fewerDayIds) ||
    hasDuplicates(extraDayIds ?? []) ||
    hasDuplicates(completedDayIds)
  ) {
    throw new Error("Invalid persisted duty settings")
  }
  return {
    desiredPerDay: record.desiredPerDay,
    fewerDayIds: fewerDayIds as DutyDayId[],
    ...(extraDayIds ? { extraDayIds: extraDayIds as DutyDayId[] } : {}),
    balanceMinors: record.balanceMinors === 1,
    balanceSex: record.balanceSex === 1,
    tieBreaker: record.tieBreaker as DutyTieBreaker,
    stayOverStudentIds: parseStringArray(record.stayOverStudentIds),
    completedDayIds: completedDayIds as DutyDayId[],
    acknowledgedWarningKeys: parseStringArray(record.acknowledgedWarningKeys),
  }
}

export async function readDutyPlan(courseId: string) {
  await db.init()
  const [assignments, persistedSettings] = await Promise.all([
    db.getAll<DutyAssignment>(
      `SELECT dayId, studentId
       FROM dutyAssignments
       WHERE courseId = ?
       ORDER BY dayId, studentId`,
      [courseId],
    ),
    db.getOptional<PersistedDutySettings>(
      `SELECT desiredPerDay, fewerDayIds, balanceMinors, balanceSex,
              extraDayIds, tieBreaker, stayOverStudentIds, completedDayIds,
              acknowledgedWarningKeys
       FROM dutySettings
       WHERE id = ? AND courseId = ?`,
      [courseId, courseId],
    ),
  ])
  const assignmentKeys = assignments.map(
    ({ dayId, studentId }) => `${dayId}:${studentId}`,
  )
  if (
    assignments.some(
      ({ dayId, studentId }) => !DAY_IDS.includes(dayId) || !studentId,
    ) ||
    hasDuplicates(assignmentKeys)
  ) {
    throw new Error("Invalid persisted duty assignment")
  }
  return {
    assignments,
    settings: persistedSettings ? parseSettings(persistedSettings) : null,
  }
}

export async function saveDutyPlan(
  courseId: string,
  assignments: DutyAssignment[],
  settings: DutySettingsRecord,
) {
  await db.init()
  if (!Number.isInteger(settings.desiredPerDay) || settings.desiredPerDay < 0) {
    throw new Error("Invalid duty settings")
  }
  const settingsDayIds = [
    ...settings.fewerDayIds,
    ...(settings.extraDayIds ?? []),
    ...settings.completedDayIds,
  ]
  if (
    settingsDayIds.some((dayId) => !DAY_IDS.includes(dayId)) ||
    hasDuplicates(settings.fewerDayIds) ||
    hasDuplicates(settings.extraDayIds ?? []) ||
    hasDuplicates(settings.completedDayIds)
  ) {
    throw new Error("Invalid duty settings")
  }
  const uniqueKeys = new Set<string>()
  for (const assignment of assignments) {
    if (!DAY_IDS.includes(assignment.dayId) || !assignment.studentId) {
      throw new Error("Invalid duty assignment")
    }
    const key = `${assignment.dayId}:${assignment.studentId}`
    if (uniqueKeys.has(key)) throw new Error("Duplicate duty assignment")
    uniqueKeys.add(key)
  }
  await db.writeTransaction(async (transaction) => {
    const persistedSettings = await transaction.getOptional<{
      completedDayIds: string
    }>(
      "SELECT completedDayIds FROM dutySettings WHERE id = ? AND courseId = ?",
      [courseId, courseId],
    )
    const persistedCompletedDayIds = persistedSettings
      ? (parseStringArray(persistedSettings.completedDayIds) as DutyDayId[])
      : []
    if (
      persistedCompletedDayIds.some((dayId) => !DAY_IDS.includes(dayId)) ||
      hasDuplicates(persistedCompletedDayIds)
    ) {
      throw new Error("Invalid persisted duty settings")
    }
    if (
      persistedCompletedDayIds.some(
        (dayId) => !settings.completedDayIds.includes(dayId),
      )
    ) {
      throw new Error("Completed duty history is immutable")
    }
    if (persistedCompletedDayIds.length > 0) {
      const persistedAssignments = await transaction.getAll<DutyAssignment>(
        `SELECT dayId, studentId
         FROM dutyAssignments
         WHERE courseId = ?`,
        [courseId],
      )
      const completed = new Set(persistedCompletedDayIds)
      const canonical = (rows: DutyAssignment[]) =>
        rows
          .filter(({ dayId }) => completed.has(dayId))
          .map(({ dayId, studentId }) => `${dayId}:${studentId}`)
          .sort()
      if (
        JSON.stringify(canonical(persistedAssignments)) !==
        JSON.stringify(canonical(assignments))
      ) {
        throw new Error("Completed duty history is immutable")
      }
    }
    await transaction.execute(
      "DELETE FROM dutyAssignments WHERE courseId = ?",
      [courseId],
    )
    if (assignments.length > 0) {
      await transaction.executeBatch(
        "INSERT INTO dutyAssignments(id, courseId, dayId, studentId) VALUES (?, ?, ?, ?)",
        assignments.map((assignment) => [
          crypto.randomUUID(),
          courseId,
          assignment.dayId,
          assignment.studentId,
        ]),
      )
    }
    await transaction.execute(
      `INSERT OR REPLACE INTO dutySettings(
        id, courseId, desiredPerDay, fewerDayIds, extraDayIds, balanceMinors,
        balanceSex, tieBreaker, stayOverStudentIds, completedDayIds,
        acknowledgedWarningKeys
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        courseId,
        courseId,
        settings.desiredPerDay,
        JSON.stringify(settings.fewerDayIds),
        JSON.stringify(settings.extraDayIds ?? []),
        settings.balanceMinors ? 1 : 0,
        settings.balanceSex ? 1 : 0,
        settings.tieBreaker,
        JSON.stringify(settings.stayOverStudentIds),
        JSON.stringify(settings.completedDayIds),
        JSON.stringify(settings.acknowledgedWarningKeys),
      ],
    )
  })
}
