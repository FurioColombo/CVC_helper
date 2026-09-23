# Open items — requests checked against the code

**R1 completed 2026-09-22.** This is the code-audited list requested by the
owner. The complete source and request-family ledger is
`.evidence/R1/sweep-coverage.json`.

This document records missing or partial behaviour. It does not authorise a
fix: every item has an owner, and each owner must use the milestone lifecycle.

## Planned in 0.3.0

### V02 — the dictation control changes width

The owner clarified on 2026-09-23 that a fixed square was a proposed solution,
not a requirement. The existing look in the student note is liked; the control
only needs to stay within its pane in every state, especially Valutazioni on
the deployed build. The current trigger still renders changing labels
(`Termina`, `Permesso…`, `Caricamento…`, `Elaborazione…`) at
`src/features/speech/DictationControls.tsx:45-68`; its width therefore remains
content-driven. **Verdict: missing, owned by V02.** V02 begins with the required
independent field-UX/accessibility design review before implementation.

### V03 — speech quality, latency and the confirmation step

The owner asked for a measured quality improvement without increased time, with
at least a 20% latency reduction as the usable target, and removal of the extra
transcript confirmation step. The state machine still includes `review` at
`src/features/speech/useDictation.ts:15,117,203,213`, and the UI still presents
`Scarta` and `Usa testo` at
`src/features/speech/DictationControls.tsx:138-161`.
**Verdict: missing, owned by V03.** V03 also owns updating the physical-device
checklist whose instructions still name those two buttons.

### V04 — crop edge handles and live rotation

The owner's edge-handle sketch is not implemented: the document editor defines
and renders only four `CROP_CORNERS` at
`src/features/students/StudentScanImageEditorDocument.tsx:39-69,588-606`, even
though the crop domain already supports north/east/south/west gestures at
`src/features/students/studentImageCrop.ts:7-17,76-91`.

The visible bitmap also does not follow the finger while the ruler moves. Image
regeneration is delayed at
`src/features/students/StudentScanImageEditorDocument.tsx:183-195`, while the
bitmap transform at line 555 contains translate and scale but no rotation; only
the ruler moves at lines 652-666. The owner now also wants a modestly zoomed
crop frame with a darker, subtly blurred exterior and smooth mid-drag motion.
**Verdict: missing, owned by V04.**

### V05 — LLM-assisted scan path

The owner asked for a second, explicit LLM-assisted route beside the private
on-device OCR route. The only production extraction route still parses
Tesseract lines and calls `candidateFromLine` one line at a time at
`src/capabilities/studentScan.ts:703-835,837-866`.
**Verdict: missing, owned by V05.**

### UG2 — physical checks and release gate

The owner's phone/browser checks remain open by decision. The exact-date panel
at `src/features/students/StudentScan.tsx:438-465` is now owned by S5 for
removal when age is entered manually. UG2 retains the large sticky crop/review
band at 200% text
(`src/features/students/StudentScan.tsx:907`), and the tall sticky boat strip
with its four-column grid
(`src/features/crews/CrewManagement.tsx:1468-1510`).
**Verdict: automated evidence exists, physical result not claimed; owned by
UG2.**

## Reopened by the owner on 2026-09-23

### S4 — OCR line fragmentation

The parser now runs conservative TSV row geometry before `candidateFromLine`
in `src/capabilities/studentScan.ts`. The public wide-column fixture verifies
safe joins, but the supplied photographs yielded no defensible joins. Their
residual fragmented readings remain the largest review-load cause.
**Verdict: partial, owned by S4.** Conservative TSV geometry and DPI 180 are
integrated, but the good-photo target is unmet. The owner moved the residual
work to the final Claude Code handoff after UG2, explicitly nonblocking for
the 0.3.0 gate. Existing safety rules and private-photo boundaries remain.

## Deferred by the owner or frozen scope

### Historical roster text in public Git refs

The current tree uses fictional examples, but an aggregate local-ref audit found
older roster-value text in Git history. The owner deferred a coordinated
history/tag rewrite to future work on 2026-09-23. That future task must assess
published refs and collaborator clones before any force-push. Private
photographs remain ignored; no exact photograph blob was found in local refs.
See `.evidence/S4/privacy-audit.json` for aggregate counts.

### Automated real-photograph regression

The repository has synthetic public fixtures, while the real-photo measurement
remains manual because the photographs contain students' and staff members'
personal data. The production measurement entry point is
`src/capabilities/studentScan.ts:837-866`; the private inputs live only under
ignored `data/private/ocr-owner/`.
**Verdict: missing by explicit deferral.** A future fixture must be synthetic or
irreversibly anonymised; the supplied originals must never be committed.

### Final product name and derived mark

The product still uses the provisional name `CVC Helper`; the manifest values
remain in `vite.config.ts:74-85` and the current CVC identity is documented as
provisional. **Verdict: the final product name remains deferred.** N1 now owns
the specific installed-app icon requested on 2026-09-23: the Home CVC symbol
on white with HELPER in CVC blue beneath it.

### Other frozen deferrals

The global sweep reconfirmed the 0.2.0 scope deferrals: the broad custom icon
programme (including semantic fault-part icons), advanced student sorting,
Instagram photography, dashboards, backend/synchronisation/authentication,
native brightness, general image export, automatic crew generation, evaluation-band
hints, general content areas, synchronised timelines and special crew-size
formulae beyond the 0.3.0 C1 defaults/override. The implemented neutral fault
fallback is visible at
`src/features/boats/FaultCard.tsx:152`; the local-only persistence decision is
implemented from `src/persistence/db.ts:49`. **Verdict: deferred by scope, not
missed implementation.** C1 explicitly adds export of the crew summary only.

## Corrections found by R1

R1 first assigned these to F1. The owner's later requests move evaluation
spacing to E1, the row swap to S5 and the installed icon/background to N1.
The remaining small defects stay with F1.

### E1 — evaluation crew grouping reads backwards

The owner explicitly asked for more space between crews in Valutazioni. The
outer group list is `gap-1.5` at
`src/features/evaluations/EvaluationManagement.tsx:655`, while every crew,
`A terra`, and `Non assegnati` section uses `gap-3` at lines 672, 688 and 702.
Cards inside a group therefore have more space than adjacent groups. The owner
also says the gap between members is too large. **Verdict: missing, E1.**

### F1.2 — moving during a profile long press does not cancel release

`useFieldShortcut` detects movement, but `onPointerUp` calls `cancelPress()` at
`src/features/students/StudentManagement.tsx:131-136`; `cancelPress()` clears
`pressMoved` at lines 98-102 before the release condition reads it. A moved touch
held for 500 ms can still open the edit form. This violates the requested
long-press shortcut behaviour. **Verdict: implementation defect.**

### F1.3 — a failed evaluation can be discarded by navigation

A failed save intentionally keeps the attempted value and records its student
in `saveErrors` at
`src/features/evaluations/EvaluationManagement.tsx:429-463`. View and session
navigation only block active saves or an open note at lines 519-522 and 541-555;
they do not block or resolve `saveErrors`. Changing view/session can therefore
discard the unsaved attempt. **Verdict: partial.**

### S5 — per-row name swap can overwrite manual correction

The row-level swap re-applies OCR-derived words at
`src/features/students/StudentScan.tsx:261-273`. If the operator first edits a
name and then invokes the explicit swap, those manual values can be replaced.
**Verdict: removal requested by the owner; S5.**

### F1.5 — invalid profile edits make Back appear inert

`persistEdit` returns `false` for missing required values without setting an
explanatory error at
`src/features/students/StudentManagement.tsx:392-401`; `exitForm` only leaves
after a successful result at lines 457-464. Data is protected, but Back gives no
reason for staying. **Verdict: partial.**

### F1.6 — autosave can briefly under-report pending work

Each newer edit increments the version and clears `saving` before its debounce
at `src/features/students/StudentManagement.tsx:428-438`, even while an older
queued request can still be running. Versioning prevents stale success and data
loss, but the status can briefly say less than the queue does.
**Verdict: presentation defect.**

### N1 — installed-app splash colour does not match the app background

The PWA manifest still uses cream `#f4f1e8` at `vite.config.ts:84`, while the
application background is the blue-grey surface recorded by UG1. This can show
as a mismatched launch surface on an installed phone. **Verdict: missing visual
polish; N1 includes the new icon.**

## Requests added on 2026-09-23

Each item below names the current code location and its owning milestone. The
acceptance tests are in the active implementation plan.

| Request                                                                                                               | Current code and verdict                                                                                                                                         | Owner |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Fewer than five scan flags on a good photograph; compare three OCR options                                            | `src/capabilities/studentScan.ts:837-866` still parses Tesseract lines independently; the owner reports about 26 flags on a good local capture. Missing.         | S4    |
| Better three-part-name handling and generated medium-difficulty roster images                                         | Name extraction remains line-local at `src/capabilities/studentScan.ts:703-835`; the public fixture set is under `tests/fixtures/`. Partial.                     | S4    |
| Smooth crop with modest zoom and dark, softly blurred exterior                                                        | Bitmap regeneration is delayed at `src/features/students/StudentScanImageEditorDocument.tsx:183-195`; the visible transform at line 555 lacks rotation. Missing. | V04   |
| Age in years without entering an exact birthday                                                                       | `src/features/students/StudentScan.tsx:438-465` shows the exact-date correction box; persistence still requires DOB. Missing.                                    | S5    |
| Remove single-row name swap                                                                                           | `src/features/students/StudentScan.tsx:261-273` still reorders a single row. Missing.                                                                            | S5    |
| Put `Età` and `Sesso` labels beside their controls                                                                    | `src/features/students/StudentScan.tsx:398-465` stacks the current fields. Missing.                                                                              | S5    |
| Review counters jump to the first matching field/row                                                                  | Counter buttons in `src/features/students/StudentScan.tsx:907-945` do not navigate to the first item. Missing.                                                   | S5    |
| Phone Back gesture returns to the previous app screen                                                                 | `src/App.tsx:348-431` changes local view state without a browser history entry. Missing.                                                                         | N1    |
| White app icon using the Home CVC symbol and blue HELPER                                                              | `public/icons/cvc-helper.svg` and `vite.config.ts:74-85` retain the existing mark/manifest background. Missing.                                                  | N1    |
| Disambiguate same given name and surname initial; nickname wins                                                       | `src/domain/student.ts:41-54` falls back to one surname initial. Partial.                                                                                        | N1    |
| Empty crew-count input means zero and permits replacing 1 with 8                                                      | `src/features/crews/CrewManagement.tsx:1720-1738` converts empty input back to 1. Missing.                                                                       | C1    |
| Students in Comandata first among available students                                                                  | `src/features/crews/CrewManagement.tsx:1803-1829` renders the current pool order. Missing.                                                                       | C1    |
| Three selected students per row, with a two/three choice only in Settings                                             | Crew-member layout at `src/features/crews/CrewManagement.tsx:2154-2222` has no user setting. Missing.                                                            | C1    |
| D1/Cabinato start at four per crew; D2–D5 default to fixed pairs with a Settings override for manual add/remove       | The earlier crew-card controls do not implement the new course defaults and override. Missing.                                                                   | C1    |
| Destination menu previews member names/vacancies, eligible crews, new crew, land and means; page scrolls to a vacancy | `src/features/crews/CrewManagement.tsx:1928-1986` lists crew numbers and limited actions without that preview or background scroll. Missing.                     | C1    |
| Commandata/minor icons and a complete single-image crew summary                                                       | `src/features/crews/CrewManagement.tsx:636-682` renders the current summary without those badges or export. Missing.                                             | C1    |
| Less space between members and more between evaluation crews                                                          | `src/features/evaluations/EvaluationManagement.tsx:655-709` uses the reverse spacing hierarchy. Missing.                                                         | E1    |
| Tap a student-history session to open its evaluations                                                                 | Student detail passes history at `src/features/students/StudentManagement.tsx:848-850` without a session-navigation callback. Missing.                           | E1    |

The owner lifted the `+`/`-` crew-card deferral on 2026-09-23. C1 implements
manual adjustment for D1/Cabinato and, when enabled in Settings, D2–D5. The
Settings override and two/three-name display choice are separate controls;
neither belongs on the Equipaggi page.

The second, repetitive evaluation presentation in student detail is also a
future redesign. E1 only adds navigation from a session to its exact
Valutazioni screen; the current history component is mounted at
`src/features/students/StudentManagement.tsx:848-850`.

## Findings checked and closed or intentionally unchanged

| Finding                                             | Code check and disposition                                                                                                                                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1 telephone choice is not remembered               | `useState(false)` at `src/features/students/StudentScan.tsx:533` deliberately restores the requested privacy-safe default for every scan. No contrary owner request; unchanged.                                                                       |
| S2 suffix votes can include surnames                | `inferStudentNameOrder` at `src/capabilities/studentScan.ts:409-449` exposes both vote counts and falls back on ties; all five supplied captures selected the correct order. Accepted limitation, with manual sheet and row correction retained.      |
| S3 manual create/edit still needs an exact date     | The old storage contract remains at `src/features/students/StudentManagement.tsx:493-503`. The owner now permits age-only scan entry; S5 will migrate it without inventing a birthday.                                                                |
| Gianluca sex inference                              | Closed in S2: the male-name table is used before suffix inference at `src/capabilities/studentScan.ts:136-160,389-399`.                                                                                                                               |
| Low-confidence text                                 | Still visible and marked; `MIN_FIELD_CONFIDENCE` remains 70. The scan review renders editable values at `src/features/students/StudentScan.tsx:372-465`.                                                                                              |
| Deletion pending label                              | Closed since the earlier review: the confirmation button now shows `Eliminazione…` at `src/features/students/StudentManagement.tsx:956`.                                                                                                              |
| Preview subpath 404                                 | Closed in documentation; `docs/DEPLOY.md:83-89` now requires the same `CVC_BASE_PATH` for preview.                                                                                                                                                    |
| Built-in browser pane                               | Excluded from product scope by `docs/LOCAL_DEVELOPMENT.md`; production browsers and the deployed PWA are the verification targets.                                                                                                                    |
| Multiple-tab warning                                | Multi-tab and synchronisation are explicitly outside scope; the database remains local-only.                                                                                                                                                          |
| Large JavaScript chunks and OCR development warning | Build/tooling observations, not unimplemented owner requests. Production build and OCR paths pass; UG2 remains the next full gate.                                                                                                                    |
| Public Git history                                  | Private photographs remain ignored and no exact JPEG blob was found in local history. Older refs contain real roster-value text; the owner deferred any coordinated history/tag rewrite to a future task. Current tracked examples are fictionalized. |

## Privacy and evidence boundary

The five supplied originals are stored locally under
`data/private/ocr-owner/`, which is covered by the repository's `data/` ignore
rule. `git check-ignore` confirms the directory is ignored and `git ls-files`
contains none of the files. Only aggregate counts enter committed evidence.
The originals, prepared derivatives and OCR outputs must stay out of Git and the
web.
