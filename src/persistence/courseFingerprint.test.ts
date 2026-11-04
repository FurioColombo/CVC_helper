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
