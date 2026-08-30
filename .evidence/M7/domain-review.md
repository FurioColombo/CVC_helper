# M7 adversarial domain review

## Verdict

PASS

## Blockers

None remaining.

## Important findings

None remaining. The adversarial review found and verified remediation of:

- assignment-order defects that could let alphabetical order defeat minor or
  optional M/F balancing;
- uneven-capacity and Friday-subset cases requiring deterministic balance
  optimization without reducing Friday stay-over coverage;
- missing manual-from-empty and completed-empty-history workflows;
- false Friday satisfaction by an ineligible disabled student and missing
  repeated-duty warnings for disabled students;
- unstable advisory acknowledgement lifecycle across manual edits and
  recalculation;
- fractional daily-count persistence that could fail on reload;
- ambiguous/internal warning copy and untested similar-age tie-breaking.

All blocking findings were fixed and covered by focused regressions. The final
implementation retains acknowledgements only for advisory keys active in the
new state: unchanged situations remain hidden, while disappeared and recurring
situations are shown again.

## QoL findings

- Optional defense-in-depth: persistence could reject invalid day/student
  references before writing instead of relying on typed UI paths and the
  invariant check on read. Current behavior detects persisted corruption and
  this is not an M7 acceptance gap.

## Evidence inspected

- `01_PRODUCT_SPEC.md` section 7 and resolved v0.5 Comandate decisions.
- `02_MVP_SCOPE.md` manual/automatic duty scope.
- M7 implementation, persistence, invariant checks, UI and browser journey.
- Deterministic capacity, Friday, completed-history, manual-override, warning,
  acknowledgement, integer-input and tie-break tests.
- Bounded exhaustive 845-combination minor/adult and M/F matrix for 8- and
  14-student courses.
- Official verification: 21 test files / 119 tests, repository/domain checks,
  production build and 18 Pixel 7/iPhone 13 E2E journeys PASS.
- Focused final DutyManagement/domain tests: 27/27 PASS.
- `.evidence/M7/duties-iphone13.png`.
- `git diff --check`: PASS.
