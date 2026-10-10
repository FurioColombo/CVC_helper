import { DatabaseSync } from "node:sqlite"

import { describe, expect, it } from "vitest"

import { encodeVersion, parseVersion } from "@/domain/compatibility"
import {
  dataVersionNeedsRecord,
  readDataVersion,
  recordDataVersion,
} from "@/persistence/dataVersion"

function metaDatabase() {
  const sqlite = new DatabaseSync(":memory:")
  sqlite.exec("CREATE TABLE meta (id TEXT PRIMARY KEY, value INTEGER)")
  // The M0 probe's own row and a migration ledger row share the table.
  sqlite.exec(
    "INSERT INTO meta VALUES ('schema', 1), ('migration:example', 1760000000000)",
  )
  return {
    sqlite,
    context: {
      getAll: async (sql: string, params: unknown[] = []) =>
        sqlite.prepare(sql).all(...(params as string[])),
      execute: async (sql: string, params: unknown[] = []) =>
        sqlite.prepare(sql).run(...(params as Array<string | number>)),
    },
  }
}

describe("the data's version in meta", () => {
  it("is nothing for data written before the contract", async () => {
    const { context } = metaDatabase()
    expect(await readDataVersion(context as never)).toBeNull()
  })

  it("records a writer, reads it back, and keeps the other meta rows", async () => {
    const { context, sqlite } = metaDatabase()
    const app = parseVersion("0.4.0")

    expect(dataVersionNeedsRecord(app, null)).toBe(true)
    await recordDataVersion(context as never, app, null)
    const stored = await readDataVersion(context as never)

    expect(stored).toEqual({
      version: parseVersion("0.4.0"),
      minimumWriter: parseVersion("0.3.0"),
    })
    expect(dataVersionNeedsRecord(app, stored)).toBe(false)
    expect(
      sqlite.prepare("SELECT id FROM meta ORDER BY id").all(),
    ).toHaveLength(4)

    await recordDataVersion(context as never, parseVersion("0.5.1"), stored)
    expect(await readDataVersion(context as never)).toEqual({
      version: parseVersion("0.5.1"),
      minimumWriter: parseVersion("0.4.0"),
    })
  })

  it("treats a half or unreadable record as no record, to be rewritten", async () => {
    const { context, sqlite } = metaDatabase()
    sqlite
      .prepare("INSERT INTO meta VALUES ('data:version', ?)")
      .run(encodeVersion(parseVersion("0.6.0")))
    expect(await readDataVersion(context as never)).toBeNull()

    sqlite.exec("INSERT INTO meta VALUES ('data:minimumWriter', -5)")
    expect(await readDataVersion(context as never)).toBeNull()
  })
})
