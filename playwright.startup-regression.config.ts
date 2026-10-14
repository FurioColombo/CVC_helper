import { defineConfig } from "@playwright/test"
import baseConfig from "./playwright.config"
const baseURL = process.env.CVC_E2E_BASE_URL ?? "http://127.0.0.1:4174"
const { hostname, port } = new URL(baseURL)
export default defineConfig({
  ...baseConfig,
  retries: 0,
  outputDir: "test-results/startup-regression/artifacts",
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/startup-regression/report.json" }],
  ],
  webServer: {
    command: `node node_modules/vite/bin/vite.js --config vite.startup-probe.config.ts --host ${hostname} --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { CVC_ENGINE_STARTUP_PROBE: "true" },
  },
})
