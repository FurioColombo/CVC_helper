# Scope — baseline 0.1.0 and cycle 0.2.0

This document defines what the active cycle must and must not deliver. Product
semantics live in `01_PRODUCT_SPEC.md`; milestone order and evidence live in
`04_IMPLEMENTATION_PLAN.md`.

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
- image exports for crews or Comandate;
- rich course archive/locking, audit/version history and generalized Undo;
- synchronized horizontal timelines/search;
- read-only sharing, backend, Auth, synchronization, conflicts or multiple editors;
- native packaging and platform-specific brightness control.

## 5. Conditional evidence, not optional scope

OCR and STT are included. Their acceptance needs physical-device evidence during
their milestones. Missing access to a device may hold that milestone open, but it
does not justify a simulated PASS or silently remove the feature.

Boat logos supplied during design are references, not assumed licensed production
assets. Lack of proven provenance uses the approved neutral text/model fallback
and does not block implementation.

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
- `npm run verify:all`, the deterministic full-week scenario and required browser
  and physical-device checks pass;
- final functional, field-UX/accessibility, data-integrity, regression, scope and
  code-quality reviews have zero blockers;
- package/lock and `CHANGELOG.md` describe 0.2.0 and the working tree is clean after
  the release checkpoint.
