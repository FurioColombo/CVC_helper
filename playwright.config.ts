import { defineConfig, devices } from "@playwright/test"

// scripts/run-e2e.mjs picks a free port and passes it here so the browser
// suite always tests its own freshly started server, never one left running
// by another worktree or a stale build on a fixed port. Running Playwright
// directly (no runner) falls back to the historical default, 4174.
const baseURL = process.env.CVC_E2E_BASE_URL ?? "http://127.0.0.1:4174"
const { hostname, port } = new URL(baseURL)

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // A focused test left in a spec would narrow every run, local evidence
  // included, to that test and still exit 0.
  forbidOnly: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 120_000,
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
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        locale: "it-IT",
      },
    },
    {
      name: "iphone-13-webkit-core",
      testMatch:
        /(?:boats|crew-management-gate|duties|evaluation-gate|knowledge|persistence|reopen-persistence|smoke|student-management-gate|u03-knowledge|u03-speech-fixture|u04-scan-ui|s4-ruled-roster-scan|f1-navigation-guards|v05-assistant-paste|f3-crew-summary)\.spec\.ts/,
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
