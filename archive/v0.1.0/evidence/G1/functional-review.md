# G1 functional review

- Verdict: PASS
- Blockers: none.
- Important findings: none after remediation.

## Adversarial findings and resolution

The first review found that the integrated browser scenario used the real clock
while asserting fixed ages, and that the edited OCR surname did not explicitly
prove the extracted value being corrected. The journey now fixes browser time
to 2026-08-29 before course creation, asserts that OCR produced `Bianchi`, and
then corrects that field to the externally intended `Bianchini`. The reviewer
re-inspected the change and confirmed that both findings are resolved.

## QoL findings

- Persisted corruption and an ordinary local-storage read failure intentionally
  share the same safe user-facing error for this MVP gate.
- The subsystem guard checks the structural student fields covered by the
  canonical persisted-state invariant rules. Current visible write paths
  constrain identity and date inputs separately.

## Evidence inspected

- `AGENTS.md` and the authoritative product, scope, technical-decision, and
  implementation-plan documents.
- The complete G1 diff, student persistence/UI code, scan and knowledge flows,
  invariant implementation and tests, Playwright configuration and journey.
- `.evidence/M0/ocr-sheet-clear.png` and
  `.evidence/G1/final-list-iphone13.png`.
- Focused invariant and component tests: 8 passed.
- Updated deterministic G1 browser journey: Pixel and iPhone profiles passed.
