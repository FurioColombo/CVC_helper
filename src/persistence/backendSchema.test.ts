import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { SqlSyncRules } from "@powersync/service-sync-rules"
import { describe, expect, it, vi } from "vitest"

import { AppSchema, COURSE_TABLES } from "@/persistence/schema"

vi.mock("@/persistence/db", () => ({ db: {} }))

// The server copy (supabase/migrations) and the sync config (powersync/) use
// the app's own table and column names, so neither direction maps names. This
// keeps the three in step: a column added to the app without the server would
// be dropped on upload, and one only the server has would never reach a phone.
const root = resolve(import.meta.dirname, "../..")
const migration = readFileSync(
  resolve(root, "supabase/migrations/20261023000000_course_backup.sql"),
  "utf8",
)
const syncConfig = readFileSync(
  resolve(root, "powersync/sync-config.yaml"),
  "utf8",
)
const SERVER_ONLY_COLUMNS: Record<string, string[]> = { courses: ["ownerId"] }
const SQL_TYPE = { text: "text", integer: "integer" } as const

const appTables = (
  AppSchema as unknown as {
    toJSON: () => {
      tables: Array<{
        name: string
        columns: Array<{ name: string; type: string }>
      }>
    }
  }
).toJSON().tables

function serverColumns(table: string) {
  const match = new RegExp(
    `create table public\\."?${table}"? \\(([\\s\\S]*?)\\n\\);`,
  ).exec(migration)
  if (!match) throw new Error(`No server table ${table}`)
  return match[1]!
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter(Boolean)
    .map((line) => {
      const [name, type] = line.split(/\s+/)
      return { name: name!.replaceAll('"', ""), type: type! }
    })
}

describe("backend schema", () => {
  it.each(COURSE_TABLES)(
    "mirrors every column of %s with its type",
    (table) => {
      const app = appTables.find((candidate) => candidate.name === table)!
      const expected = [
        { name: "id", type: "text" },
        ...(SERVER_ONLY_COLUMNS[table] ?? []).map((name) => ({
          name,
          type: "uuid",
        })),
        ...app.columns.map(({ name, type }) => ({
          name,
          type: SQL_TYPE[type.toLowerCase() as keyof typeof SQL_TYPE],
        })),
      ]
      expect(
        [...serverColumns(table)].sort((a, b) => a.name.localeCompare(b.name)),
      ).toEqual(expected.sort((a, b) => a.name.localeCompare(b.name)))
    },
  )

  it("keeps device-only tables off the server", () => {
    const serverTables = [
      ...migration.matchAll(/create table public\."?(\w+)"?/g),
    ].map((match) => match[1])
    expect(serverTables).toEqual([...COURSE_TABLES])
  })

  it("is a sync config the PowerSync service accepts", () => {
    // The service's own parser (pinned in package.json), so quoting and the
    // shared `owned` query fail here rather than at deployment.
    const problems = SqlSyncRules.validate(syncConfig, {
      defaultSchema: "public",
    })
    expect(problems.map((problem) => problem.message)).toEqual([])
  })

  it("publishes and syncs every course table, scoped to the owner", () => {
    for (const table of COURSE_TABLES) {
      const quoted = /[A-Z]/.test(table) ? `"${table}"` : table
      expect(migration).toContain(`public.${quoted}`)
      const scope =
        table === "courses" ? "WHERE id IN owned" : `WHERE "courseId" IN owned`
      expect(syncConfig).toContain(`SELECT * FROM ${quoted} ${scope}`)
    }
    expect(syncConfig).toContain(
      `owned: SELECT id FROM courses WHERE "ownerId" = auth.user_id()`,
    )
  })
})
