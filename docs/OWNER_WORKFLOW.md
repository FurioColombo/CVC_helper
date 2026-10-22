# Owner feedback and parallel agent work

Owner feedback is part of acceptance. A pending phone check keeps its milestone
open and appears in [Owner todo](./OWNER_TODO.md); it does not stop explicitly
independent agent work.

## Milestone states

| State          | Meaning                                                                                          | What can proceed                                                           |
| -------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| PENDING        | Agent work has not started.                                                                      | Start when its prerequisites permit it.                                    |
| IN_PROGRESS    | Implementation, fixes, reviews or verification are unfinished.                                   | Finish that work; do not treat it as a verified prerequisite.              |
| AWAITING_OWNER | Agent evidence is complete, committed and green in CI; owner acceptance remains open.            | Work explicitly allowed by the next milestone's dependency permissions.    |
| COMPLETE       | Required agent evidence and owner results pass; the documentation sweep and checkpoint are done. | Dependent work and, once every prerequisite is complete, the release gate. |

`milestone:await-owner` does not lower the acceptance standard. It checks every
agent-required file, reviewer verdict, recorded source digest and exact-commit
full push CI (a `[full-ci]` commit). The manifest's `ownerEvidence` names the physical-device files that
may still be missing. A required queue item must name each such file. A missing
review, stale verification, dirty implementation or unknown/red CI refuses
the handoff.

The handoff captures `agentReady`: the verified implementation commit, source
digest, hashes of the agent evidence and CI run. The commit must remain an
ancestor of the current checkout, and the evidence hashes must remain intact.
Each device check identifies that exact build and its test address. Do not
substitute a newer build silently while the owner is testing an older one.

## Continuing and fixing work

The next milestone's `allowedAwaitingOwnerPredecessors` lists `{id, reason}`
for each safe exception to the normal execution order. The controller requires
an intact verified checkpoint, green CI and no owner-requested fixes for every
such predecessor. A reason is an actual dependency judgment, not a blanket
permission. An IN_PROGRESS, BLOCKED or unverified predecessor still blocks.

In 0.4.0, for example, D4 used D3's verified version contract while the
Android update check waited, and T1 used D3 and D4's verified journeys while
their phone checks waited. The integration gate accepts no AWAITING_OWNER predecessor. Neither a
release nor a tag can represent outstanding required device checks as PASS.

Record negative feedback as CHANGES_REQUESTED. Before editing that pending
milestone, use `milestone:resume`: it clears the readiness proof and resets its
required owner checks, retaining prior reports as history. Fix the problem,
re-run the affected evidence and reviews, then request a fresh owner check.
Pause work that depends on the failed prerequisite; continue eligible work
that is independent. Do not erase another milestone's unfinished work.

An ordinary milestone may close later against its captured checkpoint and the
owner's matching result even after independent later work changes the source.
Its evidence describes that checkpoint, not the later combined build. A release
gate still verifies the current final source and checks the combined release
on the owner's devices. Changes to the pending milestone itself require a
resume and a new handoff; they cannot reuse the old acceptance.

Starting permitted later work records `startedFrom`, including its pending
owner prerequisites. A changed source with no such active work or matching
later verified digest is refused, so an unexplained edit cannot reuse the old
checkpoint. Completion also matches each queue PASS against the latest report
in its required physical evidence; a contradictory or missing report refuses
closure.

## The owner list

`.milestones/owner-checks.json` is canonical; `docs/OWNER_TODO.md` is its
generated, readable projection. Requests have a stable ID, milestone, required
or optional flag, state, revision, instructions, expected result and, when
ready, the build, test address and evidence path. The checker refuses a stale
projection or an invalid request. There are four request states:

- NEEDS_SETUP: choose or prepare the setup; the phone test is not ready yet.
- READY: the supplied check can be performed on the supplied build.
- PASSED: an explicit owner report records the observed outcome.
- CHANGES_REQUESTED: owner feedback identifies a problem to fix and retest.

Visible milestones need a focused owner check before COMPLETE. Prepare it
alongside the implementation; do not add old deferred device checks unless
the owner asks. A setup choice and a device result are different facts. Only
explicit human feedback can produce an owner PASS. Device, browser, OS,
build, address and the owner's report source accompany physical results.
Use synthetic course data on actual hardware; a simulator is never a PASS.
No roster, audio, raw OCR or personal student data belongs in the queue or
evidence.

Agents accept ordinary chat feedback, record it with `owner:feedback`, and
tell the owner which item changed. The owner need not edit JSON or run checks
to communicate a result. A missing or partial observation remains pending;
do not turn a vague "looks good" into detailed checks the owner did not run.

## Commands and reminders

```text
npm run owner:list
npm run owner:add -- --file <new-request.json>
npm run owner:update -- --file <revised-request.json>
npm run owner:feedback -- --file <owner-report.json>
npm run owner:check
npm run milestone:await-owner -- <ID>
npm run milestone:resume -- <ID>
```

Add/update files contain a complete request. Updates carry its current revision
to refuse stale edits; the writer increments it. Feedback contains `id`,
`status` and an explicit owner `result`. Device feedback appends the report to
its declared owner-evidence file; completed evidence stays frozen.
Keep input files in the OS temporary directory. New owner work for a completed
milestone belongs to an open follow-up, not an unfinishable historical request.

On each addition or materially changed request, the agent announces the item
and links Owner todo in the current chat. `owner:notice` detects unannounced
open revisions using a local, ignored acknowledgement cursor. It prints a
SNAPSHOT token; `-- --ack <snapshot>` acknowledges that snapshot after preparing
its notice, refusing if a concurrent addition or update changed the list.
A Codex heartbeat also checks for additions from other chats hourly. It
notifies only on new or changed owner actions, or a meaningful monitor failure;
an unchanged list produces no reminder. This neither starts application work
nor grants permission to deploy or message another person.
