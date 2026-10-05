# Implementation plan — active 0.3.0 work

Updated 2026-10-05. Read **Where this cycle stands**, then only the section for
the active milestone. Closed 0.3.0 milestone details are in
`archive/v0.3.0-completed-milestones.md`; the full plan through R1 is at
`archive/v0.3.0-through-R1/04_IMPLEMENTATION_PLAN.md`. Completed 0.1.0 and
0.2.0 history also remains in `archive/`. Archived plans explain decisions but
are not the current contract. `.milestones/manifest.json` is the machine-readable
lifecycle.

## Where this cycle stands

| Work | State and evidence |
| --- | --- |
| 0.2.0 and V01 | Complete. `v0.2.0` is tagged. Pages deploys from `main`; reviewed phone-test checkpoints are promoted there with the owner's approval. Installed-app checks on the owner's phone remain theirs to perform. |
| S1–S3 | Complete at `c29374e`. The five private photographs showed 16–24 fewer review flags each after telephone opt-in, automatic sheet name order and age/date corroboration. Node 24.19.0, 428 tests and focused browser checks passed. Exact DOB is still stored at this checkpoint. |
| R1 | Complete at `52df92d`. [Open items](docs/post-mvp/0_3_0_OPEN_ITEMS.md) is the code-audited request list; `.evidence/R1/sweep-coverage.json` records source coverage. |
| D0 | Complete. The shared agent contract and active plan are concise; closed detail is archived. Node 24.19.0 `npm run verify` passed (428 tests, domain, compatibility and build); see `.evidence/D0/`. |
| V02 | Complete. The shared dictation control and all five host layouts fit the 320 px/200% stress case. Independent design and accessibility reviews found no remaining blocker. |
| S4 | Complete at the owner's request ahead of UG2; merged from `claude/s4-ocr-optimization` on 2026-09-26. Vertical table rules are erased before OCR: the clearest photo went from 5 flags to 0, and review rows across the five fell from 61 to 26, with no merged, missing or ready non-student row. The independent data-integrity review is PASS_WITH_FINDINGS with no blockers; see `.evidence/S4/` and the S4 section for limitations. |
| V04 | Complete. Four edge handles, live image/frame tilt and a dimmed, soft exterior were verified with synthetic imagery. `.evidence/V04/` records Node 24.19.0 verification (465 tests), 12 browser cases across Chrome/WebKit, pointer-response samples and a PASS field-UX review. |
| S5 | Complete. Age-only entry, persistence and course-start minor rules are covered by migration/domain tests and Pixel/iPhone-sized browser journeys. `.evidence/S5/` records 476 passing tests, the 0.1 schema migration, browser checks and a zero-blocker independent review. |
| N1 | Complete. Node 24.19.0, 482 unit/component tests, domain/compatibility checks, production build and eight Pixel/iPhone browser journeys passed; see `.evidence/N1/`. Physical installed-app Back and icon appearance remain for the owner to check. |
| C1 | Complete. Node 24.19.0 `npm run verify` passed (507 tests, domain, compatibility and production PWA build); three Pixel 7 Chrome journeys passed, including the 40-student 320 px/200% stress case. The synthetic 13-crew image fits on one page in two columns. See `.evidence/C1/`. |
| E1 | Complete. Pixel 7 browser journeys cover the 40-student crew layout, exact-session route, and Valutazioni note panel; see `.evidence/E1/`. |
| UX1 | Complete. Node 24.19.0 `npm run verify` passed (537 tests, domain/compatibility and PWA build), seven Pixel 7 browser journeys passed, and the independent adversarial review ended PASS after the exact-slot persistence defect was fixed. See `.evidence/UX1/`. |
| UX2 | Complete. Whole-page boat swipe and free-slot selection without popup passed 3 focused Pixel/iPhone browser cases (one intentional skip); Node 24.19.0 `npm run verify` passed 538 tests, domain/compatibility and PWA build. Independent adversarial review: PASS. Four development audits and evidence are in `.evidence/UX2/` and `docs/post-mvp/0_3_0_DEVELOPMENT_AUDIT.md`. |
| V03 | Complete by the owner's 2026-09-25 acceptance after Android and PC/Chrome use. Speech is borderline usable, slow and imperfect. Apple/iPhone was unavailable and remains untested; see `.evidence/V03/speech-device-evidence.json`. |
| V05 | Complete. The assistant paste path sits after the camera and gallery: the app gives the prompt and the format, reads the pasted answer into the same review, shows every line it cannot read, needs a check of every pasted row and a count confirmation, and makes no network call. `.evidence/V05/` records `npm run verify` and the browser journey on three projects on the final source, a 32-case parser corpus with no silently wrong student, and ten independent reviews ending PASS. |
| F1 | Complete. The R1 corrections; the fixes from an adversarial review of the whole merged 0.3.0 line and review rounds 2 to 12 of F1 itself, ending PASS_WITH_FINDINGS with no blocker; the owner's 2026-09-26 decisions (erase the course from Settings, volunteers outside crew warnings, surname particles, history rewrite); harness hardening. `.evidence/F1/` records `npm run verify:all` on the final source (814 unit tests, the full week, the offline OCR check, and 177 browser tests passed with 16 skipped by design on Pixel 7 Chrome, the iPhone 13 viewport and iPhone 13 WebKit), the self-review with every finding's disposition and the final independent review. |
| F2 | Complete. The assistant paste reads phone copies (every Unicode line break, chat typography, an answer joined into one line), pasted rows are trusted, every mode stores the age only, and the empty Allievi page and the menu offer the same three methods. `.evidence/F2/` records `npm run verify:all` on the final source (849 unit tests; 186 browser tests passed, 16 skipped, none failed), the self-review and an independent adversarial review, PASS_WITH_FINDINGS with no blocker, whose three important findings were fixed. The five private photographs read as after F1, and 100 of 100 ages are right at the sheets' own course date. |
| F3 | Complete. A boat with an open fault gives its crew a yellow warning; the crew summary follows the owner’s design C6 (boat-model groups under the class logos, class colours, two columns, the owner’s gommone icon for the Mezzi), and its downloadable image reads like the screen and holds every crew; the Comandate get the same summary and image. `.evidence/F3/` records `npm run verify:all` on the final source (947 unit tests; 191 browser tests passed, 21 skipped, none failed), the self-review and an independent review, PASS_WITH_FINDINGS with no blocker, whose important findings were fixed. |
| F4 | Complete. The owner's 2026-10-03/04 phone feedback: a free seat takes a volunteer; the crew and Comandate summaries are copied as an image painted from the screen's own layout (Copia immagine, Condividi; no download); unplaced volunteers leave the summary; the Home menu cards are all blue. The owner confirmed it on Android on 2026-10-05. `.evidence/F4/` records `npm run verify:all` on the deployed source (952 unit tests; 200 browser tests passed, 39 skipped, none failed), the browser evidence and the self-review (no blocker). |
| UG2 | Pending: the owner's remaining physical checks and the precondition below. On 2026-10-03 the owner confirmed on Android phone Back, the assistant paste (ChatGPT and Claude) and the installed app offline. On 2026-09-28 the owner reported the camera scan on their phone as fully usable and the paste as a satisfying fallback (the phone paste failure goes to F2); speech stays as it is, slow and imprecise, with work moved to future work. Open questions are in `docs/post-mvp/0_3_0_QUESTIONS.md`; the road to a shared database and 1.0.0 is `docs/post-mvp/1_0_0_NEXT_STEPS.md`. |

**Before the next Codex session (precondition for UG2):** the published
history was rewritten before the first 0.3.0 push to remove real roster data.
The owner deletes the Codex worktree `.codex/worktrees/ux1-pages-promotion`
and the two pre-rewrite `refs/codex/turn-diffs` checkpoints, which still hold
the old history, and any other copy made before the rewrite; on 2026-09-28 the
owner chose to have a new Codex session do it. Asking GitHub Support to purge
the old commits is deferred by the owner. Work only in a copy that holds the rewritten history
(`AGENTS.md` §13; `docs/post-mvp/0_3_0_QUESTIONS.md` question 1).

The five supplied roster photographs and all derivatives are local-only under
ignored `data/private/ocr-owner/`. They show real students and staff, including
minors. Never add them, raw OCR, names, phone numbers or dates of birth to Git,
evidence or the web. Only aggregate counts may be committed. The public fixture
is `tests/fixtures/ocr-sheet-clear.png`; extend it with **synthetic** medium
difficulty rosters. Keep `MIN_FIELD_CONFIDENCE` at 70 and keep every low-confidence
reading visible and marked. Physical phone checks belong to the owner; no
simulated PASS.

The latest owner instruction supersedes older choices where stated: V02 need
only stay inside its pane, not have identical dimensions; S4's earlier deferral
was lifted for the completed experiments, then its remaining quality target was
moved to the final nonblocking Claude Code handoff; an age entered manually
must not require an exact birthday. S5 removed the per-row name swap under the
then-current instruction; UX1 restores an icon-only per-row correction at the
owner's 2026-09-25 request. The rest of the frozen deferrals remain in
`docs/post-mvp/0_3_0_OPEN_ITEMS.md`.

The owner confirmed age-only entry means completed years on the **first course
day**, with manual correction allowed later. For C1, Copy (if present) must copy
the image itself, and the two/three selected-name display choice belongs only
in Settings. Crew capacity is separate: D1/Cabinato starts at four and allows
manual change; D2–D5 stays fixed at two through the gate. Its Settings override
is deferred to the final Claude Code follow-up. No crew-size rule follows from
display columns. UX1 changes the default display choice to two names per row;
the Settings option for three remains. Crew capacity rules do not change.

### Execution order

1. **D0** documentation and scope checkpoint.
2. **V02** dictation control. The required independent review precedes the fix.
3. **V04** crop editing and live rotation.
4. **S5** scan review flow, age-only entry and synthetic image regression.
5. **N1** phone Back, app icon and student name disambiguation.
6. **C1** crew composition, destination picker and summary export.
7. **E1** evaluation spacing and student-history navigation.
8. **UX1** owner corrections to crew composition, scan review, summary image
   and evaluation density.
9. **UX2** owner phone-feedback corrections to boat paging and free-slot selection,
   followed by functional, code, documentation and tooling audits.
10. **V03** speech accuracy, latency and transcript confirmation removal.
11. **V05** LLM-assisted paste path, beside on-device scanning.
12. **F1** remaining R1 corrections.
13. **F2** and **F3**, the owner's 2026-09-28 feedback after using the app,
    and **F4**, their 2026-10-03 phone feedback, then **UG2** integration and
    release gate.
14. **S4** remaining OCR quality target and the deferred D2–D5 crew-capacity
    override, both handed to Claude Code after the gate.

The owner explicitly made the remaining S4 target nonblocking on 2026-09-23.
The manifest places S4 after UG2; on 2026-09-25 the owner asked Claude Code to
complete S4 on a separate branch, so its manifest entry allows V03, V05, F1 and
UG2 to be incomplete. The D2–D5 crew-capacity override is not part of S4 and
remains open. Every
milestone follows `AGENTS.md`: baseline, start,
implementation, evidence, browser work where required, review, verification,
completion, clean checkpoint. Use `verify:quick` before a commit and
`verify:all` at UG2 only.

The 2026-09-25 owner request put UX1 and the subsequent UX2 phone feedback
ahead of V03's owner-device checks. The owner later accepted the current speech
path after Android and PC/Chrome use, with Apple/iPhone unavailable. This closes
V03 only; the untested Apple path is a reminder for the UG2 release-candidate
check. Do not claim a physical iPhone PASS. The owner explicitly approved
deployment after adversarial review for phone testing. Pages deploys only from
`main`.

## V03 — Speech accuracy and latency

**Category:** FEATURE
**Status:** COMPLETE

Read `.evidence/UG1/speech-quality-benchmark.json` first. Benchmark the owner's
ignored conversational Italian corpus with WER and median warm-model latency,
same machine and repeated clips. Quality must improve without increased time;
the usable latency target is at least 20% less. Compare DSP, pause trimming,
model/quantisation and chunking against the baseline; ship only a measured win.
Remove the separate `Scarta`/`Usa testo` confirmation: transcript enters the
editable field directly. Keep cancellation and failure recovery. Update the
physical-device checklist before UG2. The owner accepted V03 on 2026-09-25
after trying speech on Android and PC/Chrome, while describing it as slow,
imperfect and only borderline usable. No per-step device timings or recovery
results were reported. Apple/iPhone could not be tested and remains explicitly
untested in `.evidence/V03/speech-device-evidence.json`. This is a V03-only
exception to `03_TECHNICAL_DECISIONS.md` §5, not an iPhone PASS. UG2 must repeat
speech on its exact release candidate and cover physical phone scanning; V03
device results do not substitute for UG2 evidence.

**Evidence:** benchmark, verification, browser evidence, speech review and page
changelog and owner-provided physical-device evidence. The 823 MB corpus and
all roster photographs remain under ignored `data/`.

**Progress, 2026-09-24:** A matched three-round run over 56 private clean-condition
clips found
no variant that improves WER without increasing warm latency. The current
whisper-base q8 model measured 53.8% overall WER at 5,308 ms median warm
latency. Pause trimming and DSP measured 52.5% WER at 5,533 ms and 5,511 ms;
q4 measured 50.4% at 9,594 ms; tiny measured 70.4% at 2,690 ms; chunked
measured 54.2% at 9,804 ms. Keep the production model unchanged. Aggregate-only
results are in `.evidence/V03/speech-quality-benchmark.json`; raw benchmark
data remains ignored. `npm run verify` passed with 520 tests and four refreshed
Pixel 7 Chrome journeys passed. The independent review found no remaining
implementation blocker. The owner's subsequent Android and PC/Chrome feedback
accepts the current path with known quality and latency limits; Apple/iPhone
remains untested and on the UG2 checklist. No `verify:all` run is claimed.

**Closure, 2026-09-25:** Node 24.19.0 `npm run verify` passed 538 tests,
domain/compatibility checks and the production PWA build. The earlier four
focused Pixel 7 browser journeys remain the browser evidence; they were not
rerun for this owner-acceptance update. The independent closure review is
PASS_WITH_FINDINGS with zero blockers. The owner's device report accepts speech
as borderline usable after Android and PC/Chrome use. Apple/iPhone and detailed
physical checklist steps are unverified and remain on the UG2 checklist.

## V05 — LLM-assisted paste path

**Category:** RULE_HEAVY
**Status:** COMPLETE

Keep on-device camera OCR first. Add a second route that lets the user copy a
strict prompt, send the photograph to an assistant of their own choice, and
paste its result into the same review flow. The app sends nothing itself. The
format must be specified by the app; malformed prose, fences, missing/invented
columns, empty answers and trailing text must produce visible unparsed lines,
never silently wrong students. Every row requires normal manual review.

**Evidence:** parser robustness corpus, browser journey, no-network proof,
verification and an independent adversarial domain review.

**Closure, 2026-09-27:** The assistant section follows the camera and gallery
in the scan screen. The app offers a prompt copied in one tap, states the
format (`CVC-ALLIEVI v1`, five columns, `FINE`) and reads the pasted answer
into the same review as a scan. Every pasted row is marked `Riga scritta
dall’assistente` and needs its own check; `Sono tutti` confirms the number of
rows read and is asked again when that number changes; unread lines stay
visible with their text and reason until fixed in place or left out; a
duplicate of another row or of an existing student waits for `Tieni
entrambi`. An answer of more than 150 rows is refused whole. The parser corpus
passes 32 of 32 cases with no silently wrong student
(`.evidence/V05/parser-robustness.json`). The browser journey passes on Pixel 7
Chrome, the iPhone 13 viewport and iPhone 13 WebKit, and fails on any foreign
host, any non-GET request or any request carrying a pasted value. Ten
independent reviews end with PASS (`domain-review.json`); every finding's
disposition is in `self-review.json`. The owner decides whether one
confirmation may replace the per-row check (`0_3_0_QUESTIONS.md` question 2),
and tries the path with the assistant the centre will use at UG2.

## F1 — Remaining R1 corrections

**Category:** FEATURE
**Status:** COMPLETE

R1's [open-items list](docs/post-mvp/0_3_0_OPEN_ITEMS.md) owns corrections
not already absorbed into S5, N1 or E1: moved long press must not open edit;
failed evaluation save must require an explicit retry/discard before navigation;
invalid student edit Back must explain its refusal; autosave status must cover
queued writes. The 2026-09-25 audit found that the installed-app launch
background still uses cream while the app surface is blue-grey: N1 completed
its icon and Back scope but left this R1 polish item open, so F1 must reconcile
the launch colour and verify it in the built manifest. UX1 owns the restored
row name-swap and further evaluation-row density. Also triage the pre-existing
Pixel P14–P16 rail geometry E2E failure found during UX2 (`u09-crews.spec.ts`,
`railBottom=986` versus `appNavTop=589.6` on baseline `3dc4360`): determine
whether the static rail is a design defect or the assertion is stale, then fix
the appropriate side before UG2. Update the living R1 list as each closes.

**Evidence:** verification, defect reproductions and fixes, browser journeys
and self-review. No unowned finding carries into UG2.

On 2026-09-26 the owner asked Claude Code to merge S4 and take F1 next, ahead
of V05; the manifest lets F1 start with V05 incomplete. F1 also triages the
adversarial review of the merged line and the browser failures found by the
full suite, so that each is fixed here or has an owner before UG2.

**Closure, 2026-09-27:** The four R1 corrections are fixed and tested: a
moved long press never opens the edit form; a failed evaluation save needs
`Riprova` or `Scarta` before any exit, phone Back and the bottom navigation
included; Back from an invalid edit names the fields to complete; queued
autosaves show `Salvataggio…`. The launch colour is the app surface
`#f2f6fb`, checked in the built manifest. The Pixel P14–P16 rail failure was a
real defect: the crew column is now bounded, so the rail stays above the
bottom navigation. Four independent reviews of the merged line at `5c1e029`
(crews, scan, persistence and navigation, release readiness) found blockers,
all fixed; review rounds 2 to 11 reviewed F1 itself until the last found none.
The main changes: a shared leave guard and nested phone Back in Barche,
Avarie, Comandate and Volontari; the scan review gate in one module; scan
fixes for swapped names, ages and dates, surname particles, headings and staff
rows, where no staff heading drops rows any more; evaluation saves in one
transaction; a screen error boundary; erasing the course from Settings; an
update banner that asks before reloading; the speech runtime from the app's
own origin, a pinned model and chunked long recordings; Pages deploys only
after CI, with an offline check; `npm run evidence` records the source digest,
and completion refuses hand-written, partial or stale verification. 33 browser
specs that described older screens were repaired. The first recorded
`verify:all` on the final source then caught a timing defect: Home tapped
while the app's own Back was still landing was undone by it. Every history
move now waits for that Back; review round 12 found no blocker, and the
narrower cases left are in next steps. `.evidence/F1/verification.json`
records `verify:all` on the fixed source. The five private photographs read
exactly as after S4: 100 of 100 students matched, none missing, no ready
non-student row, and no flag on the clearest one. What remains is in
`docs/post-mvp/1_0_0_NEXT_STEPS.md` and, for the owner,
`docs/post-mvp/0_3_0_QUESTIONS.md`. The history is rewritten immediately
before the first 0.3.0 push; its aggregate results are in
`.evidence/F1/history-rewrite.json`, committed on the rewritten line.

After the push, CI's first complete browser run failed one V02 stress check,
so Pages kept the previous build. Linux Chromium falls back to DejaVu Sans,
where "Elaborazione…" at 200% text was wider than the Conoscenza allievi note
card: the dictation button's `break-words` overrode `overflow-wrap:anywhere`,
and the row lacked `min-w-0`. Both are fixed. The V02 stress matrix now uses a
wide font, so it fails locally on the old code the same way CI did.

## F2 — Allievi: assistant paste on phones, age only, one set of methods

**Category:** RULE_HEAVY
**Status:** COMPLETE

The owner's 2026-09-28 feedback after using 0.3.0 (decisions in
`docs/post-mvp/0_3_0_QUESTIONS.md`):

1. **The paste works from a phone.** An answer copied with the ChatGPT app's
   copy button on a phone was refused as "not in the requested format" while
   the same answer pasted on a PC was read. Every Unicode line break (U+2028,
   U+2029, NEL, CR, CRLF) separates lines, and the typography a phone or chat
   app adds is tolerated as the header and FINE lines already are. When the
   header is not on a line of its own but appears inside the text, the error
   says so instead of the generic message. Unit tests pin each variant; a
   browser journey pastes a U+2028 answer.
2. **Pasted rows are trusted.** The owner checks them; no row needs its own
   `Controlla`. The count confirmation (`Sono tutti`) stays, lines the app
   could not read still need a decision, and the duplicate check stays on both
   paths (owner, question 5).
3. **Age only, in every mode.** Scan, paste and manual entry store the age
   completed on the first course day and no date of birth. A date read from a
   sheet or a pasted answer only computes the age when no age was read, and is
   then dropped; a low-confidence date gives a low-confidence age, marked like
   any other reading. The manual form loses its date field. Existing students
   keep what they have; changing the age of one with a date stores the age and
   drops the date. The duplicate check compares name and age.
   `01_PRODUCT_SPEC.md` records the change.
4. **One set of ways to add students.** The Allievi menu and the empty Allievi
   page open the same methods page, and the empty page offers every method:
   manual entry, camera or gallery scan, and the assistant.

**Evidence:** `.evidence/F2/` verification, browser evidence (Pixel and iPhone
sizes), self-review and one independent adversarial review (data integrity of
the age change and the paste parser), zero blockers.

**Closure.** Sonnet implementation agents wrote F2; Claude Code reviewed every
diff and sent back four problems before the first commit: an age conflict
could not be settled in favour of the sheet, the phone tip was inside the
assistant's prompt, a joined answer without FINE trusted its last row, and
four specs had CRLF endings. The independent review then found no blocker and
three important findings, all fixed in `9cf5470`: a preface on the header's
line no longer throws the answer away, a valid age wins over a bad date in the
same row, and a corrupt stored birth date no longer crashes the edit form. The
remaining limitations (a surname equal to a placeholder word, the Allievi list
with a corrupt stored date) are in `docs/post-mvp/1_0_0_NEXT_STEPS.md`. On the
five private photographs the review counts are unchanged from F1 (50 flags, 27
rows to review, 90 ready, no non-student ready, 100 of 100 matched, none
missing); every printed age fits one course date between 30 July and
16 August 2026, and at that date all 100 reviewed ages are right. The owner
retries the phone paste at UG2.

## F3 — Crew warnings, crew and Comandate summaries

**Category:** FEATURE
**Status:** COMPLETE

1. **An open fault is a crew warning.** A boat with an unresolved fault in a
   crew shows a yellow warning, like the existing unavailable-boat one (owner,
   question 3).
2. **The crew summary fits one window.** All crews visible at once, in two
   columns. The owner chose design **C6** on 2026-09-28, after two rounds of
   proposals: crews grouped by boat model under the class logo, each card
   with a 4px class-colour edge, the boat number bold in the class colour in
   a fixed left column top-aligned with the first name, no "Equipaggio N".
   Frozen target: `docs/post-mvp/mockups/f3-crew-summary-c6.html` and its
   390×844 screenshot (synthetic data; 13 crews fit at 390 and 360 px).
3. **The exported image reads like the screen.** "Scarica immagine riepilogo"
   produces a readable image in the chosen design, with every crew even when
   they do not fit one screen.
4. **A Comandate summary.** After the Comandate are created, the same kind of
   summary and image export is offered for them.

**Evidence:** `.evidence/F3/` verification, browser evidence with a 13-crew
synthetic course at 320 px and at ordinary widths, exported images, the owner's
design choice, self-review.

**Closure.** The owner chose C6 after two rounds on a design canvas, then drew
the Mezzi icon with Claude Code from a photo of the centre’s RIB (seen from
above, tube tails past the transom, an ∞ propeller, horizontal in headings and
vertical in cards). Sonnet agents built the four parts; Claude Code checked
every screenshot and exported image and sent back what fell short: names cut
to an ellipsis at 320 px with 200% text, half-empty image cards, a stale copy
of the old icon in the exporter, and three Comandate details. The independent
review found no blocker and five important findings, fixed in `e19f8ec`:
long boat numbers ran into the names, a warning badge could hide a name in
the image, no canvas limit for very large courses, and three behaviours the
spec and UX1 had approved — the available students first, the closing
"Tutti gli allievi assegnati" note and "<model> · Senza barca" — had been
dropped and are restored; a test now pins that the Comandate view releases
the page scroll. The eight brand images are precached for offline use. Known
limitations (control characters in the image, an empty summary with only its
header, list semantics in old Safari) are in the evidence. The first evidence
run lost one WebKit timing test to parallel load and the second hung a WebKit
worker at shutdown after every test had passed; the third, on the same
source, is clean. The owner checks the summary, images and icon on the phone.
After the first push, CI on Linux failed the long-number journey: in
DejaVu Sans a 4-digit number wrapped or overflowed its column. The column is
now sized in `ch` of the number’s own font with no cap (`d8653a0`, `a6e00b6`);
CI passed and Pages deployed `a6e00b6`, and the F3 evidence is re-recorded on
that source.

## F4 — Free seat for volunteers, summary image as a screenshot

**Category:** FEATURE
**Status:** COMPLETE

The owner's 2026-10-03 phone feedback. They confirmed on Android that phone
Back, the assistant paste (ChatGPT and Claude apps) and the installed app
offline work.

1. **A free seat takes a volunteer.** Tapping `Posto libero` and then a volunteer
   in `Volontari disponibili` puts the volunteer in that seat, as it already
   did for a student; it used to open the volunteer's destination chooser.
2. **The summary image is a screenshot of the summary.** The crew and the
   Comandate summaries are now liked as they are on screen, and the drawn
   image was not. The image is the summary's own content rendered as the
   page shows it, at the phone's width and pixel density, with every group
   even past one screen, without the status bar, the close button or the
   new button. The hand-drawn canvas exporters are removed.
3. **Save and copy in one tap.** `Scarica immagine riepilogo` is replaced by a
   floating button at the bottom right. One tap saves the image (Android and
   computers download it, where the gallery's Download album shows it; iPhone
   opens the share sheet, whose `Salva immagine` puts it in Photos) and
   copies it, so the owner can paste it in WhatsApp. A short note says what
   happened, with `Condividi` where the phone can share files.

**Evidence:** `.evidence/F4/` verification, browser evidence (the exported image
compared with a screenshot of the same summary, offline logos, the clipboard
image, 320 px and 200% text), self-review.

**Closure.** Claude Code fixed the free seat (`3c0a820`): the tap only
filled a seat with a student from the pool, so a volunteer fell through to
their destination chooser; anyone still available now fills it, with a unit
test and a Pixel 7 journey that survives a reload. A Sonnet agent built the
image (`43b6654`) and Claude Code reviewed the code and every exported image
against the screen. The page is cloned with its computed styles into an SVG
`foreignObject` and drawn on a canvas by the browser itself, so the image is
the screen without the status bar, the close button or the new button, and
with every group; no dependency was added and about 4,000 lines of canvas
drawing were removed. The browser test compares the saved PNG with
Playwright's own screenshot of the same content and rejects blank, shifted
and greyscale images. A web app cannot write into the gallery: Android
downloads (the gallery's Download album) and copies; iPhone opens the share
sheet, whose `Salva immagine` reaches Photos, and copies. The iPhone share
sheet, Safari's clipboard and its canvas read-back are verified only on the
WebKit engine and in unit tests, and are the owner's to check. Two full runs
on the same source each lost tests unrelated to F4 that pass alone (the
40-student layout, the denied-microphone alert, WebKit phone Back after a
Valutazioni note); the third, recorded in `.evidence/F4/`, is clean: 934
unit tests, 196 browser tests passed, 34 skipped, none failed.

**Follow-up of 2026-10-04 (reopened).** On the owner's Android phone the
deployed image was broken: inside the SVG image the phone laid the text out
again with different measurements, and the clone had every box's size frozen,
so names wrapped after a few letters, were drawn over the next line and left
their cards. A Sonnet agent replaced the renderer with a geometry replay: the
page's own layout is read (boxes, borders, radii, clips, each word's place
through `Range` rects, logos and icons) and painted on a canvas, so the image
keeps the screen's line breaks by construction; each text node's font size
is calibrated against its on-screen word widths. The owner also asked for:
no download (copy and share only: one tap on `Copia immagine` copies, the
note offers `Condividi`); no unplaced volunteers in the crew summary; no
`Tutti gli allievi assegnati` in the image; blue accents on every Home menu
card. The Comandate day label now sits in a rem-sized column, so it no longer
runs into the names at 320 px with 200% text. New browser checks use double
names and surnames, a crew without a boat and 3–4 names per card, require
every on-screen word to have ink in its place and no card to have ink
outside it, and prove that the image survives text measuring 18% wider or
15% narrower than the screen. On 2026-10-05 the owner confirmed on Android, on
the deployed `5580d33`, that the copied crew and Comandate images, the
summary and the blue Home cards are all good. `.evidence/F4/` then recorded
`verify:all` once on that source: 952 unit tests, the full week, the offline
OCR check, and 200 browser tests passed with 39 skipped by design, none
failed. The iPhone copy and share remain the owner's to check at UG2.

## UG2 — 0.3.0 integration and release gate

**Category:** INTEGRATION_GATE
**Status:** PENDING

Run `verify:all` on Node 24, including the deterministic full week and all
browser projects. Exercise an upgraded week through the visible UI, close and
reopen, and prove 0.1.0/0.2.0 migrations, including age-only records. Generate
a hostile fictitious 40-student roster and test the crew/export layouts.
Independent functional, field-UX/accessibility, data-integrity, regression,
scope and code-quality reviewers must have zero blockers. The owner runs the
physical microphone/camera/OCR checklist on real devices; never substitute a
simulator result. Record known limitations, bump version/changelog, complete
the manifest, leave a clean commit and tag only after the gate passes.

S4 was completed on its own branch and merged before UG2, so UG2 verifies the
erased-rule OCR path, its privacy boundaries and actual device behavior,
including the eraser's time on a phone. UG2 does not otherwise depend on S4.
F1 repaired the browser specs that still described older screens, including
`tests/e2e/s1-scan-phone-option.spec.ts`; see F1's closure for the full run.

**Evidence:** `.evidence/UG2/` verification, browser, migration, synthetic
roster, six reviewer reports and actual physical-device report. Do not publish
the development branch to `main` or update Pages without asking the owner.

## S4 — Measured OCR accuracy on real and synthetic rosters

**Category:** RULE_HEAVY
**Status:** COMPLETE

The owner lifted the earlier deferral for the measured prototypes on
2026-09-23, then moved the unresolved quality target to the final Claude Code
handoff. It is not a predecessor of V04–UG2 and does not block the 0.3.0 gate.

The owner reports about 26 flags on a very good photo and requires **fewer than
five**, ideally zero, before treating that case as usable. Reconfirm the exact
baseline with `npm run measure:scan-review -- <private image> [out.json]`; use
the same image, crop, telephone choice, order, counter and runtime after each
change. Measure all five supplied captures, not just the best. Report rows,
missing/low-confidence fields, name order, false merges and elapsed time.

Three independent agents must implement/test distinct prototypes: (1) TSV
table-row geometry and conservative fragment joining, (2) image preparation,
deskew/crop/contrast, (3) a different local OCR engine or hybrid if it can meet
offline browser/privacy/size constraints. Keep prototypes and raw results only
in ignored `data/private/ocr-experiments/`; commit aggregate comparisons.
Choose by measured quality, latency, browser feasibility and risk, not by engine
preference. Tesseract is not presumed the only option.

Join fragments only when row geometry supports it and two actual students
cannot be merged. Add rules for plausible three-part names and particles, with
ambiguous cases visible for review. Build generated, wholly fictitious
medium-difficulty roster images for repeatable regression; include imperfect
lighting, mild skew, row rules, varied name lengths and three-part names. Keep
the confidence threshold 70 and every read text visible. A good-photo count
below five remains a target for **S4 closure**; if evidence cannot reach it
safely, record the measured limit rather than silently weaken safety. It is not
an acceptance condition for UG2 under the owner's latest instruction.

**Evidence:** verification, before/after aggregate measurements, public
synthetic corpus and tests, browser review, independent adversarial
data-integrity review, self-review. S4 may close only with no silent student
merge, no privacy breach and the measured good-photo target achieved; otherwise
it remains open with the result and next experiment recorded.

**Resolved, 2026-09-25 (Claude Code, branch `claude/s4-ocr-optimization`).**
The owner asked for S4 to be completed on a separate branch. The roster prints
a row number, a vertical rule and then the surname; Tesseract removes rules
only from its layout image, so the recognizer read `12|Surname` as one word and
the surname kept the junk's confidence. Of 86 correctly read surnames, 37 were
below 70 for that reason. The scan now erases long vertical table rules on a
canvas before recognition (`src/capabilities/studentScanRules.ts`), painting
only each tracked rule's own band; the same code runs in `measure:scan-review`
and the synthetic regression. A fragment is never joined to a line outside the
student table band, an unproven surname-first compound is offered as surname
plus given names with each field at the minimum confidence of its own words
and still blocked for the split confirmation, and heading keywords count only
before a row's first date, age or telephone unless no name word precedes it. The
eraser keeps letters that touch a rule and ignores the photo's own edge.

Measured with `measure:scan-review` on the same five prepared captures,
settings and reference date, with and without erasure on the same parser:
legacy flags `[15,18,35,25,5]` → `[5,24,35,8,0]` (98 → 72); the screen's rows
to review 61 → 26 and ready rows 50 → 91. The clearest capture has 0 flags and
reads all 40 name fields exactly; one row still asks for its three-word name's
split. Against the private truth table, 100 of 100 student appearances stay
matched once and in order, with no missing or merged student, no wrong birth
date and no ready row that is not a student; wrong name fields fall from 15 to
8 and none is left confident outside a split-review block (previously one).
Across 40 perturbed inputs (scale, rotation, crop, JPEG) rows to review halve
(582 → 295), confident wrong names outside split review fall from 14 to 9, and
the clearest capture stays at 0–2 flags; the shadowed capture can be worse with
erasure when rotated or compressed. The independent data-integrity review's
blockers (real student and staff names quoted from raw OCR in pre-S4 evidence
and the archived plan, and a staff row completed by a join into a ready-looking
row) are fixed; its report is `.evidence/S4/domain-review.json`.

Known limitations: a staff row read complete on one text line with its role
code missed can still look ready (2 of 40 perturbed inputs with erasure, 2
without, none on the five captures); the proper fix is a table-band gate in the
review screen. When Tesseract loses whole rows (sample 4 rotated 1° or cropped),
erasure raises page confidence enough that the retake warning may not show; a
row-count cue is the follow-up. A surname that is itself a heading keyword is
still dropped as a heading, as before S4 (F1 narrowed this and stopped staff
headings from dropping rows; see `docs/post-mvp/1_0_0_NEXT_STEPS.md`). On a
fictitious sheet with a staff
block Tesseract's layout can drop the whole age column after erasure; the age
then follows from the birth date. The eraser costs about 0.3–0.5 s in desktop
Chromium/WebKit and about 2 s at 4× CPU throttling; the owner's phone check
remains. Published refs (`main`, `codex/0.3.0`, `codex/post-mvp-ux-planning`,
`v0.2.0`) contained real student data from before S4; the owner approved a
history rewrite on 2026-09-26, carried out before the first 0.3.0 push (F1). The D2–D5 crew-capacity override listed beside S4 in
the execution order is not part of this milestone and remains open.

Historical measurements, failed variants and audit corrections are preserved in `archive/v0.3.0-s4-measurement-history.md`; aggregate outputs remain in `.evidence/S4/`. None of the probes before rule erasure justified a production OCR change; the later rejected variants are in `.evidence/S4/targeted-ocr-probes.json`.
