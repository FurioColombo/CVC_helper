import { readdirSync, readFileSync, statSync } from "node:fs"
import { relative, resolve } from "node:path"

import ts from "typescript"
import { describe, expect, it } from "vitest"

import { AppSchema } from "@/persistence/schema"
import { TOUCH } from "@/persistence/stamp"

/**
 * Record metadata (D1) is only as good as its weakest write, and a statement
 * that leaves it out passes every other test. So this one reads the source:
 * every string literal that holds a write (INSERT, UPDATE, REPLACE, in any
 * case, wherever it starts) must be a form it can check, and pass the check:
 * an INSERT names a table of the schema and lists its columns, `createdAt`,
 * `updatedAt` and, where the table has one, `courseId` among them; an UPDATE
 * moves `updatedAt` through `TOUCH` in its SET clause and sets neither
 * timestamp otherwise; REPLACE, which swaps the whole row and so its
 * createdAt, is allowed only where a reviewed exemption says how the row keeps
 * it. Outside src/persistence nothing writes or opens the database.
 *
 * What it cannot see is a value bound at run time (a null bound to a listed
 * column): the write paths' unit tests assert their bound values, and the
 * browser journeys check the stored rows before the app is reopened.
 */

// The repairs fill metadata themselves, on rows of any table; the switch to
// synced tables copies rows verbatim, their metadata included (B1); the ledger
// lives in `meta`, the data's own bookkeeping, not a record of a course.
const NOT_WRITE_PATHS = ["repairs.ts", "syncMode.ts"]
const UNSTAMPED_TABLES = ["meta"]
const REPLACE_EXEMPTIONS: Record<string, string> = {
  dutySettings:
    "one row per course; its INSERT OR REPLACE reads the row's own createdAt and updatedAt back in (duties.ts)",
}
const TOUCH_AS_WRITTEN = "${TOUCH}"
const MINIMUM_STATEMENTS = 15

const SCHEMA_COLUMNS = new Map(
  (
    AppSchema.toJSON() as {
      tables: Array<{ name: string; columns: Array<{ name: string }> }>
    }
  ).tables.map(({ name, columns }) => [name, columns.map((c) => c.name)]),
)

const SQL_COMMENT = /\/\*[\s\S]*?\*\/|--[^\n]*/g
const WRITE =
  /\b(?:insert\s+(?:or\s+\w+\s+)?into|replace\s+into|update\s+(?:or\s+\w+\s+)?\S+\s+set)\b/i
const INSERT =
  /^(?:insert(?:\s+or\s+(\w+))?|(replace))\s+into\s+(\w+)\s*\(([^)]*)\)\s*values\s*\(/i
const UPDATE = /^update\s+(\w+)\s+set\b([\s\S]*)$/i

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

function checkInsert(
  file: string,
  [, conflict = "", replace = "", table = "", columnList = ""]: string[],
) {
  const violations: string[] = []
  const known = SCHEMA_COLUMNS.get(table)
  if (!known)
    return [`${file}: INSERT INTO ${table}, not a table of the schema`]
  if (UNSTAMPED_TABLES.includes(table)) return []
  if (
    (replace || conflict.toLowerCase() === "replace") &&
    !(table in REPLACE_EXEMPTIONS)
  ) {
    violations.push(`${file}: REPLACE into ${table} resets its createdAt`)
  }
  const columns = columnList.split(",").map((column) => column.trim())
  const required = ["createdAt", "updatedAt"]
  if (known.includes("courseId")) required.push("courseId")
  for (const column of required) {
    if (!columns.includes(column)) {
      violations.push(`${file}: INSERT INTO ${table} lacks ${column}`)
    }
  }
  return violations
}

function checkUpdate(file: string, [, table = "", rest = ""]: string[]) {
  if (UNSTAMPED_TABLES.includes(table)) return []
  const setClause = rest.split(/\bwhere\b/i)[0]!
  const violations: string[] = []
  if (!setClause.includes(TOUCH_AS_WRITTEN) && !setClause.includes(TOUCH)) {
    violations.push(`${file}: UPDATE ${table} does not set updatedAt`)
  }
  const otherwise = setClause.replaceAll(TOUCH, "")
  if (/\b(?:createdAt|updatedAt)\s*=/i.test(otherwise)) {
    violations.push(`${file}: UPDATE ${table} sets a timestamp by hand`)
  }
  return violations
}

function checkWrites(file: string, source: string) {
  const violations: string[] = []
  let statements = 0

  for (const literal of literals(file, source)) {
    const text = literal.replace(SQL_COMMENT, " ").trim()
    if (!WRITE.test(text)) continue
    statements++
    const insert = INSERT.exec(text)
    const update = insert ? null : UPDATE.exec(text)
    if (insert) violations.push(...checkInsert(file, insert))
    else if (update) violations.push(...checkUpdate(file, update))
    else {
      // A dynamic table, no column list, INSERT … SELECT, UPDATE OR IGNORE,
      // a WITH clause: forms this check cannot read are refused, not trusted.
      violations.push(
        `${file}: unrecognised write "${text.split(/\s+/).slice(0, 4).join(" ")}"`,
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
      // Static or dynamic, by alias or relative path.
      if (/persistence\/(?:db|schema)(?:\.ts)?["']/.test(source)) {
        outside.push(`${file} imports the database or its schema`)
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
      db.execute("INSERT OR REPLACE INTO students(id, courseId, createdAt, updatedAt) VALUES (?, ?, ?, ?)")
      db.execute("REPLACE INTO dutySettings(id, courseId, createdAt, updatedAt) VALUES (?, ?, ?, ?)")
      db.execute("UPDATE boats SET availability = ? WHERE id = ?")
      db.execute("update boats set availability = ?, updatedAt = ? where id = ?")
      db.execute(\`INSERT INTO \${table}(id) VALUES (?)\`)
      db.execute("INSERT INTO boats VALUES (?, ?)")
      db.execute("INSERT INTO evaluations SELECT * FROM old")
      db.execute("UPDATE OR IGNORE boats SET availability = ?")
      db.execute("INSERT INTO meta(id, value) VALUES (?, ?)")
      db.execute("INSERT INTO courses(id, createdAt, updatedAt) VALUES (?, ?, ?)")
      db.execute(\`UPDATE students SET active = ?, \${TOUCH} WHERE id = ?\`)
      const name = "updateStudent" // not SQL: does not begin a write
      // a comment's apostrophe, as in "the row's", hides nothing:
      db.execute("UPDATE crews SET position = ? WHERE id = ?")
      db.execute("WITH s AS (SELECT 1) UPDATE boats SET availability = ?")
      db.execute("/* bulk */ UPDATE boats SET availability = ?, \${TOUCH}")
      db.execute("-- note\\nINSERT INTO volunteers(id) VALUES (?)")
      db.execute(\`UPDATE students SET createdAt = ?, \${TOUCH} WHERE id = ?\`)
      db.execute(\`UPDATE students SET active = ? WHERE id = ? AND \${TOUCH}\`)
      db.execute("INSERT INTO dutyItems(id, createdAt, updatedAt) VALUES (?, ?, ?)")
    `

    const { statements, violations } = checkWrites("sample.ts", source)

    expect(statements).toBe(21)
    expect(violations).toEqual([
      "sample.ts: INSERT INTO boats lacks createdAt",
      "sample.ts: INSERT INTO boats lacks updatedAt",
      "sample.ts: INSERT INTO faults lacks courseId",
      "sample.ts: INSERT INTO volunteers lacks createdAt",
      "sample.ts: INSERT INTO volunteers lacks updatedAt",
      "sample.ts: INSERT INTO volunteers lacks courseId",
      "sample.ts: REPLACE into students resets its createdAt",
      "sample.ts: UPDATE boats does not set updatedAt",
      "sample.ts: UPDATE boats does not set updatedAt",
      "sample.ts: UPDATE boats sets a timestamp by hand",
      'sample.ts: unrecognised write "INSERT INTO ${table}(id) VALUES"',
      'sample.ts: unrecognised write "INSERT INTO boats VALUES"',
      'sample.ts: unrecognised write "INSERT INTO evaluations SELECT"',
      'sample.ts: unrecognised write "UPDATE OR IGNORE boats"',
      "sample.ts: UPDATE crews does not set updatedAt",
      'sample.ts: unrecognised write "WITH s AS (SELECT"',
      "sample.ts: INSERT INTO volunteers lacks createdAt",
      "sample.ts: INSERT INTO volunteers lacks updatedAt",
      "sample.ts: INSERT INTO volunteers lacks courseId",
      "sample.ts: UPDATE students sets a timestamp by hand",
      "sample.ts: UPDATE students does not set updatedAt",
      "sample.ts: INSERT INTO dutyItems, not a table of the schema",
    ])
  })
})
