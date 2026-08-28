# MVP Testing and Validation — v0.7

This document is intentionally separate from product requirements.

## Deterministic tests
Test rules where regressions are difficult to notice manually:
- Comandate distribution/remainder/recalculation.
- Disabled-student future exclusion.
- D1 duty/A-terra warning.
- Crew size warning table.
- Pair repetition and 3+ pair checks.
- Sailing-boat exclusivity.
- Boat availability vs fault-state independence.
- Evaluation count/missing handling.
- Local persistence.

## Feature/spec reviews
Run focused reviewer/agent passes for:
- students/import/conoscenza;
- boats/avarie;
- comandate;
- equipaggi;
- valutazioni;
- persistence/navigation.

Review against current UX/domain/MVP docs, not historical questions.

## Holistic simulated-week review
Run a fictitious Saturday→Friday course including representative edge cases: minors, duplicate names, disable/re-enable, uneven duties, Friday stay-over, accepted yellow warning, D1 A-terra case, boat faults/unavailability, odd student count, staff in crew, Mezzi, repeated pairs, copy-previous with changed availability, evaluation notes, and app close/reopen.

The purpose is to catch cross-feature and field-UX failures that isolated tests miss.

## UX review
Check few taps, minimal typing, outdoor readability, obvious selection/unassigned states, no unnecessary confirmations, no data loss, useful non-blocking warnings, and clean announcement mode.

## Completion
Validation is complete when deterministic tests pass and the holistic simulated-week review has no unresolved issue preventing realistic course use.
