# M1 self-review

**Verdict:** PASS

## Blockers

None.

## Important findings

- Fixed during review: the Home identity panel initially contained a partial-width decorative stripe that could be mistaken for course progress. It is now a short, clearly decorative accent; M1 does not introduce dashboard or progress semantics.
- The one-active-course rule is enforced inside a single local database write transaction: existing active rows are deactivated before the new row is inserted. A focused persistence test verifies both statements execute within that transaction.
- ISO week/year logic was checked at a calendar-year boundary. Saturday-to-Saturday stored dates and both `D` and `C` label prefixes have deterministic tests.
- The primary navigation is exactly `Avarie · Home · Equipaggi`, with Home central and visually primary. All six required Home destinations are present; later feature content remains an explicit placeholder.

## Quality-of-life findings

None requiring M1 changes. Controls meet the mobile touch-size baseline, loading and storage failures have visible states, and the settings control remains separate from primary navigation.

## Evidence inspected

- `npm run verify:quick`: 5 test files and 16 tests passed, with lint, format, and typecheck passing.
- `npm run verify:e2e`: fresh-device creation and active-course reload journeys passed on the Pixel 7 Playwright profile.
- In-app browser inspection at 412 × 915 verified layout, bottom-navigation clearance, Settings navigation, visible course identity, and all Home cards; browser console contained no warnings or errors.
- `git diff --check` passed and the complete M1 diff was reviewed for scope, persistence integrity, error handling, and user-visible Product Spec alignment.

## Scope review

No post-MVP backend, synchronization, authentication, course archive, content system, or feature implementation was added. Non-M1 destinations are navigable shell placeholders only.

## Follow-up mobile density review

User review identified that the shortened decorative stripe still resembled unsupported course progress and that `Corso attivo` and `Operatività` consumed unnecessary phone space. All three elements were removed. At the Playwright project's Pixel 7 viewport (412 × 915), the revised hero is 84 px high, the final Home card ends at 544 px, the fixed navigation begins at approximately 840 px, and the document height equals the viewport height. The full Home surface therefore fits without vertical overflow or bottom-navigation overlap.

The visible title was subsequently grouped as `D3 · 35 | 2026` for faster scanning while retaining `D3 35 2026` as the stored label and accessible heading name. The browser suite now runs every M1 journey in both Pixel 7 (412 × 915) and iPhone 13 (390 × 844) mobile profiles. At iPhone size the final card ends at 544 px, navigation starts at approximately 769 px, and the document height equals the 844 px viewport. Native WebKit could not launch on this macOS 14 host because Playwright's frozen WebKit build reports an unsupported `PushAPIEnabled` protocol setting; the deterministic iPhone profile therefore uses Chromium with the iPhone viewport, touch mode, and user agent. Native WebKit remains a later cross-browser hardening item.
