import { PowerSyncDatabase } from "@powersync/web"

import { DUTY_SETTING_LISTS } from "@/domain/config"
import {
  dutySettingListsFrom,
  type DutySettingItem,
} from "@/persistence/dutyItems"
import { prepareDatabase } from "@/persistence/migrations"
import { dutySettingItemsNeedRepair } from "@/persistence/repairs"
import { validateStoredRows, type RowIssue } from "@/persistence/rowIntegrity"
import { COURSE_TABLES, createDatabase } from "@/persistence/schema"
import { seed } from "@/test/d1MigrationHarness"
import v010 from "@/test/fixtures/v0.1.0-course.json"
import v020 from "@/test/fixtures/v0.2.0-course.json"
import v030 from "@/test/fixtures/v0.3.0-course.json"
import type { FixtureTables } from "@/test/legacySeed"
import { v030Schema } from "@/test/v030Schema"

/**
 * Browser-only proof of D2 on the real PowerSync engine: the lists of every
 * fixture's duty settings open as rows, item by item and in order, with none
 * lost or doubled; and when a 0.3.0 app opens the upgraded database, which
 * drops the rows' table, and writes the lists, the next open rebuilds them.
 */

type Version = "0.1.0" | "0.2.0" | "0.3.0"
const FIXTURES: Record<Version, FixtureTables> = {
  "0.1.0": v010.tables as FixtureTables,
  "0.2.0": v020.tables as FixtureTables,
  "0.3.0": v030.tables as FixtureTables,
}

const FIELDS = DUTY_SETTING_LISTS.map(({ field }) => field)
const OLDER_APP_COURSE = String(FIXTURES["0.3.0"].courses![0]!.id)

interface ListsResult {
  courses: number
  items: number
  /** "course.field" wherever the rows differ from the stored list. */
  differences: string[]
  listsFromRows: Record<string, Record<string, string[]>>
  rowIssues: RowIssue[]
  itemsBehind: boolean
}

/** Every course's lists, as stored (repeats dropped) and as rows. */
async function compareLists(database: PowerSyncDatabase): Promise<ListsResult> {
  const settings = await database.getAll<
    { courseId: string } & Record<string, string | null>
  >(`SELECT courseId, ${FIELDS.join(", ")} FROM dutySettings`)
  const items = await database.getAll<DutySettingItem>(
    "SELECT id, courseId, kind, value, position FROM dutySettingItems",
  )
  const differences: string[] = []
  const listsFromRows: ListsResult["listsFromRows"] = {}
  for (const row of settings) {
    const lists = dutySettingListsFrom(
      items.filter(({ courseId }) => courseId === row.courseId),
    )
    listsFromRows[row.courseId] = lists
    for (const field of FIELDS) {
      const stored = [...new Set(JSON.parse(row[field] ?? "[]") as string[])]
      if (JSON.stringify(stored) !== JSON.stringify(lists[field])) {
        differences.push(`${row.courseId}.${field}`)
      }
    }
  }
  const tables: Record<
    string,
    Array<Record<string, unknown> & { id: string }>
  > = {}
  for (const table of COURSE_TABLES) {
    tables[table] = await database.getAll(`SELECT * FROM ${table}`)
  }
  return {
    courses: settings.length,
    items: items.length,
    differences,
    listsFromRows,
    rowIssues: validateStoredRows(tables),
    itemsBehind: await dutySettingItemsNeedRepair(database),
  }
}

async function itemSnapshot(database: PowerSyncDatabase) {
  return database.getAll(
    `SELECT id, kind, value, position, createdAt, updatedAt
     FROM dutySettingItems ORDER BY id`,
  )
}

/** One fixture, upgraded through `prepareDatabase`, then reopened. */
export async function runListsUpgrade(version: Version) {
  const filename = `d2-${version}-${crypto.randomUUID()}.db`
  await seed(version, filename)
  const upgraded = createDatabase(filename)
  await prepareDatabase(upgraded)
  const result = await compareLists(upgraded)
  const before = await itemSnapshot(upgraded)
  await upgraded.close()
  const reopened = createDatabase(filename)
  await prepareDatabase(reopened)
  const after = await itemSnapshot(reopened)
  await reopened.close()
  return {
    ...result,
    reopenedIdentical: JSON.stringify(before) === JSON.stringify(after),
  }
}

/**
 * The 0.3.0 fixture with every list long, out of day order and, where 0.3.0
 * could store one, with a repeat: what the rows must keep is each list's order
 * and each item once.
 */
export async function runRichListsUpgrade() {
  const filename = `d2-rich-${crypto.randomUUID()}.db`
  const tables = structuredClone(FIXTURES["0.3.0"])
  tables.dutySettings = tables.dutySettings!.map((row) => ({
    ...row,
    fewerDayIds: JSON.stringify(["tuesday", "saturday"]),
    extraDayIds: JSON.stringify(["friday", "monday", "wednesday"]),
    stayOverStudentIds: JSON.stringify([
      "student-v030-sara",
      "student-v030-davide",
      "student-v030-sara",
    ]),
    completedDayIds: JSON.stringify(["sunday", "saturday"]),
    acknowledgedWarningKeys: JSON.stringify([
      "sex-balance:monday",
      "minor-balance:2,0",
      "sex-balance:monday",
    ]),
  }))
  await seed("0.3.0", filename, tables)
  const upgraded = createDatabase(filename)
  await prepareDatabase(upgraded)
  const result = await compareLists(upgraded)
  await upgraded.close()
  return result
}

/**
 * 03 §3.1: a phone still on 0.3.0 opens the upgraded database (its schema
 * drops `dutySettingItems`), completes Sunday and clears the stay-over
 * student through the lists; the next 0.4.0 open rebuilds the rows.
 */
export async function runOlderAppDropsItems() {
  const filename = `d2-older-app-${crypto.randomUUID()}.db`
  await seed("0.3.0", filename)
  const course = String(FIXTURES["0.3.0"].courses![0]!.id)

  const upgraded = createDatabase(filename)
  await prepareDatabase(upgraded)
  const itemsBefore = (await itemSnapshot(upgraded)).length
  await upgraded.close()

  const older = new PowerSyncDatabase({
    schema: v030Schema,
    database: { dbFilename: filename },
  })
  await older.init()
  const tableWhileOlder = await older.getAll(
    "SELECT name FROM sqlite_master WHERE name = 'ps_data_local__dutySettingItems'",
  )
  await older.execute(
    `UPDATE dutySettings SET completedDayIds = ?, stayOverStudentIds = ?
     WHERE id = ? AND courseId = ?`,
    [JSON.stringify(["saturday", "sunday"]), "[]", course, course],
  )
  // Read back what the older app stored before it closes, as D1's older-app
  // scenario does: closing straight after the write crashed WebKit's page
  // about one run in eight on the development PC.
  const listsWhileOlder = await older.get<{ completedDayIds: string }>(
    "SELECT completedDayIds FROM dutySettings WHERE id = ?",
    [course],
  )
  await older.close()

  const reopened = createDatabase(filename)
  await prepareDatabase(reopened)
  const result = await compareLists(reopened)
  await reopened.close()
  return {
    ...result,
    itemsBefore,
    tableDroppedByOlderApp: tableWhileOlder.length === 0,
    completedWrittenByOlderApp: JSON.parse(listsWhileOlder.completedDayIds),
    course,
  }
}

/**
 * Both reviews of D2's first round: a 0.3.0 tab still open beside the app
 * saves its duty plan with 0.3.0's own statement, after the app opened the
 * database and built the rows. The app must see the lists that tab wrote:
 * Sunday completed, and Paolo staying over, so Paolo cannot be deleted. The
 * app's database is the real one (cvc-helper.db), seeded before the app's
 * modules are imported, with the 0.3.0 instance opened first, as a tab that
 * was already open.
 */
export async function runStaleOlderTab() {
  const course = OLDER_APP_COURSE
  await seed("0.3.0", "cvc-helper.db")
  const older = new PowerSyncDatabase({
    schema: v030Schema,
    database: { dbFilename: "cvc-helper.db" },
  })
  await older.init()
  const { getActiveCourse } = await import("@/persistence/courses")
  const { readDutyPlan } = await import("@/persistence/duties")
  const { assessStudentDeletion } = await import("@/persistence/students")
  await getActiveCourse()
  const { db } = await import("@/persistence/db")
  const rowsBeforeOlderSave = (await itemSnapshot(db)).length

  const stored = FIXTURES["0.3.0"].dutySettings![0]!
  await older.execute(
    `INSERT OR REPLACE INTO dutySettings(
      id, courseId, desiredPerDay, fewerDayIds, extraDayIds, balanceMinors,
      balanceSex, tieBreaker, stayOverStudentIds, completedDayIds,
      acknowledgedWarningKeys
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      course,
      course,
      stored.desiredPerDay,
      stored.fewerDayIds,
      stored.extraDayIds,
      stored.balanceMinors,
      stored.balanceSex,
      stored.tieBreaker,
      JSON.stringify(["student-v030-davide", "student-v030-paolo"]),
      JSON.stringify(["saturday", "sunday"]),
      stored.acknowledgedWarningKeys,
    ],
  )

  const plan = await readDutyPlan(course)
  const deletion = await assessStudentDeletion("student-v030-paolo", course)
  await older.close()
  return {
    rowsBeforeOlderSave,
    stayOverStudentIds: plan.settings?.stayOverStudentIds,
    completedDayIds: plan.settings?.completedDayIds,
    paoloDeletable: deletion.canDelete,
    paoloReferences: deletion.references.map(({ kind }) => kind),
  }
}
