import { DatabaseSync } from "node:sqlite"

import { describe, expect, it } from "vitest"

import { encodeVersion, parseVersion } from "@/domain/compatibility"
import {
  claimDataVersion,
  dataVersionNeedsRecord,
  readDataVersion,
} from "@/persistence/dataVersion"

function metaDatabase() {
  const sqlite = new DatabaseSync(":memory:")
  sqlite.exec("CREATE TABLE meta (id TEXT PRIMARY KEY, value INTEGER)")
  // The M0 probe's own row and a migration ledger row share the table.
  sqlite.exec(
    "INSERT INTO meta VALUES ('schema', 1), ('migration:example', 1760000000000)",
  )
  const set = (id: string, value: number) =>
    sqlite.prepare("INSERT OR REPLACE INTO meta VALUES (?, ?)").run(id, value)
  return {
    sqlite,
    set,
    context: {
      getAll: async (sql: string, params: unknown[] = []) =>
        sqlite.prepare(sql).all(...(params as string[])),
      execute: async (sql: string, params: unknown[] = []) =>
        sqlite.prepare(sql).run(...(params as Array<string | number>)),
    },
  }
}

const v = parseVersion
const encoded = (text: string) => encodeVersion(v(text))

describe("the data's version in meta", () => {
  it("is nothing for data written before the contract", async () => {
    const { context } = metaDatabase()
    expect(await readDataVersion(context as never)).toBeNull()
  })

  it("is claimed by a writer, read back, and leaves the other meta rows", async () => {
    const { context, sqlite } = metaDatabase()

    expect(dataVersionNeedsRecord(v("0.4.0"), null)).toBe(true)
    await expect(claimDataVersion(context as never, v("0.4.0"))).resolves.toBe(
      "write",
    )
    const stored = await readDataVersion(context as never)

    expect(stored).toEqual({ version: v("0.4.0"), minimumWriter: v("0.3.0") })
    expect(dataVersionNeedsRecord(v("0.4.0"), stored)).toBe(false)
    expect(sqlite.prepare("SELECT id FROM meta").all()).toHaveLength(4)

    await claimDataVersion(context as never, v("0.5.1"))
    expect(await readDataVersion(context as never)).toEqual({
      version: v("0.5.1"),
      minimumWriter: v("0.4.0"),
    })
  })

  // D3 review DI-2: the claim reads the record in its own transaction, so a
  // newer app's record committed after an earlier read is never lowered.
  it("never lowers a newer app's record, and claims nothing for an excluded app", async () => {
    const { context, set } = metaDatabase()
    set("data:version", encoded("0.6.0"))
    set("data:minimumWriter", encoded("0.5.0"))

    await expect(claimDataVersion(context as never, v("0.5.0"))).resolves.toBe(
      "write",
    )
    expect(await readDataVersion(context as never)).toEqual({
      version: v("0.6.0"),
      minimumWriter: v("0.5.0"),
    })
    await expect(claimDataVersion(context as never, v("0.4.0"))).resolves.toBe(
      "read-only",
    )
    expect(await readDataVersion(context as never)).toEqual({
      version: v("0.6.0"),
      minimumWriter: v("0.5.0"),
    })
  })

  // D3 review DI-Q1: a damaged record keeps what can be read and never opens
  // the data to an app it excluded.
  it.each([
    ["only a minimum writer", null, encoded("9.8.0"), "9.8.0", "9.8.0"],
    ["only a newest writer", encoded("0.6.0"), null, "0.6.0", "0.5.0"],
    ["only a major release", encoded("1.0.0"), null, "1.0.0", "1.0.0"],
    ["an unreadable minimum", encoded("9.9.0"), -5, "9.9.0", "9.8.0"],
    ["an unreadable newest", 1.5, encoded("0.5.0"), "0.5.0", "0.5.0"],
    [
      "a minimum above the newest",
      encoded("0.5.0"),
      encoded("0.6.0"),
      "0.6.0",
      "0.6.0",
    ],
  ] as const)(
    "reads %s conservatively",
    async (_case, version, minimum, readVersion, readMinimum) => {
      const { context, set } = metaDatabase()
      if (version !== null) set("data:version", version)
      if (minimum !== null) set("data:minimumWriter", minimum)

      expect(await readDataVersion(context as never)).toEqual({
        version: v(readVersion),
        minimumWriter: v(readMinimum),
      })
    },
  )

  it("reads a record with neither part readable as no record", async () => {
    const { context, set } = metaDatabase()
    set("data:version", -1)
    set("data:minimumWriter", 2.5)
    expect(await readDataVersion(context as never)).toBeNull()
  })
})

// B1 review DP-B1-2: on a device switched to synced tables, a damaged record
// whose minimum is derived or unreadable is claimed back at the switch's
// floor, never at the previous minor version.
describe("the claim on a device switched to synced tables", () => {
  it.each([
    ["only a newest writer 0.5.0", encoded("0.5.0"), null],
    ["only a newest writer 0.5.4", encoded("0.5.4"), null],
    ["an unreadable minimum", encoded("0.5.0"), -5],
  ] as const)("keeps the floor with %s", async (_label, version, minimum) => {
    const { context, set } = metaDatabase()
    set("data:version", version)
    if (minimum !== null) set("data:minimumWriter", minimum)

    await expect(
      claimDataVersion(context as never, v("0.5.0"), true),
    ).resolves.toBe("write")
    const stored = await readDataVersion(context as never)
    expect(stored?.minimumWriter).toEqual(v("0.5.0"))
  })

  it("still records the previous minor in local mode", async () => {
    const { context, set } = metaDatabase()
    set("data:version", encoded("0.5.0"))
    await claimDataVersion(context as never, v("0.5.0"))
    expect((await readDataVersion(context as never))?.minimumWriter).toEqual(
      v("0.4.0"),
    )
  })
})
