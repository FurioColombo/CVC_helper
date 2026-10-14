import { defineConfig, devices } from "@playwright/test"
import baseConfig from "./playwright.config"
export default defineConfig({
  ...baseConfig,
  retries: 0,
  outputDir: "test-results/copy-status/artifacts",
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/copy-status/report.json" }],
  ],
  projects: [
    {
      name: "copy-status-webkit-diagnostic",
      testMatch: "**/d3-copy-status-diagnostic.spec.ts",
      use: { ...devices["iPhone 13"], locale: "it-IT" },
    },
    {
      name: "copy-status-chrome-diagnostic",
      testMatch: "**/d3-copy-status-diagnostic.spec.ts",
      use: { ...devices["Pixel 7"], locale: "it-IT" },
    },
  ],
})
