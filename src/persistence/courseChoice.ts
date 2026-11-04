import type { PowerSyncDatabase } from "@powersync/web"

import type { CourseRecord } from "@/persistence/courses"
import { db } from "@/persistence/db"
import { prepareDatabase } from "@/persistence/migrations"
import { COURSE_TABLES } from "@/persistence/schema"
import { syncedTableName } from "@/persistence/syncMode"

/**
 * B7: an account can reach several courses (two devices that each made one,
 * one of them offline; 04 B7). The app opens one course at a time, so it shows
 * them and the owner keeps one. What tells them apart comes from here.
 */
export type CourseChoice = CourseRecord & {
  students: number
  crews: number
  evaluations: number
  /** The latest `updatedAt` of the course and its rows. */
  lastChange: string | null
  /** This device's changes of the course still in the upload queue. */
  unsent: number
  /** This device's changes of the course the backup refused. */
  refused: number
}

type Reader = Pick<PowerSyncDatabase, "getAll">

const TABLES = new Set<string>(COURSE_TABLES)
const SYNCED_PREFIX = syncedTableName("")

/**
 * A change names its course when it carries the column, otherwise through its
 * row. A delete names neither and is not counted: a pending delete of a course
 * given up has nothing to lose, and one of the kept course still uploads.
 */
async function unsentByCourse(context: Reader) {
  const unsent = new Map<string, number>()
  const queue = await context.getAll<{ data: string }>(
    "SELECT data FROM ps_crud",
  )
  for (const { data } of queue) {
    const change = JSON.parse(data) as {
      op?: string
      type?: string
      id?: string
      data?: { courseId?: unknown }
    }
    const table = change.type?.startsWith(SYNCED_PREFIX)
      ? change.type.slice(SYNCED_PREFIX.length)
      : change.type
    if (change.op === "DELETE" || !table || !change.id || !TABLES.has(table))
      continue
    let course: unknown =
      table === "courses" ? change.id : change.data?.courseId
    if (typeof course !== "string") {
      const [row] = await context.getAll<{ courseId: string | null }>(
        `SELECT courseId FROM "${table}" WHERE id = ?`,
        [change.id],
      )
      course = row?.courseId
    }
    if (typeof course === "string")
      unsent.set(course, (unsent.get(course) ?? 0) + 1)
  }
  return unsent
}

/** The refused changes, deletes aside as above: they name no one. */
async function refusedByCourse(context: Reader) {
  const refused = new Map<string, number>()
  const rows = await context.getAll<{
    tableName: string
    rowId: string
    data: string | null
  }>("SELECT tableName, rowId, data FROM uploadRefusals WHERE op <> 'DELETE'")
  for (const { tableName, rowId, data } of rows) {
    let course: unknown = rowId
    if (tableName !== "courses")
      try {
        course = (JSON.parse(data ?? "null") as { courseId?: unknown } | null)
          ?.courseId
      } catch {
        continue
      }
    if (typeof course === "string")
      refused.set(course, (refused.get(course) ?? 0) + 1)
  }
  return refused
}

async function latestChange(context: Reader, courseId: string) {
  let latest: string | null = null
  for (const table of COURSE_TABLES) {
    const [row] = await context.getAll<{ latest: string | null }>(
      `SELECT max(updatedAt) AS latest FROM "${table}" WHERE ${
        table === "courses" ? "id" : "courseId"
      } = ?`,
      [courseId],
    )
    if (row?.latest && (!latest || row.latest > latest)) latest = row.latest
  }
  return latest
}

async function countOf(context: Reader, table: string, courseId: string) {
  const [row] = await context.getAll<{ n: number }>(
    `SELECT count(*) AS n FROM "${table}" WHERE courseId = ?`,
    [courseId],
  )
  return row?.n ?? 0
}

/** The active courses with what tells them apart, most recently changed first. */
export async function readCourseChoices(
  database: PowerSyncDatabase = db,
): Promise<CourseChoice[]> {
  await prepareDatabase(database)
  return database.readTransaction(async (context) => {
    const courses = await context.getAll<CourseRecord>(
      `SELECT id, active, family, level, isoWeek, year, startDate, endDate, label
       FROM courses WHERE active = 1 ORDER BY id`,
    )
    const unsent = await unsentByCourse(context)
    const refused = await refusedByCourse(context)
    const choices: CourseChoice[] = []
    for (const course of courses)
      choices.push({
        ...course,
        students: await countOf(context, "students", course.id),
        crews: await countOf(context, "crews", course.id),
        evaluations: await countOf(context, "evaluations", course.id),
        lastChange: await latestChange(context, course.id),
        unsent: unsent.get(course.id) ?? 0,
        refused: refused.get(course.id) ?? 0,
      })
    return choices.sort((first, second) =>
      (second.lastChange ?? "").localeCompare(first.lastChange ?? ""),
    )
  })
}

const COURSE_ARRIVAL_KEY = "cvc-helper.course-arrived-reload"

/** The app reopens by itself on a second course, past any unsaved typing. */
export function rememberCourseArrival() {
  try {
    window.sessionStorage.setItem(COURSE_ARRIVAL_KEY, "1")
  } catch {
    // Storage unavailable: the reopen goes without its explanation.
  }
}

export function readCourseArrival() {
  try {
    return window.sessionStorage.getItem(COURSE_ARRIVAL_KEY) === "1"
  } catch {
    return false
  }
}

export function clearCourseArrival() {
  try {
    window.sessionStorage.removeItem(COURSE_ARRIVAL_KEY)
  } catch {
    // Storage unavailable: nothing was remembered either.
  }
}
