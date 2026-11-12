import { describe, expect, it } from "vitest"

import { withStatusRow } from "./milestone.mjs"

const plan = [
  "# Plan",
  "",
  "## Where this cycle stands",
  "",
  "| Work | State and evidence |",
  "| --- | --- |",
  "| B6 | Complete. Erased courses stay erased. See `.evidence/B6/`. |",
  "| WX1 | In progress since 2026-11-12. Reviews and the Android check remain. |",
  "",
  "Handoff: a paragraph.",
  "",
  "## WX1 — Vento",
  "**Status:** IN_PROGRESS",
  "",
].join("\n")

describe("withStatusRow", () => {
  it("replaces the state sentence and keeps the work's own account", () => {
    const next = withStatusRow(
      plan,
      "WX1",
      "Awaiting the owner. Verified at `a08fa95` (full CI green).",
    )
    expect(next).toContain(
      "| WX1 | Awaiting the owner. Verified at `a08fa95` (full CI green). Reviews and the Android check remain. |",
    )
    expect(next).not.toContain("In progress since 2026-11-12")
    expect(
      withStatusRow(next, "WX1", "In progress since 2026-11-13."),
    ).toContain(
      "| WX1 | In progress since 2026-11-13. Reviews and the Android check remain. |",
    )
  })

  it("adds a row at the end of the table for a milestone without one", () => {
    const next = withStatusRow(plan, "UG4", "In progress since 2026-11-13.")
    expect(next).toContain(
      "| WX1 | In progress since 2026-11-12. Reviews and the Android check remain. |\n| UG4 | In progress since 2026-11-13. |\n\nHandoff",
    )
  })

  it("leaves a completed row's account and a plan without the table alone", () => {
    expect(withStatusRow(plan, "B6", "Pending.")).toContain(
      "| B6 | Pending. Complete. Erased courses stay erased.",
    )
    const bare = "## M1 — Synthetic\n**Status:** IN_PROGRESS\n"
    expect(withStatusRow(bare, "M1", "Pending.")).toBe(bare)
  })
})
