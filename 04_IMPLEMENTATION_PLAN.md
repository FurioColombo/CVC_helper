# Implementation Plan — 0.2.0 UX cycle

This is the active execution ledger for the 0.2.0 cycle. The completed 0.1.0
ledger is archived at `archive/v0.1.0/04_IMPLEMENTATION_PLAN.md`; its milestones
remain complete and must not be reopened.

**Baseline:** app 0.1.0 at commit `c907b19`.

**Frozen design target:** `docs/post-mvp/mockups/` at commit `ee8d4c8` (mock r10).
The target defines composition, hierarchy, states and interaction. It is not
production code and does not prove persistence, accessibility or domain rules.

## Operating contract

1. Work on one milestone at a time and complete the page order written below.
2. Before implementation, read this plan and the relevant sections of
   `docs/post-mvp/06_DESIGN_RULEBOOK.md` and
   `docs/post-mvp/07_PAGE_CHANGELOG.md`.
3. Compare against the frozen mock at 320 × 664, 390 × 844 and 412 × 915 CSS
   pixels, plus the real device/browser checks required by the milestone.
4. Preserve the 0.1.0 data compatibility fixture. Any schema change must extend
   the migration test before it changes production data.
5. A visual match never replaces functional, persistence, invariant or
   accessibility evidence.
6. Follow the milestone lifecycle and reviewer policy in `AGENTS.md`. Update the
   completion log before the checkpoint commit.

## Frozen 0.2.0 scope and traceability

Each change-request family has one disposition here. Details live in the
authoritative specification and page changelist.

| Request IDs | Disposition | Canonical area | Milestone / target |
| --- | --- | --- | --- |
| UX-G01–UX-G04, UX-G06–UX-G07 | INCLUDED | Product-wide field UX | U01–U10 / all pages |
| UX-G05 | INCLUDED for small informative icons and fallbacks; broad custom set deferred | Product-wide UI | U01–U10 |
| BRAND-01 | INCLUDED with provisional CVC Helper identity | Home/shell | U01 / P01–P02 |
| BRAND-02 | DEFERRED pending final name/derived mark | Branding | backlog |
| ICON-01 | DEFERRED as a broad custom icon programme | Visual assets | backlog |
| STT-001 | INCLUDED | Shared text panels | U03, U06, U10 / P05, P09, P17 |
| OCR-001 | INCLUDED | Student scan | U04 / P06 |
| STUD-01–STUD-04, STUD-06–STUD-09 | INCLUDED | Students | U02–U04 / P03–P06 |
| STUD-05 | INCLUDED for surname then display-name ordering; advanced selector deferred | Student list | U02 / P03 |
| BOAT-01–BOAT-02 | INCLUDED | Boats/fault identity | U05–U06 / P07–P09, P15 |
| VOL-01–VOL-03 | INCLUDED | Volunteers/crew pool | U07 / P10, P14 |
| CMD-01–CMD-08 | INCLUDED | Comandate | U08 / P11–P13 |
| CREW-01–CREW-10 | INCLUDED | Equipaggi | U09 / P14–P16 |
| FAULT-01–FAULT-02, FAULT-04 | INCLUDED | Avarie | U06 / P09 |
| FAULT-03 | DEFERRED; neutral icon/text fallback remains required | Fault part icons | backlog |
| EVAL-01–EVAL-08 | INCLUDED | Valutazioni/history | U10 / P17–P19 |

The cycle also defers Instagram photography, dashboards, synchronized/backend
work, native brightness control, image exports, automatic crew generation,
evaluation-band hints in crew cards, advanced student sorting, generalized
content/document areas, synchronized horizontal timelines, and fixed crew-size
formulas for non-D2–D5 courses. Those courses retain an even initial proposal
and unrestricted manual adjustment.

No product question blocks implementation. `CVC Helper` and the current CVC
symbol are provisional but usable. Boat marks in the mock are optical references;
production may use the supplied asset only when its provenance permits it, and
must otherwise use the same-size neutral text/model fallback. Speech latency is
measured and reported rather than judged against an invented fixed threshold.

## Common evidence contracts

- `verification.json`: machine-recorded commands, all PASS.
- `browser-evidence.json`: target revision, commit under test, scenarios,
  viewports/browsers, assertions and selected screenshot paths.
- Review JSON: `verdict` (`PASS` or `PASS_WITH_FINDINGS`), empty `blockers`,
  `importantFindings`, `qolFindings` and non-empty `evidenceInspected`.
- Device evidence for OCR/STT records device, OS, browser/version, fixture or
  input, observed result, timing where relevant and verdict. Simulated tests are
  labelled as such and cannot replace a required physical check.

## U00 — 0.2.0 activation and compatibility foundation

**Category:** FOUNDATION
**Status:** COMPLETE

### Goal

Leave one concise authoritative document set, freeze scope/targets, extend the
existing harness for this cycle and prove the 0.1.0 baseline remains readable.

### Required work

- Consolidate current behavior and approved 0.2.0 rules in `01`–`03` without
  chronological duplicate appendices.
- Archive planning conversations and the completed 0.1.0 ledger; keep only the
  rulebook, page target and mock in the active design path.
- Register U00–U10/UG1 in the controller without changing old completion state.
- Make verification scripts manifest-driven; validate structured reviewer
  verdicts and refusal paths.
- Align package/lock version to the 0.1.0 baseline. Reserve 0.2.0 for UG1.
- Add an anonymous 0.1.0 compatibility fixture and deterministic round-trip,
  invariant and row-count checks. Future migrations must reuse it.
- Run the full baseline on Node 24 and make CI run the same deterministic surface.

### Required evidence

- `.evidence/U00/verification.json`
- `.evidence/U00/controller-refusal.txt`
- `.evidence/U00/compatibility-v0.1.0.json`
- `.evidence/U00/self-review.json`

### Acceptance criteria

- No unresolved item remains in active scope or target documents.
- Default read order is `AGENTS` → `01` → `02` → `03` → `04`; design material is
  read on demand and history is outside that path.
- Old milestones retain their exact status; the controller refuses missing,
  failed or blocker-bearing evidence.
- `npm run verify:all` passes under Node 24 and CI includes full-week plus E2E.
- The compatibility fixture round-trips without record loss and passes invariants.

### Completion log

Completed 2026-09-06.

- Consolidated the authoritative read path and reduced `01_PRODUCT_SPEC.md` from
  1,268 lines of layered revisions to one 545-line product contract.
- Froze included/deferred scope and P01–P19 mock r10 at checkpoint `ee8d4c8`,
  including the RS Toura naming correction. Archived the completed 0.1.0 ledger,
  questions, review history and original annotated sources.
- Registered U00–U10/UG1, manifest-driven verification and structured review
  refusal. The controller self-test rejected missing evidence, failed verification
  and a review with a blocker.
- Aligned package/lock to baseline 0.1.0. Added the anonymous 22-row compatibility
  fixture across all 13 baseline tables; JSON round-trip, references and domain
  invariants pass.
- `npm run verify:all` passed on Node 24.19.0: 236 tests, repository/domain/
  compatibility checks, production PWA build, deterministic full week and 45
  Playwright journeys with one intentional duplicate-week skip.
- CI now runs the same `verify:all` surface after installing Chromium/WebKit.

Known non-blocking baseline noise: Vite's local OCR asset plugin warns that
`emitFile` is unsupported in serve mode; PowerSync warns that multiple-tab support
is disabled; production build reports two chunks over 500 kB. OCR behavior still
passes and multi-tab/sync remain outside 0.2.0. The host PATH exposes Node 18, so
the verified workflow uses the bundled Node 24 instead of lowering requirements.

## U01 — Visual foundation, Home and course shell

**Category:** FEATURE
**Status:** COMPLETE

### Goal

Implement shared visual tokens and P01 then P02 without changing domain behavior.

### Scope and target

P01–P02, BRAND-01 and the common UX rules. Use mock r10 at frozen commit
`ee8d4c8`; no Instagram imagery or final derived brand mark.

### Required behavior and evidence

- Preserve the complete CVC symbol; keep unwanted organization wording outside
  the visible mark.
- Home has six compact cards, approved orange/blue grouping and three-item bottom
  navigation. Creation hides bottom navigation.
- Course identity renders dynamically as `D2 - 35 | 2026` style: D/C, selected
  level, ISO week and year all come from the active course.
- Add component/domain checks, a relevant browser journey at all three viewports,
  persistence/reload and a field-UX self review.
- Required files: `verification.json`, `browser-evidence.json`,
  `self-review.json` under `.evidence/U01/`.

### Acceptance criteria

No horizontal overflow or cropped symbol; navigation/focus/safe-area behavior is
correct; dynamic course values survive reload; design differences are recorded.

### Completion log

Completed 2026-09-07.

- Added the shared CVC blue/orange, paper, surface, line and focus tokens used by
  the frozen target. The Home shell now uses six compact cards with the approved
  orange/blue grouping and a flat three-item safe-area navigation.
- Replaced the generic mark with a transparent production asset containing the
  complete CVC symbol and no organization wording. Launcher/PWA icons remain
  unchanged because the final derived application mark is deferred.
- Added one canonical presentation formatter and reusable course identity. Home,
  first-launch preview and Settings derive D/C, level, ISO week and year from the
  persisted fields while retaining the 0.1.0 `label` and schema unchanged.
- Course creation keeps bottom navigation absent. Its mark-above-form treatment
  is an intentional first-launch adaptation because no valid back destination
  exists.
- `npm run verify` passed on Node 24.19.0 with 238 tests, domain/0.1.0
  compatibility, production PWA build and repository checks. Focused Playwright
  journeys passed on Chromium Android, Chromium iPhone viewport and WebKit.
- Browser evidence covers 320×664, 390×844 and 412×915, plus 320 px at 200% text:
  no horizontal overflow, complete mark, at least 44 px targets, focus transfer,
  reload persistence and fixed-navigation clearance. P03 received a visual token
  smoke check.

## U02 — Student list, profile and lifecycle

**Category:** RULE_HEAVY
**Status:** COMPLETE

### Goal

Implement P03 then P04, including safe student edits/deletion and the shared
weekly evaluation grid.

### Required behavior and evidence

- Two-column compact list, surname/display-name ordering, long-name/duplicate,
  minor, inactive and empty states; floating Add action never covers content.
- Profile uses lighter note typography, `Modifica`, XfS–XL, initial note and a
  distinct course/week note in the same form, two recent notes plus `Altre`, and
  the P18/P19 weekly grid.
- Deletion succeeds only for never-used students. Any persisted operational or
  historical reference blocks deletion, lists the reasons and offers disable.
  It is atomic, confirmed and never cascades.
- Test each reference class, reload/autosave/error paths, keyboard/focus, narrow
  viewport and course reference date for age/minor status.
- Required files: `verification.json`, `browser-evidence.json`,
  `data-integrity-review.json` under `.evidence/U02/`.

### Acceptance criteria

All product rules and invariants pass; no referenced student is partly deleted;
the profile remains compact and complete without horizontal scrolling.

### Completion log

Completed 2026-09-07.

- Reworked P03 into a compact two-column list with deterministic display-name
  ordering, explicit minor/inactive states and a fixed Add action that remains
  clear of content and navigation at the 320 px stress width.
- Reworked P04 into a compact profile and one complete edit surface for personal
  data, XS–XL, initial note and a distinct course note. Serialized autosave keeps
  the latest draft, reports failure in place, supports retry and refuses to leave
  the form until the latest valid draft is persisted.
- Added the reusable seven-day AM/PM evaluation grid with canonical ordering,
  colored values, blank missing values, recent notes and no horizontal scroll.
- Added atomic permanent deletion for never-used students. Duty assignments,
  stay-over settings, crew membership including orphan rows, land assignments and
  value- or note-bearing evaluations block deletion globally and produce visible
  reasons; disabling remains available.
- Added a nullable `courseNote` field with a production normalization boundary.
  A real 0.1.0 PowerSync fixture retained all 22 rows and all legacy fields after
  upgrade and a second reopen; the new note also persisted across that reopen.
- `npm run verify` passed on Node 24.19.0 with 34 test files and 256 tests,
  repository/domain/0.1 compatibility checks and the production PWA build. Eight
  focused browser journeys passed on Pixel 7 Chrome and the iPhone 13 Chromium
  viewport, including the 320×664 stress layout.
- Independent data-integrity review returned `PASS_WITH_FINDINGS` with no
  blockers. The recorded non-blocking gap is that the real SQLite deletion gate
  and the visible confirmation/reason UI are exercised in separate test layers;
  both layers pass and no correctness or preservation defect was found.

## U03 — Student knowledge and shared speech capability

**Category:** FEATURE
**Status:** COMPLETE

### Goal

Implement P05 and make the real local Italian STT path reliable as a shared
capability for later P09/P17 use.

### Required behavior and evidence

- Compact rows keep names on one line where possible and controls inside cards.
- Direct XS–XL selection and the initial-note editor share the profile data.
- Dettatura stays in the same panel: permission only after tap, honest asset
  loading/recording/processing/review/error states, typed text preserved and
  transient audio discarded.
- Automated audio fixtures plus physical PC, Android and iPhone checklist. Record
  latency and accuracy observations without a fixed pass threshold; a required
  physical result cannot be replaced by a mock provider.
- By explicit human instruction on 2026-09-08, the three physical observations
  may be recorded later at UG1 so implementation can continue. They remain a
  release blocker and cannot be replaced by automated evidence.
- Required files: `verification.json`, `browser-evidence.json`,
  `speech-device-evidence.json`, `self-review.json` under `.evidence/U03/`.

### Acceptance criteria

The automated transcription boundary is reviewable and recoverable; persistence
and shared-note behavior pass; no card action overflows at stress width. The real
PC, Android and iPhone result must pass before UG1 closes.

### Completion log

Completed 2026-09-08 with the physical validation explicitly deferred to UG1.
`npm run verify` passes with
35 test files and 270 tests. The complete regression matrix passed with 59
journeys plus two intentional project-matrix skips before the final responsive
addendum; the updated U03 matrix passes 12 journeys. Physical microphone and
Italian transcription observations on PC, Android and iPhone remain required at
the final release gate.

## U04 — Student scan and review

**Category:** FEATURE
**Status:** COMPLETE

### Goal

Implement P06 as camera/gallery acquisition followed by a reliable human review.

### Required behavior and evidence

- `Scan allievi` offers gallery or full-screen camera; capture supports free
  rotation and crop before extraction.
- Review cards remain compact and editable. Sticky live counts show rows to
  review, missing fields and students ready/inserted.
- Use an anonymous/synthetic corpus with field/person truth, low-confidence and
  false-row cases; report correct fields attached to the correct person and the
  share of readable fields. Aim near 90% on typical fixtures, with retake/manual
  fallback and no false claim when the source is poor.
- Add browser and physical-phone evidence; never retain source photos as user data.
- Required files: `verification.json`, `browser-evidence.json`,
  `ocr-quality-evidence.json`, `self-review.json` under `.evidence/U04/`.

### Acceptance criteria

Review is mandatory before commit; partial reliable fields survive; correction,
removal, commit, reload and poor-image recovery pass on the target phone.

### Completion log

Implemented separate native camera/gallery acquisition, full-screen arbitrary
rotation and crop, compact mandatory review with live counters, conservative
partial-field extraction, false-row filtering/removal, guarded retryable commit
and transient image handling. The bounded anonymous corpus reports 34/34
readable fields attached to the correct person; the real poor raster is rejected.
The installed production PWA completes its first OCR scan offline. Android-like
and iPhone-like Chromium pass at the corrective HEAD at 320 px and 200% text,
including focus clearance below the sticky counters. WebKit passed the same U04
matrix at implementation checkpoint `327c59e`; the current-host rerun was killed
for memory before interaction. Image confirmation is also covered under React
Strict Mode. By explicit human instruction on 2026-09-08, physical Android Chrome
and iPhone Safari observations move to UG1 and remain a hard release blocker.

## U05 — Boats and course availability

**Category:** RULE_HEAVY
**Status:** COMPLETE

### Goal

Implement P07 then P08 with compact identity and availability/fault separation.

### Required behavior and evidence

- Parse boat numbers separated by commas, whitespace, newline or semicolon;
  repeated separators create no empty boat and model+number duplicates collapse.
- Preserve canonical course/default models. First configuration shows existing
  boats if reached again and prevents accidental duplicates.
- Use normalized model marks only when permitted; otherwise the same-size text
  fallback. Number stays legible at two digits in the stress viewport.
- `Disponibile` is neutral; `Da controllare` is yellow; unavailable is grey.
  Fault-derived state remains independent from course availability.
- Test all models, duplicates, disable/delete/history and reload; perform an
  adversarial domain review.
- Required files: `verification.json`, `browser-evidence.json`,
  `domain-review.json` under `.evidence/U05/`.

### Acceptance criteria

Canonical mappings and invariants pass, existing history remains intact and no
identifier/status is cropped or conveyed by colour alone.

### Completion log

Completed at implementation checkpoints `e154eec` and `fc8881f`. Canonical
defaults, normalized parsing/deduplication, course ownership, numeric ordering,
history-safe deletion and availability/fault separation are enforced in domain
and persistence tests. The compact list uses equal-size text model marks,
two-digit identifiers and labelled/icon state cues. At 320 × 664 with 200% text,
the heading, return path, actions, identity and status remain inside the viewport.
The Pixel browser matrix passes 12/12 journeys and the existing boat regression
passes. Full Node 24 verification passes 37 files/303 tests, domain checks,
0.1.0 compatibility and the production PWA build. Independent adversarial
review is `PASS_WITH_FINDINGS` with no blockers or important findings; the
remaining deletion-pending polish is non-blocking and the cross-engine/physical
release sweep remains in UG1.

## U06 — Fault workflow

**Category:** FEATURE
**Status:** COMPLETE

### Goal

Implement P09 using the boat identity language and shared speech capability.

### Required behavior and evidence

- Compact cards retain a useful fault preview, light body text, boat mark/model
  and number, yellow accent for unresolved items and slightly shorter controls.
- Open/reported/resolved are direct, distinct selections; changing fault state
  never changes course availability.
- Typed and dictated descriptions share one popup/panel; no separate P20 page.
- Test long/multiple faults, every state, error/retry, reload and no-audio
  persistence. Reuse U03 device evidence and add a P09 real-path check.
- Required files: `verification.json`, `browser-evidence.json`,
  `self-review.json` under `.evidence/U06/`.

### Acceptance criteria

Description, chronology, state and boat identity remain correct after reload;
the UI stays recoverable under repeated taps and save failure.

### Completion log

Completed 2026-09-09. P09 now uses compact shared boat identities, expandable
three-line fault previews, direct state controls and the shared in-panel local
dictation flow. State writes drain rapid choices before one refresh; edits and
failed saves remain recoverable. The Pixel browser journey covers long and
multiple faults, all states, a real SQLite save failure/retry, reload ordering,
availability independence, no-audio persistence and 320 px/200% reflow. Full
Node 24 verification passes 37 files/310 tests, domain and 0.1.0 compatibility
checks, and the production PWA build. Independent follow-up review has no
blockers; physical speech and cross-engine release observations remain in UG1.

## U07 — Volunteers and CT

**Category:** RULE_HEAVY
**Status:** COMPLETE

### Goal

Implement P10 and add CT compatibly across volunteer and crew rules.

### Required behavior and evidence

- Add/edit name and direct ADV/IS/CT role selection; new form starts empty.
- Use `Volontari disponibili` in crews and omit permanent explanatory copy.
- CT can embark and persists like ADV/IS, but never counts as a student and is
  excluded from Comandate, student completeness and Valutazioni.
- Extend the 0.1.0 compatibility fixture/migration proof and canonical role table;
  test all affected pools/counts/invariants and run a domain review.
- Required files: `verification.json`, `browser-evidence.json`,
  `domain-review.json` under `.evidence/U07/`.

### Acceptance criteria

Old ADV/IS data opens unchanged; CT survives reload and appears only in allowed
contexts; no existing student/business calculation includes staff.

### Completion log

Completed 2026-09-10. P10 now supports empty-name creation and direct ADV, IS
and CT selection, with course-scoped edit/reload persistence. The crew pool uses
the exact `Volontari disponibili` label; CT can embark and persist while every
student-only count, Comandata, land assignment and evaluation excludes staff.
The 0.1.0 compatibility fixture preserves existing ADV/IS rows byte-for-byte.
Node 24 verification passes 37 files/321 tests, domain checks, 22 compatibility
rows and the production PWA build. Dedicated Pixel/iPhone viewport journeys,
the Pixel full-week flow and independent adversarial review pass; cross-engine
and physical-device release observations remain in UG1.

## U08 — Comandate week, proposal and direct editing

**Category:** RULE_HEAVY
**Status:** COMPLETE

### Goal

Implement P11, then P12, then P13 as one coherent duty workflow.

### Required behavior and evidence

- P11 shows seven top-aligned cards, day/name divider, localized vector warnings
  and sticky unique assigned/total feedback; completed history stays immutable.
- P12 preview does not mutate data. Assign base `floor(N/D)` to every remaining
  day and require exactly `N mod D` selected `Giorni con più persone`; preserve
  Friday stay-over, minor/optional-sex priorities and deterministic tie-break.
- P13 opens directly from a day. Sections are current, never assigned, assigned
  elsewhere; two students per row, Lun–Dom labels, neutral clickable name with a
  discreet plus and compact per-day removal. Multiple days remain allowed and
  all are shown with the red warning icon. No duplicate instruction banner.
- Exhaustive/table-driven distribution and warning tests, current/midweek states,
  manual override, acknowledgement, reload, stress tap and adversarial review.
- Required files: `verification.json`, `browser-evidence.json`,
  `domain-review.json` under `.evidence/U08/`.

### Acceptance criteria

Preview totals always reconcile; confirm is the only mutation; completed days are
unchanged; warnings name the affected day/person and never block valid overrides.

### Completion log

Implemented in checkpoints `c25ac48` and `0579386`. The proposal now derives
`floor(N/D)` and requires the exact explicit remainder days, with a pure preview
and transactional protection for completed history. P11/P13 use the approved
compact layouts, localized severity-aware warnings, unique coverage and direct
reversible editing. Verification passed with 341 tests, domain/0.1.0
compatibility checks, production PWA build, Pixel/iPhone journeys, a full-week
scenario and an independent adversarial review. Evidence: `.evidence/U08/`.

## U09 — Crew composition, boats and read mode

**Category:** RULE_HEAVY
**Status:** COMPLETE

### Goal

Implement P14, then P15, then P16 without conflating people, crews, destinations
or session boat selection.

### Required behavior and evidence

- P14 keeps session, missing-person pool, crew cards, warnings and counts in one
  field of view. Tap/move/swap remain primary. Double tap/click returns a member
  to Disponibili and an explicit accessible command provides the same action.
- Warning triangle opens all boat and crew reasons separately. A terra and
  Volontari stay accessible at the lower corners without covering content.
- P15 uses a two-row sticky boat strip with no horizontal scroll and numeric
  order. Grey = unavailable, blue = available/unassigned, green = assigned.
  Selecting a boatless crew then a blue boat persists one session-local mapping.
- Removing a session boat clears only that crew's boat link and preserves people
  and every other session. Unavailable assigned boats remain linked with red;
  unresolved faults are yellow. A boat cannot serve two crews in one session.
- P16 uses three compact fields: crew number, recognizable model/logo plus boat
  number or no boat, and people. It remains usable without exact boat assignment.
- Test flexible crew sizes, long names, 0/>5 boats, A terra/Mezzi/CT, copy previous,
  repeated taps, reload and invariants. Run domain and field-UX reviews.
- Required files: `verification.json`, `browser-evidence.json`,
  `domain-review.json`, `field-ux-review.json` under `.evidence/U09/`.

### Acceptance criteria

Each person and boat is unique per session, all counts reconcile, all changes are
directly reversible and persisted, and the announcement view stays clean.

### Completion log

P14–P16 now use direct reversible person and boat actions, session-local boat
links, distinct crew/boat warnings, and a compact read view. The persistence
boundary validates course-scoped references and rejects stale writes before
replacing crew rows. Verification passed on Node 24.19.0: 359 tests, domain and
0.1.0 compatibility checks, production PWA build, Pixel/iPhone journeys, legacy
crew regressions and a deterministic full-week scenario. Independent domain
review passed; independent field-UX review found no blocker. The two-row boat
strip remains relatively tall at 320 px with a large fleet and should be
monitored in the final integration gate. Evidence: `.evidence/U09/`.

## U10 — Evaluation entry, overview and student history

**Category:** FEATURE
**Status:** COMPLETE

### Goal

Implement P17, then P18, then P19 with one shared evaluation representation.

### Required behavior and evidence

- P17 keeps full name and five aligned vector controls on one row. Values are
  `++`, `+`, `=`, `-`, `--`; a second tap clears selection; no sixth absence
  button. The name opens the in-place note panel and shared STT path.
- P18 uses a 40 px name row, labelled compact ordering controls and one aligned
  seven-day × AM/PM grid per student. It never scrolls horizontally.
- P19 places the same complete grid at the top, then a sticky student title and
  compact day cards containing AM/PM sessions. Empty marks are blank; positive
  and negative states keep green/red plus a non-colour symbol.
- No-evaluation stays distinct from neutral and excluded from the mean. Notes
  remain linked to the exact session. Both entry views edit one record.
- Test thirteen sessions, missing/neutral/note/A-terra, ordering, long names,
  keyboard/error/reload and real P17 speech reuse; perform self review.
- Required files: `verification.json`, `browser-evidence.json`,
  `self-review.json` under `.evidence/U10/`.

### Acceptance criteria

The shared grid and chronology agree everywhere; symbols/notes persist; no page
or card clips or scrolls horizontally at any contract viewport.

### Completion log

P17 now uses one full-name row with five aligned SVG marks, second-tap clearing,
session-specific notes, shared dictation states and retryable save feedback. P18
and P19 share the seven-day AM/PM grid already used by the profile; missing marks
remain blank, notes keep exact sessions and the chronology groups compact AM/PM
cards under a sticky full-name subject. Node 24.19.0 verification passed with
365 tests, domain and 0.1.0 compatibility checks and the production PWA build.
Pixel/iPhone browser journeys covered all thirteen sessions, 320 px and 200% text,
reload, denied-microphone recovery and the prior evaluation flows. Self-review
found no blocker; an unsaved evaluation after a storage error remains visible and
retryable, but leaving its session before retry can discard that attempted change.
Evidence: `.evidence/U10/`.

## UG1 — Full 0.2.0 integration and release gate

**Category:** INTEGRATION_GATE
**Status:** IN_PROGRESS

### Goal

Validate a realistic complete week upgraded from 0.1.0 and prepare release 0.2.0.

### Required work and evidence

- Run `npm run verify:all` and the complete deterministic week through the visible
  app, including close/reopen, midweek changes, CT, OCR/STT evidence and all P01–P19
  targets.
- Open the 0.1.0 fixture with the final schema and prove record/reference counts,
  values, notes and history remain intact.
- Compare the three contract viewports to mock r10; record intentional differences.
- Complete functional, field-UX/accessibility, data-integrity, regression, scope
  and code-quality reviews; zero blockers.
- Complete the deferred U03 physical microphone checklist on PC, Android and
  iPhone, plus native camera/gallery, orientation, crop, OCR review and source
  photo disposal checks on Android Chrome and iPhone Safari. Record a dedicated
  physical-device review; automated fixtures do not satisfy this release check.
- Set package/lock to 0.2.0, create concise `CHANGELOG.md`, update this log and make
  a clean release checkpoint. A Git tag is created only when the release is
  actually declared.
- Required files under `.evidence/UG1/`: `verification.json`,
  `browser-evidence.json`, `migration-evidence.json`, `functional-review.json`,
  `field-ux-review.json`, `data-integrity-review.json`,
  `regression-review.json`, `scope-review.json`, `code-quality-review.json`.
  Also require `physical-device-review.json`, which inspects the deferred U03
  device evidence in `.evidence/U03/speech-device-evidence.json` and the deferred
  U04 checks in `.evidence/U04/ocr-quality-evidence.json`.

### Acceptance criteria

Every included traceability row has implementation and evidence; every deferred
item remains absent or explicitly isolated; all deterministic checks and required
physical checks pass; reviews have no blockers; data survives; working tree is
clean after the release checkpoint.

### Completion log

Pending the required physical-device observations.

Deterministic release-candidate work completed 2026-09-15. `npm run verify:all`
passes on Node 24.19.0 with 372 unit/component tests, compatibility and domain
checks, the production PWA build, the deterministic full week, and 123 Playwright
journeys across Pixel Chromium, iPhone Chromium and iPhone WebKit (four intended
project-matrix skips). A visible course upgraded from the 0.1.0 fixture completes
all 13 sessions, adds CT, changes future duties and evaluations, closes/reopens,
and preserves every original row, reference, note and stable operational ID.
P01–P19 traceability, final screenshots and six independent reviews are recorded
under `.evidence/UG1/`.

The physical review remains `FAIL` because PC/Android/iPhone microphone checks and
Android/iPhone native camera, gallery, orientation, crop, OCR and photo-disposal
checks are still `NOT_RUN`. The package and lockfile therefore remain at 0.1.0;
the 0.2.0 version bump, release checkpoint and tag wait for those observations.

### Student scan redesign correction — 2026-09-16

Human-requested UG1 correction: replace the P06 adjustment surface with a full-screen, no-slider document editor (zoom/pan, direct crop and line-based/fine straightening), test both supplied real images locally, and make name/surname order an explicit review choice. Two Luna concepts are compared in `.evidence/UG1/scan-redesign/`; the selected direction and bounded implementation/review loop are recorded in `implementation-plan.md` there. This supersedes the P06 mock's slider interaction for this correction. Source images remain transient and are not committed. UG1 remains IN_PROGRESS pending its existing physical-device release evidence.

**Status 2026-09-18 — name order complete, editor redesign outstanding.**

The explicit name-order choice is implemented and verified. The parser now emits
a name reading for every multi-word name, preserving the words as read with the
order left `unknown`, so no row can claim the first token is a given name. The
review screen gates readiness on that choice, offers a per-row swap and confirm,
and a sheet-wide `Applica Nome · Cognome` / `Applica Cognome · Nome` that skips
rows the operator has already corrected by hand. The split is derived from the
words as read rather than by exchanging two fields, which keeps a surname
particle attached, makes repeated application idempotent, and leaves a genuinely
ambiguous compound blank and flagged instead of guessed.

Verified on the supplied roster photograph through the running interface: the
order section appears, nineteen rows offer a swap, and one tap turns
`Altomare / Valeria` into `Valeria / Altomare`. Covered by four capability tests
and four component tests.

The full-screen document editor from this correction is **not implemented**.
`StudentScanImageEditor` still presents the rotation slider that the Product
Specification paragraph above describes as removed, and has no zoom, pan or
line-based straightening. Its default crop no longer trims the frame, which was
removing the start of the surnames before OCR. Until the editor is rebuilt the
specification is ahead of the code on that paragraph, and this correction stays
open.

**Status 2026-09-19 — adjustment surface rebuilt.**

The full-frame document workspace replaces the rotation slider, closing the gap
recorded above: direct crop as before, zoom with bounded panning, straightening
from a line drawn along a rule, quarter turns, tenth-of-a-degree steps and an
exact angle. The dimming mask is clipped to the stage. The Product Specification
paragraph and the code now agree.

The previous surface was kept for comparison as `StudentScanImageEditorClassic`,
selected by `STUDENT_SCAN_EDITOR`. The comparison is over: the classic surface,
its tests and the switch were deleted on 2026-09-19 and `StudentScan` mounts the
document editor directly. Its history is in this repository if it is ever
wanted. Evidence: `.evidence/UG1/scan-document-editor.json`.

UG1 remains IN_PROGRESS for its physical-device release evidence, which now also
covers touch panning and the line gesture on a real phone.

**Status 2026-09-19 — brand marks and palette.**

Owner authorisation of 2026-09-18 lifts the deferral on the supplied boat logos.
They ship in `public/brand/boats/`, and `BoatModelMark` keeps the written model
as the fallback when an asset is missing or fails to decode, so the neutral
treatment is still what a reader falls back to rather than a gap.

The interface accents are now taken from the CVC mark rather than invented. The
mark's inks measure `#e04040` and `#3060a0`; the Home card accent becomes
`--accent-red: #cf3a35`, darkened for contrast on the light background, and the
blue accent and the primary action share `#2f5fa0` so the interface carries one
blue instead of three. The PWA icon still uses `#063b52` and is not yet aligned.

**Status 2026-09-19 — boat marks, dictation on every note, evaluation note preview.**

The RS Quest mark was cut on the right. The previous entry took the truncated
`rs-quest.png` from the mock's assets instead of `rs-quest-complete.png`, which
that folder's README names as the RS Quest asset; the complete artwork was in
the repository all along. It is now normalised the way the other six were.

All seven marks shared a `256 × 72` plate with wide empty margins, so
`object-fit: contain` fitted the plate rather than the artwork and a narrow mark
such as J/80 rendered at a fraction of the size of RS Quest. Each file is now
trimmed to its own artwork, which is what made the row uneven.

The artwork supplied for `First 27` reads `27.7`, which is the First 27.7 — a
different boat. That type falls back to the written mark until correct artwork
arrives; naming the wrong model on a card is worse than naming none.

The row itself follows the owner's choice of 2026-09-19 from the seven
treatments compared on 2026-09-19: the mark sits on the card
with no chip, the number is the second thing read, and a coloured rule down the
left carries the state. The vector state icons stay, because R06 and R20 want a
symbol per state rather than colour alone. The mark slot is sized in pixels, not
rem, so 200 % text grows the number and the state and not the decoration.

`* { border-color: var(--border) }` in `src/styles.css` was unlayered. Tailwind
emits its utilities inside `@layer utilities`, and an unlayered rule outranks
every layer whatever its specificity, so roughly seventy border colours across
the application were silently replaced by the neutral default — including the
grey, blue and green that R21 requires of the P15 boat selector. The default now
sits in `@layer base`. The state rule this entry adds cannot render without it.

Every note in the application can now be dictated. The trigger, the live status,
the transcript review and the failure panel were duplicated on three screens and
absent from three note fields; they are now `DictationTrigger`,
`DictationPanels` and `DictatedNoteField`, and the student card's two notes and
the fault card's description editor have gained dictation. About three hundred
duplicated lines went away in the process. Saving is blocked while a transcript
is unaccepted, so generated text cannot reach a record without a decision.

The evaluation row shows the note itself rather than the words "Nota presente",
clamped to two lines with the browser's ellipsis. The text stays whole in the
DOM, so assistive technology and text search still see all of it, and the save
status keeps its own live region so a note is never announced as a save state.
The clamp is verified graphically with a long string at 320 px and at 200 % text.

Evidence: `.evidence/UG1/boat-marks-notes-and-evaluation-preview.json`.

**Status 2026-09-19 — first full browser run since the scan rework.**

The scan editor rebuild, the name-order gate and the review rework were closed on
`verify:quick` and selected specs. The full Playwright suite was not run after
them, and the report of "e2e green across three device projects" in that entry
was not based on a full run. The first full run in this entry failed ten
journeys, most of them damage those entries had already done.

The one real defect: the scan review list overflowed the page by 179 px at
320 px with 200 % text. The list was a bare `grid`, whose implicit column is
`auto` and resolved to the widest card's max-content — 487 px inside a 296 px
container — and the two name-order buttons are each wider than a 320 px viewport
at that text size, so wrapping the row could not rescue it. On a phone at large
text the review cards ran off the side of the screen. Fixed with `grid-cols-1`
on the list, a wrapping card header and wrappable button labels; document and
card overflow both measure zero afterwards.

The rest were stale specs: `student-scan.spec.ts` and
`student-management-gate.spec.ts` still drove the rotation slider that
`StudentScanImageEditorDocument` replaced, and neither stated the sheet's name
order, which the gate now requires before a scanned row can be committed. Both
now drive the ruler dial and answer the order, which is the flow the screen asks
of an operator. `evaluation-overview.spec.ts` carried a latent race — a loose
`/Aldo/` heading match becomes ambiguous once the embedded history mounts its
own heading — and now names the heading exactly.

Two failures belonged to this entry and are fixed: `getByLabel("Nota iniziale")`
also matched the new "Detta nota iniziale" button, and the dictation trigger
beside a field label pushed the student form to 343 px at the stress viewport.

`npm run verify:e2e` now passes: 125 journeys, four intended project-matrix
skips, no failures, across Pixel Chromium, iPhone Chromium and iPhone WebKit.

**Status 2026-09-19 — chosen designs kept, alternatives removed.**

The boat row takes the number-first treatment: the number opens the row in its
own column so the marks stay aligned under one another whether the boat is 7 or
115, the mark follows it, the state closes it, and the coloured rule stays on
the left. The comparison page and its six rejected treatments are deleted;
keeping alternatives as evidence only invites drift.

The First 27 artwork read `27.7`. The digits are separable glyph runs, so
clearing the last one leaves `27` set in the mark's own typeface rather than a
number pasted in another face. The model number is now right; the seahorse plate
is still the older Beneteau First mark, which is what the supplied artwork uses
across the family. The mark is back in use and no longer falls back to text.

Removed as no longer used: `StudentScanImageEditorClassic`, its tests and the
`STUDENT_SCAN_EDITOR` switch, now that the document editor is the accepted
surface and `StudentScan` mounts it directly; the truncated
`mockups/assets/rs-quest.png`, superseded by the complete artwork beside it;
`rotationDeltaFromPoints`, the radial-handle helper the classic editor used; and
`forgetNameOrderPreference`, which never had a caller. The "dictation not
available" sentence was written out in six places and is now one default on
`DictationPanels`.

The dictation wiring that remains at each call site — a `useDictation` hook, a
naming pair and the two components — is the minimum for a screen that must also
observe the dictation state to gate its own save. It is not duplication that can
be factored away without giving each host a callback for state it already holds.

**Status 2026-09-20 — the repeated rows lose a line, and the markers become
badges.**

Human request of 2026-09-20, recorded here under the active milestone because
UG1 is the open one. Six changes, all to rows that repeat tens of times in a
week of use, plus one answer to a question about a shortcut.

`PersonBadges` is the new home of the four markers the rulebook's visual
dictionary names but which the code wrote out differently on each screen:
`MinorBadge` (white `M` on red), `DutyBadge` (`C` on blue, `SM` outlined for
the smontante), `SexIcon` and `VolunteerRoleBadge`. Allievi, Comandate and
Equipaggi now render the same `M`; before this, three screens drew three
different ones and Equipaggi drew none at all.

- **P03** — the student card drops from 84 px to 56 px and the sex stops being
  a letter. Mars, Venus and the neutral figure carry it, so the only `M` in a
  row is the minor badge, which R03's own brief asks for ("evitare tre M
  ambigue per sesso/taglia/minore"). Below 380 px the figure moves into the
  detail line rather than taking width from the name. A new card starts on
  `Altro`.
- **P04** — double click, or a long press on touch, on a profile field opens
  the edit form with that field focused. The Product Specification allowed this
  in section 3.3 and the P04 brief proposed exactly this behaviour; U02 closed
  without it and without recording the omission, so it was forgotten rather
  than deferred. `Modifica` remains the explicit path, which is what R09
  requires of an advanced gesture.
- **P10** — the volunteer row shows `ADV`, `IS` or `CT` where a hand-and-heart
  icon used to say "volunteer" three times identically. The duplicate role
  chip under the name goes, and the row drops to 56 px. The Home card keeps its
  own icon: it stands for the section, not for a person with a role.
- **P14** — crew number, boat and headcount share the header row. The
  destination control had a line of its own under the heading and cost every
  crew card about 3.5 rem; it keeps its accessible name, its unavailable-boat
  red and its 44 px target, and the row wraps instead of overflowing at 320 px
  and at 200 % text.
- **The badges and assistive technology** — a person button carries an
  `aria-label`, which replaces its content, so a badge inside it is silent.
  The first attempt appended the markers to that name. The full browser suite
  then failed four journeys that select a person by exact name, which is the
  right objection: the name of a control should be the person. The markers
  moved to `aria-description`, the arrangement P17 already uses, and every
  existing journey passes unchanged.
- **P17** — the note and the save state share the line under the evaluation
  row. They never compete: the state is empty except around a write. The live
  region stays mounted while empty, because a live region inserted together
  with its text is not announced.

Evidence: `.evidence/UG1/compact-rows-and-markers.json`, with
`tests/e2e/ug1-compact-rows.spec.ts` measuring the row geometry rather than its
styling, so the screens can keep moving without the spec becoming a pixel diff.

**Status 2026-09-20 — the boat marks did not fit their slot.**

Reported from the running app: on Barche the RS 500 and J/80 marks stood far
outside their rows, over the cards below them.

`BoatModelMark` sized the image with `h-full`. The slot is a grid with
`content-center`, which makes the row content-sized, so that percentage had
nothing definite to resolve against and every mark fell back to its intrinsic
60 px height inside a 36 px row. A wide mark was still capped by the column's
88 px and looked right, which is exactly why this shipped: every fleet the
browser suite ever rendered was RS Quest. The image now carries the slot's own
`h-[36px] w-[88px]` with `object-contain`.

`tests/e2e/ug1-boat-mark-fit.spec.ts` builds a fleet of all seven canonical
types and measures each image against its slot, which is the assertion that
would have caught it. The written mark remains the fallback, so a missing
asset still passes.

Open, and a product call rather than a defect: the First 27 artwork reads
`FIRST 27`, but the `27` is noticeably smaller than the `25.7` on the First
25.7 mark, because it is what was left after the `.7` glyph run was cleared on
2026-09-19. Either the artwork is redrawn or that type goes back to the written
fallback.

**Status 2026-09-20 — faces instead of symbols, and the boat state opens the
row.**

Two further owner requests after seeing the density pass running.

The sex figures are now drawn faces rather than the Mars and Venus symbols,
which read as symbols and not as people. No icon set in use has gendered heads,
so `PersonBadges` draws three on the set's own 24px grid: Uomo and Donna filled,
because at 18px a 2px outline loses the hair that tells them apart, with the
woman's hair half again as wide as the head; Altro keeps the outline figure
already in use, so the three differ in silhouette and in weight rather than in
an hairstyle alone. Judged at the size they are actually used, not at 64px.

On P08 the state opens the row: the circled check and the written label sit
right after the coloured rule and in the same blue, in a fixed-width column, so
availability reads down one column while scrolling and the numbers and marks
after it stay aligned. Below 380px the column releases and the identity wraps,
as it already did.

**Status 2026-09-20 — the number of crews can change after setup.**

Reported from the running app: eighteen students, ten crews chosen at setup,
then the decision not to embark volunteers left one crew empty with no way to
remove it. The count was fixed once the session was prepared, because the setup
screen only appears while the session has no crews at all.

An empty crew now carries the control that removes it on its own card, to the
right of its free slots. A crew holding someone does not show it at all, so
nobody is lost to a stray tap, and `removeEmptyCrew` refuses a crew with
members rather than throwing, so a stale tap does nothing. `Aggiungi
equipaggio` closes the list and makes the removal reversible without returning
to setup — the underlying complaint was that the number could not be changed,
not only that it could not be reduced. Both are session-local: A terra, the
boats going out and every other session are untouched.

`tests/e2e/ug1-crew-count.spec.ts` covers the pair through the interface,
including the reload that proves the change was persisted, and the two domain
functions have their own table of cases.

**Repository cleanup, 2026-09-20.** Asked for as three ranked tiers. Deleted
outright: `debug.log`, `test-results/` and `dist/` — all ignored, all
regenerated, and the last one a build from before the 2026-09-19 entries that
`npm run preview` and `npm run check:ocr-offline` were still serving.

The second tier went to an independent review agent, which kept more than it
removed and found four contained fixes instead: `noUnusedLocals` and
`noUnusedParameters` now on in both `tsconfig` projects (both compile clean,
and they catch unused private class members, which ESLint does not); the
`Intl.Collator` in `src/domain/evaluations.ts` hoisted out of the comparator
body, where it was allocated once per comparison; the nullable `left` in
`samePerson` guarded on both accesses in `CrewManagement`; and `CourseCode`,
exported and never used, adopted at the three sites that wrote
`keyof typeof COURSE_CONFIG` inline.

It found no dead specs: the older 0.1.0-era Playwright journeys each hold an
assertion the U-series ones do not, and two of them are the only WebKit
coverage of their area, because that project selects specs by filename. The
`.evidence/UG1/scan-redesign` concepts stay too — the shipped editor is a merge
of both, not a winner.

The tiers, their evidence and the five questions left for the owner are in
`.evidence/UG1/cleanup-inventory.json`. The search found little else, and the
reason is structural: ESLint already runs `@typescript-eslint/no-unused-vars`
at `--max-warnings 0`, so unused locals and imports cannot reach a commit.
Unused *exports* are the one category nothing checks — 36 of them exist, and 30
are the module's own API.
