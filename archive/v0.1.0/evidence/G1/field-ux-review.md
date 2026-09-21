# G1 field-UX review

- Verdict: PASS_WITH_FINDINGS
- Blockers: none.
- Important findings: none.

## Findings

- The integrated flow is practical for hurried phone use: entry actions are
  prominent, sex uses direct M/F/Altro buttons, list cards remain compact,
  `Minorenne` is unmistakable, disable/re-enable is reversible, Conoscenza
  autosaves, and scan results require review before import.
- Touch targets are suitable: primary controls are at least 44 px, sex choices
  48 px, student cards at least 80 px, and bottom navigation 56-64 px.
- Four students remain readable without bottom-navigation overlap in the
  stricter iPhone browser viewport. Loading, empty, unsuitable-image,
  save/transcription failure, and persisted-read error states are explicit.
- No post-MVP behavior was introduced.

## QoL findings

- Playwright's iPhone 13 profile has a 390 x 844 screen and a 390 x 664 browser
  viewport. The screenshot is therefore a useful stricter vertical check, but
  is not described as a 390 x 844 viewport. The separate in-app preview is
  inspected and left at 390 x 844.
- Corrupt persisted data shares the generic local-archive read error. A distinct
  support/recovery message could help later but is not required for this gate.
- Full-page scan-review screenshot composition can visually overlay the fixed
  bottom bar on intermediate content; runtime padding and scrolling keep final
  actions reachable.

## Evidence inspected

- The authoritative product, MVP scope, technical decision, and G1 plan docs.
- Current G1 diff and the student list/detail/form, scan-review, Conoscenza,
  navigation, invariant guard, and holistic browser journey.
- `.evidence/G1/final-list-iphone13.png` and prior M3/M4 mobile evidence.
- `git diff --check`: PASS.
- `npm run verify:quick`: 11 test files and 41 tests passed.
