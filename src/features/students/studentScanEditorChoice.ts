/**
 * Which adjustment surface the scan mounts.
 *
 * `document` is the full-frame workspace of the 2026-09-16 correction: no
 * rotation slider, direct crop, zoom and pan, and straightening taken from a
 * line drawn along a rule on the sheet.
 *
 * `classic` is the surface as it shipped in the UG1 release candidate, kept
 * buildable and tested so the two can be compared. Change this one value to
 * reinstate it; nothing else needs to move.
 */
export type StudentScanEditorChoice = "document" | "classic"

export const STUDENT_SCAN_EDITOR: StudentScanEditorChoice = "document"
