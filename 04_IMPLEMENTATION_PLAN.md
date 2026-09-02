# Implementation Plan

This file is both the ordered execution plan and the persistent progress ledger.

Codex must read the complete working set before beginning. Then it must follow this plan sequentially.

A milestone may be marked COMPLETE only according to `AGENTS.md`.

Status values:
- `PENDING`
- `IN_PROGRESS`
- `BLOCKED`
- `COMPLETE`

Do not duplicate detailed business rules here. Reference `01_PRODUCT_SPEC.md` and verify behavior against it.

---

## M0 — Harness Foundation

**Category:** FOUNDATION  
**Status:** COMPLETE

### Goal

Prepare the repository so all later work is autonomously, repeatedly and programmatically verifiable before substantive application implementation begins.

### Required work

1. Initialize/inspect Git and establish checkpoint hygiene.
2. Scaffold the approved React + TypeScript + Vite PWA.
3. Add the approved UI foundation without building product screens beyond a minimal shell.
4. Configure:
   - ESLint;
   - formatting check;
   - TypeScript typecheck;
   - Vitest;
   - React Testing Library;
   - Playwright;
   - production build.
5. Create verification commands required by `AGENTS.md`:
   - `verify:quick`
   - `verify:domain`
   - `verify:e2e`
   - `verify`
   - `verify:all` (may initially compose only checks that exist; it must expand as later scenarios are added).
6. Add a deterministic browser smoke test.
7. Add a persistence smoke test over the chosen local persistence layer when available.
8. Add canonical domain-configuration modules for finite approved mappings that are already known from Product Spec.
9. Add a small custom domain/repository check script.
10. Add a runtime course-state invariant checker with initial structural checks.
11. Add deterministic scenario/fixture helpers.
12. Add lightweight `.evidence/` conventions.
13. Add machine-readable milestone metadata/manifest if useful.
14. Implement simple commands equivalent to:
    - `milestone:start`
    - `milestone:check`
    - `milestone:complete`
15. Add CI that independently runs deterministic verification.
16. Ensure `AGENTS.md` is discoverable at repository root and matches the implemented command surface.

### Bounded technical spikes

Run before locking the corresponding implementation:

#### Local database spike
- Try PowerSync local-only with a minimal representative schema.
- Verify CRUD and close/reopen persistence in target Chrome/Chromium.
- If straightforward, retain it.
- If disproportionately complex, switch immediately to Dexie/IndexedDB.

#### Local OCR spike
- Evaluate a small number of viable local/browser approaches using realistic student-sheet screenshots/photos.
- Choose the simplest sufficiently useful implementation.
- Record limitations.
- Do not expand into open-ended research.

#### Local Italian STT spike
- Evaluate a small number of viable local/browser approaches on a representative phone/browser.
- Choose the simplest sufficiently useful implementation.
- Record limitations.
- Do not expand into open-ended research.

These spikes may choose engines, but full product integration belongs to later milestones.

### Required evidence

- clean production build;
- lint/format/typecheck pass;
- unit test infrastructure pass;
- Playwright smoke test pass;
- milestone controller demonstrably refuses an intentionally incomplete synthetic milestone/check;
- CI configuration exists and matches local deterministic commands;
- local persistence spike result documented;
- OCR/STT spike decisions documented.

### Acceptance criteria

M0 is COMPLETE only when Codex can autonomously run the verification surface described in `AGENTS.md` and receive clear PASS/FAIL results.

No substantive product feature implementation starts before this milestone is COMPLETE.

### Completion log

- Evidence: `.evidence/M0/verification.json`; controller refusal proof; PowerSync,
  OCR and STT spike reports/results; self-review; 7 unit/component/domain tests;
  2 Playwright mobile browser journeys including reload persistence; CI workflow.
- Decisions: retain PowerSync 2.2 local-only after successful browser spike;
  granular independent tables; Tesseract.js Italian OCR for M4 integration;
  quantized multilingual Whisper-tiny for later voice contexts; Base UI-backed
  shadcn component foundation with Tailwind and CVC-specific tokens.
- Known limitations: multi-tab PowerSync and WebKit persistence require later
  gate coverage; OCR/STT need real phone/adverse-input validation when integrated;
  final PWA icon/brand assets belong to the user-visible app-shell milestone.
- Git checkpoint: `feat: establish autonomous verification harness`

---

## M1 — Course setup and app shell

**Category:** FEATURE  
**Status:** COMPLETE

### Goal

Implement first-launch course creation and the persistent mobile application shell/navigation defined in Product Spec.

### Required evidence

- course creation works through browser UI;
- generated label/date/week behavior covered by deterministic tests;
- close/reopen preserves active course;
- bottom navigation matches Product Spec;
- production build and required verification pass.

### Reviewer level

Self-review.

### Completion log

- Evidence: `.evidence/M1/verification.json`; `.evidence/M1/self-review.md`;
  16 unit/component/domain tests; 4 Playwright journeys across Pixel 7 and
  iPhone 13 mobile profiles covering first launch, creation, reload persistence,
  Home cards, Settings and the exact primary navigation; in-app browser visual
  and console inspection at both 412 × 915 and 390 × 844 with no document
  overflow or navigation overlap.
- Decisions: derive ISO week/year from the device's local calendar date; persist
  the course's Saturday-to-Saturday date range as date-only values; replace the
  active course inside one PowerSync/SQLite write transaction; keep later
  feature areas as navigable shell placeholders without implementing their
  post-M1 behavior.
- Known limitations: course replacement/lifecycle controls are intentionally
  absent; Allievi, Barche, Comandate, Equipaggi, Valutazioni, Volontari and
  Avarie contain only shell-level placeholders until their approved milestones;
  native WebKit is deferred to cross-browser hardening because the frozen
  macOS 14 Playwright runtime cannot launch with the current protocol.
- Git checkpoints: `feat: complete M1 course setup and app shell`;
  `fix: compact M1 Home for phone viewport`;
  `fix: refine course title and dual mobile coverage`.

---

## M2 — Student management core

**Category:** FEATURE  
**Status:** COMPLETE

### Goal

Implement manual student creation, list, detail, edit, display-name behavior, minor state, disable/re-enable, and persistence.

### Required evidence

- deterministic tests for age/display-name behavior;
- browser journey for add/edit/disable/re-enable/reload;
- duplicate-first-name scenario;
- minor scenario;
- persistence verified.

### Reviewer level

Self-review.

### Completion log

- Evidence: `.evidence/M2/verification.json` records PASS for lint,
  formatting, typecheck, 30 deterministic tests, domain/repository checks,
  production build, and 6 Playwright journeys across Pixel 7 and iPhone 13
  profiles. `.evidence/M2/self-review.md` records PASS with no blockers and
  includes the 390 × 844 in-app mobile inspection.
- Decisions: calculate age and minor state at the course start date; derive a
  unique short name from first name plus surname initial when needed; allow an
  explicit nickname to override that result; expose the canonical sex values
  `M`, `F`, and `Altro` as adjacent one-tap choices while retaining nullable
  storage for future low-confidence imports; implement disable/re-enable as a
  persisted reversible state with records still visible.
- Known limitations: size and initial note belong to M3, while camera scanning
  belongs to M4. Future operational selection pools must exclude disabled
  students when those pools are implemented. Native WebKit remains deferred to
  M14 because the frozen build cannot launch on this macOS 14 host.
- Git checkpoints: `feat: complete M2 student management core`;
  `fix: streamline student sex selection`.

---

## M3 — Conoscenza allievi

**Category:** FEATURE  
**Status:** COMPLETE

### Goal

Implement incremental/autosaved Conoscenza fields and note input behavior.

### Required evidence

- browser journey;
- autosave/persistence verification;
- canonical size values used from domain truth.

### Reviewer level

Self-review.

### Completion log

- Evidence: `.evidence/M3/verification.json` records 33 unit/component tests,
  domain/repository checks, the production PWA build, and 8 Playwright journeys
  across Pixel 7 and iPhone 13. `.evidence/M3/self-review.md` records PASS with
  no blockers. Browser inspection at 390 × 844 confirmed compact cards, 44 px
  controls, visible dictation actions, and no horizontal overflow.
- Decisions: size uses the canonical `XS`–`XL` table; size saves immediately and
  notes use a short autosave debounce. Italian speech-to-text is implemented
  behind `transcribeAudio(audio)` with quantized local Whisper. A transcript is
  an editable draft until explicit confirmation, and recorded audio is
  discarded. The large ONNX runtime is cached on first use instead of being
  included in the PWA install precache.
- Known limitations: the first dictation needs the local speech assets to be
  downloaded and cached and can therefore be slow. Real-device microphone
  permission, Italian outdoor recordings, and native WebKit remain M14 device
  validation work; deterministic media-boundary coverage is in place now.
- Git checkpoint: `feat: complete M3 student knowledge workflow`.

---

## M4 — Student scan integration

**Category:** FEATURE  
**Status:** COMPLETE

### Goal

Integrate the selected local scan implementation behind the provider-independent interface.

### Required evidence

- realistic photo/screenshot fixtures;
- candidate extraction;
- uncertain/bad input handling;
- human review/correction/delete/commit flow;
- browser journey;
- no direct provider dependency in UI/domain.

### Reviewer level

Self-review.

### Completion log

- Evidence: `.evidence/M4/verification.json` records 39 unit/component tests,
  domain/repository checks, the production PWA build, and 10 Playwright
  journeys across Pixel 7 and iPhone 13. The real OCR journey reuses the
  retained clear and blurred/cropped roster fixtures, verifies rejection,
  extracts three candidates, corrects and removes rows, commits two, and
  verifies reload persistence. `.evidence/M4/self-review.md` records PASS with
  no blockers; `.evidence/M4/review-iphone13.png` records the compact review UI.
- Decisions: Tesseract.js 7 with bundled Italian data implements the
  provider-independent `scanStudents(image)` boundary. Aggregate confidence
  below 60 rejects the image; accepted pages apply a field threshold of 70 and
  blank each uncertain value independently. Images/candidates remain transient
  until explicit review confirmation, and confirmed rows use one transactional
  batch insert. A conservative common-name set provides editable sex
  suggestions without guessing unknown names.
- Known limitations: the fixtures do not cover handwriting, every layout,
  glare, or all camera angles. First use loads about 5.5 MB of same-origin OCR
  assets and may be slower; those assets are runtime-cached afterward. Actual
  phone camera, memory/thermal behavior, and native WebKit remain M14 device
  validation work.
- Git checkpoint: `feat: complete M4 local student scan workflow`.

---

## G1 — Student Management Gate

**Category:** INTEGRATION_GATE  
**Status:** COMPLETE

### Goal

Verify the student subsystem holistically rather than as isolated screens.

### Required scenario

At minimum:
- create a course;
- scan/import candidates;
- correct an uncertain/incorrect field;
- manually add a student;
- include duplicate first names;
- include a minor;
- add Conoscenza data;
- disable and re-enable a student;
- reload the app;
- inspect list and detail consistency.

### Required evidence

- browser journey through real UI;
- persisted-state invariant check;
- functional reviewer report;
- field-UX reviewer report;
- no blockers.

### Completion log

- Evidence: `.evidence/G1/verification.json` records quick, domain,
  production-build, and 12-test browser verification as PASS;
  `.evidence/G1/functional-review.md` records the remediated independent
  functional PASS; `.evidence/G1/field-ux-review.md` records the independent
  mobile PASS_WITH_FINDINGS with no blockers; and
  `.evidence/G1/final-list-iphone13.png` captures the final compact list.
- Decisions: the gate adds one deterministic end-to-end journey that starts
  from course creation and exercises OCR review/correction, manual creation,
  duplicate first-name disambiguation, a minor, Conoscenza, reversible
  disabling, reload persistence, and list/detail consistency on both device
  profiles. Student records are now checked against domain invariants whenever
  the subsystem reads them from persistence; invalid state fails safely instead
  of being rendered. The browser clock is fixed in the gate journey so age and
  minor assertions cannot drift with calendar time.
- Known limitations: persisted corruption and an ordinary archive-read failure
  share the same safe user-facing error. Playwright's iPhone 13 profile uses a
  390 x 844 screen with a stricter 390 x 664 browser viewport; the separate
  in-app preview is inspected at 390 x 844. Actual phone-camera, memory/thermal,
  and native WebKit validation remains scheduled for M14.
- Git checkpoint: `test: complete G1 student management gate`.

---

## M5 — Volunteers / ADV / IS

**Category:** FEATURE  
**Status:** COMPLETE

### Goal

Implement current-course volunteers/staff records and their distinct semantics.

### Required evidence

- name + ADV/IS role;
- separate visual/semantic treatment from students;
- persistence;
- exclusion from student-only rules verified.

### Reviewer level

Self-review.

### Completion log

- Evidence: `.evidence/M5/verification.json` records quick, domain,
  production-build, and 14-test browser verification as PASS;
  `.evidence/M5/self-review.md` records the scope, code, accessibility, and
  mobile review; `.evidence/M5/volunteers-iphone13.png` captures the compact
  persisted staff list.
- Decisions: keep Volontari as a deliberately lightweight, current-course-only
  subsystem with one trimmed name and one canonical ADV/IS role. Use direct
  role buttons, compact amber staff cards, a separate persistence module, and a
  dedicated invariant guard so staff cannot be confused with students. Support
  add and edit only: deletion was not added because it is not required here and
  could create dangling historical crew references in later milestones.
- Known limitations: removal/disable semantics remain intentionally undefined;
  decide them together with historical crew-reference behavior if the product
  later requires them. Actual placement of ADV/IS into crews belongs to the
  later crew milestones.
- Git checkpoint: `feat: complete M5 volunteer management`.

---

## M6 — Boats and faults

**Category:** RULE_HEAVY  
**Status:** COMPLETE

### Goal

Implement course boat setup, availability, faults, fault history and Avarie entry points.

### Required evidence

- canonical course->default boat mapping;
- canonical allowed boat types;
- independent availability/fault state;
- multiple simultaneous faults;
- resolved/open behavior;
- delete mistaken boat entry;
- browser journey;
- domain/invariant tests;
- adversarial domain reviewer.

### Completion log

- Evidence: official verification PASS (18 test files / 81 tests, domain and
  repository checks, production build, 16 E2E journeys); adversarial domain
  review PASS; Pixel 7 and iPhone 13 boat/fault journey; iPhone screenshot.
- Decisions: boat status is derived from unresolved faults, with availability
  as an independent override; fault audio is discarded after local Italian
  transcription; C4/C5 require an explicit type because no canonical default
  exists; mistaken deletion is blocked once a crew references the boat.
- Known limitations: automated voice coverage uses a deterministic recorder and
  transcription double; the real local model/capability remains covered by the
  M0 spike because CI has no microphone input.
- Git checkpoint: `feat: complete M6 boat and fault management`.

---

## G2 — Boat Management Gate

**Category:** INTEGRATION_GATE  
**Status:** COMPLETE

### Goal

Holistically verify boat configuration and fault workflows.

### Required scenario

At minimum:
- create default boats;
- add non-default boat type;
- add multiple faults;
- resolve one fault while another remains open;
- mark a boat unavailable independently;
- reload;
- use both boat-detail and global fault-entry flows.

### Required evidence

- browser journey;
- state invariant pass;
- functional reviewer;
- field-UX reviewer;
- no blockers.

### Completion log

- Evidence: official verification PASS (18 test files / 84 tests, domain and
  repository checks, production build, 16 E2E journeys); integrated boat gate
  passed on Pixel 7 and iPhone 13; functional and field/mobile reviews PASS;
  iPhone viewport screenshot inspected.
- Decisions: the gate asserts persisted unavailability and deletion after
  reload, then re-enables the boat and confirms unresolved faults still derive
  its warning state; deletion verifies course ownership before touching history.
- Known limitations: iPhone automation uses Chromium with the iPhone device
  profile; native WebKit behavior is reserved for the dedicated M14 mobile and
  accessibility gate.
- Git checkpoint: `test: complete G2 boat management gate`.

---

## M7 — Comandate

**Category:** RULE_HEAVY  
**Status:** COMPLETE

### Goal

Implement manual and automatic duty planning, warnings and remaining-week recalculation according to Product Spec.

### Required evidence

- canonical duty-day ordering;
- deterministic table-driven rule tests;
- even-distribution tests;
- Friday capacity priority;
- minor/spread priorities where specified;
- disabled/midweek/completed-history edge cases;
- browser workflows;
- adversarial domain reviewer.

### Completion log

- Evidence: official verification PASS (21 test files / 119 tests, domain and
  repository checks, production build, 18 E2E journeys); adversarial domain
  review PASS; deterministic 845-case balance matrix; Pixel 7 and iPhone 13
  weekly browser journey; iPhone viewport screenshot.
- Decisions: automatic proposals preserve the canonical Saturday-to-Friday
  order and even capacities, pin Friday stay-over coverage, then optimize minor
  and optional M/F spread lexicographically before deterministic tie-breaking;
  manual edits always remain available. Completed rotations, including empty
  ones, are immutable on recalculation. Advisory acknowledgements survive only
  while the exact warning situation remains active.
- Known limitations: iPhone automation uses Chromium with the iPhone device
  profile; native WebKit behavior remains reserved for M14. Presentation/image
  export is intentionally post-MVP.
- Git checkpoint: `feat: complete M7 duty management`.

---

## G3 — Duty Management Gate

**Category:** INTEGRATION_GATE  
**Status:** COMPLETE

### Goal

Verify Comandate as a realistic weekly workflow.

### Required scenario

At minimum:
- realistic student count;
- automatic initial proposal;
- manual overrides;
- accepted warning;
- completed past duty;
- disabled-midweek student;
- recalculate remaining duties;
- Friday stay-over/capacity condition.

### Required evidence

- browser workflow;
- deterministic distribution checks;
- functional reviewer;
- field-UX reviewer;
- no blockers.

### Completion log

- Evidence: official verification PASS (21 test files / 122 tests, domain and
  repository checks, production build, 18 E2E journeys); 21-student integrated
  weekly journey passed on Pixel 7 and iPhone 13; functional and field/mobile
  reviews PASS; iPhone viewport screenshot inspected.
- Decisions: the gate configures five stay-overs to prove Friday's three-place
  capacity, creates a real manual anomaly, accepts its advisory, completes
  Saturday, disables a dynamically selected future student, and proves after
  recalculation and reload that history is unchanged, future assignments are
  healthy, the disabled student is absent and Friday is saturated correctly.
  Field review moved completion above the roster, reduced completed history to
  assigned people, and added persistence feedback for completion/acceptance.
- Known limitations: recalculation confirmation remains below the configurable
  stay-over list; native WebKit remains reserved for M14. Follow-up TODO from
  field use: show day-scoped duty warnings directly on each affected day card,
  visually distinguish the students causing them by severity, and add a compact
  red `M` marker beside minors so the detailed Avvisi view becomes secondary.
- Git checkpoint: `test: complete G3 duty management gate`.

---

## M8 — Crew composition core

**Category:** RULE_HEAVY  
**Status:** COMPLETE

### Goal

Implement session-specific crew composition, pools, selection/move/swap/remove interactions, A terra handling and completeness.

### Required evidence

- canonical crew-size defaults where defined;
- student and staff pools separated;
- assignment removes person from source pool;
- direct swap behavior;
- A terra is individual status, not destination;
- completeness rules;
- browser workflows;
- invariant tests preventing duplicate simultaneous student assignment;
- adversarial reviewer.

### Completion log

- Evidence: official verification PASS (24 test files / 145 tests, domain and
  repository checks, production build, 20 Pixel 7/iPhone 13 E2E journeys);
  session-specific composition journey and iPhone screenshots; independent
  adversarial/domain review PASS after all findings were fixed.
- Decisions: D2–D5 use canonical fixed pairs; flexible courses show a
  deterministic even numeric target while assignment stays manual. Crew and
  member order are explicit persisted positions. A fixed selected-person tray
  provides one-handed crew/A-terra shortcuts. App-owned session state preserves
  non-default sessions through long-press student detail. An immediate save
  lock prevents stale concurrent mutations and session changes.
- Known limitations: crew warnings/history, destinations/boats, copy previous,
  and announcement mode intentionally remain M9–M11 scope.
- Git checkpoint: `feat: complete M8 crew composition core`.

---

## M9 — Crew warnings and history

**Category:** RULE_HEAVY  
**Status:** COMPLETE

### Goal

Implement size warning matrix, pair/crew repetition logic and per-crew worst-severity presentation.

### Required evidence

- size-warning matrix exists as canonical typed data;
- matrix structural/symmetry check;
- exhaustive table-driven warning tests;
- pair-history tests;
- 3+ crew tests;
- A terra excluded from pair history;
- Mezzi included once destinations exist;
- warning detail UI tested;
- adversarial domain reviewer.

### Completion log

- Evidence: official verification PASS (25 test files / 180 tests, domain and
  repository checks, production build, 22 Pixel 7/iPhone 13 E2E journeys);
  exhaustive size matrix and repetition boundary tests; iPhone warning-detail
  screenshot; independent adversarial/domain review PASS.
- Decisions: warnings use only canonical session order and exact identities.
  A pair in the previous three sessions is red and an older pair yellow; an
  identical 3+ student group is red and all internal pairs are also evaluated.
  History contains students in real crews only, so A terra and staff are
  excluded while any real destination (including future Mezzi data) counts.
  Each crew shows one worst-severity triangle and expands every underlying
  reason with count and latest session.
- Known limitations: boat availability warnings and crew destinations remain
  M10; evaluation-derived crew hints remain outside this milestone and no fuzzy
  similarity is implemented by design.
- Git checkpoint: `feat: complete M9 crew warnings and history`.

---

## M10 — Crew destinations and boats

**Category:** RULE_HEAVY  
**Status:** COMPLETE

### Goal

Implement crew destinations: unassigned, specific sailing boat, or Mezzi; plus boats-going-out selection.

### Required evidence

- canonical destination values;
- sailing boat assigned to at most one crew per session as hard invariant;
- Mezzi treated as destination, not person/group;
- boat availability/fault interactions reflected correctly;
- browser journey;
- invariant checker coverage;
- adversarial reviewer.

### Completion log

- Evidence: `npm run evidence:m10` passes 25 test files / 188 tests,
  domain and repository checks, the production build, and 24 Playwright
  journeys on Pixel 7 and iPhone 13. The full-page iPhone evidence shows the
  boats-going-out selector, exact sailing-boat and Mezzi destinations,
  duplicate prevention, open-fault handling, and an unavailable assigned boat
  retained with a red warning. The independent adversarial domain review is
  PASS with no blockers or findings.
- Decisions: boats going out are stored as granular session records separate
  from exact crew destinations. An exact sailing boat must be selected for the
  session and can belong to at most one crew in that session. Mezzi is a real
  destination with no `boatId` and counts in crew history. An open fault is
  visible but does not make a boat unselectable; a newly unavailable boat is
  excluded, while an existing selection or assignment is preserved and shown
  with a red warning. Legacy records with null positions remain readable and
  are normalized on the next save.
- Known limitations: copying the previous session and the announcement/read
  view intentionally remain M11. Generic motor-craft identities and automatic
  crew generation remain outside MVP scope.
- Git checkpoint: `feat: complete M10 crew destinations and boats`.

---

## M11 — Copy previous session and announcement/read view

**Category:** FEATURE  
**Status:** COMPLETE

### Goal

Implement copy-previous behaviors and the ultra-clean read/announcement view.

### Required evidence

- previous-session sequence derived from canonical session ordering;
- copy adapts to current state without rebuilding/optimizing;
- informational popup only when automatic removals occur;
- boat-copy behavior;
- exact clean announcement formats;
- browser screenshots for representative states.

### Reviewer level

Self-review plus UX review at G4.

### Completion log

- Evidence: `npm run evidence:m11` passes 25 test files / 197 tests,
  canonical domain and repository checks, the production build, and 26
  Playwright journeys across Pixel 7 and iPhone 13. The browser journey copies
  and adapts prior crews, reports only automatic removals, previews and
  confirms prior boats, verifies clean announcement formats, reloads the saved
  session, and records representative iPhone screenshots. Self-review is PASS.
- Decisions: the previous session is derived only from `SESSION_SEQUENCE`.
  Crew copy preserves crew order and current A-terra/boat-set state, creates
  independent crew IDs, removes current duty/inactive/missing people, and
  deliberately resets exact destinations instead of rebuilding crews. Boat
  copy is a separate preview/edit/confirm operation and retains any exact boat
  already required by the target session. Read mode infers a boat type only
  when the selected session boats have one unambiguous type; otherwise it reads
  names without a boat prefix.
- Known limitations: the optional Screen Wake Lock control remains omitted as
  best-effort browser behavior. No automatic crew optimization or post-MVP
  synchronization behavior was introduced.
- Git checkpoint: `feat: complete M11 crew copy and read view`.

---

## G4 — Crew Management Gate

**Category:** INTEGRATION_GATE  
**Status:** COMPLETE

### Goal

Severely and holistically verify the complete crew workflow and its dependencies on students, duties and boats.

### Required scenario

Use realistic students, volunteers, duty assignments, boat availability/faults, size variety and prior-session history.

At minimum:
- compose crews;
- use A terra;
- use staff to resolve odd headcount;
- assign sailing boats and Mezzi;
- trigger size warning;
- trigger recent-pair warning;
- copy previous session;
- make last-minute change;
- make an already-assigned boat unavailable;
- inspect warning behavior;
- switch to announcement/read view.

### Required evidence

- browser workflow;
- persisted-state invariant pass;
- functional reviewer;
- domain reviewer;
- field-UX reviewer;
- regression reviewer;
- no blockers.

### Completion log

- Evidence: `.evidence/G4/verification.json` records PASS for 201 unit/domain/
  component tests, repository/domain checks, production build and all 28
  Playwright journeys across Pixel 7 and iPhone 13 profiles. The holistic gate
  persists students, sizes, a volunteer, Saturday duty, three boats and an open
  fault; composes Saturday crews with `A terra`, exact boats and `Mezzi`; copies
  to Sunday AM; removes the current-duty student; verifies `C`, size/recent-pair/
  unavailable-boat warnings; swaps two members; reassigns a boat; enters the
  clean read view; and reloads the final state. Reviewer reports and the
  viewport-only screenshot are stored in `.evidence/G4/`.
- Decisions: named duty rotations now map from their afternoon through the
  following morning, with explicit PM smontante mappings. Crew cards expose
  session-aware `C`/`SM`; D1 morning duty outside `A terra` produces a persistent
  red warning. Crew dialogs share focus placement/restoration, Escape and Tab
  containment. The setup screen explains its people-derived crew limit and no
  longer shows the redundant people/boats sentence.
- Known limitations: reload fully validates the opened crew session, while
  older-session history does not yet include historical volunteer, `A terra`,
  and boat relationships in one course-wide snapshot. Some contextual controls
  remain 40 px and destination choices have no horizontal-scroll affordance.
  The optional Screen Wake Lock control remains omitted.
- Git checkpoint: `test: complete G4 crew management gate`.

---

## M12 — Evaluations

**Category:** RULE_HEAVY  
**Status:** COMPLETE

### Goal

Implement per-session individual evaluations, notes, Allievi/Equipaggi views and A-terra semantics.

### Required evidence

- canonical evaluation symbols/values;
- missing excluded from aggregate;
- note attached to exact student/session evaluation;
- A terra appears with missing reminder and remains evaluable;
- past evaluation editable;
- browser journey;
- table-driven aggregate tests;
- adversarial domain reviewer.

### Completion log

- Evidence: `.evidence/M12/verification.json` records PASS for 28 test files
  and 225 tests, domain/repository checks, production build, and all 30 browser
  journeys on Pixel 7 and iPhone 13. The focused journey and
  `.evidence/M12/evaluations-iphone13.png` cover Allievi/Equipaggi parity,
  `A terra`, typed notes, distinct cross-session values, reload and past edits.
  `.evidence/M12/domain-review.md` records the adversarial PASS_WITH_FINDINGS
  with no blockers.
- Decisions: canonical symbols and scores remain in `EVALUATION_VALUES`;
  missing marks are stored as `null` and excluded from aggregates; one record
  is keyed by the exact student/session pair; the initial session is the latest
  nominally completed one. Direct mark changes and confirmed text notes show a
  per-student persisted-save state. Dictated audio remains transient.
- Known limitations: orphan evaluation rows whose student no longer exists are
  hidden by the course-scoped join and await future full-course integrity/schema
  hardening. Real microphone/local-model behavior remains part of M14 device
  validation; M12 verifies the deterministic local transcription boundary.
- Git checkpoint: `feat: implement session evaluations`.

---

## M13 — Evaluation overview and student history

**Category:** FEATURE  
**Status:** COMPLETE

### Goal

Implement compact overview, sorting, actual-mark count, note marker and exact historical detail.

### Required evidence

- alphabetical and strongest->weakest sorting;
- mean used internally, never exposed numerically;
- actual-mark count correct;
- exact session identity retained in detailed history;
- student detail links/history browser-tested.

### Reviewer level

Self-review.

### Completion log

- Evidence: `.evidence/M13/verification.json` records PASS for 30 test files
  and 230 tests, domain/repository checks, production build, and all 32 browser
  journeys on Pixel 7 and iPhone 13. The focused journey and
  `.evidence/M13/evaluation-overview-iphone13.png` cover ordering, counts, note
  access, exact student history and return navigation. Self-review is recorded
  in `.evidence/M13/self-review.md` with PASS and no blockers.
- Decisions: Riepilogo retains every canonical session slot through the latest
  recorded session and labels slots visibly with compact day/period text.
  Strongest ordering uses the mean of actual marks internally, with missing
  marks excluded and alphabetical ordering as the deterministic tie-breaker.
  Numeric means are never rendered. Notes open inline from their exact mark;
  student detail shows chronological session-labelled history.
- Known limitations: long accumulated sequences scroll horizontally on narrow
  phones. Orphan evaluation rows retain the M12 course-join limitation.
- Git checkpoint: `feat: add evaluation overview and student history`.

---

## G5 — Evaluation Gate

**Category:** INTEGRATION_GATE  
**Status:** COMPLETE

### Goal

Verify evaluation workflow across an evolving week and its relationship to crews/A-terra.

### Required scenario

Evaluate several sessions containing:
- normal crews;
- A terra;
- missing marks;
- edited past marks;
- notes;
- different mark counts per student.

### Required evidence

- browser workflow;
- aggregate correctness;
- functional reviewer;
- UX reviewer;
- no blockers.

### Completion log

- Evidence: `.evidence/G5/verification.json` records PASS for 30 test files
  and 231 tests, domain/repository checks, production build, and all 34 browser
  journeys on Pixel 7 and iPhone 13. The focused evolving-week journey and
  `.evidence/G5/evaluation-gate-iphone13.png` cover normal crews, two distinct
  `A terra` outcomes, missing marks, a persisted past edit, a note, unequal
  mark counts, and mean-based ordering that cannot be mistaken for sum-based
  ordering. Functional review is PASS; field UX review is PASS_WITH_FINDINGS,
  with no blockers or remaining important findings.
- Decisions: evaluation view changes wait for active saves so Riepilogo cannot
  mount from stale persisted rows. The selected session remains visible while
  scrolling. Overview cards expose the surname used for alphabetical ordering.
  Student detail shows every canonical session through the course's latest
  recorded session, including explicit `—` gaps.
- Known limitations: independent overview timelines still scroll horizontally;
  student detail opens at its top rather than focused on history; abandoning an
  unconfirmed note draft can discard it; a missing-mark legend and cleaner
  viewport-only screenshot remain M14 hardening candidates. The M12 orphan-row
  course-join limitation remains.
- Git checkpoint: `test: complete G5 evaluation gate`.

---

## M14 — UX, persistence and dependency hardening

**Category:** INTEGRATION_GATE  
**Status:** COMPLETE

### Goal

Resolve cross-cutting MVP usability, mobile, persistence and regression issues before final validation.

### Required work

- verify all major flows on target Chrome/Chromium mobile viewport;
- verify core compatibility on iPhone/WebKit where feasible in available environment;
- inspect touch targets, viewport, forms, dialogs/drawers and field readability;
- verify close/reopen persistence;
- inspect dependency usage and remove unnecessary complexity;
- run complete deterministic suite;
- review code for accidental overengineering/dead paths.

### Required reviewers

- mobile/accessibility reviewer;
- code-quality reviewer;
- regression reviewer.

### Completion log

- Evidence: `.evidence/M14/verification.json` records 31 test files / 233 tests,
  domain and repository checks, a production PWA build with manifest/icon/service-worker
  assertions, and 44 passing mobile browser journeys. The browser matrix covers Pixel 7
  Chromium, iPhone 13 Chromium viewport and eight core journeys on real WebKit, including
  page close/reopen persistence. Independent reports are stored in
  `.evidence/M14/mobile-accessibility-review.md`, `code-quality-review.md` and
  `regression-review.md`; all have zero blockers.
- Decisions: pin and verify Node 24; serialize fault writes and share invariant-validated
  retry loaders; distinguish a normal crew tap from long press at release; require 44 px
  contextual controls; focus the main region after shell navigation and focus evaluation
  history only for an active evaluation deep link; add explicit crew-count capacity guidance;
  remove the obsolete persistence probe and unused domain helpers, and retain the `meta` table only for compatibility
  with databases created by the M0 schema. PWA installation assets are verified after every
  production build, and CI installs both Chromium and WebKit.
- Known limitations: first-use OCR and local speech model assets need connectivity or a
  prior cache, while manual student entry and typed notes remain offline. Further internal
  list-to-detail focus announcements, visible horizontal-overflow cues, unsaved note-draft
  protection, MediaRecorder deduplication and measured bundle optimization are non-blocking
  post-MVP improvements.
- Git checkpoint: `test: complete M14 UX and persistence hardening`.

---

## M15 — Full-Week MVP Validation

**Category:** INTEGRATION_GATE  
**Status:** PENDING

### Goal

Prove the MVP works as an integrated sailing-school week rather than as a collection of passing screens.

### Deterministic baseline scenario

Create a realistic D2 week, approximately representative of field use, including:
- about 21 students;
- multiple sizes;
- at least two minors;
- duplicate first names;
- volunteers/ADV/IS;
- realistic boats;
- multiple faults;
- an unavailable boat;
- seven duty rotations;
- manual duty override;
- midweek disable/re-enable condition;
- thirteen sailing sessions;
- crew history and repeated-pair opportunities;
- A terra;
- Mezzi;
- odd-headcount resolution;
- evaluations and notes;
- reload/reopen points throughout the week.

The exact data may be agent-generated but must be deterministic/reproducible once adopted.

### Automated evidence

`npm run verify:all` must include, once implemented:
- lint;
- formatting check;
- typecheck;
- unit/domain/component tests;
- custom domain checks;
- production build;
- E2E;
- persistence checks;
- deterministic full-week scenario;
- course-state invariant checks.

### Final specialized reviewers

Run multiple independent reviews with deliberately different missions:

1. Domain prosecutor.
2. Field UX reviewer.
3. Data-integrity reviewer.
4. Regression hunter.
5. Product-scope reviewer.
6. Code-quality reviewer.
7. Accessibility/mobile reviewer.
8. Chaos user.

Use different models where available and useful, especially for the final gate.

### Finding classification

Synthesize findings into:
- BLOCKER;
- IMPORTANT;
- QoL;
- POST-MVP.

All BLOCKER findings must be fixed and the affected verification rerun.

IMPORTANT findings should be fixed unless clearly non-blocking and explicitly documented.

QoL and POST-MVP findings become backlog, not hidden debt.

### Final acceptance criteria

M15 is COMPLETE only when:
- all earlier milestones/gates are COMPLETE;
- `npm run verify:all` passes;
- invariant checks pass;
- final reviewers report zero blockers;
- remaining limitations are documented;
- final Git checkpoint exists;
- working tree is clean.

### Completion log

- Evidence:
- Decisions:
- Known limitations:
- Git checkpoint:

---

# Post-MVP

Do not implement during MVP unless explicitly authorized.

Likely next areas:
- Supabase integration;
- synchronized read-only clients;
- later multi-editor conflict-aware sync;
- online-first OCR/STT with local fallback;
- polished image export;
- documents/reference area;
- richer home dashboard;
- automatic crew generation;
- richer historical/archive behavior;
- native/platform-specific capabilities if justified.
