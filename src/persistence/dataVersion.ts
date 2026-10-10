import type { PowerSyncDatabase, Transaction } from "@powersync/web"

import {
  dataVersionAfterWrite,
  decodeVersion,
  encodeVersion,
  type DataVersion,
  type Version,
} from "@/domain/compatibility"

/**
 * D3: what the data records about the apps that wrote it
 * (src/domain/compatibility.ts), in `meta`, which every schema declares, as
 * encoded versions. Data that records nothing was written before the contract.
 */
const VERSION_ID = "data:version"
const MINIMUM_WRITER_ID = "data:minimumWriter"

export async function readDataVersion(
  context: Pick<PowerSyncDatabase, "getAll">,
): Promise<DataVersion | null> {
  const rows = await context.getAll<{ id: string; value: number | null }>(
    "SELECT id, value FROM meta WHERE id IN (?, ?)",
    [VERSION_ID, MINIMUM_WRITER_ID],
  )
  const value = (id: string) => rows.find((row) => row.id === id)?.value
  const version = value(VERSION_ID)
  const minimumWriter = value(MINIMUM_WRITER_ID)
  if (version == null || minimumWriter == null) return null
  try {
    return {
      version: decodeVersion(version),
      minimumWriter: decodeVersion(minimumWriter),
    }
  } catch {
    // An unreadable record is rewritten by the next app that may write.
    return null
  }
}

/** Whether the record does not yet say what `app` writing the data means. */
export function dataVersionNeedsRecord(
  app: Version,
  stored: DataVersion | null,
) {
  const next = dataVersionAfterWrite(app, stored)
  return (
    !stored ||
    encodeVersion(stored.version) !== encodeVersion(next.version) ||
    encodeVersion(stored.minimumWriter) !== encodeVersion(next.minimumWriter)
  )
}

/** Records `app` as a writer of the data, in the caller's transaction. */
export async function recordDataVersion(
  transaction: Pick<Transaction, "execute">,
  app: Version,
  stored: DataVersion | null,
) {
  const next = dataVersionAfterWrite(app, stored)
  for (const [id, version] of [
    [VERSION_ID, next.version],
    [MINIMUM_WRITER_ID, next.minimumWriter],
  ] as const) {
    await transaction.execute(
      "INSERT OR REPLACE INTO meta(id, value) VALUES (?, ?)",
      [id, encodeVersion(version)],
    )
  }
}
