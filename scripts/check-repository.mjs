import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const requiredFiles = [
  "AGENTS.md",
  "docs/LOCAL_DEVELOPMENT.md",
  "archive/v0.3.0-through-R1/04_IMPLEMENTATION_PLAN.md",
  "archive/v0.3.0/04_IMPLEMENTATION_PLAN.md",
  ".node-version",
  ".github/workflows/ci.yml",
  ".milestones/manifest.json",
  ".milestones/owner-checks.json",
  "docs/OWNER_TODO.md",
  "docs/OWNER_WORKFLOW.md",
  "playwright.config.ts",
  "vite.config.ts",
  "vitest.config.ts",
  "src/domain/config.ts",
  "src/domain/invariants.ts",
  "src/domain/scenarios.ts",
  "scripts/check-full-week.ts",
  "scripts/check-v0_1-compatibility.ts",
  "scripts/run-e2e.mjs",
  "scripts/check-runtime.mjs",
  "scripts/ci-status.mjs",
  "src/persistence/db.ts",
  "src/test/fixtures/v0.1.0-course.json",
  "docs/design/06_DESIGN_RULEBOOK.md",
  "docs/design/07_PAGE_CHANGELOG.md",
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
// The assertion moves with the cycle rather than being deleted. UG1 declared
// 0.2.0 on 2026-09-21, UG2 0.3.0 on 2026-10-08 and UG3 0.4.0 on 2026-10-24.
// From the 0.5.0 cycle the package names the version under development, set
// at cycle start (B1 needs a 0.5 runtime: older apps are locked out of synced
// data); `main` deploys only released versions, and the tag marks the release.
// The 0.1.0–0.3.0 compatibility fixtures are a different thing and stay
// where they are: they are the data contract, not the application version.
assert.equal(
  packageJson.version,
  "0.5.0",
  "package.json must name the version under development, 0.5.0, in this cycle",
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
  "milestone:status",
  "milestone:check",
  "milestone:complete",
  "milestone:await-owner",
  "milestone:resume",
  "owner:list",
  "owner:check",
  "ci:status",
  "evidence",
]) {
  assert.ok(packageJson.scripts[script], `Missing package script: ${script}`)
}

const manifest = JSON.parse(
  readFileSync(resolve(root, ".milestones/manifest.json"), "utf8"),
)
const plan = readFileSync(resolve(root, "04_IMPLEMENTATION_PLAN.md"), "utf8")
for (const milestone of manifest.milestones) {
  assert.ok(
    [
      "PENDING",
      "IN_PROGRESS",
      "AWAITING_OWNER",
      "BLOCKED",
      "COMPLETE",
    ].includes(milestone.status),
    `Invalid milestone state: ${milestone.id}`,
  )
  for (const file of milestone.ownerEvidence ?? []) {
    assert.ok(
      milestone.requiredEvidence?.includes(file),
      `Owner evidence must be required: ${milestone.id}, ${file}`,
    )
  }
  assert.ok(
    milestone.category !== "INTEGRATION_GATE" ||
      (!(milestone.allowedAwaitingOwnerPredecessors ?? []).length &&
        !(milestone.allowedIncompletePredecessors ?? []).length),
    `Integration gate ${milestone.id} cannot skip pending owner acceptance`,
  )
  for (const entry of milestone.allowedAwaitingOwnerPredecessors ?? []) {
    const predecessor = manifest.milestones.findIndex(
      (candidate) => candidate.id === entry.id,
    )
    assert.ok(
      predecessor >= 0 &&
        predecessor < manifest.milestones.indexOf(milestone) &&
        entry.reason?.trim(),
      `Invalid awaiting-owner dependency permission: ${milestone.id}`,
    )
  }
}
// A completed milestone never changes state: scripts/check-docs.mjs compares
// the manifest with the previous tip, as it does frozen evidence (CL-13).
// The active cycle, 0.5.0. A milestone archived from the plan keeps a status
// row there (docs/DOCS_SYSTEM.md).
for (const id of ["B1", "B2", "B3", "B4", "B5", "B6", "UG4"]) {
  const milestone = manifest.milestones.find((item) => item.id === id)
  assert.ok(milestone, `Missing active-cycle milestone: ${id}`)
  assert.ok(
    Array.isArray(milestone.verificationScripts) &&
      milestone.verificationScripts.length > 0,
    `Missing verification script contract: ${id}`,
  )
  const sectionStart = plan.indexOf(`## ${id} —`)
  if (sectionStart < 0) {
    assert.equal(
      milestone.status,
      "COMPLETE",
      `Active plan is missing incomplete milestone ${id}`,
    )
    assert.ok(
      plan.includes(`| ${id} | Complete.`),
      `Archived milestone ${id} needs a concise completion row in the active plan`,
    )
    continue
  }
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
for (const milestone of manifest.milestones) {
  if (plan.includes(`## ${milestone.id} —`)) continue
  assert.equal(
    milestone.status,
    "COMPLETE",
    `Incomplete milestone missing from active plan: ${milestone.id}`,
  )
}
const activeDesignText = [
  "01_PRODUCT_SPEC.md",
  "02_MVP_SCOPE.md",
  "03_TECHNICAL_DECISIONS.md",
  "04_IMPLEMENTATION_PLAN.md",
  "docs/design/06_DESIGN_RULEBOOK.md",
  "docs/design/07_PAGE_CHANGELOG.md",
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
    "archive/v0.3.0/0_3_0_OWNER_BRIEF.md",
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
const trackedPrivateFiles = trackedFiles.filter((file) =>
  file.startsWith("data/private/"),
)
assert.equal(
  trackedPrivateFiles.length,
  0,
  `Private scan inputs and OCR experiments must not be tracked (${trackedPrivateFiles.length} found)`,
)
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
// The full tier splits verify:all between Linux and macOS (03 §6.1): every
// step of it, and every browser project, must still run somewhere.
const verifyAllSteps = packageJson.scripts["verify:all"]
  .split("&&")
  .map((step) => step.trim())
for (const step of verifyAllSteps) {
  if (step === "npm run verify:e2e") continue
  assert.ok(workflow.includes(step), `CI's full tier must run ${step}`)
}
const browserProjects = [
  ...readFileSync(resolve(root, "playwright.config.ts"), "utf8").matchAll(
    /^\s+name: "([\w-]+)",$/gm,
  ),
].map(([, name]) => name)
assert.ok(browserProjects.length > 0, "No Playwright projects found")
for (const project of browserProjects) {
  assert.ok(
    workflow.includes(`--project=${project}`),
    `CI's full tier must run the ${project} project`,
  )
}
assert.match(
  workflow,
  /fetch-depth: 0/,
  "CI must fetch the full history so the pre-rewrite check below is real",
)

// The published history was rewritten before the first 0.3.0 push to remove
// real roster data. A copy made before that still holds the old commits, and
// merging or pushing from it would publish them again. The rewrite lists the
// earliest changed commits of the old history: every old commit descends from
// one of them, so none may be reachable from HEAD. Before the rewrite the list
// does not exist yet and there is nothing to check.
const historyRewritePath = resolve(root, ".evidence/F1/history-rewrite.json")
if (existsSync(historyRewritePath)) {
  const { preRewriteCommits } = JSON.parse(
    readFileSync(historyRewritePath, "utf8"),
  )
  // Full ids only: a short, mistyped or empty entry would silently count as
  // "not an ancestor" below.
  assert.ok(
    Array.isArray(preRewriteCommits) &&
      preRewriteCommits.length > 0 &&
      preRewriteCommits.every((commit) => /^[0-9a-f]{40}$/.test(commit)),
    "history-rewrite.json must list preRewriteCommits as full commit ids",
  )
  const reachable = preRewriteCommits.filter((commit) => {
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], {
        cwd: root,
        stdio: "ignore",
      })
      return true
    } catch {
      // Exit 1: not an ancestor. A missing object cannot be an ancestor either.
      return false
    }
  })
  assert.deepEqual(
    reachable,
    [],
    "HEAD contains commits from before the history rewrite. Do not push: re-clone, or reset this copy's branches to origin (AGENTS.md §13)",
  )
}

assert.ok(
  packageJson.dependencies?.["@powersync/web"],
  "PowerSync must remain after the successful local-only browser spike",
)

// Supabase Auth arrives with 0.5.0's online backup (02_MVP_SCOPE.md §4, B3);
// its client stays pinned and loads only where backup is configured.
assert.equal(
  packageJson.dependencies?.["@supabase/supabase-js"],
  "2.117.3",
  "The Supabase client must stay pinned to the reviewed version",
)

for (const forbidden of ["dexie", "redux", "zustand"]) {
  assert.ok(
    !packageJson.dependencies?.[forbidden] &&
      !packageJson.devDependencies?.[forbidden],
    `Out-of-scope or rejected dependency retained: ${forbidden}`,
  )
}

console.log("PASS: repository structure and command surface")
