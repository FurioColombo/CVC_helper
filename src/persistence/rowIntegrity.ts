import { COURSE_PARENTS, COURSE_TABLES } from "@/persistence/schema"

/**
 * Integrity of stored rows that the domain invariant checker
 * (src/domain/invariants.ts, which works on one course's state) cannot see:
 * the record metadata and course ownership D1 adds. Pure, so the browser
 * migration harness can run it on a real database and tests on literals.
 */
export type StoredRow = Record<string, unknown> & { id: string }
export type StoredTables = Record<string, StoredRow[]>

export interface RowIssue {
  table: string
  id: string
  code:
    | "missing-created-at"
    | "missing-updated-at"
    | "invalid-timestamp"
    | "updated-before-created"
    | "missing-course"
    | "unknown-course"
    | "course-differs-from-parent"
}

// Exactly `toISOString()`'s shape: the writes compare timestamps as text, and
// text order is time order only at a fixed width.
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export function validateStoredRows(tables: StoredTables): RowIssue[] {
  const issues: RowIssue[] = []
  const courseIds = new Set((tables.courses ?? []).map((course) => course.id))

  for (const [table, rows] of Object.entries(tables)) {
    for (const row of rows) {
      const issue = (code: RowIssue["code"]) =>
        issues.push({ table, id: row.id, code })
      const { createdAt, updatedAt } = row
      if (createdAt == null) issue("missing-created-at")
      if (updatedAt == null) issue("missing-updated-at")
      const timestamps = [createdAt, updatedAt].filter((value) => value != null)
      if (
        timestamps.some(
          (value) => typeof value !== "string" || !ISO_UTC.test(value),
        )
      ) {
        issue("invalid-timestamp")
      } else if (
        typeof createdAt === "string" &&
        typeof updatedAt === "string" &&
        updatedAt < createdAt
      ) {
        issue("updated-before-created")
      }
    }
  }

  for (const table of COURSE_TABLES) {
    if (table === "courses") continue
    const owner: { table: string; key: string } | undefined =
      COURSE_PARENTS[table as keyof typeof COURSE_PARENTS]
    const parentRows = owner
      ? new Map((tables[owner.table] ?? []).map((row) => [row.id, row]))
      : undefined
    for (const row of tables[table] ?? []) {
      const issue = (code: RowIssue["code"]) =>
        issues.push({ table, id: row.id, code })
      if (row.courseId == null) {
        issue("missing-course")
        continue
      }
      if (!courseIds.has(String(row.courseId))) issue("unknown-course")
      if (owner && parentRows) {
        const parent = parentRows.get(String(row[owner.key]))
        // A missing parent is a dangling reference, which the domain
        // invariant checker reports, and a parent without a course is
        // reported on its own row; here only a disagreement counts.
        if (
          parent &&
          parent.courseId != null &&
          parent.courseId !== row.courseId
        ) {
          issue("course-differs-from-parent")
        }
      }
    }
  }
  return issues
}
