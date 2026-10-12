import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  invalidateOwnerItems,
  ownerCompletionProblems,
  ownerItemsFor,
  readOwnerChecks,
  renderOwnerTodo,
  runOwnerChecksCommand,
  validateOwnerChecks,
  writeOwnerChecks,
} from "./owner-checks.mjs"

const sha = "a".repeat(40)
const now = "2026-10-12T08:00:00.000Z"
const manifest = {
  milestones: [{ id: "D3", status: "IN_PROGRESS" }, { id: "UG3" }],
}

function deviceItem(overrides = {}) {
  return {
    id: "D3-PHONE-UPDATE",
    milestone: "D3",
    kind: "DEVICE_CHECK",
    title: "Check app update on Android",
    status: "READY",
    required: true,
    revision: 1,
    instructions: ["Install version N and test version N+1."],
    expected: "The update appears without reinstalling and preserves edits.",
    testedCommit: sha,
    testUrl: "https://preview.example.test/cvc/",
    evidencePath: ".evidence/D3/physical-device-review.json",
    updatedAt: now,
    ...overrides,
  }
}

function ownerResult(overrides = {}) {
  return {
    reportedBy: "owner",
    source: "Owner phone run 2026-10-12, report 1",
    summary: "The update appeared and kept the unsaved edit.",
    testedCommit: sha,
    device: "Pixel 8",
    browser: "Chrome 140",
    osVersion: "Android 16",
    ...overrides,
  }
}

function queue(item = deviceItem()) {
  return { schemaVersion: 1, items: [item] }
}

const tempRoots = []
function tempRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), "owner-checks-"))
  tempRoots.push(root)
  mkdirSync(path.join(root, ".milestones"), { recursive: true })
  mkdirSync(path.join(root, "docs"), { recursive: true })
  writeFileSync(
    path.join(root, ".milestones/manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  return root
}

function writeInput(root, name, value) {
  const file = path.join(root, name)
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
  return file
}

function command(root, args) {
  const output = []
  runOwnerChecksCommand(args, {
    root,
    cwd: root,
    write: (line) => output.push(line),
  })
  return output.join("\n")
}

afterEach(() => {
  for (const root of tempRoots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe("validateOwnerChecks", () => {
  it("restricts reports to the declared owner evidence, never agent verification", () => {
    const contract = {
      milestones: [
        {
          id: "D3",
          ownerEvidence: [".evidence/D3/physical-device-review.json"],
        },
      ],
    }
    expect(
      validateOwnerChecks(
        queue(deviceItem({ evidencePath: ".evidence/D3/verification.json" })),
        contract,
      ).some((problem) => problem.includes("declared")),
    ).toBe(true)
  })
  it("accepts an actual owner phone check using synthetic course data", () => {
    expect(
      validateOwnerChecks(
        queue(
          deviceItem({
            status: "PASSED",
            result: ownerResult({
              summary:
                "Tested the synthetic roster fixture on my phone; all update steps passed.",
            }),
          }),
        ),
        manifest,
      ),
    ).toEqual([])
  })
  it("accepts a READY device check without comparing it to current HEAD", () => {
    expect(validateOwnerChecks(queue(), manifest)).toEqual([])
  })

  it("reports malformed queues, unknown milestones and duplicate IDs", () => {
    expect(
      validateOwnerChecks({ schemaVersion: 2, items: "no" }, manifest),
    ).toEqual([
      "Owner checks schemaVersion must be 1",
      "Owner checks items must be an array",
    ])
    expect(
      validateOwnerChecks(
        { schemaVersion: 1, items: [], unexpected: true },
        manifest,
      ),
    ).toContain("Owner checks has unknown field(s): unexpected")
    const duplicate = queue()
    duplicate.items.push({ ...deviceItem(), milestone: "missing" })
    const problems = validateOwnerChecks(duplicate, manifest)
    expect(problems).toContain("Duplicate owner check ID: D3-PHONE-UPDATE")
    expect(problems).toContain(
      "Item D3-PHONE-UPDATE names unknown milestone missing",
    )
  })

  it("requires a usable URL, a full build and a safe evidence path for READY", () => {
    const problems = validateOwnerChecks(
      queue(
        deviceItem({
          testedCommit: null,
          testUrl: "javascript:alert(1)",
          evidencePath: "../private/report.json",
        }),
      ),
      manifest,
    )
    expect(problems).toContain(
      "Item D3-PHONE-UPDATE in READY needs a full testedCommit",
    )
    expect(problems).toContain(
      "Item D3-PHONE-UPDATE in READY needs a usable testUrl",
    )
    expect(problems).toContain(
      "Item D3-PHONE-UPDATE.evidencePath must be a safe repository-relative path or null",
    )
    expect(problems).toContain(
      "Item D3-PHONE-UPDATE in READY needs a safe evidencePath",
    )
  })

  it("does not accept an inferred, agent-reported, or simulated device PASS", () => {
    const missing = validateOwnerChecks(
      queue(deviceItem({ status: "PASSED" })),
      manifest,
    )
    expect(missing).toContain(
      "Item D3-PHONE-UPDATE needs an explicit owner result in PASSED",
    )

    const agentResult = validateOwnerChecks(
      queue(
        deviceItem({
          status: "PASSED",
          result: ownerResult({ reportedBy: "agent" }),
        }),
      ),
      manifest,
    )
    expect(agentResult).toContain(
      'Item D3-PHONE-UPDATE result.reportedBy must be "owner"',
    )

    for (const result of [
      ownerResult({ device: "Android emulator" }),
      ownerResult({ summary: "Simulated PASS on fixture" }),
    ]) {
      const problems = validateOwnerChecks(
        queue(deviceItem({ status: "PASSED", result })),
        manifest,
      )
      expect(
        problems.some((problem) => problem.includes("physical-device PASS")),
      ).toBe(true)
    }
  })

  it("rejects a passed device result recorded against a different build", () => {
    const problems = validateOwnerChecks(
      queue(
        deviceItem({
          status: "PASSED",
          result: ownerResult({ testedCommit: "b".repeat(40) }),
        }),
      ),
      manifest,
    )
    expect(problems).toContain(
      "Item D3-PHONE-UPDATE result.testedCommit must match the item's testedCommit",
    )
  })

  it("accepts negative owner feedback without turning it into a pass", () => {
    expect(
      validateOwnerChecks(
        queue(
          deviceItem({
            status: "CHANGES_REQUESTED",
            result: ownerResult({ summary: "The unsaved edit was lost." }),
          }),
        ),
        manifest,
      ),
    ).toEqual([])
  })
})

describe("physical report path containment", () => {
  it("does not create an unfinishable owner check on a completed milestone", () => {
    const root = tempRoot()
    writeOwnerChecks(root, { schemaVersion: 1, items: [] })
    writeFileSync(
      path.join(root, ".milestones/manifest.json"),
      JSON.stringify({ milestones: [{ id: "D3", status: "COMPLETE" }] }),
    )
    const input = writeInput(root, "request.json", deviceItem())
    expect(() => command(root, ["add", "--file", input])).toThrow(
      "completed milestone",
    )
    expect(readOwnerChecks(root).items).toHaveLength(0)
  })
  it("refuses a junction or symlink that would write the report outside the repository", () => {
    const root = tempRoot()
    const outside = mkdtempSync(
      path.join(os.tmpdir(), "owner-outside-evidence-"),
    )
    tempRoots.push(outside)
    writeOwnerChecks(root, queue())
    mkdirSync(path.join(root, ".evidence"))
    symlinkSync(
      outside,
      path.join(root, ".evidence/D3"),
      process.platform === "win32" ? "junction" : "dir",
    )
    const input = writeInput(root, "feedback.json", {
      id: "D3-PHONE-UPDATE",
      status: "PASSED",
      result: ownerResult(),
    })
    expect(() => command(root, ["feedback", "--file", input])).toThrow(
      "symbolic link or junction",
    )
    expect(readOwnerChecks(root).items[0].status).toBe("READY")
    expect(() =>
      readFileSync(path.join(outside, "physical-device-review.json")),
    ).toThrow()
  })
})

describe("owner checklist and completion helpers", () => {
  it("renders the pending D3 setup as actionable while saying the test build is not ready", () => {
    const pending = queue(
      deviceItem({
        status: "NEEDS_SETUP",
        testedCommit: null,
        testUrl: null,
        instructions: [
          "Choose USB/adb reverse, HTTPS preview, or authorized main deployments.",
          "Agents finish reviews and verification before the phone test is READY.",
          "Then follow docs/DEVICE_CHECKS.md Updates and versions.",
        ],
      }),
    )
    const markdown = renderOwnerTodo(pending)
    expect(markdown).toContain("No phone-test build is ready")
    expect(markdown).toContain(
      "Preparing setup does not mark that work verified",
    )
    expect(markdown).toContain("Updates and versions")
    expect(markdown).toContain("Completion of D3 and the release gate wait")
    expect(markdown).toContain("explicit dependency permissions")
  })

  it("finds required items and rejects incomplete or stale checkpoints", () => {
    const pending = queue(deviceItem({ status: "NEEDS_SETUP" }))
    expect(ownerItemsFor(pending, "D3")).toHaveLength(1)
    expect(ownerCompletionProblems(pending, "D3", sha)).toEqual([
      "D3-PHONE-UPDATE is required and has status NEEDS_SETUP",
    ])
    const passed = queue(
      deviceItem({ status: "PASSED", result: ownerResult() }),
    )
    expect(ownerCompletionProblems(passed, "D3", "b".repeat(40))).toEqual([
      `D3-PHONE-UPDATE was tested on ${sha}, not checkpoint ${"b".repeat(40)}`,
    ])
    expect(
      ownerCompletionProblems({ schemaVersion: 1, items: [] }, "D3", sha),
    ).toEqual(["No required owner check is configured for D3"])
  })

  it("invalidates required results into history and prevents reusing a phone PASS", () => {
    const passed = queue(
      deviceItem({ status: "PASSED", result: ownerResult(), revision: 4 }),
    )
    const invalidated = invalidateOwnerItems(passed, "D3")
    expect(invalidated.items[0].status).toBe("NEEDS_SETUP")
    expect(invalidated.items[0].testedCommit).toBeNull()
    expect(invalidated.items[0].testUrl).toBeNull()
    expect(invalidated.items[0].result).toBeUndefined()
    expect(invalidated.items[0].history[0].result).toEqual(ownerResult())
    expect(invalidated.items[0].revision).toBe(5)
    expect(validateOwnerChecks(invalidated, manifest)).toEqual([])
    expect(passed.items[0].status).toBe("PASSED")
  })
})

describe("owner-checks command operations", () => {
  it("adds and updates queue items, emits owner-action notices, and keeps projection fresh", () => {
    const root = tempRoot()
    const initial = queue(
      deviceItem({ status: "NEEDS_SETUP", testedCommit: null, testUrl: null }),
    )
    writeOwnerChecks(root, initial)
    const added = {
      ...deviceItem({
        id: "D3-SECOND-CHECK",
        status: "NEEDS_SETUP",
        testedCommit: null,
        testUrl: null,
      }),
      revision: 77,
    }
    const addFile = writeInput(root, "add.json", added)
    expect(command(root, ["add", "--file", addFile])).toContain(
      "OWNER ACTION ADDED: Check app update on Android — [Owner todo](docs/OWNER_TODO.md#d3-second-check)",
    )
    expect(readOwnerChecks(root).items[1].revision).toBe(1)

    const edited = {
      ...readOwnerChecks(root).items[1],
      title: "Updated owner check",
    }
    const updateFile = writeInput(root, "update.json", edited)
    expect(command(root, ["update", "--file", updateFile])).toContain(
      "OWNER ACTION UPDATED: Updated owner check",
    )
    expect(readOwnerChecks(root).items[1].revision).toBe(2)
    expect(command(root, ["check"])).toContain("OWNER_TODO.md is current")
    const todo = readFileSync(path.join(root, "docs/OWNER_TODO.md"), "utf8")
    expect(todo).toContain("Updated owner check")
  })

  it("records explicit feedback, writes a physical report, and detects a stale projection", () => {
    const root = tempRoot()
    writeOwnerChecks(root, queue())
    const feedbackFile = writeInput(root, "feedback.json", {
      id: "D3-PHONE-UPDATE",
      status: "PASSED",
      result: ownerResult(),
    })
    expect(command(root, ["feedback", "--file", feedbackFile])).toContain(
      "OWNER ACTION UPDATED: Check app update on Android",
    )
    const report = JSON.parse(
      readFileSync(
        path.join(root, ".evidence/D3/physical-device-review.json"),
        "utf8",
      ),
    )
    expect(report.ownerReports).toHaveLength(1)
    expect(report.ownerReports[0].reportedBy).toBe("owner")
    expect(report.ownerReports[0].result).toBe("PASSED")
    expect(readOwnerChecks(root).items[0].status).toBe("PASSED")
    expect(command(root, ["check"])).toContain("is current")

    writeFileSync(path.join(root, "docs/OWNER_TODO.md"), "stale\n")
    expect(() => command(root, ["check"])).toThrow(
      "docs/OWNER_TODO.md is out of date",
    )
  })

  it("preserves existing physical reports and refuses completed-milestone evidence edits", () => {
    const root = tempRoot()
    const current = queue()
    writeOwnerChecks(root, current)
    mkdirSync(path.join(root, ".evidence/D3"), { recursive: true })
    writeFileSync(
      path.join(root, ".evidence/D3/physical-device-review.json"),
      `${JSON.stringify({ milestone: "D3", observations: [{ check: "Earlier check" }] })}\n`,
    )
    const feedbackFile = writeInput(root, "feedback.json", {
      id: "D3-PHONE-UPDATE",
      status: "CHANGES_REQUESTED",
      result: ownerResult({ summary: "The offer did not appear." }),
    })
    command(root, ["feedback", "--file", feedbackFile])
    const report = JSON.parse(
      readFileSync(
        path.join(root, ".evidence/D3/physical-device-review.json"),
        "utf8",
      ),
    )
    expect(report.observations).toEqual([{ check: "Earlier check" }])
    expect(report.ownerReports).toHaveLength(1)
    expect(report.ownerReports[0].result).toBe("CHANGES_REQUESTED")

    const editedManifest = { milestones: [{ id: "D3", status: "COMPLETE" }] }
    writeFileSync(
      path.join(root, ".milestones/manifest.json"),
      `${JSON.stringify(editedManifest)}\n`,
    )
    expect(() => command(root, ["feedback", "--file", feedbackFile])).toThrow(
      "Cannot change owner evidence for completed milestone D3",
    )
  })

  it("fails clearly for missing input, duplicate additions, unknown IDs and passed-result edits", () => {
    const root = tempRoot()
    writeOwnerChecks(root, queue())
    expect(() => command(root, ["add"])).toThrow("Expected --file <json file>")
    const duplicate = writeInput(root, "duplicate.json", deviceItem())
    expect(() => command(root, ["add", "--file", duplicate])).toThrow(
      "Owner check already exists: D3-PHONE-UPDATE",
    )
    const unknown = writeInput(root, "unknown.json", {
      id: "missing",
      status: "PASSED",
      result: ownerResult(),
    })
    expect(() => command(root, ["feedback", "--file", unknown])).toThrow(
      "Unknown owner check ID: missing",
    )

    const passed = queue(
      deviceItem({ status: "PASSED", result: ownerResult() }),
    )
    writeOwnerChecks(root, passed)
    const edit = writeInput(root, "edit.json", {
      ...passed.items[0],
      result: ownerResult({ summary: "Changed without owner feedback" }),
    })
    expect(() => command(root, ["update", "--file", edit])).toThrow(
      "A passed owner result cannot be changed silently; use feedback",
    )
  })
})
