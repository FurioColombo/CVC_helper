# Next steps — from the local 0.3.0 app to a shared database and 1.0.0

Written 2026-09-26/27 by Claude Code at the owner's request, alongside F1 (the
remaining corrections and an independent adversarial review of the whole
0.3.0 line) and V05 (the assistant paste path). Their closure evidence is in
`.evidence/F1/` and `.evidence/V05/`. Open questions for the owner are in
[`0_3_0_QUESTIONS.md`](0_3_0_QUESTIONS.md); this document does not repeat them.

## Is the local version ready to freeze?

**Yes, for the owner (2026-10-06): the deployed app is 0.3.0.** Every
milestone through F4 is complete with its evidence; F4's `verify:all` ran on
the deployed source. On Android the owner has checked the camera scan, the
assistant paste from the ChatGPT and Claude apps, the installed app offline,
phone Back, the summary images and the update banner.

Two items are not done and are future work by the owner's decision: the
iPhone checks (the owner has no iPhone) and asking GitHub Support to purge the
pre-rewrite commits. The formal UG2 close in `04_IMPLEMENTATION_PLAN.md` (the
six independent reviews, the version bump and the `v0.3.0` tag) has not been
run; it waits for the owner too.

## Recommended sequence

1. **UG2 — 0.3.0 release gate.** Once the pushed `main` has passed CI (and
   Pages has deployed it), phone-test it with
   `docs/post-mvp/UG1_DEVICE_VALIDATION.md`, whose UG2 section now lists the
   offline, Back, update, erase and V05 checks; record the
   physical-device report, run the six UG2 reviewers, bump the version and
   changelog, tag `v0.3.0`.
2. **0.4.0 — data readiness, still local.** Everything a shared database needs
   that is also valuable on one device:
   - export and import of a whole course (a file the owner keeps), and
     `navigator.storage.persist()` so the browser does not evict the only copy;
   - schema metadata: `createdAt`, `updatedAt` and a per-record version on every
     table (only faults have timestamps today), and tombstones for deletions;
   - `courseId` on `faults`, `crewMembers` and `evaluations` (today reachable
     only through joins, which per-course sync rules handle poorly);
   - replace the JSON lists in `dutySettings` (`fewerDayIds`, `extraDayIds`,
     `stayOverStudentIds`, `completedDayIds`, `acknowledgedWarningKeys`) with
     rows, so two editors cannot overwrite each other's whole list;
   - a schema version and a compatibility check between app and data, because
     service-worker updates reach devices at different times;
   - tested migrations from 0.1/0.2/0.3 data for all of the above.
3. **0.5.0 — read-only sharing.** One editing device publishes, others read.
   This needs the backend decisions below, authentication, and a data
   retention and deletion policy for minors' personal data before any real
   roster leaves a device.
4. **1.0.0 — multi-editor.** Sync in both directions with conflict handling for
   the few genuinely shared records (crew plans, duty plans, evaluations),
   per-course roles, audit of who changed what, and an explicit stability
   decision as `03_TECHNICAL_DECISIONS.md` §7 requires.

## Decisions the shared version needs (not yet taken)

- **Backend and hosting.** The local store is PowerSync, whose sync service
  pairs with a Postgres backend (for example Supabase, already named in the
  technical decisions as the later option). Self-hosted or managed, and in
  which region, is an owner decision with privacy and cost consequences.
- **Authentication and roles.** Who may read or edit which course; how
  instructors and assistant instructors are invited and removed.
- **Personal data of minors.** Legal basis, retention period, deletion at the
  end of a course, and who is the data controller. The app already erases a
  course locally on request (Settings); the shared version needs the same
  guarantee on the server and in backups.
- **Third-party services.** Speech downloads its model from Hugging Face once
  per device (pinned revision); OCR is fully local; the V05 path relies on an
  assistant the operator chooses. For a shared deployment, consider
  self-hosting the speech model files.

## Future work the owner added on 2026-09-28

- **Speech.** Kept as it is for 0.3.0, but too slow and imprecise. Improve speed
  and accuracy, and download the speech model with the app (today it downloads
  on the first dictation), so dictation works offline from the start.
- **A full local reset.** Erasing the course deletes its rows and compacts the
  database where the browser allows; offer a full local reset as well, so
  deleted rows cannot linger in unused database pages.
- **GitHub Support.** GitHub still serves the pre-rewrite commits by their old
  ids until it purges them. The owner deferred asking GitHub Support to remove
  cached views and unreferenced objects, and on 2026-10-06 chose not to
  contact them; it waits until the owner says.

## Future work the owner added on 2026-10-06

- **The iPhone checks.** Copia immagine and Condividi on the summaries, speech
  (never tested on Apple), and the installed app. The owner has no iPhone;
  they wait until the owner asks for them.
- **A more reliable app update.** The update banner appeared on the owner's
  Android phone a couple of times, but uninstalling and reinstalling is more
  reliable. Make an update always reach an installed app (and say so), so no
  one needs to reinstall.

## Findings of the UG2 reviews left for later (2026-10-07)

Recorded with their evidence in `.evidence/UG2/*-review.json`; none blocks
0.3.0. Ask the owner which matter in the field before building them.

- **Course dates** come only from the day the course is created; add a way to
  correct the start date (UG2-DAT-4, UG2-FUN-7).
- **Keep the course safe:** call `navigator.storage.persist()` and add export
  and import (UG2-DAT-5; already step 2 below).
- **Composing a session from scratch** takes about two long scrolls per
  student, and the crew just filled is off screen (UG2-UX-2).
- **The update banner** covers the crew page's floating bar and the Allievi
  add button while it is shown (UG2-UX-3).
- **Type scale:** the minor/C/SM markers and some secondary text are 9–11 px,
  below the rulebook's proposal (UG2-UX-6).
- **Paste review:** after "Leggi risposta" the count confirmation is above the
  fold (UG2-UX-8); a pasted answer is lost on Back.
- **Crew cards** cut a long name with "…" at narrow widths (UG2-RS-2, rulebook
  R05): the owner decides whether names may take two lines.
- **Phone Back** from the crew page's destination chooser and warning detail
  still goes to Home; the boats panel was fixed (UG2-UX-4, partly fixed).
- Smaller items: sex inferred wrongly for some foreign first names
  (UG2-FUN-5), no warning for a missing size (UG2-FUN-10), warning severity
  shown by dot colour only in the detail (UG2-FUN-11), the C chip hidden while
  selected (UG2-FUN-12), the crew page reopening on Sabato PM (UG2-FUN-13),
  the age field saving a half-typed number (UG2-DAT-6), the OCR worker kept in
  memory (UG2-DAT-8), two open copies overwriting each other's session plan
  (UG2-DAT-9), and the wording and layout notes in UG2-UX-10 to 16.

## Engineering follow-ups that do not need a decision

- **Before the shared database (UG2 code-quality review, `.evidence/UG2/code-quality-review.json`):**
  split `CrewManagement.tsx` (3,600 lines) into a crew-plan hook, the boat
  pager and its panels (UG2-CQ-1); one dialog focus/Escape helper instead of
  four (CQ-2); one history-state mechanism (CQ-3); log the cause of a failed
  save (CQ-4); one age module and one name-folding helper (CQ-5); move the
  D1-morning rule and duty-settings normalisation into the domain and delete
  dead helpers (CQ-6); share the two summary shells and name the colours as
  tokens (CQ-7); one crew-plan validation path and a shared load/error screen
  (CQ-9); reorganise the e2e suite by feature with typed seeding (CQ-10).

- F2 limitations: a pasted surname or first name equal to a placeholder word
  the parser refuses (for example `Nota`) is shown as unread and must be fixed
  in place; the Allievi list computes every student's age while it draws, so
  a corrupt stored birth date (no current path creates one) would break the
  list, as it did the edit form before F2 guarded it.
- The OCR worker and speech pipeline stay in memory for the whole session;
  measure memory on a low-end phone at UG2 and release them if needed.
- Phone Back after adding a student manually from Scan returns to Scan; Back
  into Valutazioni does not restore the exact session and view it left; the
  first Back on Home after launch appears inert. Small navigation polish.
- Remaining OCR limitations recorded in S4 (keyword surnames without a printed
  age, 1 px strokes touching a rule, synthetic column drop) and the D2–D5 crew
  capacity override deferred by the owner.
- Restoring a held phone Back uses `history.forward()` within a one-second
  window (`src/navigation/browserHistory.ts`); a desktop Forward, a multi-step
  back from the browser's long-press menu, or a restore delayed by heavy work
  could leave screen and history out of step. Recognise the restore by an
  entry id or depth instead.
- The app's own Back lands a moment later (tens of milliseconds). F1 makes
  every new screen wait for it, so Home tapped right after a save stays on
  Home. Inside that moment a few cases remain (review round 12): a save that
  closes its screen after the user already pressed Back goes back one screen
  too far; a boat or student tapped while leaving the area leaves one dead
  Back entry; a tap on the area being left can be lost or doubled; and if an
  app Back never lands, the next phone Back skips an open dialog and the
  leave guard once. No data is lost. Route every history move through one
  queue keyed by entry id, together with the restore above.
- `Aggiorna` and the phone's Back still discard a half-filled **new** student
  form and an assistant answer pasted but not yet read, as N1 approved for the
  new-student form; guard them if the owner prefers.
- A student with a heading word in the name (Domenica, Sabato, Corso) is kept
  and marked `Forse un’intestazione` when an age is read on the row, or when
  two or more name words are read with a date that could be a birth date or,
  in a table, with a telephone. It is still dropped when its first name word
  is a heading word and the age is printed as a range ("Corso Deriva 8-12
  anni", a course's), and, when no age is read, if fewer than two name words
  are read, if neither a date nor (in a table) a telephone is read, or if the
  date cannot be a birth date: a course or print date, or a birth year
  misread into the last four years or the future.
- No staff heading drops the rows after it. After a line with a staff word
  (Personale, Staff, Istruttori, Istruttore, Assistenti, Volontari,
  Segreteria …) and no date, age or telephone, and after a staff line with a
  date, the rows are marked `Forse personale` until a student heading: any
  line with Allievi, Studenti, Partecipanti, Iscritti or Corsisti. A column
  label ("Cognome Nome Nascita Istruttore", "Nome assistente:") and a staff
  line with a telephone or an age but no date mark them only after a row
  that reads as a student or before a student heading; a row whose name (the
  words before its first date, age or telephone) carries a staff word is
  always marked, but a staff word printed after the dates is not seen. Staff
  rows with a role code are
  still left out one by one. Nothing is dropped on a guess, but staff
  printed without a role code need one tap each to remove, and a sheet
  grouped by instructor needs one review tap per student.
- Because any line with a student word is a student heading, three narrow
  cases remain; fixes for the first (a count footer) and the third were tried
  in F1 and reverted when they broke real headings: a footer with a student
  word ("Totale iscritti: 3", "Firma
  allievi") ends the marking inside a staff block, so role-less staff rows
  after it stay ready, and it makes a contact line or table header at the
  top mark every student above it; a mixed line such as "Volontari iscritti"
  ends the marking instead of starting it; and a student row whose name or
  role column holds such a word ("Corsisti Marco …", "Rossi Maria Allieva …")
  is dropped, as the scan before F1 already dropped Allievo/Allieva (it did
  not know Iscritti or Corsisti, so it kept "Corsisti Marco …"). A reliable
  fix needs the table's own column structure, not more word lists.
