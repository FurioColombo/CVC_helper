# G4 domain and data-integrity review

Verdict: **PASS_WITH_FINDINGS**

## Blockers

None. The historical all-session validation limitation does not block G4's
positive persisted-state invariant requirement.

## Important findings

Reload validates the complete currently opened plan. Older-session history is
projected to student membership, so historical volunteer, `A terra`, and boat
relationships are not fully revalidated until that session is opened. Record
this as future integrity hardening.

The positive G4 scenario remains credible: all state is created through
validated UI/repository writes, Saturday PM is validated while authored, and
the final Sunday AM reload validates current crews, people, `A terra`, boats,
duties, and cross-session student history.

## QoL findings

A future full-course persisted crew snapshot validator should cover every
historical relationship in one pass.

## Evidence inspected

- Canonical duty/smontante mappings and tests.
- Crew, warning, invariant and persistence implementations and tests.
- `C`/`SM` presentation and D1 morning red-warning tests.
- Post-copy member swap and reload persistence assertions.
- Focused domain verification and current G4 browser result.
