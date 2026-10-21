import type { LockContext, PowerSyncDatabase } from "@powersync/web"

import { APP_VERSION } from "@/appVersion"
import { dataAccess, type Version } from "@/domain/compatibility"
import { readDataVersion } from "@/persistence/dataVersion"
import {
  assertCourseSession,
  assertCourseSessionOpen,
} from "@/persistence/courseSession"

/**
 * D3: an app older than its data's minimum writer only reads the data
 * (src/domain/compatibility.ts). Every write method of a guarded database
 * then refuses, so no screen, repair or migration of this version writes the
 * newer data; reads go on as usual.
 *
 * The record is read again inside every write's own lock, before anything is
 * written (D3 review DI-1): a newer app on the device may raise it while this
 * one stays open (a tab, a phone left on), and a check made before taking the
 * lock would let a save in flight land just after the raise. `execute` and
 * `executeBatch` therefore run as one-statement write transactions. The first
 * write refused this way marks the database read-only and tells the app, so
 * it can say why (src/components/UpdateAvailableBanner.tsx).
 */
export class ReadOnlyDataError extends Error {
  constructor() {
    super("The data was written by a newer version: this one only reads it")
    this.name = "ReadOnlyDataError"
  }
}

const readOnly = new WeakSet<PowerSyncDatabase>()
const compactors = new WeakMap<
  PowerSyncDatabase,
  (requireEmpty: boolean) => Promise<unknown>
>()
const listeners = new Set<() => void>()
let anyReadOnly = false

export function markReadOnly(database: PowerSyncDatabase) {
  if (readOnly.has(database)) return
  readOnly.add(database)
  anyReadOnly = true
  for (const listener of listeners) listener()
}

export function isReadOnly(database: PowerSyncDatabase) {
  return readOnly.has(database)
}

/** Whether the app's data is read-only for this version: nothing saves. */
export function dataIsReadOnly() {
  return anyReadOnly
}

/** Calls `listener` when a database becomes read-only; returns a stop. */
export function onReadOnly(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** VACUUM after course erasure, without letting old course callbacks save. */
export async function compactEmptyCourseDatabase(database: PowerSyncDatabase) {
  const compact = compactors.get(database)
  if (compact) return compact(true)
  return database.writeLock((context) => context.execute("VACUUM"))
}

/**
 * An import records that its replaced rows still sit in free pages; each
 * compaction clears the mark, and every open finishes one left pending
 * (UG3 review DI-UG3-1: an app closed during the compaction).
 */
export const COMPACTION_PENDING_ID = "local:compaction-pending"

export async function compactionPending(
  context: Pick<PowerSyncDatabase, "getAll">,
) {
  const rows = await context.getAll("SELECT id FROM meta WHERE id = ?", [
    COMPACTION_PENDING_ID,
  ])
  return rows.length > 0
}

/** After an import: the same guarded compaction, the new course kept. */
export async function compactCourseDatabase(database: PowerSyncDatabase) {
  const compact = compactors.get(database)
  if (compact) return compact(false)
  return database.writeLock((context) => context.execute("VACUUM"))
}

type Write = (...args: unknown[]) => Promise<unknown>

/** Makes the database's write methods refuse once it is read-only for `app`. */
export function guardWrites<Database extends PowerSyncDatabase>(
  database: Database,
  app: Version = APP_VERSION,
): Database {
  const methods = database as unknown as Record<string, Write>
  const writeLock = methods.writeLock!.bind(database)
  const writeTransaction = methods.writeTransaction!.bind(database)
  const executeRaw = methods.executeRaw!.bind(database)

  // Inside the lock: refuses before the caller's first statement.
  const assertWritable = async (
    context: Pick<LockContext, "getAll">,
    checkSession = true,
  ) => {
    if (checkSession) await assertCourseSession(database, context)
    if (readOnly.has(database)) throw new ReadOnlyDataError()
    if (dataAccess(app, await readDataVersion(context)) === "read-only") {
      markReadOnly(database)
      throw new ReadOnlyDataError()
    }
  }
  compactors.set(database, (requireEmpty) =>
    writeLock(async (context: LockContext) => {
      await assertWritable(context, false)
      if (requireEmpty) {
        const courses = await context.getAll("SELECT id FROM courses LIMIT 1")
        if (courses.length) throw new Error("Il corso è ancora presente.")
      }
      await context.execute("VACUUM")
      return context.execute("DELETE FROM meta WHERE id = ?", [
        COMPACTION_PENDING_ID,
      ])
    }),
  )
  const guarded =
    (callback: unknown) =>
    async (context: LockContext): Promise<unknown> => {
      await assertWritable(context)
      return (callback as (context: LockContext) => Promise<unknown>)(context)
    }

  methods.writeLock = async (callback, ...rest) => {
    assertCourseSessionOpen(database)
    return writeLock(guarded(callback), ...rest)
  }
  methods.writeTransaction = async (callback, ...rest) => {
    assertCourseSessionOpen(database)
    return writeTransaction(guarded(callback), ...rest)
  }
  methods.execute = (sql, parameters) =>
    methods.writeTransaction!((transaction: LockContext) =>
      transaction.execute(sql as string, parameters as unknown[]),
    )
  methods.executeBatch = (sql, parameters) =>
    methods.writeTransaction!((transaction: LockContext) =>
      transaction.executeBatch(sql as string, parameters as unknown[][]),
    )
  // No lock context offers raw execution, so the record is read just before
  // it, not inside its lock; the app does not use it (D3 reviews DI-Q5,
  // DI-R2-Q4).
  methods.executeRaw = async (...args) => {
    await assertWritable(database as unknown as Pick<LockContext, "getAll">)
    return executeRaw(...args)
  }
  return database
}
