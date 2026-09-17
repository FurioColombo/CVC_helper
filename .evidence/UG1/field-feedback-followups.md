# UG1 field feedback — open points

Human feedback received 2026-09-18, before closing UG1. Recorded here rather than
in `04_IMPLEMENTATION_PLAN.md` because that file currently carries unrelated
work in progress. Fold these into the plan when the scan redesign settles.

## 1. Dictation failed on PC Chrome — fixed

`onnxruntime-web` 1.26, pinned as a pre-release by `@huggingface/transformers`,
cannot build any Whisper decoder session. The microphone was never involved.
Pinned to 1.30.0 and guarded in `scripts/check-repository.mjs`.
See `speech-runtime-fix.json`. Still needs the physical-device pass.

## 2. OCR read the age column and the staff block as students — improved

The parser discarded word coordinates and hunted fields inside a flattened row.
Now the columns are recovered from geometry. The full sheet went from 26
candidates to exactly the 20 students. See `ocr-column-extraction.json`.

Open, in order of impact:

- **Name order is still assumed.** The roster is surname-first; the parser still
  treats the first token as the given name. The explicit review choice is the
  active work in progress.
- **The confidence gate hides text that was read correctly.** A field read below
  `MIN_FIELD_CONFIDENCE` (70) is blanked, so `Altomare Valeria` reaches review as
  half a name. On a screen whose entire purpose is human confirmation this is
  probably the wrong trade: showing a low-confidence reading marked for
  attention beats showing nothing. This is now the largest single cause of
  half-empty rows (11 of 20 rows carry both names on the cropped photo, 4 of 20
  on the full sheet). Changing it is a product decision, not a bug fix.
- **Row fragmentation** still yields two extra rows on the cropped photo.
- **No automated test uses a real photograph.** The diagnostic is run by hand
  against images that must never enter the repository.

## 3. Colour palette — the accent is invented, not from the brand

Measured from the shipped mark `public/brand/cvc-symbol.png`:

| Role | Brand mark | App token | Match |
| --- | --- | --- | --- |
| Warm accent | `#e04040` red | `--accent-orange: #e08042` | no; the mark has no orange |
| Blue | `#3060a0` | `--primary: #204c8c` | close, not equal |
| Icon / theme | — | `#063b52` in `cvc-helper.svg` and `theme-color` | a third, unrelated blue |

So the Home card accent is an invented orange, the brand's own warm colour is
red, and three unrelated blues are in use. The feedback asks for a real palette
derived from the mark. That is a design change across P01–P19 tokens, not a
local edit, and it needs a scope decision before implementation.

## 4. Why the mock's icons and imagery were not used

This was a recorded decision, not an oversight.

- `02_MVP_SCOPE.md` section 4 defers "final product name, derived CVC/EXE/Helper
  brand mark and a broad custom icon programme" out of 0.2.0.
- `02_MVP_SCOPE.md` section 5 treats the boat logos supplied during design as
  references without proven licence, and prescribes the neutral text/model
  fallback that is implemented.

`docs/post-mvp/mockups/assets/` therefore still holds boat imagery and
`logo-fcvc.avif` that the application deliberately does not ship. Reversing this
requires an explicit human scope change plus a licence answer for the boat
imagery, per `AGENTS.md` section 15.

## 5. Scan and reframe editor

Full-screen editor with no slider, direct crop and straightening: active work in
progress from the 2026-09-16 correction. Unchanged by the parsing fix above.
