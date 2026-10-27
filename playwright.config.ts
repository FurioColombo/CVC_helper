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
// T1 (owner, 2026-10-21): unnecessary cases are removed, necessary kept.
// Chromium at 390×844 adds nothing where a spec sets its own narrow widths;
// it keeps only the cases measured at the iPhone size itself. Removals and
// the kept case covering each: .evidence/T1/removed-cases.json.
const iphoneViewportCases =
  /pages outgoing boats|export feedback stays above the bottom bar \(device\)/
// Core journeys on the WebKit engine. u08-duties joined through an unanchored
// "duties" pattern before H1 and stays, so H1 removes no WebKit coverage.
const webkitCoreSpecs = [
  "d4-course-files",
  "d4-evaluation-note-save",
  "d4-local-reset",
  "boats",
  "crew-management-gate",
  // Data migrations and the switch to synced tables run on every iPhone, on
  // WebKit's own storage backend.
  "b1-sync-mode",
  // Sign-in, the switch it starts and its reload, on the iPhone engine (B3).
  "b3-backup-ui",
  // The erase forgets the synced copy on WebKit's own storage backend (B6).
  "b6-erase",
  "d1-migration",
  "d2-duty-items",
  "d3-read-only",
  "d3-engine-startup",
  "d3-startup-recovery",
  "d3-summary-controls",
  "duties",
  "evaluation-gate",
  "f1-navigation-guards",
  "f3-crew-summary",
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
      testIgnore: specs(["d3-startup-multitab"]),
      // Boats and faults stay on WebKit; u05/u06 cover them here.
      grepInvert: /manages boats and simultaneous faults/,
      use: { ...devices["Pixel 7"], locale: "it-IT" },
    },
    {
      name: "desktop-chrome-storage",
      testMatch: specs([
        "d3-startup-multitab",
        "d4-course-files",
        "d4-local-reset",
      ]),
      // Neither involves a second tab or the SharedWorker path.
      grepInvert:
        /remain usable at narrow widths|refuses corrupt, invalid and too-new/,
      use: { ...devices["Desktop Chrome"], locale: "it-IT" },
    },
    {
      name: "iphone-13-viewport",
      testMatch: specs(["ux2-crew-interactions", "d4-course-files"]),
      grep: iphoneViewportCases,
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        locale: "it-IT",
      },
    },
    {
      name: "iphone-13-webkit-core",
      testMatch: specs(webkitCoreSpecs),
      // ug2-hostile-roster's crew summary proves the same image on WebKit.
      grepInvert: /copies double names, a crew with no boat/,
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
