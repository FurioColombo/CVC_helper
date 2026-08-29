# M2 self-review

**Verdict:** PASS

## Blockers

None.

## Important findings

- Student age and `Minorenne` state are derived from the date of birth at the course start date. Tests cover the exact eighteenth-birthday boundary and the day before it.
- Display names follow the approved deterministic rule: unique first name, surname initial on a collision, and explicit nickname override. Collision matching ignores case and surrounding whitespace.
- Disabling is a reversible persisted state change rather than deletion. Disabled students stay visible and greyed in the student list, while the record remains available for later history-bearing features.
- Student reads and mutations are scoped to the active course. The PowerSync local-only schema now stores the M2 identity fields, and browser reload verifies persistence.
- The student list intentionally shows only display name, age, sex indicator, and the required minor/disabled status markers. Full identity and contact fields are confined to the detail/edit flow.

## Quality-of-life findings

- The empty state has a prominent manual-add action. `Scan allievi` is visibly unavailable and marked as upcoming because scanning belongs to M4.
- Dates are stored as date-only ISO values for deterministic rules and displayed in Italian day/month/year form in the detail view.
- Accessible names make student rows, sex, date of birth, nickname, edit, add, and back controls unambiguous.

## Evidence inspected

- `npm run verify:quick`: 8 test files and 29 tests passed, including lint, formatting, typecheck, domain rules, persistence calls, and student components.
- `npm run verify:domain`: repository structure, canonical student-sex values, and persisted-state enum checks passed.
- `npm run verify:e2e`: 6 journeys passed across Pixel 7 (412 × 915) and iPhone 13 (390 × 844) profiles. The M2 journey creates two same-first-name students, verifies minor marking and disambiguated names, edits nickname and phone, disables, reloads, and re-enables.
- In-app browser inspection at 390 × 844 verified the revised `D3 · 35 | 2026` Home title, no Home overflow, a compact student empty state, and a usable student form with save controls above the fixed navigation. The explicit iPhone viewport remains active for user preview.
- `git diff --check` passed, and the full M2 diff was reviewed for scope, persistence integrity, reversible state, error handling, accessibility, and mobile density.

## Scope review

No scanner, Conoscenza fields, crew automation, synchronization, authentication, backend, or other post-MVP infrastructure was added. Size and initial-note capture remain M3; camera scanning remains M4. Exclusion of disabled students from operational selection pools will be enforced when those pools are implemented, while this milestone preserves the disabled records required for history.

## Environment note

The iPhone profile uses the iPhone 13 viewport, touch mode, and user agent with Chromium for deterministic CI. Native WebKit remains deferred to M14 because the frozen Playwright WebKit build cannot launch on this macOS 14 host due to its unsupported `PushAPIEnabled` protocol setting.
