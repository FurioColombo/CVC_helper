import type { PowerSyncDatabase, Transaction } from "@powersync/web"

import { COURSE_PARENTS, COURSE_TABLES } from "@/persistence/schema"

/**
 * Bringing stored data up to date before the app reads it (D1, 03 §3). Schema
 * columns need no step: PowerSync adds a new column as null. Two kinds of step
 * fill and reshape the data.
 *
 * Repairs run on every open. They restore what every row of this version must
 * carry (course ownership, record metadata, `updatedAt` not before
 * `createdAt`) wherever it is missing, so they change nothing on data that
 * already has it. Running them on every open, not once, is what covers an older
 * app on the same database (03 §3.1): it strips the columns it does not know
 * from a row it updates and inserts rows without them, and the next open of
 * this version fills them again.
 *
 * Migrations run once. Each runs in one write transaction together with its
 * ledger row in `meta`, so an interruption (the tab killed, the phone asleep,
 * the app closed) rolls the whole step back and the next open runs it again; a
 * step already in the ledger never runs twice. The ledger lives in `meta`
 * because every schema since M0 declares that table, and an older app's schema
 * drops a local-only table it does not declare. Add a migration at the end;
 * never edit or reorder an applied one.
 */
export interface Migration {
  id: string
  run: (transaction: Transaction, now: string) => Promise<void>
}

type Step = Pick<Transaction, "execute">

/**
 * The D1 repairs, in order, all in one write transaction:
 * 1. a child row without its course copies its parent's; a child whose parent
 *    is gone takes the device's course when there is exactly one, and otherwise
 *    stays without one (rowIntegrity reports it);
 * 2. a row without `createdAt` gets `now` (its creation time is unknown), and a
 *    row without `updatedAt` gets its `createdAt`;
 * 3. a row whose `updatedAt` is before its `createdAt` (0.1 and 0.2 stored the
 *    raw clock on a fault's update, so a clock set back could do this) gets its
 *    `createdAt`, as 0.3.0 did on the row's next update.
 */
export async function repairRows(transaction: Step, now: string) {
  for (const [table, { table: parent, key }] of Object.entries(
    COURSE_PARENTS,
  )) {
    await transaction.execute(
      `UPDATE ${table} SET courseId =
         (SELECT ${parent}.courseId FROM ${parent}
          WHERE ${parent}.id = ${table}.${key})
       WHERE courseId IS NULL`,
    )
    await transaction.execute(
      `UPDATE ${table} SET courseId = (SELECT id FROM courses)
       WHERE courseId IS NULL AND (SELECT count(*) FROM courses) = 1`,
    )
  }
  for (const table of COURSE_TABLES) {
    await transaction.execute(
      `UPDATE ${table} SET
         createdAt = coalesce(createdAt, ?),
         updatedAt = coalesce(updatedAt, createdAt, ?)
       WHERE createdAt IS NULL OR updatedAt IS NULL`,
      [now, now],
    )
    await transaction.execute(
      `UPDATE ${table} SET updatedAt = createdAt WHERE updatedAt < createdAt`,
    )
  }
}

/** None yet: D2 adds the first. */
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

const prepared = new WeakMap<PowerSyncDatabase, Promise<void>>()

/**
 * Opens the database and brings its data up to date before the app reads
 * anything: `getActiveCourse`, the app's first read, waits for it. The repairs
 * come first, so a migration reads rows of this version's shape. One run per
 * database, however often it is asked.
 */
export function prepareDatabase(
  database: PowerSyncDatabase,
  migrations: readonly Migration[] = MIGRATIONS,
) {
  let ready = prepared.get(database)
  if (!ready) {
    ready = (async () => {
      await database.init()
      await database.writeTransaction((transaction) =>
        repairRows(transaction, new Date().toISOString()),
      )
      await runMigrations(database, migrations)
    })()
    prepared.set(database, ready)
    // A failed run may be retried by asking again.
    ready.catch(() => prepared.delete(database))
  }
  return ready
}
