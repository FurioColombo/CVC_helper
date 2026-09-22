import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, statSync } from "node:fs"
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
// The assertion moves with the release rather than being deleted at it. UG1
// declared 0.2.0 on 2026-09-21, so this now pins the released version and will
// pin 0.3.0 at UG2. The 0.1.0 compatibility fixture is a different thing and
// stays where it is: it is the data contract, not the application version.
assert.equal(
  packageJson.version,
  "0.2.0",
  "package.json must identify the released application as 0.2.0 until UG2",
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

// @huggingface/transformers pins an onnxruntime-web 1.26 pre-release whose
// TransposeDQWeightsForMatMulNBits pass aborts with "Missing required scale:
// model.decoder.embed_tokens.weight_merged_0_scale" for every Whisper decoder.
// The model downloaded to 100% and dictation then failed instantly. 1.23 and
// 1.30 build the same file; 1.26 through 1.29 do not, so the working runtime is
// held here by an override rather than inherited from the transformers pin.
const onnxRuntime = packageJson.overrides?.["onnxruntime-web"]
assert.ok(
  onnxRuntime,
  "package.json must override onnxruntime-web: the version transformers pins cannot build a Whisper session",
)
const [onnxMajor, onnxMinor] = onnxRuntime.split(".").map(Number)
assert.ok(
  !(onnxMajor === 1 && onnxMinor >= 26 && onnxMinor <= 29),
  `onnxruntime-web ${onnxRuntime} cannot create a Whisper decoder session; keep the override outside 1.26-1.29`,
)
assert.equal(
  packageLock.packages?.["node_modules/onnxruntime-web"]?.version,
  onnxRuntime,
  "package-lock.json must resolve onnxruntime-web to the overridden version",
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
  "V01",
  "S1",
  "S2",
  "S3",
  "S4",
  "R1",
  "V02",
  "V03",
  "V04",
  "V05",
  "UG2",
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

// A path rooted in one person's home directory makes the repository work on one
// machine only. `.evidence/UG1/bench.mjs` hard-coded this author's checkout and
// was therefore already broken for anyone else; it moved to scripts/ on
// 2026-09-21 and the path went with it. This keeps it out.
const ABSOLUTE_PATH =
  /(?:[A-Za-z]:[\\/]Users[\\/])|(?:\/Users\/[a-z])|(?:\/home\/[a-z])/
const ABSOLUTE_PATH_EXEMPT = new Map([
  [
    "docs/post-mvp/0_3_0_OWNER_BRIEF.md",
    "human decision record; it quotes the defective path as the finding",
  ],
])
const BINARY_EXTENSION =
  /\.(png|jpe?g|gif|ico|avif|webp|woff2?|wasm|gz|zip|traineddata|pdf|mp3|wav)$/i
const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
})
  .split("\0")
  .filter(Boolean)
const absolutePathHits = []
for (const file of trackedFiles) {
  if (BINARY_EXTENSION.test(file)) continue
  // Machine-recorded command output from milestones that are closed history,
  // wherever that evidence now lives. Rewriting it would falsify the record of
  // what those runs printed.
  if (/(?:^|\/)\.?evidence\/.*verification\.json$/.test(file)) continue
  if (ABSOLUTE_PATH_EXEMPT.has(file)) continue
  const absolute = resolve(root, file)
  if (!existsSync(absolute) || statSync(absolute).size > 2 * 1024 * 1024)
    continue
  const contents = readFileSync(absolute, "utf8")
  contents.split("\n").forEach((line, index) => {
    if (ABSOLUTE_PATH.test(line)) absolutePathHits.push(`${file}:${index + 1}`)
  })
}
assert.deepEqual(
  absolutePathHits,
  [],
  `Absolute machine-specific paths must not be committed:\n- ${absolutePathHits.join("\n- ")}`,
)

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
