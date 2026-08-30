import assert from "node:assert/strict"

import {
  BOAT_TYPES,
  COURSE_CONFIG,
  CREW_DESTINATIONS,
  DUTY_DAYS,
  DUTY_TIE_BREAKERS,
  EVALUATION_VALUES,
  FAULT_STATES,
  SESSION_SEQUENCE,
  SIZE_WARNING_MATRIX,
  STUDENT_SEXES,
  STUDENT_SIZES,
  VOLUNTEER_ROLES,
} from "../src/domain/config.ts"
import { validateCourseState } from "../src/domain/invariants.ts"
import { buildD2FoundationScenario } from "../src/domain/scenarios.ts"

assert.equal(SESSION_SEQUENCE.length, 13, "Expected 13 sailing sessions")
assert.equal(DUTY_DAYS.length, 7, "Expected 7 duty rotations")
assert.equal(new Set(SESSION_SEQUENCE.map(({ id }) => id)).size, 13)
assert.equal(new Set(DUTY_DAYS.map(({ id }) => id)).size, 7)

for (const [code, config] of Object.entries(COURSE_CONFIG)) {
  assert.ok(
    BOAT_TYPES.includes(config.defaultBoatType),
    `${code} references an unknown boat type`,
  )
}

for (const code of ["D2", "D3", "D4", "D5"] as const) {
  assert.equal(COURSE_CONFIG[code].standardCrewSize, 2)
}

for (const left of STUDENT_SIZES) {
  for (const right of STUDENT_SIZES) {
    assert.equal(
      SIZE_WARNING_MATRIX[left][right],
      SIZE_WARNING_MATRIX[right][left],
      `Size matrix is not symmetric for ${left}/${right}`,
    )
  }
}

for (const values of [
  CREW_DESTINATIONS,
  EVALUATION_VALUES.map(({ symbol }) => symbol),
  FAULT_STATES,
  DUTY_TIE_BREAKERS,
  VOLUNTEER_ROLES,
  STUDENT_SEXES.map(({ id }) => id),
]) {
  assert.equal(
    values.length,
    new Set(values).size,
    "Canonical values must be unique",
  )
}

assert.deepEqual(
  validateCourseState(buildD2FoundationScenario()),
  [],
  "Foundation scenario violates course-state invariants",
)

console.log("PASS: canonical domain tables and runtime foundation scenario")
