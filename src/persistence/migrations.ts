import type { PowerSyncDatabase, Transaction } from "@powersync/web"

import { APP_VERSION } from "@/appVersion"
import {
  dataAccess,
  type DataAccess,
  type Version,
} from "@/domain/compatibility"
import {
  claimDataVersion,
  dataVersionNeedsRecord,
  readDataVersion,
} from "@/persistence/dataVersion"
import {
  dutySettingItemsNeedRepair,
  needsRepair,
  repairDutySettingItems,
  repairRows,
} from "@/persistence/repairs"
import {
  compactCourseDatabase,
  compactEmptyCourseDatabase,
  compactionPending,
  markReadOnly,
  ReadOnlyDataError,
} from "@/persistence/writeGuard"
import { bindCourseSession } from "@/persistence/courseSession"
import { applyRecordedSyncMode } from "@/persistence/syncMode"
import { appChannelConfig } from "@/runtimeConfig"

/**
 * Bringing stored data up to date before the app reads it (D1, 03 §3). Schema
 * columns need no step: PowerSync adds a new column as null. The repairs
 * (src/persistence/repairs.ts) run on every open; migrations run once.
 *
 * Each migration runs in one write transaction together with its ledger row in
 * `meta`, so an interruption (the tab killed, the phone asleep, the app closed)
 * rolls the whole step back and the next open runs it again; a step already in
 * the ledger never runs twice. The ledger lives in `meta` because every schema
 * since M0 declares that table, and an app's schema drops the local-only tables
 * it does not declare. A table only newer versions declare can therefore
 * vanish under its ledger row: its rows are filled by a repair, not by a
 * migration (03 §3.1). Add a migration at the end; never edit or reorder an
 * applied one.
 */
export interface Migration {
  id: string
  run: (transaction: Transaction, now: string) => Promise<void>
}

/** None yet. */
export const MIGRATIONS: readonly Migration[] = []

const ledgerKey = (migration: Migration) => `migration:${migration.id}`

type MigratableDatabase = Pick<PowerSyncDatabase, "writeTransaction">

/** Applies one migration unless the ledger already holds it. */
export async function applyMigration(
  database: MigratableDatabase,
  migration: Migration,
) {
  return database.writeTransaction(async (transaction) => {
    const applied = await transaction.getOptional<{ id: string }>(
      "SELECT id FROM meta WHERE id = ?",
      [ledgerKey(migration)],
    )
    if (applied) return false
    const now = new Date()
    await migration.run(transaction, now.toISOString())
    await transaction.execute("INSERT INTO meta(id, value) VALUES (?, ?)", [
      ledgerKey(migration),
      now.getTime(),
    ])
    return true
  })
}

/** Applies every pending migration, in order; returns the ids it applied. */
export async function runMigrations(
  database: MigratableDatabase,
  migrations: readonly Migration[] = MIGRATIONS,
) {
  const applied: string[] = []
  for (const migration of migrations) {
    if (await applyMigration(database, migration)) applied.push(migration.id)
  }
  return applied
}

const prepared = new WeakMap<PowerSyncDatabase, Promise<DataAccess>>()

/**
 * Opens the database and brings its data up to date before the app reads
 * anything: `getActiveCourse`, the app's first read, waits for it. The
 * compatibility contract (D3, src/domain/compatibility.ts) comes first: an
 * app older than the data's minimum writer runs no repair or migration, which
 * all write, and leaves the database read-only. Otherwise it claims the data
 * for this version before writing anything else, re-reading the record in that
 * transaction (D3 review DI-2, DI-3), so from then on an older app refuses its
 * writes; then the repairs, so a migration reads rows of this version's shape,
 * and the migrations. One run per database, however often it is asked.
 * First of all the database takes the schema of the mode its data records
 * (B1, src/persistence/syncMode.ts), so every read sees the right tables.
 */
/**
 * B6: no course on this synced device, and no refused course row other than
 * an erased one: the course, if there was one, left with the backup (erased
 * on another phone), not refused from this one. A course this device brings
 * back under an erased id, not yet accepted again, is refused, not left.
 */
export async function courseLeftThisDevice(
  database: Pick<PowerSyncDatabase, "getAll">,
) {
  const [course] = await database.getAll("SELECT 1 FROM courses LIMIT 1")
  if (course) return false
  const kept = await database.getAll(
    `SELECT 1 FROM uploadRefusals r WHERE r.tableName = 'courses' AND (
       coalesce(r.reason, '') <> 'erased'
       OR EXISTS (SELECT 1 FROM serverErasures e WHERE e.id = r.rowId AND e.keep = 1)
     ) LIMIT 1`,
  )
  return kept.length === 0
}

export function prepareDatabase(
  database: PowerSyncDatabase,
  migrations: readonly Migration[] = MIGRATIONS,
  app: Version = APP_VERSION,
  syncModeKey: string = appChannelConfig.syncModeKey,
): Promise<DataAccess> {
  let ready = prepared.get(database)
  if (!ready) {
    ready = (async () => {
      await database.init()
      const synced =
        (await applyRecordedSyncMode(database, syncModeKey)) === "synced"
      await bindCourseSession(database)
      const stored = await readDataVersion(database)
      if (dataAccess(app, stored) === "read-only") {
        markReadOnly(database)
        return "read-only"
      }
      try {
        if (dataVersionNeedsRecord(app, stored, synced)) {
          const claimed = await database.writeTransaction((transaction) =>
            claimDataVersion(transaction, app, synced),
          )
          if (claimed === "read-only") {
            markReadOnly(database)
            return "read-only"
          }
        }
        if (await needsRepair(database)) {
          await database.writeTransaction((transaction) =>
            repairRows(transaction, new Date().toISOString()),
          )
        }
        if (await dutySettingItemsNeedRepair(database)) {
          await database.writeTransaction((transaction) =>
            repairDutySettingItems(transaction, new Date().toISOString()),
          )
        }
        await runMigrations(database, migrations)
        // An import's compaction cut short by closing the app (UG3 DI-UG3-1).
        if (await compactionPending(database))
          await compactCourseDatabase(database).catch(() => {})
        // B6: a course erased on another phone left with its rows; the
        // changes the backup refused for it go too (they hold its data),
        // and the database is compacted so nothing of it stays in its pages
        // (review SP-B6-1). A course whose own row the backup refused is
        // kept for Riprova instead (review DI-B6-1).
        if (synced && (await courseLeftThisDevice(database))) {
          const [refused] = await database.getAll(
            "SELECT 1 FROM uploadRefusals LIMIT 1",
          )
          if (refused)
            await database.writeTransaction((transaction) =>
              transaction.execute("DELETE FROM uploadRefusals"),
            )
          // Cheap on an empty database, also when nothing left just now
          // (reviews SP-B6-Q5, DI-B6-R2-Q1).
          await compactEmptyCourseDatabase(database).catch(() => {})
        }
      } catch (error) {
        // A newer app raised the record meanwhile; the guard marked the
        // database read-only (src/persistence/writeGuard.ts).
        if (error instanceof ReadOnlyDataError) return "read-only"
        throw error
      }
      return "write"
    })()
    prepared.set(database, ready)
    // A failed run may be retried by asking again.
    ready.catch(() => prepared.delete(database))
  }
  return ready
}
