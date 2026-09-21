# M0 local OCR spike

## Scope

The spike used a synthetic but representative Italian course-roster screenshot
with names, dates of birth, and phone numbers. A second version was blurred and
cropped to represent an unsuitable source. The images are retained as
`ocr-sheet-clear.png` and `ocr-sheet-blurred.png`.

## Approaches evaluated

1. Tesseract.js 7 with the Italian model, running locally. It was exercised on
   both images rather than assessed only from documentation.
2. Chromium's experimental `TextDetector`. The pinned target Chromium reported
   it unavailable, so it cannot be the implementation baseline.
3. Browser transformer OCR. It was rejected for this milestone because its
   larger model/runtime cost does not improve the variable-table extraction
   workflow enough to justify replacing the simpler proven engine.

## Result

- Clear border-light roster: aggregate confidence 94; all three names, dates,
  and phone numbers were recovered correctly.
- Blurred/cropped roster: aggregate confidence 53; several names, dates, and
  phone digits were wrong.
- Heavily bordered tables performed materially worse during the bounded probe,
  so preprocessing and field-level confidence remain important.
- Machine-readable output: `ocr-spike-result.json`.

## Decision

Use Tesseract.js behind the provider-independent student-scan capability in M4.
Do not add it to the product bundle during M0. M4 must parse candidates,
calculate confidence per field, leave uncertain fields empty, flag unsuitable
images, and always require human review before commit.

## Known limitations

- The spike is a screenshot baseline, not a complete sample of camera blur,
  glare, rotation, handwriting, or arbitrary layouts.
- Target-phone performance and image preprocessing belong to M4's integration
  work and evidence.
- A single aggregate OCR confidence is not sufficient for product behavior;
  field-level confidence is mandatory.
