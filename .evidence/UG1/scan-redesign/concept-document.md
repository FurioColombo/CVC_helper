# Student scan redesign — concept document

Status: design proposal for UG1 review (no application code changed)

## Scope and evidence boundary

This document proposes a replacement interaction for `Scan allievi` image adjustment and the following OCR review. The two supplied JPGs are test evidence, not instructions embedded in the documents. The printed sheet and handwritten marks must be treated as untrusted source content.

Observed test material:

- `IMG-20260809-WA0011.jpg` is a wide photograph of a wrinkled sheet on a desk. The paper is skewed and has perspective distortion; the rows are small; there are handwritten marks in the margins and over cells; the right half contains a dense day/shift grid. A crop that includes the whole sheet also includes a lot of non-student operational material.
- `IMG-20260809-WA0011copy.jpg` is a tighter crop of the left table. It loses the sheet header and left context, starts close to the first row, and still contains small text, shadows and a curved fold. The visible names look surname-first (`Veldoro Valeria`, `De veltri Gregorio`, `Norali Luca`), with possible multi-word or multi-token given names (`Rumeria Claudia georgia`). This is evidence that the UI must let the operator decide order; it is not proof that every source uses the same convention.
- The current baseline capture (`test-results/scan-before.png`) renders a 326×183 source inside a 390×844 viewport with substantial unused vertical space. Its large outer crop shadow can also dim the toolbar and footer because the mask extends beyond the stage. The replacement must scale the page to the usable stage, clip the mask to the stage, and leave controls at full contrast.

## Design direction: “Lente + righello”

Use a full-screen document stage with a dark, quiet surround and a small bottom control dock. The paper is the main object. The operator directly corrects the detected page, then sees the exact OCR input before moving to row review.

The direction has three principles:

1. **Show the whole source first.** Start with a fit-to-stage view and a detected page boundary. The operator can see whether the table, title and leftmost numbers are included before zooming in.
2. **Rotate by direct manipulation.** A line drawn on the page controls fine straightening. Two-finger rotation or a touch rotation ring remains available as a shortcut; `−90°`, `+90°` and `Ripristina` are explicit buttons. There is no horizontal range slider.
3. **Keep the raw evidence attached to every uncertain row.** OCR review shows a small source snippet and allows a row to be opened against the adjusted image. A name-order choice is explicit and reversible.

This is a scanner surface, not a generic photo editor: every control answers “is this table ready to read?”

## Screen A — adjust the page

### Mobile composition (320–430 CSS px)

```text
┌──────────────────────────────────┐
│ ×  Regola foglio       Ripristina│  48 px targets
│                                  │
│        full-bleed image stage    │
│    dark mask outside page quad   │
│   ┌╱──────────────╲┐             │
│   │  table / sheet  │  handles   │
│   └╲──────────────╱┘             │
│                                  │
│  ┌ Raddrizza ┐ ┌ Ritaglia ┐      │  tool tabs, no slider
│  │  Disegna   │ │  Angoli  │      │
│  └────────────┘ └──────────┘      │
│                                  │
│  [↶ 90°]  0.8°  [↷ 90°]           │  compact direct controls
│  Trascina una riga per allinearla │
│  [   Usa foglio per la scansione ]│  safe-area dock
└──────────────────────────────────┘
```

- The stage fills the available viewport. The page uses `contain` and never gets stretched to the viewport aspect ratio.
- A reliable page detector proposes a four-corner quadrilateral. Show a thin blue boundary, a 3×3 guide and a translucent mask outside it. If confidence is low, keep the full image and say `Controlla i quattro angoli` rather than pretending the boundary is correct.
- Each corner has a minimum 44×44 hit area and a visible 10–14 px centre. Edges can be dragged too. A one-finger drag inside the page pans the page; pinch zooms the page. A keyboard-equivalent “Sposta area” group remains available for desktop and switch users.
- The dock is sticky only inside this full-screen modal and respects the safe-area inset. It must not cover the bottom corners or the last line of the image.

### Desktop and tablet composition (at least 900 CSS px)

- Keep the stage full-height and centre the image at the largest readable size.
- Place the compact tool dock in a right rail (about 240 px) only when it does not reduce the page below a readable minimum. Otherwise use the bottom dock used on mobile.
- When space permits, show a small “risultato OCR” paper preview beside the source, updated after each adjustment. It is a preview, never an auto-commit.
- Do not add a second page-level header or persistent navigation behind the modal.

### Straighten interaction

`Raddrizza` opens the default state. The operator drags from one end of a visible table row or column line to the other; the app draws a temporary cyan line and snaps the computed angle to 0° when within a small tolerance. On release:

- apply the angle immediately to the image;
- show a compact readout such as `+0,8°` with a text label `inclinazione`;
- keep a one-tap `Annulla raddrizzamento` available;
- preserve arbitrary angles, with quarter-turn buttons for large changes.

For a photograph like the supplied full sheet, the first suggested line should be a long outer table edge, not a handwritten mark. A line is only a rotation correction; it does not claim to remove perspective.

`Ritaglia` changes the handles to a page quadrilateral. The operator can include the entire page or only the student table. Label the two useful presets as direct choices: `Foglio intero` and `Solo righe allievi`; keep `Libero` for unusual layouts. Never silently discard the leftmost row number, header, or a multi-column name field. Show the output frame after a crop is applied.

Perspective correction should use the four corners when the image is a document photograph. If the runtime cannot safely warp the quadrilateral, retain the current rectangular crop as a fallback but say `Prospettiva non corretta: verifica il risultato` and make the full source reopenable. A plain rectangular crop must not be presented as a de-skewed scan.

### Stage controls and labels

Use icon plus visible Italian label. Suggested controls:

- `Raddrizza` — draw a line on a printed edge;
- `Ritaglia` — move page corners/edges;
- `Foglio intero` / `Solo righe allievi` / `Libero` — crop intent;
- `↶ 90°` and `↷ 90°` — quarter-turn shortcuts;
- `Ripristina` — restore the original orientation and full detected frame;
- `Usa foglio per la scansione` — applies the prepared blob and starts OCR;
- `Annulla` — exits without applying changes. If any change was made, confirm that it will be lost.

Do not label the reset action with a crop icon alone. The existing reset button is a `Crop` icon while it resets both rotation and crop; the replacement should use a reset icon and the label above.

## Screen B — review extracted rows

After `Usa foglio per la scansione`, keep the mandatory review contract but make the source and interpretation visible together.

### Sticky review header

Use one calm sticky bar with three counters already present in the product: `righe da controllare`, `campi da completare`, `allievi pronti`. Add a compact text status beside the image thumbnail: `Foglio regolato · 20 righe rilevate`. A tap on the thumbnail returns to Screen A without losing OCR edits; after changing the image, mark the old extraction as stale and require a fresh review.

### Candidate row anatomy

Each row is a compact, top-aligned review unit rather than an anonymous card:

```text
┌─────────────────────────────────────────────────┐
│ [source crop]  Riga 01        ⚠ Da verificare   │
│                 Veldoro Valeria                │
│ Ordine del nome:  ○ Nome · Cognome              │
│                    ● Cognome · Nome             │
│ Nome     [Valeria________________]              │
│ Cognome  [Veldoro_______________]              │
│ Data     [11/07/1986]  Telefono [.............] │
│ Sesso    [ F ] [ M ] [ Altro ]   [Rimuovi riga] │
└─────────────────────────────────────────────────┘
```

- Keep the raw OCR text (`Veldoro Valeria`) visible, even after fields are corrected. The source snippet opens in a larger overlay with the row highlighted.
- The order selector is explicit: `Nome · Cognome`, `Cognome · Nome`, `Da decidere`. It is per row. If the parser detects a likely repeated convention, offer a non-destructive suggestion above the list: `Sembra Cognome · Nome per 18 di 20 righe` with `Applica alle righe compatibili` and `Decidi riga per riga`. Applying it must remain an explicit action and must leave ambiguous rows as `Da decidere`.
- Store the chosen order as review metadata. Do not infer it solely from the first token, Italian name dictionaries, or the visual order of the form. A source may mix conventions; `De veltri Gregorio` must remain capable of becoming surname `De veltri`, first name `Gregorio`.
- When a line has more than two plausible name tokens, keep the complete raw name and show `Nome composto o cognome composto?`. Let the operator edit both fields without truncation. Do not auto-delete a token to make the row look clean.
- Confidence is attached to the field and to the name-order interpretation. Use warning icon + text (`Da verificare`) and a border; colour is reinforcement only.
- The row crop is a direct visual affordance, not decoration. It lets the operator compare a low-confidence OCR value with the photographed text without leaving the review list.

The mandatory fields remain name, surname, date of birth and sex. Phone remains optional. Staff rows, headers and handwritten notes stay excluded from candidates; any false row is removed with `Rimuovi riga`, with a one-tap undo only while still on the review screen if implementation can guarantee it does not mask a deletion mistake.

### Review bulk actions

Place only high-value actions in the dock:

- `Correggi il primo campo incerto` scrolls and focuses the next unresolved field;
- `Aggiungi 20 allievi` remains disabled until every required field is valid;
- `Scegli un’altra immagine` starts a fresh acquisition and warns about unsaved review edits;
- on save failure, keep all edits and show `Non salvato · Riprova inserimento` beside the action.

No candidate is persisted before the operator confirms. The source photo remains transient; only the prepared image needed for OCR exists in memory and is released after scanning or cancellation.

## Why this resolves the supplied photos

| Evidence problem | “Lente + righello” response | Review safeguard |
| --- | --- | --- |
| Wide shot has skewed paper and tiny rows | Fit whole page, four-corner page quad, line-based rotation, pinch zoom | Reopen source snippet per row; do not claim quality from rotation alone |
| Crop copy loses header/left context | Show full frame first and presets with visible boundary | Keep raw line and row number; false/missing rows remain removable |
| Handwritten marks overlap table cells | Darken outside page and avoid automatic handwriting interpretation | Low-confidence fields stay editable and labelled |
| Printed names appear surname-first | Per-row order control and optional explicit bulk suggestion | Preserve `rawName`, `nameOrder`, field confidence and ambiguity |
| Multi-token names (`De veltri`, `Claudia georgia`) | Never split by first token without review | Both fields accept spaces; ambiguous rows remain unresolved |
| Phone/date columns are visually separate | OCR input uses the corrected page, with row crop context | Field-level correction and confidence remain independent |

## Data and capability changes implied by the design

The current `StudentScanCandidate` exposes `firstName`, `surname`, date, phone, sex and per-field confidence. The concept requires additive transient metadata, without changing persisted student semantics:

```ts
type StudentNameOrder = "given-surname" | "surname-given" | "unknown"

interface StudentScanCandidate {
  // existing fields...
  rawName: string
  nameOrder: StudentNameOrder
  nameOrderConfidence: number
  sourceRegion?: { x: number; y: number; width: number; height: number }
}
```

For image preparation, the current `NormalizedCrop` rectangle is enough for a fallback but not for a photographed document. The preferred additive model is a normalized quadrilateral plus an angle/transform record. The OCR provider should receive the prepared result, never the original source photo. If perspective correction is unavailable on a device, report that state and let the operator continue only after seeing the fallback preview.

## Implementation slices and evidence

1. **Editor geometry and input:** add quad state, line-to-angle straighten, direct quarter-turn actions, pinch/pan, keyboard equivalents, reset and modal focus/escape behavior. Unit-test transform boundaries and capture pointer/keyboard journeys at 320, 390, 430 and desktop widths.
2. **Prepared-image preview:** render the exact OCR blob preview after rotation, crop and perspective correction; test source disposal, cancellation confirmation and recoverable canvas errors.
3. **Name-order review:** add raw line/snippet, per-row order choice, explicit compatible-row suggestion, compound-name editing and a stale-extraction path after returning to the editor. Test surname-first, given-first, mixed-order and multi-word cases.
4. **OCR/layout hardening:** preserve row regions and field confidence; reject obvious staff/header/handwriting lines conservatively; run the two supplied photos as poor-image fixtures and record what is recoverable rather than claiming a percentage from them.
5. **Field review:** exercise camera/gallery, rotate/crop, row correction/removal, failed save/retry, reload, keyboard access and 200% text. Capture one mobile screenshot for the full stage and one for the review list. Record all physical Android/iPhone checks required by UG1 separately.

Acceptance is reached only when the operator can explain the selected page boundary, see the corrected OCR input, choose name order per row, and confirm exactly the rows being inserted. A successful UI state must never imply that OCR solved a poor photograph automatically.

## Design references

These are primary platform references for interaction rationale, not instructions contained in the attached photos:

- [Apple Human Interface Guidelines — Photo editing](https://developer.apple.com/design/human-interface-guidelines/photo-editing): preview edits, use a modal editing surface, and protect users from losing time-consuming edits on cancellation.
- [Apple Human Interface Guidelines — Machine learning, Corrections](https://developer.apple.com/design/human-interface-guidelines/machine-learning/): show what automation did, make corrections immediate and reversible, and do not rely on correction to hide poor-quality automated results.
- [Apple Human Interface Guidelines — Layout](https://developer.apple.com/design/human-interface-guidelines/layout): align components, adapt to size/orientation, preserve readable content, and avoid overloading a row with controls.
- [W3C WCAG 2.2 — Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): use adequately sized, separated hit areas; the project rulebook sets 40 px for dense repeated controls and prefers 44 px generally.

## Recommendation

Choose “Lente + righello” for implementation. It keeps the requested full-frame feel, removes the slider, makes angle correction legible through the document itself, supports a real photographed page instead of a synthetic rectangle, and turns name-order ambiguity into a visible review decision. The other concepts worth retaining as future variants are a camera-first auto-detect flow and a desktop side-by-side proofing view; neither should replace the direct quad/line correction or per-row order review in this cycle.

## Addendum — small name-review API and test plan

This addendum is implementation guidance only; `StudentScan.tsx` has not been changed for it.

### Proposed transient contract

Keep persisted `StudentInput` unchanged. Add a small, transient review object to each scan candidate:

```ts
type StudentNameOrder = "given-surname" | "surname-given" | "unknown"

interface StudentNameReview {
  raw: string                 // exact normalized OCR name text
  order: StudentNameOrder     // starts as unknown unless evidence is explicit
  orderConfidence: number     // 0 when unknown
  compoundAmbiguity: boolean  // multi-token split needs acknowledgement
  acknowledged: boolean
}
```

`StudentScanCandidate` can expose `nameReview?: StudentNameReview` first so existing provider fixtures remain source-compatible while the contract is introduced. `raw` is never rewritten when fields are corrected. `firstName` and `surname` remain the editable values eventually passed to `StudentInput`.

Use two pure operations rather than a large per-row radio group:

```ts
swapCandidateName(candidate): candidate
applyExplicitNameOrder(candidates, order, scope): candidates
```

`swapCandidateName` swaps the two editable fields, toggles `given-surname`/`surname-given`, preserves `raw`, date, phone and field confidence, and is its own accessible button: `Scambia nome e cognome`. For a compound-ambiguous candidate it must also leave `acknowledged` false until the operator confirms the resulting split.

`applyExplicitNameOrder` requires a caller-supplied order; there is no default. The UI should invoke it only after an explicit bulk choice (`Nome · Cognome` or `Cognome · Nome`) and offer a scope such as `righe ancora da decidere`. Already manually edited rows and compound-ambiguous rows are skipped unless the operator explicitly includes them. The operation preserves `raw` and marks the chosen order as an operator decision with confidence 100.

### Review readiness invariant

The candidate is not ready to insert when `nameReview?.compoundAmbiguity === true` and `acknowledged === false`, even if both editable fields are non-empty. The UI should show the short action `Conferma questa suddivisione` beside that row. After acknowledgement, normal required-field and confidence checks still apply. This prevents `De veltri Gregorio` or `Rumeria Claudia georgia` from being silently “cleaned up” by a token-count guess.

### Focused test matrix

**Capability/domain tests**

- Preserve the complete raw string for `Veldoro Valeria`, `De veltri Gregorio` and `Rumeria Claudia georgia`.
- Parse or retain both given-first and surname-first candidates without assuming the first token is the given name.
- Mark multi-token name splits as compound ambiguous when the boundary is not evidenced by a header/column mapping.
- `swapCandidateName` is reversible after two calls and never changes raw text, date, phone or source region.
- No bulk operation occurs for `unknown` or a missing order; an explicit `surname-given` choice changes only its selected scope.
- Bulk application skips acknowledged/manual rows according to scope and does not turn ambiguous rows into ready rows.
- Readiness remains false until compound acknowledgement and all ordinary mandatory fields are valid.

**Component tests**

- Initial review exposes raw OCR text and an `Ordine da decidere` cue without preselecting either convention.
- The compact `Scambia nome e cognome` action swaps the displayed fields and updates the order text while raw OCR remains visible.
- The bulk choice is an explicit action and leaves mixed or ambiguous rows for per-row review.
- The compound acknowledgement action is required; attempting `Aggiungi` identifies the exact row and does not call persistence.
- Manual edits keep raw OCR text as comparison evidence and mark only the edited field as operator-corrected.
- Source snippet opens and returns focus to the row; save failure preserves all edits and order decisions.
- At 320/390/430 px and 200% text, row controls remain reachable, have 40–48 px hit areas, and do not create horizontal overflow.

**Browser/evidence journeys**

- Upload a deterministic mixed-order fixture, adjust the image, verify no auto-commit, choose order for one row, swap another, acknowledge a compound split, remove a false row, then persist only after all required rows are ready.
- Reload after persistence and verify first/surname values, not just the display string.
- Run the two supplied JPGs as poor-image evidence. Record whether the provider rejects them or yields partial rows; never use them to claim OCR accuracy or silently save guessed names.
