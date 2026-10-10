# Scope

What is in scope today, what stays out, and the road to 1.0.0. Product behaviour
lives in `01_PRODUCT_SPEC.md`; milestone order and evidence live in
`04_IMPLEMENTATION_PLAN.md`. The scope as it stood through 0.3.0, with its
history, is archived at `archive/v0.3.0/02_MVP_SCOPE.md`.

## 1. In scope: the released app

The released app (0.3.0) supports one course on one phone. It is local-first,
installable and used by the owner during a CVC Caprera week.

- **Course and shell.** Dynamic course identity (D/C level, week, year); the CVC
  symbol and six Home cards; the installed icon (the Home CVC mark with
  `HELPER`) and launch colour; phone Back through every area; an update banner;
  erasing the course from Impostazioni to start a new one.
- **Students.** A compact list and a profile with size, notes and the weekly
  evaluation grid; safe deletion of never-used students. Students are added by:
  - manual entry;
  - camera or gallery scan, with free rotation, crop and mandatory review;
  - an assistant's pasted answer (the app gives the prompt and format and
    sends nothing itself).

  Only the age on the first course day is kept, never a date of birth. Notes
  take speech input.
- **Boats, faults and volunteers.** Multi-number boat entry; boat identity with
  class logos and a written-model fallback; faults with direct state controls
  and dictation; volunteers ADV, IS and CT, outside every student-only rule.
- **Comandate.** A seven-day overview with a non-mutating proposal: a
  `floor(N/D)` base, plus `Giorni con più persone` for the remainder. Days are
  edited directly, recalculated midweek and keep their history. The summary is
  copied as an image.
- **Equipaggi.**
  - Composition by tapping: a free seat, then a person; or a person, then a
    destination. Destinations include A terra and Mezzi.
  - Warnings: size, repetition, an unavailable boat, an open fault, an active
    student missing from every crew and A terra, a D1 morning-duty student
    not A terra.
  - Session-local boat links.
  - D1/Cabinato crews start at four and can be resized; D2–D5 stay at two.
    Impostazioni sets two or three names per row.
  - The crew summary (design C6) is copied as an image or shared.
- **Valutazioni.** Five aligned controls per student, notes in place, complete
  weekly grids, and student history that opens on the exact session.

## 2. Deferred

Out of scope until the owner changes it and the plan is updated first:

- the final product name, a derived CVC/EXE/Helper mark and a broad custom icon
  programme;
- Instagram, background or menu-card photography;
- fault-part icon classification;
- advanced student sorting by age, sex or direction;
- voice commands that create students;
- evaluation-band hints in crew cards;
- special crew-size formulas beyond the D1/Cabinato start of four, and the
  D2–D5 size override in Impostazioni (deferred on 2026-09-24 and assigned by
  the owner to the follow-up after the 0.3.0 gate: a 0.4.0 candidate);
- automatic crew generation or optimisation;
- dashboards, course documents, PDFs and reference-material systems;
- image exports other than the crew and Comandate summaries;
- course locking beyond the read-only past courses of 0.7.0, version history
  and a general Undo (who changed what arrives with 1.0.0, §4);
- synchronised horizontal timelines and search;
- native packaging and platform-specific brightness control.

A backend, sign-in, sharing, several courses and team editing are not deferred
indefinitely: §4 schedules them.

## 3. Conditional evidence, not optional scope

- **Device evidence.** OCR and speech are in scope. Their acceptance needs the
  owner's evidence from physical devices (`docs/DEVICE_CHECKS.md`). A missing
  device may hold a milestone open, but it never justifies a simulated PASS or
  removing the feature.
- **Speech timing** is measured and reported; no fixed threshold is part of
  scope.
- **OCR quality.** S4 closed the target on the clearest photograph. No lower
  confidence threshold and no silent name error is approved.
- **Boat logos** are shown by the owner's authorisation of 2026-09-18. The
  written model is the fallback whenever an asset is missing, and provenance
  remains the owner's responsibility; nothing here asserts a licence.
- **The name.** `CVC Helper` is the provisional name.

## 4. The road to a shared database

The owner's decisions of 2026-10-08.

**Objective.** The eventual goal is a course team that edits one course
together; that is 1.0.0. Before it, the 0.x releases deliver, in this order,
an online backup, read-only sharing and the season's history.

**Who.** Through 0.x the owner reads and writes, and their course team reads
only. In 1.0.0 the owner and their team read and write.

**Backend.** Managed Supabase and PowerSync Cloud, both hosted in the EU
(`03_TECHNICAL_DECISIONS.md` §1).

**Data.** Development and testing use fictional rosters only. The owner will
present the tool to the centre when it is ready; students sign a release, which
the owner considers sufficient. Before the first real roster goes online, the
owner confirms that the release covers storing the roster in this service and
how long it is kept.

**Offline first, always.** Every release keeps the course fully usable on the
phone without a network.

| Version | Delivers                                                                                                                                                                         | Who writes            |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 0.4.0   | Local data readiness: record metadata and course ownership, duty settings as rows, version compatibility and reliable updates, export, import, persistent storage and full reset. No server. | the owner, one device |
| 0.5.0   | Online backup: the owner signs in, the course is copied to the server and kept up to date from the owner's devices, it can be restored on a new device, and erasing it erases it on the server. | the owner            |
| 0.6.0   | Read-only sharing: the course team is invited to read the course, sees changes as they happen, and can be removed.                                                                | the owner             |
| 0.7.0   | Season history: several courses per account, past courses kept read-only, a new course started without erasing the last.                                                        | the owner             |
| 1.0.0   | Team editing: the owner and the team read and write, with conflict rules, a record of who changed what, roles, and an explicit stability decision.                                | the owner and the team |

**0.4.0 scope:** the milestones H1, D1–D4 and UG3 in
`04_IMPLEMENTATION_PLAN.md`, plus whichever candidates the owner picks from
`docs/working/BACKLOG.md` (the UG2 field fixes and the D2–D5 size override).
Server, account and synchronisation code, multiple courses per device, and
conflict handling stay out of 0.4.0.

## 5. Completion boundary

A release is complete when `AGENTS.md` §17 holds and its gate in
`04_IMPLEMENTATION_PLAN.md` passes. In every release, every deferred item
(§2, and everything §4 assigns to a later release) remains absent or
explicitly isolated, and the 0.1.0, 0.2.0 and 0.3.0 fixtures open under the
final schema without losing a record, reference, value, note or history.
