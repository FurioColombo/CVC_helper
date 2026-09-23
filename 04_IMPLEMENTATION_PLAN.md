# Implementation plan — active 0.3.0 work

Updated 2026-09-23. Read **Where this cycle stands**, then only the section for
the active milestone. The full plan through R1 is preserved at
`archive/v0.3.0-through-R1/04_IMPLEMENTATION_PLAN.md`; completed 0.1.0 and 0.2.0
history remains in `archive/`. Archived plans explain decisions but are not the
current contract. `.milestones/manifest.json` is the machine-readable lifecycle.

## Where this cycle stands

| Work | State and evidence |
| --- | --- |
| 0.2.0 and V01 | Complete. `v0.2.0` is tagged. The app is deployed at `https://furiocolombo.github.io/CVC_helper/` and opens on the owner's phone. Pages deploys from `main`, which is behind this development branch. Do not promote without the owner's approval. |
| S1–S3 | Complete at `c29374e`. The five private photographs showed 16–24 fewer review flags each after telephone opt-in, automatic sheet name order and age/date corroboration. Node 24.19.0, 428 tests and focused browser checks passed. Exact DOB is still stored at this checkpoint. |
| R1 | Complete at `52df92d`. [Open items](docs/post-mvp/0_3_0_OPEN_ITEMS.md) is the code-audited request list; `.evidence/R1/sweep-coverage.json` records source coverage. |
| D0 | Complete. The active plan and Claude entry are short; prior files are archived. Node 24.19.0 `npm run verify` passed (428 tests, domain, compatibility and build); see `.evidence/D0/`. |
| V02 | Complete. The shared dictation control and all five host layouts fit the 320 px/200% stress case. Independent design and accessibility reviews found no remaining blocker. |
| S4 | In progress, deferred to the final Claude Code handoff by the owner. Current OCR improvements and safety checks remain; the remaining fewer-than-five target is not a prerequisite for V04–UG2 or the 0.3.0 gate. No unsafe counter-only variant was integrated. |
| V04 | Complete. Four edge handles, live image/frame tilt and a dimmed, soft exterior were verified with synthetic imagery. `.evidence/V04/` records Node 24.19.0 verification (465 tests), 12 browser cases across Chrome/WebKit, pointer-response samples and a PASS field-UX review. |
| S5, N1, C1, E1, V03, V05, F1, UG2 | Pending in the sequence below. |

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
must not require an exact birthday; the per-row name swap is to be removed. The
rest of the frozen deferrals remain in
`docs/post-mvp/0_3_0_OPEN_ITEMS.md`.

The owner confirmed age-only entry means completed years on the **first course
day**, with manual correction allowed later. For C1, Copy (if present) must copy
the image itself, and the two/three selected-name display choice belongs only
in Settings. Crew capacity is a separate rule: D1/Cabinato starts at four and
allows manual change; D2–D5 stays fixed at two by default, with a Settings-only
override to enable add/remove on crew cards. No crew-size rule follows from
display columns.

### Execution order

1. **D0** documentation and scope checkpoint.
2. **V02** dictation control. The required independent review precedes the fix.
3. **V04** crop editing and live rotation.
4. **S5** scan review flow, age-only entry and synthetic image regression.
5. **N1** phone Back, app icon and student name disambiguation.
6. **C1** crew composition, destination picker and summary export.
7. **E1** evaluation spacing and student-history navigation.
8. **V03** speech accuracy, latency and transcript confirmation removal.
9. **V05** LLM-assisted paste path, beside on-device scanning.
10. **F1** remaining R1 corrections, then **UG2** integration and release gate.
11. **S4** remaining OCR quality target, handed to Claude Code after the gate.

The owner explicitly made the remaining S4 target nonblocking on 2026-09-23.
The manifest places S4 after UG2 so the lifecycle enforces the revised order;
S4 retains its unfinished evidence and FAIL review for Claude Code. Every
milestone follows `AGENTS.md`: baseline, start,
implementation, evidence, browser work where required, review, verification,
completion, clean checkpoint. Use `verify:quick` before a commit and
`verify:all` at UG2 only.

## D0 — Context and plan consolidation

**Category:** FOUNDATION
**Status:** COMPLETE

Keep `AGENTS.md` as the shared operating contract. Claude Code's documented
autoload path is `CLAUDE.md`, so retain a tiny pointer there rather than assume
`AGENTS.md` is loaded automatically. Move local runtime/port instructions to an
on-demand guide. Archive the previous contract and full plan, then make this
file the short active ledger. Preserve source-of-truth priority, lifecycle,
reviewer policy, verification ladder, Git/privacy rules and all uncompleted
acceptance criteria. Register every new request below and the future-only ideas
in `docs/post-mvp/0_3_0_OPEN_ITEMS.md`. Record any genuine open question in
`docs/post-mvp/0_3_0_QUESTIONS.md`, with a default where possible.

**Evidence:** `.evidence/D0/verification.json`, `doc-audit.json`,
`self-review.json`. **Acceptance:** no active reference points to a removed
instruction; all unfinished work has an owner; archived history is retrievable;
`verify:quick`, repository checks and a Git privacy check pass.

**Closed 2026-09-23:** The old plan and shared instructions are preserved under
`archive/v0.3.0-through-R1/`. The active plan fell from 2,468 to 327 lines and
`CLAUDE.md` from 157 to seven; `AGENTS.md` remains the full contract. The owner’s
new requests are assigned below, with future-only ideas in the open-items list.
The first verification run exposed that ESLint scanned ignored local OCR
experiments; `data/` is now excluded from lint and format checks. The rerun
passed 428 tests, domain/compatibility checks and the PWA build on Node 24.19.0.
`git check-ignore` covers private photographs, and `git ls-files data/private`
is empty. No feature code changed in D0.

## V02 — Dictation control fits at every state

**Category:** FEATURE
**Status:** COMPLETE

The deployed older build overflows in Valutazioni; the owner likes the current
control in the student note and does **not** require a fixed square or identical
size. Preserve its visual language and `DictationMeter`. Choose the smallest
stable implementation that fits idle, permission, 1–100% loading, recording,
processing and error within P05/P09/P17 at 320 px and 200% text. A different
design is allowed only if it works better. Keep a ≥44 px target and the correct
accessible name. The source is
`src/features/speech/DictationControls.tsx`; V03 still owns transcript review.

**First acceptance criterion:** before building, an independent field-UX and
accessibility/mobile reviewer validates the proposed design and records
`.evidence/V02/design-review.json` with no blockers. Then component/Playwright
stress tests measure the control in every state and each affected page, verify
no clipping or horizontal scroll, and compare the result visually. Iterate on
review findings. Record the decision in `07_PAGE_CHANGELOG.md`.

**Evidence:** design review (created before code), verification, browser
evidence, control geometry and independent accessibility/mobile review.

**Closed 2026-09-23:** The pre-code design review approved a minimal wrapping
layout. The trigger, meter, status, error and review actions now remain inside
their note/fault panels; the evaluation and fault-form headers wrap without a
fixed square. A visual review caught unreadable one-character status wrapping
at 200% text, so the message now takes a readable line and moves Cancel below
it when needed. Focused Playwright passed 3/3 on Node 24.19.0 across all
states in five synthetic host wrappers and real create/edit, knowledge,
evaluation and fault journeys. All 60 recorded geometries fit, including the
unsupported state at 320 px/200% and ordinary 390/412 px widths. Typed text
survives denied microphone access and Retry. `npm run evidence -- V02` passed
428 tests, domain/compatibility checks and the PWA build. The independent
accessibility/mobile review is PASS_WITH_FINDINGS with zero blockers. Its sole
QoL note is to keep the synthetic wrapper classes aligned with production
hosts. No physical phone check is claimed; the owner checks that separately.

## V04 — Fluid crop editing

**Category:** FEATURE
**Status:** COMPLETE

Add accessible, ≥44 px edge handles beside the existing corners. During tilt
drag, the image **and crop frame** must track the pointer each frame; a
debounced high-resolution render may settle after release. The crop should act
as a readable frame: show the inside at a useful modest zoom and keep the
outside visible but darker and subtly blurred. Use the existing editor's visual
language and the familiar Photos crop pattern as a reference, not a claim of
pixel identity. Keep image and handles smooth on the owner's phone class of
device; instrument frame updates and avoid re-decoding the source every move.

**Evidence:** verification, browser video/frames proving mid-drag tracking,
performance measurement, visual field-UX review and self-review. Test corner,
edge, keyboard, zoom, crop output and the existing scan journey at narrow
viewports. Record P06 changes in the page changelog.

**Completion, 2026-09-23:** `.evidence/V04/verification.json` records `npm
run verify` PASS on Node 24.19.0 (465 tests, domain/compatibility checks and
PWA build). Twelve V04 Playwright cases passed across Pixel 7 Chrome, iPhone
viewport Chromium and iPhone WebKit; at a 20% crop, real drags from all eight
handle centers reached the intended target and changed only the intended edges.
The synthetic mid-drag frame and response samples are in `.evidence/V04/`;
independent field-UX review is PASS. The scan/review browser journey also passed
on two Chromium projects. Physical phone smoothness remains for the owner's
device check; none is claimed here.

## S5 — Faster, smaller scan review and age-only entry

**Category:** RULE_HEAVY
**Status:** PENDING

- A manually entered age in years is sufficient; remove the exceptional
  **“Data esatta per le regole sui minori”** box from the scan review. Persist
  the declared age as completed years on the first course day, allow later
  manual correction and never invent a birthday. Exact DOB remains when
  actually read/entered, and remains authoritative there.
  Update student schema/migration, minor/adult rules, 0.1.0 compatibility and
  all affected UI/tests so no rule relies on a fabricated day. Mark age-only
  provenance clearly in edit/profile views.
- Remove the single-row **Scambia nome e cognome** action. The sheet-level
  order and explicit field editing remain.
- Put the `Età` and `Sesso` labels on the same line as their controls to save
  vertical space; leave name fields as they are.
- Tapping `Campi da completare` moves focus/scroll to the first incomplete
  field. Tapping `Righe da controllare` goes to the first row needing review.
  Recompute targets after edits; announce arrival for assistive technology.
- Use S4's synthetic medium-difficulty roster set to prevent regression.

**Evidence:** schema/domain and compatibility tests, scan component tests,
visible browser journeys, accessibility/field review and independent domain
review. No previously shown OCR text may be cleared by an inference.

## N1 — Phone navigation, identity and student names

**Category:** FEATURE
**Status:** PENDING

- Android/iPhone browser Back or swipe-back navigates to the previous in-app
  screen instead of closing the PWA when there is in-app history. Preserve
  sensible root behavior and persisted course state; test deep paths, forms,
  dialogs and reload.
- Redraw the installed-app icon with a white background, the same CVC symbol
  used on Home, and **HELPER** beneath it in CVC blue. Start from the existing
  vector/logo assets. Render all icon sizes, inspect them at actual launcher
  size, obtain independent visual/accessibility review, revise until clean, and
  verify the manifest and installable build. The requested mark supersedes the
  older branding deferral for this icon only; the product name remains provisional.
- When students share a displayed given name and surname initial, expand both
  surnames to the shortest distinguishing prefix with a period (for example
  `Mario Ros.` / `Mario Roc.`). A nickname still takes precedence. Handle exact
  duplicates and accents deterministically and use the same label where
  selection ambiguity matters.

**Evidence:** verification, browser Back journeys, icon renders/visual review,
name collision tests, self-review and relevant page changelog updates.

## C1 — Crew entry, destination picker and shareable summary

**Category:** FEATURE
**Status:** PENDING

- Crew count input permits an empty draft, interpreted as zero crews, so users
  can replace `1` with `8` normally. Preserve valid limits when committed.
- Put students in Comandata first in the available pool, with deterministic
  ordering within both groups.
- For D1 and Cabinato, start people-per-crew capacity at four and permit manual
  adjustment. D2–D5 remain fixed at two by default; a Settings-only flag
  enables add/remove students on crew cards. Keep capacity separate from the
  selected-name display density and test both settings independently.
- Show selected crew members three per row by default, with a Settings choice
  for two or three; do not put this control on the Equipaggi page. Test 320 px,
  200% text, long names and 40 students: names may truncate accessibly, but
  layout and controls must stay intact.
- The available-student destination menu previews each eligible crew by member
  names and `-` for vacancies, shows only crews with room, and has actions for
  **Nuovo equipaggio**, **A terra** and **Mezzi**. If no existing crew has room,
  say **“Equipaggi pieni”**. Opening the menu scrolls the page behind it to the
  first crew with a vacancy, without moving keyboard focus out of the menu.
- Summary shows the Comandata and minor icons. Offer download **or** copy of
  the complete summary as one image. If Copy is offered, it must copy an image,
  never plain text. All crews fit on one page; use two columns above 12 crews
  and reduce vertical spacing before reducing name font size.
  Ensure the image has no cut-off content and does not include private source
  photographs.

**Evidence:** settings persistence, component/domain tests, browser journeys,
summary image measurements and visual review at narrow/long-course cases.

The owner lifted the `+`/`-` crew-card deferral for C1 on 2026-09-23: these
controls support D1/Cabinato manual adjustment and appear for D2–D5 only when
the Settings override is enabled. Keep the override in Settings, not on the
Equipaggi page.

## E1 — Evaluation grouping and student history route

**Category:** FEATURE
**Status:** PENDING

In Valutazioni → Equipaggi, reduce the gap **between members of one crew** and
increase the gap **between crew groups**, including A terra/Non assegnati. The
current `EvaluationManagement.tsx` uses an outer `gap-1.5` and inner `gap-3`,
which reverses that hierarchy. Match the owner's observed local and deployed
cases, then test at 320 px/200% and with large crews. In student detail, keep
the excellent evaluation summary; tapping a session opens Valutazioni at that
exact session. The duplicate second history presentation is a future redesign,
not a removal in this milestone.

**Evidence:** verification, browser journey from student session to evaluation,
before/after geometry, visual review and self-review.

## V03 — Speech accuracy and latency

**Category:** FEATURE
**Status:** PENDING

Read `.evidence/UG1/speech-quality-benchmark.json` first. Benchmark the owner's
ignored conversational Italian corpus with WER and median warm-model latency,
same machine and repeated clips. Quality must improve without increased time;
the usable latency target is at least 20% less. Compare DSP, pause trimming,
model/quantisation and chunking against the baseline; ship only a measured win.
Remove the separate `Scarta`/`Usa testo` confirmation: transcript enters the
editable field directly. Keep cancellation and failure recovery. Update the
physical-device checklist text before UG2.

**Evidence:** benchmark, verification, browser evidence, speech review and page
changelog. The 823 MB corpus remains under ignored `data/`.

## V05 — LLM-assisted paste path

**Category:** RULE_HEAVY
**Status:** PENDING

Keep on-device camera OCR first. Add a second route that lets the user copy a
strict prompt, send the photograph to an assistant of their own choice, and
paste its result into the same review flow. The app sends nothing itself. The
format must be specified by the app; malformed prose, fences, missing/invented
columns, empty answers and trailing text must produce visible unparsed lines,
never silently wrong students. Every row requires normal manual review.

**Evidence:** parser robustness corpus, browser journey, no-network proof,
verification and an independent adversarial domain review.

## F1 — Remaining R1 corrections

**Category:** FEATURE
**Status:** PENDING

R1's [open-items list](docs/post-mvp/0_3_0_OPEN_ITEMS.md) owns corrections
not already absorbed into S5, N1 or E1: moved long press must not open edit;
failed evaluation save must require an explicit retry/discard before navigation;
invalid student edit Back must explain its refusal; autosave status must cover
queued writes. The row name-swap is removed in S5, evaluation spacing is E1,
and launch background is N1. Update the living R1 list as each closes.

**Evidence:** verification, defect reproductions and fixes, browser journeys
and self-review. No unowned finding carries into UG2.

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

The unresolved S4 fewer-than-five target is recorded as a known limitation
and handed to Claude Code after UG2. UG2 still verifies the current OCR path,
privacy boundaries and actual device behavior; it does not require S4 closure
or claim that OCR accuracy met the deferred target.

**Evidence:** `.evidence/UG2/` verification, browser, migration, synthetic
roster, six reviewer reports and actual physical-device report. Do not publish
the development branch to `main` or update Pages without asking the owner.

## S4 — Measured OCR accuracy on real and synthetic rosters

**Category:** RULE_HEAVY
**Status:** IN_PROGRESS

The owner lifted the earlier deferral for the measured prototypes on
2026-09-23, then moved the unresolved quality target to the final Claude Code
handoff. S4 stays open, but it is not a predecessor of V04–UG2 and does not
block the 0.3.0 gate.

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

**Progress, 2026-09-23.** The local DPI 180 pass initially reduced aggregate
private-photo flags from 288 to 92 across five prepared captures. Preserving
unresolved weak structured readings for review now yields 96 flags and
candidate-row counts `20/21/29/21/20`; the extra row is an incomplete age
fragment on the fourth capture. On the clearest capture, all 20 students were
recovered with five low-confidence surname flags, but a row-level private audit
found one wrong given name and one wrong surname that confidence did not flag,
plus a second wrong surname that was flagged. DPI 300 reports
four flags on that capture but introduces another unflagged wrong given name and
severely worsens the shadowed capture. It is rejected as a counter-only fix.
Conservative TSV geometry recovered all ten people in a fictitious wide-column
fixture without a cross-person association; on the five real captures it made
zero joins or field reassignments. The four-variant generated corpus now uses
the production DPI 180; it recovers 40/40 fictitious people and 196/196
readable fields. The targeted mobile browser journey, Node 24 quick/domain
checks and production build pass. A local name-cell second pass raised one
surname's confidence above 70, but two private audits disagree on whether that
reading is exact, so it is not integrated. The independent data-integrity
review verdict is **FAIL**: the clearest photo has five flags, unflagged wrong
names remain, and person-level truth coverage is missing for four captures.
Eight further local name-cell variants were measured privately. A single-word
pass reported three exact promotions among five flagged surnames in a narrow
audit, but did not correct either unflagged wrong name field; one private
transcription is disputed and no all-photo truth audit supports integration.
An aggregate-only person/field truth audit now covers all five captures: the
twenty unique printed birth dates each appear once and in order on every scan,
so all 100 student appearances are associated without a missing or merged
student. Eleven extra candidates remain. Across those 100 matched rows, 11
given names and 19 surnames are wrong; two wrong given names and nine wrong
surnames are unflagged. An all-row single-word reread changed none of the
twenty names on the clearest capture and increased flagged surnames to eleven.
A source-resolution sweep found one 2800-pixel rendering with four flags, but
it had two unflagged wrong surnames versus one in the selected 2600-pixel
rendering; that smaller counter is rejected. Further OCR changes must improve
confident-name correctness as well as the counter. S4 remains
**IN_PROGRESS**. Aggregate-only details are in
`.evidence/S4/`.

**Additional probes, 2026-09-23.** Tesseract choice mode produced identical
primary readings on all five photos. A larger local Italian model gave the
same five flags and name errors on the clearest photo while exceeding the
current offline precache size limit. Grayscale/normalization/sharpening left
that photo at 20 rows and five flags. A DOB-anchored name-cell reread reduced
flagged name fields from 52 to 45 across the five captures and from five to
two on the clearest, but the corrected truth audit found wrong names rising
from 30 to 31 and unflagged errors from 11 to 13; it is rejected. The first
private comparison used a mismatched truth table and was discarded before the
final audit. No production OCR change followed these probes. S4 remains
**IN_PROGRESS**; see `.evidence/S4/targeted-ocr-probes.json`.
