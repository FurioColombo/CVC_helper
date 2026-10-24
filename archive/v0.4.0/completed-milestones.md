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

## D3 — Versions and reliable updates

**Category:** RULE_HEAVY
**Status:** AWAITING_OWNER

1. **Compatibility contract** (`03_TECHNICAL_DECISIONS.md` §3.1), the rules the
   server will enforce from 0.5.0:
   - the data records its version in `meta`, which every schema declares;
   - schema changes only expand, and a removal or rename takes two releases;
   - an app reads and writes data of its own and the previous minor version;
   - an app older than the data's minimum writer version opens read-only and
     says `Aggiorna l'app`.

   One domain function with table-driven tests over version pairs implements
   the contract.
2. **Updates reach installed apps.** Look for a new version when the app returns
   to the foreground and periodically while it is open, which today happens
   only at start. The banner never covers a floating bar or the add button
   (UG2-UX-3). Impostazioni shows the installed version and `Cerca
   aggiornamenti`, and a short note confirms the update afterwards. The leave
   guard stays.
3. **A browser journey:** serve build N, deploy build N+1, bring the app to the
   foreground, see the offer, update without losing unsaved work.
4. **Permanent test site:** publish the isolated test channel at the stable
   GitHub HTTPS address in `docs/DEPLOY.md`. Database, preferences, workers and
   caches are separate from the regular app, with same-origin browser proof.
   Pin verified source for 0.4.0/0.4.1; the second deployment follows an explicit
   owner installation report. Later work cannot replace a pending test build.

**Success predicate:** an installed app brought back to the foreground after a
deploy offers the update within one minute without reinstalling, and applies it
without losing unsaved work. An app older than its data's minimum writer
version never writes.

**Adversarial checklist:** an update loop; a check that fails offline; an update
arriving mid-migration; two tabs on different versions, where the old one writes
after the new one migrated; an older app re-initialising the schema under an
open newer one, after which Riprova must reload rather than retry the same
instance (D1 review DI-R2-Q5); an older app's save or open-time repair
deleting duty-setting rows of a kind only a newer version knows, so the
read-only check comes before D1's and D2's repairs, which write (D2 reviews
DP-Q5, DI-R2-Q1); the banner over a nested screen; standalone WebKit
behaviour.

**Evidence:** verification, compatibility table tests, browser evidence, the
owner's Android check (update without reinstall), data-integrity,
regression-hunter, field-UX and schema-version sync-chaos reviews, test isolation proof and a security/privacy review of test publication.

## D4 — Export, import, persistent storage and full reset

**Category:** FEATURE
**Status:** AWAITING_OWNER

1. Ask the browser to keep the data (`navigator.storage.persist()`) when a
   course is created, and show in Impostazioni whether it agreed.
2. **Export** the course as one versioned file with identifiers kept, saved or
   sent through the share sheet. The file name holds no personal name, and the
   screen says the file contains students' personal data.
3. **Import** checks the format, the D3 version window and `validateCourseState`
   before writing anything, and shows what it found. It replaces the current
   course only after a confirmation; anything invalid changes nothing.
4. **Full local reset:** closes and deletes the database and the app's caches
   so no course data remains in the browser (owner, 2026-09-28).

**Success predicate:** a course exported from one browser and imported into a
fresh one is identical row for row. A corrupt, invalid or too-new file is
refused with a reason and changes nothing, and after the full reset no course
data remains in any browser storage.

**Adversarial checklist:** import interrupted halfway; a tampered file that
would break invariants; an identifier collision with the current course; the
share sheet on WebKit; persistent storage refused; a reset with another tab
open, including a stale tab's save landing on the erased course (D1 review
DI-R2-Q6: duty, student and volunteer saves do not check the course exists);
closing the database straight after a write, which crashed WebKit's test page
in D2; personal data in the file name or in logs.

**Evidence:** verification, round-trip evidence on Chromium and WebKit, browser
evidence, the owner's phone check (export to another app and import back),
data-integrity, security/privacy, field-UX and version/lifecycle sync-chaos
reviews. Same-origin production reset proof checks that the regular app's
course, preferences, cache bytes and offline support remain intact.

## T1 — A faster browser suite

**Category:** FOUNDATION
**Status:** IN_PROGRESS

Asked by the owner on 2026-10-10, when H1's browser-time target was missed
(`.evidence/H1/test-timing.json`). Reorganise the e2e suite by feature with
typed seeding (UG2-CQ-10): a spec reaches its starting state through a seeding
helper unless that path is the behaviour under test, and the heaviest journeys
(full week, hostile roster, field-UX fixes, crew summary) are split or
trimmed to what they assert. Fix the flaky tests filed in
`docs/working/BACKLOG.md`. Measure before and after back to back on the same
idle machine.

On 2026-10-21 the owner revised the target after
`.evidence/T1/target-feasibility.json` showed the one-worker goal out of reach:
three workers, unnecessary tests removed and necessary ones kept, and the
WebKit app-open time checked against H1. Three workers proved slower on the
development machine, so on 2026-10-22 the owner accepted T1 as delivered:
the cases recorded as unnecessary removed, the full suite run only when it
counts (tiered CI, `03_TECHNICAL_DECISIONS.md` §6), and a clean one-worker
suite of 41:30 against H1's 30:21 (60:10 before the removals).

**Success predicate:** every removed case is recorded with the kept case that
covers its requirement; ordinary pushes run the quick tier and handoffs,
closures, publication and `main` the full one, with a quick run never
standing in for a full one; a back-to-back pair on the same idle machine and
the recorded `verify:all` run with no failure and no retry; WebKit app open
in production is within H1's time; and each flake still filed has a recorded
classification or retained-trace plan.

**Adversarial checklist:** a seeding helper that creates a state the UI cannot;
a journey shortened past the step it was meant to prove; a case removed whose
requirement no kept case proves, or proves only on another engine; parallel
workers sharing state or hiding a flake; a measurement taken while the machine
was busy; a flake hidden by the retry instead of fixed.

**Evidence:** verification (`verify:all`), `test-timing.json` (before and after),
self-review, code-quality review.

**Erratum (UG3 scope review SC-2):** the owner accepted T1 as delivered on
2026-10-21, in the Claude Code session chat ("Accept T1 as delivered: tiered
CI, removals, zero flakes, 41:30 on one worker"), not on 2026-10-22 as
written above and in `.evidence/T1/self-review.json`.

## UG3 — 0.4.0 integration and release gate

**Category:** INTEGRATION_GATE
**Status:** AWAITING_OWNER

`verify:all` on the final source. Upgrade journeys from 0.1, 0.2 and 0.3 data
through the visible UI, an export/import round trip across Chromium and WebKit,
and the update journey. Reviewers: data integrity, regression, scope, code
quality, field UX, security/privacy. The owner checks on Android: an update
without reinstalling, with a note typed just before Aggiorna and the controls
at enlarged text (not observed in D3), export and import on the phone,
persistent storage. Then the release-gate documentation sweep, the changelog,
version 0.4.0 and the tag.

**Success predicate:** the 0.4.0 objective above holds on the tagged commit, with
no reviewer blocker and the owner's Android checks recorded.

**Evidence:** `.evidence/UG3/` verification, browser and migration evidence, six
reviews, the owner's device report.
