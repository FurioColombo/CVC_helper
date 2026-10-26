import { DatabaseSync } from "node:sqlite"
import type { PowerSyncDatabase } from "@powersync/web"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { encodeVersion, parseVersion } from "@/domain/compatibility"
import type { CrewPlan } from "@/domain/crews"
import { exportCourseArchive } from "@/persistence/courseArchive"
import { readCrewPlan, saveCrewPlan } from "@/persistence/crews"
import { dutySettingItems } from "@/persistence/dutyItems"
import { readDutyPlan, saveDutyPlan } from "@/persistence/duties"
import { listEvaluations, saveEvaluation } from "@/persistence/evaluations"
import {
  crewMemberId,
  dutyAssignmentId,
  evaluationId,
  landAssignmentId,
} from "@/persistence/placementIds"
import { AppSchema } from "@/persistence/schema"
import { guardWrites } from "@/persistence/writeGuard"

// The screens read through the shared `db`; each test points it at the device
// it is looking at.
const current = vi.hoisted(() => ({
  database: null as null | Record<string, (...args: never[]) => unknown>,
}))
vi.mock("@/persistence/db", () => ({
  db: new Proxy(
    {},
    {
      get:
        (_target, name: string) =>
        (...args: never[]) =>
          current.database![name]!(...args),
    },
  ),
}))

const CREATED_AT = "2026-09-01T12:00:00.000Z"
const PLACEMENT_TABLES = [
  "crewMembers",
  "landAssignments",
  "sessionBoats",
  "dutyAssignments",
  "evaluations",
] as const
const SCHEMA = (
  AppSchema as unknown as {
    toJSON: () => {
      tables: Array<{
        name: string
        columns: Array<{ name: string; type: string }>
      }>
    }
  }
).toJSON()

type Row = Record<string, string | number | null>
type Params = Array<string | number | null>

const student = (id: string, surname: string): Row => ({
  id,
  courseId: "course-1",
  firstName: "Allievo",
  surname,
  nickname: null,
  dateOfBirth: null,
  declaredAgeAtCourseStart: 19,
  sex: "female",
  phone: null,
  size: "M",
  initialNote: null,
  courseNote: null,
  active: 1,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
})

const crew = (id: string, position: number): Row => ({
  id,
  courseId: "course-1",
  sessionId: "sat-pm",
  capacity: 2,
  destination: "unassigned",
  boatId: null,
  position,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
})

function baseRows(): Record<string, Row[]> {
  const lists = {
    fewerDayIds: [] as string[],
    stayOverStudentIds: [] as string[],
    completedDayIds: [] as string[],
    acknowledgedWarningKeys: [] as string[],
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
        updatedAt: CREATED_AT,
      },
    ],
    students: [
      student("student-1", "Rossi"),
      student("student-2", "Bianchi"),
      student("student-3", "Verdi"),
    ],
    dutySettings: [
      {
        id: "course-1",
        courseId: "course-1",
        desiredPerDay: 0,
        fewerDayIds: "[]",
        extraDayIds: "[]",
        balanceMinors: 1,
        balanceSex: 0,
        tieBreaker: "alphabetical",
        stayOverStudentIds: "[]",
        completedDayIds: "[]",
        acknowledgedWarningKeys: "[]",
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      },
    ],
    dutySettingItems: dutySettingItems("course-1", lists).map((item) => ({
      ...item,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    })),
    crews: [crew("crew-1", 0), crew("crew-2", 1)],
  }
}

/** A phone's database holding the same course (as after a restore). */
function createDevice() {
  const sqlite = new DatabaseSync(":memory:")
  for (const { name, columns } of SCHEMA.tables) {
    sqlite.exec(
      `CREATE TABLE "${name}" ("id" TEXT PRIMARY KEY, ${columns
        .map(({ name: column, type }) => `"${column}" ${type}`)
        .join(", ")})`,
    )
  }
  for (const [table, rows] of Object.entries(baseRows()))
    insert(sqlite, table, rows)
  const meta = sqlite.prepare("INSERT INTO meta(id, value) VALUES (?, ?)")
  meta.run("data:version", encodeVersion(parseVersion("0.5.0")))
  meta.run("data:minimumWriter", encodeVersion(parseVersion("0.2.0")))
  meta.run("local:course-generation", 1)
  meta.run("migration:fixture-ledger", 1_790_000_000_000)
  return { sqlite, database: handleOf(sqlite) }
}

function insert(sqlite: DatabaseSync, table: string, rows: Row[]) {
  for (const row of rows) {
    const columns = Object.keys(row)
    sqlite
      .prepare(
        `INSERT OR REPLACE INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      )
      .run(...(Object.values(row) as Params))
  }
}

function handleOf(sqlite: DatabaseSync) {
  const readAll = (sql: string, parameters: unknown[] = []) =>
    sqlite
      .prepare(sql)
      .all(...(parameters as Params))
      .map((row) => ({ ...row }))
  const context = () => ({
    getAll: async (sql: string, parameters?: unknown[]) =>
      readAll(sql, parameters),
    get: async (sql: string, parameters?: unknown[]) => {
      const row = readAll(sql, parameters)[0]
      if (!row) throw new Error("Expected a database row")
      return row
    },
    getOptional: async (sql: string, parameters?: unknown[]) =>
      readAll(sql, parameters)[0] ?? null,
    execute: async (sql: string, parameters: unknown[] = []) =>
      sqlite.prepare(sql).run(...(parameters as Params)),
    executeBatch: async (sql: string, batch: unknown[][]) => {
      for (const parameters of batch) {
        sqlite.prepare(sql).run(...(parameters as Params))
      }
    },
  })
  async function transaction<T>(
    kind: "read" | "write",
    callback: (tx: ReturnType<typeof context>) => Promise<T>,
  ) {
    sqlite.exec(kind === "write" ? "BEGIN IMMEDIATE" : "BEGIN")
    try {
      const result = await callback(context())
      sqlite.exec("COMMIT")
      return result
    } catch (error) {
      sqlite.exec("ROLLBACK")
      throw error
    }
  }
  const raw = {
    ...context(),
    init: async () => {},
    readTransaction: <T>(
      callback: (tx: ReturnType<typeof context>) => Promise<T>,
    ) => transaction("read", callback),
    writeTransaction: <T>(
      callback: (tx: ReturnType<typeof context>) => Promise<T>,
    ) => transaction("write", callback),
    writeLock: <T>(callback: (tx: ReturnType<typeof context>) => Promise<T>) =>
      transaction("write", callback),
    executeRaw: async () => undefined,
  }
  return guardWrites(raw as unknown as PowerSyncDatabase)
}

/** The server applies each phone's queued writes in turn; both then download it. */
function sync(
  devices: Array<ReturnType<typeof createDevice>>,
  uploadOrder = devices,
) {
  const server = new Map<string, Map<string, Row>>()
  for (const table of PLACEMENT_TABLES) server.set(table, new Map())
  for (const device of uploadOrder) {
    for (const table of PLACEMENT_TABLES) {
      for (const row of device.sqlite
        .prepare(`SELECT * FROM "${table}"`)
        .all() as Row[]) {
        server.get(table)!.set(row.id as string, { ...row })
      }
    }
  }
  for (const device of devices) {
    for (const table of PLACEMENT_TABLES) {
      insert(device.sqlite, table, [...server.get(table)!.values()])
    }
  }
}

const count = (device: ReturnType<typeof createDevice>, table: string) =>
  (
    device.sqlite.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as {
      n: number
    }
  ).n

const plan = (
  members: Record<string, string[]>,
  landStudentIds: string[],
): CrewPlan => ({
  crews: ["crew-1", "crew-2"].map((id) => ({
    id,
    sessionId: "sat-pm" as const,
    members: (members[id] ?? []).map((personId) => ({
      personId,
      personType: "student" as const,
    })),
    capacity: 2,
    destination: "unassigned" as const,
    boatId: null,
  })),
  landStudentIds,
  selectedBoatIds: [],
})

const EARLIER = "2026-09-20T09:00:00.000Z"
const LATER = "2026-09-20T10:00:00.000Z"

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
})
afterEach(() => {
  vi.useRealTimers()
})

describe("two phones edit the same placements offline (SC-B1-1)", () => {
  it("converges on the latest edit, reads, exports and cleans up on save", async () => {
    const phoneA = createDevice()
    const phoneB = createDevice()
    // Phone A, earlier: student-1 and student-2 on land, student-3 in crew 1.
    vi.setSystemTime(new Date(EARLIER))
    await saveCrewPlan(
      "course-1",
      "sat-pm",
      plan({ "crew-1": ["student-3"] }, ["student-1", "student-2"]),
      phoneA.database,
    )
    // Phone B, later: the same student-1 on land and student-3 in crew 1, but
    // student-2 in crew 2.
    vi.setSystemTime(new Date(LATER))
    await saveCrewPlan(
      "course-1",
      "sat-pm",
      plan({ "crew-1": ["student-3"], "crew-2": ["student-2"] }, ["student-1"]),
      phoneB.database,
    )

    sync([phoneA, phoneB])

    for (const phone of [phoneA, phoneB]) {
      current.database = phone.database as unknown as typeof current.database
      // The same placements are one row; student-2 is the real clash.
      expect(count(phone, "landAssignments")).toBe(2)
      expect(count(phone, "crewMembers")).toBe(2)
      const read = await readCrewPlan("course-1", "sat-pm")
      expect(read.resolvedConflicts).toBe(1)
      expect(read.landStudentIds).toEqual(["student-1"])
      expect(read.crews.map(({ members }) => members)).toEqual([
        [{ personId: "student-3", personType: "student" }],
        [{ personId: "student-2", personType: "student" }],
      ])

      const archive = await exportCourseArchive(phone.database)
      expect(archive.tables.landAssignments.map(({ id }) => id)).toEqual([
        landAssignmentId("sat-pm", "student-1"),
      ])
      expect(archive.tables.crewMembers.map(({ id }) => id).sort()).toEqual(
        [
          crewMemberId("crew-1", "student", "student-3"),
          crewMemberId("crew-2", "student", "student-2"),
        ].sort(),
      )

      // The next save writes the resolved state and deletes the losing row.
      await saveCrewPlan("course-1", "sat-pm", read, phone.database)
      expect(count(phone, "landAssignments")).toBe(1)
      expect((await readCrewPlan("course-1", "sat-pm")).resolvedConflicts).toBe(
        0,
      )
    }
  })

  it("settles on the other phone when its edit is the later one", async () => {
    const phoneA = createDevice()
    const phoneB = createDevice()
    vi.setSystemTime(new Date(EARLIER))
    await saveCrewPlan(
      "course-1",
      "sat-pm",
      plan({ "crew-2": ["student-2"] }, []),
      phoneB.database,
    )
    vi.setSystemTime(new Date(LATER))
    await saveCrewPlan(
      "course-1",
      "sat-pm",
      plan({}, ["student-2"]),
      phoneA.database,
    )
    // The upload order does not decide: the later edit does.
    sync([phoneA, phoneB], [phoneA, phoneB])
    current.database = phoneB.database as unknown as typeof current.database
    const read = await readCrewPlan("course-1", "sat-pm")
    expect(read.landStudentIds).toEqual(["student-2"])
    expect(read.crews.flatMap(({ members }) => members)).toEqual([])
    expect(read.resolvedConflicts).toBe(1)
  })

  it("settles a student placed twice by rows from before the ids were keyed", async () => {
    const phone = createDevice()
    current.database = phone.database as unknown as typeof current.database
    insert(
      phone.sqlite,
      "landAssignments",
      [
        ["old-a", EARLIER],
        ["old-b", LATER],
      ].map(([id, at]) => ({
        id: id!,
        courseId: "course-1",
        sessionId: "sat-pm",
        studentId: "student-1",
        createdAt: at!,
        updatedAt: at!,
      })),
    )
    const read = await readCrewPlan("course-1", "sat-pm")
    expect(read.landAssignments.map(({ id }) => id)).toEqual(["old-b"])
    await exportCourseArchive(phone.database)
    vi.setSystemTime(new Date(LATER))
    await saveCrewPlan("course-1", "sat-pm", read, phone.database)
    expect(
      (
        phone.sqlite
          .prepare('SELECT id FROM "landAssignments"')
          .all() as Array<{
          id: string
        }>
      ).map(({ id }) => id),
    ).toEqual(["old-b"])
  })

  it("settles a duty and an evaluation saved twice", async () => {
    const phoneA = createDevice()
    const phoneB = createDevice()
    const settings = await (async () => {
      current.database = phoneA.database as unknown as typeof current.database
      const stored = await readDutyPlan("course-1")
      return (
        stored.settings ?? {
          desiredPerDay: 0,
          fewerDayIds: [],
          balanceMinors: true,
          balanceSex: false,
          tieBreaker: "alphabetical" as const,
          stayOverStudentIds: [],
          completedDayIds: [],
          acknowledgedWarningKeys: [],
        }
      )
    })()
    for (const [phone, at, value] of [
      [phoneA, EARLIER, "+"],
      [phoneB, LATER, "++"],
    ] as const) {
      vi.setSystemTime(new Date(at))
      current.database = phone.database as unknown as typeof current.database
      await saveDutyPlan(
        "course-1",
        [{ dayId: "saturday", studentId: "student-1" }],
        settings,
        phone.database,
      )
      await saveEvaluation("course-1", "student-1", "sat-pm", {
        value,
        note: null,
      })
    }
    // Same keys, same ids: one row each after the sync, the later edit.
    sync([phoneA, phoneB])
    expect(count(phoneA, "dutyAssignments")).toBe(1)
    expect(count(phoneA, "evaluations")).toBe(1)
    expect(
      (phoneA.sqlite.prepare('SELECT id FROM "evaluations"').get() as Row).id,
    ).toBe(evaluationId("student-1", "sat-pm"))
    expect(
      (phoneA.sqlite.prepare('SELECT id FROM "dutyAssignments"').get() as Row)
        .id,
    ).toBe(dutyAssignmentId("saturday", "student-1"))
    current.database = phoneA.database as unknown as typeof current.database
    expect((await listEvaluations("course-1", "sat-pm"))[0]?.value).toBe("++")

    // Rows from before the keyed ids: both stay in the database, one is shown.
    insert(phoneA.sqlite, "evaluations", [
      {
        id: "old-evaluation",
        courseId: "course-1",
        studentId: "student-1",
        sessionId: "sat-pm",
        value: "-",
        note: null,
        createdAt: EARLIER,
        updatedAt: "2026-09-20T08:00:00.000Z",
      },
    ])
    insert(phoneA.sqlite, "dutyAssignments", [
      {
        id: "old-duty",
        courseId: "course-1",
        dayId: "saturday",
        studentId: "student-1",
        createdAt: EARLIER,
        updatedAt: "2026-09-20T08:00:00.000Z",
      },
    ])
    expect(count(phoneA, "evaluations")).toBe(2)
    expect(await listEvaluations("course-1", "sat-pm")).toHaveLength(1)
    const duties = await readDutyPlan("course-1")
    expect(duties.assignments).toHaveLength(1)
    expect(duties.resolvedConflicts).toBe(1)
    await exportCourseArchive(phoneA.database)
    // A save deletes the losers.
    await saveEvaluation("course-1", "student-1", "sat-pm", {
      value: "+",
      note: null,
    })
    await saveDutyPlan(
      "course-1",
      duties.assignments,
      duties.settings!,
      phoneA.database,
    )
    expect(count(phoneA, "evaluations")).toBe(1)
    expect(count(phoneA, "dutyAssignments")).toBe(1)
  })
})
