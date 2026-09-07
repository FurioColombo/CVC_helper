import { column, PowerSyncDatabase, Schema, Table } from "@powersync/web"

import { createDatabase } from "@/persistence/db"
import fixture from "@/test/fixtures/v0.1.0-course.json"

const oldSchema = new Schema({
  courses: Table.createLocalOnly({
    active: column.integer,
    family: column.text,
    level: column.integer,
    isoWeek: column.integer,
    year: column.integer,
    startDate: column.text,
    endDate: column.text,
    label: column.text,
  }),
  students: Table.createLocalOnly({
    courseId: column.text,
    firstName: column.text,
    surname: column.text,
    nickname: column.text,
    dateOfBirth: column.text,
    sex: column.text,
    phone: column.text,
    size: column.text,
    initialNote: column.text,
    active: column.integer,
  }),
  volunteers: Table.createLocalOnly({
    courseId: column.text,
    name: column.text,
    role: column.text,
  }),
  boats: Table.createLocalOnly({
    courseId: column.text,
    type: column.text,
    number: column.text,
    availability: column.text,
  }),
  faults: Table.createLocalOnly({
    boatId: column.text,
    description: column.text,
    state: column.text,
    createdAt: column.text,
    updatedAt: column.text,
  }),
  dutyAssignments: Table.createLocalOnly({
    courseId: column.text,
    dayId: column.text,
    studentId: column.text,
  }),
  dutySettings: Table.createLocalOnly({
    courseId: column.text,
    desiredPerDay: column.integer,
    fewerDayIds: column.text,
    balanceMinors: column.integer,
    balanceSex: column.integer,
    tieBreaker: column.text,
    stayOverStudentIds: column.text,
    completedDayIds: column.text,
    acknowledgedWarningKeys: column.text,
  }),
  crews: Table.createLocalOnly({
    courseId: column.text,
    sessionId: column.text,
    destination: column.text,
    boatId: column.text,
    position: column.integer,
  }),
  crewMembers: Table.createLocalOnly({
    crewId: column.text,
    personId: column.text,
    personType: column.text,
    position: column.integer,
  }),
  landAssignments: Table.createLocalOnly({
    courseId: column.text,
    sessionId: column.text,
    studentId: column.text,
  }),
  sessionBoats: Table.createLocalOnly({
    courseId: column.text,
    sessionId: column.text,
    boatId: column.text,
    position: column.integer,
  }),
  evaluations: Table.createLocalOnly({
    studentId: column.text,
    sessionId: column.text,
    value: column.text,
    note: column.text,
  }),
  meta: Table.createLocalOnly({ value: column.integer }),
})

type FixtureTables = Record<string, Array<Record<string, unknown>>>

async function seedFixture(database: PowerSyncDatabase) {
  const tables = fixture.tables as FixtureTables
  for (const [tableName, rows] of Object.entries(tables)) {
    for (const row of rows) {
      const columns = Object.keys(row)
      await database.execute(
        `INSERT INTO ${tableName}(${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
        columns.map((name) => row[name]),
      )
    }
  }
}

async function readSnapshot(database: PowerSyncDatabase) {
  const tables = fixture.tables as FixtureTables
  const snapshot: FixtureTables = {}
  for (const tableName of Object.keys(tables)) {
    snapshot[tableName] = await database.getAll<Record<string, unknown>>(
      `SELECT * FROM ${tableName} ORDER BY id`,
    )
  }
  return snapshot
}

/** Browser-only proof that a real 0.1 database is upgraded and reopened intact. */
export async function runU02MigrationHarness() {
  const filename = `u02-migration-${crypto.randomUUID()}.db`
  const legacy = new PowerSyncDatabase({
    schema: oldSchema,
    database: { dbFilename: filename },
  })
  await legacy.init()
  await seedFixture(legacy)
  await legacy.close()

  const upgraded = createDatabase(filename)
  await upgraded.init()
  const afterUpgrade = await readSnapshot(upgraded)
  const student = await upgraded.get<{ courseNote: string | null }>(
    "SELECT courseNote FROM students WHERE id = ?",
    ["student-v010-mario"],
  )
  await upgraded.execute("UPDATE students SET courseNote = ? WHERE id = ?", [
    "Nuova nota 0.2",
    "student-v010-mario",
  ])
  await upgraded.close()

  const reopened = createDatabase(filename)
  await reopened.init()
  const afterReopen = await readSnapshot(reopened)
  const saved = await reopened.get<{ courseNote: string | null }>(
    "SELECT courseNote FROM students WHERE id = ?",
    ["student-v010-mario"],
  )
  await reopened.disconnectAndClear()
  await reopened.close()

  return {
    fixture: fixture.tables,
    afterUpgrade,
    afterReopen,
    defaultCourseNote: student.courseNote,
    reloadedCourseNote: saved.courseNote,
  }
}
