import { defineConfig } from "@playwright/test"

import baseConfig from "./playwright.config"

const mode = process.env.CVC_FONT_DIAGNOSTIC ?? "source"
if (!new Set(["source", "dom-auto", "connected-canvas"]).has(mode)) {
  throw new Error(`Unsupported CVC_FONT_DIAGNOSTIC mode: ${mode}`)
}

const outputRoot = `test-results/raster-diagnostic/${mode}`

export default defineConfig({
  ...baseConfig,
  retries: 0,
  outputDir: `${outputRoot}/artifacts`,
  reporter: [
    [process.env.CI ? "github" : "list"],
    ["json", { outputFile: `${outputRoot}/report.json` }],
  ],
  projects: baseConfig.projects?.map((project) =>
    project.name === "iphone-13-webkit-core"
      ? { ...project, testMatch: ["**/d3-raster-diagnostic.spec.ts"] }
      : project,
  ),
})
