# Owner decisions — taken provisionally, for review

> Working document · Owner: the owner · Fold at: UG4

The owner asked (2026-10-21) that agents keep working instead of stopping for
questions. Each entry is a decision the agent took or postponed on the owner's
behalf, with its reason. Review them at any time: a reversal is a normal
change. Accepted entries move into the contract they touch. The 0.4.0 entries
that were settled are in `archive/v0.4.0/OWNER_DECISIONS.md` and
`archive/v0.4.0/OWNER_DECISIONS_LATE.md`.

**Waiting for your reading:** 1, 17, 22, 23 and 25.

## Open from 0.4.0

1. **Smoke set (open).** Which journeys belong in `verify:e2e:smoke`
   (`package.json`; 03 §6) is yours to review. The nightly full run was
   removed at UG3: nobody asked for it and it repeated `main`'s full push run.

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
17. **What stays after an erase, as Impostazioni says it (taken, B6; yours
    to confirm).** The server deletes the course at once. Impostazioni and
    the erase confirmation say the provider's automatic copies keep it "for
    at most 7 days" (`src/backup/erasure.ts`): Supabase's Pro plan keeps 7
    days of daily backups, and PowerSync Cloud drops an erased row's history
    at its daily compaction; the account's other phones drop their copy
    when they next connect. The Free plan publishes no retention, and
    production's plan is decided at UG4: correct the number, or the wording,
    if the production plan differs.
18. **The full reset waits for the backup (taken, B6).** Signed in, `Azzera
tutti i dati locali` erases the course from the backup first; without
    signal it resets nothing and says so, because after a reset no account
    is left to finish the erase. Signed out, it resets the device and says
    the backup's copy stays, and warns when a course erased here offline
    has not reached the backup yet. Erasing the course (`Elimina il corso`)
    and importing a course file work offline: the server's erase completes
    with signal, and only this account on this phone can complete it (Esci
    says so).
19. **An erased course stays erased (taken, B6; yours, 2026-10-28, for
    0.5.0).** The server keeps the
    erased course's id (no course data) and refuses that course from any
    phone afterwards, so another phone's late upload cannot bring it back.
    Importing that course's file, or signing in on a phone that holds it and
    never used the backup, is your explicit choice and is accepted again,
    without a question (review SP-B6-R3-1). You chose the least problematic
    way for now: later versions keep old courses on the server, and this
    rule changes with them.
    Until you run the server's part (B6-ERASE-RULES) the erase deletes the
    course without keeping its id. Single deletes inside a course stay under
    decision 16.
20. **Two courses on one account split from B4 (yours, 2026-11-03).** The third
    review round of B4's desktop sync failed on SC-DT-9, which B4 did not cause:
    two devices each making a course, one of them offline, lock every device of
    the account on "Non riesco ad aprire i dati locali" with only Riprova. No
    row is lost. You chose to split it: B4 goes on without a passing desktop
    review (its three rounds stay in `.evidence/B4/`), 0.5.3 is published, and
    B7 fixes it before UG4. Until then, no course on a second device while the
    first is offline or already has one.
21. **The two-course screen (yours, 2026-11-04).** You approved the mock
    `docs/design/mockups/b7-two-courses.html` and added the email of the last
    edit beside its date and time. Choosing a course needs signal; saving a file
    does not. Taken for now: the email shown is the account's, which is true
    because only the owner's account can write to a course until 1.0, and needs
    no new column or migration. Both courses therefore show the same email. A
    record of who made each edit belongs with team writing.
22. **Details of the two-course screen beyond the mock (taken 2026-11-04, for
    your review).** A signed-out device sees both courses, saves their files and
    is asked to sign in to choose. A read-only device has no Salva file, unlike
    the mock's state 6: an app older than the data cannot write a faithful file
    of it, so that state now asks to update; the mock is corrected. The
    confirmation also states what the provider's backups keep, as every erase
    does (decision 17). The choice is made on the server in one step, so two
    devices choosing together can never erase both: this needs one more
    migration from you (B7-KEEP-RULE). A device's unsent changes go up first,
    so the queue holds none of the course given up, and without a connection
    good enough for that the choice reports it could not finish. After the
    first reviews: the server erases only the courses this phone showed, and
    refuses if it holds another course or a newer change of one given up, so
    the phone then asks you to wait for the update and choose again. The lead
    now says "Su questo telefono ci sono ancora tutti", because "Non è stato
    cancellato nulla" could be false right after a choice. The online backup
    section with Esci stays under the courses in every state, which the mock
    showed only when signing in was needed. Saving a file now names it and says
    it holds students' personal data. The mock is corrected. After the second
    reviews: the server compares a fingerprint of every row the phone saw, not
    the last change; "Azzera i dati" is under the courses and clears only this
    phone, leaving the backup untouched; the panel there leaves out
    the 7-day text, which the confirmation says; a phone whose course was erased
    from elsewhere says so once when it reopens on the other course, and that its
    unsent changes went with it.
23. **An offline erase and a later choice (taken 2026-11-04, for your review).**
    Phone B erases course K offline. Phone A then keeps K and gives up X. When B
    connects, its waiting erase also removes K, as every erase does (decision
    17, B6), so the account ends with neither. Each step was your own explicit
    choice and needs two phones acting against each other, and server archiving
    in a later version changes this area anyway, so I leave the rule as it is. A
    phone with an erase still waiting already says so in Impostazioni. Tell me
    if keeping should win instead.
24. **Which model does what (2026-11-05, you asked me to choose and keep track).**
    Reviewers stay on Opus, as `AGENTS.md` §18 sets; I save by narrowing their
    briefs from round 2 on, reusing their scripts. Bounded implementation may go
    to Sonnet through `implementer`; B7's fixes so far I wrote myself, because
    each one followed from what the reviews had just found.
25. **Vento joins 0.5.0 as WX1 (taken 2026-11-06, for your review).** You chose
    to adopt the side branch's wind section as a milestone. I placed it in this
    cycle, after B7 and before UG4, rather than first in 0.6.0: it touches no
    course data or sync, agent time is free while B4–B7 wait for you and
    GitHub, and UG4's one phone check then covers it. The cost: 0.5.0 also
    waits for WX1, and `01` must shed text to hold it. It starts only after
    your answer to `WX1-NETWORK`, because Vento connects before sign-in against
    this cycle's rule, and after B7's handoff, because merging earlier would
    change the source B7 verified. If you would rather it wait for 0.6.0, say
    so: nothing is merged yet.
