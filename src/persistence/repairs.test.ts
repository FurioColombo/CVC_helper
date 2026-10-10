import { DatabaseSync } from "node:sqlite"

import { describe, expect, it } from "vitest"

import {
  dutySettingItemsNeedRepair,
  needsRepair,
  repairDutySettingItems,
  repairRows,
} from "@/persistence/repairs"
import { validateStoredRows, type StoredRow } from "@/persistence/rowIntegrity"
import { COURSE_TABLES } from "@/persistence/schema"

/**
 * The repairs and their probe on a real SQLite: the course tables as plain
 * tables with the columns the repairs read, rows in every state an older
 * version or an older app sharing the database can leave behind.
 */
const NOW = "2026-10-10T08:00:00.000Z"
const T0 = "2026-09-19T10:00:00.000Z"
const T1 = "2026-09-19T11:00:00.000Z"
const stamped = { createdAt: T0, updatedAt: T1 }

function database(courses: string[]) {
  const sqlite = new DatabaseSync(":memory:")
  for (const table of COURSE_TABLES) {
    sqlite.exec(
      `CREATE TABLE ${table} (id TEXT PRIMARY KEY, courseId TEXT,
         boatId TEXT, crewId TEXT, studentId TEXT,
         createdAt TEXT, updatedAt TEXT)`,
    )
  }
  const insert = (table: string, row: Record<string, string | null>) =>
    sqlite
      .prepare(
        `INSERT INTO ${table} (${Object.keys(row).join(", ")})
         VALUES (${Object.keys(row)
           .map(() => "?")
           .join(", ")})`,
      )
      .run(...Object.values(row))
  for (const id of courses) {
    insert("courses", { id, createdAt: T0, updatedAt: T0 })
  }
  const step = {
    execute: async (sql: string, params: string[] = []) =>
      sqlite.prepare(sql).run(...params),
  }
  const reader = {
    get: async (sql: string) => sqlite.prepare(sql).get(),
  }
  const read = () =>
    Object.fromEntries(
      COURSE_TABLES.map((table) => [
        table,
        sqlite
          .prepare(`SELECT * FROM ${table} ORDER BY id`)
          .all()
          .map((row) =>
            Object.fromEntries(
              Object.entries(row).filter(([, value]) => value !== null),
            ),
          ) as StoredRow[],
      ]),
    )
  return { insert, step, reader, read }
}

describe("repairRows", () => {
  it("fills ownership and metadata, lifts a disordered updatedAt, keeps what rows have, and does it once", async () => {
    const { insert, step, reader, read } = database(["course-1"])
    insert("boats", { id: "boat-1", courseId: "course-1", ...stamped })
    insert("crews", { id: "crew-1", courseId: "course-1", ...stamped })
    // A 0.3.0 student, an older app's update that stripped the metadata, and
    // a 0.2.0 fault whose update ran with the clock set back.
    insert("students", { id: "student-1", courseId: "course-1" })
    insert("students", { id: "student-2", courseId: "course-1", ...stamped })
    insert("faults", {
      id: "fault-1",
      boatId: "boat-1",
      createdAt: T1,
      updatedAt: T0,
    })
    insert("crewMembers", { id: "member-1", crewId: "crew-1", ...stamped })
    insert("evaluations", { id: "evaluation-1", studentId: "student-1" })
    // Children whose parent is gone: the device's one course is theirs.
    insert("faults", { id: "fault-orphan", boatId: "gone", ...stamped })
    insert("crewMembers", { id: "member-orphan", crewId: "gone" })
    expect(await needsRepair(reader as never)).toBe(true)

    await repairRows(step as never, NOW)
    const repaired = read()

    // The orphans keep their dangling reference; the check reports it.
    expect(validateStoredRows(repaired)).toEqual([
      { table: "faults", id: "fault-orphan", code: "missing-parent" },
      { table: "crewMembers", id: "member-orphan", code: "missing-parent" },
    ])
    expect(repaired.students).toEqual([
      { id: "student-1", courseId: "course-1", createdAt: NOW, updatedAt: NOW },
      { id: "student-2", courseId: "course-1", ...stamped },
    ])
    expect(repaired.faults).toEqual([
      {
        id: "fault-1",
        courseId: "course-1",
        boatId: "boat-1",
        createdAt: T1,
        updatedAt: T1,
      },
      { id: "fault-orphan", courseId: "course-1", boatId: "gone", ...stamped },
    ])
    expect(repaired.crewMembers).toContainEqual({
      id: "member-orphan",
      courseId: "course-1",
      crewId: "gone",
      createdAt: NOW,
      updatedAt: NOW,
    })
    expect(repaired.evaluations).toEqual([
      {
        id: "evaluation-1",
        courseId: "course-1",
        studentId: "student-1",
        createdAt: NOW,
        updatedAt: NOW,
      },
    ])

    // Every open probes again; on repaired rows nothing is left to change.
    expect(await needsRepair(reader as never)).toBe(false)
    await repairRows(step as never, "2026-10-11T08:00:00.000Z")
    expect(read()).toEqual(repaired)
  })

  it("leaves an orphan without a course when the device holds more than one", async () => {
    const { insert, step, read } = database(["course-1", "course-2"])
    insert("faults", { id: "fault-orphan", boatId: "gone", ...stamped })

    await repairRows(step as never, NOW)

    expect(validateStoredRows(read())).toEqual([
      { table: "faults", id: "fault-orphan", code: "missing-parent" },
      { table: "faults", id: "fault-orphan", code: "missing-course" },
    ])
  })
})

describe("needsRepair", () => {
  it("finds nothing on sound rows or an empty database", async () => {
    const { insert, reader } = database(["course-1"])
    expect(await needsRepair(reader as never)).toBe(false)
    insert("boats", { id: "boat-1", courseId: "course-1", ...stamped })
    insert("faults", {
      id: "fault-1",
      courseId: "course-1",
      boatId: "boat-1",
      createdAt: T0,
      updatedAt: T0,
    })
    expect(await needsRepair(reader as never)).toBe(false)
  })

  // Every state a repair changes must make the probe answer yes, or the open
  // would skip the repairs and leave the row as it is.
  it.each([
    ["students", { courseId: "course-1", updatedAt: T1 }],
    ["volunteers", { courseId: "course-1", createdAt: T0 }],
    ["boats", { courseId: "course-1", createdAt: T1, updatedAt: T0 }],
    ["evaluations", { studentId: "student-1", ...stamped }],
    ["crewMembers", { crewId: "crew-1", ...stamped }],
    ["faults", { boatId: "boat-1", ...stamped }],
    ["courses", { createdAt: T0 }],
  ])("finds a %s row that a repair would change", async (table, row) => {
    const { insert, step, reader } = database(["course-1"])
    insert(table, { id: `${table}-broken`, ...row })

    expect(await needsRepair(reader as never)).toBe(true)
    await repairRows(step as never, NOW)
    expect(await needsRepair(reader as never)).toBe(false)
  })
})

/**
 * The D2 rows of the duty-settings lists, rebuilt from the lists an older app
 * keeps (03 §3.1), on a real SQLite.
 */
describe("repairDutySettingItems", () => {
  function dutyDatabase() {
    const sqlite = new DatabaseSync(":memory:")
    sqlite.exec(
      `CREATE TABLE dutySettings (id TEXT PRIMARY KEY, courseId TEXT,
         fewerDayIds TEXT, extraDayIds TEXT, stayOverStudentIds TEXT,
         completedDayIds TEXT, acknowledgedWarningKeys TEXT,
         createdAt TEXT, updatedAt TEXT);
       CREATE TABLE dutySettingItems (id TEXT PRIMARY KEY, courseId TEXT,
         kind TEXT, value TEXT, position INTEGER,
         createdAt TEXT, updatedAt TEXT)`,
    )
    const run = (sql: string, params: unknown[] = []) =>
      sqlite.prepare(sql).run(...(params as string[]))
    const context = {
      getAll: async (sql: string) => sqlite.prepare(sql).all(),
      execute: async (sql: string, params: unknown[] = []) => run(sql, params),
      executeBatch: async (sql: string, rows: unknown[][]) => {
        for (const params of rows) run(sql, params)
      },
    }
    const settings = (courseId: string, lists: Record<string, string | null>) =>
      run(
        `INSERT INTO dutySettings (id, courseId, fewerDayIds, extraDayIds,
           stayOverStudentIds, completedDayIds, acknowledgedWarningKeys)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          courseId,
          courseId,
          lists.fewerDayIds ?? "[]",
          lists.extraDayIds ?? null,
          lists.stayOverStudentIds ?? "[]",
          lists.completedDayIds ?? "[]",
          lists.acknowledgedWarningKeys ?? "[]",
        ],
      )
    const items = () =>
      sqlite
        .prepare(
          `SELECT courseId, kind, value, position, createdAt, updatedAt
           FROM dutySettingItems ORDER BY courseId, kind, position`,
        )
        .all()
    return { context, settings, items, run }
  }

  it("builds the rows of every list, in order, once, with their metadata", async () => {
    const { context, settings, items } = dutyDatabase()
    settings("course-1", {
      fewerDayIds: JSON.stringify(["saturday"]),
      extraDayIds: JSON.stringify(["wednesday", "monday"]),
      stayOverStudentIds: JSON.stringify(["student-2", "student-1"]),
      completedDayIds: JSON.stringify(["saturday"]),
      // 0.3.0 could store an acknowledgement twice; it is one row.
      acknowledgedWarningKeys: JSON.stringify([
        "minor-balance:2,0",
        "minor-balance:2,0",
      ]),
    })
    expect(await dutySettingItemsNeedRepair(context as never)).toBe(true)

    await repairDutySettingItems(context as never, NOW)

    const meta = { courseId: "course-1", createdAt: NOW, updatedAt: NOW }
    expect(items()).toEqual([
      {
        ...meta,
        kind: "acknowledged-warning",
        value: "minor-balance:2,0",
        position: 0,
      },
      { ...meta, kind: "completed-day", value: "saturday", position: 0 },
      { ...meta, kind: "extra-day", value: "wednesday", position: 0 },
      { ...meta, kind: "extra-day", value: "monday", position: 1 },
      { ...meta, kind: "fewer-day", value: "saturday", position: 0 },
      { ...meta, kind: "stay-over", value: "student-2", position: 0 },
      { ...meta, kind: "stay-over", value: "student-1", position: 1 },
    ])
    expect(await dutySettingItemsNeedRepair(context as never)).toBe(false)
    await repairDutySettingItems(context as never, "2026-10-11T08:00:00.000Z")
    expect(items().every(({ createdAt }) => createdAt === NOW)).toBe(true)
  })

  it("follows what an older app wrote to the lists, and leaves other courses alone", async () => {
    const { context, settings, items, run } = dutyDatabase()
    settings("course-1", { stayOverStudentIds: JSON.stringify(["student-1"]) })
    settings("course-2", { completedDayIds: JSON.stringify(["saturday"]) })
    await repairDutySettingItems(context as never, NOW)
    // A 0.3.0 tab swaps the stay-over student and completes Sunday.
    run(
      `UPDATE dutySettings SET stayOverStudentIds = ?, completedDayIds = ?
       WHERE id = 'course-1'`,
      [JSON.stringify(["student-3"]), JSON.stringify(["sunday"])],
    )

    await repairDutySettingItems(context as never, "2026-10-11T08:00:00.000Z")

    expect(
      items().map(({ courseId, kind, value }) => [courseId, kind, value]),
    ).toEqual([
      ["course-1", "completed-day", "sunday"],
      ["course-1", "stay-over", "student-3"],
      ["course-2", "completed-day", "saturday"],
    ])
  })

  it("mirrors each list that parses and leaves the rows of one that does not", async () => {
    const { context, settings, items, run } = dutyDatabase()
    settings("course-1", { stayOverStudentIds: JSON.stringify(["student-1"]) })
    await repairDutySettingItems(context as never, NOW)
    // An older tab writes a list that does not parse, and completes Sunday.
    run(
      `UPDATE dutySettings SET stayOverStudentIds = '{', completedDayIds = ?
       WHERE id = 'course-1'`,
      [JSON.stringify(["sunday"])],
    )

    await repairDutySettingItems(context as never, NOW)

    expect(items().map(({ kind, value }) => [kind, value])).toEqual([
      ["completed-day", "sunday"],
      ["stay-over", "student-1"],
    ])
    expect(await dutySettingItemsNeedRepair(context as never)).toBe(false)
  })

  it("reads only the settings row the app reads, the one whose id is the course's", async () => {
    const { context, items, run } = dutyDatabase()
    for (const id of ["course-1", "a-stray-copy"]) {
      run(
        `INSERT INTO dutySettings (id, courseId, fewerDayIds, stayOverStudentIds,
           completedDayIds, acknowledgedWarningKeys)
         VALUES (?, 'course-1', '[]', ?, '[]', '[]')`,
        [id, JSON.stringify([id === "course-1" ? "student-1" : "student-9"])],
      )
    }

    await repairDutySettingItems(context as never, NOW)

    expect(items().map(({ value }) => value)).toEqual(["student-1"])
  })

  it("removes rows of a course without settings and rebuilds a row that disagrees with its id", async () => {
    const { context, settings, items, run } = dutyDatabase()
    settings("course-1", { extraDayIds: JSON.stringify(["monday"]) })
    await repairDutySettingItems(context as never, NOW)
    // A stale 0.3.0 erase of another course left its rows; one row of this
    // course was rewritten under the wrong value and course.
    run(
      `INSERT INTO dutySettingItems (id, courseId, kind, value, position)
       VALUES (?, 'course-gone', 'stay-over', 'student-1', 0)`,
      [JSON.stringify(["course-gone", "stay-over", "student-1"])],
    )
    run(
      `UPDATE dutySettingItems SET value = 'friday', courseId = 'course-2'
       WHERE kind = 'extra-day'`,
    )
    expect(await dutySettingItemsNeedRepair(context as never)).toBe(true)

    await repairDutySettingItems(context as never, "2026-10-11T08:00:00.000Z")

    expect(items()).toEqual([
      {
        courseId: "course-1",
        kind: "extra-day",
        value: "monday",
        position: 0,
        createdAt: "2026-10-11T08:00:00.000Z",
        updatedAt: "2026-10-11T08:00:00.000Z",
      },
    ])
  })
})
