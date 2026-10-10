# Review protocol

Every independent reviewer follows this file; its persona file in
`.claude/agents/reviewer-*.md` adds a character and a list of attack lenses.
Claude Code runs a persona as a subagent. Codex gives the persona file and this
protocol to the agent it delegates the review to. `AGENTS.md` §8 decides which
roles a milestone needs.

## Stance

You did not write this change. Assume it is wrong until evidence says
otherwise: your job is to falsify it, not to approve it. A review that finds
nothing must show where it looked. Your persona shapes how you hunt; it never
softens the verdict or decorates the report.

## Inputs

The brief names the milestone ID, the commit or diff range and anything the
orchestrator wants covered. Read, in this order: the milestone's section and
success predicate in `04_IMPLEMENTATION_PLAN.md`, the sections of
`01_PRODUCT_SPEC.md`, `02_MVP_SCOPE.md` and `03_TECHNICAL_DECISIONS.md` it
touches, the diff, and earlier review reports for the same milestone in
`.evidence/<ID>/`.

## Rules

- **Read-only.** Do not edit tracked files or commit. Scratch work goes to the
  OS temporary directory or `test-results/`. You may run any test, script or
  Playwright spec, and write a throwaway spec there to prove a finding.
- **Node 24** through the Bash tool (`docs/LOCAL_DEVELOPMENT.md`).
- **Privacy.** Synthetic data only. Never open `data/private/` unless the brief
  asks for an aggregate measurement, and never quote a real name, phone number
  or raw OCR text, not even in a finding. An example phone number in a report
  is one of the fixtures' (333 123 4567, 333 987 6543, 320 555 0142): the
  pre-commit hook refuses any other in evidence.
- **Reproduction or it did not happen.** A finding needs a failing test,
  command output, `file:line` or a browser step list with expected and observed
  results. Without one it is at most a QoL note.
- **Blocker:** a reproduced violation of the spec, the milestone's acceptance,
  privacy or data integrity. Any blocker means FAIL.

## Entropy

Reviews of the same milestone must not keep walking the same path; F1 needed
twelve rounds partly because rounds overlapped. Before you start:

1. Collect `anglesTried` from earlier reports for this milestone and role.
2. Draw a seed: `node -e "console.log(Math.floor(Math.random() * 1e9))"`.
   With N lenses in your persona file, lens A is `seed mod N` and lens B is
   `floor(seed / N) mod N`. If a draw repeats the other lens or one already
   tried for this milestone, take the next untried lens in the list.
3. Invent one **wildcard**: an attack specific to this diff that is on no
   list.
4. Spend about 60% of your effort on the two lenses and the wildcard and 40%
   on the milestone's success predicate and adversarial checklist.

## Report

Your final message is one JSON object and nothing else. The orchestrator saves
it as `.evidence/<ID>/<role>-review.json` (or `-round-<n>`);
`npm run milestone:complete` rejects a FAIL, a blocker, or a report without the
verdict, the blocker and finding lists or the evidence inspected; the other
fields are this protocol's and reviewers keep them.

```json
{
  "reviewerRole": "data-integrity",
  "persona": "L'Archivista",
  "milestone": "<ID>",
  "commit": "<sha reviewed>",
  "verdict": "PASS | PASS_WITH_FINDINGS | FAIL",
  "blockers": [
    {
      "id": "DI-1",
      "title": "...",
      "evidence": "file:line, test or command output",
      "reproduction": "steps or test name",
      "specRef": "01_PRODUCT_SPEC.md §10"
    }
  ],
  "importantFindings": [],
  "qolFindings": [],
  "evidenceInspected": ["what you read, ran and looked at"],
  "anglesTried": { "seed": 0, "lenses": ["...", "..."], "wildcard": "..." },
  "notTested": ["what you could not check, and why"]
}
```

Findings use the blocker shape. Write the report in plain, factual English.
