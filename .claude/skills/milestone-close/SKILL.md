---
name: milestone-close
description: Close a CVC Helper milestone and prepare the documents for the next one — final verification, independent reviews, evidence, the documentation sweep, the plan and manifest, the checkpoint commit. Use when the active milestone's implementation is done, when the owner says to close or wrap up a milestone, and at release gates (with the heavy sweep).
---

# Closing a milestone

`AGENTS.md` §6 is the contract; this is how to carry out its closing steps.
`docs/DOCS_SYSTEM.md` defines the documentation rules the sweep enforces.
Codex follows this file directly.

Work in order. A step that fails sends you back to fix and re-run, not
forward.

## 1. Freeze the change

- `git status` and `git diff`: everything in the tree belongs to this
  milestone, or is explained in the plan's handoff note.
- Re-read the milestone's success predicate and adversarial checklist in
  `04_IMPLEMENTATION_PLAN.md`. Each line needs proof (a test, evidence or a
  screenshot) before you go on.

## 2. Verify, once, on the final source

- Focused specs and unit tests for what changed, then the scripts in the
  milestone's `verificationScripts` (`.milestones/manifest.json`), recorded with
  `npm run evidence -- <ID>`. `verify:e2e:focus` runs the manifest's
  `e2eSpecs`: list the milestone's own specs and the journeys of every area it
  touches. That records the source digest: any later change
  to code (Markdown, evidence and manifest excepted) invalidates it.
- Run reviews **before** the recorded full run, so their fixes do not force a
  second one.
- A failure unrelated to the change: rerun only that spec to classify it. A
  test that fails and then passes is a flake: list it in the evidence and file
  it as a defect; never raise a threshold or a retry count to get green.

## 3. Independent reviews

- Roles come from the milestone (`AGENTS.md` §7–8). Run each as its subagent
  (`.claude/agents/reviewer-*.md`, protocol in `docs/agents/REVIEW_PROTOCOL.md`)
  with the milestone ID, the commit and the diff range.
- Save each JSON report to `.evidence/<ID>/` and add it to the manifest's
  `requiredReviews`. FAIL or any blocker: fix, re-review with a new round
  number. The protocol's entropy draw keeps rounds from repeating each other.
- Write `.evidence/<ID>/self-review.json`: every finding and its disposition.

## 4. Evidence sweep

- `.evidence/<ID>/` holds only what the manifest requires plus what a reviewer
  needs: `verification.json`, reviews, the self-review, selected screenshots,
  known limitations. No bulk, no regenerated screenshots, no private data.
- Delete scratch output the milestone made (`test-results/` is ignored; other
  stray files are not).

## 5. Documentation sweep (light)

1. **Plan.** Move the milestone's section, unchanged, to the end of
   `archive/<cycle>/completed-milestones.md`. Leave one status row of at most
   60 words: the outcome, the evidence directory, known limitations by link.
   Update "Where this cycle stands" and the execution order.
2. **Decisions.** Every owner decision made during the milestone is in the
   contract document it changes (spec, scope, technical decisions, design), in
   the present tense. Remove answered questions from the working documents.
3. **Working documents.** Fold every document whose `Fold at:` is this
   milestone: decisions to the contract, open items to the next working
   document or the plan, the file to `archive/<cycle>/`.
4. **Follow-ups.** Each limitation or idea found during the milestone is
   either scheduled in the plan or added to `docs/working/BACKLOG.md`. Do not
   leave it only in evidence.
5. **Prepare the next milestone.** Its section exists, has a success predicate
   (one sentence that decides pass or fail) and an adversarial checklist (the
   specific ways it could be wrong), and names its category, reviewers and
   verification scripts in the manifest.
6. `npm run check:docs` passes.

At a **release gate**, do the heavy sweep as well: fold every working document
of the cycle, reread every contract document in full and rewrite stale
passages in the present tense, write the `CHANGELOG.md` entry, and archive the
plan as `archive/<version>/04_IMPLEMENTATION_PLAN.md` before the next cycle's
fresh plan replaces it.

## 6. Complete and checkpoint

- `npm run milestone:complete -- <ID>`. It refuses missing evidence, a stale
  or partial `verification.json`, a failed review, a plan that still holds the
  milestone's section or lacks its `| <ID> | Complete. …` row, and a failing
  `check:docs`; fix the cause, never the check.
- `npm run verify:quick`, then one commit: `Complete <ID>: <outcome>`. The
  pre-commit hook checks privacy and frozen files; never bypass it. From this
  commit on the milestone's evidence is frozen, so do not amend it to change
  that evidence: make a new commit.
- Push and deploy only as the plan and the owner allow (Pages deploys `main`
  after CI). CI, not the local run, is the authority for the browser suite
  (`03_TECHNICAL_DECISIONS.md` §6.1): if it fails on the pushed commit, fix it
  in a new commit and record the re-run as a new file,
  `npm run evidence -- <ID> --file verification-ci-fix.json`, since the
  completed `verification.json` only grows.

Report to the owner: what was delivered, what the evidence shows, what
remains theirs to check on a device, and the next milestone.
