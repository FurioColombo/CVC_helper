import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawn } from "node:child_process"

const milestone = process.argv[2]
if (!milestone) {
  console.error("Usage: record-verification.mjs <ID>")
  process.exit(1)
}

const root = resolve(import.meta.dirname, "..")
const scripts =
  milestone === "M15"
    ? ["verify:all"]
    : ["verify:quick", "verify:domain", "build", "verify:e2e"]
const checks = []
const npmCli = process.env.npm_execpath

if (!npmCli) {
  throw new Error("Run this recorder through an npm evidence script")
}

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
    const child = spawn(process.execPath, [npmCli, "run", script], {
      cwd: root,
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

const evidenceDirectory = resolve(root, ".evidence", milestone)
mkdirSync(evidenceDirectory, { recursive: true })
const status =
  checks.length === scripts.length &&
  checks.every((check) => check.status === "PASS")
    ? "PASS"
    : "FAIL"
writeFileSync(
  resolve(evidenceDirectory, "verification.json"),
  `${JSON.stringify(
    {
      milestone,
      status,
      recordedAt: new Date().toISOString(),
      checks,
    },
    null,
    2,
  )}\n`,
)

process.exitCode = status === "PASS" ? 0 : 1
