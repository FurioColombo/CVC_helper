# Implementation Plan — 0.2.0 UX cycle and 0.3.0

This is the execution ledger. It holds the completed 0.2.0 UX cycle (U00–U10,
UG1) and the active 0.3.0 cycle (V01–V05, UG2), which begins at `# Cycle 0.3.0`
below. The completed 0.1.0 ledger is archived at
`archive/v0.1.0/04_IMPLEMENTATION_PLAN.md`; its milestones remain complete and
must not be reopened, and neither may the 0.2.0 ones.

Everything above `# Cycle 0.3.0` describes the 0.2.0 cycle. Read the 0.3.0
section for the active work.

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
**Status:** COMPLETE

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
- **Re-scoped to UG2 by the owner on 2026-09-21** (`docs/post-mvp/0_3_0_OWNER_BRIEF.md`
  section 1.1): the deferred U03 physical microphone checklist on PC, Android and
  iPhone, and the native camera/gallery, orientation, crop, OCR review and source
  photo disposal checks on Android Chrome and iPhone Safari. They are **not**
  passed and **not** waived. They move because they need a trusted HTTPS origin
  the app does not yet have, and providing one is V01, the first 0.3.0 milestone.
  `docs/post-mvp/UG1_DEVICE_VALIDATION.md` is unchanged and becomes UG2's
  checklist; its rule stands that a simulated PASS is never recorded.
  `physical-device-review.json` is reissued against the re-scoped criterion and
  records the authorisation, the date and the fact that no device observation has
  been made. The 2026-09-15 review is kept as
  `physical-device-review-2026-09-15.json`.
- Set package/lock to 0.2.0, move the `check-repository.mjs` version assertion and
  its message with the release rather than deleting it, create concise
  `CHANGELOG.md`, update this log and make a clean release checkpoint. The owner
  declared the release on 2026-09-21, so the checkpoint is tagged `v0.2.0`,
  annotated.
- Required files under `.evidence/UG1/`: `verification.json`,
  `browser-evidence.json`, `migration-evidence.json`, `functional-review.json`,
  `field-ux-review.json`, `data-integrity-review.json`,
  `regression-review.json`, `scope-review.json`, `code-quality-review.json`.
  Also require `physical-device-review.json`, which inspects the deferred U03
  device evidence in `.evidence/U03/speech-device-evidence.json` and the deferred
  U04 checks in `.evidence/U04/ocr-quality-evidence.json`.

### Acceptance criteria

Every included traceability row has implementation and evidence; every deferred
item remains absent or explicitly isolated; all deterministic checks pass;
reviews have no blockers; data survives; working tree is clean after the release
checkpoint.

The physical-device observations are **not** part of these criteria any more.
The owner moved them to UG2 on 2026-09-21 because the app has no reachable HTTPS
origin to run them against. 0.2.0 therefore ships with a known limitation, stated
below and in `CHANGELOG.md`: dictation and scanning are verified by benchmark and
by Playwright, never yet on a real phone.

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

The sex figures are faces rather than the Mars and Venus symbols, which read as
symbols and not as people. Two hand-drawn attempts were rejected by the owner —
the second was passable at 18px and poor enlarged — so the third went looking
for a designed set instead: the faces are now Material Symbols `face_6` (short
hair), `face_3` (long hair) and `face` (none), © Google under Apache 2.0, with
one change of ours, a pair of sunglasses in place of the eyes on all three. The
hair is then the only variable. The outlines are embedded with their attribution
in `src/components/PersonBadges.tsx` and recorded in the README; no icon
dependency is added, which keeps `03_TECHNICAL_DECISIONS.md` section 2 intact.

On P08 the state opens the row: the circled check and the written label sit
right after the coloured rule and in the same blue, in a fixed-width column, so
availability reads down one column while scrolling and the numbers and marks
after it stay aligned. Below 380px the column releases and the identity wraps,
as it already did.

The P08 card is then a quarter shorter — 72px to 54px, half the vertical
padding — because a 36px mark sat in a 72px row and the rest was air. The mark
keeps its size; the space around it goes. Seven boats now fit where five did.
`ug1-boat-mark-fit.spec.ts` measures the card height as well as the mark, so it
cannot creep back.

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

**Status 2026-09-20 — full release gate re-run after the day's work.**

`npm run verify:all` on Node 24.21.0: lint, formatting, typecheck, 400 unit and
component tests across 38 files, repository and canonical-domain checks, the
0.1.0 compatibility fixture at its 22 rows, the production PWA build with its
five precached OCR assets, the deterministic D2 full week with its course-state
invariants, and 135 Playwright journeys across Pixel Chromium, iPhone Chromium
and iPhone WebKit.

One journey failed on the first pass, and it was the new
`ug1-compact-rows.spec.ts`, not the application: it measured the three parts of
the crew header with three separate `boundingBox` calls immediately after
placing a person. The placement is saved asynchronously, and when it lands the
pool loses a row and everything below it moves up, so two of the three
measurements straddled the re-render and disagreed by the height of a pool row.
The spec now waits for the settled card and takes all three rectangles in one
layout pass; it passes three times in a row, and the full suite re-ran green at
129 passed, 6 intended project-matrix skips, none failed.

That is a measurement bug the first run of the day could not have caught,
because the spec only became load-sensitive once the crew card grew the members
it now measures around.

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


**Status 2026-09-21 — UG1 closes as release 0.2.0.**

Authorised by the repository owner in `docs/post-mvp/0_3_0_OWNER_BRIEF.md`
section 1: _"Possiamo considerare lo stato attuale un 0.2.0, fai i test e
chiudiamo questa cosa."_ The brief is a human decision record and under
`AGENTS.md` section 2 it outranks the older acceptance criteria it changes.

**The physical-device checks are re-scoped to UG2, not passed.** The 2026-09-15
review returned `FAIL` on `UG1-PHYSICAL-STT` and `UG1-PHYSICAL-OCR`, and it is
kept verbatim as `physical-device-review-2026-09-15.json`. The owner did not
override it; they changed UG1's acceptance criteria, which is theirs to do, and
the reason is concrete: the phone checks need a trusted HTTPS origin, because a
browser withholds the camera and the microphone over plain HTTP; the app has
none, and providing one is V01. The PC microphone check is the exception — its
recorded access is localhost, a secure context — so it was deferred for want of
time, not of an origin, and it moves with the other two rather than being
claimed. The reissued `physical-device-review.json` takes the
re-scope itself as its subject and records that no device observation has been
made. `docs/post-mvp/UG1_DEVICE_VALIDATION.md` is unchanged and becomes UG2's
checklist; its rule stands that a simulated PASS is never recorded.
`02_MVP_SCOPE.md` sections 5 and 6 carry the same amendment, so the scope
document and the plan no longer disagree.

**Known limitation of 0.2.0.** Neither dictation nor scanning has been tried on a
real phone. Dictation is verified by a measured benchmark over a labelled Italian
corpus; scanning is verified against a synthetic corpus with known field and
person values, plus a hand-run diagnostic on two real photographs that are not
committed and that no automated test uses. Both are verified by Playwright
journeys across three device profiles. None of that is a phone. This is in
`CHANGELOG.md` as well. Also carried forward: after an evaluation fails to save, the attempted
value stays visible and retryable, but leaving that session before retrying
discards the attempt.

**Released.** `package.json` and `package-lock.json`, both the root `version` and
`packages[""].version`, moved to 0.2.0. The assertion in
`scripts/check-repository.mjs` moved with the release instead of being deleted:
it now pins 0.2.0 until UG2, with the reason beside it. The 0.1.0 compatibility
fixture is untouched — it is the data contract, not the application version.
`CHANGELOG.md` leads with scanning, dictation and the visual work, which is what
the owner required, and was audited by an adversarial reviewer rather than sent
for approval; see `.evidence/UG1/changelog-review.json`.

That audit earned its keep. It returned one blocker and three precision errors,
all accepted. The blocker: _"Nothing is sent anywhere"_, written under a heading
about dictating on the device, was false in the one way that matters — the audio
and the transcript never leave the device, but the Whisper model is not bundled,
so the first dictation fetches about 73 MB from the Hugging Face CDN and
dictation cannot work offline until it has. The plan said so in its own words
under V01. The three others: the student card's measured 84 px to 56 px was being
claimed for the duty list, which never had a height recorded at all; the labelled
Italian corpus verifies dictation and not scanning, which is measured against a
synthetic corpus and a hand-run check on two uncommitted photographs; and the
HTTPS reason does not cover the PC microphone check, whose own evidence records
localhost as an available secure context, so it was deferred for want of time.
The reviewer also found five things that shipped and went unmentioned, including
the course/week note, safe student deletion and the double-click-to-edit
shortcut. All of it is in the changelog now, and the HTTPS correction propagated
to `02_MVP_SCOPE.md`, the physical-device review and this entry.

**Two marks, one number.** `first-27.png` was the 25.7 artwork with the `.7`
cleared, which left a `27` eight pixels tall beside a wordmark sized for
fourteen — the open product call recorded on 2026-09-20. Both marks are now built
on `first-27.png`'s plate and wordmark, with the 25.7 mark's numerals at their
native size and their right edge on the last column of `FIRST`. The two files
differ by 543 pixels, every one of them inside the digits. Evidence:
`first-marks.json`; `ug1-boat-mark-fit.spec.ts` re-run and passing.

**One blue.** The launcher icon, the three PNGs, `theme-color` and `theme_color`
were `#063b52`, a third blue aligned to nothing. They are now `#2f5fa0`, which is
what `--primary` and `--accent-blue` already are and what the `#3060a0` ink in
`public/brand/cvc-symbol.png` measures to. The PNGs are re-rendered from the SVG
so the two cannot drift apart again. Noted and not changed, because it is outside
this brief: `vite.config.ts` `background_color` is still `#f4f1e8`, a cream
unrelated to `--background`.

**The evidence directory is a place to look things up again.** The twenty-one
closed 0.1.0 milestone directories moved to `archive/v0.1.0/evidence/`, beside
the 0.1.0 ledger already there, and the sixty-one `requiredEvidence` paths in the
manifest moved with them, so `milestone:check -- M5` still resolves and no status
changed. `ocr-sheet-clear.png` and `ocr-sheet-blurred.png` were never evidence —
four specs and `check:ocr-offline` read them as inputs — and are now in
`tests/fixtures/`. Twelve 0.1.0-era specs wrote screenshots back into closed
milestone directories on every `verify:e2e`, which is why that tree could never
stay tidy; they write to `test-results/screenshots/` now. The U-series keeps its
screenshots, because its `browser-evidence.json` and reviews reference them by
path and rewriting closed evidence to tidy it would be the wrong trade.

**No path may belong to one machine.** `.evidence/UG1/bench.mjs` resolved
`playwright` through an absolute `createRequire` path and was therefore already
broken for anyone else. The speech harness moved to `scripts/speech-bench/` with
a README and `npm run speech:bench`, the OCR diagnostic to `scripts/` with
`npm run diagnose:ocr`, and both came inside lint and formatting — six errors
surfaced and were fixed. `check-repository.mjs` now sweeps every tracked
non-binary file and fails on a home-directory path, exempting only the recorded
command output of closed runs and the owner brief that quotes the defect. The
check was negative-tested against a planted file.

**Two specs folded away.** `evaluations.spec.ts` and `volunteers.spec.ts` are
gone, but only after both survived the test the owner set. The one assertion
`evaluations.spec.ts` alone made — that a student A terra carries a saved
evaluation inside the crew-grouped view — is in `evaluation-gate.spec.ts`, which
is in the WebKit project, so it gained coverage it never had. The `--` value that
`cleanup-inventory.json` listed as unique to it is in fact exercised by
`u10-evaluations.spec.ts` and read back from the history grid; that note was
stale. `volunteers.spec.ts`'s two unique assertions — a form saved without
touching the role produces ADV, and an edit may change the role — are in
`u07-volunteers.spec.ts`. Neither deleted spec was in the WebKit `testMatch`, so
no project coverage was lost.

`AGENTS.md` section 6 gains one step, at the owner's request: sweep the working
and evidence directories before the checkpoint commit.

**The gate.** `npm run verify:all` on Node 24.21.0, selected by fnm from
`.node-version` because the host default is older: lint, formatting, typecheck,
400 unit and component tests across 38 files, the repository and canonical-domain
checks, the 0.1.0 compatibility fixture at its 22 rows, the production PWA build
with its 5 precached OCR assets, the deterministic D2 full week with its
course-state invariants, and 131 Playwright journeys across Pixel Chromium,
iPhone Chromium and iPhone WebKit — 125 passed, 6 intended project-matrix skips,
none failed. 29 minutes. Recorded in `.evidence/UG1/verification.json`.

The journey count fell from 135 to 131 because two superseded specs were folded
away, which removes two runs on each of two projects.

Two earlier attempts at this run were discarded rather than reported. The first
was stopped deliberately: files were still being edited underneath it, so its
record would have described no particular tree. The second genuinely failed, and
it failed on the absolute-path check added in this same milestone, because the
evidence file describing that check quoted the offending path verbatim. That is
the check working, and it is recorded in `release-0.2.0.json` rather than
quietly fixed.

# Cycle 0.3.0

Source: `docs/post-mvp/0_3_0_OWNER_BRIEF.md`, captured from the repository owner
on 2026-09-21. Under `AGENTS.md` section 2 that brief is an explicit human
instruction and outranks any older plan text that disagrees with it. The
milestones below are its sections 3 to 8, written here before any of them was
implemented, because the owner asked for that order explicitly.

**Baseline:** app 0.2.0 at the release checkpoint tagged `v0.2.0` on
`codex/post-mvp-ux-planning`. All 0.3.0 work lives on `codex/0.3.0`, branched
from that checkpoint.

The 0.2.0 U-series and UG1 are closed history. Do not reopen them; a correction
to completed work is recorded under the active 0.3.0 milestone, as the "Student
scan redesign correction" entry under UG1 did for 0.2.0.

Feature milestones use the `V` series. The gate keeps the `UG` series and is
`UG2`, which is what the brief calls it.

## Where this cycle stands

Updated 2026-09-21. Keep this current: it is the first thing the next session
reads, and it is the only place that says what is happening *right now* rather
than what happened.

| Item | Status |
| --- | --- |
| 0.2.0 release | DONE — tagged `v0.2.0` at `8e9b2b7`, pushed |
| V01 — reachable from a phone | IN_PROGRESS — built and measured; waiting on a confirmed deploy and the owner's phone |
| CI regression | OPEN — red on Linux since the 0.2.0 work; blocks UG2 |
| V02–V05, UG2 | PENDING — blocked by the controller until V01 is COMPLETE |

**Done in this session:** 0.2.0 closed and tagged; the brief's sections 3–8
written into this plan as V01–V05 and UG2 before any of their code; V01's
isolation measurement, base-path portability, offline proof, privacy check,
deploy workflow and `docs/DEPLOY.md`; the repository pushed and made public and
Pages switched to GitHub Actions.

**Immediately next:**

1. Confirm the Pages deploy actually publishes and the URL serves the app.
2. The owner opens it on their phone. That is what closes V01's remaining
   acceptance criteria; nothing about a device is recorded without them.
3. Fix the CI regression. It is red today and UG2 cannot claim its ladder while
   it is.
4. `milestone:complete V01`, checkpoint, then V02.

**Then, in order, and not reordered:** V02 the dictation control, V03
transcription quality under the latency constraint, V04 the crop editor's two
details, V05 the LLM-assisted scanning path, UG2 the gate. Each with the full
lifecycle of `AGENTS.md` section 6 around it.

## Frozen 0.3.0 scope and traceability

| Brief section | Disposition | Canonical area | Milestone |
| --- | --- | --- | --- |
| 3 — reachable from a phone over HTTPS | INCLUDED | Deployment | V01 |
| 4 — dictation control stops resizing | INCLUDED | Shared speech UI / P05, P09, P17 | V02 |
| 5 — transcription quality and latency | INCLUDED | Speech capability | V03 |
| 5 — transcript confirmation step removed | INCLUDED | Shared speech UI / P05, P09, P17 | V03 |
| 6.1 — crop edge handles | INCLUDED | Student scan / P06 | V04 |
| 6.2 — rotation follows the finger | INCLUDED | Student scan / P06 | V04 |
| 7 — LLM-assisted scanning path | INCLUDED, alongside on-device OCR | Student scan / P06 | V05 |
| 8 — 0.3.0 integration gate | INCLUDED | Release | UG2 |
| OCR line fragmentation | DEFERRED past 0.3.0 by the owner (brief section 9) | Student scan | backlog |
| Automated test over a real photograph | DEFERRED past 0.3.0 by the owner (brief section 9) | Student scan | backlog |
| Final product name and derived brand mark | DEFERRED, unchanged from 0.2.0 | Branding | backlog |

Everything `02_MVP_SCOPE.md` section 4 defers stays deferred. 0.3.0 adds no
backend, no account, no synchronisation and no analytics; V01 publishes the same
local-first build to a static origin and nothing more.

## V01 — Reachable from a phone, over HTTPS

**Category:** FOUNDATION
**Status:** IN_PROGRESS

### Goal

The owner opens a URL on their own phone, installs the PWA if they want, and the
app works: local-only data, no backend, no accounts. This unblocks every physical
check UG1 deferred.

### Required behavior and evidence

- Measure, do not assume, whether the app needs cross-origin isolation on a
  phone. Desktop Chrome still hands out `SharedArrayBuffer` without
  `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy`; Android Chrome
  does not. The repository configures neither header today and the app works in
  desktop Chrome, so the desktop result proves nothing about the phone.
- Establish what `require-corp` would break before choosing it. The speech model
  is fetched from huggingface.co on first use, and under `require-corp` a
  cross-origin fetch without `Cross-Origin-Resource-Policy` fails. Either the
  host supports `credentialless`, or the model is served from the same origin, or
  isolation is not needed at all. OCR assets are already local and are not at
  risk.
- Choose the host from that measurement, not from preference, and say what was
  measured.
- No course data of any kind may be seeded into a deployed build. The deployment
  adds no analytics and no network call the app does not already make.
- Deliver a documented, repeatable deploy, the URL, and a `docs/` page saying how
  to redeploy and how to take it down.
- Prove a cold phone load works offline afterwards.
- Required files under `.evidence/V01/`: `verification.json`,
  `isolation-measurement.json`, `deployment-evidence.json`, `self-review.json`.

### Acceptance criteria

The URL loads on a real phone over HTTPS; the database opens there; dictation and
scanning reach their first real asset fetch; a second, offline load still works;
the deploy and the takedown are written down and repeatable by someone else; no
course data, analytics or new network call ships.

### Progress log

**2026-09-21 — the measurement, and what it changed.**

The brief said to measure whether the app needs cross-origin isolation rather
than assume it. It does not. `npm run measure:isolation` drives the real app
with `SharedArrayBuffer` deleted before any app code runs — the condition
Android Chrome and iOS Safari impose on a page that is not cross-origin
isolated — and in Chromium, in Chromium with it explicitly removed, and in
WebKit the database opened, took a course and kept it across a reload. WebKit
has no OPFS at all and still worked.

That answers the milestone's three open questions at once. No COOP/COEP is
needed, so a host that cannot set headers is fine; `require-corp` therefore
never applies, so the speech model fetch from huggingface.co is not at risk and
nothing had to be moved same-origin; and the host can be chosen on other
grounds.

It also contradicted this repository. `CLAUDE.md` asserted that the built-in
browser pane cannot run the app because it exposes no `SharedArrayBuffer`, so
wa-sqlite cannot open the database. That was wrong, and expensively so: taken at
face value it would have bought a header-capable host and moved 73 MB of model
weights for nothing. The paragraph is corrected, the old reason is recorded as
having been wrong, and the pane's real symptom is now stated — it stops at
`Apertura del corso…` with `Failed to fetch a worker script` from inside the
PowerSync worker. Why is still unknown; `CLAUDE.md` says not to debug the pane
and nothing depends on it, so it is recorded rather than chased.

**The app no longer assumes it owns the root of its origin.** Every asset was an
absolute path from `/`. On a project host serving at `/<repo>/` the page loads
and nothing in it works. `vite.config.ts` takes a base from `CVC_BASE_PATH` and
derives the manifest's `start_url`, `scope`, `id` and icon paths from it; a new
`src/lib/assetPath.ts` resolves against `import.meta.env.BASE_URL`, and the OCR
worker, the CVC symbol and the seven boat marks use it. `check-built-pwa.mjs`
strips the base before turning a manifest URL into a file path, and now also
asserts that `start_url` and `scope` agree, because an installed app whose
`start_url` sits outside its own scope opens in a browser tab instead.
`check-ocr-offline.mjs` takes the base from the resolved preview config, so the
offline proof is about a URL somebody will actually open, and says which one.

Verified at the subpath against a real production build: the app runs in all
three engine configurations, every asset class answers 200 under
`/CVC_helper/`, the same paths 404 at the root — so the base is genuinely in
effect — and the offline first-OCR-scan check passes at both bases. The default
base is still `/` and nothing changes there.

**Privacy.** Zero off-origin requests on a cold load through course creation, no
course data anywhere in `dist/`, no analytics. The one cross-origin call the app
makes is the speech model on first dictation, which predates this milestone.

**The host.** The measurement left the choice open, so the owner was asked once,
with options. They chose to make the repository public and use GitHub Pages, at
`https://furiocolombo.github.io/CVC_helper/`, and accepted a public URL.
`.github/workflows/deploy-pages.yml` builds with the base path and publishes;
`docs/DEPLOY.md` covers redeploying, building locally, proving offline and
taking it down.

**Still open, and why V01 stays IN_PROGRESS.** Two repository settings belong to
the owner's account: making the repository public, and setting Pages' source to
GitHub Actions. After that, the acceptance criteria that need a real phone are
the owner's to confirm. Nothing about a device is recorded here.

**2026-09-21, later — pushed, and both switches are set.**

`codex/post-mvp-ux-planning`, `codex/0.3.0` and the annotated `v0.2.0` tag are on
the remote. The owner made the repository public and set Pages' source to GitHub
Actions; `has_pages` is now true. The deploy is expected at
`https://furiocolombo.github.io/CVC_helper/` on the next push.

**2026-09-21 — the first push in this cycle broke a silence: CI has been red
since the 0.2.0 work began.**

This repository had never been pushed during the 0.2.0 cycle, so
`.github/workflows/ci.yml` had never run against any of it. The last green run
was 2026-09-03 on `main`, which is still the 0.1.0 baseline at `c907b19`. The
first push of this cycle ran it against 0.2.0 and 0.3.0 code and it failed on
every branch, including the `v0.2.0` tag.

The job gets all the way through lint, formatting, typecheck, 400 unit tests,
the domain and compatibility checks, the production build and the deterministic
full week. It fails in the browser suite: **120 passed, 6 intended skips, 5
failed**, in 20.5 minutes. Three distinct causes, none of them flaky, all of
them reproducing across retries:

1. **`student-scan.spec.ts:96`** — the review cards overflow their container by
   8 px against an allowance of 3. The page itself does not scroll sideways
   (`reviewOverflow.document` is 0), so this is the cards, not the layout.
2. **`u09-crews.spec.ts`** — the document measures 351 px against a 320 px
   viewport. The named offender is the session `<select>`, whose right edge sits
   at 351.
3. **`ug1-duty-reflow.spec.ts`** — `Aggiungi allievo` resolves, is reported
   visible, enabled, stable and scrolled into view, and then the click times out
   at 30 s. The truncated log points at a `<section>` rather than the button,
   which suggests something is intercepting the pointer at 320 px with 200 %
   text, but the log is cut off and that part is a hypothesis, not a finding.

The first two are almost certainly font metrics: a native `<select>` and text
run wider on the Linux runner's fonts than on this machine's, and the layouts
have no margin left at the stress viewport. The third is not yet understood.

**What this means, stated plainly.** The 0.2.0 release gate passed — on Windows.
The same suite on Linux does not. `verify:all` is therefore not the
platform-independent gate `AGENTS.md` section 5 takes it for, and the UG1
completion log's claim should be read as what it literally recorded: a green run
on Node 24.21.0 on this machine. Nothing in the release is retracted — the
failures are three stress-viewport assertions, not broken product behaviour —
but the gate was narrower than it looked, and CI existed without ever being
exercised.

**Disposition.** This is a defect in the harness and in two or three layouts, not
in the brief. It is recorded here rather than folded silently into V01, it must
be green before UG2 can honestly claim its deterministic ladder, and it is the
next thing taken up after the deploy is confirmed. See the CI regression entry
below.

Also noted, non-blocking: GitHub warns that `actions/checkout@v4` and
`actions/setup-node@v4` target Node 20, which is deprecated on runners and is
being forced to Node 24.

## CI regression — the browser suite is not platform-independent

**Category:** FOUNDATION (harness defect, not a brief milestone)
**Raised:** 2026-09-21, by the first push of the 0.3.0 cycle
**Status:** OPEN — must be green before UG2

Not part of `0_3_0_OWNER_BRIEF.md`. It is here because `AGENTS.md` section 5
makes CI part of the command surface and UG2's acceptance criteria require the
full deterministic ladder, which cannot honestly be claimed while the ladder
fails on the machine CI runs on. Recorded as its own item rather than absorbed
into V01, so it cannot be lost.

### What is wrong

`npm run verify:all` passes on Windows and fails on the Linux runner, in the
browser suite only: 120 passed, 6 intended skips, 5 failed. Everything before
the browser suite — lint, formatting, typecheck, 400 unit tests, domain and
compatibility checks, the production build, the deterministic full week — passes
on both.

| Spec | Symptom | Likely cause |
| --- | --- | --- |
| `student-scan.spec.ts:96` | review cards overflow their container by 8 px, allowance 3; the document itself does not overflow | text metrics: the cards have no margin left at the stress viewport |
| `u09-crews.spec.ts` | document 351 px against a 320 px viewport; the offender is the session `<select>`, right edge 351 | a native select sized by its longest option, wider under the runner's fonts |
| `ug1-duty-reflow.spec.ts` | `Aggiungi allievo` is visible, enabled, stable and scrolled into view, then the click times out at 30 s | unknown; the truncated log points at a `<section>`, suggesting pointer interception at 320 px and 200 % text |

The first two reproduced identically across all three attempts, so they are
deterministic, not flaky. The third also failed on all three.

### Why it went unnoticed

The repository was private and nothing was pushed for the whole 0.2.0 cycle, so
the workflow written in U00 never ran against the code it was meant to guard.
U00's completion log says "CI now runs the same `verify:all` surface"; that was
true of the configuration and untrue of any actual run. The last green CI run is
2026-09-03, against the 0.1.0 baseline.

### Required work

- Reproduce on Linux rather than guessing. The three failures are assertions
  about rendered geometry, so they need a Linux rendering to be read honestly;
  guessing at font metrics from Windows is how this was missed in the first
  place.
- Fix the layouts, not the assertions. An 8 px overflow and a 31 px overshoot at
  320 px are real: R18 says no horizontal scrolling in the operating interface,
  and the runner is telling the truth about a viewport the rulebook's own
  contract covers. Raising the allowance to make CI green would be falsifying
  the check.
- Diagnose the `ug1-duty-reflow` click before touching it. A visible, stable,
  scrolled-into-view element that cannot be clicked is either an overlay or a
  hit-testing problem, and both are real defects at the stress viewport.
- Decide what to do about platform coverage generally: the suite asserts
  geometry and only ever ran on one platform's fonts. Either the assertions gain
  a tolerance that is justified and written down, or the geometry stops being
  this tight, or CI becomes the authority and local runs are advisory.

### Acceptance criteria

`npm run verify:all` passes on the Linux runner with no assertion loosened
without a recorded reason; the three failures are fixed in the layouts or
explained; CI is green on `codex/0.3.0`; and the decision about platform
coverage is written into `03_TECHNICAL_DECISIONS.md` section 6 so the next cycle
inherits it.

### Evidence

`.evidence/CI-REGRESSION/` — the failing run, the three causes, what changed,
and a green run afterwards.


## V02 — The dictation control stops changing size

**Category:** FEATURE
**Status:** PENDING

### Goal

`DictationTrigger` is a text button whose label changes with its state — `Detta`,
`Permesso…`, `Caricamento 62%`, `Termina`, `Elaborazione…` — so its width changes
with it, and at the long end it overflows the pane. Screenshots:
`docs/post-mvp/brief-0.3.0/dictation-stop-overflow.png` and
`dictation-loading-overflow.png`.

### Required behavior and evidence

The owner's design, which is a specification and not a suggestion:

- `DictationMeter` is out of scope. _"Mi piace molto l'animazione della waveform,
  tienila com'è."_
- Recording keeps its border, its filled red square, its label and its colours,
  but the whole element stays **square** instead of stretching sideways, with the
  label under the square, and the word becomes **Stop** rather than `Termina`.
- Processing uses the same square element with only a red spinner inside it and
  no word.
- Permission uses the same square with its label under the icon, in the colour
  that state should have, following whatever the stop state settles on.
- Loading must hold the same box while the percentage runs from one to three
  digits.

Two acceptance criteria the owner stated twice:

1. An **independent specialised reviewer validates the design before it is
   built** — accessibility and mobile, plus field UX. A square control with a
   label underneath must still clear R04, and must not lose its accessible name
   when the visible word changes; `aria-label` already carries the full sentence
   and keeps doing so.
2. The sizes are then **measured**. A Playwright spec drives the control through
   idle, permission, loading with a long percentage, recording, processing and
   error, at the narrow viewport and at 200% text, asserting a stable box and no
   horizontal page scroll (R18). The bug escaped because no test ever rendered
   the long labels.

Record the visual decision in `docs/post-mvp/07_PAGE_CHANGELOG.md` against P05,
P09 and P17, which are the pages it changes.

- Required files under `.evidence/V02/`: `design-review.json` (independent,
  recorded before implementation), `verification.json`, `browser-evidence.json`,
  `control-geometry.json`, `accessibility-mobile-review.json`.

### Acceptance criteria

The control's rendered box is identical in every state at every contract
viewport, within one device pixel; no state produces horizontal page scroll; the
touch target stays at least 44 px; the accessible name still says what the
control does in each state; the pre-implementation design review has no blockers.

## V03 — Another round on transcription quality, under a latency constraint

**Category:** FEATURE
**Status:** PENDING

### Goal

Owner: _"la qualità è molto migliorata, ma non è ottima, è buona, siamo un po'
borderline usabile."_ Quality must improve measurably and time must not increase:
_"Il tempo non può aumentare, anzi per essere usabile dovrebbe calare minimo di
un 20%, idealmente molto di più."_

**A quality win that costs time does not close this milestone.** The latency
constraint is part of the gate, not a nice-to-have.

### Required behavior and evidence

- Read `.evidence/UG1/speech-quality-benchmark.json` before planning anything. It
  is the record of the last round and it will save a day. Its findings: the
  dominant failure was repetition collapse, fixed by `TRANSCRIPTION_GUARD`
  (303% to 90% aggregate WER); a generic DSP chain measured neutral (90.5%
  against 89.9%) and was not shipped; the model was the lever, `whisper-base`
  halving `tiny`'s error to 55.5% for 73 MB of first-use download. That corpus is
  8 kHz mu-law telephone speech, so only its comparisons mean anything.
- The owner supplied a real corpus:
  `data/test/transcription/Italian_Conversational_Speech_Corpus.zip`, 823 MB,
  untracked and staying that way (`data/` is in `.gitignore`). It is
  conversational Italian rather than telephone audio, so this round can produce
  an absolute number worth quoting.
- The benchmark harness must gain **latency**: wall clock and real-time factor
  per clip, warm model, same machine, several repeats, median not mean, reported
  beside WER.
- The harness scripts currently sitting in `.evidence/UG1/` move to `scripts/`
  with a documented entry point (see UG1's 2026-09-21 housekeeping).
- Take DSP seriously this time, because the last attempt tried one generic chain
  on the weakest model. Read first: Whisper's own preprocessing, what the model
  was trained on, what the transformers.js and whisper.cpp issue trackers say
  about front-end filtering, and the published work on noise robustness. Whisper
  is trained on largely unfiltered audio, so aggressive filtering can hurt; that
  is a hypothesis to measure, not a reason to skip the experiment.
- Candidates worth a measured A/B: band limiting matched to what the model
  expects, multiband compression, spectral or learned noise suppression, silence
  and pause-length normalisation, VAD-driven trimming of dead air. Pause
  normalisation is also a latency lever, and so are chunking, weight
  quantisation, and a smaller model that DSP makes viable again. The 20% may come
  from anywhere.
- Every variant goes in the variants file, every number in the evidence, and the
  shipped configuration is the one the numbers chose.
- **Remove the transcript confirmation step.** Owner: _"elimina la conferma della
  trascrizione, come se ci fosse subito confermato usa testo, è uno step
  inutile."_ Screenshot: `docs/post-mvp/brief-0.3.0/dictation-review-step.png`.
  The transcript goes straight into the field; the text stays editable, which is
  what made the review step redundant. `DictationPanels`' review branch and its
  two buttons come out, `Scarta` goes with them, and cancelling mid-recording
  must still work. `review` may stop being a `dictationState` status at all —
  remove it if nothing else uses it. Undo is the field itself; say so in the page
  changelog rather than inventing a new affordance.
- The milestone needs an **independent specialised reviewer** before closure.
- Required files under `.evidence/V03/`: `verification.json`,
  `speech-quality-benchmark.json` (this round, with latency),
  `browser-evidence.json`, `speech-review.json`.

### Acceptance criteria

Median word error rate on the new corpus is measurably better than the shipped
0.2.0 configuration on the same corpus and the same machine; **median
end-to-end transcription time falls by at least 20%** against that same
baseline; both numbers are in the evidence with the method that produced them;
the shipped configuration is the one the measurements chose; the confirmation
step is gone and no transcript can reach a record without the user seeing it in
an editable field; the independent review has no blockers.

If DSP does not move the numbers, say so plainly, as the last round did, and
spend the remaining effort on the model and on latency. That is a result, not a
failure.

## V04 — The crop editor's remaining two details

**Category:** FEATURE
**Status:** PENDING

### Goal

Owner: _"per OCR grandi miglioramenti, prima di tutto grafici, rimangono
dettagli."_ Two of them.

### Required behavior and evidence

**Edge handles.** Sketch:
`docs/post-mvp/brief-0.3.0/crop-edge-handles-sketch.png`, where red is the four
corner brackets that exist and green is what is added: one handle in the middle
of each edge, drawn as a short stroke parallel to its edge, moving that one side.
_"Chiaramente è solo un disegno qualitativo: dimensioni, colore eccetera devono
sempre seguire il design un po' Apple della cosa e quello che già è fatto, che è
positivo."_

- `CROP_CORNERS` and `updateNormalizedCrop` in
  `src/features/students/StudentScanImageEditorDocument.tsx` and
  `studentImageCrop.ts` already model gestures as named handles, so this extends
  an existing shape rather than adding a mechanism.
- Keyboard support exists on the corners (`moveHandleWithKeyboard`) and must
  exist on the edges too, with an accessible name each.
- The 44 px target rule still applies to a handle drawn much smaller than its hit
  area.

**Rotation has to follow the finger.** Owner: _"quando ruoto l'immagine deve
ruotare già durante il drag, non dopo, altrimenti diventa difficile da usare."_

- Diagnosed: the tilt ruler updates state on every pointer move, but the visible
  bitmap is regenerated by an effect behind a 120 ms `setTimeout` that the next
  move event cancels, so nothing turns until the drag stops.
- The fix separates the two: transform what is already on screen live — the image
  and the crop frame together — and keep the debounced bitmap regeneration for
  quality after the gesture settles.
- Evidence must show the angle tracking the pointer **mid-drag**, not only the
  end state.

Record both in `docs/post-mvp/07_PAGE_CHANGELOG.md` against P06.

- Required files under `.evidence/V04/`: `verification.json`,
  `browser-evidence.json`, `self-review.json`.

### Acceptance criteria

Each edge handle moves exactly one side, by pointer and by keyboard, with its own
accessible name and a hit area of at least 44 px; the corners keep their
behaviour; the image and the crop frame rotate during the drag and the
high-quality bitmap still settles afterwards; no regression in the existing scan
journeys.

## V05 — The LLM-assisted scanning path

**Category:** RULE_HEAVY
**Status:** PENDING

### Goal

A second way to get a roster into the app, **alongside** the on-device OCR and
never instead of it — the owner said so twice. The user photographs the roster,
pastes it into whatever assistant they already use together with a prompt copied
from inside the app, and pastes the assistant's answer back into a field in the
app, which parses it into the same reviewable student list.

### Required behavior and evidence

The owner's own warning is the design problem, so it is the first requirement:
_"il prompt deve essere veramente in grado di costringere l'LLM a ritornare un
risultato copiabile e sempre compatibile con il campo da riempire. Spostare la
difficoltà di parsare l'immagine a parsare un output di LLM non deterministico e
difficilmente controllabile sarebbe un autogol che vorrei evitare."_

The acceptance criteria are therefore about the parser, not the prompt.

- The pasted format is strict, small and self-evident, and the parser is written
  against a specification the app itself states — not inferred from one model's
  habits.
- The parser is tested against deliberately malformed input: prose wrapped around
  the data, a code fence, smart quotes, a trailing apology, a missing column, an
  invented column, a header row, an empty answer. **None of it may produce a
  silently wrong student.**
- What cannot be parsed is reported as unparsed, with the offending line visible
  and the option to fix it in place.
- Every imported row lands in the same manual review the camera path already
  requires. Nothing enters the course unreviewed.
- The prompt is copyable in one tap from inside the app, and the app never talks
  to an assistant itself. **No network call is added.**
- Both paths stay, and the camera path stays first.
- RULE_HEAVY, so an independent adversarial reviewer runs before closure and
  tries to falsify the parser rather than approve it.
- Required files under `.evidence/V05/`: `verification.json`,
  `browser-evidence.json`, `parser-robustness.json`, `domain-review.json`.

### Acceptance criteria

The stated format round-trips; every malformed case in the corpus is either
parsed correctly or reported as unparsed with its line; no case produces a wrong
student silently; imported rows are indistinguishable from scanned rows at the
review step and cannot commit without it; the app makes no network request on
this path; the on-device camera path is unchanged.

## UG2 — Full 0.3.0 integration and release gate

**Category:** INTEGRATION_GATE
**Status:** PENDING

### Goal

Owner: _"anche per raggiungimento 0.3.0 servono tutti i test indipendenti,
mettilo a piano."_ UG2 carries the weight UG1 had, plus the physical-device
checklist 0.2.0 deferred, now runnable because V01 gave it a URL.

### Required work and evidence

- The full deterministic ladder: `npm run verify:all`, the deterministic full
  week, and the browser suite across the three device projects.
- A realistic upgraded week through the visible app, including close/reopen and
  midweek change.
- Migration proof from **both** the 0.1.0 and the 0.2.0 fixtures.
- The six independent reviews with zero blockers: functional,
  field-UX/accessibility, data-integrity, regression, scope and code-quality.
- The physical-device checklist in `docs/post-mvp/UG1_DEVICE_VALIDATION.md`, run
  by the owner on their own phone against the V01 URL. Real microphone
  permission, Italian capture, cancellation and recovery on PC, Android Chrome
  and iPhone Safari; native camera and gallery, orientation, crop, OCR review,
  commit/reopen and source-photo disposal on Android Chrome and iPhone Safari.
  **These are the owner's to run. Never record a simulated PASS.**
- Test data, in the owner's words: _"sì, vai con dati tuoi sintetici. Sii critico
  nella generazione per avere esempi problematici sia come individui che come
  gruppo, coprire i corner case, e esempi anche con tanti allievi, tipo fino a
  una quarantina max."_ Generate that roster deliberately hostile: accented and
  apostrophed names, two students who differ by one character, a name long enough
  to break a row, minors either side of a birthday boundary, a group whose sizes
  do not divide into the fleet, a course with more students than seats, forty
  students. No real people.
- Release mechanics repeat UG1's: version bump with the `check-repository.mjs`
  assertion moved alongside it, `CHANGELOG.md`, plan, manifest, one clean
  checkpoint commit, annotated tag.
- Required files under `.evidence/UG2/`: `verification.json`,
  `browser-evidence.json`, `migration-evidence.json`, `synthetic-roster.json`,
  `functional-review.json`, `field-ux-review.json`,
  `data-integrity-review.json`, `regression-review.json`, `scope-review.json`,
  `code-quality-review.json`, `physical-device-review.json`.

### Acceptance criteria

Every included 0.3.0 traceability row has implementation and evidence; every
deferred item remains absent or explicitly isolated; all deterministic checks
pass; the six reviews have no blockers; both fixtures upgrade without loss; the
physical checklist is actually run on real devices and passes; the working tree
is clean after the release checkpoint.
