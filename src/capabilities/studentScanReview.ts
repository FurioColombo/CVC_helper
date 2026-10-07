/**
 * The scan review's gate: which fields and rows still need the operator, and
 * which rows are ready to save. The review screen, `measure:scan-review` and
 * the synthetic regression all import these, so a measured or tested count is
 * always the count the screen shows.
 */
import {
  MIN_FIELD_CONFIDENCE,
  studentScanAge,
  studentScanAgeCorroborated,
  type StudentScanCandidate,
  type StudentScanField,
} from "@/capabilities/studentScan"
import {
  isMinor,
  isValidDateOnly,
  PLAUSIBLE_STUDENT_AGE,
} from "@/domain/student"

// The review holds a scanned row together with what the operator has done to
// it. The name reading and its order live in the capability, which owns the
// surname-particle and compound rules.
export interface ScanReviewCandidate extends StudentScanCandidate {
  id: string
  nameManuallyEdited?: boolean
  /** Editable presentation value. It is never persisted in place of a date. */
  reviewAge: string
  ageManuallyEdited?: boolean
  /** A nonempty low-confidence reading reviewed by focus and blur. */
  acknowledgedFields?: Partial<Record<StudentScanField | "age", boolean>>
  /** The operator has read this row and vouches for it as it stands. */
  confirmed?: boolean
}

export function toReviewCandidate(
  candidate: StudentScanCandidate,
  index: number,
  courseStartDate: string,
): ScanReviewCandidate {
  const age =
    candidate.ageReading ||
    !candidate.dateOfBirth ||
    isValidDateOnly(candidate.dateOfBirth)
      ? studentScanAge(candidate, courseStartDate)
      : null
  return {
    ...candidate,
    id: `${candidate.sourceId}-${index + 1}`,
    reviewAge: String(age ?? ""),
  }
}

/**
 * The fields this scan is reviewing. The telephone is in the roster but is only
 * read when the operator asked for it, so everything that counts, gates or
 * renders a field works from this list rather than from a fixed four.
 */
export function reviewedFields(
  readPhone: boolean,
): readonly StudentScanField[] {
  return readPhone
    ? (["firstName", "surname", "dateOfBirth", "phone"] as const)
    : (["firstName", "surname", "dateOfBirth"] as const)
}

export function needsReview(
  candidate: ScanReviewCandidate,
  field: StudentScanField,
  courseStartDate?: string,
) {
  // A required name cannot be acknowledged while it is empty.
  if (
    (field === "firstName" || field === "surname") &&
    !candidate[field].trim()
  ) {
    return true
  }
  // A date the input handed over half-typed is not a date.
  if (
    field === "dateOfBirth" &&
    candidate.dateOfBirth &&
    !isValidDateOnly(candidate.dateOfBirth)
  ) {
    return true
  }
  // Confidence is the scan's opinion; a person who has read the row overrules
  // it. Without this the counter can never reach zero on a real photograph,
  // because a correct reading of a faint sheet still scores below the
  // threshold, and the operator is left retyping text that was already right.
  if (candidate.confirmed) return false
  if (field === "phone" && !candidate.phone.trim()) return false
  // Birth date is optional when the row has a valid age for course start.
  if (field === "dateOfBirth" && !candidate.dateOfBirth) return false
  if (candidate.acknowledgedFields?.[field]) return false
  if (
    field === "dateOfBirth" &&
    courseStartDate &&
    !candidate.ageManuallyEdited &&
    studentScanAgeCorroborated(candidate, courseStartDate)
  ) {
    return false
  }
  return candidate.confidence[field] < MIN_FIELD_CONFIDENCE
}

export function parsedReviewAge(candidate: ScanReviewCandidate) {
  if (!/^\d{1,3}$/.test(candidate.reviewAge)) return null
  const age = Number(candidate.reviewAge)
  return age >= 0 && age <= 120 ? age : null
}

/**
 * The review shows one age while a birth date, when present, is never stored
 * or shown itself (age-only entry, owner decision 2026-09-28): it is only
 * ever internal working data the scan read alongside a printed age, kept
 * only so a conflict between the two can still be surfaced. A printed age
 * may be a year off the date (it can be computed on another day), but never
 * so far that the student changes between minor and adult.
 *
 * The operator's decision wins once made (owner decision 2026-09-28): typing
 * an age or acknowledging the printed one resolves the conflict outright,
 * with no requirement that it then matches the date. Until one of those
 * happens (or the operator instead adopts the date's own age), the row stays
 * marked.
 */
export function ageConflictsWithReadDate(
  candidate: ScanReviewCandidate,
  courseStartDate: string,
) {
  const reviewedAge = parsedReviewAge(candidate)
  if (reviewedAge === null || !candidate.dateOfBirth) return false
  if (candidate.ageManuallyEdited || candidate.acknowledgedFields?.age) {
    return false
  }
  if (!isValidDateOnly(candidate.dateOfBirth)) return true
  const readAge = studentScanAge(
    { ...candidate, ageReading: undefined },
    courseStartDate,
  )
  if (readAge === null) return true
  return (
    Math.abs(readAge - reviewedAge) > 1 ||
    isMinor(candidate.dateOfBirth, courseStartDate) !== reviewedAge < 18
  )
}

/**
 * Ages a sailing course can have. A reading outside them is a misread (a rule
 * glued to "17 anni" makes 117) or a date that is not a birth date (a
 * registration date gives 0), so it is marked until the operator types it or
 * leaves the age field after checking it; checking the whole row is not enough.
 */
export const PLAUSIBLE_SCAN_AGE = PLAUSIBLE_STUDENT_AGE

export function ageNeedsReview(
  candidate: ScanReviewCandidate,
  courseStartDate: string,
) {
  const age = parsedReviewAge(candidate)
  if (age === null) return true
  if (
    !candidate.ageManuallyEdited &&
    !candidate.acknowledgedFields?.age &&
    (age < PLAUSIBLE_SCAN_AGE.min || age > PLAUSIBLE_SCAN_AGE.max)
  ) {
    return true
  }
  if (!candidate.dateOfBirth) {
    if (
      candidate.ageManuallyEdited ||
      candidate.confirmed ||
      candidate.acknowledgedFields?.age
    ) {
      return false
    }
    return (candidate.ageReading?.confidence ?? 0) < MIN_FIELD_CONFIDENCE
  }
  if (ageConflictsWithReadDate(candidate, courseStartDate)) return true
  if (candidate.confirmed) return false
  return needsReview(candidate, "dateOfBirth", courseStartDate)
}

export function nameReadingNeedsReview(candidate: ScanReviewCandidate) {
  const reading = candidate.nameReading
  if (!reading) return false
  return (
    !reading.acknowledged &&
    (reading.order === "unknown" || reading.compoundAmbiguity)
  )
}

/** A possible staff row or two rows read as one, until the row is checked. */
export function rowWarningNeedsReview(candidate: ScanReviewCandidate) {
  return Boolean(candidate.rowWarning) && !candidate.confirmed
}

/** Required values that are absent: names, a usable age and sex. */
export function missingFieldCount(candidate: ScanReviewCandidate) {
  return (
    Number(!candidate.firstName.trim()) +
    Number(!candidate.surname.trim()) +
    Number(parsedReviewAge(candidate) === null) +
    Number(!candidate.sex)
  )
}

/** Present values marked "Da controllare"; an empty name counts as missing. */
export function markedFieldCount(
  candidate: ScanReviewCandidate,
  courseStartDate: string,
  readPhone: boolean,
) {
  return (
    reviewedFields(readPhone).filter(
      (field) =>
        !(
          (field === "firstName" || field === "surname") &&
          !candidate[field].trim()
        ) && needsReview(candidate, field, courseStartDate),
    ).length +
    Number(
      parsedReviewAge(candidate) !== null &&
        ageNeedsReview(candidate, courseStartDate),
    )
  )
}

export function candidateNeedsReview(
  candidate: ScanReviewCandidate,
  courseStartDate: string,
  readPhone: boolean,
) {
  return (
    missingFieldCount(candidate) > 0 ||
    nameReadingNeedsReview(candidate) ||
    rowWarningNeedsReview(candidate) ||
    ageNeedsReview(candidate, courseStartDate) ||
    reviewedFields(readPhone).some((field) =>
      needsReview(candidate, field, courseStartDate),
    )
  )
}

export function candidateIsReady(
  candidate: ScanReviewCandidate,
  courseStartDate: string,
  readPhone: boolean,
) {
  return (
    !candidateNeedsReview(candidate, courseStartDate, readPhone) &&
    (!candidate.dateOfBirth || candidate.dateOfBirth <= courseStartDate)
  )
}

/** The review screen's counters for a whole sheet. */
export function summarizeScanReview(
  candidates: ScanReviewCandidate[],
  courseStartDate: string,
  readPhone: boolean,
) {
  const missingFields = candidates.reduce(
    (total, candidate) => total + missingFieldCount(candidate),
    0,
  )
  const fieldsMarkedForReview = candidates.reduce(
    (total, candidate) =>
      total + markedFieldCount(candidate, courseStartDate, readPhone),
    0,
  )
  return {
    missingFields,
    fieldsMarkedForReview,
    fieldsFlagged: missingFields + fieldsMarkedForReview,
    rowsToReview: candidates.filter((candidate) =>
      candidateNeedsReview(candidate, courseStartDate, readPhone),
    ).length,
    readyRows: candidates.filter((candidate) =>
      candidateIsReady(candidate, courseStartDate, readPhone),
    ).length,
  }
}
