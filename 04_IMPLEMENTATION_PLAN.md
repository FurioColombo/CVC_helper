# Implementation plan — 0.5.0

Updated 2026-11-11. Read **Where this cycle stands**, then only the active
milestone's section. The road to 1.0.0 is `02_MVP_SCOPE.md` §4. The 0.4.0 plan
is archived at `archive/v0.4.0/04_IMPLEMENTATION_PLAN.md`; earlier plans are in
`archive/`. `.milestones/manifest.json` is the machine-readable lifecycle.

## Objective

**Online backup.** The owner signs in; the course is copied to the server and
kept up to date from the owner's devices; it can be restored on a new device;
erasing it erases it on the server. The course stays fully usable offline and
signed out, the team reads nothing yet (0.6.0), and real rosters stay off the
server until the owner's data decisions below are recorded.

**Vento (WX1).** Added by the owner on 2026-11-06: a wind forecast for the next
session, the next 24 hours and the week, from public forecasts, with no go or
no-go. It touches no course data and no sync.

**0.5.0 is done when** a synthetic course made offline on one phone reaches
the development server after sign-in, is restored whole on a second, empty
device, keeps working offline throughout, and disappears from the server when
erased; an older 0.4.0 app meeting the same database loses nothing; and
Vento shows a real forecast on the owner's phone and keeps it without signal —
proven by `verify:all`, the reviews below and the owner's Android check.

## Where this cycle stands

| Work | State and evidence |
| --- | --- |
| 0.4.0 | Released and tagged `v0.4.0` on 2026-10-24. Evidence in `.evidence/UG3/`; known limitations in `CHANGELOG.md`; open findings in `docs/working/BACKLOG.md`. |
| Preparation | Server tables, access rules, sync streams and the schema-switch spike, prepared on branch `claude/0.5.0-prep`. The owner's account steps: `docs/working/BACKEND_SETUP_0.5.0.md`. |
| B1 | Complete. A device switches once from 0.4.0's local tables to synced ones, every row identical and queued once, older apps read-only; erase, import, reset and older apps are covered on Chromium and WebKit. Three reviews passed with findings, fixed or handed to B3–B6. See `.evidence/B1/`. |
| B2 | Complete. The owner's development Supabase and PowerSync Cloud (EU) run the course tables; one account's course is closed to another and to the anonymous key, syncs to its owner alone, and takes its rows with it when deleted. Security review fixed. See `.evidence/B2/`. |
| B3 | Complete. Sign-in by emailed link signs in, switches and uploads the course; offline it stays signed in and resumes with signal; Esci warns about unsent changes and keeps the course; another account never takes it. Owner phone check passed (two steps not observed). The email code awaits a custom sender (B3-EMAIL-CODE). See `.evidence/B3/`. |
| B4 | Complete. Every change reaches the server once, in order, across reloads and offline days; refusals stay visible and recoverable; desktop tabs each sync. Owner check passed on CVC Helper Test 0.5.3 (2026-11-10). The desktop review's third round failed on two courses per account, split to B7 (owner decision 20). See `.evidence/B4/`. |
| B5 | Complete. An empty device restores the account's course row for row and reopens on it; a device with another course asks before replacing; a newer minimum writer opens it read-only. Owner checks passed: the minimum read rule live, the phone restore on CVC Helper Test 0.5.3 (2026-11-10; the optional PC step skipped). See `.evidence/B5/`. |
| B6 | Awaiting the owner, reverified on the code of CVC Helper Test 0.5.3: an erase or import between two sync retries now always disconnects (found in the B4 fix run). Owner action B6-ERASE-RULES done and verified live; phone check B6-PHONE-ERASE is ready for the owner. See `.evidence/B6/`. |
| B7 | Built, reviewed, evidence recorded at `08b3eae`. The owner ran `B7-KEEP-RULE` on 2026-11-10 and the live spec passes (`.evidence/B7/live-keep-rule.json`). Waits for green full CI (blocked by GitHub's billing lock); then its handoff, a test build and `B7-PHONE-CHOICE`. |
| WX1 | Adopted 2026-11-06, not started. Built and reviewed three times on the unpushed branch `claude/weather-section`. The owner accepted on 2026-11-06 that it connects before sign-in (`WX1-NETWORK`); it starts after B7's handoff. |

Handoff: B4 and B5 closed locally on 2026-11-11, unpushed; their checkpoints'
full push CI stays pending until GitHub's billing lock is lifted and a push is
authorised.

## Execution order

**B1** → **B2** → **B3** → **B4** → **B5** → **B6** → **B7** → **WX1** → **UG4**. B1
needs no backend. B2 needs the owner's development projects; B3 and later need
B2. WX1 needs neither, and waits for B7's handoff only so that merging it does
not change the source B7 verified.

## Owner decisions and actions

Due before the first real roster goes online (none blocks development on
synthetic data; `docs/working/BACKLOG.md`): the data controller and legal
basis, the retention period after a course ends, deletion from the provider's
backups, and who serves the speech model files.

Actions only the owner can take (agents may not create accounts or handle
keys): the development projects (`docs/working/BACKEND_SETUP_0.5.0.md`),
later the production ones, and Docker on the development PC if the backend
should run locally.

## Rules for this cycle

- Load the `powersync` skill before any data, schema or sync work. Backend
  readiness (deployed sync config, sign-in, publication) comes before app
  code that connects.
- Signed out, the app behaves as 0.4.0. Nothing connects before sign-in.
- 03 §3.1 governs the switch to synced tables: 0.4.0's local-only tables stay
  declared, the new version declares its own minimum writer, and the local
  tables are dropped only in a later release.
- No agent tool touches a production project; development and CI use
  synthetic data only.
- Every milestone has a success predicate and an adversarial checklist; close
  each with the `milestone-close` skill.

## B6 — Erase on the server

**Category:** FEATURE
**Status:** AWAITING_OWNER

Erasing the course and the full reset also delete the server copy when
signed in; offline, the deletion completes on reconnect. Impostazioni states
what the provider's backups keep and for how long (owner decision).

**Success predicate:** after an erase or an import replacement nothing of the
removed course remains readable on the server or the device, the upload
queue's pending payloads included (B1 reviews DI-B1-1, SC-B1-3), also after
an offline erase and reconnect.

**Adversarial checklist:** an erase offline and never reconnected; an erase
racing a restore on another device; partial deletion leaving orphan rows; a
delete of people's data losing to another phone's later or clock-ahead edit
under the B4 upload rules (B4 review SP-B4-3).

**Evidence:** verification, self, security/privacy and data-integrity
reviews.

## B7 — Two courses on one account

**Category:** FEATURE
**Status:** IN_PROGRESS

Two devices that each make a course, one of them offline, leave the account
with two courses, and any other route to that state does the same (review
SC-DT-9). Today every device of the account then stops on "Non riesco ad aprire
i dati locali" with only Riprova, and Impostazioni, Esci, export and reset are
out of reach. The app shows both courses and the owner chooses which to keep;
it never erases one by itself. Target: `docs/design/mockups/b7-two-courses.html`,
approved by the owner on 2026-11-04: counts, last change with the account's
email, and a choice that needs signal.

**Success predicate:** an account holding two courses never locks a device: the
owner can see both, export either and keep one, and afterwards every device of
the account opens on that one course with no row of it lost.

**Adversarial checklist:** the two courses reached offline, through an import
after a lost erase answer (SC-DT-9, r16) and through a restore (SC-DT-2); both
devices choosing differently, one offline; a choice interrupted between its
erase and the reopen; a new empty device; a read-only device; a device signed
out; three courses; a choice with unsent changes in the course given up.

**Evidence:** verification, the owner's Android check, self, data-integrity,
sync-chaos, field UX and security/privacy reviews.

## WX1 — Vento, the wind forecast

**Category:** FEATURE
**Status:** PENDING

A Vento line on Home and a Vento screen: the next session in detail, the next
24 hours, the week or seven days; seven models blended through Open-Meteo,
LaMMA's own map, links to Meteomar, Windy and Windfinder. It gives no go or
no-go: that stays the instructor's. Built on `claude/weather-section`, with the
proposal, the backtest and three rounds of review in `docs/working/` there
(`WEATHER_PROPOSAL.md`, `WEATHER_EVIDENCE.md`, `weather-reviews/`).

**Starts when** B7 has handed off; the owner accepted `WX1-NETWORK` on
2026-11-06 (decision 25). Then the branch merges here, the manifest gains its specs, and WX1 starts
with B6 and B7 as permitted predecessors.

**Work.** The proposal's §9 edits: `01` gains the Vento section and sheds text
to stay in budget; `02` §1; `03` lists Open-Meteo and LaMMA as permitted calls
and the forecast's cache rule. As the owner accepted `WX1-NETWORK`, this plan's rule
"Nothing connects before sign-in", `03` §"Online backup" and `docs/DEPLOY.md`
"zero off-origin requests" are amended in one commit. The disclosure in
Impostazioni and the README; `WX1-PLACES`' hours and points. The proposal's §8
items left open are done or deferred to the backlog, and the working
documents fold into the contracts. The owner asked (2026-11-11) to stay well
clear of Open-Meteo's free limits (600 a minute, 5,000 an hour, 10,000 a day,
300,000 a month, counted per address, so the centre's shared Wi-Fi counts as
one): a test pins one refresh's weighted calls and the 45-minute floor, and `03`
states the budget, about a tenth of the daily limit for the whole centre.

**Success predicate:** on the owner's phone, Vento shows each area's next
session with expected wind, gust and range from a real download; without
signal it keeps the last forecast with its age; Home quotes it without
connecting; nothing of the course leaves the device; erase, replace, import
and reset remove the forecast.

**Adversarial checklist:** no signal at the first open; signal lost mid-download;
leaving before the extras arrive; a malformed, hostile or past-only answer; a
copy 6 and 24 hours old; a session in its last hour; the course erased in
another tab; LaMMA unavailable; a far session; 320 px at 200% text; WebKit;
a phone reopening Vento every minute, or many phones at once on one Wi-Fi.

**Evidence:** verification, the owner's decisions and Android check, self, field
UX, accessibility/mobile, security/privacy and forecast-method reviews; the
method review covers what changed after round three.

## UG4 — 0.5.0 integration and release gate

**Category:** INTEGRATION_GATE
**Status:** PENDING

`verify:all` on the final source, with the version bumped before the phone
build is published so one owner check covers the final source (owner
decision of 2026-10-23). A realistic week offline and online across two
devices, the 0.4.0-app scenario, Vento in that week, and the release sweep.
`WX1-TERMS` must be settled before release. Reviewers:
security/privacy, sync-chaos, data-integrity, regression, scope, field UX and
code quality.

The sweep also writes 0.5.0's behaviour into `01_PRODUCT_SPEC.md` (titled 0.4.0,
and at 699 of its 700 lines, so it sheds text first), `02_MVP_SCOPE.md` §1 and
`docs/design/07_PAGE_CHANGELOG.md`; settles the "Not yet run" list in
`docs/DEVICE_CHECKS.md`; and decides, do or defer, the backlog's items marked
before production or before UG4.

**Success predicate:** the 0.5.0 objective holds on the tagged commit, with no
reviewer blocker and the owner's Android checks recorded.

**Evidence:** `.evidence/UG4/` verification, browser and backend evidence,
seven reviews, the owner's device report.

## Owner feedback

Owner checks follow `docs/OWNER_WORKFLOW.md` and appear in
`docs/OWNER_TODO.md`. Open choices: the UG2 field candidates and the
remaining retrospective proposals (`docs/working/BACKLOG.md`), reviewed in
`docs/working/OWNER_DECISIONS.md`.
