/**
 * Production read-boundary normalization for records created before 0.2.0.
 * The 0.1.0 schema had no course/week note column.
 */
export function normalizeStudentCourseNote<
  T extends object & { courseNote?: string | null },
>(record: T): T & { courseNote: string | null } {
  return { ...record, courseNote: record.courseNote ?? null }
}
