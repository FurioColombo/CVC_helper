# M15 data-integrity review

- Verdict: PASS_WITH_FINDINGS
- Blockers: none.
- Important findings: none remaining. All 13 persisted sessions are reopened and checked for exact counts; a past Saturday evaluation is changed, saved, closed/reopened, and verified with its note.
- QoL findings: the synthetic invariant check and UI-created database are complementary evidence, not the same snapshot. An unavailable boat is excluded from the clean scenario without making historical unavailability a structural error.
- Post-MVP: orphan evaluation rows remain hidden by the student join, and there is no single whole-database snapshot exporter/validator.
- Evidence inspected: invariant implementation/tests, persistence readers/writers, valid crew-state loader, full-week checker, and post-reopen assertions.
