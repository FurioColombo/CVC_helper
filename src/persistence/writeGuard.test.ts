import { describe, expect, it, vi } from "vitest"

import { encodeVersion, parseVersion } from "@/domain/compatibility"
import {
  guardWrites,
  isReadOnly,
  markReadOnly,
  onReadOnly,
  ReadOnlyDataError,
} from "@/persistence/writeGuard"

const APP = parseVersion("0.5.0")

/**
 * A database double. Its write transactions and locks hand a context whose
 * `getAll` answers the `meta` record (`minimumWriter`, or none) and whose
 * `execute` records what ran inside the lock.
 */
function database(minimumWriter: string | null = null) {
  const ranInside: string[] = []
  const context = {
    getAll: vi.fn(async () =>
      minimumWriter
        ? [
            {
              id: "data:minimumWriter",
              value: encodeVersion(parseVersion(minimumWriter)),
            },
          ]
        : [],
    ),
    execute: vi.fn(async (sql: string) => {
      ranInside.push(sql)
      return "executed"
    }),
    executeBatch: vi.fn(async (sql: string) => {
      ranInside.push(sql)
      return "batched"
    }),
  }
  const withContext = async (callback: (tx: typeof context) => unknown) =>
    callback(context)
  return {
    ranInside,
    context,
    raw: {
      writeTransaction: vi.fn(withContext),
      writeLock: vi.fn(withContext),
      execute: vi.fn(async () => "outside the lock"),
      executeBatch: vi.fn(async () => "outside the lock"),
      executeRaw: vi.fn(async () => "raw"),
      getAll: vi.fn(async () => ["row"]),
    },
  }
}

type Methods = Record<string, (...args: unknown[]) => Promise<unknown>>

describe("guardWrites", () => {
  it("runs every write inside a lock, after checking the record there", async () => {
    const { raw, ranInside, context } = database("0.4.0")
    const guarded = guardWrites(raw as never, APP) as unknown as Methods

    await expect(guarded.execute!("UPDATE x", [1])).resolves.toBe("executed")
    await expect(guarded.executeBatch!("INSERT y", [[1]])).resolves.toBe(
      "batched",
    )
    await expect(
      guarded.writeTransaction!(async () => "written"),
    ).resolves.toBe("written")

    expect(ranInside).toEqual(["UPDATE x", "INSERT y"])
    // The record is read through the lock's own context, never beside it.
    expect(context.getAll).toHaveBeenCalledTimes(3)
    expect(raw.getAll).not.toHaveBeenCalled()
    expect(isReadOnly(guarded as never)).toBe(false)
  })

  it("refuses every write method, and only those, once the data is read-only", async () => {
    const { raw } = database()
    const guarded = guardWrites(raw as never, APP)
    markReadOnly(guarded)
    const methods = guarded as unknown as Methods

    for (const name of [
      "execute",
      "executeBatch",
      "writeTransaction",
      "writeLock",
      "executeRaw",
    ]) {
      await expect(methods[name]!(async () => {})).rejects.toBeInstanceOf(
        ReadOnlyDataError,
      )
    }
    await expect(methods.getAll!()).resolves.toEqual(["row"])
  })

  // D3 review DI-1: a newer app raised the minimum writer while this one was
  // open; its next write finds out inside its own lock, writes nothing, and
  // the app is told.
  it("turns read-only at the first write after a newer app excluded this version", async () => {
    const { raw, ranInside } = database("0.6.0")
    const guarded = guardWrites(raw as never, APP) as unknown as Methods
    const told = vi.fn()
    const stop = onReadOnly(told)
    const callback = vi.fn(async () => {})

    await expect(guarded.writeTransaction!(callback)).rejects.toBeInstanceOf(
      ReadOnlyDataError,
    )
    await expect(guarded.execute!("UPDATE x")).rejects.toBeInstanceOf(
      ReadOnlyDataError,
    )

    expect(callback).not.toHaveBeenCalled()
    expect(ranInside).toEqual([])
    expect(isReadOnly(guarded as never)).toBe(true)
    expect(told).toHaveBeenCalledOnce()
    stop()
  })
})
