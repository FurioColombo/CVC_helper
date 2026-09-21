# M11 self-review

**Verdict:** PASS

## Blockers

None.

## Findings addressed

- Corrected the E2E reload assertion: crew data persists, while the session selector intentionally starts from the app's current in-memory selection and must be selected again after a full reload.
- Changed the announcement evidence from a full-page capture to the real phone viewport so fixed-overlay content below the viewport cannot appear in the artifact.
- Kept copy actions compact and secondary so they do not consume disproportionate mobile space.

## Evidence inspected

- Canonical previous-session derivation and session-to-duty-day mapping.
- Table-driven copy adaptation for duty, current `A terra`, inactive students, and missing volunteers.
- Independent crew IDs, no automatic crew rebuilding, and no copied exact destinations.
- Informational report only after a successful copy with automatic removals.
- Boat-copy preview, optional edits, explicit confirmation, unavailable-boat filtering, and preservation of already assigned boats.
- Exact announcement formatting for numbered boat, inferred boat type, no boat, and Mezzi.
- Pixel 7 and iPhone 13 browser journey including reload persistence.
- iPhone screenshots for the removal report and dedicated read view.
- Diff and scope review: no evaluation, synchronization, authentication, or other post-MVP behavior added.

## Non-blocking limitation

The optional Screen Wake Lock control was not added. The specification marks it best-effort, and the clean read view remains fully usable without introducing browser-permission behavior in this milestone.
