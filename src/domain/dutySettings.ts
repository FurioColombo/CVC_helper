import { DUTY_DAYS, type DutyDayId, type DutyTieBreaker } from "@/domain/config"
import {
  getDutyDistributionRequirement,
  getDutyWarnings,
  pruneDutyWarningAcknowledgements,
  type DutyAssignment,
  type DutyStudent,
} from "@/domain/duties"

/**
 * A course's duty settings as the app reads and saves them. `extraDayIds` is
 * absent on a course whose extra days were never chosen (stored by 0.1, or
 * never saved since): the screen derives them then.
 */
export interface DutySettings {
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

/** The settings with their extra days decided: what the screens display. */
export type CanonicalDutySettings = DutySettings & {
  extraDayIds: DutyDayId[]
}

/** The part of a student the settings' counts depend on. */
type CountedStudent = Pick<DutyStudent, "id" | "active">

const DAY_IDS = DUTY_DAYS.map(({ id }) => id)

function completedStudentIds(
  assignments: DutyAssignment[],
  completedDayIds: readonly DutyDayId[],
) {
  const completed = new Set(completedDayIds)
  return new Set(
    assignments
      .filter(({ dayId }) => completed.has(dayId))
      .map(({ studentId }) => studentId),
  )
}

/**
 * The active students a proposal still has to place: those without a duty on a
 * completed day.
 */
export function getProposalStudentCount(
  students: CountedStudent[],
  assignments: DutyAssignment[],
  completedDayIds: readonly DutyDayId[],
) {
  const completedIds = completedStudentIds(assignments, completedDayIds)
  return students.filter(
    ({ id, active }) => active === 1 && !completedIds.has(id),
  ).length
}

/**
 * The days that take the N mod D extra places, among `remainingDayIds`: the
 * explicit extra days first, then the days not marked as having fewer (0.1's
 * way of saying it), then whatever is left, at most N mod D of them.
 */
export function deriveExtraDayIds(
  studentCount: number,
  remainingDayIds: DutyDayId[],
  settings: Pick<DutySettings, "extraDayIds" | "fewerDayIds">,
) {
  const extraDayCount = getDutyDistributionRequirement(
    studentCount,
    remainingDayIds,
  ).extraDayCount
  const explicit = settings.extraDayIds ?? []
  const legacy = remainingDayIds.filter(
    (dayId) => !settings.fewerDayIds.includes(dayId),
  )
  const preferred = [...explicit, ...legacy, ...remainingDayIds]
  return [...new Set(preferred)]
    .filter((dayId) => remainingDayIds.includes(dayId))
    .slice(0, extraDayCount)
}

/**
 * The settings as the screens display them: the per-day count and the extra
 * and fewer days follow the students still to place and the days still open,
 * whatever the stored lists say.
 */
export function normalizeProposalSettings(
  settings: DutySettings,
  students: CountedStudent[],
  assignments: DutyAssignment[],
): CanonicalDutySettings {
  const remainingDayIds = DAY_IDS.filter(
    (dayId) => !settings.completedDayIds.includes(dayId),
  )
  const studentCount = getProposalStudentCount(
    students,
    assignments,
    settings.completedDayIds,
  )
  const extraDayIds = deriveExtraDayIds(studentCount, remainingDayIds, settings)
  return {
    ...settings,
    desiredPerDay:
      remainingDayIds.length === 0
        ? 0
        : Math.max(0, Math.floor(studentCount / remainingDayIds.length)),
    extraDayIds,
    fewerDayIds: remainingDayIds.filter(
      (dayId) => !extraDayIds.includes(dayId),
    ),
  }
}

/** The settings of a course that never saved any: an even week. */
export function defaultDutySettings(
  students: CountedStudent[],
): CanonicalDutySettings {
  const activeCount = students.filter(({ active }) => active === 1).length
  const extraDayIds = deriveExtraDayIds(activeCount, DAY_IDS, {
    fewerDayIds: [],
  })
  return {
    desiredPerDay: Math.floor(activeCount / DAY_IDS.length),
    fewerDayIds: DAY_IDS.filter((dayId) => !extraDayIds.includes(dayId)),
    extraDayIds,
    balanceMinors: true,
    balanceSex: false,
    tieBreaker: "alphabetical",
    stayOverStudentIds: [],
    completedDayIds: [],
    acknowledgedWarningKeys: [],
  }
}

/**
 * The settings as they are saved with `assignments`. Extra days that were
 * never chosen (`extraDayIds` absent) are derived through
 * `normalizeProposalSettings`; a list that is present, even an empty one, is
 * kept as given. Acknowledged warning keys stay only for the advisory warnings
 * still raised by `assignments` (`pruneDutyWarningAcknowledgements`, which also
 * drops a key listed twice).
 */
export function dutySettingsForSave(
  settings: DutySettings,
  students: DutyStudent[],
  assignments: DutyAssignment[],
  courseStartDate: string,
): CanonicalDutySettings {
  const canonical: CanonicalDutySettings = settings.extraDayIds
    ? { ...settings, extraDayIds: settings.extraDayIds }
    : normalizeProposalSettings(settings, students, assignments)
  const warnings = getDutyWarnings(
    students,
    assignments,
    { ...canonical, courseStartDate },
    canonical.completedDayIds,
  )
  return {
    ...canonical,
    acknowledgedWarningKeys: pruneDutyWarningAcknowledgements(
      warnings,
      canonical.acknowledgedWarningKeys,
    ),
  }
}
