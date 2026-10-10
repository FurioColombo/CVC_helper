import type { PowerSyncDatabase, Transaction } from "@powersync/web"

import { DUTY_SETTING_LISTS } from "@/domain/config"
import {
  dutySettingItemChanges,
  dutySettingItems,
  hasDutySettingItemChanges,
  writeDutySettingItemChanges,
  type DutySettingItem,
  type DutySettingLists,
} from "@/persistence/dutyItems"
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

type StoredDutyLists = { courseId: string } & Record<string, string | null>

/** A stored JSON list, or null when it is not an array of strings. */
function storedList(json: string | null): string[] | null {
  if (json == null) return []
  try {
    const parsed: unknown = JSON.parse(json)
    return Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
      ? parsed
      : null
  } catch {
    return null
  }
}

/**
 * D2: the duty-setting rows, made to match the JSON lists of each course's
 * settings row (the one whose id is the course's, the one the app reads). The
 * app writes both in one transaction, so they differ only when an app that
 * knows only the lists wrote them, erased the course, or dropped the rows'
 * table by opening the database with its own schema (03 §3.1); the lists win.
 * Rows of a course without a settings row go, and a row whose content
 * disagrees with its id is rebuilt. A list that does not parse keeps its rows
 * as they are: reading the settings reports it, as before D2.
 */
async function dutySettingItemRepairs(context: Pick<Transaction, "getAll">) {
  const [settings, stored] = await Promise.all([
    context.getAll<StoredDutyLists>(
      `SELECT courseId, ${DUTY_SETTING_LISTS.map(({ field }) => field).join(", ")}
       FROM dutySettings WHERE id = courseId`,
    ),
    context.getAll<DutySettingItem>(
      "SELECT id, courseId, kind, value, position FROM dutySettingItems",
    ),
  ])
  const wanted: DutySettingItem[] = []
  const unparsed = new Set<string>()
  for (const row of settings) {
    const lists: DutySettingLists = {}
    for (const { field, kind } of DUTY_SETTING_LISTS) {
      const list = storedList(row[field] ?? null)
      if (list) lists[field] = list
      else unparsed.add(JSON.stringify([row.courseId, kind]))
    }
    wanted.push(
      ...dutySettingItems(row.courseId, lists).filter(
        ({ kind }) => !unparsed.has(JSON.stringify([row.courseId, kind])),
      ),
    )
  }
  return dutySettingItemChanges(
    stored.filter(
      ({ courseId, kind }) => !unparsed.has(JSON.stringify([courseId, kind])),
    ),
    wanted,
  )
}

/** Whether the duty-setting rows differ from the lists: one read. */
export async function dutySettingItemsNeedRepair(
  database: Pick<PowerSyncDatabase, "getAll">,
) {
  return hasDutySettingItemChanges(await dutySettingItemRepairs(database))
}

/** Rebuilds the duty-setting rows that differ, in the caller's transaction. */
export async function repairDutySettingItems(
  transaction: Pick<Transaction, "getAll" | "execute" | "executeBatch">,
  now: string,
) {
  await writeDutySettingItemChanges(
    transaction,
    await dutySettingItemRepairs(transaction),
    now,
  )
}
