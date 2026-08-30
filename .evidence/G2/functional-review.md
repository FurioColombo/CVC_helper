# G2 functional review

**Verdict:** PASS

## Blockers

None.

## Findings and remediation

- Course-safe deletion was strengthened: `deleteBoat` now verifies `boatId + courseId` ownership before any fault/history mutation, with a wrong-course regression test.
- The browser journey now proves unavailable state and mistaken-boat deletion persist across reload, then re-enables the boat and confirms the remaining open fault restores the derived warning state.
- Timestamp invariants now require canonical ISO output and reject merely parseable non-ISO values.

No functional findings remain.

## Evidence inspected

- Authoritative M6/G2 rules and commit `d5383a2`.
- Canonical rules, persistence, invariants, UI integration and boat/fault tests.
- Focused verification: 4 files / 28 tests PASS.
- G2 Playwright scenario: Pixel 7 and iPhone 13 PASS, 2/2.
- `git diff --check`: PASS.
