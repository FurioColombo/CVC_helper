import type { CourseDetails } from "@/domain/course"
import { appChannelConfig } from "@/runtimeConfig"
import { db } from "@/persistence/db"
import { prepareDatabase } from "@/persistence/migrations"
import { COURSE_TABLES } from "@/persistence/schema"
import { stamp, TOUCH } from "@/persistence/stamp"
import { adoptCreatedCourse } from "@/persistence/courseSession"
import { compactEmptyCourseDatabase } from "@/persistence/writeGuard"

export type CourseRecord = CourseDetails & {
  id: string
  active: 1
}

/**
 * The app's first read (App's load effect): it brings the data up to date
 * first, so nothing reads a row the repairs or a pending migration still have
 * to fill. A failed run fails this read, and the app's Riprova reloads the app
 * to run it again.
 */
export async function getActiveCourse() {
  await prepareDatabase(db)
  return db.getOptional<CourseRecord>(
    `SELECT id, active, family, level, isoWeek, year, startDate, endDate, label
     FROM courses
     WHERE active = 1
     LIMIT 1`,
  )
}

export async function saveActiveCourse(
  details: CourseDetails,
): Promise<CourseRecord> {
  await db.init()
  const now = stamp()
  const course: CourseRecord = {
    id: crypto.randomUUID(),
    active: 1,
    ...details,
  }

  await db.writeTransaction(async (transaction) => {
    await transaction.execute(
      `UPDATE courses SET active = 0, ${TOUCH} WHERE active = 1`,
      [now],
    )
    await transaction.execute(
      `INSERT INTO courses(
        id, active, family, level, isoWeek, year, startDate, endDate, label,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        course.id,
        course.active,
        course.family,
        course.level,
        course.isoWeek,
        course.year,
        course.startDate,
        course.endDate,
        course.label,
        now,
        now,
      ],
    )
  })

  adoptCreatedCourse(db, course.id)
  return course
}

/**
 * Every table that holds course data, children first. The app keeps one
 * course at a time, so starting a new one erases the whole local archive:
 * nothing about the previous week's students (minors included) stays behind
 * on the device.
 */
export const COURSE_DATA_TABLES = [...COURSE_TABLES].reverse()

const COURSE_PREFERENCE_PREFIXES = [appChannelConfig.scanNameOrderPrefix]

export async function eraseAllCourseData() {
  await db.init()
  await db.writeTransaction(async (transaction) => {
    // An older app that opened the database meanwhile dropped the tables only
    // newer versions declare, their rows with them (03 §3.1); the erase skips
    // what is gone instead of failing on it (D2 review DP-R2-1).
    const present = new Set(
      (
        await transaction.getAll<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'view'",
        )
      ).map(({ name }) => name),
    )
    for (const table of COURSE_DATA_TABLES) {
      if (present.has(table)) await transaction.execute(`DELETE FROM ${table}`)
    }
  })
  // Deleted rows can survive in free database pages until they are reused;
  // compacting rewrites the file without them. Where the storage layer
  // cannot compact, the rows are still gone from every query. SQLite refuses
  // VACUUM inside a transaction, and `execute` is one under the write guard,
  // so it runs under the guarded write lock, which opens none (D3 review
  // DI-R2-1).
  try {
    await compactEmptyCourseDatabase(db)
  } catch {
    // Not supported by every browser storage backend.
  }
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (COURSE_PREFERENCE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        window.localStorage.removeItem(key)
      }
    }
  } catch {
    // Storage may be unavailable; these are only interface preferences.
  }
}
