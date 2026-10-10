import { column, PowerSyncDatabase, Schema, Table } from "@powersync/web"

// Every course table carries `createdAt` and `updatedAt` (UTC ISO, set through
// src/persistence/stamp.ts) and, from D1, every course-scoped row carries its
// course's id directly, so a later per-course sync needs no joins. Columns added
// here start null in an older database; src/persistence/migrations.ts fills
// them before the app reads anything.
const metadata = {
  createdAt: column.text,
  updatedAt: column.text,
}

const courses = Table.createLocalOnly({
  active: column.integer,
  family: column.text,
  level: column.integer,
  isoWeek: column.integer,
  year: column.integer,
  startDate: column.text,
  endDate: column.text,
  label: column.text,
  ...metadata,
})

const students = Table.createLocalOnly({
  courseId: column.text,
  firstName: column.text,
  surname: column.text,
  nickname: column.text,
  dateOfBirth: column.text,
  declaredAgeAtCourseStart: column.integer,
  sex: column.text,
  phone: column.text,
  size: column.text,
  initialNote: column.text,
  courseNote: column.text,
  active: column.integer,
  ...metadata,
})

const volunteers = Table.createLocalOnly({
  courseId: column.text,
  name: column.text,
  role: column.text,
  ...metadata,
})

const boats = Table.createLocalOnly({
  courseId: column.text,
  type: column.text,
  number: column.text,
  availability: column.text,
  ...metadata,
})

const faults = Table.createLocalOnly({
  courseId: column.text,
  boatId: column.text,
  description: column.text,
  state: column.text,
  ...metadata,
})

const dutyAssignments = Table.createLocalOnly({
  courseId: column.text,
  dayId: column.text,
  studentId: column.text,
  ...metadata,
})

const dutySettings = Table.createLocalOnly({
  courseId: column.text,
  desiredPerDay: column.integer,
  fewerDayIds: column.text,
  extraDayIds: column.text,
  balanceMinors: column.integer,
  balanceSex: column.integer,
  tieBreaker: column.text,
  stayOverStudentIds: column.text,
  completedDayIds: column.text,
  acknowledgedWarningKeys: column.text,
  ...metadata,
})

const crews = Table.createLocalOnly({
  courseId: column.text,
  sessionId: column.text,
  // Nullable for local databases created before C1; readCrewPlan normalizes it.
  capacity: column.integer,
  destination: column.text,
  boatId: column.text,
  position: column.integer,
  ...metadata,
})

const crewMembers = Table.createLocalOnly({
  courseId: column.text,
  crewId: column.text,
  personId: column.text,
  personType: column.text,
  position: column.integer,
  ...metadata,
})

const landAssignments = Table.createLocalOnly({
  courseId: column.text,
  sessionId: column.text,
  studentId: column.text,
  ...metadata,
})

const sessionBoats = Table.createLocalOnly({
  courseId: column.text,
  sessionId: column.text,
  boatId: column.text,
  position: column.integer,
  ...metadata,
})

const evaluations = Table.createLocalOnly({
  courseId: column.text,
  studentId: column.text,
  sessionId: column.text,
  value: column.text,
  note: column.text,
  ...metadata,
})

// Retained for schema compatibility with local databases created by the M0
// persistence probe. Product code no longer reads or writes this table.
const meta = Table.createLocalOnly({
  value: column.integer,
})

// The data's own metadata, never course data: the migration ledger (one row
// per applied migration, `id` = "migration:<name>") and, from D3, the data
// version. Erasing a course leaves it, because the schema stays migrated.
const appMeta = Table.createLocalOnly({
  value: column.text,
})

export const AppSchema = new Schema({
  courses,
  students,
  volunteers,
  boats,
  faults,
  dutyAssignments,
  dutySettings,
  crews,
  crewMembers,
  landAssignments,
  sessionBoats,
  evaluations,
  meta,
  appMeta,
})

export function createDatabase(dbFilename = "cvc-helper.db") {
  return new PowerSyncDatabase({
    schema: AppSchema,
    database: { dbFilename },
  })
}

export const db = createDatabase()
