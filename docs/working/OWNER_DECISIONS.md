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
   again before the tag. You gave the go to merge to `main` on 2026-10-22
   ("go on merge, we delay the manual check to this evening"); it redeploys
   the regular app you use. The `v0.4.0` tag still waits for the phone check
   to pass, since a tag cannot stand for an outstanding required check. The
   changelog date is the day the entry was written and moves to the tag's
   day if that is later.
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

6. **Draft 0.5.0 plan (open).** Written while UG3 waits, in
   `docs/working/PLAN_0.5.0_DRAFT.md`: seven milestones from a local
   development backend to the release gate, and the account and key actions
   only you can take. It proposes email magic-link sign-in. It becomes the
   plan only after UG3 completes and you review it.
