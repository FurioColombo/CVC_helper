import { createHash } from "node:crypto"

import {
  validateCourseState,
  type CourseStateSnapshot,
} from "../../domain/invariants"
import { normalizeStudentCourseNote } from "../../domain/studentMigration"

import fixture from "./v0.1.0-course.json"

const TABLE_NAMES = [
  "courses",
  "students",
  "volunteers",
  "boats",
  "faults",
  "dutyAssignments",
  "dutySettings",
  "crews",
  "crewMembers",
  "landAssignments",
  "sessionBoats",
  "evaluations",
  "meta",
] as const

const BASELINE_VOLUNTEER_ROWS = [
  {
    id: "volunteer-v010-adv",
    courseId: "course-v010-d2",
    name: "Anna ADV",
    role: "ADV",
  },
  {
    id: "volunteer-v010-is",
    courseId: "course-v010-d2",
    name: "Ivo IS",
    role: "IS",
  },
] as const

type Fixture = typeof fixture
type Tables = Fixture["tables"]

export interface CompatibilityResult {
  status: "PASS"
  appVersion: string
  schemaContract: string
  fixtureSha256: string
  tableCounts: Record<(typeof TABLE_NAMES)[number], number>
  checks: string[]
}

function toSnapshot(tables: Tables): CourseStateSnapshot {
  const membersByCrew = new Map<
    string,
    Array<(typeof tables.crewMembers)[number]>
  >()
  for (const member of tables.crewMembers) {
    membersByCrew.set(member.crewId, [
      ...(membersByCrew.get(member.crewId) ?? []),
      member,
    ])
  }

  return {
    students: tables.students,
    volunteers: tables.volunteers,
    boats: tables.boats,
    faults: tables.faults,
    dutyAssignments: tables.dutyAssignments,
    completedDutyDayIds: JSON.parse(
      tables.dutySettings[0]?.completedDayIds ?? "[]",
    ) as string[],
    crews: tables.crews.map((crew) => ({
      id: crew.id,
      sessionId: crew.sessionId,
      studentIds: (membersByCrew.get(crew.id) ?? [])
        .filter(({ personType }) => personType === "student")
        .map(({ personId }) => personId),
      volunteerIds: (membersByCrew.get(crew.id) ?? [])
        .filter(({ personType }) => personType === "volunteer")
        .map(({ personId }) => personId),
      destination: crew.destination,
      ...(crew.boatId ? { boatId: crew.boatId } : {}),
    })),
    landAssignments: tables.landAssignments,
    sessionBoats: tables.sessionBoats,
    evaluations: tables.evaluations,
  }
}

function assertFixtureReferences(tables: Tables) {
  const courseIds = new Set(tables.courses.map(({ id }) => id))
  const crewIds = new Set(tables.crews.map(({ id }) => id))
  const errors: string[] = []

  for (const tableName of [
    "students",
    "volunteers",
    "boats",
    "dutyAssignments",
    "dutySettings",
    "crews",
    "landAssignments",
    "sessionBoats",
  ] as const) {
    for (const row of tables[tableName]) {
      if (!courseIds.has(row.courseId)) {
        errors.push(`${tableName}:${row.id} has missing course ${row.courseId}`)
      }
    }
  }

  for (const member of tables.crewMembers) {
    if (!crewIds.has(member.crewId)) {
      errors.push(`crewMembers:${member.id} has missing crew ${member.crewId}`)
    }
  }

  if (errors.length > 0) throw new Error(errors.join("\n"))
}

export function verifyV010Compatibility(): CompatibilityResult {
  if (fixture.appVersion !== "0.1.0") {
    throw new Error(`Unexpected fixture version: ${fixture.appVersion}`)
  }
  const cloned = JSON.parse(JSON.stringify(fixture)) as Fixture
  if (JSON.stringify(cloned) !== JSON.stringify(fixture)) {
    throw new Error("0.1.0 fixture changed during JSON storage round-trip")
  }

  const tableNames = Object.keys(cloned.tables).sort()
  const expectedTableNames = [...TABLE_NAMES].sort()
  if (JSON.stringify(tableNames) !== JSON.stringify(expectedTableNames)) {
    throw new Error(
      "0.1.0 fixture table set does not match the baseline schema",
    )
  }

  assertFixtureReferences(cloned.tables)
  if (
    JSON.stringify(cloned.tables.volunteers) !==
    JSON.stringify(BASELINE_VOLUNTEER_ROWS)
  ) {
    throw new Error("0.1.0 ADV/IS volunteer rows changed during migration")
  }
  const normalizedStudents = cloned.tables.students.map((student) =>
    normalizeStudentCourseNote({ ...student }),
  )
  if (normalizedStudents.some(({ courseNote }) => courseNote !== null)) {
    throw new Error("0.1.0 student course-note default was not applied")
  }
  const issues = validateCourseState({
    ...toSnapshot(cloned.tables),
    students: normalizedStudents,
  })
  if (issues.length > 0) {
    throw new Error(
      `0.1.0 fixture violates domain invariants:\n${issues
        .map(({ code, path }) => `${code}: ${path}`)
        .join("\n")}`,
    )
  }

  const tableCounts = Object.fromEntries(
    TABLE_NAMES.map((name) => [name, cloned.tables[name].length]),
  ) as CompatibilityResult["tableCounts"]
  const serialized = JSON.stringify(fixture)

  return {
    status: "PASS",
    appVersion: fixture.appVersion,
    schemaContract: fixture.schemaContract,
    fixtureSha256: createHash("sha256").update(serialized).digest("hex"),
    tableCounts,
    checks: [
      "baseline table set present",
      "JSON storage round-trip is lossless",
      "course and crew fixture references resolve",
      "current domain invariants accept the 0.1.0 records",
      "baseline ADV/IS volunteer rows remain byte-equivalent under the CT enum extension",
      "new optional course/week note defaults to null at the production read boundary",
    ],
  }
}
