# Backlog — open requests and findings

> Working document · Owner: the owner · Fold at: UG3

Everything open that no milestone owns yet. A flaky browser test is filed
here as `<spec file> › <test title>`, the line `npm run verify:e2e` prints
after `FLAKY:`. It gathers the 0.3.0 working
documents, now archived in `archive/v0.3.0/` with their full detail
(`1_0_0_NEXT_STEPS.md`, `0_3_0_OPEN_ITEMS.md`, `0_3_0_QUESTIONS.md`), and the
UG2 review findings (`.evidence/UG2/*-review.json`). An item leaves this list
when a milestone takes it or the owner drops it. At UG3 the rest moves to the
next cycle's backlog.

## Taken by 0.4.0 milestones

| Item                                                                | Milestone |
| ------------------------------------------------------------------- | --------- |
| Persistent storage, export and import (UG2-DAT-5)                   | D4        |
| A full local reset (owner, 2026-09-28)                              | D4        |
| A reliable update that reaches an installed app (owner, 2026-10-06) | D3        |
| The update banner covering floating controls (UG2-UX-3)             | D3        |
| Duty-settings normalisation in the domain (UG2-CQ-6, in part)       | D2        |

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
   pages drop to one column early (UG2-REG-2, UG2-REG-4).
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
- `Aggiorna` and phone Back discard a half-filled new-student form, as N1
  approved, and an assistant answer pasted but not yet read: guard them only if
  the owner prefers;
- sex inferred wrongly for some foreign first names (UG2-FUN-5), no warning
  for a missing size (UG2-FUN-10), warning severity by dot colour only in the
  detail (UG2-FUN-11), the C chip hidden while selected (UG2-FUN-12), the
  crew page reopening on Sabato PM (UG2-FUN-13), the age field saving a
  half-typed number (UG2-DAT-6), and the wording and layout notes UG2-UX-10
  to 16.

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

- `createFault` checks the boat and inserts in two separate steps, outside a
  transaction (UG2-DAT-7); D1 rewrites this write path;
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
