# Implementation Plan

Keep every milestone small, runnable and reviewable. Do not build later milestones early.

## M0 — Technical spikes, app shell and persistence
Before substantive product UI:
- read the complete working set;
- run the bounded PowerSync local-only spike from Technical Decisions and use Dexie fallback if appropriate;
- run bounded feasibility spikes for local student scan/OCR and local Italian STT;
- record selected implementations and known limitations without expanding the spikes into open-ended research.

Then continue with the app shell and persistence work below.
- Minimal mobile-first PWA/web project.
- Simple persistent local storage.
- Bottom nav: Avarie / Home / Equipaggi.
- Home shell/cards.
- Verify persistence across reload/reopen.

## M1 — Course
- First-run course setup: Deriva/Cabinato, level 1–5, dates, ISO week/year, generated label.
- Explicit confirmation only for this batch setup.
- Show course/week identity on Home.

## M2 — Students and volunteers
- Student CRUD, DOB→age, sex, phone, display-name rule, minors.
- Disable/re-enable with history preserved.
- Volontari: name + ADV/IS.
- Tap in Gestione Allievi opens detail.
- Routine autosave.

## M3 — Conoscenza allievi
- XS–XL size.
- Initial note.
- Italian voice transcription where specified; discard audio.
- Incremental autosave.

## M4 — Scan/import
- Image/screenshot input and extraction.
- Per-field confidence.
- Review/correct/delete rows.
- Explicit final commit.
- Retake guidance for unusable input.

## M5 — Boats and Avarie
- Typed boat numbers.
- Available/unavailable and mistaken-entry deletion.
- Multiple faults with Aperta/Comunicata/Risolta.
- Green only when all resolved; yellow unresolved; grey unavailable.
- Avarie tab shows all course boats, problems prominent.
- Both add-fault flows: from boat detail and `+ Avaria`.
- Italian voice transcription for fault text.

## M6 — Comandate
- Saturday–Friday rotations.
- Manual editing.
- Even automatic proposal with defined priorities.
- Friday stay-over handling.
- Red/yellow warnings and yellow acknowledgement.
- `Ricalcola comandate rimanenti`; completed rotations immutable to recalculation.
- Manual override remains possible.

## M7 — Equipaggi core
- Session creation and previous crew-count suggestion with +/-.
- Available-student pool + separate Staff/Volontari pool.
- Empty crew cards/slots.
- Tap select → tap slot move; assigned person disappears from pool.
- Tap another assigned person swaps.
- Remove returns to pool.
- Long press student opens detail.
- Individual A terra placement.
- D1 morning duty-not-A-terra red warning.
- Unassigned active people remain obvious.

## M8 — Verification
- Exact size-warning table.
- Pair repetition and 3+ internal-pair rules.
- One worst-severity triangle per crew; tap for details.
- Manual freedom except genuine exclusivity constraints.

## M9 — Crew destinations
- Default `Non assegnato`.
- Select sailing boats going out.
- Optional copy previous boat set.
- Tap crew → tap sailing boat/Mezzi.
- One sailing boat per crew/session exclusivity.
- Easy reassignment.
- Unavailable already-assigned boat = red warning, no automatic change.

## M10 — Copy previous + read mode
- Secondary `Copia equipaggi sessione precedente`.
- Adapt to current state; preserve structure and leave gaps.
- Post-action summary only when automatic removals/relocations occurred.
- Dedicated clean announcement/read view.
- Works with exact boat, type-only, or no boat.
- Wake lock only if simple/progressive.

## M11 — Valutazioni
- ++ / + / = / - / -- / missing.
- Per-evaluation note and Italian voice transcription.
- A-terra student remains present, missing by default, with reminder.
- Autosave.

## M12 — Overview and student history
- Compact chronological trend, note indicator, count of actual evaluations.
- No visible numeric score.
- Tap student → detailed chronological history with session identity and notes.
- Use simplest readable mobile geometry.

## M13 — UX/persistence hardening
- Verify all routine edits autosave.
- Verify close/reopen loses no data.
- Review touch targets/outdoor readability.
- Remove unnecessary typing, confirmations and clutter.
- Verify disabled/history/warnings/navigation.

## M14 — MVP validation
Testing is a quality/implementation phase, not a product requirement.
- Generate realistic fictitious course data.
- Add focused deterministic tests for business rules and persistence.
- Run focused reviewer/agent passes against the current Product Specification.
- Run multiple independent simulated-week reviews with different focuses: rule correctness, field UX, and holistic workflow.
- Include representative edge cases already defined in the product rules.
- Fix MVP-blocking findings before completion.

## Explicitly after MVP
Multi-device sync/sharing; image exports; documents/reference materials; Home dashboard; automatic crew generation; rich archive/locking; platform-specific brightness/native features.
