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
**Status:** PENDING

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
- Required files: `verification.json`, `browser-evidence.json`,
  `speech-device-evidence.json`, `self-review.json` under `.evidence/U03/`.

### Acceptance criteria

Real transcription is reviewable and recoverable on all targets; persistence and
shared-note behavior pass; no card action overflows at stress width.

### Completion log

Pending.

## U04 — Student scan and review

**Category:** FEATURE
**Status:** PENDING

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

Pending.

## U05 — Boats and course availability

**Category:** RULE_HEAVY
**Status:** PENDING

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

Pending.

## U06 — Fault workflow

**Category:** FEATURE
**Status:** PENDING

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

Pending.

## U07 — Volunteers and CT

**Category:** RULE_HEAVY
**Status:** PENDING

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

Pending.

## U08 — Comandate week, proposal and direct editing

**Category:** RULE_HEAVY
**Status:** PENDING

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

Pending.

## U09 — Crew composition, boats and read mode

**Category:** RULE_HEAVY
**Status:** PENDING

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

Pending.

## U10 — Evaluation entry, overview and student history

**Category:** FEATURE
**Status:** PENDING

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

Pending.

## UG1 — Full 0.2.0 integration and release gate

**Category:** INTEGRATION_GATE
**Status:** PENDING

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
- Set package/lock to 0.2.0, create concise `CHANGELOG.md`, update this log and make
  a clean release checkpoint. A Git tag is created only when the release is
  actually declared.
- Required files under `.evidence/UG1/`: `verification.json`,
  `browser-evidence.json`, `migration-evidence.json`, `functional-review.json`,
  `field-ux-review.json`, `data-integrity-review.json`,
  `regression-review.json`, `scope-review.json`, `code-quality-review.json`.

### Acceptance criteria

Every included traceability row has implementation and evidence; every deferred
item remains absent or explicitly isolated; all deterministic checks and required
physical checks pass; reviews have no blockers; data survives; working tree is
clean after the release checkpoint.

### Completion log

Pending.
