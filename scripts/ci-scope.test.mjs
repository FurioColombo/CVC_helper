import { describe, expect, it } from "vitest"

import { latestRunPassed, needsBrowser } from "./ci-scope.mjs"

const docsOnly = [
  "04_IMPLEMENTATION_PLAN.md",
  "docs/working/BACKLOG.md",
  ".evidence/D1/verification.json",
  "archive/v0.3.0/0_3_0_QUESTIONS.md",
  ".milestones/manifest.json",
  ".claude/agents/reviewer-scope.md",
  ".mcp.json",
]

describe("needsBrowser", () => {
  it("skips the browser suite for documentation-only changes on a passed tip", () => {
    expect(needsBrowser(docsOnly, true)).toBe(false)
  })

  it("runs it after a previous tip that did not pass", () => {
    // A docs-only push after a red or cancelled code push must not go green
    // and let Pages publish code that never passed the browser suite.
    expect(needsBrowser(docsOnly, false)).toBe(true)
  })

  it("runs it when anything else changed", () => {
    for (const file of [
      "src/App.tsx",
      "tests/e2e/smoke.spec.ts",
      "playwright.config.ts",
      "package.json",
      "package-lock.json",
      "scripts/run-e2e.mjs",
      "public/icons/cvc-helper-192.png",
      ".github/workflows/ci.yml",
    ]) {
      expect(needsBrowser(["README.md", file], true)).toBe(true)
    }
  })

  it("runs it when the changed files are unknown", () => {
    expect(needsBrowser([], true)).toBe(true)
  })
})

describe("latestRunPassed", () => {
  const run = (conclusion, updatedAt, extra = {}) => ({
    event: "push",
    status: "completed",
    conclusion,
    updated_at: updatedAt,
    ...extra,
  })

  it("follows the newest completed push run", () => {
    expect(
      latestRunPassed([
        run("failure", "2026-10-09T10:00:00Z"),
        run("success", "2026-10-09T11:00:00Z"),
      ]),
    ).toBe(true)
    expect(
      latestRunPassed([
        run("success", "2026-10-09T10:00:00Z"),
        run("cancelled", "2026-10-09T11:00:00Z"),
      ]),
    ).toBe(false)
  })

  it("ignores manual runs and runs still in progress", () => {
    expect(
      latestRunPassed([
        run("success", "2026-10-09T10:00:00Z", { event: "workflow_dispatch" }),
        { event: "push", status: "in_progress", conclusion: null },
      ]),
    ).toBe(false)
    expect(latestRunPassed([])).toBe(false)
  })
})
