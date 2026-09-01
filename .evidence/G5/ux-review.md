# G5 field UX review

Verdict: **PASS_WITH_FINDINGS**

## Blockers

None.

## Important findings

None. The initial review's important findings were resolved: surname-based
ordering is now visually explained, missing sessions appear explicitly in
student history, and the active session remains sticky during long entry
lists.

## QoL findings

- The overview detail button's accessible name uses the compact display name;
  screen readers do not announce the visible surname separately.
- Each overview timeline remains an independent horizontal scroller.
- Opening a student from Riepilogo lands at the top of general detail rather
  than directly at evaluation history.
- An unsaved note draft can be discarded by navigating before `Salva nota`.
- A small `— = mancante` legend could further reduce outdoor ambiguity.
- Full-page screenshots stitch the fixed bottom navigation into the page;
  runtime behavior is unaffected.

These are non-blocking hardening candidates for M14.

## Evidence inspected

- Updated evaluation management, overview and student-history UI and tests.
- Revised G5 browser journey and refreshed iPhone screenshot.
- Current G5 diff after functional and UX fixes.

