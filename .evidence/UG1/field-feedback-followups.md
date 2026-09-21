# UG1 field feedback — what became of it

Human feedback received 2026-09-18, before closing UG1. Rewritten 2026-09-21 at
the owner's request (`docs/post-mvp/0_3_0_OWNER_BRIEF.md` section 1.4) against
what actually shipped, rather than left as the open list it was on the day.

Four of the five points are closed. The two that are not are deferred past
0.3.0 by the owner's own decision, and they are carried in
`04_IMPLEMENTATION_PLAN.md` under the 0.3.0 traceability table so they cannot
quietly disappear.

## 1. Dictation failed on PC Chrome — closed

`onnxruntime-web` 1.26, pinned as a pre-release by `@huggingface/transformers`,
cannot build any Whisper decoder session. The microphone was never involved.
Pinned to 1.30.0 and guarded in `scripts/check-repository.mjs`, which now
refuses any version in the broken 1.26–1.29 range. See `speech-runtime-fix.json`.

The physical microphone pass is still outstanding, but it is no longer this
list's business: the owner moved it to UG2 on 2026-09-21, because it needs a
trusted HTTPS origin the app does not have yet.

## 2. OCR read the age column and the staff block as students — closed, two
follow-ups deferred

The parser discarded word coordinates and hunted fields inside a flattened row.
Columns are now recovered from geometry: the full sheet went from 26 candidates
to exactly the 20 students, and the staff block and weekday heading are rejected.
See `ocr-column-extraction.json`.

Two of the four gaps that entry listed are closed:

- **Name order is no longer assumed.** The parser emits a name reading for every
  multi-word name, preserving the words as read with the order left `unknown`, so
  no row can claim the first token is a given name. The review screen gates
  readiness on that choice, offers a per-row swap, and a sheet-wide
  `Applica Nome · Cognome` / `Applica Cognome · Nome` that skips rows already
  corrected by hand. See `scan-name-order.json`.
- **The confidence gate no longer hides text that was read.** A field below
  `MIN_FIELD_CONFIDENCE` keeps its text and is marked for attention instead of
  being blanked, which is the right trade on a screen whose whole purpose is
  human confirmation. `needsReview` in `src/features/students/StudentScan.tsx`
  is the flag, and a person who has read the row overrules it, so the counter can
  actually reach zero on a real photograph.

Two remain open, and the owner deferred both past 0.3.0 on 2026-09-21
(_"la rimandiamo"_):

- **Row fragmentation.** The cropped photograph still yields two rows more than
  the roster contains. The cause is line splitting, not column confusion.
- **No automated test uses a real photograph.** The diagnostic is run by hand
  against images that must never enter the repository.

## 3. Colour palette — closed

The accent was invented rather than taken from the mark. Measured from
`public/brand/cvc-symbol.png`, whose two inks are `#e04040` red and `#3060a0`
blue:

| Role | Then | Now |
| --- | --- | --- |
| Warm accent | `--accent-orange: #e08042`, an orange the mark does not contain | `--accent-red: #cf3a35`, the mark's red darkened for contrast on the light background |
| Blue | `--primary: #204c8c`, close but not equal | `--primary` and `--accent-blue` are both `#2f5fa0`, so the interface carries one blue |
| Icon / theme | `#063b52`, a third unrelated blue | `#2f5fa0`, aligned 2026-09-21 across `cvc-helper.svg`, the three launcher PNGs, `theme-color` and `theme_color` |

## 4. The mock's boat imagery — closed

This was a recorded decision rather than an oversight: `02_MVP_SCOPE.md` section
5 treated the supplied boat logos as references without a proven licence, and the
neutral text/model fallback shipped in their place.

The owner authorised their use on 2026-09-18. The seven marks now ship in
`public/brand/boats/`, and `BoatModelMark` keeps the written model as the
fallback whenever an asset is missing or fails to decode, so a boat is always
identifiable. Provenance remains the owner's responsibility; nothing here
asserts a licence.

The final product name and the derived CVC/EXE/Helper brand mark stay deferred,
unchanged, and `logo-fcvc.avif` in the mock is still not shipped.

## 5. Scan and reframe editor — closed

The full-frame document workspace replaced the rotation slider on 2026-09-19:
direct crop, zoom with bounded panning, straightening from a line drawn along a
rule, quarter turns, tenth-of-a-degree steps and an exact angle. The Product
Specification paragraph and the code agree. See `scan-document-editor.json`.

Two details the owner asked for on 2026-09-21 are **not** in 0.2.0 and are
planned as V04: handles at the middle of each crop edge, and rotation that
follows the finger during the drag instead of after it.
