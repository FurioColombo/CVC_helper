import { PowerSyncDatabase } from "@powersync/web"

import { createDatabase } from "@/persistence/db"
import { calculateStudentAge, isStudentMinor } from "@/domain/student"
import fixture from "@/test/fixtures/v0.2.0-course.json"
import {
  insertFixtureTables,
  type FixtureTables,
} from "@/test/u02MigrationHarness"
import { v020Schema } from "@/test/v020Schema"

const tables = fixture.tables as FixtureTables

async function readSnapshot(database: PowerSyncDatabase) {
  const snapshot: FixtureTables = {}
  for (const tableName of Object.keys(tables)) {
    snapshot[tableName] = await database.getAll<Record<string, unknown>>(
      `SELECT * FROM ${tableName} ORDER BY id`,
    )
  }
  return snapshot
}

/**
 * Seed an isolated database with the exact 0.2.0 table schema and the
 * fictitious 0.2.0 course. Close it before the app (or a harness) opens the
 * same file with today's schema.
 */
export async function seedV020Fixture(filename: string) {
  const legacy = new PowerSyncDatabase({
    schema: v020Schema,
    database: { dbFilename: filename },
  })
  await legacy.init()
  await insertFixtureTables(legacy, tables)
  await legacy.close()
}

/**
 * Browser-only proof that a real 0.2.0 database is upgraded and reopened
 * intact: every original column and row survives, the two columns added since
 * (`students.declaredAgeAtCourseStart`, `crews.capacity`) default to null, and
 * an age-only student and a stored crew capacity written through the current
 * schema survive a close and reopen.
 */
export async function runV020MigrationHarness() {
  const filename = `v020-migration-${crypto.randomUUID()}.db`
  await seedV020Fixture(filename)

  const upgraded = createDatabase(filename)
  await upgraded.init()
  const afterUpgrade = await readSnapshot(upgraded)
  const courseStartDate = (
    await upgraded.get<{ startDate: string }>(
      "SELECT startDate FROM courses LIMIT 1",
    )
  ).startDate
  // The age every 0.2.0 student has at the course start, from the stored
  // birth date, with the current rule (a birth date always wins).
  const ages = (
    await upgraded.getAll<{
      id: string
      dateOfBirth: string
      declaredAgeAtCourseStart: number | null
    }>(
      "SELECT id, dateOfBirth, declaredAgeAtCourseStart FROM students ORDER BY id",
    )
  ).map((student) => ({
    id: student.id,
    declaredAgeAtCourseStart: student.declaredAgeAtCourseStart,
    age: calculateStudentAge(student, courseStartDate),
    minor: isStudentMinor(student, courseStartDate),
  }))
  const legacyCapacities = await upgraded.getAll<{
    id: string
    capacity: number | null
  }>("SELECT id, capacity FROM crews ORDER BY id")

  // The same writes the app makes after the update: an age-only student and a
  // stored capacity.
  await upgraded.execute(
    `UPDATE students SET dateOfBirth = ?, declaredAgeAtCourseStart = ?
     WHERE id = ? AND courseId = ?`,
    ["", 26, "student-v020-sara", "course-v020-d2"],
  )
  await upgraded.execute("UPDATE crews SET capacity = ? WHERE id = ?", [
    2,
    "crew-v020-sun-am-1",
  ])
  await upgraded.close()

  const reopened = createDatabase(filename)
  await reopened.init()
  const afterReopen = await readSnapshot(reopened)
  const ageOnlyStudent = await reopened.get<{
    dateOfBirth: string
    declaredAgeAtCourseStart: number | null
  }>(
    "SELECT dateOfBirth, declaredAgeAtCourseStart FROM students WHERE id = ?",
    ["student-v020-sara"],
  )
  const storedCapacity = await reopened.get<{ capacity: number | null }>(
    "SELECT capacity FROM crews WHERE id = ?",
    ["crew-v020-sun-am-1"],
  )
  await reopened.disconnectAndClear()
  await reopened.close()

  return {
    fixture: fixture.tables,
    afterUpgrade,
    afterReopen,
    ages,
    legacyCapacities,
    ageOnlyStudent,
    storedCapacity: storedCapacity.capacity,
  }
}
