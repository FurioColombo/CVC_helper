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
  balanceMinors: number
  balanceSex: number
  tieBreaker: string
  stayOverStudentIds: string
  completedDayIds: string
  acknowledgedWarningKeys: string
}

const DAY_IDS = DUTY_DAYS.map(({ id }) => id)

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
  const completedDayIds = parseStringArray(record.completedDayIds)
  if (
    !Number.isInteger(record.desiredPerDay) ||
    record.desiredPerDay < 1 ||
    ![0, 1].includes(record.balanceMinors) ||
    ![0, 1].includes(record.balanceSex) ||
    !DUTY_TIE_BREAKERS.includes(record.tieBreaker as DutyTieBreaker) ||
    fewerDayIds.some((dayId) => !DAY_IDS.includes(dayId as DutyDayId)) ||
    completedDayIds.some((dayId) => !DAY_IDS.includes(dayId as DutyDayId))
  ) {
    throw new Error("Invalid persisted duty settings")
  }
  return {
    desiredPerDay: record.desiredPerDay,
    fewerDayIds: fewerDayIds as DutyDayId[],
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
              tieBreaker, stayOverStudentIds, completedDayIds,
              acknowledgedWarningKeys
       FROM dutySettings
       WHERE id = ? AND courseId = ?`,
      [courseId, courseId],
    ),
  ])
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
  if (!Number.isInteger(settings.desiredPerDay) || settings.desiredPerDay < 1) {
    throw new Error("Invalid duty settings")
  }
  const uniqueKeys = new Set<string>()
  for (const assignment of assignments) {
    const key = `${assignment.dayId}:${assignment.studentId}`
    if (uniqueKeys.has(key)) throw new Error("Duplicate duty assignment")
    uniqueKeys.add(key)
  }
  await db.writeTransaction(async (transaction) => {
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
        id, courseId, desiredPerDay, fewerDayIds, balanceMinors, balanceSex,
        tieBreaker, stayOverStudentIds, completedDayIds, acknowledgedWarningKeys
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        courseId,
        courseId,
        settings.desiredPerDay,
        JSON.stringify(settings.fewerDayIds),
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
