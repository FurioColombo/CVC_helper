# Milestone evidence

Each milestone owns one small directory named after its plan ID. Prefer concise,
machine-readable verification summaries plus only the reviewer reports,
screenshots, spike decisions, and limitation notes required by that milestone.

Evidence supports the specifications, code, tests, and Git history; it does not
replace them.

## What is not here

- **The 0.1.0 evidence** (`M0`–`M15`, `G1`–`G5`) moved to
  `archive/v0.1.0/evidence/` on 2026-09-21, beside the 0.1.0 ledger that was
  already there. Nothing was deleted and `.milestones/manifest.json` points at
  the new paths, so `npm run milestone:check -- M5` still resolves. Those
  milestones are closed history; they were making the active directories hard to
  read.
- **Test inputs are not evidence.** `ocr-sheet-clear.png` and
  `ocr-sheet-blurred.png` were read by four Playwright specs and by
  `check:ocr-offline` from inside `M0`. They live in `tests/fixtures/` now.
- **Screenshots a spec regenerates every run** go to `test-results/screenshots/`,
  which is ignored by Git. Before 2026-09-21 every journey wrote them back into
  its milestone's directory on each `verify:e2e`, including milestones closed
  long ago, so those directories could never stay tidy and a full run always
  left the working tree dirty with re-encoded images.

Only the **active** milestone's specs write here — today that is the four
`ug1-*.spec.ts` files and one screenshot in `u10-evaluations.spec.ts`. When a
milestone closes, its screenshots become a record of what was observed then;
they stay, and nothing overwrites them. A screenshot committed here is one
somebody chose to keep, not one a spec dropped.
