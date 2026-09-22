# Open items — requests checked against the code

**R1 completed 2026-09-22.** This is the code-audited list requested by the
owner. The complete source and request-family ledger is
`.evidence/R1/sweep-coverage.json`.

This document records missing or partial behaviour. It does not authorise a
fix: every item has an owner, and each owner must use the milestone lifecycle.

## Planned in 0.3.0

### V02 — the dictation control changes width

The owner asked for one stable square control across permission, model loading,
recording and processing. The current trigger still renders changing labels
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
the ruler moves at lines 652-666. **Verdict: both missing, owned by V04.**

### V05 — LLM-assisted scan path

The owner asked for a second, explicit LLM-assisted route beside the private
on-device OCR route. The only production extraction route still parses
Tesseract lines and calls `candidateFromLine` one line at a time at
`src/capabilities/studentScan.ts:703-835,837-866`.
**Verdict: missing, owned by V05.**

### UG2 — physical checks and release gate

The owner's phone/browser checks remain open by decision. The current code also
leaves three observations for that real-device gate: the exceptional exact-date
panel introduced by S3 (`src/features/students/StudentScan.tsx:438-465`), the
large sticky crop/review band at 200% text
(`src/features/students/StudentScan.tsx:907`), and the tall sticky boat strip
with its four-column grid
(`src/features/crews/CrewManagement.tsx:1468-1510`).
**Verdict: automated evidence exists, physical result not claimed; owned by
UG2.**

## Deferred by the owner or frozen scope

### S4 — OCR line fragmentation

The OCR parser treats every Tesseract line as a possible student and calls
`candidateFromLine` separately at
`src/capabilities/studentScan.ts:837-866`. It does not merge horizontally
separated fragments that share a table row. The supplied photographs confirm
that this is the largest remaining review-load cause.
**Verdict: missing, owned by S4, deferred by the owner in the 0.3.0 brief
section 9. Do not start until that deferral is lifted.**

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
provisional. **Verdict: intentionally deferred by the owner.**

### Other frozen deferrals

The global sweep reconfirmed the 0.2.0 scope deferrals: the broad custom icon
programme (including semantic fault-part icons), advanced student sorting,
Instagram photography, dashboards, backend/synchronisation/authentication,
native brightness, image export, automatic crew generation, evaluation-band
hints, general content areas, synchronised timelines and fixed crew-size
formulae outside D2-D5. The implemented neutral fault fallback is visible at
`src/features/boats/FaultCard.tsx:152`; the local-only persistence decision is
implemented from `src/persistence/db.ts:49`. **Verdict: deferred by scope, not
missed implementation.**

## Corrections found by R1

These items were not owned before the sweep. They are now assigned to **F1 —
R1 follow-up corrections**, after V05 and before UG2.

### F1.1 — evaluation crew grouping reads backwards

The owner explicitly asked for more space between crews in Valutazioni. The
outer group list is `gap-1.5` at
`src/features/evaluations/EvaluationManagement.tsx:655`, while every crew,
`A terra`, and `Non assegnati` section uses `gap-3` at lines 672, 688 and 702.
Cards inside a group therefore have more space than adjacent groups.
**Verdict: missing.**

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

### F1.4 — per-row name swap can overwrite manual correction

The row-level swap re-applies OCR-derived words at
`src/features/students/StudentScan.tsx:261-273`. If the operator first edits a
name and then invokes the explicit swap, those manual values can be replaced.
**Verdict: implementation defect in an existing fallback.**

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

### F1.7 — installed-app splash colour does not match the app background

The PWA manifest still uses cream `#f4f1e8` at `vite.config.ts:84`, while the
application background is the blue-grey surface recorded by UG1. This can show
as a mismatched launch surface on an installed phone. **Verdict: missing visual
polish.**

## Findings checked and closed or intentionally unchanged

| Finding                                             | Code check and disposition                                                                                                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1 telephone choice is not remembered               | `useState(false)` at `src/features/students/StudentScan.tsx:533` deliberately restores the requested privacy-safe default for every scan. No contrary owner request; unchanged.                                                                  |
| S2 suffix votes can include surnames                | `inferStudentNameOrder` at `src/capabilities/studentScan.ts:409-449` exposes both vote counts and falls back on ties; all five supplied captures selected the correct order. Accepted limitation, with manual sheet and row correction retained. |
| S3 manual create/edit still needs an exact date     | The storage and rules contract remains exact DOB; the form at `src/features/students/StudentManagement.tsx:493-503` is intentional.                                                                                                              |
| Gianluca sex inference                              | Closed in S2: the male-name table is used before suffix inference at `src/capabilities/studentScan.ts:136-160,389-399`.                                                                                                                          |
| Low-confidence text                                 | Still visible and marked; `MIN_FIELD_CONFIDENCE` remains 70. The scan review renders editable values at `src/features/students/StudentScan.tsx:372-465`.                                                                                         |
| Deletion pending label                              | Closed since the earlier review: the confirmation button now shows `Eliminazione…` at `src/features/students/StudentManagement.tsx:956`.                                                                                                         |
| Preview subpath 404                                 | Closed in documentation; `docs/DEPLOY.md:83-89` now requires the same `CVC_BASE_PATH` for preview.                                                                                                                                               |
| Built-in browser pane                               | Excluded from product scope by `CLAUDE.md`; production browsers and the deployed PWA are the verification targets.                                                                                                                               |
| Multiple-tab warning                                | Multi-tab and synchronisation are explicitly outside scope; the database remains local-only.                                                                                                                                                     |
| Large JavaScript chunks and OCR development warning | Build/tooling observations, not unimplemented owner requests. Production build and OCR paths pass; UG2 remains the next full gate.                                                                                                               |
| Public Git history                                  | Accepted consequence of the chosen public Pages host. It is why private roster photographs stay under ignored `data/private/`.                                                                                                                   |

## Privacy and evidence boundary

The five supplied originals are stored locally under
`data/private/ocr-owner/`, which is covered by the repository's `data/` ignore
rule. `git check-ignore` confirms the directory is ignored and `git ls-files`
contains none of the files. Only aggregate counts enter committed evidence.
The originals, prepared derivatives and OCR outputs must stay out of Git and the
web.
