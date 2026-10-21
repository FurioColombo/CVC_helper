# Backlog — open requests and findings

> Working document · Owner: the owner · Fold at: UG3

Everything open that no milestone owns yet. A flaky browser test is filed
here as `<spec file> › <test title>`, printed after `FLAKY:`. It gathers the
0.3.0 working documents archived in `archive/v0.3.0/` and the
UG2 review findings (`.evidence/UG2/*-review.json`). Items leave when scheduled
or dropped by the owner; at UG3 the rest moves to the next cycle's backlog.

## Decisions due before the first real roster goes online

From the 0.3.0 next steps, still open after the owner's 2026-10-08 decisions
(`02_MVP_SCOPE.md` §4 settles the backend and who writes, and records that the
owner will confirm the release and the retention period). 0.5.0 plans them
before any real data leaves a device:

- **who is the data controller** for the rosters held online, and on what
  legal basis: the owner considers the students' signed release sufficient
  and is still to confirm that it covers this service;
- **the retention period**: how long a course stays online after it ends;
- **deletion on the server and in its backups**: erasing a course must also
  remove it from the provider's backups within a stated time, not only from
  the live tables;
- **the speech model files**: today each device downloads them once from
  Hugging Face (pinned revision); a shared deployment may serve them itself.

## Waiting for the owner's choice

The UG2 field findings and one owner-assigned item; the owner picks which join
0.4.0 as a fix milestone.

1. **Course start date** comes only from the day the course is created; add a
   way to correct it (UG2-DAT-4, UG2-FUN-7).
2. **Two open copies** of the app overwrite each other's session plan
   (UG2-DAT-9).
3. **Phone Back** from the crew destination chooser or a warning detail goes
   to Home (UG2-UX-4, UG2-REG-5).
4. **Long names on crew cards** are cut with "…" at narrow widths; may they
   take two lines? (UG2-RS-2, rulebook R05)
5. **Text at 115–150% on 360–412 px**: the Barche list scrolls sideways, the
   crew header puts text under its buttons, "Volontari" breaks mid-word, and
   pages drop to one column early (UG2-REG-2, UG2-REG-4; D3 review RH2-Q4
   saw the Barche list again).
6. **The D2–D5 crew-size override** in Impostazioni: on 2026-09-24 the owner
   assigned it to the Claude Code follow-up after the 0.3.0 gate, which is now.

Other UG2 findings, not yet put to the owner:

- composing a session from scratch takes about two long scrolls per student
  and the crew just filled is off screen (UG2-UX-2);
- the minor, C and SM markers and some secondary text are 9–11 px (UG2-UX-6);
- after "Leggi risposta" the count confirmation is above the fold, and a
  pasted answer is lost on Back (UG2-UX-8);
- a double tap on an in-app Back or close button leaves the area
  (UG2-REG-3);
- `Aggiorna` and phone Back discard a half-filled new-student or new-volunteer
  form, as N1 approved, and an assistant answer pasted but not yet read: guard
  them only if the owner prefers (D3 review RH-4 found the volunteer form);
- after an update the crew page reopens on Sabato PM at the top, not on the
  session that was open, and a mistaken `Più tardi` leaves the update three
  taps away in Impostazioni (D3 review FU-Q3, FU-Q6);
- with read-only data the screens still offer a `Riprova` that cannot work,
  and the crew page calls a refused move "non valida"; only the bar gives the
  reason (D3 review FU-Q7);
- at 175–200% text on a 320 px phone with the bar up, the end of the Allievi
  list scrolls into a blank screen (D3 review FU-Q11);
- sex inferred wrongly for some foreign first names (UG2-FUN-5), no warning
  for a missing size (UG2-FUN-10), warning severity by dot colour only in the
  detail (UG2-FUN-11), the C chip hidden while selected (UG2-FUN-12), the
  crew page reopening on Sabato PM (UG2-FUN-13), the age field saving a
  half-typed number (UG2-DAT-6), and the wording and layout notes UG2-UX-10
  to 16.

## Retrospective proposals awaiting the owner's pick

The 0.1–0.3 retrospective (`archive/v0.4.0/RETRO_0X.md`, delivered on
2026-10-10 after H1 closed without it) proposes ten changes, each with its cost,
root cause and the check that would show it worked. The owner adopts bounded
review rounds, CI visibility/reuse and owner checks before completion with
safe parallel work on 2026-10-12; their rules live in
`docs/agents/REVIEW_PROTOCOL.md`, `03_TECHNICAL_DECISIONS.md` §6 and
`docs/OWNER_WORKFLOW.md`. The
remaining proposals await the owner's pick:

1. `npm run evidence -- <ID> --from-ci` records a green CI `verify:all` of
   HEAD at a gate instead of a local run (friction 1).
2. `npm run evidence` exits early when the same source digest already passed
   (friction 5).
3. `scripts/run-e2e.mjs` takes a machine-wide lock so two browser runs never
   overlap (friction 6).
4. One quiet runner for the verify scripts, the full log to `test-results/`
   (friction 7).
5. Node 24 as the machine default, the Program Files Node 18 removed or
   demoted: an owner action (friction 8).
6. Agent transcripts treated as private data: the owner deletes or moves the
   0.x ones offline and sets `cleanupPeriodDays` (friction 9).
7. `milestone:complete` writes the plan's status row from the manifest
   (friction 10).

## Current CI gate

D3's source/publication CI is green (`.evidence/D3/ci-compiler-worker-fix.json`).
D4 exact `fde1fe1` and T1 `b8eda01` CI pass without retries. The later local H1/T1 pair misses the speed target and finds a partial-reset flake; see `.evidence/T1/test-timing.json`. Closed-sibling cold seeding passes 16/16 controlled cases versus 5/16 same-page failures (`.evidence/T1/cold-seed-lifecycle.json`).

## Flaky browser tests

Windows D3 share probes stalled before exit; a manual attempt also timed out. Neither is PASS; cause unclassified.
Later `33ac7c9` passed 105 cases without retries. D4 field rechecks needed their owned Vite server stopped after test bodies passed; see `.evidence/D4/field-ux-review-round-4.json`.

Each passed only on a retry and is a defect to fix (03 §6). Fixed entries
left at T1's close (2026-10-21); see `.evidence/T1/self-review.json`.

- `student-management-gate.spec.ts › keeps the complete student workflow consistent across reload`
  — Mac WebKit CI `39235069108`: Disabilita allievo was absent after reactivation; the retry passed. Cause unproven. See `.evidence/T1/ci-checkpoint-434cdcc.json`; T1 also retains traces when a retry makes CI green.

- `d4-course-files.spec.ts › exports the upgraded course and imports it through the fresh app, every row unchanged even after immediate close`
  — the first development dual-engine run stalled opening the fresh WebKit
  recipient before import. An independent recipient process with the correct
  device identity then passed, followed by all 14 phone cases without retries.
  It recurred on 2026-10-17 in a 22-case fix run (21 passed); the isolated
  diagnostic run then passed in 49.9 s without retries. Failure-only read
  diagnostics now retain each page's engine events, locks and resource timings.
  The `193a250` recorder passed 99 cases without retries and both production
  isolation engines. Cause unproven; T1 must investigate this filed defect
  after D4's CI gate. See `.evidence/D4/development-checks.json`.

- `d1-migration.spec.ts › keeps the ledger and repairs the rows when a 0.3.0 app writes to the upgraded database`
  — WebKit page closure; classified on 2026-10-21 as memory pressure (a WebKit
  page peaks near 2 GB in these specs; clean 45/45 on one idle worker). See
  `.evidence/T1/webkit-page-loss-classification.json`.

- `ug2-hostile-roster.spec.ts › shows and copies the hostile crew summary exactly as the screen has it, at four sizes`
  — iPhone 13 WebKit, D3's focused run (2026-10-13): zero boat logos on the
  first attempt; the retry passed. No recurrence in any later run (T1 pairs
  of 2026-10-19 and 2026-10-21, CI); CI now keeps the trace if it returns.

- `d2-duty-items.spec.ts` (0.3.0 lists, rebuilt rows, stale 0.3.0 tab)
  — the same WebKit page closure under load; same classification and
  evidence as above.

## Future work the owner has named

- **Speech:** faster and more accurate, with the model downloaded with the app
  so dictation works offline from the start.
- **iPhone checks:** every check in `docs/DEVICE_CHECKS.md` on an iPhone; the
  owner has no iPhone and will ask.
- **GitHub Support** purge of the pre-rewrite commits: only when the owner
  says.
- **Final product name and derived mark** (deferred).
- **An automated real-photograph regression**, only with synthetic or
  irreversibly anonymised images.
- **The student detail's evaluation history** redesign (the second,
  repetitive presentation).

## Engineering follow-ups

- D4 owner check (2026-10-19): what held the Android full reset (app left
  unopenable until reinstalling on 0.4.2) is unproven. 0.4.3 bounds and
  resumes the reset and passed on the phone; the cause is not established.

- T1 review CQ-6: each e2e seeding fixture re-reads the course that
  `bootstrapCourse` just created; return its id instead (refactor only).

- D4 owner check (2026-10-20): with no course, the start screen still offers
  Azzera i dati di questo dispositivo. It clears offline files, models and
  preferences, but after a full reset it is redundant; the owner may hide it
  when nothing remains. Review FU-R7-Q3: at 320 px/200% text the reset
  heading "Cancellazione dei dati locali…" breaks inside a word.

- D4 import invalidates current app instances by a local generation. Older
  compatible writers permitted by 03 §3.1 cannot read that generation: a D3
  guard with the current engine can overwrite imported values after a same-ID
  replacement. The import preview asks users to close other old tabs. Future
  compatibility/lifecycle planning must address this boundary without silently
  changing the approved writer window. D4's sync-chaos review retains the probe;
  it exercises the old guard, not the whole historical application.

From the UG2 code-quality review, before the shared database
(`.evidence/UG2/code-quality-review.json`):

- split `CrewManagement.tsx` (3,600 lines) into a crew-plan hook, the boat
  pager and its panels (CQ-1);
- one dialog focus and Escape helper (CQ-2), and one history-state mechanism
  (CQ-3);
- log the cause of a failed save (CQ-4);
- one age module and one name-folding helper (CQ-5);
- the D1-morning rule into the domain, and dead helpers deleted (CQ-6, rest);
- one summary shell and named colour tokens (CQ-7);
- one crew-plan validation path and a shared load and error screen (CQ-9);
- the e2e suite organised by feature with typed seeding (CQ-10), and the
  parked `test.fixme` in `tests/e2e/ug2-hostile-roster.spec.ts`;
- the 1,184-line summary renderer `src/lib/pageSnapshot.ts` fails silently at
  its fidelity limits (CQ-8; the build already refuses the test hook in
  production);
- gesture thresholds are unnamed and the long press exists twice with
  different values (CQ-11);
- brand-asset and cache-size lists kept in step by hand in three places
  (CQ-12);
- invariant issue codes are plain strings (CQ-13);
- the erase-completeness test reads `db.ts` as text (CQ-14), which D1's new
  table and D4's full reset depend on;
- a one-line wrapper tested at the wrong layer (CQ-15); small helpers repeated
  by hand: plurals, family code, session label, Collator, page header and back
  button (CQ-16);
- lint and type rules do not enforce the conventions the code relies on
  (CQ-17); comments narrating review history, and two unused ids (CQ-18);
- `StudentScan` is 1,220 lines with 16 states and 12 refs, and "row is
  complete" is decided in four places (CQ-19); persistence and form plumbing
  duplicated (CQ-20);
- the image-against-screen pixel comparison covers only the first screen of a
  long summary (CQ-21).

From the UG2 data-integrity and scope reviews:

- the clipboard image left by Copia immagine and stored values quoted in error
  messages are traces the app cannot erase, and nothing says so (UG2-DAT-11);
  D4's full reset should name them;
- the "non disponibile" screens give no cause (UG2-DAT-12);
- the hostile roster has no pair of names that differ by one character
  (UG2-SCO-13);
- `.evidence/UG2/physical-device-review.json` gives per-check PASS verdicts
  from one-line owner reports (UG2-SCO-14); future device reports follow
  `docs/DEVICE_CHECKS.md` and record each check's own result.

Navigation (detail in `archive/v0.3.0/1_0_0_NEXT_STEPS.md`):

- route every history move through one queue keyed by entry id, and recognise
  a held-Back restore by entry id instead of a one-second window;
- Back after a manual add from Scan returns to Scan; Back into Valutazioni does
  not restore the exact session; the first Back on Home after launch seems
  inert;

Scan and paste:

- a pasted name equal to a placeholder word (`Nota`) shows as unread;
- the Allievi list would break on a corrupt stored birth date (no current path
  creates one);
- heading words in names, staff headings without a role code and footers with
  a student word: the remaining cases need the table's column structure, not
  more word lists; S4's limits (keyword surnames without an age, 1 px strokes
  touching a rule, a synthetic column drop);
- the OCR worker and the speech pipeline stay in memory for the whole session
  (UG2-DAT-8); measure on a low-end phone.

From the D2 reviews (`.evidence/D2/`):

- no integrity check reports a stay-over student who no longer exists, in the
  list or the rows, and the duty screens then refuse every save (DP-Q3; the
  state predates D2 for the list);
- the duty-setting rows' probe reads every row on every open (16 ms for one
  course, 97 ms for 30 on the development PC); before 0.7.0 keeps a season,
  scope it to courses that changed or index `courseId` (DI-R2-Q2).

- Persistence API invariant (D3 DI-R2-Q4 / DI-Q5): forbid mutating SQL through
  read APIs or raw execution, or route it through the guarded write lock.
  No app caller uses that escape today; `executeRaw` checks compatibility
  before its lease, while `get`/`getAll`/`getOptional` accept arbitrary SQL.

- D3 RH4-Q1 is fixed at `73688ef`: narrow destination panels use one column,
  so action labels wrap between whole words. Both engines pass full action
  containment and focus/tap checks. FU-Q12 viewport-top clipping is fixed by
  viewport caps and internal scrolling; see `.evidence/D3/ci-regression-fix.json`.
- D3 FU-Q13: in WebKit at 320 px and 200% text, focusing the crew portal's
  close button can horizontally shift its scrollable header, clipping the
  Equipaggio title and Non disponibile legend on the left. Close and every
  enabled destination action remain contained and reachable. This nonblocking
  header/legend layout finding is retained in the restricted round-7 field
  review; a future field-layout pass can let the header shrink or wrap.
