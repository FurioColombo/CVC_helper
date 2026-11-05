# Backlog — open requests and findings

> Working document · Owner: the owner · Fold at: UG4

Everything open that no milestone owns yet, including what the 0.4.0 backlog
(`archive/v0.4.0/BACKLOG.md`) left open. A flaky test is filed as
`<spec file> › <test title>`, printed after `FLAKY:`. Items leave when
scheduled or dropped; at the 0.5.0 gate the rest moves on.

## Decisions due before the first real roster goes online

Still open after the owner's 2026-10-08 decisions (`02_MVP_SCOPE.md` §4);
0.5.0 plans them before any real data leaves a device:

- **who is the data controller** for the rosters held online, and on what
  legal basis: the owner considers the students' signed release sufficient
  and is still to confirm that it covers this service;
- **the retention period**: how long a course stays online after it ends;
- **the provider's backups**: B6 states they keep an erased course "at most
  7 days" (decision 17); confirm it for the production plan;
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

The 0.1–0.3 retrospective (`archive/v0.4.0/RETRO_0X.md`) proposes ten changes;
three were adopted on 2026-10-12. The rest:

1. `evidence -- <ID> --from-ci` records a green CI `verify:all` (friction 1).
2. `npm run evidence` exits early on an already passed digest (friction 5).
3. `scripts/run-e2e.mjs` takes a machine-wide lock (friction 6).
4. One quiet runner for the verify scripts, log in `test-results/` (friction 7).
5. Node 24 as machine default, Node 18 demoted: owner action (friction 8).
6. Transcripts as private data: the owner moves the 0.x ones offline and sets
   `cleanupPeriodDays` (friction 9).
7. `milestone:complete` writes the plan's status row from the manifest
   (friction 10).

## Backup, from the owner's recheck (2026-11-02)

- **An open screen does not refresh on a download:** another device's change
  shows only when the screen is opened again. Needed before sharing a course.
- **A sync client that cannot start fails silently** (the SDK swallows it): a
  restore shows "Ripristino…" for ever. Say so and offer Riprova.
- **Two desktop tabs (B4 review, 2026-11-02):** the update notice shows only in
  the tab that won the upload (SC-DT-3); the tabs word one stuck change
  differently (SC-DT-Q6); a sign-out racing a reload can leave a tab showing
  "Accesso" with nothing synced (SC-DT-5); Esci and the reset wait for a hung
  upload (SC-B4F-1 below); a failed erase leaves other tabs on "Il corso è
  cambiato" (SC-DT-Q7). Forced only: a tab that misses the erase notice
  re-downloads the course, whose later work the record then erases (SC-DT-8).
- **Erase edges (B4 review, 2026-11-03):** a retry cannot tell its id was lifted
  when the answer to recording it was lost (SC-DT-6-R; a server-side erase call
  would close it); a second tab's late delete erases a course just imported
  (SC-DT-10); an old tab repeats a marked erase (Q9); a marked record, Esci and
  reset leave an id refusing course-row edits (Q10); no Esci in state "error" (Q11).

## Flaky browser tests

Each passed only on a retry and is a defect to fix (03 §6).

- `b1-sync-mode.spec.ts › a course file imported on a switched device lands in the synced tables`
  — WebKit, page closed ~6 s in, alone 10/11. Likely a crash under load. The same
  in B5's rerun (2026-11-04, B6's passed):
  `b1-sync-mode.spec.ts › switches a 0.2.0 course to synced tables with every row identical and queued once`,
  `b1-sync-mode.spec.ts › switches a 0.4.0 course to synced tables with every row identical and queued once`,
  `b1-sync-mode.spec.ts › the app erases a switched course, queues the deletion and keeps a new course synced`.

- `f1-navigation-guards.spec.ts › phone Back holds Valutazioni while a note is open`
  — WebKit, B3's run: no course heading in 30 s; 5 isolated runs passed. Cause unproven.

- B3 FUX-B3-R4-Q1, B7: a second tab on WebKit opens in 25-29 s, one tab in about 8
  (Windows test engine; 10/10 opened, none hung). Cause unproven; not seen on a phone.

- `b7-two-courses.spec.ts › two courses open on the choice, and keeping one opens it with every row`
  — B7: Chrome reopened on Allievi; WebKit opened no course in 15 s with the disk full (ENOSPC). Unproven.

- `student-management-gate.spec.ts › keeps the complete student workflow consistent across reload`
  — Mac WebKit CI: Disabilita allievo absent; see `.evidence/T1/ci-checkpoint-434cdcc.json`.

- `student-management-gate.spec.ts › creates, corrects and reloads a declared age without a birth date`
  — WebKit, B1 run: the dev server stopped answering late (environment).

- `b3-backup-ui.spec.ts › the code in the email signs in; … Esci asks first`
  — Mac WebKit CI `41215663327`: Esci's warning did not open. Cause unproven.

- `d4-course-files.spec.ts › exports the upgraded course and imports it through the fresh app, every row unchanged even after immediate close`
  — stalled twice opening the fresh WebKit recipient before import (D4, 2026-10-17;
  B4's run of 2026-10-31, B6's passed); isolated reruns pass. Failure-only diagnostics
  retain engine events, locks and timings. Cause unproven. See `.evidence/D4/development-checks.json`.

- `d1-migration.spec.ts › keeps the ledger and repairs the rows when a 0.3.0 app writes to the upgraded database`
  — WebKit page closure, memory pressure (2026-10-21; 45/45 on one idle worker).
  See `.evidence/T1/webkit-page-loss-classification.json`.

- `ug2-hostile-roster.spec.ts › shows and copies the hostile crew summary exactly as the screen has it, at four sizes`
  — iPhone 13 WebKit, D3: no boat logos on the first attempt. No recurrence.

- `scripts/check-test-app-isolation.mjs --full-reset` (WebKit, test app's
  first open) — UG3's `verify:all` on `3b5d400` (2026-10-22): "Target
  crashed" 2.8 s in; alone it passed on both engines. The same WebKit page
  loss under load as below.

- `d2-duty-items.spec.ts` — the same WebKit page closure under load.

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
- **Test and regular app installed together** (owner, D4 and UG3): their
  data stays separate, but installing both on one phone is unreliable (Chrome
  reports the test app installed with no icon; the two share one origin,
  `docs/DEPLOY.md`). Give the test channel its own origin, which also ends
  the shared persistence permission (03 §3.3).
- **Before production (UG4), sign-in hardening** (B3 SP-B3-5, -7, -12): the
  session and refresh token sit in localStorage on the shared
  `furiocolombo.github.io` origin with no Content-Security-Policy; add a CSP
  and an origin of the app's own. Full reset and Esci forget the session
  only locally (a refresh already retrying may still exchange it); revoke it
  on the server when online.
- **A custom email sender before production** (B3, 2026-10-26): Supabase's
  sender reaches only the team, a few emails an hour, with fixed templates:
  no code in the email, so "Codice dell’email" leads nowhere until SMTP
  (B3-EMAIL-CODE). Before UG4: the sender and code, or hide the field.
- B4 review follow-ups (`.evidence/B4/`; SP-B4-3: decisions 16 and 19):
  - a delete leaves no tombstone: an older whole-row edit uploaded after a later delete
    brings the row back (expected failure in `placementConvergence.test.ts`, SC-B4-8).
    Record deletion times and keep tombstones on the server before team editing (1.0.0);
  - DI-B4-Q1: crew history counts a member Equipaggi dropped, until saved;
  - SC-B4-Q4: a member of a crew deleted elsewhere leaves without a notice;
  - B5 (`.evidence/B5/`): SC-B5-6, a device importing the account's own
    course id merges unasked; DI-B5-4, no invariant sees two active courses
    on a device; DI-B5-R2-Q1, a device that signed out while awaiting the
    account's course needs the account or a full reset to make one;
  - B6: DI-B6-R2-Q2, another tab shows an erased course until reopened;
    DI-B6-Q2, a read-only device repeats a pending erase; SP-B6-Q5, compaction
    at each empty open; b4-uploads › the switch uploads… flaky under load;
  - B7 (`.evidence/B7/`): SP-B7-R3-Q2, the reset does not revoke the session on the
    server; DI-B7-R3-2, keep against a child batch can deadlock, no harm, Riprova works;
    SP-B7-R2-Q1, a course arriving and leaving one empty session stays in free pages;
    FU-B7-R3-Q1/Q3, the reset's four names, no offline stop; SC-B7-Q10, refusals kept
    on a device with no marks; DI-B7-R3-1, an edit keeping its stamp goes unseen;
  - DI-B4-Q2: an older app opening the database drops `uploadRefusals`;
  - SC-B4-Q1: an unrecognised upload failure retries forever; show the last accepted upload;
  - SP-B4-Q3 / SC-B4F-1: the SDK's requests have no timeout: a write
    checkpoint hung on a dead connection holds uploads, Esci, the erase and the
    restart until a reopen (owner check 2026-10-28); only inserts are batched.
- B3 SELF-B3-Q1: a switch deferred after sign-in says "Backup pronto. Riapri
  l’app" only in Impostazioni. Consider a one-line notice on Home.
- B1 SC-B1-Q6: an older app beside a synced tab makes a refused save say "sostituito o
  eliminato" and loses the typed student on reopen. Say so, and keep the draft.
- UG3 RH-Q1: after import and reopen, Back walks the replaced course's screens.
- T1 CQ-6: each e2e seeding fixture re-reads the course `bootstrapCourse` just created.
- Persistence API invariant (D3 DI-R2-Q4 / DI-Q5): forbid mutating SQL through read APIs
  or raw execution, or route it through the guarded write lock. No app caller does so.

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
