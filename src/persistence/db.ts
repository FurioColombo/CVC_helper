import { column, PowerSyncDatabase, Schema, Table } from "@powersync/web"

const courses = Table.createLocalOnly({
  active: column.integer,
  family: column.text,
  level: column.integer,
  isoWeek: column.integer,
  year: column.integer,
  startDate: column.text,
  endDate: column.text,
  label: column.text,
})

const students = Table.createLocalOnly({
  courseId: column.text,
  firstName: column.text,
  surname: column.text,
  nickname: column.text,
  dateOfBirth: column.text,
  sex: column.text,
  phone: column.text,
  active: column.integer,
})

const volunteers = Table.createLocalOnly({
  courseId: column.text,
  name: column.text,
  role: column.text,
})

const boats = Table.createLocalOnly({
  courseId: column.text,
  type: column.text,
  number: column.text,
  availability: column.text,
})

const faults = Table.createLocalOnly({
  boatId: column.text,
  description: column.text,
  state: column.text,
  createdAt: column.text,
  updatedAt: column.text,
})

const crews = Table.createLocalOnly({
  courseId: column.text,
  sessionId: column.text,
  destination: column.text,
  boatId: column.text,
})

const crewMembers = Table.createLocalOnly({
  crewId: column.text,
  personId: column.text,
  personType: column.text,
})

const landAssignments = Table.createLocalOnly({
  courseId: column.text,
  sessionId: column.text,
  studentId: column.text,
})

const evaluations = Table.createLocalOnly({
  studentId: column.text,
  sessionId: column.text,
  value: column.text,
  note: column.text,
})

const meta = Table.createLocalOnly({
  value: column.integer,
})

export const AppSchema = new Schema({
  courses,
  students,
  volunteers,
  boats,
  faults,
  crews,
  crewMembers,
  landAssignments,
  evaluations,
  meta,
})

export type DatabaseRecords = (typeof AppSchema)["types"]

export function createDatabase(dbFilename = "cvc-helper.db") {
  return new PowerSyncDatabase({
    schema: AppSchema,
    database: { dbFilename },
  })
}

export const db = createDatabase()
