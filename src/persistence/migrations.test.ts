import { DatabaseSync } from "node:sqlite"

import { describe, expect, it, vi } from "vitest"

import {
  applyMigration,
  MIGRATIONS,
  prepareDatabase,
  repairRows,
  runMigrations,
  type Migration,
} from "@/persistence/migrations"
import { validateStoredRows, type StoredRow } from "@/persistence/rowIntegrity"
import { AppSchema, COURSE_TABLES } from "@/persistence/schema"

/**
 * A database double whose write transactions record their SQL and keep the
 * `meta` ledger, committing a transaction's ledger rows only when its callback
 * finishes, as SQLite does.
 */
function fakeDatabase(initialLedger: string[] = []) {
  const ledger = new Map(initialLedger.map((key) => [key, 0]))
  const transactions: string[][] = []
  const writeTransaction = vi.fn(
    async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
      const statements: string[] = []
      const pending: Array<[string, number]> = []
      const transaction = {
        getOptional: async (sql: string, params: unknown[]) => {
          statements.push(sql)
          return ledger.has(String(params[0])) ? { id: params[0] } : null
        },
        execute: async (sql: string, params: unknown[] = []) => {
          statements.push(sql)
          if (sql.startsWith("INSERT INTO meta"))
            pending.push([String(params[0]), Number(params[1])])
          return { rowsAffected: 0 }
        },
      }
      const result = await callback(transaction)
      for (const [key, value] of pending) ledger.set(key, value)
      transactions.push(statements)
      return result
    },
  )
  return { database: { writeTransaction }, ledger, transactions }
}

const step = (id: string, run = vi.fn(async () => {})): Migration => ({
  id,
  run,
})

describe("runMigrations", () => {
  it("applies each pending migration in order, one transaction each, and records it", async () => {
    const { database, ledger, transactions } = fakeDatabase()
    const first = step("first")
    const second = step("second")

    const applied = await runMigrations(database as never, [first, second])

    expect(applied).toEqual(["first", "second"])
    expect(vi.mocked(first.run)).toHaveBeenCalledBefore(vi.mocked(second.run))
    expect(transactions).toHaveLength(2)
    expect([...ledger.keys()]).toEqual(["migration:first", "migration:second"])
  })

  it("never runs a migration the ledger already holds", async () => {
    const { database } = fakeDatabase(["migration:first"])
    const first = step("first")
    const second = step("second")

    expect(await runMigrations(database as never, [first, second])).toEqual([
      "second",
    ])
    expect(first.run).not.toHaveBeenCalled()
  })

  it("is a no-op the second time", async () => {
    const { database } = fakeDatabase()
    const migrations = [step("first"), step("second")]
    await runMigrations(database as never, migrations)
    expect(await runMigrations(database as never, migrations)).toEqual([])
  })

  it("records nothing for a migration that fails, so the next open runs it again", async () => {
    const { database, ledger } = fakeDatabase()
    const failing = step(
      "failing",
      vi.fn(async () => {
        throw new Error("interrupted")
      }),
    )
    await expect(applyMigration(database as never, failing)).rejects.toThrow(
      "interrupted",
    )
    expect(ledger.size).toBe(0)
    await expect(
      runMigrations(database as never, [step("before"), failing]),
    ).rejects.toThrow("interrupted")
    expect([...ledger.keys()]).toEqual(["migration:before"])
  })

  it("gives the step one time, the one its ledger row records in `meta`'s integer column", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-10T08:00:00.000Z"))
    try {
      const { database, ledger } = fakeDatabase()
      const run = vi.fn(async () => {})
      await applyMigration(database as never, step("timed", run))
      expect(run).toHaveBeenCalledWith(
        expect.anything(),
        "2026-10-10T08:00:00.000Z",
      )
      expect(ledger.get("migration:timed")).toBe(
        Date.parse("2026-10-10T08:00:00.000Z"),
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it("keeps the ledger in `meta`, which every schema since M0 declares as integer", () => {
    const meta = (
      AppSchema.toJSON() as {
        tables: Array<{
          name: string
          columns: Array<{ name: string; type: string }>
        }>
      }
    ).tables.find((table) => table.name === "meta")
    expect(meta?.columns).toEqual([{ name: "value", type: "INTEGER" }])
  })

  it("has unique migration ids", () => {
    const ids = MIGRATIONS.map((migration) => migration.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe("prepareDatabase", () => {
  function preparable() {
    const order: string[] = []
    const fake = fakeDatabase()
    const database = {
      init: vi.fn(async () => {
        order.push("init")
      }),
      writeTransaction: vi.fn(async (callback: (tx: unknown) => unknown) => {
        const result = await fake.database.writeTransaction(callback as never)
        order.push(
          fake.transactions.at(-1)!.some((sql) => sql.includes("meta"))
            ? "migration"
            : "repairs",
        )
        return result
      }),
    }
    return { database, order }
  }

  it("opens the database, repairs the rows, then runs the migrations, once", async () => {
    const { database, order } = preparable()

    await prepareDatabase(database as never, [step("first")])
    await prepareDatabase(database as never, [step("first")])

    expect(order).toEqual(["init", "repairs", "migration"])
  })

  it("runs again when asked after a failed run", async () => {
    const { database, order } = preparable()
    database.init.mockRejectedValueOnce(new Error("storage unavailable"))

    await expect(prepareDatabase(database as never, [])).rejects.toThrow(
      "storage unavailable",
    )
    await prepareDatabase(database as never, [])

    expect(order).toEqual(["init", "repairs"])
  })
})

/**
 * The repairs on a real SQLite: the course tables as plain tables with the
 * columns the repairs read, rows in every state an older version or an older
 * app sharing the database can leave behind.
 */
describe("repairRows", () => {
  const NOW = "2026-10-10T08:00:00.000Z"
  const T0 = "2026-09-19T10:00:00.000Z"
  const T1 = "2026-09-19T11:00:00.000Z"

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
    return { sqlite, insert, step, read }
  }

  it("fills ownership and metadata, lifts a disordered updatedAt, keeps what rows have, and does it once", async () => {
    const { insert, step, read } = database(["course-1"])
    const stamped = { createdAt: T0, updatedAt: T1 }
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

    await repairRows(step as never, NOW)
    const repaired = read()

    expect(validateStoredRows(repaired)).toEqual([])
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
      {
        id: "fault-orphan",
        courseId: "course-1",
        boatId: "gone",
        ...stamped,
      },
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

    // Every open runs them again; on repaired rows they change nothing.
    await repairRows(step as never, "2026-10-11T08:00:00.000Z")
    expect(read()).toEqual(repaired)
  })

  it("leaves an orphan without a course when the device holds more than one", async () => {
    const { insert, step, read } = database(["course-1", "course-2"])
    insert("faults", {
      id: "fault-orphan",
      boatId: "gone",
      createdAt: T0,
      updatedAt: T0,
    })

    await repairRows(step as never, NOW)

    expect(validateStoredRows(read())).toEqual([
      { table: "faults", id: "fault-orphan", code: "missing-course" },
    ])
  })
})
