# G5 functional review

Verdict: **PASS**

## Blockers

None.

## Important findings

- Resolved during review: Riepilogo could previously open while an evaluation
  save was pending and remain stale. View switching is now blocked until saves
  finish, with a delayed-save regression test.
- The strengthened browser scenario distinguishes mean from sum: Bea's two
  marks average above Aldo's three marks despite equal sums, and the expected
  strongest ordering proves mean-based aggregation.
- The browser scenario evaluates Carlo directly while he is `A terra`, while
  Dina remains missing in another `A terra` session. This proves both the
  default missing state and manual evaluability.
- Past editing is persisted and visible in exact student history; notes remain
  attached to their student/session; missing marks are excluded from counts;
  normal crews and `A terra` groupings share the same evaluation records.

## QoL findings

None.

## Evidence inspected

- `AGENTS.md` and authoritative product, scope, technical, and implementation
  rules.
- The G5 browser journey, evaluation domain, persistence, invariants,
  management UI, overview, student history, crew persistence and navigation.
- Refreshed iPhone G5 screenshot.
- Focused evaluation, overview, management, history and invariant tests.

