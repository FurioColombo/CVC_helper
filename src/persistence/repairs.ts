import type { PowerSyncDatabase, Transaction } from "@powersync/web"

import { COURSE_PARENTS, COURSE_TABLES } from "@/persistence/schema"

/**
 * Repairs restore what every row of this version must carry (course ownership,
 * record metadata, `updatedAt` not before `createdAt`) wherever it is missing,
 * so they change nothing on data that already has it. `prepareDatabase` runs
 * them on every open, not once: an older app on the same database (03 §3.1)
 * strips the columns it does not know from a row it updates and inserts rows
 * without them, and the next open of this version fills them again.
 */

/** A row of `table` that a repair would change: the probe and its tests. */
function brokenRow(table: string) {
  return [
    ...(table in COURSE_PARENTS ? ["courseId IS NULL"] : []),
    "createdAt IS NULL",
    "updatedAt IS NULL",
    "updatedAt < createdAt",
  ].join(" OR ")
}

/**
 * One read that stops at the first row a repair would change, so an open of
 * sound data costs no write transaction (D1 data-integrity review DI-R2-Q1).
 */
export async function needsRepair(database: Pick<PowerSyncDatabase, "get">) {
  const probes = COURSE_TABLES.map(
    (table) => `SELECT 1 FROM ${table} WHERE ${brokenRow(table)}`,
  )
  const { needed } = await database.get<{ needed: number }>(
    `SELECT EXISTS (${probes.join(" UNION ALL ")}) AS needed`,
  )
  return needed === 1
}

/**
 * The D1 repairs, in order, all in the caller's write transaction:
 * 1. a child row without its course copies its parent's; a child whose parent
 *    is gone takes the device's course when there is exactly one, and otherwise
 *    stays without one (rowIntegrity reports both the orphan and the gap);
 * 2. a row without `createdAt` gets `now` (its creation time is unknown), and a
 *    row without `updatedAt` gets its `createdAt`;
 * 3. a row whose `updatedAt` is before its `createdAt` (0.1 and 0.2 stored the
 *    raw clock on a fault's update, so a clock set back could do this) gets its
 *    `createdAt`, as 0.3.0 did on the row's next update.
 */
export async function repairRows(
  transaction: Pick<Transaction, "execute">,
  now: string,
) {
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
