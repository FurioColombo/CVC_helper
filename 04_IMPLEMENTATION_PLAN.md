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
**Status:** PENDING

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

- Evidence:
- Decisions:
- Known limitations:
- Git checkpoint:

---

## G2 — Boat Management Gate

**Category:** INTEGRATION_GATE  
**Status:** PENDING

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

- Evidence:
- Decisions:
- Known limitations:
- Git checkpoint:

---

## M7 — Comandate

**Category:** RULE_HEAVY  
**Status:** PENDING

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

- Evidence:
- Decisions:
- Known limitations:
- Git checkpoint:

---

## G3 — Duty Management Gate

**Category:** INTEGRATION_GATE  
**Status:** PENDING

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

- Evidence:
- Decisions:
- Known limitations:
- Git checkpoint:

---

## M8 — Crew composition core

**Category:** RULE_HEAVY  
**Status:** PENDING

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

- Evidence:
- Decisions:
- Known limitations:
- Git checkpoint:

---

## M9 — Crew warnings and history

**Category:** RULE_HEAVY  
**Status:** PENDING

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

- Evidence:
- Decisions:
- Known limitations:
- Git checkpoint:

---

## M10 — Crew destinations and boats

**Category:** RULE_HEAVY  
**Status:** PENDING

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

- Evidence:
- Decisions:
- Known limitations:
- Git checkpoint:

---

## M11 — Copy previous session and announcement/read view

**Category:** FEATURE  
**Status:** PENDING

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

- Evidence:
- Decisions:
- Known limitations:
- Git checkpoint:

---

## G4 — Crew Management Gate

**Category:** INTEGRATION_GATE  
**Status:** PENDING

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

- Evidence:
- Decisions:
- Known limitations:
- Git checkpoint:

---

## M12 — Evaluations

**Category:** RULE_HEAVY  
**Status:** PENDING

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

- Evidence:
- Decisions:
- Known limitations:
- Git checkpoint:

---

## M13 — Evaluation overview and student history

**Category:** FEATURE  
**Status:** PENDING

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

- Evidence:
- Decisions:
- Known limitations:
- Git checkpoint:

---

## G5 — Evaluation Gate

**Category:** INTEGRATION_GATE  
**Status:** PENDING

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

- Evidence:
- Decisions:
- Known limitations:
- Git checkpoint:

---

## M14 — UX, persistence and dependency hardening

**Category:** INTEGRATION_GATE  
**Status:** PENDING

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

- Evidence:
- Decisions:
- Known limitations:
- Git checkpoint:

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
