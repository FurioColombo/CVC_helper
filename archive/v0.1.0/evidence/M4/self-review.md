# M4 self-review

**Verdict:** PASS

## Blockers

None.

## Important findings

- The UI depends only on the provider-independent `scanStudents(image)` capability and structured candidates. Tesseract.js 7 and its Italian data remain confined to the local capability implementation.
- OCR processing, worker code, core runtime and Italian language data are local application assets. No roster image or extracted student data is uploaded to a service.
- Aggregate confidence below 60 rejects the source as unsuitable. At acceptable aggregate confidence, first name, surname, date of birth and phone retain independent confidence values; a field below 70 is blanked instead of presented as trustworthy.
- Human review is mandatory. Extracted rows stay transient until the user corrects required fields, chooses M/F/Altro, removes false rows if needed and explicitly confirms the batch.
- Confirmed rows are inserted through one SQLite `executeBatch`, which PowerSync wraps in a write transaction. Scan images are not persisted and their temporary object URL is released after extraction.
- Name-based sex inference is deliberately conservative: a small common-name set supplies only a convenience suggestion, and unknown names remain unselected for direct correction.

## Quality-of-life findings

- The empty state and secondary menu both expose scanning while preserving manual add.
- Unsuitable input clearly asks for a complete, focused, straight and glare-free replacement instead of exposing unreliable candidates.
- Each candidate card supports direct correction of every extracted field, one-tap M/F/Altro selection, and an individual 44 px remove action.
- On 390 × 844, date and phone share one compact row; the first candidate's required controls fit before the fixed navigation and the page has no horizontal overflow.

## Evidence inspected

- `npm run verify:quick`: 11 test files and 39 tests passed. Coverage includes field-level extraction, multi-word surnames, date normalization, cautious sex inference, low-confidence blanking, unsuitable input, review/correction/removal, explicit commit and atomic persistence.
- `npm run verify:domain`: repository structure, canonical tables and runtime foundation scenario passed.
- `npm run build`: production PWA build passed with local worker, Italian language and compatible OCR core variants emitted under `/ocr/` and first-use runtime caching configured.
- `npm run verify:e2e`: 10 journeys passed across Pixel 7 (412 × 915) and iPhone 13 (390 × 844). The M4 journey runs the real local OCR engine against `.evidence/M0/ocr-sheet-blurred.png` and `.evidence/M0/ocr-sheet-clear.png`, rejects the first, extracts three correct candidates from the second, edits and removes rows, commits two and verifies reload persistence.
- `.evidence/M4/review-iphone13.png` records the real three-row review result at the iPhone 13 viewport.
- In-app browser inspection at 390 × 844 verified the scan entry screen, camera/screenshot affordance, concise local-processing explanation, 44 px action and no horizontal overflow. The viewport remains fixed at the user's requested iPhone 13 dimensions.
- Dependency installation and audit reported zero known vulnerabilities. `git diff --check` passed, and the implementation was reviewed for provider isolation, confidence semantics, transient-image cleanup, batch integrity, error/empty states, mobile density and MVP scope.

## Scope review

No cloud OCR, upload storage, speech-based student creation, generic document system, authentication, synchronization or other post-MVP behavior was added. Manual student creation remains unchanged and available.

## Known limitations

- The retained realistic fixtures cover a clear screenshot and a blurred/cropped failure, not handwriting, glare, every camera angle or arbitrary roster layout. The review step remains the safety boundary for layout variability.
- The first scan loads about 5.5 MB of same-origin OCR worker/core/language assets and can therefore be slower. These assets are cached after first use; an installation taken fully offline before its first scan will not yet have that runtime cache.
- Pixel/iPhone viewport automation runs Chromium on the development host. Real-device camera capture, memory/thermal behavior and native WebKit remain M14 validation work.
