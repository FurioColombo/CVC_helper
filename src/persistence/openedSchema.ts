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

/**
 * Whether the app's views still read the synced tables, inside a lock: the
 * `courses` view must exist and read `ps_data__synced_courses`. Checking only
 * that the table exists would pass during another tab's switch, whose
 * schema keeps the synced tables but points the views at the local ones
 * (B1 reviews DP-B1-Q3, DI-B1-Q1, SC-B1-Q1).
 */
export async function syncedTablesPresent(
  context: Pick<LockContext, "getAll">,
) {
  const rows = await context.getAll<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type = 'view' AND name = 'courses'",
  )
  return rows[0]?.sql?.includes("ps_data__synced_courses") ?? false
}
