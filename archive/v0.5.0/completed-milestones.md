# 0.5.0 — completed milestones

The sections of the 0.5.0 plan, moved here unchanged when each milestone closed.

## B1 — The synced schema

**Category:** RULE_HEAVY
**Status:** IN_PROGRESS

The app opens its database in one of two modes, recorded in `meta`: local
(0.4.0's schema, the default) and synced (`src/persistence/syncMode.ts`). The
synced schema keeps 0.4.0's local-only course tables under
`inactive_local_<table>` views and puts synced tables `synced_<table>` behind
the app's own view names. One transaction switches a device: it raises the
minimum writer to 0.5.0 (`SYNCED_SINCE`), copies every course row into the
synced tables, so each row enters the upload queue, empties and compacts the
local copy, records the mode and advances the course generation, so open
screens stop and the app reopens, as after an import. It is idempotent; cut
short, it rolls back whole and its caller retries it. Every open applies the
recorded mode before the first read, and the write guard refuses a write in
synced mode while an older app has put its own schema back. Nothing connects
yet; B3 calls the switch at sign-in. The switch is not a ledgered migration,
so course files need no migration state yet (BACKLOG DI-UG3-2 stays with the
first one). The branch builds 0.5.0, the first version allowed to write
synced data.

**Spike (2026-10-23, PowerSync 2.2.0, Chromium and WebKit, no backend;
`tests/e2e/b1-schema-probe.spec.ts`, `B1_PROBE=1`).** Switching keeps 0.4.0's
rows and queues their copies as `synced_<table>`. A 0.4.0 app opening the
switched database sees only the local copy; the synced rows wait in
`ps_untyped` and the queue stays whole, and the new version reopening it
finds both. The local copy is emptied rather than kept: kept, it would hold
students and notes deleted later in synced mode, out of every 0.5.0 screen.
An older app therefore opens an empty device read-only, with the update bar.

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
**Status:** AWAITING_OWNER

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
