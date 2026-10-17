// @ts-expect-error The pinned VFS is JavaScript without declarations. The query avoids our Vite alias.
import { IDBBatchAtomicVFS as StockVfs } from "@journeyapps/wa-sqlite/src/examples/IDBBatchAtomicVFS.js?cvc-original"
import { SQLITE_OK } from "@journeyapps/wa-sqlite"

type VfsHandle = {
  mapIdToFile: Map<number, unknown>
  isReady(): Promise<void>
  jClose(fileId: number): Promise<number>
  close(): void
}
const BaseVfs = StockVfs as new (
  name: string,
  module: unknown,
  options?: object,
) => VfsHandle

/**
 * SQLite closes every file before its adapter reports closed. The pinned VFS
 * otherwise leaves its IndexedDB connection open in a surviving SharedWorker.
 * Release only this VFS instance, after its last successful file close.
 * Storage, locking, writes and the SDK worker remain the stock implementation.
 */
export class IDBBatchAtomicVFS extends BaseVfs {
  static async create(name: string, module: unknown, options?: object) {
    const vfs = new IDBBatchAtomicVFS(name, module, options)
    await vfs.isReady()
    return vfs
  }

  override async jClose(fileId: number) {
    const result = await super.jClose(fileId)
    if (result === SQLITE_OK && this.mapIdToFile.size === 0) this.close()
    return result
  }
}
