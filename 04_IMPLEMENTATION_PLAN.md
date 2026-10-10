# Implementation plan — 0.4.0

Updated 2026-10-08. Read **Where this cycle stands**, then only the active
milestone's section. The road to 1.0.0 is `02_MVP_SCOPE.md` §4. The 0.3.0 plan
is archived at `archive/v0.3.0/04_IMPLEMENTATION_PLAN.md`; earlier plans are in
`archive/`. `.milestones/manifest.json` is the machine-readable lifecycle.

## Objective

Make the course on the phone safe, and ready to be copied to a server, without
adding a server. Every record carries what synchronisation will need, the app
and its data know their versions, updates reach an installed app without a
reinstall, and a course can be exported, imported and wiped. The harness gets
faster and shares one set of agent tools.

**0.4.0 is done when** a course created in 0.1, 0.2 or 0.3 opens in 0.4.0 with
every record, reference and value intact plus complete metadata, survives an
interrupted upgrade, round-trips through export and import unchanged, and an
installed 0.4.0 app takes the next update without reinstalling — all proven by
`verify:all`, the reviews below and the owner's Android checks.

## Where this cycle stands

| Work | State and evidence |
| --- | --- |
| 0.3.0 | Released and tagged `v0.3.0` on 2026-10-08. Evidence in `.evidence/UG2/`; known limitations in `CHANGELOG.md`; review findings left for later in `docs/working/BACKLOG.md`. |
| Harness prep | On branch `claude/harness-0.4-prep`: shared hooks, reviewer personas, skills, `docs/DOCS_SYSTEM.md`, `check:docs`. Merged as H1's first step. |
| H1 | Complete. Documents in the `docs/DOCS_SYSTEM.md` layout; unit tests 287 s to 71 s; browser suite not shown faster (target missed, accepted by the owner); retrospective not delivered. See `.evidence/H1/`. |
| D1–D4, T1, UG3 | Pending; D1 is next. |

## Execution order

**H1** → **D1** → **D2** → **D3** → **D4** → **T1** → **UG3**. Field fixes from the UG2
findings join as an extra milestone only if the owner picks them (see the end).

## Rules for this cycle

- Every milestone has a **success predicate** (one sentence that decides pass
  or fail) and an **adversarial checklist** (the specific ways it could be
  wrong). Reviewers attack both; the closure evidence answers both.
- No server, account or synchronisation code in 0.4.0. Load the `powersync`
  skill before any schema change, and design each change so 0.5.0 can sync it.
- Schema changes follow `03_TECHNICAL_DECISIONS.md` §3.1. The 0.1, 0.2 and 0.3
  fixtures are the regression contract.
- Synthetic data only, everywhere.
- Close every milestone with the `milestone-close` skill.

## D1 — Record metadata and course ownership

**Category:** FOUNDATION
**Status:** PENDING

1. A local `appMeta` table and an ordered, idempotent migration runner that
   records each step and runs before the first read. A migration interrupted
   by closing the app, turning the screen off or killing the tab completes on
   the next open, and nothing is applied twice.
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
leaves `appMeta` stale; the invariant checker rejecting a valid old fixture;
migration time on a 40-student course.

**Evidence:** verification (`verify` and focused browser specs),
`migration-evidence.json` (fixture counts before and after, interruption runs),
data-integrity review, self-review.

## D2 — Duty settings as rows

**Category:** RULE_HEAVY
**Status:** PENDING

The five JSON lists in `dutySettings` become rows of one table: one row per
item, its kind from canonical configuration (fewer day, extra day, stay over,
completed day, acknowledged warning), with D1's metadata. They are migrated by
D1's runner, and read and written item by item, never as a whole list. Duty
settings normalisation moves into the domain (UG2-CQ-6). Behaviour does not
change.

**Success predicate:** every duty behaviour, the deterministic full week and the
duty browser journeys give identical results before and after. Every list item
is one row, and every fixture's lists migrate with no item lost or duplicated.

**Adversarial checklist:** duplicates or corrupt JSON in old rows; an order the
old lists implied; completed-day history lost; acknowledged-warning keys in an
old format; erasing the course leaves rows behind; a toggle written twice.

**Evidence:** verification, full-week result, migration evidence,
domain-prosecutor and data-integrity reviews, self-review.

## D3 — Versions and reliable updates

**Category:** RULE_HEAVY
**Status:** PENDING

1. **Compatibility contract** (`03_TECHNICAL_DECISIONS.md` §3.1), the rules the
   server will enforce from 0.5.0:
   - the data records its version in `appMeta`;
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

**Success predicate:** an installed app brought back to the foreground after a
deploy offers the update within one minute without reinstalling, and applies it
without losing unsaved work. An app older than its data's minimum writer
version never writes.

**Adversarial checklist:** an update loop; a check that fails offline; an update
arriving mid-migration; two tabs on different versions, where the old one writes
after the new one migrated; the banner over a nested screen; standalone WebKit
behaviour.

**Evidence:** verification, compatibility table tests, browser evidence, the
owner's Android check (update without reinstall), data-integrity,
regression-hunter and field-UX reviews.

## D4 — Export, import, persistent storage and full reset

**Category:** FEATURE
**Status:** PENDING

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
open; personal data in the file name or in logs.

**Evidence:** verification, round-trip evidence on Chromium and WebKit, browser
evidence, the owner's phone check (export to another app and import back),
data-integrity, security/privacy and field-UX reviews.

## T1 — A faster browser suite

**Category:** FOUNDATION
**Status:** PENDING

Asked by the owner on 2026-10-10, when H1's browser-time target was missed
(`.evidence/H1/test-timing.json`). Reorganise the e2e suite by feature with
typed seeding (UG2-CQ-10): a spec reaches its starting state through a seeding
helper unless that path is the behaviour under test, and the heaviest journeys
(full week, hostile roster, field-UX fixes, crew summary) are split or
trimmed to what they assert. Fix the flaky tests filed in
`docs/working/BACKLOG.md`. Measure before and after back to back on the same
idle machine.

**Success predicate:** with no assertion and no project coverage lost, the
browser suite on one worker takes at least 30% less time than the H1 suite,
measured back to back on the same idle machine, and no flaky test remains.

**Adversarial checklist:** a seeding helper that creates a state the UI cannot;
a journey shortened past the step it was meant to prove; a measurement taken
while the machine was busy; a flake hidden by the retry instead of fixed.

**Evidence:** verification (`verify:all`), `test-timing.json` (before and after),
self-review, code-quality review.

## UG3 — 0.4.0 integration and release gate

**Category:** INTEGRATION_GATE
**Status:** PENDING

`verify:all` on the final source. Upgrade journeys from 0.1, 0.2 and 0.3 data
through the visible UI, an export/import round trip across Chromium and WebKit,
and the update journey. Reviewers: data integrity, regression, scope, code
quality, field UX, security/privacy. The owner checks on Android: an update
without reinstalling, export and import on the phone, persistent storage. Then
the release-gate documentation sweep, the changelog, version 0.4.0 and the
tag.

**Success predicate:** the 0.4.0 objective above holds on the tagged commit, with
no reviewer blocker and the owner's Android checks recorded.

**Evidence:** `.evidence/UG3/` verification, browser and migration evidence, six
reviews, the owner's device report.

## Waiting for the owner

Which of the six candidates in `docs/working/BACKLOG.md` ("Waiting for the
owner's choice") join 0.4.0 as a fix milestone?
