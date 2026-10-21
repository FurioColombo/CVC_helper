import { execFileSync } from "node:child_process"
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { createMilestoneController } from "./milestone.mjs"
import {
  readOwnerChecks,
  runOwnerChecksCommand,
  writeOwnerChecks,
} from "./owner-checks.mjs"
import { RECORDER_ID, sourceDigest } from "./verification-digest.mjs"

const roots = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "cvc-owner-lifecycle-"))
  roots.push(root)
  const save = (file, data) => {
    const target = join(root, file)
    mkdirSync(join(target, ".."), { recursive: true })
    writeFileSync(
      target,
      typeof data === "string" ? data : JSON.stringify(data, null, 2) + "\n",
    )
  }
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim()
  const manifest = {
    schemaVersion: 1,
    milestones: [
      {
        id: "M1",
        category: "FEATURE",
        status: "IN_PROGRESS",
        verificationScripts: ["verify"],
        ownerEvidence: [".evidence/M1/physical-device-review.json"],
        requiredEvidence: [
          ".evidence/M1/verification.json",
          ".evidence/M1/review.json",
          ".evidence/M1/physical-device-review.json",
        ],
        requiredReviews: [".evidence/M1/review.json"],
      },
      {
        id: "M2",
        category: "FEATURE",
        status: "PENDING",
        allowedAwaitingOwnerPredecessors: [
          { id: "M1", reason: "Independent of the pending phone check." },
        ],
      },
      {
        id: "G1",
        category: "INTEGRATION_GATE",
        status: "PENDING",
        allowedAwaitingOwnerPredecessors: [
          { id: "M1", reason: "Cannot override the release gate." },
        ],
      },
    ],
  }
  save(".milestones/manifest.json", manifest)
  save(
    "04_IMPLEMENTATION_PLAN.md",
    "## M1 — Synthetic feature\n**Status:** IN_PROGRESS\n\n## M2 — Independent work\n**Status:** PENDING\n\n## G1 — Release\n**Status:** PENDING\n",
  )
  save("app.mjs", "export const version = 1\n")
  // Other tests exercise the real documentation checker; this fixture isolates
  // milestone state, evidence provenance and continuation policy.
  save("scripts/check-docs.mjs", "process.exit(0)\n")
  writeOwnerChecks(root, {
    schemaVersion: 1,
    items: [
      {
        id: "M1-PHONE",
        milestone: "M1",
        kind: "DEVICE_CHECK",
        title: "Check the synthetic feature on Android",
        status: "NEEDS_SETUP",
        required: true,
        revision: 1,
        instructions: ["Open the synthetic course on the phone."],
        expected: "Edit survives an update.",
        testedCommit: null,
        testUrl: null,
        evidencePath: ".evidence/M1/physical-device-review.json",
        updatedAt: "2026-10-12T10:00:00Z",
      },
    ],
  })
  git("init", "--quiet")
  git("config", "user.name", "Synthetic Reviewer")
  git("config", "user.email", "synthetic@example.invalid")
  git("add", ".")
  git("commit", "--quiet", "-m", "Synthetic implementation checkpoint")
  const commit = git("rev-parse", "HEAD")
  const record = () =>
    save(".evidence/M1/verification.json", {
      recorder: RECORDER_ID,
      status: "PASS",
      nodeVersion: "v24.21.0",
      sourceDigest: sourceDigest(root).digest,
      checks: [{ command: "npm run verify", status: "PASS", exitCode: 0 }],
    })
  record()
  save(".evidence/M1/review.json", {
    verdict: "PASS",
    blockers: [],
    importantFindings: [],
    qolFindings: [],
    evidenceInspected: ["Synthetic regression test"],
  })
  const ci = { status: "completed", conclusion: "success" }
  git("remote", "add", "origin", "https://github.com/example/course-helper.git")
  const controller = createMilestoneController(root, {
    ciClient: {
      runs: async (_repo, sha) => [
        {
          id: 1,
          head_sha: sha,
          event: "push",
          path: ".github/workflows/ci.yml",
          updated_at: "2026-10-12T10:00:00Z",
          html_url: "https://github.com/example/course-helper/actions/runs/1",
          ...ci,
        },
      ],
    },
  })
  const current = () =>
    JSON.parse(readFileSync(join(root, ".milestones/manifest.json"), "utf8"))
  const setManifest = (edit) => {
    const value = current()
    edit(value)
    save(".milestones/manifest.json", value)
  }
  const ownerFeedback = (status = "PASSED", testedCommit = commit) => {
    const queue = readOwnerChecks(root)
    Object.assign(queue.items[0], {
      status: "READY",
      testedCommit,
      testUrl: "https://example.test/preview",
      result: {
        reportedBy: "owner",
        source: "Explicit synthetic owner feedback in the test fixture",
        summary:
          status === "PASSED"
            ? "All specified checks passed."
            : "The edit was lost.",
        testedCommit,
        device: "Synthetic Android device",
        browser: "Chrome test version",
        osVersion: "Synthetic OS",
      },
    })
    const result = queue.items[0].result
    delete queue.items[0].result
    writeOwnerChecks(root, queue)
    save(".evidence/M1/owner-input.json", { id: "M1-PHONE", status, result })
    runOwnerChecksCommand(
      ["feedback", "--file", ".evidence/M1/owner-input.json"],
      { root, cwd: root, write: () => {} },
    )
  }
  const sweep = () =>
    save(
      "04_IMPLEMENTATION_PLAN.md",
      "| M1 | Complete. Verified checkpoint and owner check. |\n\n## M2 — Independent work\n**Status:** IN_PROGRESS\n\n## G1 — Release\n**Status:** PENDING\n",
    )
  return {
    root,
    controller,
    current,
    save,
    setManifest,
    record,
    git,
    commit,
    ownerFeedback,
    sweep,
    ci,
  }
}

describe("owner handoff and safe continuation", () => {
  it("keeps phone checks pending while permitting explicitly independent work", async () => {
    const f = fixture()
    await expect(f.controller.start("M2")).rejects.toThrow(
      "Previous milestone M1",
    )
    await f.controller.awaitOwner("M1")
    expect(f.current().milestones[0].status).toBe("AWAITING_OWNER")
    expect(f.current().milestones[0].agentReady.commit).toBe(f.commit)
    await f.controller.start("M2")
    expect(f.current().milestones[1].status).toBe("IN_PROGRESS")
    expect(readOwnerChecks(f.root).items[0].status).toBe("NEEDS_SETUP")
    await expect(f.controller.complete("M1")).rejects.toThrow("owner checks")
  })

  it("refuses a missing agent review rather than stamping readiness", async () => {
    const f = fixture()
    rmSync(join(f.root, ".evidence/M1/review.json"))
    await expect(f.controller.awaitOwner("M1")).rejects.toThrow(
      "missing evidence",
    )
    expect(f.current().milestones[0].status).toBe("IN_PROGRESS")
  })

  it("refuses incomplete, handwritten or stale automated verification", async () => {
    const f = fixture()
    f.save(".evidence/M1/verification.json", {
      status: "PASS",
      checks: [{ status: "PASS" }],
    })
    await expect(f.controller.awaitOwner("M1")).rejects.toThrow("not written")
    f.record()
    f.save("app.mjs", "export const version = 2\n")
    await expect(f.controller.awaitOwner("M1")).rejects.toThrow(
      "source changed",
    )
    f.record()
    await expect(f.controller.awaitOwner("M1")).rejects.toThrow("uncommitted")
  })

  it("requires green CI for both handoff and continued work", async () => {
    const f = fixture()
    f.ci.conclusion = "failure"
    await expect(f.controller.awaitOwner("M1")).rejects.toThrow(
      "needs green push CI",
    )
    f.ci.conclusion = "success"
    await f.controller.awaitOwner("M1")
    f.ci.status = "in_progress"
    f.ci.conclusion = null
    await expect(f.controller.start("M2")).rejects.toThrow(
      "needs green push CI",
    )
  })

  it("refuses a handoff whose commit passed only quick CI (T1 review CQ-4)", async () => {
    const f = fixture()
    f.ci.display_title = "Quick verification · abc"
    await expect(f.controller.awaitOwner("M1")).rejects.toThrow(
      "passed only quick CI",
    )
    f.ci.display_title = "Full verification · abc"
    await f.controller.awaitOwner("M1")
  })

  it("refuses changed review evidence after handoff", async () => {
    const f = fixture()
    await f.controller.awaitOwner("M1")
    f.save(".evidence/M1/review.json", {
      verdict: "PASS",
      blockers: [],
      importantFindings: [],
      qolFindings: [],
      evidenceInspected: ["A different report"],
    })
    await expect(f.controller.start("M2")).rejects.toThrow("evidence changed")
  })

  it("refuses owner-requested fixes and any unapproved continuation", async () => {
    const f = fixture()
    await f.controller.awaitOwner("M1")
    f.setManifest((manifest) => {
      manifest.milestones[1].allowedAwaitingOwnerPredecessors = []
    })
    await expect(f.controller.start("M2")).rejects.toThrow(
      "explicitly permitted prerequisite",
    )
    f.setManifest((manifest) => {
      manifest.milestones[1].allowedAwaitingOwnerPredecessors = [
        { id: "M1", reason: "Independent phone check." },
      ]
    })
    f.ownerFeedback("CHANGES_REQUESTED")
    await expect(f.controller.start("M2")).rejects.toThrow(
      "owner-requested fixes",
    )
  })

  it("never starts an integration gate with pending owner acceptance", async () => {
    const f = fixture()
    await f.controller.awaitOwner("M1")
    f.setManifest((manifest) => {
      manifest.milestones[1].status = "COMPLETE"
    })
    await expect(f.controller.start("G1")).rejects.toThrow(
      "Previous milestone M1",
    )
    f.setManifest((manifest) => {
      manifest.milestones[2].allowedIncompletePredecessors = ["M1"]
    })
    await expect(f.controller.start("G1")).rejects.toThrow(
      "Previous milestone M1",
    )
  })

  it("does not use legacy incomplete exceptions to bypass required owner work", async () => {
    const f = fixture()
    f.setManifest((manifest) => {
      manifest.milestones[1].allowedIncompletePredecessors = ["M1"]
    })
    await expect(f.controller.start("M2")).rejects.toThrow(
      "Previous milestone M1",
    )
  })

  it("refuses bypassing the owner phase through direct completion", async () => {
    const f = fixture()
    f.ownerFeedback()
    await expect(f.controller.complete("M1")).rejects.toThrow(
      "AWAITING_OWNER handoff",
    )
  })

  it("closes the captured checkpoint after later independent code has changed", async () => {
    const f = fixture()
    await f.controller.awaitOwner("M1")
    await f.controller.start("M2")
    f.save("app.mjs", "export const version = 2\n")
    f.git("add", "app.mjs")
    f.git("commit", "--quiet", "-m", "Independent synthetic feature")
    f.ownerFeedback()
    f.sweep()
    await f.controller.complete("M1")
    expect(f.current().milestones[0].status).toBe("COMPLETE")
    expect(f.current().milestones[0].agentReady.commit).toBe(f.commit)
  })

  it("does not accept a device result from another build", async () => {
    const f = fixture()
    await f.controller.awaitOwner("M1")
    f.ownerFeedback("PASSED", "b".repeat(40))
    await expect(f.controller.complete("M1")).rejects.toThrow("owner checks")
  })

  it("refuses contradictory physical evidence even if the queue still says PASS", async () => {
    const f = fixture()
    await f.controller.awaitOwner("M1")
    f.ownerFeedback()
    f.save(".evidence/M1/physical-device-review.json", {
      milestone: "M1",
      ownerReports: [{ id: "M1-PHONE", result: "CHANGES_REQUESTED" }],
    })
    f.sweep()
    await expect(f.controller.complete("M1")).rejects.toThrow(
      "owner evidence disagrees",
    )
  })

  it("refuses later source edits made without starting permitted independent work", async () => {
    const f = fixture()
    await f.controller.awaitOwner("M1")
    f.save("app.mjs", "export const version = 2\n")
    f.git("add", "app.mjs")
    f.git("commit", "--quiet", "-m", "Unallocated synthetic change")
    f.ownerFeedback()
    f.sweep()
    await expect(f.controller.complete("M1")).rejects.toThrow(
      "without recorded permitted later work",
    )
  })

  it("invalidates the checkpoint and prior phone result when fixes resume", async () => {
    const f = fixture()
    await f.controller.awaitOwner("M1")
    f.ownerFeedback("CHANGES_REQUESTED")
    f.controller.resume("M1")
    const milestone = f.current().milestones[0]
    expect(milestone.status).toBe("IN_PROGRESS")
    expect(milestone.agentReady).toBeUndefined()
    const item = readOwnerChecks(f.root).items[0]
    expect(item.status).toBe("NEEDS_SETUP")
    expect(item.testedCommit).toBeNull()
    expect(item.result).toBeUndefined()
    expect(item.history).toHaveLength(1)
    await expect(f.controller.start("M2")).rejects.toThrow(
      "Previous milestone M1",
    )
  })
})
