// @vitest-environment node
import { describe, expect, it } from "vitest"

import { courseFingerprint } from "@/persistence/courseFingerprint"

const rows = [
  { table: "students", id: "x1", updatedAt: "2026-11-04T10:00:00.000Z" },
  { table: "courses", id: "X", updatedAt: "2026-11-04T09:00:00.000Z" },
  { table: "crewMembers", id: "m1", updatedAt: null },
]

describe("courseFingerprint", () => {
  // The same value is asserted against Postgres in
  // .evidence/B7/keep-rule-local-postgres.mjs: a change here must change there.
  it("is the value keep_course computes for these rows", async () => {
    expect(await courseFingerprint(rows)).toBe(
      "1ed019069dbd4feea647dfc3a9c190ee9e47e36bd46372ec7956141872036244",
    )
  })

  // An astral character sorts after U+FFFD in UTF-8 bytes, before it in UTF-16.
  it("sorts as the server does, past the basic plane", async () => {
    expect(
      await courseFingerprint([
        { table: "students", id: "a\u{1F600}", updatedAt: null },
        { table: "students", id: "a\u{FFFD}", updatedAt: null },
      ]),
    ).toBe("5e82f6d4138177712852c8ecd237c3bd56aeac21cfa669727880cf1e61403be0")
  })

  it("does not depend on the order rows are read in", async () => {
    expect(await courseFingerprint([...rows].reverse())).toBe(
      await courseFingerprint(rows),
    )
  })

  it.each([
    ["a row more", [...rows, { table: "boats", id: "b", updatedAt: null }]],
    ["a row less", rows.slice(1)],
    [
      "an edit with an older stamp",
      rows.map((row) =>
        row.id === "x1"
          ? { ...row, updatedAt: "2026-11-04T09:30:00.000Z" }
          : row,
      ),
    ],
    [
      "the same id in another table",
      rows.map((row) => (row.id === "x1" ? { ...row, table: "boats" } : row)),
    ],
  ])("changes with %s", async (_name, changed) => {
    expect(await courseFingerprint(changed)).not.toBe(
      await courseFingerprint(rows),
    )
  })
})
