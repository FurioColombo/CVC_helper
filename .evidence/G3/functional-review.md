# G3 functional review

## Verdict

PASS

## Blockers

None.

## Important findings

None remaining. The initial evidence gap was fixed by making the browser
journey assert every critical transition rather than merely perform it.

The final journey proves:

- 21 students created through the UI;
- five stay-over students configured and exactly three assigned to Friday;
- a manual Friday override with a known non-stay-over already assigned
  elsewhere, producing real anomalies;
- explicit advisory acknowledgement;
- immutable three-person completed Saturday history;
- a dynamically selected Wednesday student disabled through the UI;
- recalculation removes that student from every future day, restores zero
  warnings and fills Friday with exactly three stay-overs;
- all health, exclusion, Friday-capacity and completed-history assertions still
  hold after reload.

## QoL findings

- Native iPhone behavior remains covered by the dedicated M14 gate; G3 uses
  Chromium with the iPhone 13 device profile.

## Evidence inspected

- Product Spec section 7, resolved v0.5 decisions, MVP scope and G3 criteria.
- M7 checkpoint `5d7cad3` and its verification/domain-review evidence.
- Strengthened 21-student Playwright journey and G3 screenshot.
- Pixel 7 and iPhone 13 focused journey: 2/2 PASS.
- Official G3 verification: 21 files / 122 tests, repository/domain checks,
  production build and 18 E2E journeys PASS.
- Read-only exact-scenario domain simulation and `git diff --check` PASS.
