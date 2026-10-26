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
10. **An older app sees an empty device after the switch (taken, B1).** The
    switch empties 0.4.0's local copy instead of keeping it, so a 0.4.0 app
    on a switched phone opens read-only with nothing to consult and asks for
    the update. Kept, the copy would hold students and notes deleted later,
    out of every 0.5.0 screen. 01 §2's "everything can be consulted" is
    rewritten for 0.5.0 at UG4 (review DP-B1-3).
11. **Sign-in by email magic link (yours, 2026-10-25).** No password to
    remember on the boat; B3 builds it.
12. **One writing phone at a time (yours, 2026-10-25).** In 0.5.0 one phone
    writes at a time; placement rows get ids that cannot duplicate, so a
    clash between two phones edited offline settles on the latest edit
    instead of breaking Equipaggi, and the app says when two phones edited
    offline. Team editing stays 1.0.0 (review SC-B1-1; B4 and B5).
    Decision 16 bounds it for deletes.
13. **Production lives where no agent token reaches (taken, B2).** The
    PowerSync token in `.env` belongs to an account, not to one instance, so
    the production backend (UG4) is created under a separate PowerSync account
    and a separate Supabase project whose credentials never enter this
    repository or any agent tool (review SP-B2-4, `AGENTS.md` §17).
14. **No sign-up from the app (taken, B3).** Only the accounts you create in
    Supabase's dashboard can sign in: the app asks for a link with
    `shouldCreateUser: false`, so nobody who finds the public CVC Helper Test
    site can create an account on the development backend (review SP-B3-4).
    Production sign-up is decided at UG4.
15. **The email also carries a code (taken, B3).** A sign-in link only works
    in the browser that asked for it: an iPhone home-screen app, or a link
    Gmail opens in its own browser, would never sign in. Impostazioni
    therefore also accepts the code from the same email (review FUX-B3-4).
    It needs one change in Supabase's email template, which Supabase allows
    only with a custom email sender (SMTP); until then the email has the link
    alone (`docs/OWNER_TODO.md`, B3-EMAIL-CODE).
16. **A delete may lose to an older edit, in 0.5.0 (yours, 2026-10-26).**
    Decision 12's "the latest edit wins" holds for edits; for deletes one
    case stays open: phone A edits a row offline, later phone B deletes it,
    and if B uploads first, A's older edit brings the row back (B4 review
    SC-B4-8, the expected failure in `placementConvergence.test.ts`). It is
    accepted for 0.5.0 under the one-writing-phone rule; deletion times and
    server tombstones come before team editing (1.0.0).
