import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.CVC_E2E_BASE_URL ?? "http://127.0.0.1:4174"
const { hostname, port } = new URL(baseURL)

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/d3-startup-diagnostic.spec.ts",
  outputDir: "test-results/startup-probe/artifacts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/startup-probe/report.json" }],
  ],
  timeout: 120_000,
  workers: 1,
  expect: { timeout: 30_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "pixel-7-chrome-startup-probe",
      use: { ...devices["Pixel 7"], locale: "it-IT" },
    },
    {
      name: "iphone-13-webkit-startup-probe",
      use: { ...devices["iPhone 13"], locale: "it-IT" },
    },
  ],
  webServer: {
    command: `node node_modules/vite/bin/vite.js --config vite.startup-probe.config.ts --host ${hostname} --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { CVC_ENGINE_STARTUP_PROBE: "true" },
  },
})
