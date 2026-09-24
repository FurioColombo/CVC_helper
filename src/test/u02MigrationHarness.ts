import { column, PowerSyncDatabase, Schema, Table } from "@powersync/web"

import { createDatabase } from "@/persistence/db"
import { saveCrewPlan } from "@/persistence/crews"
import { saveDutyPlan, type DutySettingsRecord } from "@/persistence/duties"
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

/** Seed an isolated database using the exact 0.1.0 table schema and fixture. */
export async function seedLegacyFixture(filename: string) {
  const legacy = new PowerSyncDatabase({
    schema: oldSchema,
    database: { dbFilename: filename },
  })
  await legacy.init()
  await seedFixture(legacy)
  await legacy.close()
}

/** Browser-only proof that a real 0.1 database is upgraded and reopened intact. */
export async function runU02MigrationHarness() {
  const filename = `u02-migration-${crypto.randomUUID()}.db`
  await seedLegacyFixture(filename)

  const upgraded = createDatabase(filename)
  await upgraded.init()
  const afterUpgrade = await readSnapshot(upgraded)
  const student = await upgraded.get<{ courseNote: string | null }>(
    "SELECT courseNote FROM students WHERE id = ?",
    ["student-v010-mario"],
  )
  const dutySettings = await upgraded.get<{ extraDayIds: string | null }>(
    "SELECT extraDayIds FROM dutySettings WHERE id = ?",
    ["course-v010-d2"],
  )
  if (dutySettings.extraDayIds !== null) {
    throw new Error("Legacy duty extra-day selection did not default to null")
  }
  await upgraded.execute("UPDATE students SET courseNote = ? WHERE id = ?", [
    "Nuova nota 0.2",
    "student-v010-mario",
  ])
  await upgraded.execute(
    "UPDATE dutySettings SET extraDayIds = ? WHERE id = ?",
    ['["sunday"]', "course-v010-d2"],
  )
  await upgraded.close()

  const reopened = createDatabase(filename)
  await reopened.init()
  const afterReopen = await readSnapshot(reopened)
  const saved = await reopened.get<{ courseNote: string | null }>(
    "SELECT courseNote FROM students WHERE id = ?",
    ["student-v010-mario"],
  )
  const reloadedDutySettings = await reopened.get<{
    extraDayIds: string | null
  }>("SELECT extraDayIds FROM dutySettings WHERE id = ?", ["course-v010-d2"])
  if (reloadedDutySettings.extraDayIds !== '["sunday"]') {
    throw new Error("Explicit duty extra-day selection did not survive reload")
  }
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

/** Existing 0.1 SQLite table gains the nullable age field and reopens intact. */
export async function runDeclaredAgeSchemaHarness() {
  const filename = `declared-age-migration-${crypto.randomUUID()}.db`
  await seedLegacyFixture(filename)

  const upgraded = createDatabase(filename)
  await upgraded.init()
  const legacyStudent = await upgraded.get<{
    dateOfBirth: string
    declaredAgeAtCourseStart: number | null
  }>(
    "SELECT dateOfBirth, declaredAgeAtCourseStart FROM students WHERE id = ?",
    ["student-v010-mario"],
  )
  if (
    legacyStudent.dateOfBirth !== "2000-03-12" ||
    legacyStudent.declaredAgeAtCourseStart !== null
  ) {
    throw new Error(
      "Existing student data did not survive the additive age migration",
    )
  }

  await upgraded.execute(
    `UPDATE students
     SET dateOfBirth = ?, declaredAgeAtCourseStart = ?
     WHERE id = ? AND courseId = ?`,
    ["", 17, "student-v010-mario", "course-v010-d2"],
  )
  await upgraded.close()

  const reopened = createDatabase(filename)
  await reopened.init()
  const ageOnlyStudent = await reopened.get<{
    dateOfBirth: string
    declaredAgeAtCourseStart: number | null
  }>(
    "SELECT dateOfBirth, declaredAgeAtCourseStart FROM students WHERE id = ?",
    ["student-v010-mario"],
  )
  await reopened.disconnectAndClear()
  await reopened.close()

  return { legacyStudent, ageOnlyStudent }
}

/** Real SQLite regression for stable legacy row IDs after ordinary app saves. */
export async function runStableIdMigrationHarness() {
  const filename = `stable-id-migration-${crypto.randomUUID()}.db`
  await seedLegacyFixture(filename)
  const upgraded = createDatabase(filename)
  await upgraded.init()
  const courseId = "course-v010-d2"
  const assignments = [
    { dayId: "saturday" as const, studentId: "student-v010-mario" },
    { dayId: "sunday" as const, studentId: "student-v010-giulia" },
  ]
  const settings: DutySettingsRecord = {
    desiredPerDay: 3,
    fewerDayIds: [],
    balanceMinors: true,
    balanceSex: true,
    tieBreaker: "alphabetical",
    stayOverStudentIds: ["student-v010-giulia"],
    completedDayIds: ["saturday"],
    acknowledgedWarningKeys: [],
  }
  const crewPlan = {
    crews: [
      {
        id: "crew-v010-sat-pm-1",
        sessionId: "sat-pm" as const,
        destination: "boat" as const,
        boatId: "boat-v010-quest-7",
        members: [
          { personId: "student-v010-mario", personType: "student" as const },
          { personId: "volunteer-v010-adv", personType: "volunteer" as const },
        ],
      },
      {
        id: "crew-v010-sat-pm-2",
        sessionId: "sat-pm" as const,
        destination: "mezzi" as const,
        boatId: null,
        members: [
          { personId: "student-v010-giulia", personType: "student" as const },
        ],
      },
    ],
    landStudentIds: [],
    selectedBoatIds: ["boat-v010-quest-7"],
  }
  const before = await readSnapshot(upgraded)
  await saveDutyPlan(courseId, assignments, settings, upgraded)
  await saveCrewPlan(courseId, "sat-pm", crewPlan, upgraded)
  await saveCrewPlan(
    courseId,
    "sun-am",
    { crews: [], landStudentIds: ["student-v010-giulia"], selectedBoatIds: [] },
    upgraded,
  )
  const afterNoOp = await readSnapshot(upgraded)
  await saveDutyPlan(
    courseId,
    [...assignments, { dayId: "friday", studentId: "student-v010-giulia" }],
    settings,
    upgraded,
  )
  await saveCrewPlan(
    courseId,
    "sat-pm",
    {
      ...crewPlan,
      crews: [
        crewPlan.crews[0]!,
        { ...crewPlan.crews[1]!, destination: "unassigned" },
      ],
    },
    upgraded,
  )
  await upgraded.close()
  const reopened = createDatabase(filename)
  await reopened.init()
  const afterEditAndReopen = await readSnapshot(reopened)
  await reopened.disconnectAndClear()
  await reopened.close()
  return { before, afterNoOp, afterEditAndReopen }
}
