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
  "scripts/check-v0_1-compatibility.ts",
  "scripts/run-e2e.mjs",
  "src/persistence/db.ts",
  "src/test/fixtures/v0.1.0-course.json",
  "docs/post-mvp/06_DESIGN_RULEBOOK.md",
  "docs/post-mvp/07_PAGE_CHANGELOG.md",
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
const packageLock = JSON.parse(
  readFileSync(resolve(root, "package-lock.json"), "utf8"),
)
assert.equal(
  packageJson.version,
  "0.1.0",
  "package.json must identify the completed baseline as 0.1.0 until UG1",
)
assert.equal(
  packageLock.version,
  packageJson.version,
  "package-lock.json version must match package.json",
)
assert.equal(
  packageLock.packages?.[""]?.version,
  packageJson.version,
  "package-lock root package version must match package.json",
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
  "check:compatibility",
  "milestone:start",
  "milestone:check",
  "milestone:complete",
  "evidence",
]) {
  assert.ok(packageJson.scripts[script], `Missing package script: ${script}`)
}

const manifest = JSON.parse(
  readFileSync(resolve(root, ".milestones/manifest.json"), "utf8"),
)
const plan = readFileSync(resolve(root, "04_IMPLEMENTATION_PLAN.md"), "utf8")
const completedBaselineIds = [
  "M0",
  "M1",
  "M2",
  "M3",
  "M4",
  "G1",
  "M5",
  "M6",
  "G2",
  "M7",
  "G3",
  "M8",
  "M9",
  "M10",
  "M11",
  "G4",
  "M12",
  "M13",
  "G5",
  "M14",
  "M15",
]
for (const id of completedBaselineIds) {
  assert.equal(
    manifest.milestones.find((milestone) => milestone.id === id)?.status,
    "COMPLETE",
    `Completed 0.1.0 milestone changed state: ${id}`,
  )
}
for (const id of [
  "U00",
  "U01",
  "U02",
  "U03",
  "U04",
  "U05",
  "U06",
  "U07",
  "U08",
  "U09",
  "U10",
  "UG1",
]) {
  const milestone = manifest.milestones.find((item) => item.id === id)
  assert.ok(milestone, `Missing active-cycle milestone: ${id}`)
  assert.ok(
    Array.isArray(milestone.verificationScripts) &&
      milestone.verificationScripts.length > 0,
    `Missing verification script contract: ${id}`,
  )
  const sectionStart = plan.indexOf(`## ${id} —`)
  assert.ok(sectionStart >= 0, `Active plan is missing ${id}`)
  const nextSection = plan.indexOf("\n## ", sectionStart + 4)
  const section = plan.slice(
    sectionStart,
    nextSection === -1 ? plan.length : nextSection,
  )
  assert.ok(
    section.includes(`**Status:** ${milestone.status}`),
    `Plan/manifest status mismatch for ${id}`,
  )
}

const activeDesignText = [
  "01_PRODUCT_SPEC.md",
  "02_MVP_SCOPE.md",
  "03_TECHNICAL_DECISIONS.md",
  "04_IMPLEMENTATION_PLAN.md",
  "docs/post-mvp/06_DESIGN_RULEBOOK.md",
  "docs/post-mvp/07_PAGE_CHANGELOG.md",
]
  .map((path) => readFileSync(resolve(root, path), "utf8"))
  .join("\n")
for (const staleMarker of [
  "01_UX_SPEC.md",
  "DA RIVEDERE",
  "NON ATTIVO",
  "12_R2_REVIEW_QUESTIONS.md",
  "11_MOCK_REVIEW.md",
]) {
  assert.ok(
    !activeDesignText.includes(staleMarker),
    `Active documents retain stale planning marker: ${staleMarker}`,
  )
}

const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8")
assert.match(workflow, /npm run verify:all/, "CI must run verify:all")

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
