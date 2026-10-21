# Owner decisions — taken provisionally, for review

> Working document · Owner: the owner · Fold at: UG3

The owner asked (2026-10-21) that agents keep working instead of stopping for
questions. Each entry is a decision the agent took or postponed on the owner's
behalf, with its reason. Review them at any time: a reversal is a normal
change. Accepted entries move into the contract they touch.

## T1 — faster browser suite

1. **Removed browser cases (taken).** A case goes only when a kept case, or a
   unit test for pure logic, proves the same requirement on the same engine.
   The case-by-case list and its coverage is
   `.evidence/T1/removed-cases.json`. Kept against the analysis:
   `reopen-persistence` (the only proof that ordinary saves survive a real
   page close).
2. **Tiered CI (taken, from the owner's suggestion).** Ordinary pushes run
   `verify` and a browser smoke set; the full suite runs for milestone
   handoffs and closures, release gates, `main`, a nightly run and manual
   runs. Review: which journeys belong in the smoke set.
3. **Worker count (pending measurement).** The owner chose three workers;
   H1 found two workers slower on this machine. The trial result decides
   whether three workers, a mixed split (Chromium parallel, WebKit serial) or
   fewer is faster; the choice is recorded here with the numbers.

## D4 follow-ups

4. **Reset section on an empty start (postponed).** Kept as is; hiding it
   when nothing remains is in `docs/working/BACKLOG.md`.
5. **Reset mark names no course (accepted limit).** 03 §3.2 records it; a
   course-bound mark is possible later if older windows matter.
