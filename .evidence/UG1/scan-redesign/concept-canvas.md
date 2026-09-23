# Scan allievi — concept canvas for the image adjustment surface

Status: design proposal for UG1 implementation/review. This file records the
direction I recommend to the main agent and the Luna implementation/review
agents. It does not change application code or product rules.

## Decision in one sentence

Use a full-frame, dark `Raddrizza e ritaglia` stage with the sheet as the only
dominant object, a direct rotation ring/handle around the crop (plus coarse
buttons), and a free crop rectangle with four corners **and four edge handles**;
remove the range slider completely. Keep the exact angle in a compact
accessible stepper so direct manipulation has a keyboard/screen-reader
equivalent.

The visual language should remain CVC Helper: neutral ink, one blue action,
orange only as a small orientation cue, and no decorative gradients or generic
dashboard cards.

## Evidence inspected

- `src/features/students/StudentScanImageEditor.tsx`: current full-screen dialog,
  four corner crop handles, 90-degree buttons and a `-180..180` range slider.
- `src/features/students/studentImageCrop.ts`: normalized axis-aligned crop,
  arbitrary canvas rotation and a 0.16 minimum crop dimension.
- `src/features/students/StudentScan.tsx`: acquisition → image adjustment →
  OCR → mandatory review; only the prepared Blob is passed forward.
- `docs/post-mvp/07_PAGE_CHANGELOG.md` P06 and `04_IMPLEMENTATION_PLAN.md` U04 /
  UG1: gallery/camera, full-screen adjustment, free rotation, crop, conservative
  extraction, human review, no source-photo retention.
- `docs/post-mvp/06_DESIGN_RULEBOOK.md`: 40–44 px touch targets, no horizontal
  overflow, no color-only meaning, direct choices, sticky state only when it
  carries operational context, and explicit equivalents for advanced gestures.
- `IMG-20260809-WA0011.jpg` (1920×1080): a complete photographed sheet in
  perspective. The useful student table is the left block; the attendance grid
  and staff rows occupy large distracting areas. It has glare/shadows, curved
  paper edges and hand-written marks.
- `IMG-20260809-WA0011copy.jpg`: a tighter crop with the left index column partly
  clipped; rows, phones and birth-date strings are readable. It demonstrates
  that a crop must retain the complete name column plus phone and birth-date
  columns while allowing the irrelevant right grid to disappear.
- `.evidence/UG1/p06-editor-final.png` and the current browser baseline: the
  original 16:9 sheet is rendered as a small image with a large dead dark area;
  the 9,999 px outside-crop shadow dims the surrounding toolbar and footer; the
  crop handles become visually oversized at 200% text; and the top-right crop
  icon does not explain its reset action. The redesign must give the source
  image the stage, use a clipped mask that ends at the stage boundary, and keep
  controls at normal ink/white contrast.

The supplied sheets visibly show names such as `Veldoro Valeria`,
`Rumeria Claudia georgia`, `De veltri Gregorio` and `De veltri Teodoro`. The source
column is not a reliable signal that the first token is a first name. OCR and
review must preserve separate `firstName` and `surname` fields, expose both
labels, and let the reviewer swap/repair them. Never infer the storage order
from the visual order of a printed line. Display order remains a separate
presentation choice.

## Three candidate directions

### A — Compass crop stage (recommended)

The image fills the center of a dark, edge-to-edge modal. A white crop rectangle
and 3×3 grid identify the extraction area. A small rotation ring sits just
outside the crop: drag the ring around the crop center to straighten. A thin
orange baseline appears while the ring is active. A two-finger twist on the
image is an equivalent touch shortcut. The bottom dock contains `Raddrizza`,
`Ritaglia`, quarter-turn buttons, `Ripristina`, and the primary `Usa questa
area` action; it never contains a slider.

Strengths: one large visual target; the angle is changed where the user is
already looking; the 90° correction remains one tap; crop and straighten stay
separate in the user's mind; works well with the perspective-heavy first photo.

Cost: requires careful pointer math and an explicit keyboard model; the ring
must not be mistaken for another crop handle.

### B — Edge-mounted straighten handle

Show a circular handle on the upper edge of the crop. Drag left/right to rotate;
the image rotates around its center and the crop stays stable. Crop edges are
resized with edge/corner handles.

Strengths: simpler to discover and implement than a full ring; one-finger
friendly on a phone.

Cost: a horizontal drag feels like a slider in disguise, and the upper handle
collides with the top rows of a portrait sheet. It does not communicate an
angle as clearly as a radial gesture.

### C — Two-mode photo canvas

`Raddrizza` mode shows a horizon guide and angle control; `Ritaglia` mode
replaces it with a crop overlay. The stage remains full-frame and the bottom
primary action is shared.

Strengths: cleanest mental separation and fewer simultaneous handles; good for
users who struggle with dense editing surfaces.

Cost: a mode switch hides a capability, adds a state change, and makes it easy
to forget to crop after straightening. It is a useful fallback if field testing
shows the combined ring is too busy, but it should not be the first build.

### Recommendation

Build A. Keep B's edge handle as a fallback only if the ring is not discoverable
in a field review. Do not ship both ring and edge handle simultaneously: two
rotation affordances make the small image stage ambiguous.

## Proposed surface

### Large phone / tablet (390–430 px wide)

```
┌────────────────────────────────────┐
│  ×        Raddrizza e ritaglia  ↺  │  56 px top bar
│     Foto · area da leggere         │
│                                    │
│       [ dark stage / full sheet ]  │  fills available height
│       ╔══════════════════════╗     │
│       ║  Name | Phone | DOB  ║     │  crop + 3×3 grid
│       ╚══════════════════════╝     │
│             ◌ rotate ring          │
│                                    │
│ [−90] [Raddrizza  −7°  +90] [↺]   │  48 px controls
│  Drag the ring to level the rows   │
│  Drag corners/edges to crop         │
│  [       Usa questa area       ]    │  sticky, safe-area aware
└────────────────────────────────────┘
```

The crop rectangle is initially inset 4% on each side, as today, but a future
detector may suggest a paper/table region only when confidence is sufficient.
Never auto-commit a detector result. Use a low-contrast guide only; the darkened
outside region must remain visible enough to recover an accidentally tight crop.
The mask is clipped to the stage (`overflow: hidden` on the stage layer), never
implemented as a page-wide `box-shadow: 0 0 0 9999px`; toolbar, angle readout and
primary action must stay bright and readable.

On a 320 px stress viewport, controls wrap into two rows. The stage remains the
largest region and the action label is allowed to wrap. The angle chip may move
between the quarter-turn buttons, but the target rectangles remain at least
40×40 px and the full image never causes page-level horizontal scrolling.

### Desktop / wide viewport

Use a two-column dialog: stage on the left (minimum 520 px, maximum 70vw) and a
compact control rail on the right (280–320 px). The same controls and labels are
used; the rail is not a second card-heavy dashboard. On a narrow window collapse
back to the phone layout. No interaction is only available in the rail.

## Interaction contract

### Rotation: direct, arbitrary, no slider

1. The crop center is the rotation pivot. The ring hit area is a 48 px circular
   target centered just outside the crop's top-right quadrant, with a visible
   arc and a rotate icon.
2. On `pointerdown`, record the pointer vector from crop center to pointer.
   During `pointermove`, set `rotation = startRotation + deltaAngle`, where
   `deltaAngle` is the signed difference between the current and initial vector.
   Normalize to `[-180, 180]`. Keep the crop model normalized to the rotated
   canvas; do not rotate the crop box itself.
3. Capture the pointer and update preview at most once per animation frame. A
   preview request carries a sequence number; stale `createStudentScanPreview`
   results are revoked and discarded. Do not render a full 2,600 px output on
   every movement.
4. While active, show a live `output` such as `−7°` and a thin orange horizon
   guide through the crop center. At `0°`, the guide becomes blue/neutral. The
   angle is never conveyed by colour alone.
5. A two-finger twist on the stage updates the same angle state. It is a
   shortcut, not the only path. Pinch zoom/pan may be added only if it can be
   kept independent from the crop drag; do not let a second finger accidentally
   move the crop.
6. Coarse buttons use full labels and 48 px targets: `Ruota 90° a sinistra`,
   `Ruota 90° a destra`, and `Ripristina`. These call the same angle state and
   keep arbitrary fine adjustment intact.

Keyboard/assistive equivalent:

- Prefer an actual `spinbutton` angle field with increment/decrement buttons as
  the accessible equivalent; it is compact, says `Angolo`, and is not a visual
  slider. The rendered UI must contain no `input[type="range"]`. If a slider role
  is chosen for the ring's keyboard model, implement the complete
  `aria-valuemin="-180"`, `aria-valuemax="180"`, `aria-valuenow` contract and
  test it with assistive technology; do not leave keyboard users with only the
  gesture.
- Arrow keys change 1°, Shift+Arrow changes 5°, Home sets 0°, and PageUp/PageDown
  turn 90°. Announce the live angle in a polite status region.
- `Tab` order: close → rotation handle/angle → −90° → +90° → reset → crop
  rectangle → crop handles → use area. Escape cancels without losing the source.

### Crop: free rectangle with stable handles

- The crop is axis-aligned after the rotated image is rendered. Keep the current
  normalized representation and min dimension, but add north/south/east/west
  edge handles in addition to the four corners. A visible 3×3 grid appears only
  while the crop is touched or focused; it reduces clutter at rest.
- Every handle has a 44–48 px transparent hit area and a 2 px white visual mark.
  Handles at the stage edge must remain reachable; use internal offsets rather
  than negative positioning that clips at 320 px.
- Drag the interior to move the crop. Dragging a corner resizes in two axes;
  dragging an edge resizes one axis. Preserve free aspect ratio by default; do
  not force a portrait/landscape preset because the printed sheet varies.
- The image itself supports pinch-to-zoom and pan **behind** the crop window.
  Keep the crop window stable while zooming so the user can enlarge the tiny
  student rows in the full sheet without losing the crop geometry. On desktop,
  wheel with Ctrl (or a dedicated `+`/`−` pair) zooms; drag outside the crop
  pans the image. Expose `Zoom 100%`, `Adatta`, `+` and `−` buttons as a visible
  and keyboard-accessible equivalent. Clamp zoom so the crop window is always
  covered; never reveal checkerboard/black canvas.
- Arrow keys on the crop group move by 1%; Shift+Arrow by 5%. Arrow keys on a
  focused handle resize by the same increments. `Home`/`End` are intentionally
  not destructive crop shortcuts.
- Keep crop inside the rendered image. If a rotation leaves transparent corners,
  render white and constrain to the rotated canvas bounds so the OCR input has
  no black wedges.
- Do not add perspective/keystone correction in this change. The photo has
  projective distortion, but a four-corner quadrilateral introduces a different
  transform and a much larger correctness surface. The crop/straighten tool
  should leave that for a later, measured OCR improvement.

### Confirmation and recovery

- `Usa questa area` is the only commit-to-OCR action. It stays in a bottom safe
  area and never covers crop handles or the last image row.
- Show `Preparo l'area…` while the output Blob is being generated; disable all
  mutating controls. Preserve the current angle/crop if preparation fails and
  show `Non riesco a preparare questa foto. Riprova.` with a retry path.
- `×` cancels the adjustment and returns focus to the camera/gallery trigger.
  If edits have begun, the close action should say `Annulla regolazioni` and
  confirm only where the platform's photo-editing convention warrants it. A
  single accidental close before any change can remain immediate.
- The source File/Blob remains transient. Revoke preview URLs on replacement,
  cancellation and unmount. Only the prepared Blob proceeds to OCR.

## Names, cognomi and review affordance

The crop editor should not promise to infer the name order. Add a short, quiet
hint under the primary action or in the review intro:

> `Controlla sempre Nome e Cognome: il foglio può usare qualsiasi ordine.`

In the review card, keep fields explicitly labelled `Nome` and `Cognome`, even
when the source row is a single string. Provide a compact `Scambia` action (or
editable fields with clear labels) so `Veldoro Valeria` can become surname
`Veldoro`, first name `Valeria` when appropriate, while another sheet using
`Valeria Veldoro` is also representable. The sort/display formatter must consume
the structured fields and never use the crop's visual token order as a rule.

The crop guide should label columns only as optional, non-binding hints: `Nome ·
Cognome`, `Telefono (se presente)`, `Data di nascita`. These labels must not be
burned onto the image or interpreted as OCR data.

## Implementation slices for Luna

1. **Geometry slice (Luna high):** extend the normalized crop gesture model with
   four edge gestures and a pure `rotationFromPointer` helper. Add exhaustive
   boundary tests for angle wraparound, crop movement at 0/1, minimum dimensions,
   and rotation-preview dimensions.
2. **Stage slice (Luna high/xhigh):** replace the range-slider row with the
   rotation ring, quarter-turn buttons, direct angle semantics and the crop grid.
   Keep `prepareStudentScanImage(file, rotation, crop)` as the persistence
   boundary unless a measured need requires a domain change.
3. **Responsive/a11y slice (Luna high):** implement stage/rail layouts at
   430×820, 390×664, 412×760 and 320 px with 200% text. Verify target boxes,
   focus order, live angle announcement, Escape, and no horizontal overflow.
4. **Real-photo slice (Luna xhigh):** manually exercise both supplied images.
   The first should allow an operator to remove the attendance grid and staff
   rows while retaining student names, phone and birth date; the second should
   show that a tight crop can be widened to recover clipped context. Treat glare,
   skew and handwritten marks as recovery/low-confidence cases, not as reasons
   to invent fields.
5. **Review slice (Luna high):** adversarially test mixed name orders,
   `De veltri`/multi-token surnames, lowercase names, duplicate-looking names,
   missing phones and staff rows. Verify no false personnel row is committed and
   fields remain independently editable.
6. **Integration reviewer (Luna xhigh):** inspect a fresh browser screenshot and
   run the actual gallery/camera → direct rotation → crop → OCR → mandatory
   review → commit/reload journey. Return structured PASS,
   PASS_WITH_FINDINGS or FAIL with blockers and evidence paths.

## Acceptance checklist

- [ ] No visible range slider remains in the adjustment surface.
- [ ] Direct one-finger rotation is discoverable, arbitrary and smooth enough on
      a phone; ±90° controls still work.
- [ ] Keyboard/assistive equivalent adjusts angle without a pointer gesture.
- [ ] Crop can move, resize by all four edges and all four corners, and stays
      within the rotated image.
- [ ] All repeated controls have 40 px minimum / 44 px preferred hit areas;
      handles are not clipped at 320 px.
- [ ] Angle, crop and preparation error states are honest and recoverable.
- [ ] 320/390/412/430 layouts have no page or internal horizontal overflow.
- [ ] Supplied full sheet can be framed to the student table without losing the
      name, phone or birth-date columns; the tight crop can be widened.
- [ ] Review keeps `Nome` and `Cognome` separate and editable; no token-order
      assumption is introduced.
- [ ] OCR source photo remains transient; prepared output only proceeds.
- [ ] Existing U04 OCR, mandatory review, retry and persistence checks remain
      green; new browser evidence records the actual image paths/fixture names,
      viewport and browser.

## Research references

The direct manipulation and modal confirmation pattern is consistent with
[Apple's Photo Editing guidance](https://developer.apple.com/design/human-interface-guidelines/photo-editing)
(edit in a modal surface, retain an explicit cancel/confirm path) and its
[gesture guidance](https://developer.apple.com/design/human-interface-guidelines/gestures/)
(familiar rotation gestures should be supported, with accessible alternatives).
These are interaction references, not brand or product requirements. The CVC
Helper rulebook and product specification remain authoritative.
