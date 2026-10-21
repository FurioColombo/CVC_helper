import type { PowerSyncDatabase, Transaction } from "@powersync/web"

import { APP_VERSION } from "@/appVersion"
import { dataVersionAfterWrite, newer } from "@/domain/compatibility"
import {
  createCourseArchive,
  parseCourseArchive,
  type CourseArchive,
  type CourseArchiveTables,
} from "@/persistence/courseArchiveFormat"
import {
  advanceCourseGeneration,
  invalidateCourseSession,
} from "@/persistence/courseSession"
import { db } from "@/persistence/db"
import { readDataVersion, writeDataVersion } from "@/persistence/dataVersion"
import { clearCoursePreferences } from "@/persistence/courses"
import { compactCourseDatabase } from "@/persistence/writeGuard"
import { prepareDatabase } from "@/persistence/migrations"
import { COURSE_TABLES } from "@/persistence/schema"

// Explicit columns keep the metadata write harness useful. The archive codec
// accepts exactly the schema's columns; these bind their original values.
const INSERTS = {
  courses:
    "INSERT INTO courses(id, active, family, level, isoWeek, year, startDate, endDate, label, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  students:
    "INSERT INTO students(id, courseId, firstName, surname, nickname, dateOfBirth, declaredAgeAtCourseStart, sex, phone, size, initialNote, courseNote, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  volunteers:
    "INSERT INTO volunteers(id, courseId, name, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
  boats:
    "INSERT INTO boats(id, courseId, type, number, availability, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
  faults:
    "INSERT INTO faults(id, courseId, boatId, description, state, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
  dutyAssignments:
    "INSERT INTO dutyAssignments(id, courseId, dayId, studentId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
  dutySettings:
    "INSERT INTO dutySettings(id, courseId, desiredPerDay, fewerDayIds, extraDayIds, balanceMinors, balanceSex, tieBreaker, stayOverStudentIds, completedDayIds, acknowledgedWarningKeys, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  dutySettingItems:
    "INSERT INTO dutySettingItems(id, courseId, kind, value, position, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
  crews:
    "INSERT INTO crews(id, courseId, sessionId, capacity, destination, boatId, position, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  crewMembers:
    "INSERT INTO crewMembers(id, courseId, crewId, personId, personType, position, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  landAssignments:
    "INSERT INTO landAssignments(id, courseId, sessionId, studentId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
  sessionBoats:
    "INSERT INTO sessionBoats(id, courseId, sessionId, boatId, position, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
  evaluations:
    "INSERT INTO evaluations(id, courseId, studentId, sessionId, value, note, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
} as const

/** One consistent snapshot, of the active course only; no device bookkeeping. */
export async function exportCourseArchive(
  database: PowerSyncDatabase = db,
): Promise<CourseArchive> {
  await prepareDatabase(database)
  return database.readTransaction(async (transaction) => {
    const courses = await transaction.getAll<
      CourseArchiveTables["courses"][number]
    >("SELECT * FROM courses WHERE active = 1")
    if (courses.length !== 1)
      throw new Error("Non c’è un unico corso da esportare.")
    const tables = { courses } as CourseArchiveTables
    for (const table of COURSE_TABLES) {
      if (table === "courses") continue
      tables[table] = await transaction.getAll(
        `SELECT * FROM ${table} WHERE courseId = ? ORDER BY id`,
        [courses[0]!.id],
      )
    }
    const version = await readDataVersion(transaction)
    if (!version)
      throw new Error("Versione dei dati non disponibile. Riapri l’app.")
    return createCourseArchive(tables, version)
  })
}

async function mergeImportedVersion(
  transaction: Transaction,
  archive: CourseArchive,
) {
  const current = await readDataVersion(transaction)
  const merged = current
    ? {
        version: newer(current.version, archive.dataVersion.version),
        minimumWriter: newer(
          current.minimumWriter,
          archive.dataVersion.minimumWriter,
        ),
      }
    : archive.dataVersion
  await writeDataVersion(
    transaction,
    dataVersionAfterWrite(APP_VERSION, merged),
  )
}

/** Validation precedes every write. Replacement and invalidation commit whole. */
export async function importCourseArchive(
  value: unknown,
  database: PowerSyncDatabase = db,
) {
  const archive = parseCourseArchive(structuredClone(value))
  await prepareDatabase(database)
  await database.writeTransaction(async (transaction) => {
    for (const table of [...COURSE_TABLES].reverse())
      await transaction.execute(`DELETE FROM ${table}`)
    for (const table of COURSE_TABLES) {
      const sql = INSERTS[table]
      const columns = sql
        .slice(sql.indexOf("(") + 1, sql.indexOf(")"))
        .split(", ")
      if (archive.tables[table].length > 0)
        await transaction.executeBatch(
          sql,
          archive.tables[table].map((row) =>
            columns.map((column) => row[column]),
          ),
        )
    }
    await mergeImportedVersion(transaction, archive)
    await advanceCourseGeneration(transaction)
  })
  // The replaced course's rows must not stay readable in free database pages
  // (UG3 review SP-UG3-1), as after an erase. The import is already whole; a
  // failed compaction leaves its data correct and is retried by the next one.
  await compactCourseDatabase(database).catch(() => {})
  clearCoursePreferences()
  // Never rebind this instance: a delayed callback from the old course could
  // otherwise save into an imported course with the very same identifiers.
  invalidateCourseSession(database)
}
