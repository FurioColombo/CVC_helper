# Implementation plan — active 0.3.0 work

Updated 2026-09-24. Read **Where this cycle stands**, then only the section for
the active milestone. Closed 0.3.0 milestone details are in
`archive/v0.3.0-completed-milestones.md`; the full plan through R1 is at
`archive/v0.3.0-through-R1/04_IMPLEMENTATION_PLAN.md`. Completed 0.1.0 and
0.2.0 history also remains in `archive/`. Archived plans explain decisions but
are not the current contract. `.milestones/manifest.json` is the machine-readable
lifecycle.

## Where this cycle stands

| Work | State and evidence |
| --- | --- |
| 0.2.0 and V01 | Complete. `v0.2.0` is tagged. The app is deployed at `https://furiocolombo.github.io/CVC_helper/` and opens on the owner's phone. Pages deploys from `main`, which is behind this development branch. Do not promote without the owner's approval. |
| S1–S3 | Complete at `c29374e`. The five private photographs showed 16–24 fewer review flags each after telephone opt-in, automatic sheet name order and age/date corroboration. Node 24.19.0, 428 tests and focused browser checks passed. Exact DOB is still stored at this checkpoint. |
| R1 | Complete at `52df92d`. [Open items](docs/post-mvp/0_3_0_OPEN_ITEMS.md) is the code-audited request list; `.evidence/R1/sweep-coverage.json` records source coverage. |
| D0 | Complete. The shared agent contract and active plan are concise; closed detail is archived. Node 24.19.0 `npm run verify` passed (428 tests, domain, compatibility and build); see `.evidence/D0/`. |
| V02 | Complete. The shared dictation control and all five host layouts fit the 320 px/200% stress case. Independent design and accessibility reviews found no remaining blocker. |
| S4 | In progress, deferred to the final Claude Code handoff by the owner. Current OCR improvements and safety checks remain; the remaining fewer-than-five target is not a prerequisite for V04–UG2 or the 0.3.0 gate. No unsafe counter-only variant was integrated. |
| V04 | Complete. Four edge handles, live image/frame tilt and a dimmed, soft exterior were verified with synthetic imagery. `.evidence/V04/` records Node 24.19.0 verification (465 tests), 12 browser cases across Chrome/WebKit, pointer-response samples and a PASS field-UX review. |
| S5 | Complete. Age-only entry, persistence and course-start minor rules are covered by migration/domain tests and Pixel/iPhone-sized browser journeys. `.evidence/S5/` records 476 passing tests, the 0.1 schema migration, browser checks and a zero-blocker independent review. |
| N1 | Complete. Node 24.19.0, 482 unit/component tests, domain/compatibility checks, production build and eight Pixel/iPhone browser journeys passed; see `.evidence/N1/`. Physical installed-app Back and icon appearance remain for the owner to check. |
| C1, E1, V03, V05, F1, UG2 | Pending in the sequence below. |

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
in Settings. Crew capacity is separate: D1/Cabinato starts at four and allows
manual change; D2–D5 stays fixed at two through the gate. Its Settings override
is deferred to the final Claude Code follow-up. No crew-size rule follows from
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
11. **S4** remaining OCR quality target and the deferred D2–D5 crew-capacity
    override, both handed to Claude Code after the gate.

The owner explicitly made the remaining S4 target nonblocking on 2026-09-23.
The manifest places S4 after UG2 so the lifecycle enforces the revised order;
S4 retains its unfinished evidence and FAIL review for Claude Code. Every
milestone follows `AGENTS.md`: baseline, start,
implementation, evidence, browser work where required, review, verification,
completion, clean checkpoint. Use `verify:quick` before a commit and
`verify:all` at UG2 only.

## N1 — Phone navigation, identity and student names

**Category:** FEATURE
**Status:** COMPLETE

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

**Outcome, 2026-09-24:** Complete. Name selections use the shortest surname
prefix that distinguishes matching given names, with nicknames preserved and
exact duplicates ordered by stable student ID. In-app Back restores shell and
student screens, closes the active dialog, and does not leave a duplicate
student-list entry after creation. The launcher icon uses the Home CVC symbol
on white with blue HELPER below. Node 24.19.0 `npm run verify` passed (482
tests, domain, compatibility and production build); eight focused browser
journeys passed on Pixel 7 Chrome and iPhone 13 viewport. See `.evidence/N1/`.
The owner still needs to verify native device Back/swipe and installed launcher
rendering; no physical-device pass is claimed.

## C1 — Crew entry, destination picker and shareable summary

**Category:** FEATURE
**Status:** PENDING

- Crew count input permits an empty draft, interpreted as zero crews, so users
  can replace `1` with `8` normally. Preserve valid limits when committed.
- Put students in Comandata first in the available pool, with deterministic
  ordering within both groups.
- For D1 and Cabinato, start people-per-crew capacity at four and permit manual
  adjustment. D2–D5 remain fixed at two for the 0.3.0 gate. Keep capacity
  separate from selected-name display density.
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

The owner confirmed on 2026-09-23 that `+`/`-` crew-card controls support
D1/Cabinato manual adjustment. On 2026-09-24 the owner deferred the D2–D5
Settings override to the final Claude Code follow-up; it is outside C1 and does
not block UG2. Do not add it to the 0.3.0 gate.

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

Historical measurements, failed variants and audit corrections are preserved in `archive/v0.3.0-s4-measurement-history.md`; aggregate outputs remain in `.evidence/S4/`. None of those probes justified a production OCR change. Read the archived sequence before resuming S4 so rejected variants are not repeated.
