import { describe, expect, it, vi } from "vitest"

vi.mock(
  "@journeyapps/wa-sqlite/src/examples/IDBBatchAtomicVFS.js?cvc-original",
  () => ({
    IDBBatchAtomicVFS: class {
      mapIdToFile = new Map<number, unknown>()
      close = vi.fn()
      ready = false
      result = 0
      fail = false
      async isReady() {
        this.ready = true
      }
      async jClose(id: number) {
        if (this.fail) throw new Error("sync failed")
        this.mapIdToFile.delete(id)
        return this.result
      }
    },
  }),
)

import { IDBBatchAtomicVFS } from "./idbBatchAtomicVfs"

type Probe = IDBBatchAtomicVFS & {
  ready: boolean
  result: number
  fail: boolean
}

describe("pinned IndexedDB VFS close lifecycle", () => {
  it("waits for readiness and keeps another open file's connection alive", async () => {
    const vfs = (await IDBBatchAtomicVFS.create("test.db", {})) as Probe
    expect(vfs.ready).toBe(true)
    vfs.mapIdToFile.set(1, "main database")
    vfs.mapIdToFile.set(2, "journal")

    await expect(vfs.jClose(2)).resolves.toBe(0)
    expect(vfs.close).not.toHaveBeenCalled()
    await expect(vfs.jClose(1)).resolves.toBe(0)
    expect(vfs.close).toHaveBeenCalledOnce()
  })

  it("does not report a failed last-file close as a released connection", async () => {
    const vfs = (await IDBBatchAtomicVFS.create("test.db", {})) as Probe
    vfs.mapIdToFile.set(1, "main database")
    vfs.result = 10
    await expect(vfs.jClose(1)).resolves.toBe(10)
    expect(vfs.close).not.toHaveBeenCalled()

    vfs.mapIdToFile.set(1, "main database")
    vfs.fail = true
    await expect(vfs.jClose(1)).rejects.toThrow("sync failed")
    expect(vfs.close).not.toHaveBeenCalled()
  })

  it("releases only the closing VFS instance, preserving a different database", async () => {
    const regular = await IDBBatchAtomicVFS.create("regular.db", {})
    const test = await IDBBatchAtomicVFS.create("test.db", {})
    regular.mapIdToFile.set(1, "regular database")
    test.mapIdToFile.set(1, "test database")

    await test.jClose(1)
    expect(test.close).toHaveBeenCalledOnce()
    expect(regular.close).not.toHaveBeenCalled()
    expect(regular.mapIdToFile.size).toBe(1)
  })
})
