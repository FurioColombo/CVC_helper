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
   runs. Implemented: run names carry the tier, handoff and publication
   commits say `[full-ci]`. Review: which journeys belong in the smoke set
   (`verify:e2e:smoke`) and whether the 02:17 UTC nightly run is wanted.
3. **Worker count (measured; one worker kept locally).** The full suite on
   three workers took 59.8 min against about 60 on one, with 7 failures and
   14 flaky cases (WebKit cases ran 1–2 min each). A Chromium-only subset
   went from 188 s to 154 s. This 8 GB, 8-thread machine is saturated, as H1
   found. The revised target (three workers, at most 23:47) cannot be met
   here; T1 instead cuts per-test cost (removed cases, the WebKit open
   regression) and runs the full suite less often (entry 2). **Owner:** a
   faster machine or CI runners with more cores would make workers pay;
   otherwise the time target needs restating.
4. **WebKit open "regression" (measured: none in production).** Production
   builds of H1, D1, D2, D3, D4 and now open WebKit at the same speed within
   a wide spread (`.evidence/T1/webkit-open-bisect.json`). The slowdown is in
   the dev server the tests use (more modules since D3/D4). T1 therefore
   treats it as a harness cost; serving the tests a production build is the
   remaining lever and needs a build-time seeding entry for 22 specs.

## D4 follow-ups

6. **Reset section on an empty start (postponed).** Kept as is; hiding it
   when nothing remains is in `docs/working/BACKLOG.md`.
7. **Reset mark names no course (accepted limit).** 03 §3.2 records it; a
   course-bound mark is possible later if older windows matter.
