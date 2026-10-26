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
  "crews",
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
    boats: [
      {
        id: "boat-1",
        courseId: "course-1",
        type: "RS Quest",
        number: "17",
        availability: "available",
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      },
    ],
    crews: [crew("crew-1", 0), crew("crew-2", 1)],
  }
}

interface Device {
  sqlite: DatabaseSync
  database: ReturnType<typeof handleOf>
  /** The operations the phone has queued since it last synced. */
  queue: Operation[]
  /** The tracked rows as the phone last saw them on the server. */
  snapshot: Map<string, Map<string, Row>>
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
  const device: Device = {
    sqlite,
    database: handleOf(sqlite),
    queue: [],
    snapshot: new Map(),
  }
  rebaseline(device)
  return device
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

// The server model (B4): the latest edit wins. A PUT carries the whole row
// and replaces the server row unless that is newer; a PATCH changes columns of
// an existing row unless the server row is newer; a DELETE removes the row
// unless the server row is newer than the updatedAt the deleting phone last saw.
type Operation =
  | { kind: "PUT"; table: string; row: Row }
  | { kind: "PATCH"; table: string; id: string; columns: Row }
  | { kind: "DELETE"; table: string; id: string; previousUpdatedAt: string }

type Tables = Map<string, Map<string, Row>>

let server: Tables = new Map()
// Set by the suites that run every scenario in both upload orders.
let reversedUpload = false

function readTracked(sqlite: DatabaseSync): Tables {
  const tables: Tables = new Map()
  for (const table of PLACEMENT_TABLES) {
    tables.set(
      table,
      new Map(
        (sqlite.prepare(`SELECT * FROM "${table}"`).all() as Row[]).map(
          (row) => [row.id as string, { ...row }],
        ),
      ),
    )
  }
  return tables
}

function seedServer() {
  const seed = new DatabaseSync(":memory:")
  for (const { name, columns } of SCHEMA.tables) {
    seed.exec(
      `CREATE TABLE "${name}" ("id" TEXT PRIMARY KEY, ${columns
        .map(({ name: column, type }) => `"${column}" ${type}`)
        .join(", ")})`,
    )
  }
  for (const [table, rows] of Object.entries(baseRows()))
    insert(seed, table, rows)
  const tables = readTracked(seed)
  seed.close()
  return tables
}

function rebaseline(device: Device) {
  device.snapshot = readTracked(device.sqlite)
  device.queue = []
}

/** What the phone's connector would have queued since the last record. */
function record(device: Device) {
  const now = readTracked(device.sqlite)
  for (const table of PLACEMENT_TABLES) {
    const before = device.snapshot.get(table)!
    const after = now.get(table)!
    for (const [id, row] of before) {
      if (!after.has(id)) {
        device.queue.push({
          kind: "DELETE",
          table,
          id,
          previousUpdatedAt: row.updatedAt as string,
        })
      }
    }
    for (const [id, row] of after) {
      const old = before.get(id)
      if (!old) {
        device.queue.push({ kind: "PUT", table, row: { ...row } })
        continue
      }
      // The connector sends an edit as the whole row as it stands now.
      if (Object.entries(row).some(([column, value]) => old[column] !== value))
        device.queue.push({ kind: "PUT", table, row: { ...row } })
    }
  }
  device.snapshot = now
  return device.queue.length
}

const notOlder = (incoming: unknown, stored: unknown) =>
  (incoming as string) >= (stored as string)

function applyToServer(operation: Operation) {
  const rows = server.get(operation.table)!
  if (operation.kind === "PUT") {
    const stored = rows.get(operation.row.id as string)
    if (!stored || notOlder(operation.row.updatedAt, stored.updatedAt)) {
      rows.set(operation.row.id as string, { ...operation.row })
    }
  } else if (operation.kind === "PATCH") {
    const stored = rows.get(operation.id)
    if (stored && notOlder(operation.columns.updatedAt, stored.updatedAt)) {
      rows.set(operation.id, { ...stored, ...operation.columns })
    }
  } else {
    const stored = rows.get(operation.id)
    // The server row goes only if it is not newer than what the phone saw.
    if (stored && notOlder(operation.previousUpdatedAt, stored.updatedAt)) {
      rows.delete(operation.id)
    }
  }
}

/**
 * Each phone uploads its queued operations in the given order (reversed when a
 * suite runs the other upload order), then every phone downloads the server.
 */
function sync(devices: Device[], uploadOrder = devices) {
  for (const device of devices) record(device)
  for (const device of reversedUpload
    ? [...uploadOrder].reverse()
    : uploadOrder) {
    for (const operation of device.queue) applyToServer(operation)
    device.queue = []
  }
  for (const device of devices) {
    for (const table of PLACEMENT_TABLES) {
      device.sqlite.exec(`DELETE FROM "${table}"`)
      insert(device.sqlite, table, [...server.get(table)!.values()])
    }
    rebaseline(device)
  }
}

/** The scenarios that start without the shared crews drop them everywhere. */
function forgetBaseCrews(devices: Device[]) {
  server.get("crews")!.clear()
  for (const device of devices) {
    device.sqlite.exec('DELETE FROM "crews"')
    rebaseline(device)
  }
}

const count = (device: Device, table: string) =>
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

const evaluationsOf = (device: Device) =>
  device.sqlite
    .prepare(
      'SELECT studentId, value, note, updatedAt FROM "evaluations" ORDER BY studentId',
    )
    .all() as Row[]

const EARLIER = "2026-09-20T09:00:00.000Z"
const LATER = "2026-09-20T10:00:00.000Z"

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  server = seedServer()
  reversedUpload = false
})
afterEach(() => {
  vi.useRealTimers()
})

describe.each([false, true])(
  "two phones edit the same placements offline (SC-B1-1), upload order reversed: %s",
  (reversed) => {
    beforeEach(() => {
      reversedUpload = reversed
    })

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
        plan({ "crew-1": ["student-3"], "crew-2": ["student-2"] }, [
          "student-1",
        ]),
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
        expect(
          (await readCrewPlan("course-1", "sat-pm")).resolvedConflicts,
        ).toBe(0)
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
  },
)

describe.each([false, true])(
  "two phones create crews in one session offline (owner decision 12), upload order reversed: %s",
  (reversed) => {
    beforeEach(() => {
      reversedUpload = reversed
    })

    const draft = (
      id: string,
      studentIds: string[],
      boatId: string | null,
    ): CrewPlan["crews"][number] => ({
      id,
      sessionId: "sat-pm",
      members: studentIds.map((personId) => ({
        personId,
        personType: "student" as const,
      })),
      capacity: 2,
      destination: boatId ? ("boat" as const) : ("unassigned" as const),
      boatId,
    })

    it("orders the crews, gives the boat to the later edit and cleans up on save", async () => {
      const phoneA = createDevice()
      const phoneB = createDevice()
      forgetBaseCrews([phoneA, phoneB])
      vi.setSystemTime(new Date(EARLIER))
      await saveCrewPlan(
        "course-1",
        "sat-pm",
        {
          crews: [draft("crew-a", ["student-1"], "boat-1")],
          landStudentIds: [],
          selectedBoatIds: ["boat-1"],
        },
        phoneA.database,
      )
      vi.setSystemTime(new Date(LATER))
      await saveCrewPlan(
        "course-1",
        "sat-pm",
        {
          crews: [draft("crew-b", ["student-2"], "boat-1")],
          landStudentIds: [],
          selectedBoatIds: ["boat-1"],
        },
        phoneB.database,
      )

      sync([phoneA, phoneB])

      for (const phone of [phoneA, phoneB]) {
        current.database = phone.database as unknown as typeof current.database
        expect(count(phone, "crews")).toBe(2)
        const read = await readCrewPlan("course-1", "sat-pm")
        // Renumbered once, and the boat settled once.
        expect(read.resolvedConflicts).toBe(2)
        expect(read.crews.map(({ id, boatId }) => [id, boatId])).toEqual([
          ["crew-a", null],
          ["crew-b", "boat-1"],
        ])
        expect(read.crews[0]).toMatchObject({
          destination: "unassigned",
          members: [{ personId: "student-1" }],
        })

        const archive = await exportCourseArchive(phone.database)
        expect(archive.tables.crews.map(({ position }) => position)).toEqual([
          0, 1,
        ])

        await saveCrewPlan("course-1", "sat-pm", read, phone.database)
        const after = await readCrewPlan("course-1", "sat-pm")
        expect(after.resolvedConflicts).toBe(0)
        expect(after.crews.map(({ id, boatId }) => [id, boatId])).toEqual([
          ["crew-a", null],
          ["crew-b", "boat-1"],
        ])
      }
    })

    it("keeps the later edit in a slot both phones filled and appends the other", async () => {
      const phoneA = createDevice()
      const phoneB = createDevice()
      vi.setSystemTime(new Date(EARLIER))
      await saveCrewPlan(
        "course-1",
        "sat-pm",
        {
          crews: [
            draft("crew-1", ["student-1"], null),
            draft("crew-2", [], null),
          ],
          landStudentIds: [],
          selectedBoatIds: [],
        },
        phoneA.database,
      )
      vi.setSystemTime(new Date(LATER))
      await saveCrewPlan(
        "course-1",
        "sat-pm",
        {
          crews: [
            draft("crew-1", ["student-2"], null),
            draft("crew-2", [], null),
          ],
          landStudentIds: [],
          selectedBoatIds: [],
        },
        phoneB.database,
      )

      sync([phoneA, phoneB])

      for (const phone of [phoneA, phoneB]) {
        current.database = phone.database as unknown as typeof current.database
        const read = await readCrewPlan("course-1", "sat-pm")
        expect(read.resolvedConflicts).toBe(1)
        expect(read.crews[0]!.members.map(({ personId }) => personId)).toEqual([
          "student-2",
          "student-1",
        ])
        await exportCourseArchive(phone.database)
        await saveCrewPlan("course-1", "sat-pm", read, phone.database)
        const after = await readCrewPlan("course-1", "sat-pm")
        expect(after.resolvedConflicts).toBe(0)
        expect(after.crews[0]!.members.map(({ personId }) => personId)).toEqual(
          ["student-2", "student-1"],
        )
      }
    })

    it("drops the earliest surplus member of a crew both phones filled", async () => {
      const phoneA = createDevice()
      const phoneB = createDevice()
      vi.setSystemTime(new Date(EARLIER))
      await saveCrewPlan(
        "course-1",
        "sat-pm",
        {
          crews: [
            draft("crew-1", ["student-1", "student-3"], null),
            draft("crew-2", [], null),
          ],
          landStudentIds: [],
          selectedBoatIds: [],
        },
        phoneA.database,
      )
      vi.setSystemTime(new Date(LATER))
      await saveCrewPlan(
        "course-1",
        "sat-pm",
        {
          crews: [
            draft("crew-1", ["student-2"], null),
            draft("crew-2", [], null),
          ],
          landStudentIds: [],
          selectedBoatIds: [],
        },
        phoneB.database,
      )

      sync([phoneA, phoneB])

      for (const phone of [phoneA, phoneB]) {
        current.database = phone.database as unknown as typeof current.database
        expect(count(phone, "crewMembers")).toBe(3)
        const read = await readCrewPlan("course-1", "sat-pm")
        expect(read.resolvedConflicts).toBe(1)
        expect(read.crews[0]!.members.map(({ personId }) => personId)).toEqual([
          "student-2",
          "student-3",
        ])
        // Unplaced, and not put on land.
        expect(read.landStudentIds).toEqual([])
        await exportCourseArchive(phone.database)
        await saveCrewPlan("course-1", "sat-pm", read, phone.database)
        expect(count(phone, "crewMembers")).toBe(2)
        expect(
          (await readCrewPlan("course-1", "sat-pm")).resolvedConflicts,
        ).toBe(0)
        expect(count(phone, "landAssignments")).toBe(0)
      }
    })

    // Review DI-B4-1: a flexible-crew course (D1) has no fixed size; the
    // crew's own capacity bounds it.
    it("keeps a flexible crew within its capacity when both phones filled its last seat", async () => {
      const phoneA = createDevice()
      const phoneB = createDevice()
      for (const phone of [phoneA, phoneB])
        phone.sqlite.exec("UPDATE courses SET level = 1, label = 'D1 38 2026'")
      vi.setSystemTime(new Date(EARLIER))
      await saveCrewPlan(
        "course-1",
        "sat-pm",
        {
          crews: [draft("crew-1", ["student-1", "student-2"], null)],
          landStudentIds: [],
          selectedBoatIds: [],
        },
        phoneA.database,
      )
      vi.setSystemTime(new Date(LATER))
      await saveCrewPlan(
        "course-1",
        "sat-pm",
        {
          crews: [draft("crew-1", ["student-1", "student-3"], null)],
          landStudentIds: [],
          selectedBoatIds: [],
        },
        phoneB.database,
      )

      sync([phoneA, phoneB])

      for (const phone of [phoneA, phoneB]) {
        current.database = phone.database as unknown as typeof current.database
        const read = await readCrewPlan("course-1", "sat-pm")
        expect(read.resolvedConflicts).toBeGreaterThan(0)
        expect(
          read.crews[0]!.members.map(({ personId }) => personId).sort(),
        ).toEqual(["student-1", "student-3"])
        await exportCourseArchive(phone.database)
        await saveCrewPlan("course-1", "sat-pm", read, phone.database)
        expect(count(phone, "crewMembers")).toBe(2)
        expect(
          (await readCrewPlan("course-1", "sat-pm")).resolvedConflicts,
        ).toBe(0)
      }
    })

    it("takes a boat off the crew when one phone removed it from the session", async () => {
      const phoneA = createDevice()
      const phoneB = createDevice()
      vi.setSystemTime(new Date(EARLIER))
      await saveCrewPlan(
        "course-1",
        "sat-pm",
        {
          crews: [
            draft("crew-1", ["student-1"], null),
            draft("crew-2", [], null),
          ],
          landStudentIds: [],
          selectedBoatIds: ["boat-1"],
        },
        phoneA.database,
      )
      sync([phoneA, phoneB])
      vi.setSystemTime(new Date(LATER))
      await saveCrewPlan(
        "course-1",
        "sat-pm",
        {
          crews: [
            draft("crew-1", ["student-1"], "boat-1"),
            draft("crew-2", [], null),
          ],
          landStudentIds: [],
          selectedBoatIds: ["boat-1"],
        },
        phoneA.database,
      )
      vi.setSystemTime(new Date("2026-09-20T10:30:00.000Z"))
      await saveCrewPlan(
        "course-1",
        "sat-pm",
        {
          crews: [
            draft("crew-1", ["student-1"], null),
            draft("crew-2", [], null),
          ],
          landStudentIds: [],
          selectedBoatIds: [],
        },
        phoneB.database,
      )
      // The server refuses neither: the removal deletes the boat selection the
      // phone saw, the assignment patches the crew that still exists.
      sync([phoneA, phoneB], [phoneB, phoneA])

      for (const phone of [phoneA, phoneB]) {
        current.database = phone.database as unknown as typeof current.database
        const read = await readCrewPlan("course-1", "sat-pm")
        expect(read.resolvedConflicts).toBe(1)
        expect(read.crews[0]).toMatchObject({
          id: "crew-1",
          boatId: null,
          destination: "unassigned",
          members: [{ personId: "student-1" }],
        })
        await exportCourseArchive(phone.database)
        await saveCrewPlan("course-1", "sat-pm", read, phone.database)
        expect(
          (await readCrewPlan("course-1", "sat-pm")).resolvedConflicts,
        ).toBe(0)
      }
    })
  },
)

// Review SC-B4-6: the same rules the server enforces, in each upload order.
describe.each([false, true])(
  "the server settles on the latest edit, upload order reversed: %s",
  (reversed) => {
    beforeEach(() => {
      reversedUpload = reversed
    })

    const use = (device: Device) => {
      current.database = device.database as unknown as typeof current.database
    }
    const at = (time: string) => vi.setSystemTime(new Date(time))
    const membersOf = (device: Device) =>
      (
        device.sqlite
          .prepare('SELECT crewId, personId FROM "crewMembers" ORDER BY id')
          .all() as Array<{ crewId: string; personId: string }>
      ).map(({ crewId, personId }) => `${crewId}:${personId}`)
    const serverEvaluations = () => [...server.get("evaluations")!.values()]

    it("keeps the later evaluation when the later phone uploads first", async () => {
      const phoneA = createDevice()
      const phoneB = createDevice()
      at(EARLIER)
      use(phoneA)
      await saveEvaluation("course-1", "student-1", "sat-pm", {
        value: "+",
        note: null,
      })
      at(LATER)
      use(phoneB)
      await saveEvaluation("course-1", "student-1", "sat-pm", {
        value: "++",
        note: null,
      })

      sync([phoneA, phoneB], [phoneB, phoneA])

      for (const rows of [
        evaluationsOf(phoneA),
        evaluationsOf(phoneB),
        serverEvaluations(),
      ]) {
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ value: "++", updatedAt: LATER })
      }
    })

    it.each([
      ["a row both phones created", false],
      ["a row both phones already had", true],
    ])("lets the later phone clear a note (%s)", async (_name, shared) => {
      const phoneA = createDevice()
      const phoneB = createDevice()
      at("2026-09-20T08:00:00.000Z")
      use(phoneA)
      await saveEvaluation("course-1", "student-1", "sat-pm", {
        value: "+",
        note: "prima nota",
      })
      if (shared) sync([phoneA, phoneB])
      at(EARLIER)
      await saveEvaluation("course-1", "student-1", "sat-pm", {
        value: "+",
        note: "ciao",
      })
      at(LATER)
      use(phoneB)
      await saveEvaluation("course-1", "student-1", "sat-pm", {
        value: "+",
        note: null,
      })

      sync([phoneA, phoneB], [phoneB, phoneA])

      for (const rows of [
        evaluationsOf(phoneA),
        evaluationsOf(phoneB),
        serverEvaluations(),
      ]) {
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ value: "+", note: null })
      }
    })

    describe("an earlier delete uploaded after a later re-placement", () => {
      const withMember = (studentIds: string[], positions?: number[]) => ({
        crews: [
          {
            id: "crew-1",
            sessionId: "sat-pm" as const,
            members: studentIds.map((personId) => ({
              personId,
              personType: "student" as const,
            })),
            ...(positions ? { memberPositions: positions } : {}),
            capacity: 2,
            destination: "unassigned" as const,
            boatId: null,
          },
          {
            id: "crew-2",
            sessionId: "sat-pm" as const,
            members: [],
            capacity: 2,
            destination: "unassigned" as const,
            boatId: null,
          },
        ],
        landStudentIds: [],
        selectedBoatIds: [],
      })

      async function setUp() {
        const phoneA = createDevice()
        const phoneB = createDevice()
        at("2026-09-20T08:00:00.000Z")
        await saveCrewPlan(
          "course-1",
          "sat-pm",
          withMember(["student-1"]),
          phoneA.database,
        )
        sync([phoneA, phoneB])
        return { phoneA, phoneB }
      }

      it("keeps a member the later phone removed and placed again", async () => {
        const { phoneA, phoneB } = await setUp()
        at("2026-09-20T09:30:00.000Z")
        await saveCrewPlan(
          "course-1",
          "sat-pm",
          withMember([]),
          phoneA.database,
        )
        record(phoneA)
        at(LATER)
        await saveCrewPlan(
          "course-1",
          "sat-pm",
          withMember([]),
          phoneB.database,
        )
        record(phoneB)
        at("2026-09-20T10:01:00.000Z")
        await saveCrewPlan(
          "course-1",
          "sat-pm",
          withMember(["student-1"]),
          phoneB.database,
        )

        sync([phoneA, phoneB], [phoneB, phoneA])

        for (const phone of [phoneA, phoneB]) {
          expect(membersOf(phone)).toEqual(["crew-1:student-1"])
        }
      })

      const movedMember = async (earlierDeleteFirst: boolean) => {
        reversedUpload = false
        const { phoneA, phoneB } = await setUp()
        at("2026-09-20T09:30:00.000Z")
        await saveCrewPlan(
          "course-1",
          "sat-pm",
          withMember([]),
          phoneA.database,
        )
        at(LATER)
        await saveCrewPlan(
          "course-1",
          "sat-pm",
          withMember(["student-1"], [1]),
          phoneB.database,
        )

        sync(
          [phoneA, phoneB],
          earlierDeleteFirst ? [phoneA, phoneB] : [phoneB, phoneA],
        )

        for (const phone of [phoneA, phoneB]) {
          expect(membersOf(phone)).toEqual(["crew-1:student-1"])
        }
      }

      it("keeps a member the later phone moved, when that phone uploads first", () =>
        movedMember(false))

      // The move goes as the whole row, so it comes back after the earlier
      // delete reached the server first.
      it("keeps a member the later phone moved, when the earlier delete uploads first", () =>
        movedMember(true))
    })
  },
)

function mulberry32(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Without deletes every round must end on the latest edit. With deletes one
// gap stays (docs/working/BACKLOG.md): a delete leaves no tombstone, so an
// older edit of the same row uploaded after it brings the row back.
async function fuzz(allowDeletes: boolean) {
  {
    const random = mulberry32(20261026)
    const pick = <T>(items: readonly T[]) =>
      items[Math.floor(random() * items.length)]!
    const phones = [createDevice(), createDevice()]
    const students = ["student-1", "student-2", "student-3"]
    const values = ["++", "+", "=", "-"] as const
    const expectedEvaluation = new Map<
      string,
      { value: string; note: string | null }
    >()
    const expectedLand = new Set<string>()
    const landOf = (device: Device) =>
      new Set(
        (
          device.sqlite
            .prepare('SELECT studentId FROM "landAssignments"')
            .all() as Array<{ studentId: string }>
        ).map(({ studentId }) => studentId),
      )

    for (let round = 0; round < 200; round += 1) {
      const log: string[] = []
      const ops = 1 + Math.floor(random() * 4)
      for (let step = 0; step < ops; step += 1) {
        const phone = pick(phones)
        const name = phone === phones[0] ? "A" : "B"
        vi.setSystemTime(
          new Date(
            Date.UTC(2026, 8, 20, 8, 0, 0) + (round * 10 + step) * 60_000,
          ),
        )
        current.database = phone.database as unknown as typeof current.database
        if (random() < 0.5) {
          const student = pick(students)
          const clear = allowDeletes && random() < 0.2
          const value = clear ? null : pick(values)
          const note =
            clear || random() < 0.5 ? null : `n${Math.floor(random() * 3)}`
          const before = phone.queue.length
          await saveEvaluation("course-1", student, "sat-pm", { value, note })
          if (record(phone) > before) {
            // Every save goes as the whole row: the latest save stands whole.
            if (value === null && note === null)
              expectedEvaluation.delete(student)
            else
              expectedEvaluation.set(student, { value: value as string, note })
          }
          log.push(`${name} eval ${student} ${value} ${note}`)
        } else {
          const before = landOf(phone)
          const wanted = students.filter(
            (student) =>
              (!allowDeletes && before.has(student)) || random() < 0.5,
          )
          await saveCrewPlan(
            "course-1",
            "sat-pm",
            plan({}, wanted),
            phone.database,
          )
          record(phone)
          for (const student of students) {
            if (before.has(student) !== wanted.includes(student)) {
              if (wanted.includes(student)) expectedLand.add(student)
              else expectedLand.delete(student)
            }
          }
          log.push(`${name} land ${wanted.join(",")}`)
        }
      }
      sync(phones, random() < 0.5 ? phones : [phones[1]!, phones[0]!])

      const context = "round " + round + ": " + log.join(" | ")
      for (const phone of phones) {
        expect(
          Object.fromEntries(
            evaluationsOf(phone).map((row) => [
              row.studentId,
              { value: row.value, note: row.note },
            ]),
          ),
          context,
        ).toEqual(Object.fromEntries(expectedEvaluation))
        expect([...landOf(phone)].sort(), context).toEqual(
          [...expectedLand].sort(),
        )
      }
    }
  }
}

describe("a seeded fuzz of evaluation and land saves on two phones", () => {
  it("ends every round on the latest edit when nothing is deleted", () =>
    fuzz(false))

  it.fails(
    "ends every round on the latest edit with deletes (known server gap)",
    () => fuzz(true),
  )
})
