# 0.4.0 completed milestone sections

Each completed milestone's section, moved here unchanged at its close
(`docs/DOCS_SYSTEM.md` rule 4). The plan keeps its status row.

## H1 — Harness and documentation reset

**Category:** FOUNDATION
**Status:** IN_PROGRESS

1. Merge `claude/harness-0.4-prep`. `npm install` activates the Git hooks; the
   owner adds the PowerSync documentation server to Codex's configuration.
2. Run the retrospective with `docs/agents/RETROSPECTIVE_PROMPT.md` in a
   separate session; adopt the changes the owner picks from its report.
3. Move the documents into the `docs/DOCS_SYSTEM.md` layout:
   - `docs/post-mvp/06`, `07` and `mockups/` go to `docs/design/`;
   - `UG1_DEVICE_VALIDATION.md` becomes the contract `docs/DEVICE_CHECKS.md`;
   - the 0.3.0 working documents are folded, open items going to
     `docs/working/BACKLOG.md`, and archived under `archive/v0.3.0/`;
   - `AGENTS.md` is trimmed to 300 lines, each removed rule given a home;
   - `02_MVP_SCOPE.md` is rewritten in the present tense;
   - every path in scripts, tests and documents is updated, and `check:docs`
     runs in `verify:domain` and before `milestone:complete`.
4. Make the checks faster, measuring before and after on an idle machine:
   - unit tests in a Node environment by default, the browser environment only
     for component tests;
   - the `iphone-13-viewport` project limited to layout-sensitive specs;
   - Playwright with two workers if three runs show no new flake;
   - CI on `push` only (the deploy waits for it), superseded runs cancelled,
     and browser tests skipped for documentation-only commits;
   - a flaky test listed in evidence and the backlog as a defect;
   - the new verification ladder written into `03_TECHNICAL_DECISIONS.md` §6:
     an ordinary close runs `verify` plus the affected browser specs,
     `verify:all` runs at gates and in CI.
5. Review npm 11's install-script allowlist (esbuild, onnxruntime-node,
   protobufjs, tesseract.js) so `npm ci` is clean locally and in CI.

**Success predicate:** on the merged branch `check:docs` passes inside
`verify:domain`, `verify:all` passes with no test lost except duplicates named
in the timing evidence, and local unit and browser test times each fall by at
least 30% against the recorded baseline.

**Adversarial checklist:** a spec that ends up in no project; a geometry check
moved off a viewport it needed; a moved document breaks a path used by a script
or test; a hook that blocks a legitimate commit, or passes on Windows when it
should fail; the Pages deploy no longer waiting for CI on `main`; a rule lost in
the `AGENTS.md` trim; tests that pass in the Node environment only because their
DOM assertions no longer run.

**Evidence:** `verification.json` (`verify:all`), `test-timing.json` (before and
after), `docs-move.json` (old path → new home), `retro-adoption.json` (the
owner's picks from the retrospective), self-review, scope and code-quality
reviews.

## D1 — Record metadata and course ownership

**Category:** FOUNDATION
**Status:** IN_PROGRESS

1. An ordered, idempotent migration runner, its ledger in the `meta` table that
   every schema declares, that records each step and runs before the first
   read, after repairs that run on every open. A migration interrupted by
   closing the app, turning the screen off or killing the tab completes on the
   next open, and nothing is applied twice.
2. `createdAt` and `updatedAt` (UTC ISO) on every table, set by one write helper
   on every insert and update path. Existing rows are backfilled; faults keep
   their own.
3. `courseId` on faults, crew members and evaluations, backfilled through their
   parents and set on every new write; the invariant checker requires every
   child to share its parent's course.
4. Decide, with the PowerSync documentation, whether deletion markers or
   per-record versions are needed: PowerSync uploads deletes as operations.
   Record the decision and its reason in `03_TECHNICAL_DECISIONS.md` §3, and
   build only what 0.5–0.7 need.
5. An anonymous 0.3.0 fixture beside the 0.1 and 0.2 ones; all three open
   through the production boundary.

**Success predicate:** opening any of the three fixtures, including after an
interruption at any migration step, yields the same records, references,
values and counts as before plus complete metadata. Every course-scoped row
carries its course's id, and `createdAt ≤ updatedAt` holds on every row after
every write path.

**Adversarial checklist:** an `INSERT` or `UPDATE` that bypasses the helper; a
child backfilled before its parent; a step applied twice after an interruption;
local time instead of UTC, or a clock that goes backwards; erasing the course
leaves the ledger stale; the invariant checker rejecting a valid old fixture;
migration time on a 40-student course.

**Evidence:** verification (`verify` and focused browser specs),
`migration-evidence.json` (fixture counts before and after, interruption runs),
data-integrity review, self-review.

## D2 — Duty settings as rows

**Category:** RULE_HEAVY
**Status:** IN_PROGRESS

The five JSON lists in `dutySettings` become rows of one table: one row per
item, its kind from canonical configuration (fewer day, extra day, stay over,
completed day, acknowledged warning), with D1's metadata, written item by item
beside the lists. While 0.3.0 can still open the database the app keeps reading
the lists, and a repair keeps the rows identical to them (03 §3, the expand
step of §3.1). Duty settings normalisation moves into the domain (UG2-CQ-6).
Behaviour does not change.

**Success predicate:** every duty behaviour, the deterministic full week and the
duty browser journeys give identical results before and after. Every list item
is one row, and every fixture's lists migrate with no item lost or duplicated.

**Adversarial checklist:** duplicates or corrupt JSON in old rows; an order the
old lists implied; completed-day history lost; acknowledged-warning keys in an
old format; erasing the course leaves rows behind; a toggle written twice; a
0.3.0 app opening the database, which drops the new table and writes only the
JSON lists (03 §3.1).

**Evidence:** verification, full-week result, migration evidence,
domain-prosecutor and data-integrity reviews, self-review.
