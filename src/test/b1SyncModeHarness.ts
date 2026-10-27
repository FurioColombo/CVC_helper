import { PowerSyncDatabase } from "@powersync/web"

import { APP_VERSION } from "@/appVersion"
import { dataAccess, parseVersion } from "@/domain/compatibility"
import { readDataVersion } from "@/persistence/dataVersion"
import { MIGRATIONS, prepareDatabase } from "@/persistence/migrations"
import { AppSchema, COURSE_TABLES, createDatabase } from "@/persistence/schema"
import {
  inactiveLocalView,
  readSyncMode,
  switchToSyncedTables,
  syncModeHint,
  syncedTableName,
} from "@/persistence/syncMode"
import { guardWrites, ReadOnlyDataError } from "@/persistence/writeGuard"
import { seed } from "@/test/d1MigrationHarness"

/**
 * B1: the switch to synced tables on real browser databases, from the 0.1.0,
 * 0.2.0 and 0.3.0 fixtures and from a 0.4.0 course (the 0.3.0 fixture opened
 * once in local mode), then a reopen and an older 0.4.0 app.
 */
export type Origin = "0.1.0" | "0.2.0" | "0.3.0" | "0.4.0"

type Tables = Record<string, Array<Record<string, unknown>>>

async function readTables(database: PowerSyncDatabase): Promise<Tables> {
  const tables: Tables = {}
  for (const table of COURSE_TABLES) {
    tables[table] = await database.getAll(
      `SELECT * FROM "${table}" ORDER BY id`,
    )
  }
  return tables
}

async function queued(database: PowerSyncDatabase) {
  const rows = await database.getAll<{ data: string }>(
    "SELECT data FROM ps_crud ORDER BY id",
  )
  return rows.map(
    (row) => JSON.parse(row.data) as { op: string; type: string; id: string },
  )
}

async function localCopyRows(database: PowerSyncDatabase) {
  let rows = 0
  for (const table of COURSE_TABLES) {
    const [count] = await database.getAll<{ n: number }>(
      `SELECT count(*) AS n FROM "${inactiveLocalView(table)}"`,
    )
    rows += count?.n ?? 0
  }
  return rows
}

const count = (tables: Tables) =>
  Object.values(tables).reduce((sum, rows) => sum + rows.length, 0)

async function openApp(filename: string, hintKey: string) {
  const database = guardWrites(createDatabase(filename))
  await prepareDatabase(database, MIGRATIONS, APP_VERSION, hintKey)
  return database
}

export async function runSwitch(origin: Origin) {
  const filename = `b1-${origin}-${crypto.randomUUID()}.db`
  const hintKey = `b1-hint-${crypto.randomUUID()}`
  await seed(origin === "0.4.0" ? "0.3.0" : origin, filename)
  if (origin === "0.4.0") {
    // A real 0.4.0 device: the 0.3.0 course upgraded and claimed by 0.4.0
    // itself, so its record says 0.4.0 / 0.3.0 (B1 review DP-B1-Q1).
    const older = guardWrites(createDatabase(filename), parseVersion("0.4.0"))
    await prepareDatabase(older, MIGRATIONS, parseVersion("0.4.0"), hintKey)
    await older.close()
  }
  const originRecord = await (async () => {
    const reader = createDatabase(filename)
    await reader.init()
    const record = await readDataVersion(reader)
    await reader.close()
    return record
  })()

  // The device before the switch, opened by this version in local mode.
  let database = await openApp(filename, hintKey)
  const before = await readTables(database)
  const switched = await switchToSyncedTables(database, hintKey)
  const after = await readTables(database)
  const queue = await queued(database)
  const localAfter = await localCopyRows(database)
  const recorded = await readDataVersion(database)
  const again = await switchToSyncedTables(database, hintKey)
  const queueAgain = (await queued(database)).length
  await database.close()

  // Each row queued once, as an upload to its synced table.
  const keys = queue.map((entry) => `${entry.type}/${entry.id}`)
  const expectedKeys = COURSE_TABLES.flatMap((table) =>
    before[table]!.map((row) => `${syncedTableName(table)}/${String(row.id)}`),
  )

  // The next open starts with 0.4.0's schema (no hint) and corrects it.
  database = await openApp(filename, `${hintKey}-other`)
  const reopened = await readTables(database)
  const reopenedMode = await readSyncMode(database)
  await database.close()

  // An older 0.4.0 app on the same database: its own schema, read-only.
  const older = guardWrites(
    new PowerSyncDatabase({
      schema: AppSchema,
      database: { dbFilename: filename },
    }),
    parseVersion("0.4.0"),
  )
  await older.init()
  const olderAccess = dataAccess(
    parseVersion("0.4.0"),
    await readDataVersion(older),
  )
  const olderSees = count(await readTables(older))
  let olderWrite = "written"
  try {
    await older.execute("DELETE FROM students")
  } catch (error) {
    olderWrite = error instanceof ReadOnlyDataError ? "refused" : String(error)
  }
  await older.close()

  // This version again: the synced rows and the queue are whole.
  database = await openApp(filename, hintKey)
  const afterOlder = await readTables(database)
  const queueAfterOlder = (await queued(database)).length
  await database.close()

  return {
    origin,
    originRecord,
    rows: count(before),
    switched,
    identical: JSON.stringify(after) === JSON.stringify(before),
    queuedOnce:
      keys.length === new Set(keys).size &&
      JSON.stringify([...keys].sort()) ===
        JSON.stringify([...expectedKeys].sort()),
    queued: keys.length,
    onlyPuts: queue.every((entry) => entry.op === "PUT"),
    localAfter,
    minimumWriter: recorded?.minimumWriter,
    hint: syncModeHint(hintKey),
    again,
    queueAgain,
    reopenedMode,
    reopenedIdentical: JSON.stringify(reopened) === JSON.stringify(before),
    olderAccess,
    olderSees,
    olderWrite,
    afterOlderIdentical: JSON.stringify(afterOlder) === JSON.stringify(before),
    queueAfterOlder,
  }
}

/** A switch that fails halfway through its copy changes nothing. */
export async function runInterruptedSwitch() {
  const filename = `b1-interrupted-${crypto.randomUUID()}.db`
  const hintKey = `b1-hint-${crypto.randomUUID()}`
  await seed("0.3.0", filename)
  const database = await openApp(filename, hintKey)
  const before = await readTables(database)

  const writeTransaction = database.writeTransaction.bind(database)
  database.writeTransaction = ((callback, ...rest) =>
    writeTransaction(
      (transaction) =>
        callback(
          new Proxy(transaction, {
            get(target, property, receiver) {
              if (property !== "execute")
                return Reflect.get(target, property, receiver)
              return (sql: string, parameters?: unknown[]) => {
                if (sql.startsWith('DELETE FROM "students"'))
                  throw new Error("cut short")
                return target.execute(sql, parameters)
              }
            },
          }),
        ),
      ...rest,
    )) as typeof database.writeTransaction
  let failure = ""
  try {
    await switchToSyncedTables(database, hintKey)
  } catch (error) {
    failure = String(error)
  }
  database.writeTransaction = writeTransaction
  const mode = await readSyncMode(database)
  const after = await readTables(database)
  const queue = (await queued(database)).length
  const minimumWriter = (await readDataVersion(database))?.minimumWriter
  await database.close()
  return {
    failure,
    mode,
    identical: JSON.stringify(after) === JSON.stringify(before),
    queue,
    minimumWriter,
    hint: syncModeHint(hintKey),
  }
}

/** The app's own database seeded with the 0.3.0 course, then switched. */
export async function seedAndSwitchAppDatabase() {
  const { appChannelConfig } = await import("@/runtimeConfig")
  const filename = appChannelConfig.databaseFilename
  await seed("0.3.0", filename)
  const database = await openApp(filename, appChannelConfig.syncModeKey)
  await switchToSyncedTables(database, appChannelConfig.syncModeKey)
  const queue = (await queued(database)).length
  await database.close()
  return queue
}

/** A course file imported on a switched device lands in the synced tables. */
export async function runSyncedImport() {
  const { exportCourseArchive, importCourseArchive } =
    await import("@/persistence/courseArchive")
  const source = `b1-import-source-${crypto.randomUUID()}.db`
  const target = `b1-import-target-${crypto.randomUUID()}.db`
  const hintKey = `b1-hint-${crypto.randomUUID()}`
  await seed("0.3.0", source)
  await seed("0.2.0", target)

  // The file comes from a switched device too (B1 reviews DI-B1-4, SC-B1-5).
  let database = await openApp(source, hintKey)
  await switchToSyncedTables(database, hintKey)
  await database.close()
  database = await openApp(source, hintKey)
  const archive = await exportCourseArchive(database)
  const expected = await readTables(database)
  await database.close()
  const { parseCourseArchive } =
    await import("@/persistence/courseArchiveFormat")
  let olderImport = "accepted"
  try {
    parseCourseArchive(structuredClone(archive), parseVersion("0.4.0"))
  } catch (error) {
    olderImport = String(error)
  }

  database = await openApp(target, hintKey)
  await switchToSyncedTables(database, hintKey)
  await database.close()
  database = await openApp(target, hintKey)
  const replaced = count(await readTables(database))
  const queuedBefore = (await queued(database)).length
  await importCourseArchive(archive, database)
  await database.close()

  database = await openApp(target, hintKey)
  const imported = await readTables(database)
  // B6: the import forgot the replaced course's queue; the queue holds the
  // imported course alone.
  const queue = await queued(database)
  const erasures = await database.getAll<{
    id: string
    erase: number
    keep: number
  }>("SELECT id, erase, keep FROM serverErasures ORDER BY erase DESC")
  const result = {
    queuedBefore,
    erasures: erasures.map(({ erase, keep }) => ({ erase, keep })),
    identical: JSON.stringify(imported) === JSON.stringify(expected),
    mode: await readSyncMode(database),
    localRows: await localCopyRows(database),
    deletes: queue.filter((entry) => entry.op === "DELETE").length,
    puts: queue.filter((entry) => entry.op === "PUT").length,
    replaced,
    rows: count(expected),
    fileMinimumWriter: archive.dataVersion.minimumWriter,
    olderImport,
    targetMinimumWriter: (await readDataVersion(database))?.minimumWriter,
  }
  await database.close()
  return result
}

/**
 * An older 0.4.0 app opening the database while this version stays open on
 * it, with its course or, after an erase, with none: this version's next save
 * is refused, nothing lands in the local tables, and a reopen restores the
 * synced rows.
 */
export async function runOlderAppBesideOpenApp(withCourse: boolean) {
  const filename = `b1-beside-${crypto.randomUUID()}.db`
  const hintKey = `b1-hint-${crypto.randomUUID()}`
  await seed("0.3.0", filename)
  let database = await openApp(filename, hintKey)
  await switchToSyncedTables(database, hintKey)
  await database.close()
  database = await openApp(filename, hintKey)
  if (!withCourse) {
    await database.writeTransaction(async (transaction) => {
      for (const table of [...COURSE_TABLES].reverse())
        await transaction.execute(`DELETE FROM "${table}"`)
    })
    await database.close()
    database = await openApp(filename, hintKey)
  }
  const before = await readTables(database)

  const older = new PowerSyncDatabase({
    schema: AppSchema,
    database: { dbFilename: filename },
  })
  await older.init()
  await older.get("SELECT count(*) AS n FROM courses")
  await older.close()

  let save = "saved"
  try {
    const now = new Date().toISOString()
    await database.execute(
      "INSERT INTO courses (id, active, family, level, isoWeek, year, startDate, endDate, label, createdAt, updatedAt) VALUES (?, 1, 'Deriva', 2, 40, 2026, '2026-09-26', '2026-10-02', 'D2', ?, ?)",
      [`course-${crypto.randomUUID()}`, now, now],
    )
  } catch (error) {
    save = error instanceof Error ? error.name : String(error)
  }
  const [stranded] = await database.getAll<{ n: number }>(
    "SELECT count(*) AS n FROM ps_data_local__courses",
  )
  await database.close()

  database = await openApp(filename, hintKey)
  const reopened = await readTables(database)
  await database.close()
  return {
    save,
    stranded: stranded?.n ?? -1,
    restored: JSON.stringify(reopened) === JSON.stringify(before),
    rows: count(before),
  }
}
