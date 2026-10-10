import type { CourseDetails } from "@/domain/course"
import { db } from "@/persistence/db"
import { prepareDatabase } from "@/persistence/migrations"
import { COURSE_TABLES } from "@/persistence/schema"
import { stamp, TOUCH } from "@/persistence/stamp"

export type CourseRecord = CourseDetails & {
  id: string
  active: 1
}

/**
 * The app's first read (App's load effect): it brings the data up to date
 * first, so nothing reads a row the repairs or a pending migration still have
 * to fill. A failed run fails this read, and the app's Riprova runs it again.
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

  return course
}

/**
 * Every table that holds course data, children first. The app keeps one
 * course at a time, so starting a new one erases the whole local archive:
 * nothing about the previous week's students (minors included) stays behind
 * on the device.
 */
export const COURSE_DATA_TABLES = [...COURSE_TABLES].reverse()

const COURSE_PREFERENCE_PREFIXES = ["cvc-helper.scan-name-order."]

export async function eraseAllCourseData() {
  await db.init()
  await db.writeTransaction(async (transaction) => {
    for (const table of COURSE_DATA_TABLES) {
      await transaction.execute(`DELETE FROM ${table}`)
    }
  })
  // Deleted rows can survive in free database pages until they are reused;
  // compacting rewrites the file without them. Where the storage layer
  // cannot compact, the rows are still gone from every query.
  try {
    await db.execute("VACUUM")
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
