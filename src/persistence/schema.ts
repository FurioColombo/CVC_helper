import { column, PowerSyncDatabase, Schema, Table } from "@powersync/web"

// Every course table carries `createdAt` and `updatedAt` (UTC ISO, set through
// src/persistence/stamp.ts) and, from D1, every course-scoped row carries its
// course's id directly, so a later per-course sync needs no joins. Columns added
// here start null in an older database; src/persistence/migrations.ts fills
// them before the app reads anything. This module only declares; the app's
// one database is opened in db.ts.
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

// D2: the lists of `dutySettings`, item by item (src/persistence/dutyItems.ts).
// The JSON list columns above stay, still written, while an app that knows only
// them can open the database (03 §3.1).
const dutySettingItems = Table.createLocalOnly({
  courseId: column.text,
  kind: column.text,
  value: column.text,
  position: column.integer,
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

// Never course data: erasing a course leaves it. Every schema since the M0
// persistence probe declares it, so no older app sharing the database (03 §3.1)
// drops it, unlike a table only a newer schema declares. It holds the migration
// ledger (one row per applied migration, `id` = "migration:<id>", `value` the
// time it ran, in epoch milliseconds) and, from D3, the data version.
const meta = Table.createLocalOnly({
  value: column.integer,
})

export const AppSchema = new Schema({
  courses,
  students,
  volunteers,
  boats,
  faults,
  dutyAssignments,
  dutySettings,
  dutySettingItems,
  crews,
  crewMembers,
  landAssignments,
  sessionBoats,
  evaluations,
  meta,
})

/** Course tables, parents before children; all but `courses` name their course. */
export const COURSE_TABLES = [
  "courses",
  "students",
  "volunteers",
  "boats",
  "faults",
  "dutyAssignments",
  "dutySettings",
  "dutySettingItems",
  "crews",
  "crewMembers",
  "landAssignments",
  "sessionBoats",
  "evaluations",
] as const

/** Tables that name their course from D1, and the parent it is copied from. */
export const COURSE_PARENTS = {
  faults: { table: "boats", key: "boatId" },
  crewMembers: { table: "crews", key: "crewId" },
  evaluations: { table: "students", key: "studentId" },
} as const

export function createDatabase(dbFilename: string) {
  return new PowerSyncDatabase({
    schema: AppSchema,
    database: { dbFilename },
  })
}
