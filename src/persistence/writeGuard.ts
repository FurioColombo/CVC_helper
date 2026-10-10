import type { PowerSyncDatabase } from "@powersync/web"

import { APP_VERSION } from "@/appVersion"
import {
  compareVersions,
  decodeVersion,
  type Version,
} from "@/domain/compatibility"

/**
 * D3: an app older than its data's minimum writer only reads the data
 * (src/domain/compatibility.ts). Every write method of a guarded database
 * then refuses, so no screen, repair or migration of this version writes the
 * newer data; reads go on as usual. The data's minimum writer is read again
 * before each write, because a newer app on the device may raise it while
 * this one stays open (a tab, a phone left on): the first write after that
 * finds out, refuses, and the app is told so it can say why.
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
const listeners = new Set<() => void>()

export function markReadOnly(database: PowerSyncDatabase) {
  if (readOnly.has(database)) return
  readOnly.add(database)
  for (const listener of listeners) listener()
}

export function isReadOnly(database: PowerSyncDatabase) {
  return readOnly.has(database)
}

/** Calls `listener` when a database becomes read-only; returns a stop. */
export function onReadOnly(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Whether the data now asks for a newer writer than `app`. */
async function excludes(
  database: Pick<PowerSyncDatabase, "getOptional">,
  app: Version,
) {
  const row = await database.getOptional<{ value: number | null }>(
    "SELECT value FROM meta WHERE id = 'data:minimumWriter'",
  )
  if (row?.value == null) return false
  try {
    return compareVersions(app, decodeVersion(row.value)) < 0
  } catch {
    return false
  }
}

/** Makes the database's write methods refuse once it is read-only for `app`. */
export function guardWrites<Database extends PowerSyncDatabase>(
  database: Database,
  app: Version = APP_VERSION,
): Database {
  const methods = database as unknown as Record<
    (typeof WRITE_METHODS)[number],
    (...args: unknown[]) => Promise<unknown>
  >
  for (const name of WRITE_METHODS) {
    const write = methods[name].bind(database)
    methods[name] = async (...args) => {
      if (!readOnly.has(database) && (await excludes(database, app))) {
        markReadOnly(database)
      }
      if (readOnly.has(database)) throw new ReadOnlyDataError()
      return write(...args)
    }
  }
  return database
}
