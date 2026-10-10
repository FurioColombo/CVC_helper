import { column, PowerSyncDatabase, Schema, Table } from "@powersync/web"

import fixture from "@/test/fixtures/v0.1.0-course.json"

/**
 * Seeding a legacy database for the migration harnesses. It imports nothing
 * from the app's persistence modules, so seeding never opens the app's own
 * database beside the file being seeded.
 */
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

export type FixtureTables = Record<string, Array<Record<string, unknown>>>

/** Insert every row of a fixture's tables, in object order, as plain SQL. */
export async function insertFixtureTables(
  database: PowerSyncDatabase,
  tables: FixtureTables,
) {
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

/** Seed an isolated database using the exact 0.1.0 table schema and fixture. */
export async function seedLegacyFixture(filename: string) {
  const legacy = new PowerSyncDatabase({
    schema: oldSchema,
    database: { dbFilename: filename },
  })
  await legacy.init()
  await insertFixtureTables(legacy, fixture.tables as FixtureTables)
  await legacy.close()
}
