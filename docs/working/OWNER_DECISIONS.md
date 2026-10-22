# Owner decisions — taken provisionally, for review

> Working document · Owner: the owner · Fold at: 0.5.0

The owner asked (2026-10-21) that agents keep working instead of stopping for
questions. Each entry is a decision the agent took or postponed on the owner's
behalf, with its reason. Review them at any time: a reversal is a normal
change. Accepted entries move into the contract they touch. The 0.4.0 entries
that were settled are in `archive/v0.4.0/OWNER_DECISIONS.md`.

## Open from 0.4.0

1. **Smoke set (open).** Which journeys belong in `verify:e2e:smoke`
   (`package.json`; 03 §6) is yours to review. The nightly full run was
   removed at UG3: nobody asked for it and it repeated `main`'s full push run.
2. **Release mechanics (taken; final step held).** The release check
   (`UG3-PHONE-RELEASE`) runs on CVC Helper Test as 0.4.4 from the verified
   source `c56ffe7`. The package version became 0.4.0 and the changelog entry
   was written on the branch afterwards; only the version string and
   documents differ from the checked build, and the final source is verified
   again before the tag. Merging to `main`, which redeploys the regular app
   you use with real courses, and the `v0.4.0` tag wait for your explicit go
   after the phone check passes. The changelog date is the day the entry was
   written and moves to the tag's day if that is later.
3. **Regular-app update after the merge (scheduled, owner).** No check has
   covered an installed regular 0.3.0 app updating to 0.4.0 with its course
   (review SC-4). It can only happen once `main` deploys 0.4.0; the changelog
   records it as not device-checked, and a post-release owner check is
   proposed then.
4. **No fix milestone for 0.4.0 (postponed).** The UG2 field findings and the
   remaining retrospective proposals are 0.5.0 planning candidates
   (`docs/working/BACKLOG.md`).
5. **Reset mark names no course (accepted limit).** 03 §3.3 records it; a
   course-bound mark is possible later if older windows matter.
