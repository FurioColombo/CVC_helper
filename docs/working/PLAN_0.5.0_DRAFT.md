# 0.5.0 plan — draft for the owner's review

> Working document · Owner: the owner · Fold at: 0.5.0

A draft written by the agent on 2026-10-22, while UG3 waits for the owner's
phone check, so the next cycle can start at once. It becomes
`04_IMPLEMENTATION_PLAN.md` at cycle start, after UG3 completes and the owner
has reviewed it; nothing here is approved scope until then. The road is
`02_MVP_SCOPE.md` §4; the constraints are `03_TECHNICAL_DECISIONS.md` §1 and
§3.1.

## Objective

**Online backup.** The owner signs in; the course is copied to the server and
kept up to date from the owner's devices; it can be restored on a new device;
erasing it erases it on the server. The course stays fully usable offline,
the team does not read it yet (0.6.0), and real rosters stay off the server
until the owner's data decisions are recorded.

**0.5.0 is done when** a synthetic course made offline on one phone reaches
the development server after sign-in, survives the phone being wiped by a
restore on a second device with every record intact, keeps working offline
throughout, and disappears from the server when erased — proven by
`verify:all` against a local Supabase and PowerSync, the reviews below and
the owner's Android check.

## Owner decisions and actions due first

Decisions (`docs/working/BACKLOG.md`, "Decisions due before the first real
roster goes online"); none blocks development on synthetic data, all block the
first real roster:

1. the data controller and legal basis, including whether the students'
   release covers this service;
2. the retention period after a course ends;
3. deletion from the provider's backups, and within what time;
4. who serves the speech model files.

Actions only the owner can take (agents may not create accounts or handle
keys, `AGENTS.md` §17): create the EU development projects on Supabase and
PowerSync Cloud, and later the separate production ones; choose the sign-in
method (proposed: email magic link, no password to remember on the boat).

## Proposed milestones

| ID  | Category         | What it delivers                                                                                                                                                                                                                                                                                                                                |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | FOUNDATION       | Local backend for development and CI: Supabase CLI and self-hosted PowerSync in Docker, synthetic seed, no agent tool ever pointed at production. Postgres schema mirroring the course tables with `courseId`, `ownerId`, the D1 metadata and RLS by owner.                                                                                     |
| S1  | RULE_HEAVY       | The synced schema. The course tables become synced through 03 §3.1's path: the new version keeps declaring the local-only tables (under other view names) until a ledgered migration has copied their rows, declares its own minimum writer, and drops them only in a later release. Course files carry the migration state (BACKLOG DI-UG3-2). |
| A1  | FEATURE          | Sign-in and sign-out in Impostazioni; signed out, the app works as 0.4.0. Sign-in copies the local course into the upload queue; sign-out keeps the course on the device unless asked (`disconnectAndClear` only on explicit request).                                                                                                          |
| U1  | RULE_HEAVY       | The upload handler: writes rows through the owner's session, sends the app version with every upload and refuses writers below the minimum (03 §3.1), and reports a refused or failed upload in Impostazioni without losing the queue.                                                                                                          |
| R1  | FEATURE          | Restore on a new device: after sign-in on an empty device the course downloads and opens; on a device with another course the app asks, as import does.                                                                                                                                                                                         |
| E1  | FEATURE          | Erase on the server: the existing erase and full reset also delete the server copy when signed in, offline erasure completing on reconnect; what the provider's backups keep is stated (owner decision 3).                                                                                                                                      |
| UG4 | INTEGRATION_GATE | 0.5.0 release gate: the done-when above, with the security/privacy, sync-chaos ("two phones offline", even with one writer), data-integrity, regression, scope and field-UX reviewers; the owner's Android check on the test channel.                                                                                                           |

Order: L1 → S1 → A1 → U1 → R1 → E1 → UG4. S1 and L1 can overlap; every
later milestone needs both.

## Adversarial checklist for the whole cycle

- A 0.4.0 app still installed beside 0.5.0 writes local-only rows the synced
  tables never see, or drops the tables the new version still reads.
- The upload queue grows without bound while signed out, or loses entries
  when the app is closed mid-upload.
- A restore merges into an existing course instead of replacing it.
- Erasing offline leaves the server copy forever.
- Personal data reaches logs, URLs or error reports.
- CI or a development backend touches a production project.

## Candidate field fixes

The 0.5.0 planning candidates in `docs/working/BACKLOG.md` (start date,
two open copies, phone Back from the destination chooser, long names, text
at 115–150 %, the D2–D5 size override) join as one FEATURE milestone only if
the owner picks them; two open copies (UG2-DAT-9) matters more once the
server holds one copy.
