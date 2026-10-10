import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { resolve } from "node:path"
import { spawn, spawnSync } from "node:child_process"

import { RECORDER_ID, sourceDigest } from "./verification-digest.mjs"

// `--file <name>.json` records a re-run under a new name: a completed
// milestone's verification.json is frozen (docs/DOCS_SYSTEM.md rule 6), so a
// fix that CI forces after completion is recorded beside it.
const [milestone, ...options] = process.argv.slice(2)
const fileOption = options.indexOf("--file")
const outputName =
  fileOption === -1 ? "verification.json" : options[fileOption + 1]
if (!milestone || !/^[\w.-]+\.json$/.test(outputName ?? "")) {
  console.error("Usage: record-verification.mjs <ID> [--file <name>.json]")
  process.exit(1)
}

const root = resolve(import.meta.dirname, "..")
const manifest = JSON.parse(
  readFileSync(resolve(root, ".milestones/manifest.json"), "utf8"),
)
const definition = manifest.milestones.find(({ id }) => id === milestone)
if (!definition) throw new Error(`Unknown milestone: ${milestone}`)
const scripts =
  definition.verificationScripts ??
  (milestone === "M15"
    ? ["verify:all"]
    : ["verify:quick", "verify:domain", "build", "verify:e2e"])
if (!Array.isArray(scripts) || scripts.length === 0) {
  throw new Error(`No verification scripts configured for ${milestone}`)
}
const checks = []
const npmCli = process.env.npm_execpath
// scripts/run-e2e.mjs lists the tests that passed only on a retry; a list left
// by an earlier run must not be recorded as this one's.
const flakyPath = resolve(root, "test-results/e2e-flaky.json")
rmSync(flakyPath, { force: true })

if (!npmCli) {
  throw new Error("Run this recorder through an npm evidence script")
}

const gitCommit = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).stdout.trim()
// Taken before the run: the source the checks below actually exercise.
const source = sourceDigest(root)
const uncommitted = spawnSync(
  "git",
  ["status", "--porcelain", "--", ".", ":!.evidence", ":!.milestones"],
  { cwd: root, encoding: "utf8" },
).stdout.trim()

for (const script of scripts) {
  const startedAt = new Date().toISOString()
  const started = performance.now()
  let output = ""
  const appendOutput = (chunk) => {
    const text = chunk.toString()
    process.stdout.write(text)
    output = `${output}${text}`.slice(-100_000)
  }
  const result = await new Promise((resolveResult) => {
    let error = null
    // CVC_MILESTONE tells `verify:e2e:focus` whose e2eSpecs to run.
    const child = spawn(process.execPath, [npmCli, "run", script], {
      cwd: root,
      env: { ...process.env, CVC_MILESTONE: milestone },
      stdio: ["ignore", "pipe", "pipe"],
    })
    child.stdout.on("data", appendOutput)
    child.stderr.on("data", appendOutput)
    child.on("error", (spawnError) => {
      error = spawnError
    })
    child.on("close", (status) => resolveResult({ error, status }))
  })
  if (result.error) appendOutput(`${result.error.message}\n`)
  checks.push({
    command: `npm run ${script}`,
    status: result.status === 0 ? "PASS" : "FAIL",
    startedAt,
    durationMs: Math.round(performance.now() - started),
    exitCode: result.status ?? 1,
    outputTail: output.trim().split("\n").slice(-12).join("\n"),
  })
  if (result.status !== 0) break
}

const flakyTests = existsSync(flakyPath)
  ? JSON.parse(readFileSync(flakyPath, "utf8"))
  : []

const evidenceDirectory = resolve(root, ".evidence", milestone)
mkdirSync(evidenceDirectory, { recursive: true })
const status =
  checks.length === scripts.length &&
  checks.every((check) => check.status === "PASS")
    ? "PASS"
    : "FAIL"
writeFileSync(
  resolve(evidenceDirectory, outputName),
  `${JSON.stringify(
    {
      milestone,
      status,
      recordedAt: new Date().toISOString(),
      nodeVersion: process.version,
      appVersion: JSON.parse(
        readFileSync(resolve(root, "package.json"), "utf8"),
      ).version,
      recorder: RECORDER_ID,
      gitCommit,
      // The commit alone does not say what ran: the tree may hold uncommitted
      // work. The digest identifies the exact source; see verification-digest.
      workingTreeClean: uncommitted.length === 0,
      sourceDigest: source.digest,
      sourceFiles: source.files,
      verificationScripts: scripts,
      ...(scripts.includes("verify:e2e:focus")
        ? { e2eSpecs: definition.e2eSpecs ?? [] }
        : {}),
      flakyTests,
      checks,
    },
    null,
    2,
  )}\n`,
)

process.exitCode = status === "PASS" ? 0 : 1
