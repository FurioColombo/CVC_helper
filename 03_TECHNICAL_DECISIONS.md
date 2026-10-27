# Technical Decisions — current architecture

This document is authoritative for architecture, technology, persistence and
verification. Product behavior belongs in `01_PRODUCT_SPEC.md` and scope in
`02_MVP_SCOPE.md`. These are the decisions of the released 0.4.0; they stay in
force until the owner changes them explicitly.

## 1. Runtime and stack

- TypeScript, React and Vite.
- Node 24, declared by `.node-version` and `package.json`; do not lower it because
  a host PATH exposes an older Node. In Codex Desktop, use the bundled workspace
  Node 24 when needed.
- Mobile-first installable PWA.
- Primary target: recent Chrome/Chromium on Android.
- Core flows also run on iPhone/WebKit without disproportionate platform-specific
  engineering.
- No native app, backend or sync in the released app. From 0.5.0 the backend is managed
  Supabase (Postgres and Auth) with PowerSync Cloud, both hosted in the EU, with
  separate development and production projects (owner, 2026-10-08;
  `02_MVP_SCOPE.md` §4). No agent tool connects to production. Capacitor
  remains a possible later path.

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

The design source is mock r10 in `docs/design/mockups/` at commit `ee8d4c8`.
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
Dexie is no longer an automatic fallback. A device starts in local mode
(local-only course tables, 0.4.0's schema) and moves once to synced mode
(§3.1, from 0.5.0): synced course tables whose writes PowerSync queues for
upload.

**Online backup (0.5.0).** Signed out, nothing connects. Sign-in is by a link
emailed by Supabase Auth (PKCE, so it signs in only in the browser that asked
for it); the app never creates accounts, and the email's one-time code becomes
a second way in once a custom email sender exists. Signed in, the device
switches once to synced mode and belongs to that account: another account's
session neither uploads its queue nor receives its course. Uploads
(`src/backup/connector.ts`) send every change as the whole row, with the app's
version; the server refuses versions below its minimum writer and keeps the
latest edit of a row (`supabase/migrations/`), and a delete removes only a row
nobody edited after the device last saw it. A change the server refuses is
kept on the device and listed in Impostazioni, never dropped in silence.
Placement rows take their ids from their natural keys, and the readers and the
export settle what two phones edited offline on the latest edit. Erasing the
course, a course file's replacement and the full reset take the course off the
server too: on a synced device the erase or import transaction forgets the
whole synced copy (PowerSync's own clear, upload queue and downloaded history
included) and records the course ids in the local-only `serverErasures`; the
backup deletes those courses (their rows cascade, no clock involved) before it
connects, so an offline erase completes with signal and nothing erased is
downloaded again. The server keeps erased ids and refuses that course
afterwards (SQLSTATE `CVERA`); a course file imported under such an id is
accepted again. The full reset, which leaves no account to finish later,
erases online first and resets nothing without signal. Another phone of the
account loses the course with the download, reopens without it and compacts
its database at that open; a course whose own row the server refused stays
there, with its refused changes, for Riprova. Known gap
until team editing: a delete leaves no tombstone, so an older edit uploaded
after it brings the row back (`docs/working/BACKLOG.md`).

**Startup integration (owner, 2026-10-14; adopted in D3).** The startup
integration below came from a bounded investigation of PowerSync
worker/module startup reuse. PowerSync, the persistent database, schema
compatibility and both construction-inclusive five-second upgrade/reopen bounds
remain required. It permits no different engine, VFS, in-memory persistence,
extra retries or warming outside the measured path; changing it needs evidence
for cold startup, close/reopen, interruption recovery, multi-tab guards and
test-channel isolation, reviews and exact green CI.

The integration caches only the compiled, immutable WASM module in its page,
keyed by its exact same-origin asset URL. Each dedicated database worker gets
a fresh engine instance, memory and VFS; the normal SDK owns its connection
and close. Compilation begins on the first real open, inside the measured
startup path, in a short-lived code-only compiler worker. That compiler creates
no engine instance or database, and is terminated on success, error or its
30-second deadline. Concurrent opens share its promise; a failed consumer does
not cancel the other consumer's compilation. A private transferred port supplies
the resulting module; a failed startup
releases only its owned workers and ports. The desktop SharedWorker keeps the
stock SDK entry and database-specific name. Build-time version and source-hash
guards pin this private integration to PowerSync 2.2.0 and wa-sqlite 2.0.3;
updating either requires a new reviewed integration. Development-only events
prove cold compilation and distinct instances; production strips their producer.
Workers keep Vite's default single-file packaging, so a VFS chunk cannot import
the worker entry and replay its startup registration in WebKit.

Use granular records with stable collision-resistant client IDs rather than a
monolithic nested course document. Faults, evaluations, assignments, session boat
selections and availability remain separate records so future replication is not
made artificially difficult.

**Record metadata and course ownership (D1).** Every course row carries
`createdAt` and `updatedAt` as UTC ISO text: an insert sets both, an update
moves `updatedAt` forward only and never below `createdAt`
(`src/persistence/stamp.ts`; a structural test refuses a write statement
without them). Every course-scoped row names its
course, faults, crew members and evaluations included, so per-course sync needs
no joins. `src/persistence/rowIntegrity.ts` checks stored rows for both,
beside `validateCourseState`.

**Data migrations (D1).** Columns need no migration in PowerSync; filling them
does. `prepareDatabase` (`src/persistence/migrations.ts`) readies the data
before the app's first read with two kinds of step. Repairs
(`src/persistence/repairs.ts`) run on every open: one read looks for a row to
repair, and only when it finds one does a write transaction restore what every
row must carry: its course (copied from the parent; an orphan takes the
device's course when there is only one, and stays reported as an orphan), its
metadata, and an `updatedAt` not before `createdAt`. They settle the rows an
older app strips or inserts (§3.1). Migrations run once, each in one write
transaction with its row in the ledger, so an interrupted step rolls back whole
and reruns, and an applied one never runs twice; steps are only appended. The
ledger lives in the `meta` table, which every schema since M0 declares, because
an app's schema drops the local-only tables it does not declare. For the same
reason a table that only newer versions declare is filled by a repair, never by
a ledgered migration: its ledger row would outlive the table. Erasing a course
keeps `meta`.

**Duty settings as rows (D2).** The lists of a course's duty settings (fewer
and extra days, stay-over students, completed days, acknowledged warnings;
`DUTY_SETTING_LISTS` in `src/domain/config.ts`) are also stored item by item in
`dutySettingItems`: one row per item, its kind, value and place in the list,
its id made of the course, the kind and the value, so an item is stored once
and the same item saved on two phones is the same row. This is the expand step
of §3.1's two-release rule. While 0.3.0 can open the database, the JSON list
columns of `dutySettings` stay the copy the app reads (the screens, the
completed-day history, the stay-over reference that blocks a student's
deletion), because an older tab writes only them. Every save writes the
changed items beside the lists in one transaction, and on open a repair makes
the rows match the lists of the settings row whose id is the course's: rows an
older app missed are rebuilt, rows of a course without settings go, a list that
does not parse keeps its rows. The full week and both upgraded weeks check, before
every close or reload, that the rows match the lists. Reads move to the rows, and the lists stop being written,
once no older app can write them; in that release the repair that makes the
lists win goes or turns round, since it would otherwise undo any item merged
into the rows, and a null `extraDayIds` (extra days never chosen) needs its own
marker. For 0.5.0 and later: a save diffs the wanted
items against the stored rows, not against what the screen read, so a stale
screen still removes items it never saw, as the whole list did; merging
concurrent edits item by item needs that base.

**No deletion markers or record versions yet (D1).** PowerSync uploads a delete
as a `DELETE` operation, so a hard delete reaches the server and other devices
without a marker. Conflict handling belongs to the backend's upload handler,
which can compare `updatedAt` or the previous values PowerSync tracks
(`trackPreviousValues`). With one writer through 0.7.0 neither is needed;
1.0.0 decides conflict rules and adds what they require. Two properties of
`updatedAt` matter to those rules: it never moves back, so one write under a
clock set ahead leaves it in the future, and a save that changes nothing still
moves it.

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

The 0.2.0 and 0.3.0 fixtures join the 0.1.0 one under the same rules.

**Compatibility window (owner, 2026-10-06).** Once data is shared, phones run
different app versions for days, so compatibility is designed in from 0.4.0
rather than added later:

- schema changes only expand (new tables and optional columns with defaults);
- removing or renaming a column takes two releases: stop writing it, then stop
  reading it;
- an app reads and writes data of its own and the previous minor version;
- an app older than the data's minimum writer version opens read-only and asks
  to update.

The contract is one tested domain function, `src/domain/compatibility.ts`; the
server enforces the same rule from 0.5.0. The data records, in `meta`, the
newest app version that wrote it and the oldest allowed to write it (the
previous minor version of the writer; a major release declares its own);
neither ever goes back, and every check reads it the same way, keeping what
can be read of a damaged record. `prepareDatabase` reads it before any repair
or migration: an app older than the minimum writer runs neither, and its
database refuses every write (`src/persistence/writeGuard.ts`), so it reads the
course and asks to update. Otherwise the app first claims the data, re-reading
the record inside that transaction so it never lowers a newer app's, and only
then repairs and migrates, so an older app is refused from the claim on; an
open that fails after its claim keeps it, so older apps stay refused until a
fixed version opens the data. The guard re-reads the record inside every
write's own transaction, so a write in flight cannot land after a newer app's
claim; statements SQLite refuses inside a transaction (the erase's `VACUUM`)
run under the guarded write lock instead. The app's version comes from
`package.json` at build time (`import.meta.env.VITE_APP_VERSION`); an override
for a build may change only the patch of its channel's baseline, because the
record keeps the newest version for good. The regular channel uses the released
package version; the isolated phone-test channel uses its own baseline
(`versionBaseline`, now 0.4.0) with a patch per published build, and its own
database and storage namespaces
(`src/appChannel.ts`; deployment and pinning are in `docs/DEPLOY.md`). PowerSync's client keeps rows as JSON behind views, so an
older app reads data with columns it does not know, but it does not write
around them: an update through its views rewrites the row without the newer
columns, and opening the database with its schema drops every local-only table
that schema does not declare. Apps up to 0.3.0 predate the contract and cannot
be kept from writing. On the next open of a newer app the repairs (§3) restore
D1's course and metadata columns (a creation time the older app removed becomes
the repair's); any other newer value the older app stripped stays lost, as a
0.2.0 tab already clears a 0.3.0 declared age or crew capacity. A table that
only newer versions declare must be rebuildable from data older versions keep,
so the newer app keeps writing that data too for as long as an older app can
open the database: PowerSync applies an app's schema when it opens, before any
record is read, so even a read-only older app drops such a table. From 0.4.0
the contract keeps an older app from writing.

**Synced mode (B1, `src/persistence/syncMode.ts`).** Making the course tables
synced is not an expand-only change, so the synced schema keeps 0.4.0's
local-only tables declared under `inactive_local_<table>` views and puts
synced tables `synced_<table>` behind the app's own view names; the sync
config delivers the server tables under those names. One transaction switches
a device: it raises the minimum writer to at least `SYNCED_SINCE` (0.5.0),
copies every course row into the synced tables (each enters the upload queue),
empties and compacts the local copy, records the mode in `meta` and advances
the course generation, so open screens stop and the app reopens. Cut short, it
rolls back whole. The mode record fails closed: a present but unreadable row,
or synced rows found without it, mean synced. Every open applies the recorded
mode before the first read (a per-channel hint only picks the first schema),
and on a switched device the open's claim never lowers the minimum below
`SYNCED_SINCE`. An older app opening the database replaces the schema for the
open instances too: its synced rows wait in `ps_untyped` and the queue stays
whole, while the guard refuses every write of a synced instance whose
`courses` view no longer reads the synced table, until a reopen restores it.
An older app therefore opens a switched device read-only and empty. Apps up
to 0.3.0 can still write into the emptied local copy; 0.5.0 never shows those
rows, and its erase and import remove them. The switch needs a prepared,
disconnected database: PowerSync changes no schema while connected.

The record is local to each device: the server needs the writing app's version
with every upload to enforce the same rule. The guard wraps the database
instance, so PowerSync's own writes are refused too once the data is
read-only, sync-stream subscriptions among them: a read-only app that should
still download must be allowed those.

### 3.2 Coherent writes

Use a single database transaction when an operation must remain consistent:

- deleting a never-used student after checking every reference;
- unlinking a boat from the open session and its crew mapping;
- assigning one selected boat to one crew in the open session;
- multi-record confirmation of an automatic duty proposal.

The UI shows saving only while work is pending, success only after commit, and an
in-context retry after failure. Do not let a stale selected session/person apply a
late write to the wrong record.

### 3.3 Course files and local reset

The course file has its own format version and the D3 data-version record;
from a switched device the record carries the data's own minimum (the previous
minor of its newest writer), not the device's `SYNCED_SINCE` floor, so the
previous minor version still imports it. In synced mode the erase and the
import also empty the local copy (§3.1) and forget the synced copy, its upload
queue included; the server's erase follows (§3 Online backup). It contains the active course's schema-whitelisted rows with identifiers,
timestamps and values intact. Migration bookkeeping and the device's local
course generation stay out of the file. Import validates the entire file,
the compatibility contract, stored-row integrity, domain invariants and D2's
paired representations before writing, then replaces the course in one
transaction. Version claims remain monotonic; an interrupted replacement
rolls back its rows, version record and generation together. The same
transaction marks a compaction pending; the import then compacts (VACUUM
under the guarded write lock) so the replaced course leaves nothing in free
pages, and clears the per-course preferences. A compaction that fails or is
cut short stays marked, and the next open finishes it. The device's migration
ledger is kept, so an imported file from before a ledgered migration is not
migrated: 0.4.0 has none, and the first real migration (0.5.0) must record
its state in the file or re-run on import.

Every current database instance binds its course ID and local generation
before the first screen. The write guard checks them inside each acquired
write lock; a replaced or closed instance also rejects before contacting its
worker. Import advances the generation atomically, permanently invalidates
the old instance and requires a fresh app open, even when imported IDs match.
Course erasure also prevents an old screen from writing dangling records.
These session guards apply to instances from 0.4.0 on. An older compatible
writer allowed by §3.1 does not understand the generation and can still save
over imported rows; users must close other old app tabs before importing.
The compatibility window and minimum writer are not raised to hide that limit.

Full reset invalidates the instance, asks other same-channel tabs to close,
closes PowerSync and waits for actual IndexedDB deletion. An unresponsive
older tab keeps deletion pending. A source-hash-guarded adapter releases the
pinned IDBBatchAtomicVFS's existing IndexedDB handle only after its last
SQLite file closes successfully. It retains the stock SDK worker entry,
database-specific name, VFS, locking and write behavior; a surviving desktop
SharedWorker cannot retain a closed course's browser database handle.
It clears only this channel's preferences,
runtime/model caches, exact-scope Workbox caches and worker registration, and
its language-model key in Tesseract's shared store. Cleanup failure reports a
partial reset and permits retry. A per-channel pending-reset mark, set before
the instance closes and removed once the database is deleted, makes the next
open resume the reset before any course is read, so closing the app midway
cannot leave it opening a half-deleted course; a cache that keeps failing to
clear cannot lock the app out. Closing an instance whose engine never started
does not wait for it. The mark names no course: a build without it (0.3.0 and
earlier; test builds before 0.4.3) that creates a course after an abandoned reset loses that course at
the next open of a current build, the same older-writer limit as import's.
Exported files outside the app remain with their recipient. The regular and
test channels remain separate on one origin (`docs/DEPLOY.md`); persistence
permission itself is browser/origin-wide.

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
Loading, recording, processing, denial and recoverable error are explicit; since
V03 the transcript goes straight into the text, with no review step.
Audio is transient. Tests use deterministic audio fixtures, but milestone closure
also requires labelled physical PC/Android/iPhone evidence. Record latency rather
than inventing a fixed threshold.

The owner made a V03-only acceptance exception on 2026-09-25: Android and
PC/Chrome use was sufficient to close that milestone with the current slow,
imperfect speech path. Apple/iPhone was unavailable and remains untested; on
2026-10-06 the owner moved the iPhone checks to future work. Do not convert
this exception into a physical iPhone PASS.

The speech runtime loads ONNX Runtime from the app's own origin and pins the
Whisper model to a fixed Hugging Face revision; the model weights are the only
third-party download, on first use. The roster assistant path (V05) adds no
network call: the operator carries the photograph and the answer.

OCR tests use an anonymous/synthetic corpus with field/person truth, poor-image and
false-row cases. Measure correct readable fields associated with the correct
person. Full-screen camera, free rotation/crop and mandatory review are UI
requirements; images are not retained as app data. The field confidence
threshold is 70 (`MIN_FIELD_CONFIDENCE`); every reading below it stays visible
and marked.

## 6. Verification harness

Keep the existing harness and command surface:

- `npm run verify:quick`: lint, formatting, typecheck and fast tests;
- `npm run verify:domain`: repository, canonical-table, invariant,
  compatibility and documentation checks, and the milestone controller's
  self-test;
- `npm run verify`: quick + domain + production PWA build;
- `npm run verify:e2e`: complete Playwright browser suite;
- `npm run verify:e2e:focus`: the browser specs the milestone being recorded
  lists as `e2eSpecs` in the manifest;
- `npm run verify:all`: verify + deterministic full week + offline check of
  the built PWA + E2E;
- `npm run milestone:start|check|complete -- <ID>`;
- `npm run milestone:await-owner|resume -- <ID>`; `npm run owner:list|check`;
- `npm run ci:status -- [--wait]`: the exact HEAD commit's push verification;
- `npm run evidence -- <ID>`.

The milestone manifest declares verification scripts, evidence and structured
review files. Completion is refused when evidence is missing, verification is not
all PASS, a review verdict is FAIL or any blocker exists. Since F1 a new
completion also requires `verification.json` written by `npm run evidence`,
with a passing run of every declared script and a source digest equal to the
current working tree's. For an ordinary AWAITING_OWNER milestone, it instead
matches the preserved verified checkpoint as defined in
`docs/OWNER_WORKFLOW.md`; release gates still check the current final source.
A hand-written file, partial run or changed pending implementation cannot
close a milestone. Since H1 it also refuses a focused run
that does not match the manifest's `e2eSpecs`, a flaky test not filed in
`docs/working/BACKLOG.md`, a plan that still holds the milestone's section and
a failing `check:docs`. Old 0.1.0 milestone statuses remain immutable history.

**Verification ladder** (H1, 2026-10-09):

- while editing: the focused unit test or spec;
- before every checkpoint commit: `verify:quick`;
- an ordinary milestone close: `verify` and `verify:e2e:focus`;
- release gates and CI: `verify:all`.

Unit tests run in Node, and in jsdom only for component tests and the modules
that read the DOM (`vitest.config.ts`), on four workers. The browser suite
runs on one worker: two were slower on the 8-thread development machine and
added flakes (H1). It allows one retry locally and two in CI: a test that
needs one passed only as a flake. Locally it is listed in `verification.json`
and is a defect to file and fix; in CI it is printed as `FLAKY:` and kept as
the `e2e-flaky` artifact.

CI also retains the JSON browser report on passing runs for 14 days, including
per-case durations and project coverage (`e2e-report` artifacts).

Evidence under `.evidence/<ID>/` is small and reproducible: machine verification,
structured reviews, browser/device metadata and selected screenshots. Browser
evidence identifies the frozen target revision, tested commit, viewport, scenario
and assertions. A screenshot cannot substitute for persistence, accessibility or
domain checks.

For visible milestones, use focused real UI journeys plus the full deterministic
suite at integration gates. Preserve Pixel 7 Chromium, iPhone viewport Chromium
and core iPhone WebKit coverage. Every spec runs on Pixel 7; the iPhone
viewport project runs the specs that assert layout, and the WebKit project the
core journeys (`playwright.config.ts`). Test 320 × 664, 390 × 844 and 412 × 915 where
density/overflow is material; avoid multiplying every test across every viewport.

Agents read `ci:status` at session start and after a checkpoint is pushed. A
completed milestone's pushed checkpoint must have green CI before dependent
work starts. AWAITING_OWNER also requires a green verified checkpoint and the
explicit safe-continuation rules in `docs/OWNER_WORKFLOW.md`; missing owner
feedback alone does not stop eligible work. The closing skill handles failures.
The public API needs no `gh` or token; a token permits higher API limits.

CI runs on push and by hand, cancels a superseded run on the same
branch, and uses Node 24, locked dependencies and uploaded failure artifacts
where useful. It has two tiers (owner, 2026-10-21). The full tier runs
`verify:all` on `main`, by hand and for a push whose head commit
says `[full-ci]`; milestone handoffs, closures and test-site publication
require a full green run of their exact commit, so those commits say
`[full-ci]`. Other pushes run the quick tier: `verify` and
`verify:e2e:smoke` (Pixel on Linux, Pixel and WebKit on macOS). The run's
name records its tier, and a quick run never stands in for a full one. In the full tier the complete suite runs on macOS 15, including
all four browser projects; Linux also runs deterministic checks, the offline
PWA proof and all three Chromium projects, preserving its font and geometry coverage.
Both jobs must pass. This follows the immutable D2/D3 comparison in
`.evidence/D3/ci-adapter-initialization.json`: Linux WebKit recompilation also
exceeds the inherited five-second bound on D2. macOS provides the
[closest Playwright WebKit coverage to Safari](https://playwright.dev/docs/browsers).
Both construction-inclusive five-second bounds, assertions and retries remain;
the startup integration above retains fresh database instances and SDK close.
Earlier cold-open failures remain recorded, not waived. A push
reuses the newest push run only when
it succeeded for the same workflow and exact commit across branches, excluding itself;
manual dispatches and reruns always execute checks. Reuse still checks frozen
documentation against this branch's previous tip. An unavailable API or any
unproven result runs checks. Concurrent runs without a completed green result
both run. A push that changes only documentation,
evidence, the archive, milestone metadata or agent definitions runs `verify`
instead, and only when CI's push run passed on the commit it builds on; any
doubt runs everything (`scripts/ci-scope.mjs`). Such a green run inherits the
browser result of that earlier commit. Local checks remain required. GitHub
Pages publishes `main` only after CI passes on the same commit and after the
built app is proven to work offline at its subpath, or when the owner
republishes `main` by hand.

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

- released baselines: 0.1.0, 0.2.0, 0.3.0 (declared at UG2 on 2026-10-08) and
  0.4.0 (declared at UG3);
- next cycle: 0.5.0, assigned only at its release gate; the versions after it
  are planned in `02_MVP_SCOPE.md` §4;
- patch numbers for separately released fixes;
- later minor numbers for recognizable feature/change packages;
- 1.0.0 only after an explicit stability decision.

Do not version every card or milestone. Update `CHANGELOG.md` at each release gate
with user-visible changes and material migration or limitation notes. Create a
Git tag only when the release is actually declared.

## 8. Explicit non-goals

Do not add a custom backend, GraphQL, global state framework, generalized
repository/provider architecture, custom sync/conflict engine, Supabase/Auth,
native code, release-management service, large design system, generic content
system or speculative abstraction. Supabase, Auth and sync arrive with 0.5.0
as planned in `02_MVP_SCOPE.md` §4; a custom sync or conflict engine stays a
non-goal.
