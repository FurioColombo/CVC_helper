import type { PowerSyncDatabase, Transaction } from "@powersync/web"

import { db } from "@/persistence/db"
import { prepareDatabase } from "@/persistence/migrations"

/**
 * B6: on a synced device, erasing the course or replacing it with a course
 * file erases it on the server too. In the transaction that removes it here,
 * the device forgets its whole synced copy, the upload queue's pending
 * changes and the downloaded history included (B1 reviews DI-B1-1, SC-B1-3),
 * and records which course ids the server must still erase. The backup
 * settles that record before it connects (src/backup/session.ts), so an
 * erase made offline completes with signal and the erased course is never
 * downloaded again.
 */
type Writer = Pick<Transaction, "getAll" | "execute">

/**
 * What `disconnectAndClear({ clearLocal: false })` runs, inside the caller's
 * transaction so the course goes and its record is kept in one commit. The
 * database must be disconnected first.
 */
async function forgetSyncedCopy(transaction: Writer) {
  await transaction.execute("SELECT powersync_clear(0)")
}

async function record(
  transaction: Writer,
  courseId: string,
  kind: "erase" | "keep",
) {
  const [row] = await transaction.getAll<{ erase: number | null }>(
    "SELECT erase FROM serverErasures WHERE id = ?",
    [courseId],
  )
  // Erasing a course imported earlier erases it for good; importing a file
  // whose course was erased brings that id back.
  const erase = kind === "erase" ? 1 : (row?.erase ?? 0)
  const keep = kind === "keep" ? 1 : 0
  await transaction.execute(
    "INSERT OR REPLACE INTO serverErasures(id, erase, keep) VALUES (?, ?, ?)",
    [courseId, erase, keep],
  )
}

/** Disconnects a synced database before its copy is forgotten. */
export async function disconnectForErase(database: PowerSyncDatabase) {
  if (database.connected || database.connecting) await database.disconnect()
}

/**
 * Inside the erase or import transaction of a synced device: forgets the
 * synced copy and records the device's courses for erasure on the server,
 * and `kept` (an imported course) for acceptance.
 */
export async function eraseSyncedCopy(transaction: Writer, kept?: string) {
  const courses = await transaction.getAll<{ id: string }>(
    "SELECT id FROM courses",
  )
  await forgetSyncedCopy(transaction)
  for (const { id } of courses) await record(transaction, id, "erase")
  if (kept) await record(transaction, kept, "keep")
}

export type ServerErasures = {
  rows: Array<{ id: string; erase: number; keep: number }>
  erase: string[]
  keep: string[]
}

/** What the server must still erase or accept again. */
export async function pendingServerErasures(
  database: PowerSyncDatabase = db,
): Promise<ServerErasures> {
  await prepareDatabase(database)
  const rows = (
    await database.getAll<{
      id: string
      erase: number | null
      keep: number | null
    }>("SELECT id, erase, keep FROM serverErasures ORDER BY id")
  ).map(({ id, erase, keep }) => ({ id, erase: erase ?? 0, keep: keep ?? 0 }))
  return {
    rows,
    erase: rows.filter((row) => row.erase).map(({ id }) => id),
    keep: rows.filter((row) => row.keep).map(({ id }) => id),
  }
}

/** The server did what `rows` asked; a record changed meanwhile stays. */
export async function forgetServerErasures(
  rows: ServerErasures["rows"],
  database: PowerSyncDatabase = db,
) {
  if (!rows.length) return
  await database.writeTransaction(async (transaction) => {
    for (const { id, erase, keep } of rows)
      await transaction.execute(
        "DELETE FROM serverErasures WHERE id = ? AND coalesce(erase, 0) = ? AND coalesce(keep, 0) = ?",
        [id, erase, keep],
      )
  })
}
