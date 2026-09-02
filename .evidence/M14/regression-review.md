# M14 regression review

## Verdict

PASS_WITH_FINDINGS

## Blockers

None.

## Important findings

- First-use OCR and speech assets require connectivity or prior caching. This is an accepted non-blocking limitation because manual student entry and typed notes remain available offline.

## Quality-of-life findings

- Add direct duration and movement-cancellation tests for long press; component coverage exercises `contextmenu`, while real WebKit proves ordinary taps no longer misfire.
- A future close/reopen scenario could retain a broader operational state. The representative course/student close/reopen journey plus feature-specific reload journeys is sufficient for M14.

## Evidence inspected

- Complete M14 application, persistence, PWA, dependency, CI and browser diff.
- Earlier WebKit fault and crew failure traces, their fixes and regression coverage.
- Eight successful real iPhone 13 WebKit core journeys.
- Chromium close/reopen persistence journeys, PWA manifest/icons/service worker and the built-PWA assertion.
- The cross-navigation focus-origin finding, its scoped fix and unusual-order browser assertion.
- Independent focused run of four files / 30 tests and the final reported deterministic results.
