# Backlog — open requests and findings

> Working document · Owner: the owner · Fold at: UG4

Everything open that no milestone owns yet. A flaky browser test is filed
here as `<spec file> › <test title>`, printed after `FLAKY:`. It carries over
what the 0.4.0 backlog (`archive/v0.4.0/BACKLOG.md`) left open at the release
gate. Items leave when scheduled or dropped by the owner; at the 0.5.0 gate
the rest moves to the next cycle's backlog.

## Decisions due before the first real roster goes online

Still open after the owner's 2026-10-08 decisions (`02_MVP_SCOPE.md` §4
settles the backend and who writes, and records that the owner will confirm
the release and the retention period). 0.5.0 plans them before any real data
leaves a device:

- **who is the data controller** for the rosters held online, and on what
  legal basis: the owner considers the students' signed release sufficient
  and is still to confirm that it covers this service;
- **the retention period**: how long a course stays online after it ends;
- **deletion on the server and in its backups**: erasing a course must also
  remove it from the provider's backups within a stated time, not only from
  the live tables;
- **the speech model files**: today each device downloads them once from
  Hugging Face (pinned revision); a shared deployment may serve them itself.

## 0.5.0 planning candidates

The UG2 field findings and one owner-assigned item; none was picked for
0.4.0, and the owner picks which join 0.5.0.

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
6. **The D2–D5 crew-size override** in Impostazioni, assigned by the owner on
   2026-09-24 to the follow-up after the 0.3.0 gate.

Other findings, not yet put to the owner:

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
- with no course, the start screen still offers the full reset; after a reset
  it is redundant and may be hidden when nothing remains (D4 owner check,
  2026-10-20). At 320 px/200% text its heading breaks inside a word
  (FU-R7-Q3);
- in WebKit at 320 px and 200% text, focusing the crew portal's close button
  can shift its header sideways, clipping the title and legend; every action
  stays reachable (D3 FU-Q13);
- sex inferred wrongly for some foreign first names (UG2-FUN-5), no warning
  for a missing size (UG2-FUN-10), warning severity by dot colour only in the
  detail (UG2-FUN-11), the C chip hidden while selected (UG2-FUN-12), the
  age field saving a half-typed number (UG2-DAT-6), and the wording and
  layout notes UG2-UX-10 to 16.

## Retrospective proposals awaiting the owner's pick

The 0.1–0.3 retrospective (`archive/v0.4.0/RETRO_0X.md`) proposes ten
changes; three were adopted on 2026-10-12 (`docs/agents/REVIEW_PROTOCOL.md`,
`03_TECHNICAL_DECISIONS.md` §6, `docs/OWNER_WORKFLOW.md`). The rest:

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

## Flaky browser tests

Each passed only on a retry and is a defect to fix (03 §6).

- `student-management-gate.spec.ts › keeps the complete student workflow consistent across reload`
  — Mac WebKit CI `39235069108`: Disabilita allievo was absent after
  reactivation; the retry passed. Cause unproven. See
  `.evidence/T1/ci-checkpoint-434cdcc.json`; CI retains traces when a retry
  makes it green.

- `student-management-gate.spec.ts › creates, corrects and reloads a declared age without a birth date`
  — WebKit, B1's recorded run (2026-10-25, 1.4 h): the first attempt failed with
  "page.goto: Could not connect to server", as did three other WebKit cases
  late in the same run; the dev server stopped answering. Rerun alone, all
  pass. Environment (long run on the 8 GB PC), not the app.

- `d4-course-files.spec.ts › exports the upgraded course and imports it through the fresh app, every row unchanged even after immediate close`
  — stalled twice opening the fresh WebKit recipient before import (D4,
  2026-10-17); isolated reruns and every later run passed without retries.
  Failure-only diagnostics retain each page's engine events, locks and
  resource timings. Cause unproven. See `.evidence/D4/development-checks.json`.

- `d1-migration.spec.ts › keeps the ledger and repairs the rows when a 0.3.0 app writes to the upgraded database`
  — WebKit page closure, classified on 2026-10-21 as memory pressure (a WebKit
  page peaks near 2 GB in these specs; clean 45/45 on one idle worker). See
  `.evidence/T1/webkit-page-loss-classification.json`.

- `ug2-hostile-roster.spec.ts › shows and copies the hostile crew summary exactly as the screen has it, at four sizes`
  — iPhone 13 WebKit, D3's focused run (2026-10-13): zero boat logos on the
  first attempt; the retry passed. No recurrence since; CI keeps the trace if
  it returns.

- `scripts/check-test-app-isolation.mjs --full-reset` (WebKit, test app's
  first open) — in UG3's `verify:all` on `3b5d400` (2026-10-22) the page
  crashed 2.8 s after opening ("Target crashed"); the check alone then passed
  on both engines. Not a Playwright case, so no retry hides it; the same
  WebKit page loss under load as below.

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

- **For 0.5.0's first migration** (UG3 DI-UG3-2): an import keeps the device's
  migration ledger, so a file from before a ledgered migration is imported
  unmigrated (03 §3.3). DI-UG3-Q3: a hand-edited file can raise the recorded
  newest version; validate it against `minimumWriterOf` then.
- **Older writers and import** (D4): an older compatible writer allowed by
  03 §3.1 cannot read the local generation and can save over imported rows;
  the preview asks to close other old tabs. Compatibility planning must
  address it without silently changing the writer window.
- **The Android reset hang on 0.4.2** (D4 owner check, 2026-10-19): unproven
  cause. 0.4.3 bounds and resumes the reset and passed on the phone.
- **Test and regular app installed together** (owner, 2026-10-22, D4 and
  UG3): their data stays separate, but installing both on one phone is
  unreliable. Updating them seemed to conflict; it worked once, then after
  reinstalling the regular app, Chrome says CVC Helper Test is already
  installed although no icon exists (a failed uninstall, or the two apps on one
  origin, `docs/DEPLOY.md`; a reboot may clear it). Not blocking. Before the
  next phone check: reproduce it, then consider giving the test channel its
  own origin, which would also end the shared origin-wide persistence
  permission (03 §3.3).
- **Sign-in tokens on a shared origin** (B3 SP-B3-5): the backup session and
  its refresh token sit in localStorage on `furiocolombo.github.io`, shared
  with every other Pages site of the owner, and `index.html` has no
  Content-Security-Policy. Before production (UG4): a CSP and an origin of
  the app's own (the same move as the test channel's origin above).
- **Full reset does not revoke the backup session** (B3 SP-B3-7): it removes
  the stored session but never signs out on the server, so the refresh token
  stays valid until it expires. Sign out first when online. Likewise Esci
  (B3 SP-B3-12): a refresh the library was already retrying may still
  exchange the old refresh token when signal returns; the result is
  discarded on the phone, but the server issued it. Revoke on the server
  (global sign-out when online) before production.
- B1 SC-B1-Q6: when an older app reopens beside an open synced tab, the
  refused save says the course was "sostituito o eliminato" and the typed
  student is lost on reopen; data is intact, the message and the draft are
  not. Say an older version opened the data, and keep the draft.
- UG3 RH-Q1: after an import and Riapri l’app, phone Back walks through the
  replaced course's earlier screens; clear the shell history on reopen.
- T1 CQ-6: each e2e seeding fixture re-reads the course that
  `bootstrapCourse` just created; return its id instead.
- Persistence API invariant (D3 DI-R2-Q4 / DI-Q5): forbid mutating SQL through
  read APIs or raw execution, or route it through the guarded write lock. No
  app caller does so today.

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
  its fidelity limits (CQ-8);
- gesture thresholds are unnamed and the long press exists twice with
  different values (CQ-11);
- brand-asset and cache-size lists kept in step by hand in three places
  (CQ-12);
- invariant issue codes are plain strings (CQ-13);
- the erase-completeness test reads `db.ts` as text (CQ-14);
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
- the "non disponibile" screens give no cause (UG2-DAT-12);
- the hostile roster has no pair of names that differ by one character
  (UG2-SCO-13).

Navigation (detail in `archive/v0.3.0/1_0_0_NEXT_STEPS.md`):

- route every history move through one queue keyed by entry id, and recognise
  a held-Back restore by entry id instead of a one-second window;
- Back after a manual add from Scan returns to Scan; Back into Valutazioni does
  not restore the exact session; the first Back on Home after launch seems
  inert.

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

- no integrity check reports a stay-over student who no longer exists, and the
  duty screens then refuse every save (DP-Q3);
- the duty-setting rows' probe reads every row on every open (16 ms for one
  course, 97 ms for 30); before 0.7.0 keeps a season, scope it to courses that
  changed or index `courseId` (DI-R2-Q2).
