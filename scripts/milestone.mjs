import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const manifestPath = resolve(root, ".milestones/manifest.json")
const planPath = resolve(root, "04_IMPLEMENTATION_PLAN.md")

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, "utf8"))
}

function writeManifest(manifest) {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

function findMilestone(manifest, id) {
  const index = manifest.milestones.findIndex(
    (milestone) => milestone.id === id,
  )
  if (index === -1) {
    throw new Error(`Unknown milestone: ${id}`)
  }
  return { index, milestone: manifest.milestones[index] }
}

function missingEvidence(milestone) {
  return (milestone.requiredEvidence ?? []).filter(
    (path) => !existsSync(resolve(root, path)),
  )
}

function verificationPassed(milestone) {
  const verificationPath = milestone.requiredEvidence?.find((path) =>
    path.endsWith("verification.json"),
  )
  if (!verificationPath) return true

  const verification = JSON.parse(
    readFileSync(resolve(root, verificationPath), "utf8"),
  )
  return (
    verification.status === "PASS" &&
    Array.isArray(verification.checks) &&
    verification.checks.length > 0 &&
    verification.checks.every((check) => check.status === "PASS")
  )
}

function assertEvidenceComplete(milestone) {
  const missing = missingEvidence(milestone)
  if (missing.length > 0) {
    throw new Error(
      `Completion refused; missing evidence:\n- ${missing.join("\n- ")}`,
    )
  }
  if (!verificationPassed(milestone)) {
    throw new Error(
      "Completion refused; verification.json does not report all PASS",
    )
  }
}

function setPlanStatus(id, status) {
  const plan = readFileSync(planPath, "utf8")
  const header = `## ${id} —`
  const start = plan.indexOf(header)
  if (start === -1) throw new Error(`Milestone ${id} is missing from the plan`)
  const next = plan.indexOf("\n## ", start + header.length)
  const end = next === -1 ? plan.length : next
  const section = plan.slice(start, end)
  const updated = section.replace(
    /\*\*Status:\*\* (PENDING|IN_PROGRESS|BLOCKED|COMPLETE)/,
    `**Status:** ${status}`,
  )
  if (updated === section) {
    throw new Error(`Milestone ${id} has no editable status in the plan`)
  }
  writeFileSync(planPath, `${plan.slice(0, start)}${updated}${plan.slice(end)}`)
}

function assertPreviousComplete(manifest, index) {
  const previous = manifest.milestones.slice(0, index)
  const incomplete = previous.find(
    (milestone) => milestone.status !== "COMPLETE",
  )
  if (incomplete) {
    throw new Error(`Previous milestone ${incomplete.id} is not COMPLETE`)
  }
}

function start(id) {
  const manifest = readManifest()
  const { index, milestone } = findMilestone(manifest, id)
  assertPreviousComplete(manifest, index)
  if (!new Set(["PENDING", "IN_PROGRESS"]).has(milestone.status)) {
    throw new Error(`${id} cannot start from status ${milestone.status}`)
  }
  milestone.status = "IN_PROGRESS"
  setPlanStatus(id, "IN_PROGRESS")
  writeManifest(manifest)
  console.log(`${id}: IN_PROGRESS`)
}

function check(id) {
  const manifest = readManifest()
  const { index, milestone } = findMilestone(manifest, id)
  assertPreviousComplete(manifest, index)
  const missing = missingEvidence(milestone)
  console.log(`${id}: ${milestone.status}`)
  console.log(`Category: ${milestone.category}`)
  console.log(
    missing.length === 0
      ? "Required evidence: present"
      : `Required evidence missing:\n- ${missing.join("\n- ")}`,
  )
  if (missing.length > 0 || !verificationPassed(milestone)) process.exitCode = 1
}

function complete(id) {
  const manifest = readManifest()
  const { index, milestone } = findMilestone(manifest, id)
  assertPreviousComplete(manifest, index)
  if (milestone.status !== "IN_PROGRESS") {
    throw new Error(`${id} must be IN_PROGRESS before completion`)
  }
  assertEvidenceComplete(milestone)
  milestone.status = "COMPLETE"
  setPlanStatus(id, "COMPLETE")
  writeManifest(manifest)
  console.log(`${id}: COMPLETE`)
}

function selfTest() {
  const path = ".evidence/__synthetic__/intentionally-missing.txt"
  let refusal = ""
  try {
    assertEvidenceComplete({ requiredEvidence: [path] })
  } catch (error) {
    refusal = error instanceof Error ? error.message : String(error)
  }
  if (!refusal.startsWith("Completion refused; missing evidence:"))
    throw new Error("Synthetic incomplete milestone was not refused")
  const message =
    "PASS: completion refused for intentionally incomplete synthetic evidence"
  const evidenceDirectory = resolve(root, ".evidence/M0")
  mkdirSync(evidenceDirectory, { recursive: true })
  writeFileSync(
    resolve(evidenceDirectory, "controller-refusal.txt"),
    `${message}\n${refusal}\n`,
  )
  console.log(message)
}

const [operation, id] = process.argv.slice(2)

try {
  if (operation === "self-test") selfTest()
  else if (!id)
    throw new Error("Usage: milestone.mjs <start|check|complete> <ID>")
  else if (operation === "start") start(id)
  else if (operation === "check") check(id)
  else if (operation === "complete") complete(id)
  else throw new Error(`Unknown operation: ${operation}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
