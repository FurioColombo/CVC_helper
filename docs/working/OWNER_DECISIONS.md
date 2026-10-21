# Owner decisions — taken provisionally, for review

> Working document · Owner: the owner · Fold at: UG3

The owner asked (2026-10-21) that agents keep working instead of stopping for
questions. Each entry is a decision the agent took or postponed on the owner's
behalf, with its reason. Review them at any time: a reversal is a normal
change. Accepted entries move into the contract they touch.

## T1 — faster browser suite

The owner accepted T1 as delivered on 2026-10-22 (removals, tiered CI, one
worker; `04_IMPLEMENTATION_PLAN.md` and `03_TECHNICAL_DECISIONS.md` §6).
Still open for review:

1. **Smoke set and nightly run.** Which journeys belong in
   `verify:e2e:smoke`, and whether the 02:17 UTC nightly full run on `main`
   is wanted (review CQ-9: it repeats `main`'s already-full push run).

## D4 follow-ups

2. **Reset section on an empty start (postponed).** Kept as is; hiding it
   when nothing remains is in `docs/working/BACKLOG.md`.
3. **Reset mark names no course (accepted limit).** 03 §3.2 records it; a
   course-bound mark is possible later if older windows matter.
