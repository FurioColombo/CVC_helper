import type { PowerSyncDatabase, Transaction } from "@powersync/web"

import {
  compareVersions,
  dataAccess,
  dataVersionAfterSyncSwitch,
  dataVersionAfterWrite,
  decodeVersion,
  encodeVersion,
  minimumWriterOf,
  type DataAccess,
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

type Reader = Pick<PowerSyncDatabase, "getAll">

function decode(value: number | null | undefined): Version | null {
  if (value == null) return null
  try {
    return decodeVersion(value)
  } catch {
    return null
  }
}

/**
 * The record, read the same way by every check (the open, the claim, the
 * write guard). Only a record with neither part readable is no record: a
 * readable part is kept and the other derived from it, never lowered
 * (D3 review DI-Q1), so a damaged record cannot open the data to older apps.
 */
export async function readDataVersion(
  context: Reader,
): Promise<DataVersion | null> {
  const rows = await context.getAll<{ id: string; value: number | null }>(
    "SELECT id, value FROM meta WHERE id IN (?, ?)",
    [VERSION_ID, MINIMUM_WRITER_ID],
  )
  const value = (id: string) => rows.find((row) => row.id === id)?.value
  const version = decode(value(VERSION_ID))
  const minimumWriter = decode(value(MINIMUM_WRITER_ID))
  if (!version && !minimumWriter) return null
  if (version && minimumWriter) {
    return {
      version:
        compareVersions(version, minimumWriter) >= 0 ? version : minimumWriter,
      minimumWriter,
    }
  }
  if (minimumWriter) return { version: minimumWriter, minimumWriter }
  return {
    version: version!,
    minimumWriter:
      version!.minor > 0 ? minimumWriterOf(version!) : (version as Version),
  }
}

/**
 * What `app` writing the data records. On a device switched to synced tables
 * the minimum writer never drops below the switch's floor, even from a
 * damaged record (B1 review DP-B1-2).
 */
function nextDataVersion(
  app: Version,
  stored: DataVersion | null,
  synced: boolean,
) {
  return synced
    ? dataVersionAfterSyncSwitch(app, stored)
    : dataVersionAfterWrite(app, stored)
}

/** Whether the record does not yet say what `app` writing the data means. */
export function dataVersionNeedsRecord(
  app: Version,
  stored: DataVersion | null,
  synced = false,
) {
  const next = nextDataVersion(app, stored, synced)
  return (
    !stored ||
    encodeVersion(stored.version) !== encodeVersion(next.version) ||
    encodeVersion(stored.minimumWriter) !== encodeVersion(next.minimumWriter)
  )
}

/**
 * Claims the data for `app` inside the caller's write transaction: the record
 * is read again there, so a newer app's record committed meanwhile is never
 * lowered (D3 review DI-2), and if that record now excludes `app` nothing is
 * written. Runs before any repair or migration, so from its commit an older
 * app refuses its writes (DI-3).
 */
export async function claimDataVersion(
  transaction: Pick<Transaction, "execute" | "getAll">,
  app: Version,
  synced = false,
): Promise<DataAccess> {
  const stored = await readDataVersion(transaction)
  if (dataAccess(app, stored) === "read-only") return "read-only"
  if (!dataVersionNeedsRecord(app, stored, synced)) return "write"
  await writeDataVersion(transaction, nextDataVersion(app, stored, synced))
  return "write"
}

/** The one writer of the record; its `meta` keys exist only in this module. */
export async function writeDataVersion(
  transaction: Pick<Transaction, "execute">,
  next: DataVersion,
) {
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
