import type { CourseDetails } from "@/domain/course"
import { db } from "@/persistence/db"

export type CourseRecord = CourseDetails & {
  id: string
  active: 1
}

export async function getActiveCourse() {
  await db.init()
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
  const course: CourseRecord = {
    id: crypto.randomUUID(),
    active: 1,
    ...details,
  }

  await db.writeTransaction(async (transaction) => {
    await transaction.execute("UPDATE courses SET active = 0 WHERE active = 1")
    await transaction.execute(
      `INSERT INTO courses(
        id, active, family, level, isoWeek, year, startDate, endDate, label
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ],
    )
  })

  return course
}
