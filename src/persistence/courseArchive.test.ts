import { DatabaseSync } from "node:sqlite"
import type { PowerSyncDatabase } from "@powersync/web"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { DataVersion } from "@/domain/compatibility"
import { APP_VERSION as RUNNING_APP_VERSION } from "@/appVersion"
import {
  dataVersionAfterWrite,
  encodeVersion,
  parseVersion,
} from "@/domain/compatibility"
import { dutySettingItems } from "@/persistence/dutyItems"
import {
  CourseArchiveError,
  createCourseArchive,
  type CourseArchiveTables,
} from "@/persistence/courseArchiveFormat"
import {
  exportCourseArchive,
  importCourseArchive,
} from "@/persistence/courseArchive"
import {
  bindCourseSession,
  CourseReplacedError,
} from "@/persistence/courseSession"
import { AppSchema, COURSE_TABLES } from "@/persistence/schema"
import { guardWrites } from "@/persistence/writeGuard"

vi.mock("@/persistence/db", () => ({ db: {} }))

const CREATED_AT = "2026-09-01T12:00:00.000Z"
const UPDATED_AT = "2026-09-02T12:34:56.789Z"
const APP_VERSION = RUNNING_APP_VERSION
const PREVIOUS_DATA_VERSION: DataVersion = {
  version: parseVersion("0.3.0"),
  minimumWriter: parseVersion("0.2.0"),
}
// What the running app (src/appVersion.ts) records when it writes the data.
const NEWER_DATA_VERSION: DataVersion = dataVersionAfterWrite(
  RUNNING_APP_VERSION,
  PREVIOUS_DATA_VERSION,
)
const APP_SCHEMA = (
  AppSchema as unknown as {
    toJSON: () => {
      tables: Array<{
        name: string
        columns: Array<{ name: string; type: string }>
      }>
    }
  }
).toJSON()
const SCHEMA_BY_TABLE = new Map(
  APP_SCHEMA.tables.map((table) => [table.name, table]),
)

type SqlValue = string | number | bigint | null | Uint8Array
type TestTransaction = {
  getAll: <Row extends object = Record<string, unknown>>(
    sql: string,
    parameters?: unknown[],
  ) => Promise<Row[]>
  getOptional: <Row extends object = Record<string, unknown>>(
    sql: string,
    parameters?: unknown[],
  ) => Promise<Row | null>
  get: <Row extends object = Record<string, unknown>>(
    sql: string,
    parameters?: unknown[],
  ) => Promise<Row>
  execute: (sql: string, parameters?: unknown[]) => Promise<unknown>
  executeBatch: (sql: string, parameters: unknown[][]) => Promise<unknown>
}

function sampleTables(): CourseArchiveTables {
  const lists = {
    fewerDayIds: ["saturday"],
    stayOverStudentIds: ["student-1"],
    completedDayIds: [] as string[],
    acknowledgedWarningKeys: ["minor-balance:2,0"],
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
        phone: "555-0101",
        size: "M",
        initialNote: "Prima esperienza",
        courseNote: null,
        active: 1,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
      {
        id: "student-2",
        courseId: "course-1",
        firstName: "Gio",
        surname: "Bianchi",
        nickname: null,
        dateOfBirth: null,
        declaredAgeAtCourseStart: 20,
        sex: "male",
        phone: null,
        size: "L",
        initialNote: null,
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
    dutySettingItems: dutySettingItems("course-1", lists)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((item) => ({
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
    landAssignments: [
      {
        id: "land-1",
        courseId: "course-1",
        sessionId: "sun-am",
        studentId: "student-2",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
    ],
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

function archiveOf(
  tables: CourseArchiveTables,
  dataVersion: DataVersion = PREVIOUS_DATA_VERSION,
) {
  return createCourseArchive(tables, dataVersion, APP_VERSION)
}

function emptyTables(): CourseArchiveTables {
  return {
    courses: [],
    students: [],
    volunteers: [],
    boats: [],
    faults: [],
    dutyAssignments: [],
    dutySettings: [],
    dutySettingItems: [],
    crews: [],
    crewMembers: [],
    landAssignments: [],
    sessionBoats: [],
    evaluations: [],
  }
}

function createSqlite(
  tables: CourseArchiveTables,
  dataVersion: DataVersion,
  generation: number,
) {
  const sqlite = new DatabaseSync(":memory:")
  for (const { name, columns } of APP_SCHEMA.tables) {
    const definitions = [
      '"id" TEXT PRIMARY KEY',
      ...columns.map(({ name: column, type }) => `"${column}" ${type}`),
    ]
    sqlite.exec(`CREATE TABLE "${name}" (${definitions.join(", ")})`)
  }

  for (const table of COURSE_TABLES) {
    const schema = SCHEMA_BY_TABLE.get(table)
    if (!schema) throw new Error(`Missing AppSchema table ${table}`)
    const columns = ["id", ...schema.columns.map(({ name }) => name)]
    const insert = sqlite.prepare(
      `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    )
    for (const row of tables[table]) {
      insert.run(...(columns.map((column) => row[column]) as SqlValue[]))
    }
  }

  const insertMeta = sqlite.prepare("INSERT INTO meta(id, value) VALUES (?, ?)")
  insertMeta.run("data:version", encodeVersion(dataVersion.version))
  insertMeta.run("data:minimumWriter", encodeVersion(dataVersion.minimumWriter))
  insertMeta.run("local:course-generation", generation)
  insertMeta.run("migration:fixture-ledger", 1_790_000_000_000)
  return sqlite
}

interface HandleOptions {
  afterBatchRow?: (sql: string, index: number) => void
}

function makeHandle(sqlite: DatabaseSync, options: HandleOptions = {}) {
  const writes: Array<{ sql: string; parameters: unknown[] }> = []
  const readTransactionQueries: string[][] = []
  let writeTransactionCount = 0

  const readAll = <Row extends object = Record<string, unknown>>(
    sql: string,
    parameters: unknown[] = [],
    readQueries?: string[],
  ): Row[] => {
    readQueries?.push(sql)
    return sqlite
      .prepare(sql)
      .all(...(parameters as SqlValue[]))
      .map((row) => ({ ...row }) as Row)
  }

  const context = (readQueries?: string[]): TestTransaction => ({
    getAll: async <Row extends object = Record<string, unknown>>(
      sql: string,
      parameters: unknown[] = [],
    ) => readAll<Row>(sql, parameters, readQueries),
    getOptional: async <Row extends object = Record<string, unknown>>(
      sql: string,
      parameters: unknown[] = [],
    ) => readAll<Row>(sql, parameters, readQueries)[0] ?? null,
    get: async <Row extends object = Record<string, unknown>>(
      sql: string,
      parameters: unknown[] = [],
    ) => {
      const row = readAll<Row>(sql, parameters, readQueries)[0]
      if (!row) throw new Error("Expected a database row")
      return row
    },
    execute: async (sql, parameters = []) => {
      writes.push({ sql, parameters: [...parameters] })
      return sqlite.prepare(sql).run(...(parameters as SqlValue[]))
    },
    executeBatch: async (sql, batch) => {
      for (const [index, parameters] of batch.entries()) {
        writes.push({ sql, parameters: [...parameters] })
        const result = sqlite.prepare(sql).run(...(parameters as SqlValue[]))
        options.afterBatchRow?.(sql, index)
        if (index === batch.length - 1) return result
      }
      return undefined
    },
  })

  async function transaction<T>(
    kind: "read" | "write",
    callback: (transaction: TestTransaction) => Promise<T>,
  ): Promise<T> {
    if (kind === "write") writeTransactionCount += 1
    sqlite.exec(kind === "write" ? "BEGIN IMMEDIATE" : "BEGIN")
    const queries: string[] = []
    if (kind === "read") readTransactionQueries.push(queries)
    try {
      const result = await callback(
        context(kind === "read" ? queries : undefined),
      )
      sqlite.exec("COMMIT")
      return result
    } catch (error) {
      sqlite.exec("ROLLBACK")
      throw error
    }
  }

  const raw = {
    init: async () => {},
    getAll: async <Row extends object = Record<string, unknown>>(
      sql: string,
      parameters: unknown[] = [],
    ) => readAll<Row>(sql, parameters),
    getOptional: async <Row extends object = Record<string, unknown>>(
      sql: string,
      parameters: unknown[] = [],
    ) => readAll<Row>(sql, parameters)[0] ?? null,
    get: async <Row extends object = Record<string, unknown>>(
      sql: string,
      parameters: unknown[] = [],
    ) => {
      const row = readAll<Row>(sql, parameters)[0]
      if (!row) throw new Error("Expected a database row")
      return row
    },
    readTransaction: <T>(callback: (tx: TestTransaction) => Promise<T>) =>
      transaction("read", callback),
    writeTransaction: <T>(callback: (tx: TestTransaction) => Promise<T>) =>
      transaction("write", callback),
    writeLock: <T>(callback: (tx: TestTransaction) => Promise<T>) =>
      transaction("write", callback),
    execute: (sql: string, parameters: unknown[] = []) =>
      transaction("write", (tx) => tx.execute(sql, parameters)),
    executeBatch: (sql: string, batch: unknown[][]) =>
      transaction("write", (tx) => tx.executeBatch(sql, batch)),
    executeRaw: async () => undefined,
  }

  return {
    database: guardWrites(raw as unknown as PowerSyncDatabase),
    writes,
    readTransactionQueries,
    get writeTransactionCount() {
      return writeTransactionCount
    },
  }
}

function courseRows(sqlite: DatabaseSync): CourseArchiveTables {
  return Object.fromEntries(
    COURSE_TABLES.map((table) => [
      table,
      sqlite
        .prepare(`SELECT * FROM "${table}" ORDER BY id`)
        .all()
        .map((row) => ({ ...row })),
    ]),
  ) as CourseArchiveTables
}

function metaRows(sqlite: DatabaseSync) {
  return new Map(
    sqlite
      .prepare("SELECT id, value FROM meta ORDER BY id")
      .all()
      .map((row) => [String(row.id), Number(row.value)] as const),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("course archive persistence", () => {
  it("exports one consistent snapshot and imports all 13 tables row for row", async () => {
    const tables = sampleTables()
    const expected = archiveOf(tables, NEWER_DATA_VERSION)
    const sourceSqlite = createSqlite(tables, NEWER_DATA_VERSION, 4)
    const source = makeHandle(sourceSqlite)

    const exported = await exportCourseArchive(source.database)

    expect(exported).toEqual(expected)
    expect(exported.tables).toEqual(tables)
    expect(exported.tables.students[0]).toMatchObject({
      id: "student-1",
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
      phone: "555-0101",
    })
    // One snapshot: 13 tables, the version record and the sync mode (B1).
    expect(source.readTransactionQueries.at(-1)).toHaveLength(16)

    const current = structuredClone(tables)
    current.students[0]!.courseNote = "Existing local note"
    current.courses[0]!.updatedAt = "2026-09-03T12:00:00.000Z"
    const destinationSqlite = createSqlite(current, NEWER_DATA_VERSION, 6)
    const destination = makeHandle(destinationSqlite)

    await importCourseArchive(exported, destination.database)

    expect(courseRows(destinationSqlite)).toEqual(tables)
    expect(metaRows(destinationSqlite).get("local:course-generation")).toBe(7)
    expect(metaRows(destinationSqlite).get("migration:fixture-ledger")).toBe(
      1_790_000_000_000,
    )
    expect(metaRows(destinationSqlite).get("data:version")).toBe(
      encodeVersion(NEWER_DATA_VERSION.version),
    )
    expect(metaRows(destinationSqlite).get("data:minimumWriter")).toBe(
      encodeVersion(NEWER_DATA_VERSION.minimumWriter),
    )

    sourceSqlite.close()
    destinationSqlite.close()
  })

  it("rejects invalid, corrupt and too-new archives before starting a write transaction", async () => {
    const original = sampleTables()
    const sqlite = createSqlite(original, PREVIOUS_DATA_VERSION, 3)
    const handle = makeHandle(sqlite)
    const beforeRows = courseRows(sqlite)
    const beforeMeta = metaRows(sqlite)
    const archive = archiveOf(original)
    const corrupt = structuredClone(archive)
    corrupt.tables.students[0]!.phone = 555
    const tooNew = structuredClone(archive)
    // Written by a minor version after the running app (src/appVersion.ts).
    const nextMinor = {
      ...RUNNING_APP_VERSION,
      minor: RUNNING_APP_VERSION.minor + 1,
      patch: 0,
    }
    tooNew.dataVersion = { version: nextMinor, minimumWriter: nextMinor }

    const cases: Array<[unknown, CourseArchiveError["code"]]> = [
      [{ ...archive, format: "other" }, "unsupported-format"],
      [corrupt, "invalid-data"],
      [tooNew, "incompatible-version"],
    ]
    for (const [value, code] of cases) {
      await expect(
        importCourseArchive(value, handle.database),
      ).rejects.toMatchObject({ code })
      expect(handle.writeTransactionCount).toBe(0)
      expect(courseRows(sqlite)).toEqual(beforeRows)
      expect(metaRows(sqlite)).toEqual(beforeMeta)
    }

    sqlite.close()
  })

  it("preserves same IDs, merges version records and blocks the stale tab's first write", async () => {
    const importedTables = sampleTables()
    importedTables.students[0]!.courseNote = "Imported note"
    const imported = archiveOf(importedTables, PREVIOUS_DATA_VERSION)
    const currentTables = sampleTables()
    currentTables.students[0]!.courseNote = "Old local note"
    const sqlite = createSqlite(currentTables, NEWER_DATA_VERSION, 8)
    const importingTab = makeHandle(sqlite)
    const staleTab = makeHandle(sqlite)
    await bindCourseSession(staleTab.database)

    await importCourseArchive(imported, importingTab.database)

    expect(courseRows(sqlite)).toEqual(importedTables)
    expect(courseRows(sqlite).courses[0]!.id).toBe("course-1")
    expect(courseRows(sqlite).students[0]!.id).toBe("student-1")
    expect(metaRows(sqlite).get("data:version")).toBe(
      encodeVersion(NEWER_DATA_VERSION.version),
    )
    expect(metaRows(sqlite).get("data:minimumWriter")).toBe(
      encodeVersion(NEWER_DATA_VERSION.minimumWriter),
    )
    expect(metaRows(sqlite).get("migration:fixture-ledger")).toBe(
      1_790_000_000_000,
    )
    expect(metaRows(sqlite).get("local:course-generation")).toBe(9)

    const staleSave = vi.fn(
      async (transaction: { execute: TestTransaction["execute"] }) =>
        transaction.execute("UPDATE students SET courseNote = ? WHERE id = ?", [
          "stale overwrite",
          "student-1",
        ]),
    )
    await expect(
      staleTab.database.writeTransaction(staleSave as never),
    ).rejects.toBeInstanceOf(CourseReplacedError)
    expect(staleSave).not.toHaveBeenCalled()

    const importingTabSave = vi.fn(
      async (transaction: { execute: TestTransaction["execute"] }) =>
        transaction.execute("UPDATE students SET courseNote = ? WHERE id = ?", [
          "old callback",
          "student-1",
        ]),
    )
    await expect(
      importingTab.database.writeTransaction(importingTabSave as never),
    ).rejects.toBeInstanceOf(CourseReplacedError)
    expect(importingTabSave).not.toHaveBeenCalled()
    expect(
      sqlite
        .prepare("SELECT courseNote FROM students WHERE id = ?")
        .get("student-1"),
    ).toEqual({ courseNote: "Imported note" })

    sqlite.close()
  })

  it("rolls back a partially executed batch, course rows, generation and version metadata", async () => {
    const currentTables = sampleTables()
    currentTables.students[0]!.courseNote = "Existing local note"
    const importedTables = sampleTables()
    importedTables.students[0]!.courseNote = "Replacement note"
    const imported = archiveOf(importedTables, PREVIOUS_DATA_VERSION)
    const sqlite = createSqlite(currentTables, NEWER_DATA_VERSION, 11)
    const beforeRows = courseRows(sqlite)
    const beforeMeta = metaRows(sqlite)
    const handle = makeHandle(sqlite, {
      afterBatchRow: (sql, index) => {
        if (sql.startsWith("INSERT INTO crewMembers") && index === 0) {
          throw new Error("simulated interruption after first crew member")
        }
      },
    })

    await expect(
      importCourseArchive(imported, handle.database),
    ).rejects.toThrow("simulated interruption after first crew member")
    expect(courseRows(sqlite)).toEqual(beforeRows)
    expect(metaRows(sqlite)).toEqual(beforeMeta)
    expect(handle.writeTransactionCount).toBe(1)

    sqlite.close()
  })

  it("binds student names and phone numbers as SQL parameters", async () => {
    const tables = sampleTables()
    tables.faults = []
    const archive = archiveOf(tables)
    const sqlite = createSqlite(emptyTables(), PREVIOUS_DATA_VERSION, 0)
    const handle = makeHandle(sqlite)

    await importCourseArchive(archive, handle.database)

    expect(
      handle.writes.some(
        ({ sql, parameters }) =>
          sql.startsWith("INSERT INTO students") &&
          parameters.includes("Ada") &&
          parameters.includes("555-0101"),
      ),
    ).toBe(true)
    expect(handle.writes.map(({ sql }) => sql).join("\n")).not.toContain("Ada")
    expect(handle.writes.map(({ sql }) => sql).join("\n")).not.toContain(
      "555-0101",
    )
    expect(courseRows(sqlite)).toEqual(tables)

    sqlite.close()
  })
})
