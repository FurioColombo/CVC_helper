import type { LockContext, PowerSyncDatabase } from "@powersync/web"

/**
 * B1: whether a database instance was given the synced schema
 * (src/persistence/syncMode.ts), so the write guard can refuse a write once an
 * older app on the device has put its own schema back. Views live in the
 * database file: an older app opening it repoints this instance's views to
 * the emptied local tables and parks the synced rows (the B1 spike), so a
 * save would land where no upload and no later open looks.
 */
const synced = new WeakSet<PowerSyncDatabase>()

export function noteSyncedSchema(
  database: PowerSyncDatabase,
  isSynced: boolean,
) {
  if (isSynced) synced.add(database)
  else synced.delete(database)
}

export function expectsSyncedTables(database: PowerSyncDatabase) {
  return synced.has(database)
}

/** Whether the synced course tables are still in place, inside a lock. */
export async function syncedTablesPresent(
  context: Pick<LockContext, "getAll">,
) {
  const rows = await context.getAll(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ps_data__synced_courses'",
  )
  return rows.length > 0
}
