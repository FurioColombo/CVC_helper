import { column, Schema, Table } from "@powersync/web"

/**
 * The PowerSync local-only tables exactly as `src/persistence/db.ts` declared
 * them at the `v0.2.0` tag. It is frozen on purpose: UG2 opens a database
 * created with it using today's `AppSchema`, which is what a phone that last
 * ran 0.2.0 does after the update.
 *
 * Against 0.1.0 this adds `students.courseNote` and `dutySettings.extraDayIds`
 * (both already present here). Against today's schema it lacks exactly two
 * nullable columns, pinned by `v020Schema.test.ts`:
 * `students.declaredAgeAtCourseStart` and `crews.capacity`.
 */
export const v020Schema = new Schema({
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
    courseNote: column.text,
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
    extraDayIds: column.text,
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
