---
name: milestone-close
description: Close a CVC Helper milestone and prepare the documents for the next one — final verification, independent reviews, evidence, the documentation sweep, the plan and manifest, the checkpoint commit. Use when the active milestone's implementation is done, when the owner says to close or wrap up a milestone, and at release gates (with the heavy sweep).
---

# Closing a milestone

`AGENTS.md` §6 is the contract; this is how to carry out its closing steps.
`docs/DOCS_SYSTEM.md` defines the documentation rules the sweep enforces.
Codex follows this file directly.

Agent checks run in order; a failure sends you back to fix and re-run.
Pending owner acceptance follows `docs/OWNER_WORKFLOW.md`: AWAITING_OWNER
keeps the milestone open while explicitly eligible work continues.

## 1. Freeze the change

- `git status` and `git diff`: everything in the tree belongs to this
  milestone, or is explained in the plan's handoff note.
- Re-read the milestone's success predicate and adversarial checklist in
  `04_IMPLEMENTATION_PLAN.md`. Each line needs proof (a test, evidence or a
  screenshot) before you go on.
- For visible work, prepare a required request in `docs/OWNER_TODO.md` and
  configure its `ownerEvidence` in the manifest. A missing device result is
  allowed only in the owner-handoff path below.

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
  number. Follow the protocol's review-round limit: from round 2 keep the same
  reviewer and re-check blockers and fixes; a third FAIL goes to the owner.
- Write `.evidence/<ID>/self-review.json`: every finding and its disposition.

## 4. Owner handoff, when acceptance needs the owner

- Prepare the check alongside implementation with `owner:add` or `owner:update`
  and a JSON input file; never edit the generated list. Separate setup needs
  from a READY test. Announce each new or materially changed action in this
  chat with its instructions and a link to `docs/OWNER_TODO.md`.
- When agent evidence and reviews pass, commit the implementation and obtain
  green full push CI for that exact commit (its message says `[full-ci]`). Prepare the address, build, expected
  results and focused phone steps, with useful narrow-screen/text-size captures.
  Publish a preview only when authorised. Never manufacture owner PASS or an
  empty physical report to satisfy missing evidence.
- While owner acceptance waits, `npm run milestone:await-owner -- <ID>` captures
  the verified checkpoint. Keep its plan section open as AWAITING_OWNER, update
  the plan's handoff and commit the metadata. Stop the closure sweep here;
  continue only work explicitly permitted by the manifest and plan, with intact
  evidence and green CI. Report pending owner items instead of stopping all work.
- Record explicit feedback with `owner:feedback`. Before fixing or editing the
  pending milestone, `milestone:resume` invalidates the previous owner check
  and readiness proof. Fix, review and verify the new source, then hand over a
  new build. Pause affected dependents, not independent planned work.
- With matching owner PASS, finish the sweeps and COMPLETE below. Ordinary
  closure uses the captured checkpoint; release gates still verify the current
  final source. Completed device evidence remains frozen.

## 5. Evidence sweep

- `.evidence/<ID>/` holds only what the manifest requires plus what a reviewer
  needs: `verification.json`, reviews, the self-review, selected screenshots,
  known limitations. No bulk, no regenerated screenshots, no private data.
- Delete scratch output the milestone made (`test-results/` is ignored; other
  stray files are not).

## 6. Documentation sweep (light)

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

## 7. Complete and checkpoint

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
- After an authorised push, run `npm run ci:status -- --wait` on the checkpoint.
  Only a green full push run of that exact commit permits dependent work;
  the checkpoint commit's message says `[full-ci]` so push CI runs the full
  tier. The
  AWAITING_OWNER path uses `docs/OWNER_WORKFLOW.md`'s explicit permissions. A
  failed run needs a fix and a new checkpoint; pending, missing, timed-out or
  unavailable CI is not a PASS. If pushing is not authorised, report that this
  gate remains pending; continue only independent eligible work. This adds no push
  or deployment authorisation. Status covers committed HEAD, not dirty edits.

Report to the owner: what was delivered, what the evidence shows, what
is on `docs/OWNER_TODO.md`, what can continue and what actually waits for them.
