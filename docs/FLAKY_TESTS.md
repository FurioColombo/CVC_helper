# Flaky browser tests

Each test here failed and then passed on a retry: a defect to fix, never a
reason to raise a retry count or a timeout (`03_TECHNICAL_DECISIONS.md` §6).
An entry quotes the test in backticks exactly as `npm run verify:e2e` prints it
after `FLAKY:`, `<spec file> › <test title>`; `npm run milestone:complete`
refuses a recorded flaky test that is not quoted here. Fixed entries leave with
the fix, named in its commit.

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
  — Windows WebKit only (B7 runs of 2026-11-05 and 11-12, disk 97% full): a reopen stays on
  "Apertura del corso…", `getActiveCourses()` never settles, no console error; 10 b7 tests
  in a loaded run, 2/27 alone. macOS WebKit CI passes. The open has no timeout or way out.

- `b7-two-courses-live.spec.ts › two devices that each made a course, one offline: neither locks, and one choice settles both`
  — desktop, 2026-11-10: raw storage read once before the row was written; 2/2 alone. Poll it.

- `b7-two-courses.spec.ts › a course another device already gave up cannot be kept here`
  — Linux CI `43110637196` (Chrome): the notice did not show in 30 s; also the WebKit hang above.

- `b4-uploads.spec.ts` refusal tests ("Riprova sends a refused student", "a student deleted
  after a refusal"; CI `43110637196`, `43123997014`, `43159843288`): a tap before the
  sign-in's switch deferred it to "Riapri l’app"; the test taps it since `8a5b50a`.
  `b6-erase.spec.ts` 290/352/400 on macOS CI `43123997014`: the runner; rerun passed.

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
