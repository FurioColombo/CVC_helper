# Scope — released baseline and the road to 1.0.0

Sections 1–6 preserve the released 0.1.0–0.3.0 scope; H1 rewrites them in the
present tense. Section 7 sets the active boundary: 0.4.0 and the versions after
it. Product semantics live in `01_PRODUCT_SPEC.md`; milestone order and
evidence live in `04_IMPLEMENTATION_PLAN.md`.

## 1. Completed 0.1.0 baseline

Version 0.1.0 is the completed local-first MVP represented by baseline commit
`c907b19`. Its completion is historical fact and is not redefined by this cycle.

The baseline supports one persistent course, students and knowledge data, local
scan/review, volunteers ADV/IS, boats and faults, Comandate, manual crew
composition with A terra/Mezzi, crew warnings/read mode, evaluations/history,
local Italian transcription and an installable mobile-first PWA.

The 0.1.0 completion ledger is archived at
`archive/v0.1.0/04_IMPLEMENTATION_PLAN.md`. Its known non-blocking limitations do
not silently become 0.2.0 requirements.

## 2. Objective of 0.2.0

Make the existing end-to-end workflow faster, clearer and more reliable during
real field use, while preserving local data and the current architecture.

The cycle prioritizes:

1. information needed for one decision visible together;
2. compact portrait layouts without horizontal scrolling;
3. direct, reversible interactions with local feedback;
4. reliable OCR/STT with honest review and fallback;
5. compatibility with data created by 0.1.0;
6. verifiable behavior rather than visual resemblance alone.

## 3. Included in 0.2.0

### Shared UI and shell

- the approved CVC visual language, compact tokens/components and responsive
  behavior in P01–P19;
- dynamic D/C-level-week-year course identity;
- intact CVC symbol, six Home cards and correct bottom-navigation visibility;
- consistent touch targets, focus, safe area, autosave/error and accessible state
  cues;
- normalized boat-identity treatment with a neutral fallback when an asset cannot
  be used.

### Students

- compact two-column list, deterministic base ordering and persistent Add action;
- profile/edit integration of XS–XL, initial note and distinct course/week note;
- up to two recent notes plus `Altre` and the shared weekly evaluation grid;
- safe permanent deletion only for never-used students, with complete reference
  check and disable fallback;
- camera/gallery acquisition, free rotation/crop, useful OCR, mandatory review and
  live scan counters;
- shared real Italian speech input in the initial-note panel.

### Boats, faults and volunteers

- multi-number boat parser with comma/whitespace/newline/semicolon handling,
  ignored empty tokens and deduplication;
- compact common boat/fault identity and clear availability/fault states;
- direct fault-state controls and shared in-panel speech input;
- CT role in addition to ADV/IS, embarks like staff and remains excluded from all
  student-only rules and counts.

### Comandate

- seven-day compact overview, localized warnings and assigned/total feedback;
- non-mutating proposal with `floor(N/D)` base and explicit
  `Giorni con più persone` for the remainder;
- direct P11-to-P13 day editing, two people per row, short day labels and complete
  add/remove/multiple-day feedback;
- existing midweek recalculation, completed-history preservation, priorities and
  manual override.

### Equipaggi

- compact composition with missing-person pool, separate volunteers, localized
  warning details and placed/total feedback;
- explicit and double-tap/click return to Disponibili;
- P14/P15 shared boat-state language, numeric ordering and persistent
  crew-to-boat assignment;
- session-local unlink that preserves crew members and other sessions;
- clean three-field announcement rows with readable model/logo treatment;
- existing A terra, Mezzi, copy, move/swap, warning and completeness semantics.

### Valutazioni

- five aligned vector controls on the same row as the student name, with second
  tap to clear and in-panel note/STT;
- complete non-scrolling weekly grids shared by profile, Riepilogo and history;
- compact labelled ordering, correct missing/neutral/color semantics, session
  notes and grouped AM/PM history.

## 4. Explicitly deferred

The following do not enter 0.2.0 unless a later human instruction changes scope
and the plan/evidence are updated first:

- final product name, derived CVC/EXE/Helper brand mark and a broad custom icon
  programme;
- Instagram/background/menu-card photography;
- optional fault-part icon classification;
- advanced student sorting by age/sex/direction;
- voice-created student-name commands;
- evaluation-band hints in crew cards;
- fixed special crew-size formulas for D1/cabin courses beyond even proposal and
  manual adjustment;
- automatic crew generation/optimization;
- dashboard widgets, course documents/PDFs/reference-material systems;
- image exports other than the crew and Comandate summaries;
- rich course archive/locking, audit/version history and generalized Undo;
- synchronized horizontal timelines/search;
- read-only sharing, backend, Auth, synchronization, conflicts or multiple editors;
- native packaging and platform-specific brightness control.

For 0.3.0, the owner explicitly lifted narrow deferrals on 2026-09-23:
the installed icon with the Home CVC mark and `HELPER` below it; a single-image
export of the **crew summary**; and better on-device roster OCR, including
line-fragment reconstruction. C1 gives D1/cabin courses a four-person starting
capacity with manual crew-card adjustment. D2–D5 stay fixed at two for the
0.3.0 gate; their Settings override and add/remove controls are deferred to the
final Claude Code follow-up. The final product name, a broad icon programme,
other image exports and remaining deferrals above remain deferred. The active
acceptance criteria are in `04_IMPLEMENTATION_PLAN.md`.

Also in 0.3.0: the V05 assistant path for rosters, beside on-device OCR (the
app states the format and sends nothing itself); the UX1/UX2 owner corrections
to crew composition, scan review, summary image and evaluation density;
by the owner's 2026-09-26 decision, an erase-and-start-new-course action in
Settings; and, by their 2026-09-28 decision (F3, F4), a Comandate summary that
is copied as an image like the crew summary. Read-only sharing, backend, Auth and synchronization stay deferred.

The owner moved the remaining S4 fewer-than-five review-flag target to a final
Claude Code follow-up after the 0.3.0 gate. It is not a gate prerequisite. The
implemented OCR path and its privacy, confidence, visible-text and device-check
requirements remain in scope; this does not approve silent name errors or a
lower confidence threshold.

## 5. Conditional evidence, not optional scope

OCR and STT are included. Their acceptance needs physical-device evidence during
their milestones. Missing access to a device may hold that milestone open, but it
does not justify a simulated PASS or silently remove the feature.

**Amended 2026-09-21 by the owner** (`docs/post-mvp/0_3_0_OWNER_BRIEF.md` section
1.1). The physical-device evidence for OCR and STT moves from UG1 to UG2, because
the phone checks need a trusted HTTPS origin the app does not have and providing
one is the first 0.3.0 milestone. The PC microphone check could have run over
localhost and simply was not; it moves with the other two rather than being
claimed. It is re-scoped, not waived, and the rule above stands
unchanged: no simulated PASS, and the feature is not removed. 0.2.0 therefore
ships with that limitation stated in `CHANGELOG.md`.

Boat logos supplied during design were treated as references, not assumed
licensed production assets, and the approved neutral text/model fallback shipped
in their place.

The owner authorised their use on 2026-09-18. The marks are now shown, and the
written model remains the fallback whenever an asset is missing or cannot be
decoded, so a boat is always identifiable. Provenance remains the owner's
responsibility; nothing here asserts a licence.

`CVC Helper` is the provisional usable name for 0.2.0. A final name/derived mark is
deferred and does not block the cycle.

Speech timing is measured and reported; no fixed threshold is part of scope.

## 6. Completion boundary

Version 0.2.0 is complete only when:

- every included traceability row in `04_IMPLEMENTATION_PLAN.md` has a completed
  milestone and required evidence;
- every deferred item remains absent or explicitly isolated;
- the 0.1.0 compatibility fixture opens under the final schema without record,
  reference, value, note or history loss;
- `npm run verify:all`, the deterministic full-week scenario and the required
  browser checks pass (the physical-device checks were moved to UG2 on
  2026-09-21, see section 5);
- final functional, field-UX/accessibility, data-integrity, regression, scope and
  code-quality reviews have zero blockers;
- package/lock and `CHANGELOG.md` describe 0.2.0 and the working tree is clean after
  the release checkpoint.

## 7. After 0.3.0: toward a shared database

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
`04_IMPLEMENTATION_PLAN.md`, plus any UG2 field fixes the owner picks.
Server, account and synchronisation code, multiple courses per device, and
conflict handling stay out of 0.4.0.
