import { column, Schema, Table } from "@powersync/web"
import type { PowerSyncDatabase, Transaction } from "@powersync/web"

import { APP_VERSION } from "@/appVersion"
import {
  dataVersionAfterSyncSwitch,
  type Version,
} from "@/domain/compatibility"
import {
  advanceCourseGeneration,
  invalidateCourseSession,
} from "@/persistence/courseSession"
import { readDataVersion, writeDataVersion } from "@/persistence/dataVersion"
import { noteSyncedSchema } from "@/persistence/openedSchema"
import { AppSchema, COURSE_TABLES } from "@/persistence/schema"
import {
  COMPACTION_PENDING_ID,
  compactCourseDatabase,
} from "@/persistence/writeGuard"

/**
 * B1: a device keeps its course in local-only tables (0.4.0's schema, the
 * default) until it switches to synced tables, which PowerSync uploads once
 * B3 connects. 0.4.0's tables keep their plain names on every device, so the
 * synced ones are `synced_<table>`, behind the app's own view names, and the
 * local ones stay declared under `inactive_local_<table>`: an app's schema
 * drops the local-only tables it does not declare (03 §3.1). The sync config
 * delivers the server tables under the same names (powersync/).
 *
 * The switch is recorded in `meta`, which every schema declares, and that
 * record decides the mode. A per-channel hint only lets the app open with the
 * right schema at once: a wrong guess is corrected before the first read,
 * and the synced rows survive it (the B1 spike, tests/e2e/b1-schema-probe).
 */
export type SyncMode = "local" | "synced"

export const SYNC_MODE_ID = "local:sync-mode"

/**
 * B3 (review SP-B3-1): the account a synced device belongs to, so no other
 * account ever uploads its queue or receives its course. `meta` stores
 * integers and passes them through JSON with 15 significant digits, so the
 * mark is the first 44 bits of the account's id (at most 14 digits).
 */
export const BACKUP_ACCOUNT_ID = "local:backup-account"
/** B5: set while a device switched without a course awaits the account's. */
export const AWAITING_ACCOUNT_COURSE_ID = "local:awaiting-account-course"

export function accountMark(userId: string) {
  const hex = userId.replace(/[^0-9a-f]/gi, "").slice(0, 11)
  if (hex.length < 11) throw new Error("Not an account id")
  return Number.parseInt(hex, 16)
}

export async function readAccountMark(
  context: Pick<PowerSyncDatabase, "getAll">,
) {
  const rows = await context.getAll<{ value: number | null }>(
    "SELECT value FROM meta WHERE id = ?",
    [BACKUP_ACCOUNT_ID],
  )
  const value = rows[0]?.value
  return value === null || value === undefined ? null : Number(value)
}
const SYNCED = 1

type SchemaJson = {
  tables: Array<{
    name: string
    columns: Array<{ name: string; type: string }>
  }>
}

const APP_TABLES = (
  AppSchema as unknown as { toJSON: () => SchemaJson }
).toJSON().tables
const COURSE_TABLE_NAMES = new Set<string>(COURSE_TABLES)

function tableColumns(name: string) {
  const table = APP_TABLES.find((candidate) => candidate.name === name)
  if (!table) throw new Error(`Unknown table ${name}`)
  return table.columns
}

/** The app uses text and integer columns only; anything else is refused. */
function columnType(table: string, column_: string, type: string) {
  const lower = type.toLowerCase()
  if (lower === "integer") return column.integer
  if (lower === "text") return column.text
  throw new Error(`${table}.${column_}: no synced mapping for ${type}`)
}

function columnsOf(name: string) {
  return Object.fromEntries(
    tableColumns(name).map(({ name: columnName, type }) => [
      columnName,
      columnType(name, columnName, type),
    ]),
  )
}

export const syncedTableName = (table: string) => `synced_${table}`
export const inactiveLocalView = (table: string) => `inactive_local_${table}`

function buildSchema(syncedViews: boolean) {
  const tables: Record<string, Table> = {}
  for (const { name } of APP_TABLES) {
    if (!COURSE_TABLE_NAMES.has(name)) {
      tables[name] = new Table(columnsOf(name), { localOnly: true })
      continue
    }
    tables[name] = new Table(columnsOf(name), {
      localOnly: true,
      ...(syncedViews ? { viewName: inactiveLocalView(name) } : {}),
    })
    tables[syncedTableName(name)] = new Table(columnsOf(name), {
      ...(syncedViews ? { viewName: name } : {}),
      // B4: a delete carries the updatedAt this device last saw, so the
      // server keeps a later edit made elsewhere (review SC-B4-2); an update
      // that changes nothing queues nothing (DI-B4-2).
      trackPrevious: { columns: ["updatedAt"] },
      ignoreEmptyUpdates: true,
    })
  }
  return new Schema(tables)
}

/** The synced mode's schema: the app's view names read the synced tables. */
export const SyncedSchema = buildSchema(true)

/**
 * During the switch only: the local tables keep the app's view names and the
 * synced tables are reached as `synced_<table>`, so the copy runs in one
 * transaction while the open screens still read the local rows.
 */
const SwitchingSchema = buildSchema(false)

export const schemaFor = (mode: SyncMode) =>
  mode === "synced" ? SyncedSchema : AppSchema

type HintStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

function hintStorage(): HintStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}

/** The mode this device last opened in, to pick the first schema. */
export function syncModeHint(key: string, storage = hintStorage()): SyncMode {
  try {
    return storage?.getItem(key) === "synced" ? "synced" : "local"
  } catch {
    return "local"
  }
}

function setSyncModeHint(key: string, mode: SyncMode, storage = hintStorage()) {
  try {
    if (mode === "synced") storage?.setItem(key, "synced")
    else storage?.removeItem(key)
  } catch {
    // Only a hint: the next open corrects the schema from `meta`.
  }
}

type Reader = Pick<PowerSyncDatabase, "getAll">

/**
 * The mode the data records; `meta` is declared in both schemas. It fails
 * closed, as the version record does (B1 reviews DI-B1-3, DP-B1-Q4): only the
 * switch writes the row, so a row that is present but unreadable still means
 * synced, and so do synced rows found without it, parked by an older schema
 * (`ps_untyped`) or behind the synced views.
 */
export async function readSyncMode(context: Reader): Promise<SyncMode> {
  const rows = await context.getAll<{ value: number | null }>(
    "SELECT value FROM meta WHERE id = ?",
    [SYNC_MODE_ID],
  )
  if (rows.length > 0) return "synced"
  const internal = await context.getAll<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('ps_untyped', 'ps_data__synced_courses')",
  )
  const has = (name: string) => internal.some((row) => row.name === name)
  const parked = !has("ps_untyped")
    ? []
    : await context.getAll(
        "SELECT 1 FROM ps_untyped WHERE substr(type, 1, 7) = 'synced_' LIMIT 1",
      )
  if (parked.length > 0) return "synced"
  if (!has("ps_data__synced_courses")) return "local"
  const synced = await context.getAll(
    "SELECT 1 FROM ps_data__synced_courses LIMIT 1",
  )
  return synced.length > 0 ? "synced" : "local"
}

const applied = new WeakMap<PowerSyncDatabase, Schema>()

/** Records the schema a database was opened with (src/persistence/schema.ts). */
export function noteOpenedSchema(database: PowerSyncDatabase, schema: Schema) {
  applied.set(database, schema)
  noteSyncedSchema(database, schema === SyncedSchema)
}

async function applySchema(database: PowerSyncDatabase, schema: Schema) {
  // A database not noted was opened with createDatabase’s default.
  if ((applied.get(database) ?? AppSchema) === schema) return
  await database.updateSchema(schema)
  applied.set(database, schema)
  noteSyncedSchema(database, schema === SyncedSchema)
}

/**
 * Before the first read of an open: gives the database the schema of the
 * mode its data records, and keeps the hint in step.
 */
export async function applyRecordedSyncMode(
  database: PowerSyncDatabase,
  hintKey: string,
) {
  const mode = await readSyncMode(database)
  await applySchema(database, schemaFor(mode))
  setSyncModeHint(hintKey, mode)
  return mode
}

async function copyToSyncedTables(transaction: Transaction) {
  for (const table of COURSE_TABLES) {
    const columns = ["id", ...tableColumns(table).map(({ name }) => name)]
      .map((name) => `"${name}"`)
      .join(", ")
    await transaction.execute(
      `INSERT INTO "${syncedTableName(table)}" (${columns}) SELECT ${columns} FROM "${table}"`,
    )
  }
  // Children first, as the erase does, so no row outlives its parent.
  for (const table of [...COURSE_TABLES].reverse()) {
    await transaction.execute(`DELETE FROM "${table}"`)
  }
}

/**
 * Switches the device to synced tables, once: in one write transaction it
 * raises the data's minimum writer to {@link SYNCED_SINCE} at least, so older
 * apps open read-only from its commit; copies every course row into the
 * synced tables, which queues it for upload; empties the local copy, so no
 * removed student or note lingers there; marks a compaction pending, so the
 * emptied rows leave no readable trace (UG3 review SP-UG3-1, as import does);
 * records the mode; and advances the course generation, so the screens open
 * on the old instance stop and the app reopens, as after an import.
 *
 * Interrupted before its commit, nothing changed and the device stays local;
 * after it, the next open finds the record and the synced schema.
 */
export async function switchToSyncedTables(
  database: PowerSyncDatabase,
  hintKey: string,
  app: Version = APP_VERSION,
  account?: string,
): Promise<"switched" | "already"> {
  // PowerSync refuses a schema change while connected (B1 reviews DI-B1-Q3,
  // SC-B1-Q5): B3 switches after prepareDatabase and before connect().
  if (database.connected)
    throw new Error("Disconnect before switching to synced tables")
  if ((await readSyncMode(database)) === "synced") {
    await applyRecordedSyncMode(database, hintKey)
    return "already"
  }
  await applySchema(database, SwitchingSchema)
  let already = false
  try {
    await database.writeTransaction(async (transaction) => {
      // Another tab switched between the check above and this lock.
      if ((await readSyncMode(transaction)) === "synced") {
        already = true
        return
      }
      const stored = await readDataVersion(transaction)
      await writeDataVersion(
        transaction,
        dataVersionAfterSyncSwitch(app, stored),
      )
      await copyToSyncedTables(transaction)
      await transaction.execute(
        "INSERT OR REPLACE INTO meta(id, value) VALUES (?, 1)",
        [COMPACTION_PENDING_ID],
      )
      await transaction.execute(
        "INSERT OR REPLACE INTO meta(id, value) VALUES (?, ?)",
        [SYNC_MODE_ID, SYNCED],
      )
      if (account) {
        await transaction.execute(
          "INSERT OR REPLACE INTO meta(id, value) VALUES (?, ?)",
          [BACKUP_ACCOUNT_ID, accountMark(account)],
        )
        // B5: a device switched without a course waits for the account's;
        // until its first download no course is made here (DI-B5-1, -3).
        const copied = await transaction.getAll(
          `SELECT 1 FROM "${syncedTableName("courses")}" LIMIT 1`,
        )
        if (copied.length === 0)
          await transaction.execute(
            "INSERT OR REPLACE INTO meta(id, value) VALUES (?, 1)",
            [AWAITING_ACCOUNT_COURSE_ID],
          )
      }
      await advanceCourseGeneration(transaction)
    })
  } finally {
    // Whatever happened, the schema follows what the data records.
    await applyRecordedSyncMode(database, hintKey)
  }
  if (already) return "already"
  invalidateCourseSession(database)
  await compactCourseDatabase(database).catch(() => {})
  return "switched"
}

/**
 * In synced mode the erase and the import also empty 0.4.0's local copy:
 * an app from before the contract (0.1.0–0.3.0) cannot be kept from writing
 * there after the switch (03 §3.1), and those rows are in no 0.5.0 screen
 * (B1 reviews DP-B1-1, DI-B1-2, SC-B1-4). Only views the schema declares.
 */
export async function emptyInactiveLocalCopy(
  transaction: Pick<Transaction, "getAll" | "execute">,
) {
  const present = new Set(
    (
      await transaction.getAll<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'view'",
      )
    ).map(({ name }) => name),
  )
  for (const table of [...COURSE_TABLES].reverse()) {
    const view = inactiveLocalView(table)
    if (present.has(view)) await transaction.execute(`DELETE FROM "${view}"`)
  }
}
