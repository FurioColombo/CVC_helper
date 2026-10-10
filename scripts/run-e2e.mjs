import { spawn } from "node:child_process"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createServer } from "node:net"
import { resolve } from "node:path"

import { flakyEntry, flakyTestsFrom } from "./e2e-report.mjs"

const root = resolve(import.meta.dirname, "..")
const reportPath = resolve(root, "test-results/e2e-report.json")
const flakyPath = resolve(root, "test-results/e2e-flaky.json")

// RR-3: an OS-assigned free port, found by binding to port 0 and releasing it
// immediately. This is handed to Playwright (see playwright.config.ts) as the
// server it must start itself. Picking a fresh port every run, instead of a
// fixed one, means this can never attach to a Vite server left running by
// another worktree or a stale build — Playwright's own `webServer` (with
// `reuseExistingServer: false`) always launches a brand new process here.
async function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer()
    probe.unref()
    probe.on("error", reject)
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address()
      probe.close(() => resolvePort(port))
    })
  })
}

/**
 * `--focus` runs the specs the milestone being recorded lists as `e2eSpecs` in
 * the manifest: an ordinary close records `verify` plus its affected browser
 * specs (03_TECHNICAL_DECISIONS.md §6). `npm run evidence -- <ID>` passes the
 * milestone in CVC_MILESTONE.
 */
function focusSpecs() {
  const id = process.env.CVC_MILESTONE
  if (!id) throw new Error("--focus needs CVC_MILESTONE (npm run evidence)")
  const manifest = JSON.parse(
    readFileSync(resolve(root, ".milestones/manifest.json"), "utf8"),
  )
  const specs = manifest.milestones.find((m) => m.id === id)?.e2eSpecs ?? []
  if (specs.length === 0) {
    throw new Error(`Milestone ${id} lists no e2eSpecs in the manifest`)
  }
  for (const spec of specs) {
    if (!existsSync(resolve(root, spec))) {
      throw new Error(`e2eSpecs of ${id} names a missing spec: ${spec}`)
    }
  }
  return specs
}

const args = process.argv.slice(2)
const focus = args.includes("--focus")
const playwrightArgs = [
  ...args.filter((arg) => arg !== "--focus"),
  ...(focus ? focusSpecs() : []),
]

const port = await getFreePort()
const baseURL = `http://127.0.0.1:${port}`

const playwrightCli = resolve(
  root,
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
)
rmSync(reportPath, { force: true })
rmSync(flakyPath, { force: true })
const status = await new Promise((resolveStatus, reject) => {
  const child = spawn(
    process.execPath,
    [playwrightCli, "test", ...playwrightArgs],
    {
      cwd: root,
      env: { ...process.env, CVC_E2E_BASE_URL: baseURL },
      stdio: "inherit",
    },
  )
  child.on("error", reject)
  child.on("close", (exitCode) => resolveStatus(exitCode ?? 1))
})

// A flaky test passed this run only on a retry. It is a defect: the recorder
// copies this list into verification.json, and completion refuses until each
// one is filed in docs/working/BACKLOG.md.
const flaky = existsSync(reportPath)
  ? flakyTestsFrom(JSON.parse(readFileSync(reportPath, "utf8")))
  : []
writeFileSync(flakyPath, `${JSON.stringify(flaky, null, 2)}\n`)
for (const test of flaky) {
  console.log(`FLAKY: ${flakyEntry(test)} [${test.project}]`)
}

process.exitCode = status
