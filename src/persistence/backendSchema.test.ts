import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { SqlSyncRules } from "@powersync/service-sync-rules"
import { describe, expect, it, vi } from "vitest"

import {
  APP_VERSION_HEADER,
  ERASED_COURSE_CODE,
  OUTDATED_WRITER_CODE,
} from "@/backup/uploadPolicy"
import { SYNCED_SINCE } from "@/domain/compatibility"
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

  it("publishes and syncs every course table as synced_<table>, scoped to the owner", () => {
    const quote = (name: string) => (/[A-Z]/.test(name) ? `"${name}"` : name)
    for (const table of COURSE_TABLES) {
      expect(migration).toContain(`public.${quote(table)}`)
      const scope =
        table === "courses" ? "WHERE id IN owned" : `WHERE "courseId" IN owned`
      // The plain names stay 0.4.0's local-only tables on every device.
      expect(syncConfig).toContain(
        `SELECT * FROM ${quote(table)} AS ${quote(`synced_${table}`)} ${scope}`,
      )
    }
    expect(syncConfig).toContain(
      `owned: SELECT id FROM courses WHERE "ownerId" = auth.user_id()`,
    )
  })
})

// B2 review SP-B2-2: a course table left out of the access rules, the
// publication or the cascade would pass the column checks above, and ship
// readable by every signed-in account, unreplicated or orphaned.
describe("backend access, publication and cascade", () => {
  const hardening = readFileSync(
    resolve(root, "supabase/migrations/20261025000000_hardening.sql"),
    "utf8",
  )
  const arrayIn = (sql: string) => {
    const match = /foreach child in array array\[([\s\S]*?)\]/.exec(sql)
    if (!match) throw new Error("No table array")
    return [...match[1]!.matchAll(/'(\w+)'/g)].map((item) => item[1])
  }
  const children = COURSE_TABLES.filter((table) => table !== "courses")

  it("puts row-level security, its policy and the grants on every child table", () => {
    expect(arrayIn(migration).sort()).toEqual([...children].sort())
    expect(migration).toContain(
      "alter table public.courses enable row level security",
    )
  })

  it("publishes every course table to PowerSync", () => {
    const match = /create publication powersync for table([\s\S]*?);/.exec(
      migration,
    )
    const published = [...match![1]!.matchAll(/public\."?(\w+)"?/g)].map(
      (item) => item[1],
    )
    expect(published.sort()).toEqual([...COURSE_TABLES].sort())
  })

  it("deletes every child table's rows with their course", () => {
    expect(arrayIn(hardening).sort()).toEqual([...children].sort())
    expect(hardening).toContain(
      "references public.courses(id) on delete cascade",
    )
    expect(hardening).toContain(
      "revoke all on all tables in schema public from anon",
    )
  })
})

// B4: the server's writer check covers every course table and asks for the
// same minimum as the device's switch (03 §3.1).
describe("the server's minimum writer", () => {
  const check = readFileSync(
    resolve(root, "supabase/migrations/20261026000000_upload_rules.sql"),
    "utf8",
  )

  it("puts both rules on every course table", () => {
    const lists = [
      ...check.matchAll(/foreach course_table in array array\[([\s\S]*?)\]/g),
    ].map((match) =>
      [...match[1]!.matchAll(/'(\w+)'/g)].map((item) => item[1]).sort(),
    )
    expect(lists).toEqual([
      [...COURSE_TABLES].sort(),
      [...COURSE_TABLES].sort(),
    ])
    expect(check).toContain("execute function public.refuse_outdated_writer()")
    expect(check).toContain("execute function public.keep_latest_edit()")
  })

  it("skips an update older than the row it would replace", () => {
    expect(check).toContain('new."updatedAt" < old."updatedAt"')
    expect(check).toContain("before update on public.%I")
  })

  it("starts at the version that switches devices to synced tables", () => {
    const { major, minor, patch } = SYNCED_SINCE
    expect(check).toContain(
      `insert into public.app_minimum_writer (version) values ('${major}.${minor}.${patch}')`,
    )
  })

  it("reads the header the app sends, with the code the app recognises", () => {
    expect(check).toContain(`headers ->> '${APP_VERSION_HEADER}'`)
    expect(check).toContain(`errcode = '${OUTDATED_WRITER_CODE}'`)
  })
})

// B6: an erased course stays erased on the server: a course id the owner
// erased refuses its course row, with the code the app recognises, and the
// record of it reaches no other account.
describe("the server's erased courses", () => {
  const erase = readFileSync(
    resolve(root, "supabase/migrations/20261028000000_course_erase.sql"),
    "utf8",
  )

  it("refuses the course row of an erased course id, with the app's code", () => {
    expect(erase).toContain("before insert or update on public.courses")
    expect(erase).toContain(`errcode = '${ERASED_COURSE_CODE}'`)
    expect(erase).toContain('e.id = new.id and e."ownerId" = new."ownerId"')
  })

  it("keeps the record to its owner, with no course data", () => {
    expect(erase).toContain(
      "alter table public.erased_courses enable row level security",
    )
    expect(erase).toContain('using ("ownerId" = auth.uid())')
    const columns = /create table public\.erased_courses \(([\s\S]*?)\n\);/
      .exec(erase)![1]!
      .split("\n")
      .map((line) => line.trim().split(" ")[0])
      .filter((name) => name && name !== "primary")
    expect(columns).toEqual(['"ownerId"', "id", '"erasedAt"'])
  })
})
