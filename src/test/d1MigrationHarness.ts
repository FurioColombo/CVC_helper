import { PowerSyncDatabase, type Schema } from "@powersync/web"

import { createDatabase } from "@/persistence/db"
import {
  applyMigration,
  COURSE_TABLES,
  MIGRATIONS,
  prepareDatabase,
  runMigrations,
  type Migration,
} from "@/persistence/migrations"
import {
  validateStoredRows,
  type RowIssue,
  type StoredTables,
} from "@/persistence/rowIntegrity"
import v010 from "@/test/fixtures/v0.1.0-course.json"
import v020 from "@/test/fixtures/v0.2.0-course.json"
import v030 from "@/test/fixtures/v0.3.0-course.json"
import {
  insertFixtureTables,
  seedLegacyFixture,
  type FixtureTables,
} from "@/test/u02MigrationHarness"
import { v020Schema } from "@/test/v020Schema"
import { v030Schema } from "@/test/v030Schema"

/**
 * Browser-only proof of D1 on the real PowerSync engine: a course written by
 * 0.1.0, 0.2.0 or 0.3.0 opens through the production boundary
 * (`prepareDatabase`) with every row, id and value intact plus complete record
 * metadata and course ownership; an interruption inside a migration leaves
 * nothing half done; a migration stopped between steps completes on the next
 * open; and running the migrations again changes nothing.
 */

type Version = "0.1.0" | "0.2.0" | "0.3.0"
const FIXTURES: Record<Version, FixtureTables> = {
  "0.1.0": v010.tables as FixtureTables,
  "0.2.0": v020.tables as FixtureTables,
  "0.3.0": v030.tables as FixtureTables,
}
const SCHEMAS: Partial<Record<Version, Schema>> = {
  "0.2.0": v020Schema,
  "0.3.0": v030Schema,
}

/** Write a fixture with its own version's schema, then close the file. */
export async function seed(version: Version, filename: string) {
  if (version === "0.1.0") return seedLegacyFixture(filename)
  const legacy = new PowerSyncDatabase({
    schema: SCHEMAS[version]!,
    database: { dbFilename: filename },
  })
  await legacy.init()
  await insertFixtureTables(legacy, FIXTURES[version])
  await legacy.close()
}

async function readTables(database: PowerSyncDatabase): Promise<StoredTables> {
  const tables: StoredTables = {}
  for (const table of COURSE_TABLES) {
    tables[table] = await database.getAll(`SELECT * FROM ${table} ORDER BY id`)
  }
  return tables
}

async function ledger(database: PowerSyncDatabase) {
  return (
    await database.getAll<{ id: string }>(
      "SELECT id FROM appMeta WHERE id LIKE 'migration:%' ORDER BY id",
    )
  ).map((row) => row.id)
}

/** Every fixture value that differs in the stored row, as "table:id.column". */
function changedValues(version: Version, tables: StoredTables) {
  const changes: string[] = []
  let rows = 0
  for (const [table, fixtureRows] of Object.entries(FIXTURES[version])) {
    if (!(table in tables)) continue
    for (const original of fixtureRows) {
      rows += 1
      const stored = tables[table]!.find((row) => row.id === original.id)
      if (!stored) {
        changes.push(`${table}:${String(original.id)} missing`)
        continue
      }
      for (const [column, value] of Object.entries(original)) {
        if (stored[column] !== value) {
          changes.push(`${table}:${String(original.id)}.${column}`)
        }
      }
    }
  }
  const counts = Object.fromEntries(
    Object.entries(tables).map(([table, list]) => [table, list.length]),
  )
  return { changes, rows, counts }
}

export interface UpgradeResult {
  version: Version
  fixtureRows: number
  counts: Record<string, number>
  changedValues: string[]
  rowIssues: RowIssue[]
  ledger: string[]
  reopenedIdentical: boolean
}

/** Upgrade one fixture through `prepareDatabase`, then close and reopen it. */
export async function runUpgrade(version: Version): Promise<UpgradeResult> {
  const filename = `d1-${version}-${crypto.randomUUID()}.db`
  await seed(version, filename)

  const upgraded = createDatabase(filename)
  await prepareDatabase(upgraded)
  const after = await readTables(upgraded)
  const { changes, rows, counts } = changedValues(version, after)
  const applied = await ledger(upgraded)
  await upgraded.close()

  const reopened = createDatabase(filename)
  await prepareDatabase(reopened)
  const again = await readTables(reopened)
  await reopened.close()

  return {
    version,
    fixtureRows: rows,
    counts,
    changedValues: changes,
    rowIssues: validateStoredRows(after),
    ledger: applied,
    reopenedIdentical: JSON.stringify(after) === JSON.stringify(again),
  }
}

export interface InterruptionResult {
  rolledBackUntouched: boolean
  ledgerAfterFailure: string[]
  ledgerAfterFirstStep: string[]
  appliedOnReopen: string[]
  rowIssues: RowIssue[]
  changedValues: string[]
  secondRunApplied: string[]
  secondRunIdentical: boolean
}

/**
 * 1. A migration that fails after its first statement (the tab killed inside
 *    it) leaves the tables and the ledger exactly as they were.
 * 2. Stopped after the first step (closed between steps), the next open
 *    applies only the rest.
 * 3. A second full run applies nothing and changes nothing.
 */
export async function runInterruption(): Promise<InterruptionResult> {
  const filename = `d1-interrupted-${crypto.randomUUID()}.db`
  await seed("0.3.0", filename)

  const first = createDatabase(filename)
  await first.init()
  const before = await readTables(first)
  const crashing: Migration = {
    id: MIGRATIONS[1]!.id,
    async run(transaction, now) {
      await MIGRATIONS[1]!.run(transaction, now)
      throw new Error("interrupted inside the migration")
    },
  }
  await applyMigration(first, crashing).catch(() => undefined)
  const afterFailure = await readTables(first)
  const ledgerAfterFailure = await ledger(first)
  await applyMigration(first, MIGRATIONS[0]!)
  const ledgerAfterFirstStep = await ledger(first)
  await first.close()

  const second = createDatabase(filename)
  await second.init()
  const appliedOnReopen = await runMigrations(second)
  const migrated = await readTables(second)
  const secondRunApplied = await runMigrations(second)
  const afterSecondRun = await readTables(second)
  await second.close()

  return {
    rolledBackUntouched:
      JSON.stringify(before) === JSON.stringify(afterFailure),
    ledgerAfterFailure,
    ledgerAfterFirstStep,
    appliedOnReopen,
    rowIssues: validateStoredRows(migrated),
    changedValues: changedValues("0.3.0", migrated).changes,
    secondRunApplied,
    secondRunIdentical:
      JSON.stringify(migrated) === JSON.stringify(afterSecondRun),
  }
}

/**
 * The checklist's "migration time on a 40-student course": the 0.3.0 fixture
 * plus 40 synthetic students with an evaluation for every session, upgraded
 * through `prepareDatabase` and timed.
 */
export async function runLargeUpgrade() {
  const filename = `d1-large-${crypto.randomUUID()}.db`
  const base = FIXTURES["0.3.0"]
  const courseId = String(base.courses![0]!.id)
  const { SESSION_SEQUENCE } = await import("@/domain/config")
  const students = Array.from({ length: 40 }, (_, index) => ({
    id: `student-load-${index}`,
    courseId,
    firstName: `Nome${index}`,
    surname: `Cognome${index}`,
    nickname: null,
    dateOfBirth: null,
    declaredAgeAtCourseStart: 10 + (index % 8),
    sex: index % 2 ? "male" : "female",
    phone: null,
    size: "M",
    initialNote: null,
    courseNote: null,
    active: 1,
  }))
  const evaluations = students.flatMap((student) =>
    SESSION_SEQUENCE.map((session) => ({
      id: `evaluation-load-${student.id}-${session.id}`,
      studentId: student.id,
      sessionId: session.id,
      value: "=",
      note: null,
    })),
  )
  const legacy = new PowerSyncDatabase({
    schema: v030Schema,
    database: { dbFilename: filename },
  })
  await legacy.init()
  await insertFixtureTables(legacy, {
    ...base,
    students: [...base.students!, ...students],
    evaluations: [...base.evaluations!, ...evaluations],
  })
  await legacy.close()

  const upgraded = createDatabase(filename)
  const started = performance.now()
  await prepareDatabase(upgraded)
  const durationMs = Math.round(performance.now() - started)
  const tables = await readTables(upgraded)
  await upgraded.close()
  const rows = Object.values(tables).reduce((sum, list) => sum + list.length, 0)
  return { durationMs, rows, rowIssues: validateStoredRows(tables) }
}
