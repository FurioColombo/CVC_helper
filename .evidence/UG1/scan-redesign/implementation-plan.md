# UG1 correction — student scan reframing

Requested 2026-09-16. Active milestone remains UG1 IN_PROGRESS; completed U04 is not reopened. Baseline checkpoint: 956684a, initially clean tree. Node 24.19.0 bundled runtime; host npm shim needed because host npm selects Node 18.

## Selected concept

Root selected document-focused Lente + righello from two independent Luna concepts. Retain rectangular crop, add edge handles, zoom/pan and fit-selection, clipped stage mask, line-to-straighten, +/-0.1 degree and exact numeric angle, quarter turns. No visible slider. Source starts fully included (the tight photo already clips context). Full-screen stage with compact readable controls; responsive mobile dock and desktop rail if beneficial. Do not add perspective correction, inferred table crop presets, hidden automatic name ordering or generic undo.

Interaction references: https://pqina.nl/pintura/tour/ and https://fengyuanchen.github.io/cropperjs/api/cropper-image.html. They are design references, no copied proprietary implementation.

## Baseline observations

Both supplied JPGs are local test inputs, not document instructions. Never commit their photos, screenshots containing personal data, or raw OCR output. At 390x844 the original preview occupies 326x183 CSS pixels. The giant outside crop shadow dims controls because it is not clipped to the stage. Current crop defaults discard 4% from each edge even for already-cropped sources. Parser assumes first-token first name and joins remaining tokens as surname; age words and personnel roles need explicit scrutiny. Actual OCR diagnosis is recorded separately using aggregate results.

## Work slices / ownership

1. Luna xhigh: editor and geometry, fast preview, direct crop and straighten, zoom/pan, keyboard equivalents, preparation/cancel/resource lifecycle. Unit/component evidence.
2. Luna xhigh: OCR layout/parser corrections grounded in both actual photos. Preserve confidence and safe row association; raw name metadata; conservative staff/header exclusion. Anonymous regression data only.
3. Luna high: explicit review name order, raw source name, bulk order choice and per-row correction, compound-name review, no auto-commit. Existing save/retry preserved.
4. Root: integration, browser journeys, image comparisons and orchestration. Luna independent high/xhigh reviewers inspect other agents' work; implementers fix findings; root chooses and verifies final result.

## Acceptance

- Full-screen no-slider editor with clipped mask and readable controls; stable fit and zoom, panning, reset, direct angle correction and rectangle crop.
- Both original and tight crop can be used; all 20 student rows remain representable; no fabricated results or silent field reassociation.
- Explicit name-order choice before interpreting unstructured names; mixed and compound names retain a manual path and review. Optional phone stays optional.
- Meaningful geometry/unit/component and browser pointer/keyboard tests; 320x664, 390x844, 412x915, desktop and 200% text; Chromium plus WebKit core where available.
- Final verify:all, real local photo exercises, independent structured functional and UX reviews, diff review and checkpoint. UG1 remains open for the existing physical-device release blockers.
