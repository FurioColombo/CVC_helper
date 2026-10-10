import { describe, expect, it } from "vitest"

import {
  validateStoredRows,
  type StoredTables,
} from "@/persistence/rowIntegrity"

const T0 = "2026-10-10T08:00:00.000Z"
const T1 = "2026-10-10T09:30:00.000Z"
const meta = { createdAt: T0, updatedAt: T1 }

function sound(): StoredTables {
  return {
    courses: [{ id: "c1", ...meta }],
    students: [{ id: "s1", courseId: "c1", ...meta }],
    boats: [{ id: "b1", courseId: "c1", ...meta }],
    faults: [{ id: "f1", courseId: "c1", boatId: "b1", ...meta }],
    crews: [{ id: "cr1", courseId: "c1", ...meta }],
    crewMembers: [{ id: "m1", courseId: "c1", crewId: "cr1", ...meta }],
    evaluations: [{ id: "e1", courseId: "c1", studentId: "s1", ...meta }],
  }
}

/** Replaces one stored row's fields, failing loudly if the row is not there. */
function change(
  tables: StoredTables,
  table: string,
  fields: Record<string, unknown>,
) {
  const rows = tables[table]
  const row = rows?.[0]
  if (!rows || !row) throw new Error(`no ${table} row to change`)
  rows[0] = { ...row, ...fields }
}

describe("validateStoredRows", () => {
  it("accepts complete metadata and consistent course ownership", () => {
    expect(validateStoredRows(sound())).toEqual([])
  })

  it.each([
    ["missing-created-at", { createdAt: null }],
    ["missing-updated-at", { updatedAt: undefined }],
    ["invalid-timestamp", { createdAt: "10/10/2026" }],
    ["invalid-timestamp", { updatedAt: "2026-10-10T09:30:00+02:00" }],
    ["updated-before-created", { createdAt: T1, updatedAt: T0 }],
  ])("reports %s", (code, fields) => {
    const tables = sound()
    change(tables, "students", fields)
    expect(validateStoredRows(tables)).toEqual([
      { table: "students", id: "s1", code },
    ])
  })

  it("reports a course-scoped row without a course or with an unknown one", () => {
    const tables = sound()
    change(tables, "boats", { courseId: null })
    change(tables, "crews", { courseId: "c9" })
    change(tables, "crewMembers", { courseId: "c9" })
    expect(validateStoredRows(tables)).toEqual([
      { table: "boats", id: "b1", code: "missing-course" },
      { table: "crews", id: "cr1", code: "unknown-course" },
      { table: "crewMembers", id: "m1", code: "unknown-course" },
    ])
  })

  it("reports a child whose course differs from its parent's", () => {
    const tables = sound()
    tables.courses?.push({ id: "c2", ...meta })
    change(tables, "faults", { courseId: "c2" })
    change(tables, "evaluations", { courseId: "c2" })
    expect(validateStoredRows(tables)).toEqual([
      { table: "faults", id: "f1", code: "course-differs-from-parent" },
      { table: "evaluations", id: "e1", code: "course-differs-from-parent" },
    ])
  })

  it("leaves a dangling child to the domain invariant checker", () => {
    const tables = sound()
    change(tables, "faults", { boatId: "gone" })
    expect(validateStoredRows(tables)).toEqual([])
  })

  it("accepts equal created and updated times", () => {
    const tables = sound()
    change(tables, "students", { updatedAt: T0 })
    expect(validateStoredRows(tables)).toEqual([])
  })
})
