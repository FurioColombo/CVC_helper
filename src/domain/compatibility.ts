/**
 * The compatibility contract between app versions and the data they share
 * (03_TECHNICAL_DECISIONS.md §3.1; the server enforces the same rules from
 * 0.5.0). The data records the newest version that wrote it and the oldest
 * version allowed to write it; an app reads and writes data of its own and
 * the previous minor version, and an app older than the data's minimum writer
 * opens read-only. Data written before the contract (0.1.0 to 0.3.0) records
 * nothing and is open to every app.
 */

export interface Version {
  major: number
  minor: number
  patch: number
}

/** What the data records about the apps that wrote it. */
export interface DataVersion {
  /** The newest app version that wrote it. */
  version: Version
  /** The oldest app version allowed to write it. */
  minimumWriter: Version
}

export type DataAccess = "write" | "read-only"

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/

export function parseVersion(text: string): Version {
  const match = VERSION.exec(text)
  if (!match) throw new Error(`Not a version: ${text}`)
  const [major, minor, patch] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ]
  return { major, minor, patch }
}

export const formatVersion = ({ major, minor, patch }: Version) =>
  `${major}.${minor}.${patch}`

export function compareVersions(a: Version, b: Version) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch
}

export const newer = (a: Version, b: Version) =>
  compareVersions(a, b) >= 0 ? a : b

// The `meta` table stores integers (src/persistence/schema.ts).
const PART = 1000

export function encodeVersion({ major, minor, patch }: Version) {
  for (const part of [major, minor, patch]) {
    if (!Number.isInteger(part) || part < 0 || part >= PART) {
      throw new Error("Version part out of range")
    }
  }
  return (major * PART + minor) * PART + patch
}

export function decodeVersion(value: number): Version {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Not an encoded version")
  }
  return {
    major: Math.floor(value / PART / PART),
    minor: Math.floor(value / PART) % PART,
    patch: value % PART,
  }
}

/**
 * The oldest app version allowed to write what `app` writes: the previous
 * minor version. A major release has no previous minor of its own line, so it
 * must name its minimum writer when it is made.
 */
export function minimumWriterOf(app: Version): Version {
  if (app.minor === 0) {
    throw new Error(
      `${formatVersion(app)} is a major release: declare its minimum writer`,
    )
  }
  return { major: app.major, minor: app.minor - 1, patch: 0 }
}

/** Whether `app` may write the data, or only read it. */
export function dataAccess(
  app: Version,
  stored: DataVersion | null,
): DataAccess {
  if (!stored) return "write"
  return compareVersions(app, stored.minimumWriter) < 0 ? "read-only" : "write"
}

/**
 * What the data records once `app` has opened it to write: neither the newest
 * writer nor the minimum writer ever goes back, so a newer app's data never
 * becomes writable again by an app it excluded.
 */
export function dataVersionAfterWrite(
  app: Version,
  stored: DataVersion | null,
): DataVersion {
  const minimumWriter = minimumWriterOf(app)
  return stored
    ? {
        version: newer(stored.version, app),
        minimumWriter: newer(stored.minimumWriter, minimumWriter),
      }
    : { version: app, minimumWriter }
}

/**
 * B1: the first version that reads synced course tables. An app older than
 * this, given a switched database, sees only its emptied local copy, so the
 * switch makes such apps read-only whatever the switching app's own version.
 */
export const SYNCED_SINCE: Version = { major: 0, minor: 5, patch: 0 }

/**
 * What the data records once `app` has switched it to synced tables: as after
 * a write, with the minimum writer raised to at least {@link SYNCED_SINCE}. An
 * app older than that cannot switch, since the switch would lock it out.
 */
export function dataVersionAfterSyncSwitch(
  app: Version,
  stored: DataVersion | null,
): DataVersion {
  if (compareVersions(app, SYNCED_SINCE) < 0) {
    throw new Error(
      `${formatVersion(app)} predates synced tables (${formatVersion(SYNCED_SINCE)})`,
    )
  }
  const after = dataVersionAfterWrite(app, stored)
  return {
    version: after.version,
    minimumWriter: newer(after.minimumWriter, SYNCED_SINCE),
  }
}
