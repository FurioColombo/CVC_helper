import { existsSync } from "node:fs"
import { resolve } from "node:path"

import { defineConfig, devices } from "@playwright/test"

// scripts/run-e2e.mjs picks a free port and passes it here so the browser
// suite always tests its own freshly started server, never one left running
// by another worktree or a stale build on a fixed port. Running Playwright
// directly (no runner) falls back to the historical default, 4174.
const baseURL = process.env.CVC_E2E_BASE_URL ?? "http://127.0.0.1:4174"
const { hostname, port } = new URL(baseURL)

// Spec names, matched exactly (`specs()` below), so a mistyped or renamed
// spec fails the run instead of silently leaving a project.
//
// The iPhone size in Chromium is for the specs that assert layout (overflow,
// fit, positions). Behaviour-only journeys ran there a second time at a width
// 22 px from Pixel 7's; they now run on Pixel 7 only, and the core ones on
// iPhone WebKit too (H1, .evidence/H1/test-timing.json). A new spec that
// measures layout belongs in this list.
const layoutSpecs = [
  "c1-crew-management",
  "e1-evaluation-history-layout",
  "f3-crew-summary",
  "f3-duty-summary",
  "student-scan",
  "u01-shell",
  "u02-students",
  "u03-knowledge",
  "u04-scan-ui",
  "u05-boats-ui",
  "u06-fault-ui",
  "u07-volunteers",
  "u08-duties",
  "u09-crews",
  "u10-evaluations",
  "ug1-boat-mark-fit",
  "ug1-compact-rows",
  "ug1-duty-reflow",
  "ug2-field-ux-fixes",
  "ug2-hostile-roster",
  "ux2-crew-interactions",
  "v02-dictation-layout",
]
// Core journeys on the WebKit engine. u08-duties joined through an unanchored
// "duties" pattern before H1 and stays, so H1 removes no WebKit coverage.
const webkitCoreSpecs = [
  "boats",
  "crew-management-gate",
  "duties",
  "evaluation-gate",
  "f1-navigation-guards",
  "f3-crew-summary",
  "knowledge",
  "persistence",
  "reopen-persistence",
  "s4-ruled-roster-scan",
  "smoke",
  "student-management-gate",
  "u03-knowledge",
  "u03-speech-fixture",
  "u04-scan-ui",
  "u08-duties",
  "ug2-hostile-roster",
  "v05-assistant-paste",
]

function specs(names: string[]) {
  const missing = names.filter(
    (name) =>
      !existsSync(resolve(import.meta.dirname, "tests/e2e", `${name}.spec.ts`)),
  )
  if (missing.length > 0) {
    throw new Error(
      `playwright.config.ts names missing specs: ${missing.join(", ")}`,
    )
  }
  return names.map((name) => `**/${name}.spec.ts`)
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // A focused test left in a spec would narrow every run, local evidence
  // included, to that test and still exit 0.
  forbidOnly: true,
  // One local retry so a timing flake no longer costs a whole rerun; it is not
  // hidden: scripts/run-e2e.mjs lists every test that needed a retry, and a
  // milestone cannot complete until each is filed as a defect (H1).
  retries: process.env.CI ? 2 : 1,
  reporter: [
    [process.env.CI ? "github" : "list"],
    ["json", { outputFile: "test-results/e2e-report.json" }],
  ],
  timeout: 120_000,
  // One worker. H1 tried two on the 8-thread, 8 GB development machine: three
  // runs of 39-41 minutes, slower than one worker, with five new flaky tests
  // (.evidence/H1/test-timing.json).
  workers: 1,
  expect: {
    timeout: 30_000,
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "pixel-7-chrome",
      use: { ...devices["Pixel 7"], locale: "it-IT" },
    },
    {
      name: "iphone-13-viewport",
      testMatch: specs(layoutSpecs),
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        locale: "it-IT",
      },
    },
    {
      name: "iphone-13-webkit-core",
      testMatch: specs(webkitCoreSpecs),
      use: { ...devices["iPhone 13"], locale: "it-IT" },
    },
  ],
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host ${hostname} --port ${port} --strictPort`,
    url: baseURL,
    // A reused server could belong to another worktree or serve a stale
    // build (RR-3); always start a fresh one on this exact URL instead of
    // trusting whatever already answers there.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
