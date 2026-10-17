import { describe, expect, it } from "vitest"

import {
  archiveSummary,
  CourseArchiveError,
  createCourseArchive,
  parseCourseArchive,
} from "@/persistence/courseArchiveFormat"
import {
  dutySettingItems,
  type DutySettingLists,
} from "@/persistence/dutyItems"
import type { DataVersion, Version } from "@/domain/compatibility"
import type {
  CourseArchiveRow,
  CourseArchiveTables,
} from "@/persistence/courseArchiveFormat"
import { AppSchema, COURSE_TABLES } from "@/persistence/schema"
import legacyFixture from "@/test/fixtures/v0.3.0-course.json"

const APP: Version = { major: 0, minor: 4, patch: 0 }
const DATA_VERSION: DataVersion = {
  version: { major: 0, minor: 4, patch: 0 },
  minimumWriter: { major: 0, minor: 3, patch: 0 },
}
const CREATED_AT = "2026-09-01T12:00:00.000Z"
const UPDATED_AT = "2026-09-02T12:34:56.789Z"
const BASE_LISTS = {
  fewerDayIds: ["saturday"],
  stayOverStudentIds: ["student-1"],
  completedDayIds: [] as string[],
  acknowledgedWarningKeys: ["minor-balance:2,0"],
}

function sampleTables(): CourseArchiveTables {
  const lists = {
    ...BASE_LISTS,
    extraDayIds: [] as string[],
  }
  return {
    courses: [
      {
        id: "course-1",
        active: 1,
        family: "Deriva",
        level: 2,
        isoWeek: 38,
        year: 2026,
        startDate: "2026-09-19",
        endDate: "2026-09-26",
        label: "D2 38 2026",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    ],
    students: [
      {
        id: "student-1",
        courseId: "course-1",
        firstName: "Ada",
        surname: "Rossi",
        nickname: null,
        dateOfBirth: null,
        declaredAgeAtCourseStart: 19,
        sex: "female",
        phone: null,
        size: "M",
        initialNote: "Prima esperienza",
        courseNote: null,
        active: 1,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    ],
    volunteers: [
      {
        id: "volunteer-1",
        courseId: "course-1",
        name: "Luca",
        role: "ADV",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    ],
    boats: [
      {
        id: "boat-1",
        courseId: "course-1",
        type: "RS Quest",
        number: "17",
        availability: "available",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    ],
    faults: [
      {
        id: "fault-1",
        courseId: "course-1",
        boatId: "boat-1",
        description: "Cima da controllare",
        state: "open",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    ],
    dutyAssignments: [
      {
        id: "duty-1",
        courseId: "course-1",
        dayId: "saturday",
        studentId: "student-1",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    ],
    dutySettings: [
      {
        id: "course-1",
        courseId: "course-1",
        desiredPerDay: 0,
        fewerDayIds: JSON.stringify(lists.fewerDayIds),
        extraDayIds: JSON.stringify(lists.extraDayIds),
        balanceMinors: 1,
        balanceSex: 0,
        tieBreaker: "alphabetical",
        stayOverStudentIds: JSON.stringify(lists.stayOverStudentIds),
        completedDayIds: JSON.stringify(lists.completedDayIds),
        acknowledgedWarningKeys: JSON.stringify(lists.acknowledgedWarningKeys),
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    ],
    dutySettingItems: dutySettingItems("course-1", lists).map((item) => ({
      ...item,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    })),
    crews: [
      {
        id: "crew-1",
        courseId: "course-1",
        sessionId: "sat-pm",
        capacity: null,
        destination: "boat",
        boatId: "boat-1",
        position: 0,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    ],
    crewMembers: [
      {
        id: "member-student-1",
        courseId: "course-1",
        crewId: "crew-1",
        personId: "student-1",
        personType: "student",
        position: 0,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
      {
        id: "member-volunteer-1",
        courseId: "course-1",
        crewId: "crew-1",
        personId: "volunteer-1",
        personType: "volunteer",
        position: 1,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    ],
    landAssignments: [],
    sessionBoats: [
      {
        id: "selection-1",
        courseId: "course-1",
        sessionId: "sat-pm",
        boatId: "boat-1",
        position: 0,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    ],
    evaluations: [
      {
        id: "evaluation-1",
        courseId: "course-1",
        studentId: "student-1",
        sessionId: "sat-pm",
        value: "++",
        note: null,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    ],
  }
}

function enrichedLegacyFixtureTables(): CourseArchiveTables {
  const legacyTables = legacyFixture.tables as unknown as Record<
    string,
    CourseArchiveRow[]
  >
  const rowsById = Object.fromEntries(
    Object.entries(legacyTables).map(([table, rows]) => [
      table,
      new Map(rows.map((row) => [row.id, row])),
    ]),
  ) as Record<string, Map<string, CourseArchiveRow>>
  const tables = Object.fromEntries(
    COURSE_TABLES.map((table) => [
      table,
      table === "dutySettingItems"
        ? []
        : legacyTables[table]!.map((source) => {
            const row = { ...source }
            if (table === "faults") {
              row.courseId = rowsById.boats!.get(row.boatId as string)!
                .courseId as string
            } else if (table === "crewMembers") {
              row.courseId = rowsById.crews!.get(row.crewId as string)!
                .courseId as string
            } else if (table === "evaluations") {
              row.courseId = rowsById.students!.get(row.studentId as string)!
                .courseId as string
            }
            // The fixture omits one nullable value on Marta, as an older read
            // can do before export serializes the SQL NULL explicitly.
            if (
              table === "students" &&
              row.declaredAgeAtCourseStart === undefined
            ) {
              row.declaredAgeAtCourseStart = null
            }
            row.createdAt ??= CREATED_AT
            row.updatedAt ??= UPDATED_AT
            return row
          }),
    ]),
  ) as CourseArchiveTables

  const settings = tables.dutySettings[0]!
  const lists: DutySettingLists = {
    fewerDayIds: JSON.parse(settings.fewerDayIds as string) as string[],
    extraDayIds: JSON.parse(settings.extraDayIds as string) as string[],
    stayOverStudentIds: JSON.parse(
      settings.stayOverStudentIds as string,
    ) as string[],
    completedDayIds: JSON.parse(settings.completedDayIds as string) as string[],
    acknowledgedWarningKeys: JSON.parse(
      settings.acknowledgedWarningKeys as string,
    ) as string[],
  }
  tables.dutySettingItems = dutySettingItems(
    settings.courseId as string,
    lists,
  ).map((item) => ({
    ...item,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  }))
  return tables
}

function expectArchiveError(
  action: () => unknown,
  code: CourseArchiveError["code"] = "invalid-data",
) {
  try {
    action()
    throw new Error("Expected archive validation to fail")
  } catch (error) {
    expect(error).toBeInstanceOf(CourseArchiveError)
    expect((error as CourseArchiveError).code).toBe(code)
    expect((error as Error).message).not.toContain("Ada")
  }
}

describe("course archive format", () => {
  it("keeps identifiers, timestamps and row values verbatim", () => {
    const tables = sampleTables()
    tables.students[0]!.firstName = " Ada "
    const archive = createCourseArchive(tables, DATA_VERSION, APP)

    expect(archive.tables).toEqual(tables)
    expect(archive.tables.students[0]!.id).toBe("student-1")
    expect(archive.tables.students[0]!.firstName).toBe(" Ada ")
    expect(archive.tables.faults[0]!.createdAt).toBe(CREATED_AT)
    expect(archiveSummary(archive)).toEqual({
      label: "D2 38 2026",
      students: 1,
      volunteers: 1,
      boats: 1,
    })

    tables.students[0]!.id = "changed-after-validation"
    expect(archive.tables.students[0]!.id).toBe("student-1")
  })

  it("allows the recoverable missing-age state without inventing a value", () => {
    const tables = sampleTables()
    tables.students[0]!.dateOfBirth = null
    tables.students[0]!.declaredAgeAtCourseStart = null

    const archive = createCourseArchive(tables, DATA_VERSION, APP)

    expect(archive.tables.students[0]!.dateOfBirth).toBeNull()
    expect(archive.tables.students[0]!.declaredAgeAtCourseStart).toBeNull()
  })

  it("keeps nullable legacy crew positions verbatim", () => {
    const tables = sampleTables()
    tables.crews[0]!.position = null
    tables.crewMembers[0]!.position = null
    tables.sessionBoats[0]!.position = null

    const archive = createCourseArchive(tables, DATA_VERSION, APP)

    expect(archive.tables.crews[0]!.position).toBeNull()
    expect(archive.tables.crewMembers[0]!.position).toBeNull()
    expect(archive.tables.sessionBoats[0]!.position).toBeNull()
  })

  it.each([
    { kind: "crew", table: "crews", position: -1 },
    { kind: "crew", table: "crews", position: 1 },
    { kind: "session boat", table: "sessionBoats", position: -1 },
    { kind: "session boat", table: "sessionBoats", position: 1 },
    { kind: "crew member", table: "crewMembers", position: -1 },
    { kind: "crew member", table: "crewMembers", position: 2 },
  ] as const)(
    "rejects invalid $kind position $position in $table",
    ({ table, position }) => {
      const tables = sampleTables()
      tables[table][0]!.position = position

      expectArchiveError(() => createCourseArchive(tables, DATA_VERSION, APP))
    },
  )

  it("requires duty settings to use the course id as their id", () => {
    const tables = sampleTables()
    tables.dutySettings[0]!.id = "other-id"

    expectArchiveError(() => createCourseArchive(tables, DATA_VERSION, APP))
  })

  it("rejects duplicate ids in every table, including tables omitted by the domain checker", () => {
    const tables = sampleTables()
    tables.dutyAssignments.push({ ...tables.dutyAssignments[0]! })

    expectArchiveError(() => createCourseArchive(tables, DATA_VERSION, APP))
  })

  it("rejects dangling references and invalid enums", () => {
    const dangling = sampleTables()
    dangling.sessionBoats[0]!.boatId = "missing-boat"
    expectArchiveError(() => createCourseArchive(dangling, DATA_VERSION, APP))

    const invalidPersonType = sampleTables()
    invalidPersonType.crewMembers[0]!.personType = "assistant"
    expectArchiveError(() =>
      createCourseArchive(invalidPersonType, DATA_VERSION, APP),
    )

    const invalidStudentEnum = sampleTables()
    invalidStudentEnum.students[0]!.sex = "unknown"
    expectArchiveError(() =>
      createCourseArchive(invalidStudentEnum, DATA_VERSION, APP),
    )
  })

  it("rejects a non-boat crew that retains an empty boat id", () => {
    const tables = sampleTables()
    tables.crews[0]!.destination = "mezzi"
    tables.crews[0]!.boatId = ""

    expectArchiveError(() => createCourseArchive(tables, DATA_VERSION, APP))
  })

  it("rejects unknown and missing columns and incorrect primitive types or nullability", () => {
    const unknownColumn = sampleTables()
    ;(unknownColumn.students[0] as Record<string, unknown>).privateField = "x"
    expectArchiveError(
      () => createCourseArchive(unknownColumn, DATA_VERSION, APP),
      "unsupported-format",
    )

    const missingColumn = sampleTables()
    delete (
      missingColumn.students[0] as Partial<(typeof missingColumn.students)[0]>
    ).firstName
    expectArchiveError(() =>
      createCourseArchive(missingColumn, DATA_VERSION, APP),
    )

    const wrongType = sampleTables()
    ;(wrongType.students[0] as Record<string, unknown>).active = "1"
    expectArchiveError(() => createCourseArchive(wrongType, DATA_VERSION, APP))

    const nullRequired = sampleTables()
    ;(nullRequired.courses[0] as Record<string, unknown>).label = null
    expectArchiveError(() =>
      createCourseArchive(nullRequired, DATA_VERSION, APP),
    )
  })

  it("rejects malformed and impossible UTC timestamps", () => {
    const malformed = sampleTables()
    malformed.faults[0]!.updatedAt = "yesterday"
    expectArchiveError(() => createCourseArchive(malformed, DATA_VERSION, APP))

    const impossible = sampleTables()
    impossible.faults[0]!.createdAt = "2026-02-30T12:00:00.000Z"
    expectArchiveError(() => createCourseArchive(impossible, DATA_VERSION, APP))
  })

  it("requires the legacy duty lists and D2 item rows to agree exactly", () => {
    const wrongPosition = sampleTables()
    wrongPosition.dutySettingItems[0]!.position = 4
    expectArchiveError(() =>
      createCourseArchive(wrongPosition, DATA_VERSION, APP),
    )

    const unknownKind = sampleTables()
    unknownKind.dutySettingItems[0]!.kind = "future-kind"
    expectArchiveError(() =>
      createCourseArchive(unknownKind, DATA_VERSION, APP),
    )

    const malformedList = sampleTables()
    malformedList.dutySettings[0]!.fewerDayIds = "{"
    expectArchiveError(() =>
      createCourseArchive(malformedList, DATA_VERSION, APP),
    )

    const duplicateDay = sampleTables()
    duplicateDay.dutySettings[0]!.fewerDayIds = JSON.stringify([
      "saturday",
      "saturday",
    ])
    expectArchiveError(() =>
      createCourseArchive(duplicateDay, DATA_VERSION, APP),
    )

    const danglingListRef = sampleTables()
    danglingListRef.dutySettings[0]!.stayOverStudentIds = JSON.stringify([
      "missing-student",
    ])
    const replacement = dutySettingItems("course-1", {
      fewerDayIds: ["saturday"],
      extraDayIds: [],
      stayOverStudentIds: ["missing-student"],
      completedDayIds: [],
      acknowledgedWarningKeys: ["minor-balance:2,0"],
    })
    danglingListRef.dutySettingItems = replacement.map((item) => ({
      ...item,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    }))
    expectArchiveError(() =>
      createCourseArchive(danglingListRef, DATA_VERSION, APP),
    )
  })

  it("rejects unsupported archive envelopes and multiple courses", () => {
    const valid = createCourseArchive(sampleTables(), DATA_VERSION, APP)
    const unsupportedVersion = { ...valid, formatVersion: 2 }
    expectArchiveError(
      () => parseCourseArchive(unsupportedVersion, APP),
      "unsupported-format",
    )

    const extraTable = { ...valid, tables: { ...sampleTables(), meta: [] } }
    expectArchiveError(
      () => parseCourseArchive(extraTable, APP),
      "unsupported-format",
    )

    const twoCourses = sampleTables()
    twoCourses.courses.push({ ...twoCourses.courses[0]!, id: "course-2" })
    expectArchiveError(() => createCourseArchive(twoCourses, DATA_VERSION, APP))
  })

  it("parses a serialized archive without changing its rows", () => {
    const archive = createCourseArchive(sampleTables(), DATA_VERSION, APP)
    const parsed = parseCourseArchive(JSON.stringify(archive), APP)

    expect(parsed).toEqual(archive)
  })

  it("accepts an enriched 0.3.0 fixture and preserves its stored values", () => {
    const tables = enrichedLegacyFixtureTables()
    const schemaTables = (
      AppSchema as unknown as {
        toJSON: () => {
          tables: Array<{
            name: string
            columns: Array<{ name: string }>
          }>
        }
      }
    ).toJSON().tables
    const columns: Record<string, Set<string>> = Object.fromEntries(
      schemaTables.map(({ name, columns: schemaColumns }) => [
        name,
        new Set(["id", ...schemaColumns.map(({ name }) => name)]),
      ]),
    )
    for (const table of COURSE_TABLES) {
      for (const row of tables[table]) {
        expect(
          Object.keys(row).filter((key) => !columns[table]!.has(key)),
          `${table}:${row.id}`,
        ).toEqual([])
      }
    }
    const archive = createCourseArchive(tables, DATA_VERSION, APP)

    expect(archive.tables).toEqual(tables)
    expect(archive.tables.students[0]).toMatchObject({
      id: "student-v030-tommaso",
      dateOfBirth: "2011-05-14",
      declaredAgeAtCourseStart: null,
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    })
    expect(archive.tables.students[6]).toMatchObject({
      id: "student-v030-marta",
      dateOfBirth: null,
      declaredAgeAtCourseStart: 13,
    })
    expect(archive.tables.faults[0]).toMatchObject({
      id: "fault-v030-quest-7-open",
      createdAt: "2026-09-19T08:00:00.000Z",
      updatedAt: "2026-09-19T08:00:00.000Z",
      courseId: "course-v030-d2",
    })
    expect(archive.tables.crewMembers[1]).toMatchObject({
      id: "member-v030-sat-pm-1-nico",
      personType: "volunteer",
      courseId: "course-v030-d2",
    })
    expect(archive.tables.dutySettingItems).toHaveLength(3)
  })

  it("uses the canonical minimum-writer contract, including readable newer data", () => {
    const newerButWritable: DataVersion = {
      version: { major: 0, minor: 5, patch: 0 },
      minimumWriter: { major: 0, minor: 4, patch: 0 },
    }
    expect(() =>
      createCourseArchive(sampleTables(), newerButWritable, APP),
    ).not.toThrow()

    const minimumTooNew: DataVersion = {
      version: { major: 0, minor: 5, patch: 0 },
      minimumWriter: { major: 0, minor: 5, patch: 0 },
    }
    expectArchiveError(
      () => createCourseArchive(sampleTables(), minimumTooNew, APP),
      "incompatible-version",
    )

    const invalidRange: DataVersion = {
      version: { major: 0, minor: 4, patch: 0 },
      minimumWriter: { major: 0, minor: 5, patch: 0 },
    }
    expectArchiveError(() =>
      createCourseArchive(sampleTables(), invalidRange, APP),
    )
  })
})
