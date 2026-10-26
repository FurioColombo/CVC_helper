# Implementation plan — 0.5.0

Updated 2026-10-24. Read **Where this cycle stands**, then only the active
milestone's section. The road to 1.0.0 is `02_MVP_SCOPE.md` §4. The 0.4.0 plan
is archived at `archive/v0.4.0/04_IMPLEMENTATION_PLAN.md`; earlier plans are in
`archive/`. `.milestones/manifest.json` is the machine-readable lifecycle.

## Objective

**Online backup.** The owner signs in; the course is copied to the server and
kept up to date from the owner's devices; it can be restored on a new device;
erasing it erases it on the server. The course stays fully usable offline and
signed out, the team reads nothing yet (0.6.0), and real rosters stay off the
server until the owner's data decisions below are recorded.

**0.5.0 is done when** a synthetic course made offline on one phone reaches
the development server after sign-in, is restored whole on a second, empty
device, keeps working offline throughout, and disappears from the server when
erased; an older 0.4.0 app meeting the same database loses nothing — proven
by `verify:all`, the reviews below and the owner's Android check.

## Where this cycle stands

| Work | State and evidence |
| --- | --- |
| 0.4.0 | Released and tagged `v0.4.0` on 2026-10-24. Evidence in `.evidence/UG3/`; known limitations in `CHANGELOG.md`; open findings in `docs/working/BACKLOG.md`. |
| Preparation | Server tables, access rules, sync streams and the schema-switch spike, prepared on branch `claude/0.5.0-prep`. The owner's account steps: `docs/working/BACKEND_SETUP_0.5.0.md`. |
| B1 | Complete. A device switches once from 0.4.0's local tables to synced ones, every row identical and queued once, older apps read-only; erase, import, reset and older apps are covered on Chromium and WebKit. Three reviews passed with findings, fixed or handed to B3–B6. See `.evidence/B1/`. |
| B2 | Complete. The owner's development Supabase and PowerSync Cloud (EU) run the course tables; one account's course is closed to another and to the anonymous key, syncs to its owner alone, and takes its rows with it when deleted. Security review fixed. See `.evidence/B2/`. |
| B3 | Awaiting the owner: sign-in by link or code, sign-out and the switch are verified at `b8de760` (reviews passed, CI green); CVC Helper Test 0.5.0 carries it. Owner actions B3-EMAIL-CODE and B3-PHONE-SIGNIN. See `.evidence/B3/`. |

## Execution order

**B1** → **B2** → **B3** → **B4** → **B5** → **B6** → **UG4**. B1 needs no
backend. B2 needs the owner's development projects; B3 and later need B2.

## Owner decisions and actions

Due before the first real roster goes online (none blocks development on
synthetic data; `docs/working/BACKLOG.md`): the data controller and legal
basis, the retention period after a course ends, deletion from the provider's
backups, and who serves the speech model files.

Actions only the owner can take (agents may not create accounts or handle
keys): the development projects (`docs/working/BACKEND_SETUP_0.5.0.md`),
later the production ones, and Docker on the development PC if the backend
should run locally. Sign-in is by email (proposed: a magic link, no password
to remember on the boat).

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

## B3 — Sign-in and sign-out

**Category:** FEATURE
**Status:** AWAITING_OWNER

Impostazioni offers sign-in by email magic link (owner, 2026-10-25); signed
in, it shows the account and the backup state, and the app switches to synced
mode (B1) and connects: after `prepareDatabase`, before `connect()`, asking
the account first when it already holds a course (B1 review SC-B1-2), telling
other tabs, and treating `CourseReplacedError` from the switch as "switched
elsewhere" (SC-B1-Q2). Sign-out
disconnects and keeps the course on the device; clearing it is a separate,
confirmed action. Signed out, everything works as in 0.4.0.

**Success predicate:** sign-in on a device with a course queues and uploads
the whole course, sign-out keeps it usable offline, and nothing connects or
leaves the device before sign-in.

**Adversarial checklist:** sign-in offline or interrupted; a second account
on the same device, whose queue must never upload the first account's rows
(SC-B1-Q5); an expired session; the magic link opened in another browser;
personal data in URLs or logs.

**Evidence:** verification, browser evidence, the owner's Android check, self,
security/privacy and field-UX reviews.

## B4 — Uploads

**Category:** RULE_HEAVY
**Status:** PENDING

The upload handler writes each queued change through the owner's session to
the table without its `synced_` prefix and sends the app version; the server
refuses writers below the minimum (03 §3.1). A transient failure retries; a
refused change is kept and reported in Impostazioni, never skipped silently.
One phone writes at a time (owner, 2026-10-25): placement rows (crew members,
land, session boats, duties, evaluations) get ids from their natural keys, so
two phones edited offline converge on the latest edit instead of duplicates
that break Equipaggi, and the app says when that happened (SC-B1-1). Uploads
keep the queue's parent-first order and batch the switch's first transaction;
save latency after days offline is measured on the phone (SC-B1-Q3, Q4).
A course id already taken by another account (a shared file signed in
first) is reported, not retried forever (SP-B2-Q5).

**Success predicate:** every local change reaches the server exactly once
across reloads, offline periods and app closes, and a refused change is
visible to the owner and still recoverable.

**Adversarial checklist:** the app closed mid-upload; a refusal blocking the
queue forever; a stale app version writing; a delete uploaded before its
insert; personal data in error reports.

**Evidence:** verification, browser evidence, self, sync-chaos,
data-integrity and security/privacy reviews.

## B5 — Restore on a new device

**Category:** FEATURE
**Status:** PENDING

Signing in on a device without a course downloads it and opens it, then
reopens so the session binds the restored course (SC-B1-Q5); on a device
holding another course the app asks first, as import does, and never merges.

**Success predicate:** a course restored on an empty device equals the
original row for row, and a device with another course changes nothing until
the owner confirms.

**Adversarial checklist:** a restore interrupted halfway; a restore while the
other device still uploads; a restored course whose minimum writer is newer
than the app.

**Evidence:** verification, browser evidence, the owner's Android check, self,
data-integrity and sync-chaos reviews.

## B6 — Erase on the server

**Category:** FEATURE
**Status:** PENDING

Erasing the course and the full reset also delete the server copy when
signed in; offline, the deletion completes on reconnect. Impostazioni states
what the provider's backups keep and for how long (owner decision).

**Success predicate:** after an erase or an import replacement nothing of the
removed course remains readable on the server or the device, the upload
queue's pending payloads included (B1 reviews DI-B1-1, SC-B1-3), also after
an offline erase and reconnect.

**Adversarial checklist:** an erase offline and never reconnected; an erase
racing a restore on another device; partial deletion leaving orphan rows.

**Evidence:** verification, self, security/privacy and data-integrity
reviews.

## UG4 — 0.5.0 integration and release gate

**Category:** INTEGRATION_GATE
**Status:** PENDING

`verify:all` on the final source, with the version bumped before the phone
build is published so one owner check covers the final source (owner
decision of 2026-10-23). A realistic week offline and online across two
devices, the 0.4.0-app scenario, and the release sweep. Reviewers:
security/privacy, sync-chaos, data-integrity, regression, scope, field UX and
code quality.

**Success predicate:** the 0.5.0 objective holds on the tagged commit, with no
reviewer blocker and the owner's Android checks recorded.

**Evidence:** `.evidence/UG4/` verification, browser and backend evidence,
seven reviews, the owner's device report.

## Owner feedback

Owner checks follow `docs/OWNER_WORKFLOW.md` and appear in
`docs/OWNER_TODO.md`. Open choices: the UG2 field candidates and the
remaining retrospective proposals (`docs/working/BACKLOG.md`), reviewed in
`docs/working/OWNER_DECISIONS.md`.
