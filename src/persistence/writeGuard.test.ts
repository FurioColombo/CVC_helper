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

/** A database double whose data asks for `minimumWriter`, or nothing. */
function database(minimumWriter: string | null = null) {
  return {
    execute: vi.fn<(...args: unknown[]) => Promise<string>>(
      async () => "executed",
    ),
    executeBatch: vi.fn<(...args: unknown[]) => Promise<string>>(
      async () => "batched",
    ),
    writeTransaction: vi.fn<(...args: unknown[]) => Promise<string>>(
      async () => "written",
    ),
    writeLock: vi.fn<(...args: unknown[]) => Promise<string>>(
      async () => "locked",
    ),
    getAll: vi.fn(async () => ["row"]),
    getOptional: vi.fn(async () =>
      minimumWriter
        ? { value: encodeVersion(parseVersion(minimumWriter)) }
        : null,
    ),
  }
}

type Fake = ReturnType<typeof database>

describe("guardWrites", () => {
  it("passes every write through while the data may be written", async () => {
    const raw = database("0.4.0")
    const write = raw.execute
    const guarded = guardWrites(raw as never, APP) as unknown as Fake

    await expect(guarded.execute("UPDATE x", [1])).resolves.toBe("executed")
    expect(write).toHaveBeenCalledWith("UPDATE x", [1])
    await expect(guarded.writeTransaction()).resolves.toBe("written")
    expect(isReadOnly(guarded as never)).toBe(false)
  })

  it("refuses every write method, and only those, once the data is read-only", async () => {
    const guarded = guardWrites(database() as never, APP)
    markReadOnly(guarded)
    const methods = guarded as unknown as Fake

    for (const write of [
      methods.execute,
      methods.executeBatch,
      methods.writeTransaction,
      methods.writeLock,
    ]) {
      await expect(write()).rejects.toBeInstanceOf(ReadOnlyDataError)
    }
    await expect(methods.getAll()).resolves.toEqual(["row"])
  })

  // A newer app on the device raised the minimum writer while this one was
  // open: its next write finds out, refuses, and the app is told.
  it("turns read-only at the first write after a newer app excluded this version", async () => {
    const raw = database("0.6.0")
    const write = raw.writeTransaction
    const guarded = guardWrites(raw as never, APP) as unknown as Fake
    const told = vi.fn()
    const stop = onReadOnly(told)

    await expect(guarded.writeTransaction()).rejects.toBeInstanceOf(
      ReadOnlyDataError,
    )

    expect(write).not.toHaveBeenCalled()
    expect(isReadOnly(guarded as never)).toBe(true)
    expect(told).toHaveBeenCalledOnce()
    stop()
  })
})
