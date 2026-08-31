# M10 adversarial domain review

**Verdict:** PASS

## Blockers

None.

## Important findings

None.

## Quality-of-life findings

None that should prevent M10 closure.

## Evidence inspected

- Canonical `unassigned`, `boat`, and `mezzi` destination values and the domain check.
- Separate boats-going-out selection and exact crew assignment, including rejection of unselected or duplicate boats.
- Atomic persistence of crews, people ashore, session boat selections, and destinations, including course ownership and legacy null-position compatibility.
- Invariant coverage for duplicate or dangling selections, assignments to unselected boats, and duplicate boat assignment within a session.
- `Mezzi` as a destination only, clearing `boatId` while counting in real crew history.
- Unavailable unselected boats disabled; existing selections and assignments preserved with a red warning; open faults remain distinct and selectable.
- Reload journey retaining an exact sailing boat and `Mezzi`, plus a later availability change retaining the assignment and showing its warning.
- iPhone 13 screenshot for readability and touch use.
- Independent focused verification: 91 unit/domain/component tests, domain and repository checks, typecheck, formatting and diff checks, and two Playwright journeys.
- Scope inspection confirming no M11 or post-MVP behavior was introduced.
