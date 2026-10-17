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
import { markReadOnly, ReadOnlyDataError } from "@/persistence/writeGuard"
import { bindCourseSession } from "@/persistence/courseSession"

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
 */
export function prepareDatabase(
  database: PowerSyncDatabase,
  migrations: readonly Migration[] = MIGRATIONS,
  app: Version = APP_VERSION,
): Promise<DataAccess> {
  let ready = prepared.get(database)
  if (!ready) {
    ready = (async () => {
      await database.init()
      await bindCourseSession(database)
      const stored = await readDataVersion(database)
      if (dataAccess(app, stored) === "read-only") {
        markReadOnly(database)
        return "read-only"
      }
      try {
        if (dataVersionNeedsRecord(app, stored)) {
          const claimed = await database.writeTransaction((transaction) =>
            claimDataVersion(transaction, app),
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
