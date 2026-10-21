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
| H1 | Complete. Documents in the `docs/DOCS_SYSTEM.md` layout; unit tests 287 s to 71 s; browser suite not shown faster (target missed, accepted by the owner); retrospective not delivered. See `.evidence/H1/`. |
| D1 | Complete. Every record carries `createdAt`, `updatedAt` and its course; repairs on every open settle what older versions and older apps leave; a migration ledger in `meta`. The 0.1–0.3 fixtures upgrade intact on Chromium and WebKit. See `.evidence/D1/`; what an older app strips beyond D1's columns stays lost (03 §3.1). |
| D2 | Complete. The duty-settings lists are also stored item by item, written beside the lists the app still reads while 0.3.0 can open the database; a repair keeps them identical. Normalisation moved into the domain. Behaviour unchanged. See `.evidence/D2/`; WebKit test-page losses are filed as flaky tests. |
| D3 | Complete. The data records its version; older apps open newer data read-only; installed apps find updates on return and keep unsaved work. The owner accepted the Android update on 2026-10-19; the note-edit and enlarged-text phone steps were not observed and move to UG3. See `.evidence/D3/` and its `limitations.md`. |
| D4 | Complete. Courses export to a file, share as text, import back after a preview, and reset fully; an interrupted reset resumes on the next open. Accepted on Android on 2026-10-20 after one round of owner fixes. See `.evidence/D4/`; known limits in 03 §3.2 and `docs/working/BACKLOG.md`. |
| T1 | In progress. H1/current misses the target: 33:59 versus 60:10. Large WebKit fixture setup drops from 28 s to 1 s intact; one regression run closed a WebKit page, a rerun passes 33 cases. Exact `9533421` CI is green without retries. Trace reduction gives no gain; fixture restoration passes both engines. Final verification/reviews remain open. Evidence: `.evidence/T1/`. |
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
`.evidence/T1/target-feasibility.json` showed the one-worker goal out of reach
(the 0.4 cases add 21 minutes and WebKit opens regressed about a second since
H1). The suite may run on three workers. Unnecessary tests are removed and
necessary ones kept: a case goes only when another kept case proves the same
requirement on the same engine at least as strongly, recorded case by case.
The WebKit app-open regression is fixed in the app.

**Success predicate:** the full browser suite on three workers takes at least
30% less time than the H1 suite (33:59, so at most 23:47), measured back to
back on the same idle machine; every removed case is recorded with the kept
case that covers its requirement; WebKit app open is back within H1's time;
and no flaky test remains.

**Adversarial checklist:** a seeding helper that creates a state the UI cannot;
a journey shortened past the step it was meant to prove; a case removed whose
requirement no kept case proves, or proves only on another engine; parallel
workers sharing state or hiding a flake; a measurement taken while the machine
was busy; a flake hidden by the retry instead of fixed.

**Evidence:** verification (`verify:all`), `test-timing.json` (before and after),
self-review, code-quality review.

## UG3 — 0.4.0 integration and release gate

**Category:** INTEGRATION_GATE
**Status:** PENDING

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

D3's Android update check uses GitHub-hosted HTTPS, prepared by agents as
described in `docs/DEPLOY.md`. The owner has no setup choice left to make.
Its request is `D3-PHONE-UPDATE` in `docs/OWNER_TODO.md`; it is not READY until agent
reviews, final verification and CI pass. D3 then stays AWAITING_OWNER until the
matching phone report passes, while explicitly permitted agent work continues.

Which of the six candidates in `docs/working/BACKLOG.md` ("Waiting for the
owner's choice") join 0.4.0 as a fix milestone? And which of the
retrospective's remaining proposals ("Retrospective proposals awaiting the owner's
pick") are adopted?
