import { describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/db", () => ({ db: {} }))
vi.mock("@/persistence/migrations", () => ({
  prepareDatabase: vi.fn(async () => "write"),
}))

import type { PowerSyncDatabase } from "@powersync/web"

import {
  disconnectForErase,
  eraseSyncedCopy,
} from "@/persistence/serverErasures"
import { markReadOnly, ReadOnlyDataError } from "@/persistence/writeGuard"

/** A transaction over an in-memory `serverErasures` and one course. */
function transaction(courses: string[], stored: Record<string, number[]>) {
  const statements: string[] = []
  return {
    statements,
    stored,
    getAll: vi.fn(async (sql: string, parameters: unknown[] = []) => {
      if (sql === "SELECT id FROM courses") return courses.map((id) => ({ id }))
      const row = stored[parameters[0] as string]
      return row ? [{ erase: row[0] }] : []
    }),
    execute: vi.fn(async (sql: string, parameters: unknown[] = []) => {
      statements.push(sql)
      if (sql.startsWith("INSERT OR REPLACE INTO serverErasures")) {
        const [id, erase, keep] = parameters as [string, number, number]
        stored[id] = [erase, keep]
      }
    }),
  }
}

describe("the record of what the server must still erase", () => {
  it("forgets the synced copy first, then records the course for erasure", async () => {
    const tx = transaction(["a"], {})
    await eraseSyncedCopy(tx as never)
    expect(tx.statements[0]).toBe("SELECT powersync_clear(0)")
    expect(tx.stored).toEqual({ a: [1, 0] })
  })

  it("keeps a course file imported under the same id, after erasing its old rows", async () => {
    const tx = transaction(["a"], {})
    await eraseSyncedCopy(tx as never, "a")
    expect(tx.stored).toEqual({ a: [1, 1] })
  })

  it("records another imported course for acceptance beside the erased one", async () => {
    const tx = transaction(["a"], {})
    await eraseSyncedCopy(tx as never, "b")
    expect(tx.stored).toEqual({ a: [1, 0], b: [0, 1] })
  })

  it("erases for good an imported course erased before it reached the server", async () => {
    const tx = transaction(["b"], { b: [0, 1] })
    await eraseSyncedCopy(tx as never)
    expect(tx.stored).toEqual({ b: [1, 0] })
  })

  it("brings back an erased id when its file is imported", async () => {
    const tx = transaction([], { a: [1, 0] })
    await eraseSyncedCopy(tx as never, "a")
    expect(tx.stored).toEqual({ a: [1, 1] })
  })

  // Review DI-B6-2: a read-only device does not stop its backup for an
  // erase it cannot make.
  it("refuses before disconnecting a read-only database", async () => {
    const database = {
      connected: true,
      connecting: false,
      disconnect: vi.fn(),
    } as unknown as PowerSyncDatabase
    markReadOnly(database)
    await expect(disconnectForErase(database)).rejects.toBeInstanceOf(
      ReadOnlyDataError,
    )
    expect(database.disconnect).not.toHaveBeenCalled()
  })
})
