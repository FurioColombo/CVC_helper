import { readdirSync, readFileSync, statSync } from "node:fs"
import { relative, resolve } from "node:path"

import ts from "typescript"
import { describe, expect, it } from "vitest"

import { TOUCH } from "@/persistence/stamp"

/**
 * Record metadata (D1) is only as good as its weakest write, and a statement
 * that leaves it out passes every other test. So this one reads the source:
 * every string literal that begins a write (INSERT, UPDATE, REPLACE, in any
 * case) must be a form it can check, and pass the check: an INSERT lists its
 * columns, `createdAt` and `updatedAt` among them (and `courseId` on the tables
 * that name their course directly); an UPDATE moves `updatedAt` through
 * `TOUCH`; REPLACE, which swaps the whole row and so its createdAt, is allowed
 * only where a reviewed exemption says how the row keeps it. Outside
 * src/persistence nothing writes or opens the database.
 */

// The repair and migration steps fill or move metadata themselves; the ledger
// lives in `meta`, the data's own bookkeeping, not a record of a course.
const NOT_WRITE_PATHS = ["migrations.ts"]
const UNSTAMPED_TABLES = ["meta"]
const COURSE_NAMING_TABLES = ["faults", "crewMembers", "evaluations"]
const REPLACE_EXEMPTIONS: Record<string, string> = {
  dutySettings:
    "one row per course; its INSERT OR REPLACE reads the row's own createdAt and updatedAt back in (duties.ts)",
}
const TOUCH_AS_WRITTEN = "${TOUCH}"
const MINIMUM_STATEMENTS = 15

const WRITE_START = /^\s*(insert|update|replace)\b/i
const INSERT =
  /^\s*(?:insert(?:\s+or\s+(\w+))?|(replace))\s+into\s+(\w+)\s*\(([^)]*)\)\s*values\s*\(/i
const UPDATE = /^\s*update\s+(\w+)\s+set\b([\s\S]*)$/i

/**
 * Every string and template literal, read by the TypeScript parser so that a
 * quote in a comment or a nested template cannot hide one; a template keeps
 * its `${...}` placeholders as written.
 */
function literals(file: string, source: string) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
  )
  const texts: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      texts.push(node.text)
    } else if (ts.isTemplateExpression(node)) {
      texts.push(node.getText(sourceFile).slice(1, -1))
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return texts
}

function checkWrites(file: string, source: string) {
  const violations: string[] = []
  let statements = 0

  for (const text of literals(file, source)) {
    if (!WRITE_START.test(text)) continue
    statements++
    const insert = INSERT.exec(text)
    const update = insert ? null : UPDATE.exec(text)
    if (insert) {
      const [, conflict = "", replace = "", table = "", columnList = ""] =
        insert
      if (UNSTAMPED_TABLES.includes(table)) continue
      if (
        (replace || conflict.toLowerCase() === "replace") &&
        !(table in REPLACE_EXEMPTIONS)
      ) {
        violations.push(`${file}: REPLACE into ${table} resets its createdAt`)
      }
      const columns = columnList.split(",").map((column) => column.trim())
      const required = ["createdAt", "updatedAt"]
      if (COURSE_NAMING_TABLES.includes(table)) required.push("courseId")
      for (const column of required) {
        if (!columns.includes(column)) {
          violations.push(`${file}: INSERT INTO ${table} lacks ${column}`)
        }
      }
    } else if (update) {
      const [, table = "", setClause = ""] = update
      if (UNSTAMPED_TABLES.includes(table)) continue
      if (!setClause.includes(TOUCH_AS_WRITTEN) && !setClause.includes(TOUCH)) {
        violations.push(`${file}: UPDATE ${table} does not set updatedAt`)
      }
    } else {
      // A dynamic table, no column list, INSERT … SELECT, UPDATE OR IGNORE:
      // forms this check cannot read are refused rather than trusted.
      violations.push(
        `${file}: unrecognised write "${text.trim().split(/\s+/).slice(0, 4).join(" ")}"`,
      )
    }
  }
  return { statements, violations }
}

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = resolve(folder, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe("persistence write statements", () => {
  const persistence = import.meta.dirname
  const src = resolve(persistence, "..")

  it("stamp every inserted and updated record", () => {
    let statements = 0
    const violations: string[] = []
    for (const path of sourceFiles(persistence)) {
      const file = relative(persistence, path)
      if (NOT_WRITE_PATHS.includes(file)) continue
      const checked = checkWrites(file, readFileSync(path, "utf8"))
      statements += checked.statements
      violations.push(...checked.violations)
    }
    // A broken pattern must not pass by finding nothing.
    expect(statements).toBeGreaterThanOrEqual(MINIMUM_STATEMENTS)
    expect(violations).toEqual([])
  })

  it("leave writes and the database to src/persistence (test harnesses aside)", () => {
    const outside: string[] = []
    for (const path of sourceFiles(src)) {
      const file = relative(src, path).replaceAll("\\", "/")
      if (file.startsWith("persistence/") || file.startsWith("test/")) continue
      const source = readFileSync(path, "utf8")
      if (/from\s+["']@\/persistence\/db["']/.test(source)) {
        outside.push(`${file} imports the database`)
      }
      if (checkWrites(file, source).statements > 0) {
        outside.push(`${file} holds a write statement`)
      }
    }
    expect(outside).toEqual([])
  })

  it("flags writes that leave the metadata out or cannot be read", () => {
    const source = `
      db.execute("INSERT INTO boats(id, courseId) VALUES (?, ?)")
      db.execute(\`INSERT INTO faults(
        id, boatId, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?)\`)
      db.execute("insert into volunteers(id, name) values (?, ?)")
      db.execute("INSERT OR REPLACE INTO students(id, createdAt, updatedAt) VALUES (?, ?, ?)")
      db.execute("REPLACE INTO dutySettings(id, createdAt, updatedAt) VALUES (?, ?, ?)")
      db.execute("UPDATE boats SET availability = ? WHERE id = ?")
      db.execute("update boats set availability = ?, updatedAt = ? where id = ?")
      db.execute(\`INSERT INTO \${table}(id) VALUES (?)\`)
      db.execute("INSERT INTO boats VALUES (?, ?)")
      db.execute("INSERT INTO evaluations SELECT * FROM old")
      db.execute("UPDATE OR IGNORE boats SET availability = ?")
      db.execute("INSERT INTO meta(id, value) VALUES (?, ?)")
      db.execute("INSERT INTO students(id, createdAt, updatedAt) VALUES (?, ?, ?)")
      db.execute(\`UPDATE students SET active = ?, \${TOUCH} WHERE id = ?\`)
      const name = "updateStudent" // not SQL: does not begin a write
      // a comment's apostrophe, as in "the row's", hides nothing:
      db.execute("UPDATE crews SET position = ? WHERE id = ?")
    `

    const { statements, violations } = checkWrites("sample.ts", source)

    expect(statements).toBe(15)
    expect(violations).toEqual([
      "sample.ts: INSERT INTO boats lacks createdAt",
      "sample.ts: INSERT INTO boats lacks updatedAt",
      "sample.ts: INSERT INTO faults lacks courseId",
      "sample.ts: INSERT INTO volunteers lacks createdAt",
      "sample.ts: INSERT INTO volunteers lacks updatedAt",
      "sample.ts: REPLACE into students resets its createdAt",
      "sample.ts: UPDATE boats does not set updatedAt",
      "sample.ts: UPDATE boats does not set updatedAt",
      'sample.ts: unrecognised write "INSERT INTO ${table}(id) VALUES"',
      'sample.ts: unrecognised write "INSERT INTO boats VALUES"',
      'sample.ts: unrecognised write "INSERT INTO evaluations SELECT"',
      'sample.ts: unrecognised write "UPDATE OR IGNORE boats"',
      "sample.ts: UPDATE crews does not set updatedAt",
    ])
  })
})
