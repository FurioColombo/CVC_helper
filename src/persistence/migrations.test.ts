import { describe, expect, it, vi } from "vitest"

import { encodeVersion, parseVersion } from "@/domain/compatibility"
import {
  applyMigration,
  MIGRATIONS,
  prepareDatabase,
  runMigrations,
  type Migration,
} from "@/persistence/migrations"
import { AppSchema } from "@/persistence/schema"
import { isReadOnly } from "@/persistence/writeGuard"

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
        // No data-version record in this double: a claim finds none.
        getAll: async (sql: string) => {
          statements.push(sql)
          return []
        },
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
  const APP = parseVersion("0.5.0")

  /** A database double; `stored` is what the data records, as meta rows. */
  function preparable(
    needsRepair: boolean,
    stored: Array<{ id: string; value: number }> = [],
  ) {
    const order: string[] = []
    const fake = fakeDatabase()
    const database = {
      readTransaction: async (
        callback: (tx: { getAll: () => Promise<unknown[]> }) => unknown,
      ) => callback({ getAll: async () => [] }),
      init: vi.fn(async () => {
        order.push("init")
      }),
      get: vi.fn(async (sql: string) => {
        order.push(sql.startsWith("SELECT EXISTS") ? "probe" : sql)
        return { needed: needsRepair ? 1 : 0 }
      }),
      // No duty settings stored: the duty-setting rows need no repair.
      getAll: vi.fn(async (sql: string) => {
        const text = sql.replace(/\s+/g, " ")
        if (text.includes("FROM meta WHERE id IN")) {
          order.push("version")
          return stored
        }
        if (/FROM dutySettings WHERE/.test(text)) order.push("items probe")
        return []
      }),
      writeTransaction: vi.fn(async (callback: (tx: unknown) => unknown) => {
        const result = await fake.database.writeTransaction(callback as never)
        const statements = fake.transactions.at(-1)!
        order.push(
          statements.some((sql) =>
            sql.startsWith("INSERT OR REPLACE INTO meta"),
          )
            ? "record"
            : statements.some((sql) => sql.includes("meta"))
              ? "migration"
              : "repairs",
        )
        return result
      }),
    }
    return { database, order, fake }
  }

  const record = (version: string, minimumWriter: string) => [
    { id: "data:version", value: encodeVersion(parseVersion(version)) },
    {
      id: "data:minimumWriter",
      value: encodeVersion(parseVersion(minimumWriter)),
    },
  ]

  it("checks the data's version, claims it, repairs and migrates, once", async () => {
    const { database, order } = preparable(true)

    await expect(
      prepareDatabase(database as never, [step("first")], APP),
    ).resolves.toBe("write")
    await prepareDatabase(database as never, [step("first")], APP)

    // The claim comes first, so an older app refuses its writes from then on
    // (D3 review DI-3).
    expect(order).toEqual([
      "init",
      "version",
      "record",
      "probe",
      "repairs",
      "items probe",
      "migration",
    ])
  })

  it("takes no write transaction when nothing needs repair and the record is current", async () => {
    const { database, order } = preparable(false, record("0.5.0", "0.4.0"))

    await prepareDatabase(database as never, [], APP)

    expect(order).toEqual(["init", "version", "probe", "items probe"])
    expect(database.writeTransaction).not.toHaveBeenCalled()
  })

  // UG3 review DI-UG3-1: an import's compaction cut short is finished at the
  // next open, and an open with nothing pending compacts nothing.
  it("finishes a compaction an import left pending, and only then", async () => {
    for (const pending of [true, false]) {
      const { database } = preparable(false, record("0.5.0", "0.4.0"))
      const statements: string[] = []
      const getAll = database.getAll
      Object.assign(database, {
        getAll: vi.fn(async (sql: string, params?: unknown[]) =>
          sql.includes("FROM meta WHERE id = ?") && pending
            ? [{ id: "local:compaction-pending" }]
            : getAll(sql, params as never),
        ),
        writeLock: vi.fn(
          async (callback: (context: unknown) => Promise<unknown>) =>
            callback({
              execute: async (sql: string) => void statements.push(sql),
            }),
        ),
      })

      await prepareDatabase(database as never, [], APP)

      expect(statements).toEqual(pending ? ["VACUUM"] : [])
    }
  })

  // 03 §3.1: an app older than the data's minimum writer runs no repair or
  // migration, which all write, and its writes refuse.
  it("opens read-only, before any repair, data newer than this version may write", async () => {
    const { database, order } = preparable(true, record("0.7.0", "0.6.0"))

    await expect(
      prepareDatabase(database as never, [step("first")], APP),
    ).resolves.toBe("read-only")

    expect(order).toEqual(["init", "version"])
    expect(database.writeTransaction).not.toHaveBeenCalled()
    expect(isReadOnly(database as never)).toBe(true)
  })

  it("writes the data of the next minor version, which records itself as newer", async () => {
    const { database, order } = preparable(false, record("0.6.0", "0.5.0"))

    await expect(prepareDatabase(database as never, [], APP)).resolves.toBe(
      "write",
    )

    // The record already says more than 0.5.0 would: nothing to rewrite.
    expect(order).toEqual(["init", "version", "probe", "items probe"])
  })

  // D3 review DI-R2-Q1: the claim comes first and stays when a later step
  // fails, so an older app stays refused until a fixed version opens the data.
  it("keeps its claim when a migration after it fails", async () => {
    const { database, order } = preparable(false)
    const failing = step(
      "failing",
      vi.fn(async () => {
        throw new Error("synthetic migration failure")
      }),
    )

    await expect(
      prepareDatabase(database as never, [failing], APP),
    ).rejects.toThrow("synthetic migration failure")

    expect(order).toEqual(["init", "version", "record", "probe", "items probe"])
  })

  it("runs again when asked after a failed run", async () => {
    const { database, order } = preparable(true)
    database.init.mockRejectedValueOnce(new Error("storage unavailable"))

    await expect(prepareDatabase(database as never, [], APP)).rejects.toThrow(
      "storage unavailable",
    )
    await prepareDatabase(database as never, [], APP)

    expect(order).toEqual([
      "init",
      "version",
      "record",
      "probe",
      "repairs",
      "items probe",
    ])
  })
})
