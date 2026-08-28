# Technical Decisions

Authoritative implementation choices. Keep the MVP simple; do not implement post-MVP infrastructure merely because the architecture anticipates it.

## Stack
- TypeScript, React, Vite.
- Mobile-first installable PWA.
- Primary development/testing target: recent Chrome/Chromium on Android.
- Core flows must remain compatible with iPhone/WebKit, without disproportionate Safari-specific engineering.
- No native app required. Capacitor remains a future packaging/migration path if useful.

## UI
- shadcn/ui + Base UI primitives + Tailwind CSS.
- Small CVC/Caprera design-token layer for visual identity, readability and consistent field use.
- Use mature primitives for standard controls instead of rebuilding accessibility/focus/keyboard behavior.
- Build custom components only for domain-specific UI such as students, crews, boats, faults and evaluations.
- No Redux/Zustand or equivalent unless React state/hooks become demonstrably insufficient.
- The component library is infrastructure, not the app's visual identity.

## Local-first data architecture
All operational reads/writes target the local database. MVP must work without network and persist across browser/app closure.

Future server authority: Supabase/PostgreSQL.

Expected evolution:
1. V1/MVP: one local editing device.
2. Possible V2: synchronized server state with one editor and other read-only clients.
3. Later V3: multiple editors with robust conflict handling.

Multi-device synchronization is not part of MVP.

### Replication-friendly model
Use granular independent records, not a monolithic nested course document.

Examples:
- each fault is an independent record linked to a boat;
- each evaluation is an independent record linked to student and session;
- boat availability is separate from faults;
- two different faults added to the same boat are independent;
- evaluations of different students are independent.

Use stable collision-resistant client-generated IDs for independently created entities.

The purpose is to minimize artificial future conflicts. Do not implement a conflict engine now. Future unresolved conflicts may treat server state as authoritative.

## Local database
First choice: PowerSync used local-only during MVP because Supabase synchronization is expected soon after MVP validation.

Before committing to it, run a bounded spike:
1. minimal representative schema;
2. local CRUD;
3. reload/close/reopen;
4. verify persistence on target browser;
5. assess setup/runtime complexity.

If straightforward, use PowerSync.

If local-only PowerSync introduces disproportionate complexity, fall back immediately to Dexie/IndexedDB. Do not spend substantial MVP engineering effort forcing PowerSync. This fallback is intentional.

## Future backend
Supabase + PostgreSQL is selected for future shared data.

Supabase integration, Auth, sharing and multi-device sync remain post-MVP. Do not build speculative backend adapters, fake sync, conflict UI or authentication now.

## Scan and transcription boundaries
UI/domain must not depend on a concrete OCR/vision or speech provider.

Keep small capability interfaces conceptually equivalent to:
- `scanStudents(image) -> structured candidate students`
- `transcribeAudio(audio) -> text`

Provider selection is invisible to the user.

### MVP
Both have a local implementation:
- scan: local image/OCR/extraction -> structured candidates -> human review -> explicit commit;
- speech: local Italian STT -> editable text -> discard audio.

Run bounded feasibility spikes before committing to concrete engines. Prefer the simplest sufficiently accurate/responsive option on the target phone/browser. Do not let these spikes become open-ended research or destabilize unrelated app work.

### Future
Online implementation becomes preferred when connectivity is good, with automatic local fallback when offline, unreliable or remote processing fails. The user does not manually select Whisper/provider/etc.; at most the UI may indicate local processing.

## Testing
- Vitest for unit/domain tests.
- React Testing Library for component tests.
- Playwright for useful end-to-end validation.

## Dependency policy
Prefer few, mature, well-supported dependencies, but do not reinvent standard functionality merely to reduce dependency count. Add a library when it materially reduces implementation/maintenance complexity or correctly solves difficult standard behavior.

## Explicit MVP non-goals
Unless a demonstrated current need appears, do not add:
- custom Node backend;
- GraphQL;
- global state framework;
- generalized repository/factory/provider architecture;
- custom synchronization engine;
- multi-user conflict resolution;
- Supabase Auth;
- native application code;
- large custom design system.


## Verification and harness architecture

Verification is a first-class architectural requirement.

The repository should make correct agent behavior easy and incomplete work visible.

### Tooling baseline

Set up before substantive feature work:
- ESLint;
- formatting check (Prettier or an equivalently standard formatter);
- TypeScript strict-enough type checking appropriate to the project;
- Vitest;
- React Testing Library;
- Playwright;
- production build check;
- Git-based checkpoints;
- simple CI.

### Executable domain truth

Finite approved mappings and enumerations should be represented as typed canonical domain data where practical.

Representative canonical tables:
- course configuration and default boat type;
- allowed boat types;
- standard crew size by course where defined;
- session ordering;
- duty-day ordering;
- size-warning matrix;
- evaluation values;
- fault states;
- crew destinations;
- volunteer roles.

Do not duplicate these mappings independently through UI, logic and tests when they can derive from one inspectable source.

Algorithmic domain behavior should be implemented as deterministic UI-independent functions with table-driven tests.

### Structural verification

Add a small custom domain/repository check rather than a large custom framework.

It should validate cheap deterministic properties such as:
- expected counts/order for session and duty sequences;
- symmetry/completeness of the size-warning matrix;
- validity of canonical enum/configuration references;
- other obvious static invariants.

### Runtime state invariants

Provide a simple `validateCourseState(...)`-style capability that reports impossible/corrupt persisted states. It is for structural integrity, not ordinary user warnings.

### Browser observability

Codex must be able to launch and exercise the PWA through Playwright.

For user-visible milestone completion, browser evidence is preferred over internal-only assertions.

### Scenario builders

Use readable deterministic builders/fixtures for realistic validation scenarios. Avoid opaque giant JSON fixtures when small builder functions make intent clearer.

At minimum, the final validation should support a realistic D2 week and targeted scenarios for important edge cases.

### Milestone controller

Build a small transparent milestone-control script during Harness Foundation.

It should support operations equivalent to:
- start milestone;
- inspect required checks/evidence;
- refuse completion when mandatory evidence is missing.

The controller may use a small machine-readable milestone manifest. Avoid complex orchestration infrastructure.

### CI

CI should independently rerun deterministic checks such as lint, formatting, typecheck, unit/domain tests, build and selected E2E checks.

CI is verification redundancy, not a substitute for local checks.
