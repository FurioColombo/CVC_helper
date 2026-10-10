import type { PowerSyncDatabase } from "@powersync/web"

/**
 * D3: an app older than its data's minimum writer opens the data read-only
 * (src/domain/compatibility.ts). Every write method of a guarded database then
 * refuses, so no screen, repair or migration of this version can write the
 * newer data; reads go on as usual.
 */
export class ReadOnlyDataError extends Error {
  constructor() {
    super("The data was written by a newer version: this one only reads it")
    this.name = "ReadOnlyDataError"
  }
}

const WRITE_METHODS = [
  "execute",
  "executeBatch",
  "writeTransaction",
  "writeLock",
] as const

const readOnly = new WeakSet<PowerSyncDatabase>()

export function markReadOnly(database: PowerSyncDatabase) {
  readOnly.add(database)
}

export function isReadOnly(database: PowerSyncDatabase) {
  return readOnly.has(database)
}

/** Makes the database's write methods refuse once it is marked read-only. */
export function guardWrites<Database extends PowerSyncDatabase>(
  database: Database,
): Database {
  const methods = database as unknown as Record<
    (typeof WRITE_METHODS)[number],
    (...args: unknown[]) => Promise<unknown>
  >
  for (const name of WRITE_METHODS) {
    const write = methods[name].bind(database)
    methods[name] = (...args) =>
      readOnly.has(database)
        ? Promise.reject(new ReadOnlyDataError())
        : write(...args)
  }
  return database
}
