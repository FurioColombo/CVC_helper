# Owner decisions — taken provisionally, for review

> Working document · Owner: the owner · Fold at: UG4

The owner asked (2026-10-21) that agents keep working instead of stopping for
questions. Each entry is a decision the agent took or postponed on the owner's
behalf, with its reason. Review them at any time: a reversal is a normal
change. Accepted entries move into the contract they touch. The 0.4.0 entries
that were settled are in `archive/v0.4.0/OWNER_DECISIONS.md`.

## Open from 0.4.0

1. **Smoke set (open).** Which journeys belong in `verify:e2e:smoke`
   (`package.json`; 03 §6) is yours to review. The nightly full run was
   removed at UG3: nobody asked for it and it repeated `main`'s full push run.
2. **Release mechanics (done, 2026-10-24).** The release check
   (`UG3-PHONE-RELEASE`) runs on CVC Helper Test as 0.4.4 from the verified
   source `c56ffe7`. The package version became 0.4.0 and the changelog entry
   was written on the branch afterwards; only the version string and
   documents differ from the checked build, and the final source is verified
   again before the tag. You gave the go to merge to `main` on 2026-10-22
   ("go on merge, we delay the manual check to this evening"); it redeploys
   the regular app you use. The tag followed the final-build check
   (entry on which check closes UG3) on 2026-10-24. The changelog keeps 2026-10-22, the day 0.4.0
   reached `main`: `CHANGELOG.md` only grows, so its date is not moved.
3. **Regular-app update after the merge (scheduled, owner).** No check has
   covered an installed regular 0.3.0 app updating to 0.4.0 with its course
   (review SC-4). It can only happen once `main` deploys 0.4.0; the changelog
   records it as not device-checked. `main` deployed 0.4.0 on 2026-10-22, and
   the optional owner check `UG3-REGULAR-UPDATE` asks for it; optional, so
   UG3 does not wait for it.
4. **No fix milestone for 0.4.0 (postponed).** The UG2 field findings and the
   remaining retrospective proposals are 0.5.0 planning candidates
   (`docs/working/BACKLOG.md`).
5. **Reset mark names no course (accepted limit).** 03 §3.3 records it; a
   course-bound mark is possible later if older windows matter.

6. **Which check closes UG3 (taken, 2026-10-23).** The controller binds a
   required device check to the exact commit handed off, and a release gate
   bumps the version after its phone check, so the 0.4.4 check (`c56ffe7`)
   cannot close the final 0.4.0 source. Your passed results stay as recorded;
   `UG3-PHONE-RELEASE` and `UG3-REGULAR-UPDATE` were made optional by hand
   (their results untouched), and a short required `UG3-FINAL-BUILD` asks you
   to confirm the final commit on your regular app. Next release: bump the
   version before publishing the phone-test build, so one check covers the
   final source.

## 0.5.0 preparation

8. **0.5.0 cycle started (taken, 2026-10-24).** You asked to work on 0.5.0
   after the release, so the draft became `04_IMPLEMENTATION_PLAN.md` (the
   draft is archived at `archive/v0.4.0/PLAN_0.5.0_DRAFT.md`). Two changes
   from it: the milestones are B1 to B6 and UG4, because S1, R1 and E1 were
   0.3.0 milestones; and the synced schema (B1) comes first, since it needs no
   backend, so work continues while the development projects wait for you.
   Review the plan at any time; sign-in by email magic link is proposed, not
   settled.
9. **The branch builds 0.5.0 (taken, 2026-10-24).** Synced data locks out
   every app older than 0.5.0 (B1), so the 0.5.0 branch's package version is
   0.5.0 from now on and CVC Helper Test's builds move to the 0.5.x line. Your
   regular app stays on 0.4.0: `main` deploys only released versions. The
   working documents now fold at UG4 rather than at "0.5.0".
