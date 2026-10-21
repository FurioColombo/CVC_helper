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
  await database.writeTransaction(async (transaction) => {
    for (const [tableName, rows] of Object.entries(tables)) {
      let pendingSql: string | undefined
      let pendingParameters: unknown[][] = []

      const flush = async () => {
        if (pendingSql === undefined) return
        await transaction.executeBatch(pendingSql, pendingParameters)
        pendingSql = undefined
        pendingParameters = []
      }

      for (const row of rows) {
        const columns = Object.keys(row)
        const sql = `INSERT INTO ${tableName}(${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`
        if (sql !== pendingSql) {
          await flush()
          pendingSql = sql
        }
        pendingParameters.push(columns.map((name) => row[name]))
      }
      await flush()
    }
  })

  for (const [tableName, expectedRows] of Object.entries(tables)) {
    const actualRows = await database.getAll<Record<string, unknown>>(
      `SELECT * FROM ${tableName}`,
    )
    if (actualRows.length !== expectedRows.length) {
      throw new Error(`Fixture row count mismatch in ${tableName}`)
    }

    const actualById = new Map(actualRows.map((row) => [row.id, row]))

    for (const expectedRow of expectedRows) {
      const actualRow = actualById.get(expectedRow.id)
      if (actualRow === undefined) {
        throw new Error(
          `Fixture row ${String(expectedRow.id)} missing in ${tableName}`,
        )
      }

      for (const [column, value] of Object.entries(expectedRow)) {
        if (actualRow[column] !== value) {
          throw new Error(
            `Fixture value mismatch in ${tableName}.${column} of row ${String(expectedRow.id)}`,
          )
        }
      }
      // A repeated expected id then fails at the lookup above.
      actualById.delete(actualRow.id)
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
  // Read before closing: closing straight after a write lost WebKit's test
  // page now and then (D2 review DP-4).
  await legacy.get("SELECT count(*) AS count FROM courses")
  await legacy.close()
}
