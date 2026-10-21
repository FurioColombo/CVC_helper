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

## UG3 — 0.4.0 release

4. **Release mechanics (taken; final step held).** The release check
   (`UG3-PHONE-RELEASE`) runs on CVC Helper Test as 0.4.4 from the final
   source. The package version becomes 0.4.0 and the changelog entry is
   written on the branch. Merging to `main`, which redeploys the regular app
   you use with real courses, and the `v0.4.0` tag wait for your explicit go
   after the phone check passes.
5. **No fix milestone for 0.4.0 (postponed).** The plan's open questions (which
   UG2 field findings join 0.4.0, which retrospective proposals are adopted)
   move to 0.5.0 planning; 0.4.0 ships without a fix milestone.

## D4 follow-ups

6. **Reset section on an empty start (postponed).** Kept as is; hiding it
   when nothing remains is in `docs/working/BACKLOG.md`.
7. **Reset mark names no course (accepted limit).** 03 §3.2 records it; a
   course-bound mark is possible later if older windows matter.
