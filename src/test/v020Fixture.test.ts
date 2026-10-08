import { describe, expect, it, vi } from "vitest"

// `db.ts` opens a PowerSync database when it is imported; only its schema is
// wanted here, and the real database needs a browser.
vi.mock("@powersync/web", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@powersync/web")>()),
  PowerSyncDatabase: class {},
}))

import { AppSchema } from "@/persistence/db"
import {
  DUTY_DAYS,
  SESSION_SEQUENCE,
  type CourseFamily,
  type CourseLevel,
} from "@/domain/config"
import { normalizeCrewCapacity } from "@/domain/crews"
import { validateCourseState } from "@/domain/invariants"
import { calculateStudentAge, isStudentMinor } from "@/domain/student"
import fixture from "@/test/fixtures/v0.2.0-course.json"
import { v020Schema } from "@/test/v020Schema"

type Rows = Array<Record<string, unknown>>
const tables = fixture.tables as Record<string, Rows>

function columnsByTable(schema: { toJSON: () => unknown }) {
  const json = schema.toJSON() as {
    tables: Array<{ name: string; columns: Array<{ name: string }> }>
  }
  return Object.fromEntries(
    json.tables.map(({ name, columns }) => [
      name,
      columns.map((column) => column.name).sort(),
    ]),
  )
}

describe("0.2.0 migration fixture", () => {
  it("is shaped by the frozen 0.2.0 schema, which lacks exactly the two columns added since", () => {
    const frozen = columnsByTable(v020Schema)
    const current = columnsByTable(AppSchema)

    // Same tables; the only differences are the two nullable columns.
    expect(Object.keys(frozen).sort()).toEqual(Object.keys(current).sort())
    const added = Object.entries(current).flatMap(([table, columns]) =>
      columns
        .filter((column) => !frozen[table]!.includes(column))
        .map((column) => `${table}.${column}`),
    )
    expect(added.sort()).toEqual([
      "crews.capacity",
      "students.declaredAgeAtCourseStart",
    ])
    for (const [table, columns] of Object.entries(frozen)) {
      expect(
        columns.every((column) => current[table]!.includes(column)),
        `${table} loses no 0.2.0 column`,
      ).toBe(true)
    }

    // Every fixture row uses 0.2.0 columns only (plus the row id).
    expect(Object.keys(tables).sort()).toEqual(Object.keys(frozen).sort())
    for (const [table, rows] of Object.entries(tables)) {
      for (const row of rows) {
        const unknown = Object.keys(row).filter(
          (name) => name !== "id" && !frozen[table]!.includes(name),
        )
        expect(unknown, `${table}:${String(row.id)}`).toEqual([])
      }
    }
  })

  it("has unique ids and resolvable references", () => {
    for (const [table, rows] of Object.entries(tables)) {
      const ids = rows.map(({ id }) => id)
      expect(new Set(ids).size, `${table} ids are unique`).toBe(ids.length)
    }
    const ids = (table: string) => new Set(tables[table]!.map(({ id }) => id))
    const refs: Array<[string, string, string]> = [
      ["students", "courseId", "courses"],
      ["volunteers", "courseId", "courses"],
      ["boats", "courseId", "courses"],
      ["faults", "boatId", "boats"],
      ["dutyAssignments", "studentId", "students"],
      ["crews", "courseId", "courses"],
      ["crews", "boatId", "boats"],
      ["crewMembers", "crewId", "crews"],
      ["landAssignments", "studentId", "students"],
      ["sessionBoats", "boatId", "boats"],
      ["evaluations", "studentId", "students"],
    ]
    for (const [table, field, target] of refs) {
      for (const row of tables[table]!) {
        const value = row[field]
        if (value === null) continue
        expect(
          ids(target).has(value),
          `${table}:${String(row.id)}.${field}`,
        ).toBe(true)
      }
    }
    expect(
      tables.crewMembers!.every(({ personType, personId }) =>
        ids(personType === "student" ? "students" : "volunteers").has(personId),
      ),
    ).toBe(true)
    expect(
      tables.dutyAssignments!.every(({ dayId }) =>
        DUTY_DAYS.some(({ id }) => id === dayId),
      ),
    ).toBe(true)
    expect(
      [...tables.crews!, ...tables.landAssignments!, ...tables.sessionBoats!]
        .map(({ sessionId }) => sessionId)
        .every((id) => SESSION_SEQUENCE.some((session) => session.id === id)),
    ).toBe(true)
  })

  it("passes the current domain invariants, with each crew in its 0.2.0 packed layout", () => {
    const course = tables.courses![0]!
    const membersByCrew = new Map<string, Rows>()
    for (const member of tables.crewMembers!) {
      const crewId = member.crewId as string
      membersByCrew.set(crewId, [...(membersByCrew.get(crewId) ?? []), member])
    }
    // 0.2.0 stored members packed, position 0..n-1, with no capacity column.
    for (const members of membersByCrew.values()) {
      expect(members.map(({ position }) => position)).toEqual(
        members.map((_, index) => index),
      )
    }
    const issues = validateCourseState({
      students: tables.students as never,
      volunteers: tables.volunteers as never,
      boats: tables.boats as never,
      faults: tables.faults as never,
      dutyAssignments: tables.dutyAssignments as never,
      completedDutyDayIds: JSON.parse(
        tables.dutySettings![0]!.completedDayIds as string,
      ),
      crews: tables.crews!.map((crew) => {
        const members = membersByCrew.get(crew.id as string) ?? []
        const of = (type: string) =>
          members.filter(({ personType }) => personType === type)
        return {
          id: crew.id as string,
          sessionId: crew.sessionId as string,
          studentIds: of("student").map(({ personId }) => personId as string),
          volunteerIds: of("volunteer").map(
            ({ personId }) => personId as string,
          ),
          destination: crew.destination as string,
          ...(crew.boatId ? { boatId: crew.boatId as string } : {}),
        }
      }),
      landAssignments: tables.landAssignments as never,
      sessionBoats: tables.sessionBoats as never,
      evaluations: tables.evaluations as never,
      course: {
        family: course.family as CourseFamily,
        level: course.level as CourseLevel,
        startDate: course.startDate as string,
      },
    })
    expect(issues).toEqual([])
  })

  it("reads every legacy crew as a full or part-full pair on the D2 standard size", () => {
    const course = tables.courses![0]!
    for (const crew of tables.crews!) {
      const members = tables.crewMembers!.filter(
        ({ crewId }) => crewId === crew.id,
      )
      expect(
        normalizeCrewCapacity(
          (crew.capacity as number | null | undefined) ?? null,
          members.length,
          course.family as CourseFamily,
          course.level as CourseLevel,
        ),
        String(crew.id),
      ).toBe(2)
    }
    // The part-full crews the visible journey fills through a free seat.
    expect(
      tables.crewMembers!.filter(
        ({ crewId }) => crewId === "crew-v020-sat-pm-2",
      ),
    ).toHaveLength(1)
  })

  it("gives every student an age from the stored birth date at the course start, including the 17-to-18 and the 18th-birthday edges", () => {
    const course = tables.courses![0]!
    const ageOf = (id: string) => {
      const student = tables.students!.find((row) => row.id === id)!
      // 0.2.0 stored birth dates only, never a declared age.
      expect(student.dateOfBirth).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect("declaredAgeAtCourseStart" in student).toBe(false)
      const source = {
        dateOfBirth: student.dateOfBirth as string,
        declaredAgeAtCourseStart: null,
      }
      return {
        age: calculateStudentAge(source, course.startDate as string),
        minor: isStudentMinor(source, course.startDate as string),
      }
    }
    expect(ageOf("student-v020-tommaso")).toEqual({ age: 15, minor: true })
    // Turns 18 on 2026-09-22, three days into the course: a minor at the start.
    expect(ageOf("student-v020-elisa")).toEqual({ age: 17, minor: true })
    // Turns 18 on the first day itself: an adult at the start.
    expect(ageOf("student-v020-irene")).toEqual({ age: 18, minor: false })
    expect(ageOf("student-v020-davide")).toEqual({ age: 31, minor: false })
    expect(ageOf("student-v020-sara")).toEqual({ age: 25, minor: false })
    expect(ageOf("student-v020-paolo")).toEqual({ age: 38, minor: false })
  })
})
