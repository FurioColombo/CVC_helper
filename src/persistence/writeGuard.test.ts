import { describe, expect, it, vi } from "vitest"

import {
  guardWrites,
  isReadOnly,
  markReadOnly,
  ReadOnlyDataError,
} from "@/persistence/writeGuard"

function database() {
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
  }
}

describe("guardWrites", () => {
  it("passes every call through while the data may be written", async () => {
    const write = vi.fn<(...args: unknown[]) => Promise<string>>(
      async () => "executed",
    )
    const guarded = guardWrites({
      ...database(),
      execute: write,
    } as never) as unknown as ReturnType<typeof database>

    await expect(guarded.execute("UPDATE x", [1])).resolves.toBe("executed")
    expect(write).toHaveBeenCalledWith("UPDATE x", [1])
    await expect(guarded.writeTransaction()).resolves.toBe("written")
    expect(isReadOnly(guarded as never)).toBe(false)
  })

  it("refuses every write method, and only those, once the data is read-only", async () => {
    const guarded = guardWrites(database() as never)
    markReadOnly(guarded)
    const methods = guarded as unknown as ReturnType<typeof database>

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
})
