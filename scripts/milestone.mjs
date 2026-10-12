import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import {
  githubClient,
  latestPushRun,
  repositoryFromRemote,
} from "./ci-status.mjs"
import { flakyEntry } from "./e2e-report.mjs"
import {
  invalidateOwnerItems,
  ownerCompletionProblems,
  ownerEvidenceProblems,
  ownerItemsFor,
  readOwnerChecks,
  renderOwnerTodo,
  validateOwnerChecks,
  writeOwnerChecks,
} from "./owner-checks.mjs"
import { RECORDER_ID, sourceDigest } from "./verification-digest.mjs"

const repositoryRoot = resolve(import.meta.dirname, "..")

export function createMilestoneController(
  root = repositoryRoot,
  { ciClient = githubClient() } = {},
) {
  const manifestPath = resolve(root, ".milestones/manifest.json")
  const planPath = resolve(root, "04_IMPLEMENTATION_PLAN.md")
  // A test that passed only on a retry is a defect and must be filed here.
  const backlogPath = resolve(root, "docs/working/BACKLOG.md")

  function readManifest() {
    return JSON.parse(readFileSync(manifestPath, "utf8"))
  }

  function writeManifest(manifest) {
    const formatted = execFileSync(
      process.execPath,
      [
        resolve(repositoryRoot, "node_modules/prettier/bin/prettier.cjs"),
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

  /**
   * Why a milestone's verification does not count, or null when it does. The
   * strict rules apply to a completion being made now: the file must come from
   * the recorder, cover every script the manifest names with exit code 0, and
   * describe the source as it still is. Milestones closed before those rules
   * existed are only checked for their recorded PASS.
   */
  function verificationProblem(milestone, { strict, expectedDigest }) {
    const verificationPath = milestone.requiredEvidence?.find((path) =>
      path.endsWith("verification.json"),
    )
    if (!verificationPath) return null

    const verification = JSON.parse(
      readFileSync(resolve(root, verificationPath), "utf8"),
    )
    const passed =
      verification.status === "PASS" &&
      Array.isArray(verification.checks) &&
      verification.checks.length > 0 &&
      verification.checks.every((check) => check.status === "PASS")
    if (!passed) return "it does not report all PASS"
    if (!strict) return null
    if (verification.recorder !== RECORDER_ID) {
      return "it was not written by npm run evidence"
    }
    const required = milestone.verificationScripts ?? []
    const missing = required.filter(
      (script) =>
        !verification.checks.some(
          (check) =>
            check.command === `npm run ${script}` &&
            check.status === "PASS" &&
            check.exitCode === 0,
        ),
    )
    if (missing.length > 0) {
      return `it lacks a passing run of: ${missing.join(", ")}`
    }
    if (!/^v24\./.test(verification.nodeVersion ?? "")) {
      return "it was not recorded on Node 24"
    }
    if (
      verification.sourceDigest !==
      (expectedDigest ?? sourceDigest(root).digest)
    ) {
      return "the source changed after it was recorded; run npm run evidence again"
    }
    if (required.includes("verify:e2e:focus")) {
      const listed = [...(milestone.e2eSpecs ?? [])].sort().join("|")
      const ran = [...(verification.e2eSpecs ?? [])].sort().join("|")
      if (!listed || listed !== ran) {
        return "its focused browser run does not match the manifest's e2eSpecs"
      }
    }
    const backlog = existsSync(backlogPath)
      ? readFileSync(backlogPath, "utf8")
      : ""
    // Filed means the backlog quotes the entry in backticks, exactly as
    // scripts/run-e2e.mjs prints it after FLAKY:, so neither a phrase of the
    // title nor a spec whose name ends the same way counts.
    const unfiled = (verification.flakyTests ?? [])
      .map(flakyEntry)
      .filter((entry) => !backlog.includes(`\`${entry}\``))
    if (unfiled.length > 0) {
      return `flaky tests are not filed in docs/working/BACKLOG.md: ${unfiled.join("; ")}`
    }
    return null
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

  function assertEvidenceComplete(
    milestone,
    { strict = true, expectedDigest } = {},
  ) {
    const missing = missingEvidence(milestone)
    if (missing.length > 0) {
      throw new Error(
        `Completion refused; missing evidence:\n- ${missing.join("\n- ")}`,
      )
    }
    const problem = verificationProblem(milestone, { strict, expectedDigest })
    if (problem) {
      throw new Error(`Completion refused; verification.json: ${problem}`)
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
    if (start === -1)
      throw new Error(`Milestone ${id} is missing from the plan`)
    const next = plan.indexOf("\n## ", start + header.length)
    const end = next === -1 ? plan.length : next
    const section = plan.slice(start, end)
    const updated = section.replace(
      /\*\*Status:\*\* (PENDING|IN_PROGRESS|AWAITING_OWNER|BLOCKED|COMPLETE)/,
      `**Status:** ${status}`,
    )
    if (updated === section) {
      if (section.includes(`**Status:** ${status}`)) return
      throw new Error(`Milestone ${id} has no editable status in the plan`)
    }
    writeFileSync(
      planPath,
      `${plan.slice(0, start)}${updated}${plan.slice(end)}`,
    )
  }

  function agentMilestone(milestone) {
    return {
      ...milestone,
      requiredEvidence: (milestone.requiredEvidence ?? []).filter(
        (file) => !(milestone.ownerEvidence ?? []).includes(file),
      ),
    }
  }

  function ownerQueue(manifest) {
    const queue = readOwnerChecks(root)
    const problems = validateOwnerChecks(queue, manifest)
    if (problems.length)
      throw new Error(`Owner checklist invalid:\n${problems.join("\n")}`)
    if (
      readFileSync(resolve(root, "docs/OWNER_TODO.md"), "utf8") !==
      renderOwnerTodo(queue)
    ) {
      throw new Error(
        "Owner todo is out of date; regenerate the owner checklist before continuing",
      )
    }
    return queue
  }

  function evidenceHashes(milestone) {
    return Object.fromEntries(
      [
        ...new Set([
          ...(agentMilestone(milestone).requiredEvidence ?? []),
          ...(milestone.requiredReviews ?? []),
        ]),
      ].map((file) => [
        file,
        createHash("sha256")
          .update(readFileSync(resolve(root, file)))
          .digest("hex"),
      ]),
    )
  }

  async function assertGreenCheckpoint(commit) {
    const remote = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: root,
      encoding: "utf8",
    }).trim()
    const repo = repositoryFromRemote(remote)
    const run = latestPushRun(await ciClient.runs(repo, commit), commit)
    if (run?.status !== "completed" || run.conclusion !== "success") {
      throw new Error(
        `Checkpoint ${commit.slice(0, 12)} needs green push CI; ${run?.status ?? "missing"}/${run?.conclusion ?? "unknown"} is not a PASS`,
      )
    }
    return run
  }

  async function assertAwaitingOwnerReady(manifest, milestone) {
    const proof = milestone.agentReady
    if (
      !proof ||
      !/^[a-f\d]{40}$/.test(proof.commit ?? "") ||
      !/^[a-f\d]{64}$/.test(proof.sourceDigest ?? "")
    ) {
      throw new Error(
        `${milestone.id} has no verified agent checkpoint; resume and verify it`,
      )
    }
    execFileSync("git", ["merge-base", "--is-ancestor", proof.commit, "HEAD"], {
      cwd: root,
      stdio: "pipe",
    })
    const hashes = evidenceHashes(milestone)
    if (JSON.stringify(hashes) !== JSON.stringify(proof.evidenceHashes)) {
      throw new Error(
        `${milestone.id}'s agent evidence changed after handoff; resume and verify it`,
      )
    }
    assertEvidenceComplete(agentMilestone(milestone), {
      expectedDigest: proof.sourceDigest,
    })
    const currentDigest = sourceDigest(root).digest
    if (currentDigest !== proof.sourceDigest) {
      const index = manifest.milestones.indexOf(milestone)
      const accounted = manifest.milestones
        .slice(index + 1)
        .some(
          (later) =>
            later.startedFrom?.ownerPrerequisites?.some(
              (entry) =>
                entry.id === milestone.id && entry.commit === proof.commit,
            ) &&
            (later.status === "IN_PROGRESS" ||
              later.agentReady?.sourceDigest === currentDigest ||
              later.verifiedSourceDigest === currentDigest),
        )
      if (!accounted)
        throw new Error(
          `${milestone.id}'s source changed without recorded permitted later work; resume and reverify the changed milestone`,
        )
    }
    const queue = ownerQueue(manifest)
    if (!ownerItemsFor(queue, milestone.id).length) {
      throw new Error(`${milestone.id} has no required owner checklist item`)
    }
    if (
      ownerItemsFor(queue, milestone.id).some(
        (item) => item.status === "CHANGES_REQUESTED",
      )
    ) {
      throw new Error(
        `${milestone.id} has owner-requested fixes; resume it before dependent work`,
      )
    }
    await assertGreenCheckpoint(proof.commit)
    return queue
  }

  async function assertPreviousComplete(manifest, index) {
    const current = manifest.milestones[index]
    const previous = manifest.milestones.slice(0, index)
    for (const milestone of previous) {
      if (milestone.status === "COMPLETE") continue
      if (
        milestone.status !== "AWAITING_OWNER" &&
        !(milestone.ownerEvidence ?? []).length &&
        !ownerItemsFor(ownerQueue(manifest), milestone.id).length &&
        current.category !== "INTEGRATION_GATE" &&
        (current.allowedIncompletePredecessors ?? []).includes(milestone.id)
      )
        continue
      const permission = (current.allowedAwaitingOwnerPredecessors ?? []).find(
        (entry) => entry.id === milestone.id && entry.reason?.trim(),
      )
      if (
        milestone.status === "AWAITING_OWNER" &&
        current.category !== "INTEGRATION_GATE" &&
        permission
      ) {
        await assertAwaitingOwnerReady(manifest, milestone)
        continue
      }
      throw new Error(
        `Previous milestone ${milestone.id} is ${milestone.status}; ${current.id} cannot proceed without a verified, explicitly permitted prerequisite`,
      )
    }
  }

  function status() {
    const milestones = readManifest().milestones
    const latestComplete = milestones.findLast(
      (milestone) => milestone.status === "COMPLETE",
    )
    console.log(`Latest complete: ${latestComplete?.id ?? "none"}`)
    for (const milestone of milestones) {
      if (milestone.status === "COMPLETE") continue
      console.log(
        `${milestone.id}: ${milestone.status} (${milestone.category})`,
      )
    }
    const queue = ownerQueue({ milestones })
    const outstanding = queue.items.filter((item) => item.status !== "PASSED")
    console.log(`Owner actions: ${outstanding.length} — docs/OWNER_TODO.md`)
    for (const item of outstanding)
      console.log(`  ${item.id}: ${item.status} — ${item.title}`)
  }

  async function start(id) {
    const manifest = readManifest()
    const { index, milestone } = findMilestone(manifest, id)
    await assertPreviousComplete(manifest, index)
    if (!new Set(["PENDING", "IN_PROGRESS"]).has(milestone.status)) {
      throw new Error(`${id} cannot start from status ${milestone.status}`)
    }
    if (!milestone.startedFrom) {
      milestone.startedFrom = {
        commit: execFileSync("git", ["rev-parse", "HEAD"], {
          cwd: root,
          encoding: "utf8",
        }).trim(),
        sourceDigest: sourceDigest(root).digest,
        ownerPrerequisites: manifest.milestones
          .slice(0, index)
          .filter((entry) => entry.status === "AWAITING_OWNER")
          .map((entry) => ({ id: entry.id, commit: entry.agentReady.commit })),
      }
    }
    milestone.status = "IN_PROGRESS"
    setPlanStatus(id, "IN_PROGRESS")
    writeManifest(manifest)
    console.log(`${id}: IN_PROGRESS`)
  }

  async function check(id) {
    const manifest = readManifest()
    const { index, milestone } = findMilestone(manifest, id)
    await assertPreviousComplete(manifest, index)
    if (milestone.status === "AWAITING_OWNER") {
      const queue = await assertAwaitingOwnerReady(manifest, milestone)
      console.log(
        `${id}: AWAITING_OWNER; agent checkpoint verified, ${ownerItemsFor(queue, id).filter((item) => item.status !== "PASSED").length} owner checks outstanding`,
      )
      return
    }
    const missing = missingEvidence(milestone)
    console.log(`${id}: ${milestone.status}`)
    console.log(`Category: ${milestone.category}`)
    console.log(
      missing.length === 0
        ? "Required evidence: present"
        : `Required evidence missing:\n- ${missing.join("\n- ")}`,
    )
    const strict = milestone.status !== "COMPLETE"
    const problem =
      missing.length > 0 ? null : verificationProblem(milestone, { strict })
    if (problem) console.log(`Verification not accepted: ${problem}`)
    if (missing.length > 0 || problem || !reviewsPassed(milestone))
      process.exitCode = 1
  }

  async function awaitOwner(id) {
    const manifest = readManifest()
    const { index, milestone } = findMilestone(manifest, id)
    await assertPreviousComplete(manifest, index)
    if (milestone.status !== "IN_PROGRESS")
      throw new Error(`${id} must be IN_PROGRESS before owner handoff`)
    const queue = ownerQueue(manifest)
    const items = ownerItemsFor(queue, id)
    if (!items.length)
      throw new Error(`${id} needs required owner checklist items`)
    for (const file of milestone.ownerEvidence ?? []) {
      if (
        !(milestone.requiredEvidence ?? []).includes(file) ||
        !items.some((item) => item.evidencePath === file)
      ) {
        throw new Error(
          `${id}'s owner evidence ${file} needs a matching required checklist item`,
        )
      }
    }
    if (items.some((item) => item.status === "CHANGES_REQUESTED"))
      throw new Error(`${id} still has owner-requested fixes`)
    assertEvidenceComplete(agentMilestone(milestone))
    const dirty = execFileSync(
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
    ).trim()
    if (dirty)
      throw new Error(
        "Commit the verified implementation before owner handoff; source edits are still uncommitted",
      )
    const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim()
    if (
      items.some(
        (item) =>
          item.status !== "NEEDS_SETUP" &&
          item.kind === "DEVICE_CHECK" &&
          item.testedCommit !== commit,
      )
    )
      throw new Error(
        "Owner checks must name the verified checkpoint before handoff",
      )
    const run = await assertGreenCheckpoint(commit)
    assertDocsCheck()
    milestone.agentReady = {
      commit,
      sourceDigest: sourceDigest(root).digest,
      evidenceHashes: evidenceHashes(milestone),
      ciRunId: run.id,
      ciUrl: run.html_url,
    }
    milestone.status = "AWAITING_OWNER"
    setPlanStatus(id, "AWAITING_OWNER")
    writeManifest(manifest)
    console.log(
      `${id}: AWAITING_OWNER — agent work verified at ${commit.slice(0, 12)}; announce docs/OWNER_TODO.md and continue only permitted work`,
    )
  }

  function resume(id) {
    const manifest = readManifest()
    const { milestone } = findMilestone(manifest, id)
    if (milestone.status !== "AWAITING_OWNER")
      throw new Error(`${id} must be AWAITING_OWNER before resuming fixes`)
    const queue = invalidateOwnerItems(ownerQueue(manifest), id)
    writeOwnerChecks(root, queue)
    milestone.status = "IN_PROGRESS"
    delete milestone.agentReady
    setPlanStatus(id, "IN_PROGRESS")
    writeManifest(manifest)
    console.log(
      `${id}: IN_PROGRESS — prior owner checks invalidated; reverify and request a new check after fixes`,
    )
  }

  async function complete(id) {
    const manifest = readManifest()
    const { index, milestone } = findMilestone(manifest, id)
    await assertPreviousComplete(manifest, index)
    if (!["IN_PROGRESS", "AWAITING_OWNER"].includes(milestone.status)) {
      throw new Error(
        `${id} must be IN_PROGRESS or AWAITING_OWNER before completion`,
      )
    }
    if (milestone.status === "AWAITING_OWNER") {
      const queue = await assertAwaitingOwnerReady(manifest, milestone)
      const problems = ownerCompletionProblems(
        queue,
        id,
        milestone.agentReady.commit,
      )
      problems.push(...ownerEvidenceProblems(root, queue, id))
      if (problems.length)
        throw new Error(
          `Completion refused; owner checks:\n${problems.join("\n")}`,
        )
      assertEvidenceComplete(milestone, {
        expectedDigest:
          milestone.category === "INTEGRATION_GATE"
            ? undefined
            : milestone.agentReady.sourceDigest,
      })
    } else {
      if (
        (milestone.ownerEvidence ?? []).length ||
        ownerItemsFor(ownerQueue(manifest), id).length
      )
        throw new Error(
          `${id} needs an AWAITING_OWNER handoff and explicit owner results before completion`,
        )
      assertEvidenceComplete(milestone)
    }
    assertPlanSwept(id)
    assertDocsCheck()
    milestone.status = "COMPLETE"
    milestone.verifiedSourceDigest =
      milestone.agentReady?.sourceDigest ?? sourceDigest(root).digest
    writeManifest(manifest)
    console.log(`${id}: COMPLETE`)
  }

  /**
   * docs/DOCS_SYSTEM.md: the plan holds open work only. The milestone-close
   * sweep moves a closing milestone's section to the archive and leaves its
   * status row, so completion refuses a plan that still holds the section.
   * Milestones completed before this rule kept their sections; they are
   * history and are not completed again.
   */
  function planSweepProblem(id, plan) {
    if (plan.includes(`## ${id} —`)) {
      return `the plan still holds the ${id} section: move it to the archive and leave its status row (milestone-close skill, step 5)`
    }
    if (!plan.includes(`| ${id} | Complete.`)) {
      return `the plan needs a "| ${id} | Complete. …" status row`
    }
    return null
  }

  function assertPlanSwept(id) {
    const problem = planSweepProblem(id, readFileSync(planPath, "utf8"))
    if (problem) throw new Error(`Completion refused; ${problem}`)
  }

  function assertDocsCheck() {
    try {
      execFileSync(
        process.execPath,
        [resolve(root, "scripts/check-docs.mjs")],
        {
          cwd: root,
          encoding: "utf8",
          stdio: "pipe",
        },
      )
    } catch (error) {
      throw new Error(
        `Completion refused; check:docs failed:\n${error.stderr ?? ""}${error.stdout ?? ""}`,
        { cause: error },
      )
    }
  }

  function selfTest() {
    const evidenceDirectory = resolve(root, ".evidence/__synthetic__")
    mkdirSync(evidenceDirectory, { recursive: true })
    const failedVerificationPath = resolve(
      evidenceDirectory,
      "verification.json",
    )
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
    const passingCheck = (script) => ({
      command: `npm run ${script}`,
      status: "PASS",
      exitCode: 0,
    })
    const writeVerification = (name, content) =>
      writeFileSync(
        resolve(evidenceDirectory, name),
        `${JSON.stringify({ status: "PASS", nodeVersion: "v24.0.0", ...content })}\n`,
      )
    writeVerification("handwritten-verification.json", {
      checks: [passingCheck("verify")],
    })
    writeVerification("partial-verification.json", {
      recorder: RECORDER_ID,
      sourceDigest: sourceDigest(root).digest,
      checks: [passingCheck("verify:quick")],
    })
    writeVerification("flaky-verification.json", {
      recorder: RECORDER_ID,
      sourceDigest: sourceDigest(root).digest,
      checks: [passingCheck("verify")],
      flakyTests: [
        {
          file: "synthetic.spec.ts",
          title: "synthetic flaky test never filed anywhere",
        },
      ],
    })
    writeVerification("focus-verification.json", {
      recorder: RECORDER_ID,
      sourceDigest: sourceDigest(root).digest,
      checks: [passingCheck("verify:e2e:focus")],
      e2eSpecs: ["tests/e2e/a-different.spec.ts"],
    })
    writeVerification("stale-verification.json", {
      recorder: RECORDER_ID,
      sourceDigest: "source-before-a-later-change",
      checks: [passingCheck("verify")],
    })

    const cases = [
      {
        name: "missing evidence",
        milestone: {
          requiredEvidence: [
            ".evidence/__synthetic__/intentionally-missing.txt",
          ],
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
        name: "hand-written verification",
        milestone: {
          verificationScripts: ["verify"],
          requiredEvidence: [
            ".evidence/__synthetic__/handwritten-verification.json",
          ],
        },
        expected: "Completion refused; verification.json: it was not written",
      },
      {
        name: "verification missing a required script",
        milestone: {
          verificationScripts: ["verify"],
          requiredEvidence: [
            ".evidence/__synthetic__/partial-verification.json",
          ],
        },
        expected: "Completion refused; verification.json: it lacks",
      },
      {
        name: "verification of an older source",
        milestone: {
          verificationScripts: ["verify"],
          requiredEvidence: [".evidence/__synthetic__/stale-verification.json"],
        },
        expected: "Completion refused; verification.json: the source changed",
      },
      {
        name: "verification with an unfiled flaky test",
        milestone: {
          verificationScripts: ["verify"],
          requiredEvidence: [".evidence/__synthetic__/flaky-verification.json"],
        },
        expected: "Completion refused; verification.json: flaky tests",
      },
      {
        name: "focused browser run of other specs than the manifest lists",
        milestone: {
          verificationScripts: ["verify:e2e:focus"],
          e2eSpecs: ["tests/e2e/smoke.spec.ts"],
          requiredEvidence: [".evidence/__synthetic__/focus-verification.json"],
        },
        expected:
          "Completion refused; verification.json: its focused browser run",
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

    const sweepCases = [
      [
        "a plan that still holds the section",
        "## X1 — Synthetic\n| X1 | Complete. |",
        "the plan still holds",
      ],
      ["a plan without the status row", "## X2 — Other\n", "the plan needs"],
    ]
    for (const [name, plan, expected] of sweepCases) {
      const problem = planSweepProblem("X1", plan) ?? ""
      if (!problem.startsWith(expected)) {
        throw new Error(`Synthetic ${name} case was not refused`)
      }
      results.push(`PASS: ${name} refused\n${problem}`)
    }
    if (planSweepProblem("X1", "| X1 | Complete. Done. |") !== null) {
      throw new Error("A swept plan was refused")
    }

    // The synthetic files exist only for this run; leaving them behind dirtied
    // the tree after every self-test.
    rmSync(evidenceDirectory, { recursive: true, force: true })
    const message =
      "PASS: controller refused missing, failed, hand-written, partial, stale, flaky, unfocused and blocked evidence and unswept plans"
    // U00's controller-refusal.txt is that milestone's closed evidence; the
    // self-test prints its result instead of rewriting it (docs/DOCS_SYSTEM.md).
    console.log(`${results.join("\n\n")}\n\n${message}`)
  }

  return { start, check, complete, awaitOwner, resume, status, selfTest }
}

async function main() {
  const [operation, id] = process.argv.slice(2)
  const controller = createMilestoneController()
  try {
    if (operation === "self-test") controller.selfTest()
    else if (operation === "status") controller.status()
    else if (!id)
      throw new Error(
        "Usage: milestone.mjs status | <start|check|await-owner|resume|complete> <ID>",
      )
    else if (operation === "start") await controller.start(id)
    else if (operation === "check") await controller.check(id)
    else if (operation === "await-owner") await controller.awaitOwner(id)
    else if (operation === "resume") controller.resume(id)
    else if (operation === "complete") await controller.complete(id)
    else throw new Error(`Unknown operation: ${operation}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main()
