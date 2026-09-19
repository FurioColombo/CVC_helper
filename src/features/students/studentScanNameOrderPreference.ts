import type { StudentNameOrder } from "@/capabilities/studentScan"

type RememberedOrder = Exclude<StudentNameOrder, "unknown">

const STORAGE_PREFIX = "cvc-helper.scan-name-order."

/**
 * Which way round a course's roster prints its names.
 *
 * A club's sheet is written one way and stays that way, so the operator is
 * asked once per course instead of once per scan. This is an interface
 * preference, not course data: it never leaves the device, it is not part of
 * the archive, and losing it costs one tap. That is why it lives in local
 * storage rather than in the database, which would mean a schema change during
 * a release gate for something a single tap can rebuild.
 */
export function readNameOrderPreference(
  courseId: string,
): RememberedOrder | null {
  try {
    const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${courseId}`)
    return stored === "given-surname" || stored === "surname-given"
      ? stored
      : null
  } catch {
    // Private windows and blocked site data throw rather than return null.
    return null
  }
}

export function writeNameOrderPreference(
  courseId: string,
  order: RememberedOrder,
) {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${courseId}`, order)
  } catch {
    // Remembering is a convenience; failing to remember must not break a scan.
  }
}

export function forgetNameOrderPreference(courseId: string) {
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${courseId}`)
  } catch {
    // As above: the scan continues with the order chosen for this session.
  }
}
