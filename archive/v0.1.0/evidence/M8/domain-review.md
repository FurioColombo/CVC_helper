# M8 adversarial domain review

## Verdict

PASS

## Blockers

None.

## Important findings

None remaining. The review initially found a concurrent-save/session-switch
race, repeated mobile scrolling during composition, and loss of a non-default
session after opening student detail. All were fixed and re-reviewed.

## QoL findings

None requiring M8 follow-up.

## Evidence inspected

- Product Specification sections 8.1–8.6 and 8.11, MVP boundaries, and M8
  acceptance criteria.
- Canonical fixed sizes, flexible even targets, move/swap/remove, A terra, and
  completeness domain tests.
- Atomic persistence, explicit contiguous crew/member positions, and session
  invariants.
- Delayed-save regression proving mutation and session controls cannot race.
- Non-default `wed-pm` student-detail return regression.
- Fixed mobile selected-person tray with direct crew/A-terra shortcuts and
  `.evidence/M8/crew-shortcuts-iphone13.png`.
- Final verification: 24 test files / 145 tests, domain and repository checks,
  production build, and 20 Pixel 7/iPhone 13 E2E journeys all PASS.
- No M9–M11 or post-MVP behavior leaked into M8.
