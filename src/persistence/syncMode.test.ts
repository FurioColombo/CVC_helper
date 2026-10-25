import { describe, expect, it } from "vitest"

import { AppSchema, COURSE_TABLES } from "@/persistence/schema"
import {
  inactiveLocalView,
  SyncedSchema,
  syncedTableName,
} from "@/persistence/syncMode"

type Json = {
  tables: Array<{
    name: string
    view_name: string
    local_only?: boolean
    columns: Array<{ name: string; type: string }>
  }>
}

const app = (AppSchema as unknown as { toJSON: () => Json }).toJSON().tables
const synced = (SyncedSchema as unknown as { toJSON: () => Json }).toJSON()
  .tables

// B1 review DI-B1-Q5: the synced schema is derived from the app's, and stays
// so: every course table twice, synced behind the app's view name and local
// behind inactive_local_<table>, with the very same columns and types.
describe("the synced schema", () => {
  it.each(COURSE_TABLES)("mirrors %s twice with identical columns", (table) => {
    const own = app.find((candidate) => candidate.name === table)!
    const local = synced.find((candidate) => candidate.name === table)!
    const remote = synced.find(
      (candidate) => candidate.name === syncedTableName(table),
    )!
    expect(local).toMatchObject({
      local_only: true,
      view_name: inactiveLocalView(table),
      columns: own.columns,
    })
    expect(remote.local_only).toBeFalsy()
    expect(remote).toMatchObject({ view_name: table, columns: own.columns })
  })

  it("keeps every other table as the app declares it", () => {
    const others = app.filter(
      ({ name }) => !(COURSE_TABLES as readonly string[]).includes(name),
    )
    expect(others.map(({ name }) => name)).toEqual(["meta"])
    for (const table of others)
      expect(synced.find(({ name }) => name === table.name)).toEqual(table)
    expect(synced).toHaveLength(COURSE_TABLES.length * 2 + others.length)
  })
})
