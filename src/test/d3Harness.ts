import { PowerSyncDatabase } from "@powersync/web"

import { encodeVersion, parseVersion } from "@/domain/compatibility"
import { v030Schema } from "@/test/v030Schema"

/**
 * D3: marks a seeded database as written by a much newer app (9.9.0, whose
 * minimum writer is 9.8.0), so this version must open it read-only. Uses the
 * 0.3.0 schema, which declares `meta` too, and reads back before closing.
 */
export async function markNewerData(filename: string) {
  const database = new PowerSyncDatabase({
    schema: v030Schema,
    database: { dbFilename: filename },
  })
  await database.init()
  for (const [id, version] of [
    ["data:version", "9.9.0"],
    ["data:minimumWriter", "9.8.0"],
  ] as const) {
    await database.execute(
      "INSERT OR REPLACE INTO meta(id, value) VALUES (?, ?)",
      [id, encodeVersion(parseVersion(version))],
    )
  }
  await database.get("SELECT count(*) AS count FROM meta")
  await database.close()
}

/**
 * The same mark, written by another app instance on the app's own database
 * while the app is open: a newer version on the device raising the minimum
 * writer under it.
 */
export async function raiseMinimumWriterUnderOpenApp() {
  const { createDatabase } = await import("@/persistence/schema")
  const other = createDatabase("cvc-helper.db")
  await other.init()
  for (const [id, version] of [
    ["data:version", "9.9.0"],
    ["data:minimumWriter", "9.8.0"],
  ] as const) {
    await other.execute(
      "INSERT OR REPLACE INTO meta(id, value) VALUES (?, ?)",
      [id, encodeVersion(parseVersion(version))],
    )
  }
  await other.get("SELECT count(*) AS count FROM meta")
  await other.close()
}
