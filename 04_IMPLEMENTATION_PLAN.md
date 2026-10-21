# Implementation plan — 0.4.0

Updated 2026-10-19. Read **Where this cycle stands**, then only the active
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
| H1 | Complete. Documents in the `docs/DOCS_SYSTEM.md` layout; unit tests 287 s to 71 s; browser suite not shown faster (target missed, accepted by the owner); retrospective delivered 2026-10-10 and partly adopted 2026-10-12 (`archive/v0.4.0/RETRO_0X.md`). See `.evidence/H1/`. |
| D1 | Complete. Every record carries `createdAt`, `updatedAt` and its course; repairs on every open settle what older versions and older apps leave; a migration ledger in `meta`. The 0.1–0.3 fixtures upgrade intact on Chromium and WebKit. See `.evidence/D1/`; what an older app strips beyond D1's columns stays lost (03 §3.1). |
| D2 | Complete. The duty-settings lists are also stored item by item, written beside the lists the app still reads while 0.3.0 can open the database; a repair keeps them identical. Normalisation moved into the domain. Behaviour unchanged. See `.evidence/D2/`; WebKit test-page losses are filed as flaky tests. |
| D3 | Complete. The data records its version; older apps open newer data read-only; installed apps find updates on return and keep unsaved work. The owner accepted the Android update on 2026-10-19; the note-edit and enlarged-text phone steps were not observed and move to UG3. See `.evidence/D3/` and its `limitations.md`. |
| D4 | Complete. Courses export to a file, share as text, import back after a preview, and reset fully; an interrupted reset resumes on the next open. Accepted on Android on 2026-10-20 after one round of owner fixes. See `.evidence/D4/`; known limits in 03 §3.3 and `docs/working/BACKLOG.md`. |
| T1 | Complete. Unnecessary browser cases removed with their coverage recorded; the full suite runs only when it counts (tiered CI). Clean one-worker suite 41:30 against H1 30:21, no flaky test; the owner accepted this target in chat on 2026-10-21. See `.evidence/T1/`; open flakes in `docs/working/BACKLOG.md`. |
| UG3 | Pending. The release gate waits for all required owner acceptance and completed T1 verification. |

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
- Owner checks use `docs/OWNER_WORKFLOW.md` and `docs/OWNER_TODO.md`.
  D4 may follow verified D3 while its phone check waits; T1 may follow
  verified D3/D4 while their phone checks wait. UG3 requires COMPLETE predecessors.

## UG3 — 0.4.0 integration and release gate

**Category:** INTEGRATION_GATE
**Status:** IN_PROGRESS

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

## Owner feedback

Owner phone checks follow `docs/OWNER_WORKFLOW.md`; the release check is
`UG3-PHONE-RELEASE` in `docs/OWNER_TODO.md`. The open choices (UG2 fix
candidates, remaining retrospective proposals, the D2–D5 size override) were
not taken up in 0.4.0 and move to 0.5.0 planning
(`docs/working/OWNER_DECISIONS.md`).
