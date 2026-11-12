# Clean-up of the workflow — deferred items

> Working document · Owner: the owner · Fold at: UG4

The repository and workflow review of 2026-11-11 proposed CL-1 to CL-15. What
touched only Markdown, evidence or milestone metadata is done. This file holds
the accepted rest, which changes code, scripts, CI or a contract the owner
decides, so it waits: B7's recorded verification digest covers every
non-Markdown file. Each item names its files, the change and the review's
evidence. An item leaves when it is scheduled in the plan or dropped.

## After B7's handoff

- **CL-9: one verification per test build** (lower priority).
  `scripts/milestone.mjs`, `docs/OWNER_WORKFLOW.md`: milestones shipped in one
  test build share one evidence run on that commit. Needs controller
  self-tests. Evidence: B5 and B6 resumed and re-verified separately on 0.5.3
  (`94c753f`, `2ac2434`, `3bdd415`).

## UG4

- **CL-8: 0.5.0's visible behaviour needs a home in `01` and `07`.** Sign-in,
  Esci, refused changes, the restore question, the two-course choice and Vento
  live in 03 "Online backup" and in plan sections archived at closure; 07 has
  only B7's mock link. `01` is at 699 of 700 lines: raise its budget in
  `scripts/check-docs.mjs`, or move §3.6 Scan (69 lines) to its own contract.
  Recommended: the move.

## Rejected

- CL-15, a fallback when CI is unavailable: the billing fix is the fix.
- Adding the Vento exception to the plan's "Nothing connects before sign-in"
  now: decision 25 changes the rule together with WX1's code.
