# Technical Decisions — current architecture

This document is authoritative for architecture, technology, persistence and
verification. Product behavior belongs in `01_PRODUCT_SPEC.md` and scope in
`02_MVP_SCOPE.md`. The released 0.2.0 decisions remain in force during 0.3.0
unless the owner changes them explicitly.

## 1. Runtime and stack

- TypeScript, React and Vite.
- Node 24, declared by `.node-version` and `package.json`; do not lower it because
  a host PATH exposes an older Node. In Codex Desktop, use the bundled workspace
  Node 24 when needed.
- Mobile-first installable PWA.
- Primary target: recent Chrome/Chromium on Android.
- Core flows also run on iPhone/WebKit without disproportionate platform-specific
  engineering.
- No native app, backend or sync in this cycle. Capacitor and Supabase/PostgreSQL
  remain possible later paths.

## 2. UI architecture

Use React, Tailwind CSS and mature Base UI/shadcn-style primitives for standard
control behavior. Build small domain components for students, boat identity,
warnings, sessions, crews and evaluations.

Keep a small shared token layer for:

- CVC blue/orange and semantic red/yellow/green/grey;
- type scale and normal/light body weight;
- spacing, radius, borders and shadows;
- 40/44/48 px interactive target rules;
- safe-area, sticky and floating offsets;
- selected, disabled, loading, saving and error states.

This is a component vocabulary, not a large design-system project. Reuse the same
person badge, boat identity, session control, warning icon and weekly evaluation
grid where the product presents the same concept.

The design source is mock r10 in `docs/post-mvp/mockups/` at commit `ee8d4c8`.
Mock files stay isolated from the application build and never access production
data. Implement components from the behavior/geometry target; do not import mock
HTML/CSS/JavaScript into the app.

Use vector icons from the established icon dependency for controls and warnings.
Do not use text characters as warning or evaluation icons when alignment matters.
Boat image assets are optional presentation inputs: use only assets with acceptable
provenance and always provide a same-size text/model fallback. Do not synthesize
or redraw a trademark and call it official.

No Redux, Zustand or equivalent is added unless local React state/hooks become
demonstrably insufficient.

## 3. Local-first persistence

All operational reads and writes target the local PowerSync database. The M0
browser spike succeeded, so PowerSync local-only is the decided implementation;
Dexie is no longer an automatic fallback. The app does not call `connect()` in
0.2.0 and contains no sync connector, upload queue, Auth or conflict UI.

Use granular records with stable collision-resistant client IDs rather than a
monolithic nested course document. Faults, evaluations, assignments, session boat
selections and availability remain separate records so future replication is not
made artificially difficult.

### 3.1 Compatibility and migrations

Application version and database compatibility are separate. The anonymous
0.1.0 compatibility fixture is the regression contract for every schema change.

Before a schema-changing implementation:

1. extend the fixture only to represent real 0.1.0 data, never future columns;
2. add the migration/default behavior;
3. open/normalize the old fixture through the production boundary;
4. assert record/reference counts and all existing values/notes/history;
5. run domain invariants and persistence reload tests;
6. record migration evidence in the active milestone.

Additive optional fields receive explicit defaults. New CT role support is an enum
extension and must leave ADV/IS rows untouched. Destructive/cascading migrations
need explicit human approval because they change product semantics.

### 3.2 Coherent writes

Use a single database transaction when an operation must remain consistent:

- deleting a never-used student after checking every reference;
- unlinking a boat from the open session and its crew mapping;
- assigning one selected boat to one crew in the open session;
- multi-record confirmation of an automatic duty proposal.

The UI shows saving only while work is pending, success only after commit, and an
in-context retry after failure. Do not let a stale selected session/person apply a
late write to the wrong record.

## 4. Canonical domain implementation

Approved finite mappings and enums live in readable typed configuration and are
derived by UI, domain logic and tests:

- course → default boat and standard crew size where defined;
- allowed boat types;
- session and duty-day order;
- student sex and size values;
- volunteer roles;
- fault states and boat availability;
- crew destinations;
- evaluation values;
- size-warning matrix.

Algorithmic rules use deterministic UI-independent functions with table-driven and
boundary tests. This includes duty proposal capacities/priorities, compact display
names, age/minor status, repetition warnings, evaluation aggregation and
reference-safe deletion.

Maintain `validateCourseState(...)` as structural integrity protection. It is not
a replacement for advisory user warnings.

## 5. OCR and speech boundaries

UI/domain depend on provider-independent capabilities equivalent to:

- `scanStudents(image) -> structured candidate students`;
- `transcribeAudio(audio) -> text`.

The current local Italian implementations remain the starting point. A bounded
milestone may change an engine only with evidence that the existing path cannot
meet the approved workflow and the replacement does not add backend/sync scope.

Speech requests microphone permission only after the user's first recording tap.
Loading, recording, processing, review, denial and recoverable error are explicit.
Audio is transient. Tests use deterministic audio fixtures, but milestone closure
also requires labelled physical PC/Android/iPhone evidence. Record latency rather
than inventing a fixed threshold.

OCR tests use an anonymous/synthetic corpus with field/person truth, poor-image and
false-row cases. Measure correct readable fields associated with the correct
person. Full-screen camera, free rotation/crop and mandatory review are UI
requirements; images are not retained as app data.

## 6. Verification harness

Keep the existing harness and command surface:

- `npm run verify:quick`: lint, formatting, typecheck and fast tests;
- `npm run verify:domain`: repository, canonical-table and invariant checks;
- `npm run verify`: quick + domain + production PWA build;
- `npm run verify:e2e`: complete Playwright browser suite;
- `npm run verify:all`: verify + deterministic full week + E2E;
- `npm run milestone:start|check|complete -- <ID>`;
- `npm run evidence -- <ID>`.

The milestone manifest declares verification scripts, evidence and structured
review files. Completion is refused when evidence is missing, verification is not
all PASS, a review verdict is FAIL or any blocker exists. Old 0.1.0 milestone
statuses remain immutable history.

Evidence under `.evidence/<ID>/` is small and reproducible: machine verification,
structured reviews, browser/device metadata and selected screenshots. Browser
evidence identifies the frozen target revision, tested commit, viewport, scenario
and assertions. A screenshot cannot substitute for persistence, accessibility or
domain checks.

For visible milestones, use focused real UI journeys plus the full deterministic
suite at integration gates. Preserve Pixel 7 Chromium, iPhone viewport Chromium
and core iPhone WebKit coverage. Test 320 × 664, 390 × 844 and 412 × 915 where
density/overflow is material; avoid multiplying every test across every viewport.

CI uses Node 24, locked dependencies, deterministic `verify:all` and uploaded
failure artifacts where useful. Local checks remain required.

### 6.1 Platform coverage of the browser suite

Decided 2026-09-21, after `verify:all` passed on Windows and failed on the Linux
runner for six rounds.

**CI is the authority for the browser suite. A local run is advisory.** The suite
asserts rendered geometry, and geometry depends on the platform's fonts: the
runner's are wider, so four layouts that fitted here by a couple of pixels
overflowed there. A green local run means the change is probably sound; only a
green CI run means the suite passes. Milestone evidence may cite a local run for
what it is, and must not present it as the gate.

**A geometry assertion must name the element it is complaining about.** Reporting
a page width and nothing else costs a full CI round trip every time it fails,
which is most of what those six rounds were. Report offenders widest-first, and
exclude elements that clip: a `truncate` box exceeds its own `clientWidth` by
design and cannot push anything.

**Fix the layout, not the threshold.** R18 forbids horizontal scrolling in the
operating interface and R12 forbids a floating element covering a control, at the
contract viewports including 320 px at 200 % text. When the runner reports an
overflow at those sizes it is telling the truth. Widening an allowance to go
green falsifies the check. If a threshold genuinely has to move, the reason
belongs in the code and in the milestone evidence.

**Reproduce the mechanism, not the platform.** Extra `letter-spacing` at the
stress viewport, under the same device descriptor the CI project uses, does to a
layout what a wider font does. It reproduced three of four overflow causes
locally and is much cheaper than a CI round. Where it does not reproduce, make
the code under test report what it sees rather than guessing from a truncated
log.

## 7. Versioning and release

Use low-effort semantic versions:

- released baselines: 0.1.0 and 0.2.0;
- active cycle: 0.3.0, assigned only at its release gate;
- patch numbers for separately released fixes;
- later minor numbers for recognizable feature/change packages;
- 1.0.0 only after an explicit stability decision.

Do not version every card or milestone. Update `CHANGELOG.md` at the 0.3.0 gate
with user-visible changes and material migration or limitation notes. Create a
Git tag only when the release is actually declared.

## 8. Explicit non-goals

Do not add a custom backend, GraphQL, global state framework, generalized
repository/provider architecture, custom sync/conflict engine, Supabase/Auth,
native code, release-management service, large design system, generic content
system or speculative abstraction during 0.3.0.
