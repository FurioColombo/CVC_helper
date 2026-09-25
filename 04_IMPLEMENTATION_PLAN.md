# Implementation plan — active 0.3.0 work

Updated 2026-09-25. Read **Where this cycle stands**, then only the section for
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
| S4 | In progress, deferred to the final Claude Code handoff by the owner. Current OCR improvements and safety checks remain; the remaining fewer-than-five target is not a prerequisite for V04–UG2 or the 0.3.0 gate. No unsafe counter-only variant was integrated. |
| V04 | Complete. Four edge handles, live image/frame tilt and a dimmed, soft exterior were verified with synthetic imagery. `.evidence/V04/` records Node 24.19.0 verification (465 tests), 12 browser cases across Chrome/WebKit, pointer-response samples and a PASS field-UX review. |
| S5 | Complete. Age-only entry, persistence and course-start minor rules are covered by migration/domain tests and Pixel/iPhone-sized browser journeys. `.evidence/S5/` records 476 passing tests, the 0.1 schema migration, browser checks and a zero-blocker independent review. |
| N1 | Complete. Node 24.19.0, 482 unit/component tests, domain/compatibility checks, production build and eight Pixel/iPhone browser journeys passed; see `.evidence/N1/`. Physical installed-app Back and icon appearance remain for the owner to check. |
| C1 | Complete. Node 24.19.0 `npm run verify` passed (507 tests, domain, compatibility and production PWA build); three Pixel 7 Chrome journeys passed, including the 40-student 320 px/200% stress case. The synthetic 13-crew image fits on one page in two columns. See `.evidence/C1/`. |
| E1 | Complete. Pixel 7 browser journeys cover the 40-student crew layout, exact-session route, and Valutazioni note panel; see `.evidence/E1/`. |
| UX1 | Complete. Node 24.19.0 `npm run verify` passed (537 tests, domain/compatibility and PWA build), seven Pixel 7 browser journeys passed, and the independent adversarial review ended PASS after the exact-slot persistence defect was fixed. See `.evidence/UX1/`. |
| UX2 | Complete. Whole-page boat swipe and free-slot selection without popup passed 3 focused Pixel/iPhone browser cases (one intentional skip); Node 24.19.0 `npm run verify` passed 538 tests, domain/compatibility and PWA build. Independent adversarial review: PASS. Four development audits and evidence are in `.evidence/UX2/` and `docs/post-mvp/0_3_0_DEVELOPMENT_AUDIT.md`. |
| V03 | Complete by the owner's 2026-09-25 acceptance after Android and PC/Chrome use. Speech is borderline usable, slow and imperfect. Apple/iPhone was unavailable and remains untested; see `.evidence/V03/speech-device-evidence.json`. |
| V05, F1, UG2 | Pending in the sequence below. |

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
12. **F1** remaining R1 corrections, then **UG2** integration and release gate.
13. **S4** remaining OCR quality target and the deferred D2–D5 crew-capacity
    override, both handed to Claude Code after the gate.

The owner explicitly made the remaining S4 target nonblocking on 2026-09-23.
The manifest places S4 after UG2 so the lifecycle enforces the revised order;
S4 retains its unfinished evidence and FAIL review for Claude Code. Every
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
