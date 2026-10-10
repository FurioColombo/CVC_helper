import { describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/db", () => ({ db: {} }))

import {
  applyMigration,
  COURSE_TABLES,
  MIGRATIONS,
  runMigrations,
  type Migration,
} from "@/persistence/migrations"

/**
 * A database double whose write transactions record their SQL and keep the
 * appMeta ledger, committing a transaction's ledger rows only when its callback
 * finishes, as SQLite does.
 */
function fakeDatabase(initialLedger: string[] = []) {
  const ledger = new Set(initialLedger)
  const transactions: string[][] = []
  const writeTransaction = vi.fn(
    async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
      const statements: string[] = []
      const pending: string[] = []
      const transaction = {
        getOptional: async (sql: string, params: unknown[]) => {
          statements.push(sql)
          return ledger.has(String(params[0])) ? { id: params[0] } : null
        },
        execute: async (sql: string, params: unknown[] = []) => {
          statements.push(sql)
          if (sql.startsWith("INSERT INTO appMeta"))
            pending.push(String(params[0]))
          return { rowsAffected: 0 }
        },
      }
      const result = await callback(transaction)
      for (const key of pending) ledger.add(key)
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
    expect([...ledger]).toEqual(["migration:first", "migration:second"])
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
    expect([...ledger]).toEqual(["migration:before"])
  })

  it("gives the step one timestamp, the one its ledger row records", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-10T08:00:00.000Z"))
    try {
      const { database } = fakeDatabase()
      const run = vi.fn(async () => {})
      await applyMigration(database as never, step("timed", run))
      expect(run).toHaveBeenCalledWith(
        expect.anything(),
        "2026-10-10T08:00:00.000Z",
      )
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("the D1 migrations", () => {
  it("keep their ids and order; an applied migration is never renamed or moved", () => {
    expect(MIGRATIONS.map((migration) => migration.id)).toEqual([
      "2026-10-d1-course-ownership",
      "2026-10-d1-record-metadata",
    ])
  })

  it("fill course ownership only where it is still missing, from the owning parent", async () => {
    const statements: string[] = []
    const transaction = {
      execute: async (sql: string) => {
        statements.push(sql.replace(/\s+/g, " "))
      },
    }
    await MIGRATIONS[0]!.run(transaction as never, "2026-10-10T08:00:00.000Z")
    expect(statements).toEqual([
      expect.stringMatching(
        /UPDATE faults SET courseId = \(SELECT boats.courseId FROM boats WHERE boats.id = faults.boatId\) WHERE courseId IS NULL/,
      ),
      expect.stringMatching(
        /UPDATE crewMembers SET courseId = \(SELECT crews.courseId FROM crews WHERE crews.id = crewMembers.crewId\) WHERE courseId IS NULL/,
      ),
      expect.stringMatching(
        /UPDATE evaluations SET courseId = \(SELECT students.courseId FROM students WHERE students.id = evaluations.studentId\) WHERE courseId IS NULL/,
      ),
    ])
  })

  it("stamp every course table, keeping a time a row already has", async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = []
    const transaction = {
      execute: async (sql: string, params: unknown[]) => {
        calls.push({ sql: sql.replace(/\s+/g, " "), params })
      },
    }
    const now = "2026-10-10T08:00:00.000Z"
    await MIGRATIONS[1]!.run(transaction as never, now)
    expect(calls.map((call) => call.sql.split(" ")[1])).toEqual([
      ...COURSE_TABLES,
    ])
    for (const call of calls) {
      expect(call.sql).toContain("createdAt = coalesce(createdAt, ?)")
      expect(call.sql).toContain(
        "updatedAt = coalesce(updatedAt, createdAt, ?)",
      )
      expect(call.params).toEqual([now, now])
    }
  })
})
