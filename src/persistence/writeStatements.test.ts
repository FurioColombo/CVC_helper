import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { TOUCH } from "@/persistence/stamp"

/**
 * Record metadata (D1) is only as good as its weakest write, and a statement
 * that leaves it out passes every other test. So this one reads the source of
 * the persistence layer: each INSERT lists `createdAt` and `updatedAt` (and
 * `courseId` on the tables that name their course directly), and each UPDATE
 * moves `updatedAt` through `TOUCH`. It needs no database.
 */

// migrations.ts is not a write path of the app: its UPDATEs backfill rows that
// predate the metadata, and its ledger insert goes to `appMeta`.
const NOT_WRITE_PATHS = ["migrations.ts"]
// The data's own bookkeeping (the migration ledger), not a record of a course.
const UNSTAMPED_TABLES = ["appMeta"]
const COURSE_NAMING_TABLES = ["faults", "crewMembers", "evaluations"]
const TOUCH_AS_WRITTEN = "${TOUCH}"
const MINIMUM_STATEMENTS = 15

const INSERT =
  /\b(?:INSERT(?:\s+OR\s+\w+)?|REPLACE)\s+INTO\s+(\w+)\s*\(([^)]*)\)/g
// A SET clause runs to the end of its string literal.
const UPDATE = /\bUPDATE\s+(\w+)\s+SET\b([^`"]*)/g
// A table name the scan cannot read is a statement the scan cannot check.
const DYNAMIC_TABLE =
  /\b(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE)\s+\$\{/g

function checkWrites(file: string, source: string) {
  const violations: string[] = []
  let statements = 0

  for (const [, table = "", columnList = ""] of source.matchAll(INSERT)) {
    if (UNSTAMPED_TABLES.includes(table)) continue
    statements++
    const columns = columnList.split(",").map((column) => column.trim())
    const required = ["createdAt", "updatedAt"]
    if (COURSE_NAMING_TABLES.includes(table)) required.push("courseId")
    for (const column of required) {
      if (!columns.includes(column)) {
        violations.push(`${file}: INSERT INTO ${table} lacks ${column}`)
      }
    }
  }

  for (const [, table = "", setClause = ""] of source.matchAll(UPDATE)) {
    if (UNSTAMPED_TABLES.includes(table)) continue
    statements++
    if (!setClause.includes(TOUCH_AS_WRITTEN) && !setClause.includes(TOUCH)) {
      violations.push(`${file}: UPDATE ${table} does not set updatedAt`)
    }
  }

  for (const [match] of source.matchAll(DYNAMIC_TABLE)) {
    violations.push(`${file}: "${match}" names its table dynamically`)
  }

  return { statements, violations }
}

describe("persistence write statements", () => {
  it("stamp every inserted and updated record", () => {
    const folder = import.meta.dirname
    const files = readdirSync(folder).filter(
      (name) =>
        name.endsWith(".ts") &&
        !name.endsWith(".test.ts") &&
        !NOT_WRITE_PATHS.includes(name),
    )
    let statements = 0
    const violations: string[] = []
    for (const file of files) {
      const source = readFileSync(resolve(folder, file), "utf8")
      const checked = checkWrites(file, source)
      statements += checked.statements
      violations.push(...checked.violations)
    }

    // A broken pattern must not pass by finding nothing.
    expect(statements).toBeGreaterThanOrEqual(MINIMUM_STATEMENTS)
    expect(violations).toEqual([])
  })

  it("flags a write that leaves the metadata out", () => {
    const source = `
      db.execute("INSERT INTO boats(id, courseId) VALUES (?, ?)")
      db.execute(\`INSERT INTO faults(
        id, boatId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?)\`)
      db.execute("INSERT OR REPLACE INTO dutySettings(id, createdAt) VALUES (?, ?)")
      db.execute("UPDATE boats SET availability = ? WHERE id = ?")
      db.execute("UPDATE boats SET availability = ?, updatedAt = ? WHERE id = ?")
      db.execute(\`INSERT INTO \${table}(id) VALUES (?)\`)
      db.execute("INSERT INTO appMeta(id, value) VALUES (?, ?)")
      db.execute("INSERT INTO students(id, createdAt, updatedAt) VALUES (?, ?, ?)")
      db.execute(\`UPDATE students SET active = ?, \${TOUCH} WHERE id = ?\`)
    `

    const { statements, violations } = checkWrites("sample.ts", source)

    // The ledger table is skipped and the dynamic one cannot be read.
    expect(statements).toBe(7)
    expect(violations).toEqual([
      "sample.ts: INSERT INTO boats lacks createdAt",
      "sample.ts: INSERT INTO boats lacks updatedAt",
      "sample.ts: INSERT INTO faults lacks courseId",
      "sample.ts: INSERT INTO dutySettings lacks updatedAt",
      "sample.ts: UPDATE boats does not set updatedAt",
      "sample.ts: UPDATE boats does not set updatedAt",
      'sample.ts: "INSERT INTO ${" names its table dynamically',
    ])
  })
})
