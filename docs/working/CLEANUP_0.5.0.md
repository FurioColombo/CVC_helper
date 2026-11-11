# Clean-up of the workflow — deferred items

> Working document · Owner: the owner · Fold at: UG4

The repository and workflow review of 2026-11-11 proposed CL-1 to CL-15. What
touched only Markdown, evidence or milestone metadata is done. This file holds
the accepted rest, which changes code, scripts, CI or a contract the owner
decides, so it waits: B7's recorded verification digest covers every
non-Markdown file. Each item names its files, the change and the review's
evidence. An item leaves when it is scheduled in the plan or dropped.

## After B7's handoff

- **CL-2: macOS CI runs WebKit only.** `.github/workflows/ci.yml`, the 03 §6
  paragraph. The macOS full tier runs `iphone-13-webkit-core` plus the update
  and isolation checks, dropping the three Chromium projects and `verify`,
  which Linux runs. Evidence: run `ddedbd6`, macOS 76 min against Linux 29;
  every macOS-only failure on record is WebKit.
- **CL-4: OWNER_TODO shows what is open.** `scripts/owner-checks.mjs`
  (`renderOwnerTodo`) and its test. Open items first and in full; a PASSED item
  of a COMPLETE milestone becomes one line with its evidence link. Evidence:
  359 lines for 5 open items, 13 of 18 items PASSED, some from 0.4.0.
- **CL-14: dead scripts and stale ignore entries.** Delete
  `scripts/record-roster-paste-robustness.mjs` (no reference),
  `scripts/measure-isolation.mjs` (a V01 one-off), the `verify:e2e:v05` script
  and the `.prettierignore` entries for `CLAUDE.md` and
  `05_POST_MVP_UX_CHANGE_REQUESTS.md`, which do not exist. Git history keeps
  them for the frozen evidence that names them.
- **CL-13: one rule for completed milestones.** `scripts/check-repository.mjs`
  lines 166–255: the hand-kept per-cycle ID lists become one rule, "a COMPLETE
  milestone never changes state", checked against the previous tip as frozen
  files are. Evidence: 24 commits to this script.
- **CL-11: the flake ledger leaves BACKLOG.** `scripts/milestone.mjs` (line 41
  reads BACKLOG), `scripts/e2e-report.mjs`, `docs/working/BACKLOG.md`. The
  flaky-test entries move to a file the controller reads, so BACKLOG keeps
  product and engineering items. Evidence: BACKLOG at 290 of 300 lines,
  changed in 85 commits.
- **CL-10b: the controller writes the status row** (retrospective proposal 7).
  `scripts/milestone.mjs`: `milestone:complete` and `await-owner` write the
  plan's status row from the manifest. Evidence: the plan is touched in 40 of
  0.5.0's 135 commits, and B4, B5 and B7's rows went stale for a day.
- **CL-1b: a milestone's `e2eSpecs` lists only its own specs.**
  `.milestones/manifest.json` and the milestone-close skill; CI's full tier
  covers the predecessors' journeys. When WX1 starts it gets only its own
  specs. Evidence: B4's focus run lists 18 specs; B7 73 min, B6 41, B4 39
  against 41 for the whole suite (T1).
- **CL-1c: no re-recording for a Markdown edit.** `scripts/record-verification.mjs`
  or the publisher: the recorder refuses to start on a dirty tree, or the
  publisher accepts a tree dirty only in digest-excluded paths. Evidence:
  `5157e09` re-ran 40 min because an uncommitted BACKLOG edit made the
  publisher refuse.
- **Retrospective proposal 2: `npm run evidence` exits early** on an already
  passed digest (`archive/v0.4.0/RETRO_0X.md`, friction 5).
- **CL-9: one verification per test build** (lower priority).
  `scripts/milestone.mjs`, `docs/OWNER_WORKFLOW.md`: milestones shipped in one
  test build share one evidence run on that commit. Needs controller
  self-tests. Evidence: B5 and B6 resumed and re-verified separately on 0.5.3
  (`94c753f`, `2ac2434`, `3bdd415`).

## For the owner

- **CL-1a: browser evidence from CI** (retrospective proposal 1).
  `scripts/record-verification.mjs`, `03_TECHNICAL_DECISIONS.md` §6, the skill:
  `evidence -- <ID> --from-ci` records the green `[full-ci]` run of the exact
  commit, the local run as fallback. It changes 03 §6's ladder and needs CI,
  so it waits for the billing fix and the owner's yes. Evidence: each recording
  is followed by a 45–76 min `[full-ci]` run that the skill already treats as
  the authority.

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
