import { describe, expect, it, vi } from "vitest"

import {
  applyMigration,
  MIGRATIONS,
  prepareDatabase,
  runMigrations,
  type Migration,
} from "@/persistence/migrations"
import { AppSchema } from "@/persistence/schema"

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
  function preparable(needsRepair: boolean) {
    const order: string[] = []
    const fake = fakeDatabase()
    const database = {
      init: vi.fn(async () => {
        order.push("init")
      }),
      get: vi.fn(async (sql: string) => {
        order.push(sql.startsWith("SELECT EXISTS") ? "probe" : sql)
        return { needed: needsRepair ? 1 : 0 }
      }),
      // No duty settings stored: the duty-setting rows need no repair.
      getAll: vi.fn(async (sql: string) => {
        if (/FROM dutySettings$/.test(sql.trim())) order.push("items probe")
        return []
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
    const { database, order } = preparable(true)

    await prepareDatabase(database as never, [step("first")])
    await prepareDatabase(database as never, [step("first")])

    expect(order).toEqual([
      "init",
      "probe",
      "repairs",
      "items probe",
      "migration",
    ])
  })

  it("takes no write transaction for repairs when the probe finds nothing to repair", async () => {
    const { database, order } = preparable(false)

    await prepareDatabase(database as never, [])

    expect(order).toEqual(["init", "probe", "items probe"])
    expect(database.writeTransaction).not.toHaveBeenCalled()
  })

  it("runs again when asked after a failed run", async () => {
    const { database, order } = preparable(true)
    database.init.mockRejectedValueOnce(new Error("storage unavailable"))

    await expect(prepareDatabase(database as never, [])).rejects.toThrow(
      "storage unavailable",
    )
    await prepareDatabase(database as never, [])

    expect(order).toEqual(["init", "probe", "repairs", "items probe"])
  })
})
