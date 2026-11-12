import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { resolve } from "node:path"
import { spawn, spawnSync } from "node:child_process"

import {
  CI_COVERED_SCRIPTS,
  githubClient,
  greenFullRun,
  isLiveSpec,
  repositoryFromRemote,
} from "./ci-status.mjs"
import { RECORDER_ID, sourceDigest } from "./verification-digest.mjs"

// `--file <name>.json` records a re-run under a new name: a completed
// milestone's verification.json is frozen (docs/DOCS_SYSTEM.md rule 6), so a
// fix that CI forces after completion is recorded beside it. `--from-ci`
// (CL-1a) takes what the exact commit's green full push run already proved and
// runs here only the rest: the backend specs, which CI cannot reach, and any
// script CI does not run (03_TECHNICAL_DECISIONS.md §6).
const [milestone, ...options] = process.argv.slice(2)
const fileOption = options.indexOf("--file")
const outputName =
  fileOption === -1 ? "verification.json" : options[fileOption + 1]
if (!milestone || !/^[\w.-]+\.json$/.test(outputName ?? "")) {
  console.error(
    "Usage: record-verification.mjs <ID> [--file <name>.json] [--force] [--from-ci]",
  )
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
// Clean as the digest counts it: Markdown, evidence and the manifest are
// outside the verified source, so a working note does not spoil a recording
// the publisher would then refuse (CL-1c). Source edits are said at once.
const uncommitted = spawnSync(
  "git",
  [
    "status",
    "--porcelain",
    "--",
    ".",
    ":!.evidence",
    ":!.milestones",
    ":(exclude)**/*.md",
    ":(exclude)*.md",
  ],
  { cwd: root, encoding: "utf8" },
).stdout.trim()
const fromCi = options.includes("--from-ci")
if (fromCi && uncommitted) {
  console.error(`--from-ci records a pushed commit: commit this source first.
${uncommitted}`)
  process.exit(1)
}
if (uncommitted) {
  console.warn(
    `Uncommitted source: this recording will say so, and the test-site publisher will refuse it.
${uncommitted}`,
  )
}

// The same source already passed the same checks: nothing to learn from a
// second run (retrospective proposal 2). `--force` records it again.
const previousPath = resolve(root, ".evidence", milestone, outputName)
if (!options.includes("--force") && existsSync(previousPath)) {
  const previous = JSON.parse(readFileSync(previousPath, "utf8"))
  const sameSpecs =
    JSON.stringify(previous.e2eSpecs ?? []) ===
    JSON.stringify(
      scripts.includes("verify:e2e:focus") ? (definition.e2eSpecs ?? []) : [],
    )
  if (
    previous.status === "PASS" &&
    previous.recorder === RECORDER_ID &&
    previous.workingTreeClean === true &&
    uncommitted.length === 0 &&
    previous.sourceDigest === source.digest &&
    JSON.stringify(previous.verificationScripts) === JSON.stringify(scripts) &&
    sameSpecs
  ) {
    console.log(
      `${milestone}: ${outputName} already passed on this source (${source.digest.slice(0, 12)}); nothing re-run. Use --force to record again.`,
    )
    process.exit(0)
  }
}

async function runScript(script, args = []) {
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
    const child = spawn(
      process.execPath,
      [npmCli, "run", script, ...(args.length ? ["--", ...args] : [])],
      {
        cwd: root,
        env: { ...process.env, CVC_MILESTONE: milestone },
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
    child.stdout.on("data", appendOutput)
    child.stderr.on("data", appendOutput)
    child.on("error", (spawnError) => {
      error = spawnError
    })
    child.on("close", (status) => resolveResult({ error, status }))
  })
  if (result.error) appendOutput(`${result.error.message}\n`)
  const check = {
    command: [
      `npm run ${script}`,
      ...(args.length ? ["--", ...args] : []),
    ].join(" "),
    status: result.status === 0 ? "PASS" : "FAIL",
    startedAt,
    durationMs: Math.round(performance.now() - started),
    exitCode: result.status ?? 1,
    outputTail: output.trim().split("\n").slice(-12).join("\n"),
  }
  checks.push(check)
  return check
}

let ci = null
if (fromCi) {
  const git = (args) =>
    spawnSync("git", args, { cwd: root, encoding: "utf8" }).stdout.trim()
  try {
    ci = await greenFullRun(
      githubClient(),
      repositoryFromRemote(git(["remote", "get-url", "origin"])),
      gitCommit,
    )
  } catch (error) {
    console.error(
      `${error.message}. Wait with npm run ci:status -- --wait, or record here without --from-ci.`,
    )
    process.exit(1)
  }
}

for (const script of scripts) {
  if (!ci || !CI_COVERED_SCRIPTS.has(script)) {
    if ((await runScript(script)).status !== "PASS") break
    continue
  }
  const { run, jobs } = ci
  const startedAt = run.run_started_at ?? run.created_at
  checks.push({
    command: `npm run ${script}`,
    status: "PASS",
    source: "ci",
    startedAt,
    durationMs: Date.parse(run.updated_at) - Date.parse(startedAt),
    exitCode: 0,
    outputTail: `Covered by the green full push run ${run.html_url} of ${gitCommit}: ${jobs.map((job) => `${job.name} ${job.conclusion}`).join("; ")}`,
  })
}

// CI skips the backend specs; the local run had them. Here they run on this
// machine, so a recording from CI loses none of that coverage.
const liveSpecs = !ci
  ? []
  : scripts.some((script) => ["verify:e2e", "verify:all"].includes(script))
    ? readdirSync(resolve(root, "tests/e2e"))
        .map((name) => `tests/e2e/${name}`)
        .filter(isLiveSpec)
    : scripts.includes("verify:e2e:focus")
      ? (definition.e2eSpecs ?? []).filter(isLiveSpec)
      : []
if (liveSpecs.length > 0 && checks.every((check) => check.status === "PASS")) {
  const check = await runScript("verify:e2e", liveSpecs)
  const reportPath = resolve(root, "test-results/e2e-report.json")
  const stats = existsSync(reportPath)
    ? JSON.parse(readFileSync(reportPath, "utf8")).stats
    : null
  // Each live spec skips the projects it does not target; none passing means
  // the development credentials are missing, the coverage CI also lacks.
  check.passedTests = stats?.expected ?? null
  check.skippedTests = stats?.skipped ?? null
  if (!stats?.expected) {
    check.status = "FAIL"
    check.outputTail = `No backend test ran here: they need the development credentials in .env.\n${check.outputTail}`
  }
}

const flakyTests = [
  ...(ci?.flaky ?? []),
  ...(existsSync(flakyPath) ? JSON.parse(readFileSync(flakyPath, "utf8")) : []),
]

const evidenceDirectory = resolve(root, ".evidence", milestone)
mkdirSync(evidenceDirectory, { recursive: true })
const status =
  checks.length === scripts.length + (liveSpecs.length > 0 ? 1 : 0) &&
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
      ...(ci
        ? {
            ci: {
              runId: ci.run.id,
              attempt: ci.run.run_attempt,
              url: ci.run.html_url,
              jobs: ci.jobs,
            },
          }
        : {}),
      flakyTests,
      checks,
    },
    null,
    2,
  )}\n`,
)

process.exitCode = status === "PASS" ? 0 : 1
