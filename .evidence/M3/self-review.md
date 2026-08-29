# M3 self-review

**Verdict:** PASS

## Blockers

None.

## Important findings

- Student knowledge is course-scoped and persisted in the existing local SQLite store. Size saves immediately; the optional note uses a short debounce and flushes on blur or unmount.
- Size options are derived from the canonical `XS`, `S`, `M`, `L`, `XL` table. The invariant checker rejects any persisted size outside that set.
- All students remain visible in one compact view, including unavailable students in a subdued state. Detail view exposes the saved size and initial note.
- Local Italian transcription uses quantized `onnx-community/whisper-tiny` behind a provider-independent `transcribeAudio(audio)` boundary. The transcript remains an editable draft and is not persisted until explicit confirmation; recorded audio is discarded after transcription.
- The speech runtime is dynamically loaded. Its large ONNX WASM asset is excluded from PWA precache and cached on first use, avoiding a 24 MB application-install download while preserving subsequent offline reuse.
- The secondary student menu exposes manual add and Conoscenza; Conoscenza is disabled when there are no students. Camera scanning remains visibly unavailable until M4.

## Quality-of-life findings

- Save state is visible per student as `Salvataggio…`, `Salvato`, or `Non salvato`.
- The note clearly states that an empty value means no special information. Voice failure leaves manual typing available and allows a retry.
- Voice, select, back, and bottom-navigation controls preserve mobile touch targets. Labels and action names identify the relevant student.

## Evidence inspected

- `npm run verify:quick`: 9 test files and 33 tests passed, including autosave, persistence, canonical sizes, and the editable/uncommitted transcription-review flow.
- `npm run verify:domain`: repository structure, canonical tables, and runtime foundation scenario passed.
- `npm run build`: production PWA build passed with the speech runtime handled by first-use runtime caching.
- `npm run verify:e2e`: 8 journeys passed across Pixel 7 (412 × 915) and iPhone 13 (390 × 844). The M3 journey verifies the visible dictation action, autosave, detail rendering, reload, and restored values.
- `npm audit`: zero known dependency vulnerabilities after explicit transitive overrides.
- In-app browser inspection at 390 × 844 verified two populated student cards, no horizontal overflow (`scrollWidth = clientWidth = 390`), readable labels, 44 px controls, and unobscured bottom navigation. The iPhone viewport remains active for the user preview.
- `git diff --check` passed, and the M3 diff was reviewed for data scoping, stale-save races, cleanup, transcript confirmation, accessibility, mobile density, and scope.

## Scope review

No scanner implementation, backend transcription service, account/synchronization layer, automatic crew logic, or other post-MVP behavior was added. The camera import stays in M4. Audio is neither persisted nor uploaded.

## Known limitations

- The first dictation requires downloading and caching the quantized Whisper model and speech runtime; this can take noticeable time on a slow connection. Later use can reuse the browser caches.
- Automated coverage exercises the microphone/media boundary with a deterministic fake and the actual UI with Pixel/iPhone viewports. Real-device microphone permission, Italian field recordings, adverse outdoor audio, and native WebKit remain final-device validation work for M14.
