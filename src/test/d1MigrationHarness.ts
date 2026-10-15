import { PowerSyncDatabase, type Schema } from "@powersync/web"

import { DUTY_SETTING_LISTS, SESSION_SEQUENCE } from "@/domain/config"
import {
  applyMigration,
  prepareDatabase,
  runMigrations,
  type Migration,
} from "@/persistence/migrations"
import { repairRows } from "@/persistence/repairs"
import {
  validateStoredRows,
  type RowIssue,
  type StoredTables,
} from "@/persistence/rowIntegrity"
import { AppSchema, COURSE_TABLES, createDatabase } from "@/persistence/schema"
import v010 from "@/test/fixtures/v0.1.0-course.json"
import v020 from "@/test/fixtures/v0.2.0-course.json"
import v030 from "@/test/fixtures/v0.3.0-course.json"
import {
  insertFixtureTables,
  seedLegacyFixture,
  type FixtureTables,
} from "@/test/legacySeed"
import { v020Schema } from "@/test/v020Schema"
import { v030Schema } from "@/test/v030Schema"

/**
 * Browser-only proof of D1 on the real PowerSync engine: a course written by
 * 0.1.0, 0.2.0 or 0.3.0 opens through the production boundary
 * (`prepareDatabase`) with every row, id and value intact plus complete record
 * metadata and course ownership; an interruption inside the repairs or a
 * migration leaves nothing half done; the migration ledger survives an older
 * app opening the same database, and the repairs restore what that app strips
 * or leaves out.
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
type EngineEvent = {
  type:
    | "cache-miss"
    | "cache-hit"
    | "compile-start"
    | "compile-complete"
    | "instance-created"
    | "fallback"
    | "error"
  workerId: string
  moduleKey: string
  instanceId?: string
  elapsedMs?: number
}

function pageEngineEvents() {
  if (typeof window === "undefined" || !import.meta.env.DEV) {
    return undefined
  }
  // Allocate the recorder before the first worker request. This records no
  // engine event and performs no fetch, compile, construction or prewarming.
  const diagnosticWindow = window as Window & {
    __CVC_ENGINE_DIAGNOSTIC__?: EngineEvent[]
  }
  return (diagnosticWindow.__CVC_ENGINE_DIAGNOSTIC__ ??= [])
}

/** Write a fixture with its own version's schema, then close the file. */
export async function seed(
  version: Version,
  filename: string,
  tables: FixtureTables = FIXTURES[version],
) {
  if (version === "0.1.0") return seedLegacyFixture(filename)
  const legacy = new PowerSyncDatabase({
    schema: SCHEMAS[version]!,
    database: { dbFilename: filename },
  })
  await legacy.init()
  await insertFixtureTables(legacy, tables)
  // Read before closing: closing straight after a write lost WebKit's test
  // page now and then (D2 review DP-4).
  await legacy.get("SELECT count(*) AS count FROM courses")
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
  return database.getAll<{ id: string; value: number }>(
    "SELECT id, value FROM meta WHERE id LIKE 'migration:%' ORDER BY id",
  )
}

async function probes(database: PowerSyncDatabase) {
  return (
    await database.getAll<{ id: string }>(
      "SELECT id FROM meta WHERE id LIKE 'probe:%' ORDER BY id",
    )
  ).map((row) => row.id)
}

/**
 * Synthetic migrations: the shipped list is empty until D2, and the ledger is
 * proved on the real engine all the same. Each leaves a `probe:` row in `meta`
 * so a test can count how often it ran.
 */
const probeMigration = (name: string): Migration => ({
  id: `test-${name}`,
  async run(transaction) {
    await transaction.execute("INSERT INTO meta(id, value) VALUES (?, ?)", [
      `probe:${name}`,
      1,
    ])
  },
})

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
  await upgraded.close()

  // The repairs run again on every open; on upgraded rows they change nothing.
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
    reopenedIdentical: JSON.stringify(after) === JSON.stringify(again),
  }
}

export interface InterruptionResult {
  repairsRolledBack: boolean
  migrationRolledBack: boolean
  ledgerAfterFailure: string[]
  probesAfterFailure: string[]
  ledgerAfterReopen: string[]
  ledgerValuesAreTimes: boolean
  probesAfterReopen: string[]
  rowIssues: RowIssue[]
  changedValues: string[]
  secondRunApplied: string[]
  secondRunIdentical: boolean
}

/**
 * 1. The repairs, interrupted after they have run but before their
 *    transaction commits (the tab killed), leave every table as it was.
 * 2. A migration interrupted the same way, after writing course data and its
 *    probe, leaves both and its ledger row unwritten; the migration before it
 *    stays applied.
 * 3. The next open applies only the interrupted one; a second run applies
 *    nothing and changes nothing.
 */
export async function runInterruption(): Promise<InterruptionResult> {
  const filename = `d1-interrupted-${crypto.randomUUID()}.db`
  await seed("0.3.0", filename)
  const first = probeMigration("first")
  const second = probeMigration("second")
  const crashing: Migration = {
    id: second.id,
    async run(transaction, now) {
      await transaction.execute("UPDATE students SET courseNote = 'a metà'")
      await second.run(transaction, now)
      throw new Error("interrupted inside the migration")
    },
  }

  const before = createDatabase(filename)
  await before.init()
  const untouched = await readTables(before)
  await before
    .writeTransaction(async (transaction) => {
      await repairRows(transaction, new Date().toISOString())
      throw new Error("interrupted inside the repairs")
    })
    .catch(() => undefined)
  const afterRepairCrash = await readTables(before)
  await applyMigration(before, first)
  await applyMigration(before, crashing).catch(() => undefined)
  const afterMigrationCrash = await readTables(before)
  const ledgerAfterFailure = (await ledger(before)).map((row) => row.id)
  const probesAfterFailure = await probes(before)
  await before.close()

  const reopened = createDatabase(filename)
  await prepareDatabase(reopened, [first, second])
  const migrated = await readTables(reopened)
  const ledgerAfterReopen = await ledger(reopened)
  const probesAfterReopen = await probes(reopened)
  const secondRunApplied = await runMigrations(reopened, [first, second])
  const afterSecondRun = await readTables(reopened)
  await reopened.close()

  return {
    repairsRolledBack:
      JSON.stringify(untouched) === JSON.stringify(afterRepairCrash),
    migrationRolledBack:
      JSON.stringify(untouched) === JSON.stringify(afterMigrationCrash),
    ledgerAfterFailure,
    probesAfterFailure,
    ledgerAfterReopen: ledgerAfterReopen.map((row) => row.id),
    ledgerValuesAreTimes: ledgerAfterReopen.every(
      (row) => Number.isInteger(row.value) && row.value > Date.UTC(2026, 0),
    ),
    probesAfterReopen,
    rowIssues: validateStoredRows(migrated),
    changedValues: changedValues("0.3.0", migrated).changes,
    secondRunApplied,
    secondRunIdentical:
      JSON.stringify(migrated) === JSON.stringify(afterSecondRun),
  }
}

export interface OlderAppResult {
  ledgerKept: boolean
  probesAfterReopen: string[]
  strippedByOlderApp: string[]
  rowIssues: RowIssue[]
  olderAppStudent: Record<string, unknown>
  untouchedStudentKeptCreatedAt: boolean
  olderAppEvaluation: Record<string, unknown>
  courseId: string
}

/**
 * 03 §3.1: a phone that still runs 0.3.0 opens the database after 0.4.0
 * upgraded it, deactivates a student and saves an evaluation with 0.3.0's own
 * statements. Its schema drops the views' new columns, so the student row loses
 * its metadata and the evaluation is stored without course or metadata. The
 * ledger, in `meta`, which 0.3.0 also declares, survives, so no migration runs
 * twice; the next 0.4.0 open repairs both rows.
 */
export async function runOlderAppAfterUpgrade(): Promise<OlderAppResult> {
  const filename = `d1-older-app-${crypto.randomUUID()}.db`
  await seed("0.3.0", filename)
  const course = String(FIXTURES["0.3.0"].courses![0]!.id)
  const migration = probeMigration("once")

  const upgraded = createDatabase(filename)
  await prepareDatabase(upgraded, [migration])
  const beforeOlderApp = await readTables(upgraded)
  await upgraded.close()

  const older = new PowerSyncDatabase({
    schema: v030Schema,
    database: { dbFilename: filename },
  })
  await older.init()
  await older.execute(
    "UPDATE students SET active = ? WHERE id = ? AND courseId = ?",
    [0, "student-v030-paolo", course],
  )
  await older.execute(
    "INSERT INTO evaluations(id, studentId, sessionId, value, note) VALUES (?, ?, ?, ?, ?)",
    ["evaluation-older-app", "student-v030-marta", "mon-am", "+", null],
  )
  const stripped = await older.getAll<{ id: string; data: string }>(
    "SELECT id, data FROM ps_data_local__students WHERE id = ?",
    ["student-v030-paolo"],
  )
  await older.close()

  const reopened = createDatabase(filename)
  await prepareDatabase(reopened, [migration])
  const repaired = await readTables(reopened)
  const ledgerAfter = await ledger(reopened)
  const probesAfterReopen = await probes(reopened)
  await reopened.close()

  const student = (tables: StoredTables, id: string) =>
    tables.students!.find((row) => row.id === id)!
  return {
    ledgerKept: ledgerAfter.some((row) => row.id === "migration:test-once"),
    probesAfterReopen,
    strippedByOlderApp: ["createdAt", "updatedAt"].filter(
      (column) => !(column in JSON.parse(stripped[0]!.data)),
    ),
    rowIssues: validateStoredRows(repaired),
    olderAppStudent: student(repaired, "student-v030-paolo"),
    untouchedStudentKeptCreatedAt:
      student(repaired, "student-v030-sara").createdAt ===
      student(beforeOlderApp, "student-v030-sara").createdAt,
    olderAppEvaluation: repaired.evaluations!.find(
      (row) => row.id === "evaluation-older-app",
    )!,
    courseId: course,
  }
}

export interface LegacyRepairResult {
  rowIssues: RowIssue[]
  disorderedFault: Record<string, unknown>
  orphanFault: Record<string, unknown>
  courseId: string
}

/**
 * Two states older versions can leave and the repairs settle: a 0.2.0 fault
 * updated with the clock set back (updatedAt before createdAt) and a fault
 * whose boat is gone (UG2-DAT-7's race), which takes the device's one course
 * and is still reported as an orphan.
 */
export async function runLegacyRepairs(): Promise<LegacyRepairResult> {
  const filename = `d1-legacy-repairs-${crypto.randomUUID()}.db`
  const tables = structuredClone(FIXTURES["0.2.0"])
  tables.faults = tables.faults!.map((fault) =>
    fault.id === "fault-v020-quest-12-reported"
      ? {
          ...fault,
          createdAt: "2026-09-19T10:00:00.000Z",
          updatedAt: "2026-09-19T09:00:00.000Z",
        }
      : fault,
  )
  tables.faults.push({
    id: "fault-v020-orphan",
    boatId: "boat-v020-gone",
    description: "Timone incrinato",
    state: "open",
    createdAt: "2026-09-19T08:10:00.000Z",
    updatedAt: "2026-09-19T08:10:00.000Z",
  })
  await seed("0.2.0", filename, tables)

  const upgraded = createDatabase(filename)
  await prepareDatabase(upgraded)
  const repaired = await readTables(upgraded)
  await upgraded.close()

  const fault = (id: string) => repaired.faults!.find((row) => row.id === id)!
  return {
    rowIssues: validateStoredRows(repaired),
    disorderedFault: fault("fault-v020-quest-12-reported"),
    orphanFault: fault("fault-v020-orphan"),
    courseId: String(tables.courses![0]!.id),
  }
}

function largeUpgradeFixture() {
  const base = FIXTURES["0.3.0"]
  const courseId = String(base.courses![0]!.id)
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
  const expectedTables: FixtureTables = {
    ...base,
    students: [...base.students!, ...students],
    evaluations: [...base.evaluations!, ...evaluations],
  }
  // D2 repairs materialize one row per distinct value in each canonical list.
  const expectedDutySettingItemRows = (base.dutySettings ?? []).reduce(
    (total, setting) =>
      total +
      DUTY_SETTING_LISTS.reduce((listTotal, { field }) => {
        const values = JSON.parse(String(setting[field] ?? "[]")) as unknown[]
        return listTotal + new Set(values).size
      }, 0),
    0,
  )
  const expectedRows = COURSE_TABLES.reduce(
    (total, table) =>
      total +
      (table === "dutySettingItems"
        ? expectedDutySettingItemRows
        : (expectedTables[table]?.length ?? 0)),
    0,
  )
  return { base, students, evaluations, expectedTables, expectedRows }
}

/** Seed the large legacy database without constructing the candidate app DB. */
export async function seedLargeUpgrade() {
  const filename = `d1-large-${crypto.randomUUID()}.db`
  const { base, students, evaluations } = largeUpgradeFixture()
  await seed("0.3.0", filename, {
    ...base,
    students: [...base.students!, ...students],
    evaluations: [...base.evaluations!, ...evaluations],
  })
  return filename
}

/**
 * The checklist's "migration time on a 40-student course": the 0.3.0 fixture
 * plus 40 synthetic students with an evaluation for every session, upgraded
 * through `prepareDatabase` and timed, then opened again and timed, since the
 * repairs' probe runs on every open. `firstStartedAt` lets a cold-start probe
 * include the dynamic import of this harness in the first construction bound.
 */
export async function measureLargeUpgrade(
  filename: string,
  firstStartedAt?: number,
  suppliedEngineEvents?: EngineEvent[],
) {
  const { students, evaluations, expectedRows } = largeUpgradeFixture()
  const engineEvents = suppliedEngineEvents ?? pageEngineEvents()
  const timedOpen = async () => {
    // Start before construction so the five-second bound includes the full
    // cold-open path. Keep the result reads and close outside that bound.
    const started = firstStartedAt ?? performance.now()
    firstStartedAt = undefined
    const constructed = performance.now()
    const database = createDatabase(filename)
    const created = performance.now()
    const adapterInitStarted = performance.now()
    // PowerSync starts this adapter open from its constructor. Awaiting the
    // same promise used by its normal init path lets the report separate the
    // WA-SQLite worker/VFS open from the remaining SDK readiness work.
    const adapter = database.database as unknown as {
      init: () => Promise<void>
    }
    await adapter.init()
    const adapterReady = performance.now()
    await database.init()
    const initialized = performance.now()
    await prepareDatabase(database)
    const prepared = performance.now()
    const durationMs = Math.round(prepared - started)
    const createDatabaseMs = Math.round(created - constructed)
    const initMs = Math.round(initialized - created)
    const prepareAfterInitMs = Math.round(prepared - initialized)
    const readStarted = performance.now()
    const tables = await readTables(database)
    const readTablesMs = Math.round(performance.now() - readStarted)
    const closeStarted = performance.now()
    await database.close()
    const closeMs = Math.round(performance.now() - closeStarted)
    return {
      durationMs,
      createDatabaseMs,
      initMs,
      adapterInitMs: Math.round(adapterReady - adapterInitStarted),
      sdkReadyAfterAdapterMs: Math.round(initialized - adapterReady),
      prepareAfterInitMs,
      readTablesMs,
      closeMs,
      tables,
    }
  }
  const priorEventCount = engineEvents?.length ?? 0
  const upgrade = await timedOpen()
  // Every later open probes for rows to repair; sound data costs one read.
  const reopen = await timedOpen()
  const rows = Object.values(upgrade.tables).reduce(
    (sum, list) => sum + list.length,
    0,
  )
  const reopenRows = Object.values(reopen.tables).reduce(
    (sum, list) => sum + list.length,
    0,
  )
  const injectedStudentRows = upgrade.tables.students!.filter((row) =>
    String(row.id).startsWith("student-load-"),
  ).length
  const reopenInjectedStudentRows = reopen.tables.students!.filter((row) =>
    String(row.id).startsWith("student-load-"),
  ).length
  const injectedEvaluationRows = upgrade.tables.evaluations!.filter((row) =>
    String(row.id).startsWith("evaluation-load-"),
  ).length
  const reopenInjectedEvaluationRows = reopen.tables.evaluations!.filter(
    (row) => String(row.id).startsWith("evaluation-load-"),
  ).length
  return {
    durationMs: upgrade.durationMs,
    createDatabaseMs: upgrade.createDatabaseMs,
    initMs: upgrade.initMs,
    adapterInitMs: upgrade.adapterInitMs,
    sdkReadyAfterAdapterMs: upgrade.sdkReadyAfterAdapterMs,
    prepareAfterInitMs: upgrade.prepareAfterInitMs,
    readTablesMs: upgrade.readTablesMs,
    closeMs: upgrade.closeMs,
    reopenMs: reopen.durationMs,
    reopenCreateDatabaseMs: reopen.createDatabaseMs,
    reopenInitMs: reopen.initMs,
    reopenAdapterInitMs: reopen.adapterInitMs,
    reopenSdkReadyAfterAdapterMs: reopen.sdkReadyAfterAdapterMs,
    reopenPrepareAfterInitMs: reopen.prepareAfterInitMs,
    reopenReadTablesMs: reopen.readTablesMs,
    reopenCloseMs: reopen.closeMs,
    expectedRows,
    expectedInjectedStudentRows: students.length,
    injectedStudentRows,
    reopenInjectedStudentRows,
    expectedInjectedEvaluationRows: evaluations.length,
    injectedEvaluationRows,
    reopenInjectedEvaluationRows,
    rows,
    reopenRows,
    rowIssues: validateStoredRows(upgrade.tables),
    reopenRowIssues: validateStoredRows(reopen.tables),
    reopenedIdentical:
      JSON.stringify(upgrade.tables) === JSON.stringify(reopen.tables),
    engineEvents: engineEvents ? [...engineEvents] : undefined,
    priorEventCount: engineEvents ? priorEventCount : undefined,
  }
}

/** Preserve the existing D1 harness entry point and its timing boundaries. */
export async function runLargeUpgrade(engineEvents?: EngineEvent[]) {
  const filename = await seedLargeUpgrade()
  return measureLargeUpgrade(filename, undefined, engineEvents)
}

/** Exercise close, an independent write, reopen, and reset on one IDB name. */
export async function verifyLargeUpgradeLifecycle(filename: string) {
  const markerId = "probe:d3-startup-marker"
  const independent = new PowerSyncDatabase({
    schema: AppSchema,
    database: { dbFilename: filename },
  })
  await independent.init()
  await independent.execute(
    "INSERT OR REPLACE INTO meta(id, value) VALUES (?, ?)",
    [markerId, 73],
  )
  await independent.get("SELECT count(*) AS count FROM meta WHERE id = ?", [
    markerId,
  ])
  await independent.close()

  const reopened = createDatabase(filename)
  await prepareDatabase(reopened)
  const marker = await reopened.get<{ value: number }>(
    "SELECT value FROM meta WHERE id = ?",
    [markerId],
  )
  const reopenedTables = await readTables(reopened)
  await reopened.close()

  await deleteIndexedDb(filename)
  const reset = createDatabase(filename)
  await reset.init()
  const oldTablesAfterReset = await readTables(reset)
  const oldRowsAfterReset = Object.values(oldTablesAfterReset).reduce(
    (sum, rows) => sum + rows.length,
    0,
  )
  await reset.execute("INSERT OR REPLACE INTO meta(id, value) VALUES (?, ?)", [
    "probe:d3-startup-reset",
    97,
  ])
  await reset.get("SELECT count(*) AS count FROM meta")
  await reset.close()

  const resetReopened = createDatabase(filename)
  await resetReopened.init()
  const resetMarker = await resetReopened.get<{ value: number }>(
    "SELECT value FROM meta WHERE id = ?",
    ["probe:d3-startup-reset"],
  )
  const resetTables = await readTables(resetReopened)
  const resetRows = Object.values(resetTables).reduce(
    (sum, rows) => sum + rows.length,
    0,
  )
  await resetReopened.close()
  await deleteIndexedDb(filename)

  return {
    markerObservedAfterIndependentWrite: marker?.value === 73,
    reopenedRows: Object.values(reopenedTables).reduce(
      (sum, rows) => sum + rows.length,
      0,
    ),
    reopenedRowIssues: validateStoredRows(reopenedTables),
    oldRowsAfterReset,
    resetMarkerObserved: resetMarker?.value === 97,
    resetRows,
    indexedDbDeleteUnblocked: true,
  }
}

function deleteIndexedDb(name: string) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    const timeout = setTimeout(
      () => reject(new Error(`Timed out deleting IndexedDB database ${name}`)),
      5_000,
    )
    request.onsuccess = () => {
      clearTimeout(timeout)
      resolve()
    }
    request.onerror = () => {
      clearTimeout(timeout)
      reject(request.error ?? new Error(`Could not delete IndexedDB ${name}`))
    }
    request.onblocked = () => {
      clearTimeout(timeout)
      reject(new Error(`IndexedDB database ${name} remained open after close`))
    }
  })
}
