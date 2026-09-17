import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 120_000,
  workers: 1,
  expect: {
    timeout: 30_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4174",
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
        /(?:boats|crew-management-gate|duties|evaluation-gate|knowledge|persistence|reopen-persistence|smoke|student-management-gate|u03-knowledge|u03-speech-fixture|u04-scan-ui)\.spec\.ts/,
      use: { ...devices["iPhone 13"], locale: "it-IT" },
    },
  ],
  webServer: process.env.CVC_E2E_SERVER_READY
    ? undefined
    : {
        command:
          "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4174 --strictPort",
        url: "http://127.0.0.1:4174",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
