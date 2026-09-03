import assert from "node:assert/strict"

import {
  DUTY_DAYS,
  SESSION_SEQUENCE,
  STUDENT_SIZES,
} from "../src/domain/config.ts"
import { validateCourseState } from "../src/domain/invariants.ts"
import { buildD2FullWeekScenario } from "../src/domain/scenarios.ts"

const scenario = buildD2FullWeekScenario()
const firstNames = scenario.students.map(({ firstName }) => firstName)
const duplicateFirstNames = firstNames.filter(
  (name, index) => firstNames.indexOf(name) !== index,
)
const minors = scenario.students.filter(
  ({ dateOfBirth }) => dateOfBirth && dateOfBirth > "2008-08-29",
)
const sessionIds = new Set(scenario.crews.map(({ sessionId }) => sessionId))
const dutyDayIds = new Set(
  (scenario.dutyAssignments ?? []).map(({ dayId }) => dayId),
)
const dutyOverride = scenario.timeline.find(
  (event) => event.kind === "duty-override",
)
const unavailableEvent = scenario.timeline.find(
  (
    event,
  ): event is Extract<
    (typeof scenario.timeline)[number],
    { kind: "student-availability" }
  > => event.kind === "student-availability" && event.active === 0,
)

assert.equal(scenario.course.label, "D2 35 2026")
assert.equal(scenario.students.length, 21)
assert.ok(minors.length >= 2, "Expected at least two minors")
assert.ok(duplicateFirstNames.length > 0, "Expected duplicate first names")
assert.deepEqual(
  new Set(scenario.students.map(({ size }) => size)),
  new Set(STUDENT_SIZES),
)
assert.ok(scenario.volunteers.some(({ role }) => role === "ADV"))
assert.ok(scenario.volunteers.some(({ role }) => role === "IS"))
assert.ok(scenario.faults.length >= 2)
assert.ok(
  scenario.boats.some(({ availability }) => availability === "unavailable"),
)
assert.equal(dutyDayIds.size, DUTY_DAYS.length)
assert.equal(sessionIds.size, SESSION_SEQUENCE.length)
for (const { id: sessionId } of SESSION_SEQUENCE) {
  const accountedStudentIds = new Set([
    ...scenario.crews
      .filter((crew) => crew.sessionId === sessionId)
      .flatMap(({ studentIds }) => studentIds),
    ...scenario.landAssignments
      .filter((assignment) => assignment.sessionId === sessionId)
      .map(({ studentId }) => studentId),
  ])
  assert.equal(
    accountedStudentIds.size,
    sessionId === "wed-am" || sessionId === "wed-pm" ? 20 : 21,
    `Unexpected accounted-student count in ${sessionId}`,
  )
}
assert.ok(scenario.crews.some(({ destination }) => destination === "mezzi"))
assert.ok(scenario.crews.some(({ volunteerIds }) => volunteerIds.length > 0))
assert.ok(scenario.landAssignments.length > 0)
assert.ok(scenario.evaluations.some(({ note }) => Boolean(note)))
assert.ok(dutyOverride, "Expected a manual duty override")
const overriddenDutyStudentIds = new Set(
  scenario.dutyAssignments
    ?.filter(({ dayId }) => dayId === dutyOverride.dayId)
    .map(({ studentId }) => studentId),
)
assert.equal(
  overriddenDutyStudentIds.has(dutyOverride.removedStudentId),
  false,
  "The overridden student must be absent from the final duty snapshot",
)
assert.equal(
  overriddenDutyStudentIds.has(dutyOverride.addedStudentId),
  true,
  "The replacement student must be present in the final duty snapshot",
)
const wednesdayIndex = DUTY_DAYS.findIndex(({ id }) => id === "wednesday")
assert.equal(
  dutyOverride.removedStudentId,
  scenario.students[wednesdayIndex * 3]!.id,
  "The override must remove the student from the baseline rotation",
)
assert.ok(
  scenario.timeline.some(
    (event) => event.kind === "student-availability" && event.active === 0,
  ),
)
assert.ok(
  scenario.timeline.some(
    (event) => event.kind === "student-availability" && event.active === 1,
  ),
)
assert.ok(scenario.timeline.filter(({ kind }) => kind === "reopen").length >= 2)
assert.ok(unavailableEvent, "Expected a temporary student disable event")
for (const sessionId of ["wed-am", "wed-pm"] as const) {
  assert.equal(
    scenario.crews
      .filter((crew) => crew.sessionId === sessionId)
      .some(({ studentIds }) =>
        studentIds.includes(unavailableEvent.studentId),
      ),
    false,
    `Temporarily disabled student must be absent from ${sessionId}`,
  )
}
assert.equal(
  new Set(scenario.evaluations.map(({ sessionId }) => sessionId)).size,
  SESSION_SEQUENCE.length,
  "Expected evaluations across every session",
)
const unavailableBoatIds = new Set(
  scenario.boats
    .filter(({ availability }) => availability === "unavailable")
    .map(({ id }) => id),
)
assert.equal(
  scenario.sessionBoats.some(({ boatId }) => unavailableBoatIds.has(boatId)),
  false,
  "Unavailable boats must not be selected for a session",
)
assert.deepEqual(
  validateCourseState(scenario),
  [],
  "Full-week scenario violates course-state invariants",
)

console.log(
  "PASS: deterministic D2 full-week scenario and course-state invariants",
)
