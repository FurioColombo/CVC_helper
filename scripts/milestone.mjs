import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const manifestPath = resolve(root, ".milestones/manifest.json")
const planPath = resolve(root, "04_IMPLEMENTATION_PLAN.md")

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, "utf8"))
}

function writeManifest(manifest) {
  const formatted = execFileSync(
    process.execPath,
    [
      resolve(root, "node_modules/prettier/bin/prettier.cjs"),
      "--stdin-filepath",
      manifestPath,
    ],
    { input: `${JSON.stringify(manifest, null, 2)}\n`, encoding: "utf8" },
  )
  writeFileSync(manifestPath, formatted)
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

function reviewPassed(path) {
  const review = JSON.parse(readFileSync(resolve(root, path), "utf8"))
  const verdicts = new Set(["PASS", "PASS_WITH_FINDINGS"])
  return (
    verdicts.has(review.verdict) &&
    Array.isArray(review.blockers) &&
    review.blockers.length === 0 &&
    Array.isArray(review.importantFindings) &&
    Array.isArray(review.qolFindings) &&
    Array.isArray(review.evidenceInspected) &&
    review.evidenceInspected.length > 0
  )
}

function reviewsPassed(milestone) {
  return (milestone.requiredReviews ?? []).every(reviewPassed)
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
  if (!reviewsPassed(milestone)) {
    throw new Error(
      "Completion refused; a required review is invalid, FAIL, or has blockers",
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
    if (section.includes(`**Status:** ${status}`)) return
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
  if (
    missing.length > 0 ||
    !verificationPassed(milestone) ||
    !reviewsPassed(milestone)
  )
    process.exitCode = 1
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
  const evidenceDirectory = resolve(root, ".evidence/__synthetic__")
  mkdirSync(evidenceDirectory, { recursive: true })
  const failedVerificationPath = resolve(evidenceDirectory, "verification.json")
  const blockedReviewPath = resolve(evidenceDirectory, "review.json")
  writeFileSync(
    failedVerificationPath,
    `${JSON.stringify({ status: "FAIL", checks: [{ status: "FAIL" }] })}\n`,
  )
  writeFileSync(
    blockedReviewPath,
    `${JSON.stringify({
      verdict: "PASS_WITH_FINDINGS",
      blockers: ["synthetic blocker"],
      importantFindings: [],
      qolFindings: [],
      evidenceInspected: ["synthetic evidence"],
    })}\n`,
  )

  const cases = [
    {
      name: "missing evidence",
      milestone: {
        requiredEvidence: [".evidence/__synthetic__/intentionally-missing.txt"],
      },
      expected: "Completion refused; missing evidence:",
    },
    {
      name: "failed verification",
      milestone: {
        requiredEvidence: [".evidence/__synthetic__/verification.json"],
      },
      expected: "Completion refused; verification.json",
    },
    {
      name: "review blocker",
      milestone: {
        requiredEvidence: [".evidence/__synthetic__/review.json"],
        requiredReviews: [".evidence/__synthetic__/review.json"],
      },
      expected: "Completion refused; a required review",
    },
  ]

  const results = cases.map(({ name, milestone, expected }) => {
    let refusal = ""
    try {
      assertEvidenceComplete(milestone)
    } catch (error) {
      refusal = error instanceof Error ? error.message : String(error)
    }
    if (!refusal.startsWith(expected)) {
      throw new Error(`Synthetic ${name} case was not refused`)
    }
    return `PASS: ${name} refused\n${refusal}`
  })

  const message =
    "PASS: controller refused missing, failed and blocked evidence"
  const u00EvidenceDirectory = resolve(root, ".evidence/U00")
  mkdirSync(u00EvidenceDirectory, { recursive: true })
  mkdirSync(evidenceDirectory, { recursive: true })
  writeFileSync(
    resolve(u00EvidenceDirectory, "controller-refusal.txt"),
    `${message}\n\n${results.join("\n\n")}\n`,
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
