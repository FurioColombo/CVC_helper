import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const requiredFiles = [
  "AGENTS.md",
  ".node-version",
  ".github/workflows/ci.yml",
  ".milestones/manifest.json",
  "playwright.config.ts",
  "vite.config.ts",
  "vitest.config.ts",
  "src/domain/config.ts",
  "src/domain/invariants.ts",
  "src/domain/scenarios.ts",
  "scripts/check-full-week.ts",
  "scripts/run-e2e.mjs",
  "src/persistence/db.ts",
  "public/icons/cvc-helper-180.png",
  "public/icons/cvc-helper-192.png",
  "public/icons/cvc-helper-512.png",
]

for (const file of requiredFiles) {
  assert.ok(
    existsSync(resolve(root, file)),
    `Missing required repository file: ${file}`,
  )
}

const packageJson = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
)
assert.equal(
  packageJson.engines?.node,
  ">=24 <25",
  "package.json must declare the supported Node 24 runtime",
)
assert.equal(
  readFileSync(resolve(root, ".node-version"), "utf8").trim(),
  "24",
  ".node-version must match the supported Node major",
)
for (const script of [
  "verify:quick",
  "verify:domain",
  "verify:e2e",
  "verify",
  "verify:all",
  "check:full-week",
  "milestone:start",
  "milestone:check",
  "milestone:complete",
]) {
  assert.ok(packageJson.scripts[script], `Missing package script: ${script}`)
}

assert.ok(
  packageJson.dependencies?.["@powersync/web"],
  "PowerSync must remain after the successful local-only browser spike",
)

for (const forbidden of [
  "dexie",
  "@supabase/supabase-js",
  "redux",
  "zustand",
]) {
  assert.ok(
    !packageJson.dependencies?.[forbidden] &&
      !packageJson.devDependencies?.[forbidden],
    `Out-of-scope or rejected dependency retained: ${forbidden}`,
  )
}

console.log("PASS: repository structure and command surface")
