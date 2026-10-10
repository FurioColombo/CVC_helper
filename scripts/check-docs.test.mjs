import { describe, expect, it } from "vitest"

import {
  approvedFrozenEdits,
  classify,
  frozenProblems,
  newlyApproved,
} from "./check-docs.mjs"

describe("classify", () => {
  it.each([
    ["AGENTS.md", "contract"],
    ["04_IMPLEMENTATION_PLAN.md", "contract"],
    ["docs/DEVICE_CHECKS.md", "contract"],
    ["docs/design/06_DESIGN_RULEBOOK.md", "contract"],
    // The page changelog holds each page's current state, edited in place.
    ["docs/design/07_PAGE_CHANGELOG.md", "contract"],
    [".claude/agents/reviewer-scope.md", "contract"],
    ["docs/working/BACKLOG.md", "working"],
    ["CHANGELOG.md", "ledger"],
    [".evidence/F4/notes.md", "ledger"],
    [".evidence/F4/screenshot.png", "ledger"],
    ["archive/v0.3.0/0_3_0_QUESTIONS.md", "archive"],
    ["archive/v0.3.0/brief-0.3.0/first-marks-reference.png", "archive"],
    [".claude/skills/powersync/SKILL.md", "vendored"],
    ["docs/post-mvp/NOTES.md", null],
    ["src/NOTES.md", null],
  ])("%s is %s", (path, docClass) => {
    expect(classify(path)).toBe(docClass)
  })
})

describe("frozenProblems", () => {
  const completed = new Set(["F4"])
  const none = new Set()

  it("refuses edits and deletions in the archive, the changelog and completed evidence", () => {
    const problems = frozenProblems(
      [
        "1\t2\tarchive/v0.3.0/0_3_0_QUESTIONS.md",
        "0\t40\tarchive/v0.1.0/README.md",
        "-\t-\tarchive/v0.3.0/brief-0.3.0/first-marks-reference.png",
        "3\t1\tCHANGELOG.md",
        "5\t5\t.evidence/F4/verification.json",
      ],
      completed,
      none,
    )
    expect(problems).toHaveLength(5)
  })

  it("allows lines only added, open milestones' evidence, the page changelog and approved edits", () => {
    expect(
      frozenProblems(
        [
          "12\t0\tCHANGELOG.md",
          "5\t5\t.evidence/D1/verification.json",
          "1\t3\tarchive/v0.3.0/0_3_0_QUESTIONS.md",
          "4\t4\tdocs/design/07_PAGE_CHANGELOG.md",
        ],
        completed,
        new Set(["archive/v0.3.0/0_3_0_QUESTIONS.md"]),
      ),
    ).toEqual([])
  })
})

describe("approvedFrozenEdits", () => {
  const index = [
    "# Archive",
    "| `v0.3.0/` | the plan |",
    "## The one exception",
    "A frozen file such as `CHANGELOG.md` is edited only when listed below.",
    "- 2026-11-02: removed a name from `archive/v0.3.0/0_3_0_QUESTIONS.md` (owner approval).",
    "- 2026-11-03: removed a phone number from `CHANGELOG.md` (owner approval).",
    "## Later section",
    "- `archive/v0.1.0/README.md` is not an approval.",
  ].join("\n")

  it("reads the dated entries of the exception section only", () => {
    expect([...approvedFrozenEdits(index)]).toEqual([
      "archive/v0.3.0/0_3_0_QUESTIONS.md",
      "CHANGELOG.md",
    ])
  })

  it("counts an approval once: an entry already present at the base approves nothing more", () => {
    const atBase = [
      "## The one exception",
      "- 2026-11-02: removed a name from `archive/v0.3.0/0_3_0_QUESTIONS.md` (owner approval).",
    ].join("\n")
    expect([...newlyApproved(index, atBase)]).toEqual(["CHANGELOG.md"])
  })
})
