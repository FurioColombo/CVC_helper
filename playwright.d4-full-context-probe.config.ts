import { defineConfig } from "@playwright/test"
import { resolve } from "node:path"

import baseConfig from "./playwright.config"

const reporters = Array.isArray(baseConfig.reporter)
  ? baseConfig.reporter
  : baseConfig.reporter
    ? [baseConfig.reporter]
    : []

export default defineConfig({
  ...baseConfig,
  reporter: [
    ...reporters,
    [resolve(import.meta.dirname, "scripts/d4-full-context-case-reporter.mjs")],
  ],
})
