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
| B1 | Pending. The synced schema, offline; the first milestone. |

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

## B1 — The synced schema

**Category:** RULE_HEAVY
**Status:** PENDING

The app opens its database in one of two modes, persisted on the device:
local (0.4.0's schema, the default) and synced. The synced schema keeps
0.4.0's local-only course tables under `inactive_local_<table>` views and puts
synced tables `synced_<table>` behind the app's own view names, as the spike
records (`tests/e2e/b1-schema-probe.spec.ts`, run with `B1_PROBE=1`). One
function switches a device to synced mode: it records the new minimum writer,
applies the schema and copies every course row into the synced views in one
write transaction, so each row enters the upload queue; it is idempotent and
an interrupted switch completes on the next open. Nothing connects yet; B3
calls the switch at sign-in. Course files carry the state of ledgered
migrations (BACKLOG DI-UG3-2).

**Spike (2026-10-23, PowerSync 2.2.0, Chromium and WebKit, no backend).**
Switching keeps 0.4.0's rows and queues their copies as `synced_<table>`. A
0.4.0 app opening the switched database sees its own local copy; the synced
rows wait in `ps_untyped` and the queue stays whole. The new version
reopening it finds both intact. So 0.5.0 keeps the local copy rather than
emptying it, and its minimum writer makes an older app read-only: it shows a
stale course with the update bar, not an empty device inviting a new course.

**Success predicate:** a 0.1, 0.2, 0.3 or 0.4 course switched to synced mode
reads back identically through every screen, every row is queued exactly once,
and a 0.4.0 app opening the switched database opens read-only and destroys
neither the synced rows nor the queue.

**Adversarial checklist:** a row copied twice or not at all; a switch cut
short leaving both copies writable; the minimum writer recorded after the
copy instead of before; a 0.4.0 tab open during the switch writing to the
stale local copy; repairs and migrations running against the wrong tables in
synced mode; an import or full reset in synced mode; the erase leaving synced
rows.

**Evidence:** verification, migration and browser evidence, the spike, self,
domain-prosecutor, data-integrity and sync-chaos reviews.

## B2 — The development backend

**Category:** FOUNDATION
**Status:** PENDING

The owner's Supabase and PowerSync Cloud development projects (EU) run the
prepared migration, replication role and sync streams; the agent links and
deploys the instance with the PowerSync CLI and records its address in the
ignored `.env`. A readiness check proves the instance, the publication, the
sync config and Supabase sign-in, and that a token for one synthetic user
sees only that user's course. Tests that need the backend run against it or a
local stack in CI, never against production.

**Success predicate:** the readiness check passes against the development
instance, and the access test proves one user cannot read or write another's
course.

**Adversarial checklist:** the `postgres` superuser used for replication; a
secret committed; RLS missing on a table; a table missing from the
publication; the anonymous role granted access; the instance outside the EU.

**Evidence:** verification, backend readiness, self and security/privacy
reviews.

## B3 — Sign-in and sign-out

**Category:** FEATURE
**Status:** PENDING

Impostazioni offers sign-in by email; signed in, it shows the account and the
backup state, and the app switches to synced mode (B1) and connects. Sign-out
disconnects and keeps the course on the device; clearing it is a separate,
confirmed action. Signed out, everything works as in 0.4.0.

**Success predicate:** sign-in on a device with a course queues and uploads
the whole course, sign-out keeps it usable offline, and nothing connects or
leaves the device before sign-in.

**Adversarial checklist:** sign-in offline or interrupted; a second account
on the same device; an expired session; the magic link opened in another
browser; personal data in URLs or logs.

**Evidence:** verification, browser evidence, the owner's Android check, self,
security/privacy and field-UX reviews.

## B4 — Uploads

**Category:** RULE_HEAVY
**Status:** PENDING

The upload handler writes each queued change through the owner's session to
the table without its `synced_` prefix and sends the app version; the server
refuses writers below the minimum (03 §3.1). A transient failure retries; a
refused change is kept and reported in Impostazioni, never skipped silently.

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

Signing in on a device without a course downloads it and opens it; on a
device holding another course the app asks first, as import does, and never
merges.

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

**Success predicate:** after an erase nothing of the course remains readable
on the server or the device, including after an offline erase and reconnect.

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
