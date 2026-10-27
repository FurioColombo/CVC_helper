import { describe, expect, it } from "vitest"

import { AppSchema } from "@/persistence/schema"
import fixture from "@/test/fixtures/v0.3.0-course.json"
import { v030Schema } from "@/test/v030Schema"

type Rows = Array<Record<string, unknown>>
const tables = fixture.tables as Record<string, Rows>

function columnsByTable(schema: { toJSON: () => unknown }) {
  const json = schema.toJSON() as {
    tables: Array<{ name: string; columns: Array<{ name: string }> }>
  }
  return Object.fromEntries(
    json.tables.map(({ name, columns }) => [
      name,
      columns.map((column) => column.name).sort(),
    ]),
  )
}

describe("0.3.0 migration fixture", () => {
  it("is shaped by the frozen 0.3.0 schema, which lacks exactly what D1, D2 and B4 added", () => {
    const frozen = columnsByTable(v030Schema)
    const current = columnsByTable(AppSchema)

    expect(Object.keys(current).filter((table) => !(table in frozen))).toEqual([
      "dutySettingItems",
      // The backup's refused changes (B4), local to the device.
      "uploadRefusals",
      // Courses the server must still erase (B6), local to the device.
      "serverErasures",
    ])
    const added = Object.entries(frozen).flatMap(([table, columns]) =>
      current[table]!.filter((column) => !columns.includes(column)).map(
        (column) => `${table}.${column}`,
      ),
    )
    const stamped = Object.keys(frozen).filter(
      (table) => table !== "meta" && table !== "faults",
    )
    expect(added.sort()).toEqual(
      [
        ...stamped.flatMap((table) => [
          `${table}.createdAt`,
          `${table}.updatedAt`,
        ]),
        "crewMembers.courseId",
        "evaluations.courseId",
        "faults.courseId",
      ].sort(),
    )
    for (const [table, columns] of Object.entries(frozen)) {
      expect(
        columns.every((column) => current[table]!.includes(column)),
        `${table} loses no 0.3.0 column`,
      ).toBe(true)
    }

    // Every fixture row uses 0.3.0 columns only (plus the row id).
    expect(Object.keys(tables).sort()).toEqual(Object.keys(frozen).sort())
    for (const [table, rows] of Object.entries(tables)) {
      for (const row of rows) {
        const unknown = Object.keys(row).filter(
          (name) => name !== "id" && !frozen[table]!.includes(name),
        )
        expect(unknown, `${table}:${String(row.id)}`).toEqual([])
      }
    }
  })

  it("holds what 0.3.0 added: an age-only student, stored capacities and a seated volunteer", () => {
    const students = tables.students!
    expect(
      students.some(
        (student) =>
          student.dateOfBirth === null &&
          typeof student.declaredAgeAtCourseStart === "number",
      ),
    ).toBe(true)
    expect(tables.crews!.some((crew) => crew.capacity === 2)).toBe(true)
    expect(tables.crews!.some((crew) => crew.capacity === null)).toBe(true)
    expect(
      tables.crewMembers!.some((member) => member.personType === "volunteer"),
    ).toBe(true)
  })

  it("has unique ids and resolvable references", () => {
    for (const [table, rows] of Object.entries(tables)) {
      const ids = rows.map(({ id }) => id)
      expect(new Set(ids).size, `${table} ids are unique`).toBe(ids.length)
    }
    const ids = (table: string) => new Set(tables[table]!.map(({ id }) => id))
    const refs: Array<[string, string, string]> = [
      ["students", "courseId", "courses"],
      ["boats", "courseId", "courses"],
      ["faults", "boatId", "boats"],
      ["crews", "courseId", "courses"],
      ["crewMembers", "crewId", "crews"],
      ["evaluations", "studentId", "students"],
      ["landAssignments", "studentId", "students"],
      ["sessionBoats", "boatId", "boats"],
      ["dutyAssignments", "studentId", "students"],
    ]
    for (const [table, column, target] of refs) {
      const known = ids(target)
      for (const row of tables[table]!) {
        expect(known.has(row[column]), `${table}.${column}`).toBe(true)
      }
    }
  })
})
