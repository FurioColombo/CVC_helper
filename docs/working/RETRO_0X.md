> Working document · Owner: the owner · Fold at: D1

# Development retrospective — 0.1.0 to 0.3.0

Run with `docs/agents/RETROSPECTIVE_PROMPT.md` on 2026-10-10. H1 closed while it
ran, so the report folds at D1, during which the owner picks what to adopt.
Sources: every Claude Code and Codex transcript of this repository up to the
0.4.0 plan commit (2026-10-08 08:46), Git on all local branches, the 108 public
CI runs, and `.evidence/`. Scripts read the transcripts and kept metadata only:
tool names, command shapes (quoted text, digits and capitalised words removed),
exit codes, durations, token counts and lexicon flags. No transcript text was
read or quoted. Scripts and raw metrics: `data/private/retro-0x/` (ignored).

## Summary

- **Waiting on checks is the largest time cost.** Full verification runs took
  about 46 of the 195 hours agents were active. From F1 on, every close
  recorded `verify:all` (36–42 min), and long runs pushed agents into
  background jobs, timeouts and polling.
- **Reviews are the largest token cost.** 81 reviewer threads used about 20% of
  all tokens. Most milestones needed one or two reviews; F1 needed 11 rounds
  and V05 needed 9.
- **CI was red for 204 hours, and nobody was watching it.** 39 of 73 runs
  failed, almost all on Linux-only browser geometry, and agents ran 6,805
  commands on a red branch. They have no `gh`, CI did not run during 0.2.0, and
  32 runs repeated a commit already verified on the other branch.
- **Owner corrections are rare but expensive.** 9 of 154 owner messages clearly
  correct or reverse a result, and agents were interrupted 29 times. The turns
  after those corrections used 6% of all tokens; two closures were reopened
  after the owner's phone check.
- **The harness prep already covers four of the ten frictions**: Node for
  Claude Code, privacy, re-verification and documentation drift. The rest need
  small scripts and two rule changes.

## Metrics

| Metric                                    | Claude Code                                 | Codex                                     | Total                     |
| ----------------------------------------- | ------------------------------------------- | ----------------------------------------- | ------------------------- |
| Sessions (root / subagent threads)        | 9 / 73                                      | 9 / 166 (49 forks)                        | 18 / 239                  |
| Dates (transcripts; Git from 08-29)       | 2026-09-17 → 10-08                          | 2026-08-31 → 10-06                        | 1.3 GB of transcripts     |
| Models                                    | Opus 5 / 5.5 lead, Sonnet 5 / 5.5 subagents | GPT-5.6 and GPT-6 Sol / Luna, auto-review | —                         |
| Milestones touched                        | 28 (0.2.0 tail, 0.3.0)                      | 41 (0.1.0–0.3.0)                          | 56 completed              |
| Active hours (gaps ≤ 20 min)              | 106                                         | 89                                        | 195                       |
| Shell calls / command wall time           | 7,612 / 65.6 h                              | 9,757 / 31.3 h                            | 17,369 / 96.9 h           |
| Failed shell calls (not search probes)    | 201 (2.6%)                                  | 770 (7.9%)                                | 971 (5.6%)                |
| Same command repeated after a failure     | —                                           | —                                         | 265; 62 with no edit      |
| Blind re-run that then passed             | —                                           | —                                         | 24 (9 of them `evidence`) |
| Full runs repeated on unchanged source    | —                                           | —                                         | 42 (2.6 h)                |
| Owner messages / corrections / interrupts | 103 (14 mid-turn) / 5 / 14                  | 51 (10 with images) / 4 / 15              | 154 / 9 / 29              |
| Permission denials                        | 24 (17 auto-mode unavailable, 3 by owner)   | 16 sandbox or approval errors             | 40                        |
| Context compactions                       | 8 (all manual)                              | 82 (automatic)                            | 90                        |
| API connection errors                     | 138 on 7 days                               | —                                         | —                         |
| Subagent spawns / reviewer threads        | 69 (48 Sonnet) / 47                         | 99 / 34                                   | 168 / 81                  |
| Subagents' share of calls / tokens        | 65% / 51%                                   | 50% / 35%                                 | —                         |
| Tokens processed (≈97% cached input)      | 3.51 B                                      | 1.21 B                                    | 4.72 B                    |
| Output tokens                             | 4.1 M                                       | 4.1 M (2.3 M reasoning)                   | 8.3 M                     |

**Verification runs** (focused runs fail often by design while a test is being
written):

| Kind                                 |  Runs | Failed |    Median | Total wall time |
| ------------------------------------ | ----: | -----: | --------: | --------------: |
| `evidence` (records `verify`/`:all`) |   157 |    24% |     1.8 m |          17.2 h |
| `verify:quick`                       |   116 |    25% |     2.9 m |          12.6 h |
| `verify:e2e`                         |   197 |    32% |     0.7 m |           6.3 h |
| `verify`                             |    68 |    38% |     2.4 m |           2.9 h |
| `verify:all` run directly            |    15 |    73% |     2.6 m |           1.8 h |
| Focused browser specs                |   597 |    26% |     0.4 m |          11.6 h |
| Focused unit tests                   |   877 |    27% |     0.2 m |           8.2 h |
| Typecheck / lint / format            | 1,035 |    16% | 0.1–0.3 m |           5.4 h |

Recorded durations (`.evidence/*/verification.json`): `verify` grew from 2–4 min
(U01–S5) to 5–7 min (V02, UX2); `verify:all` from 14.6 min (U00, 2026-09-06) to
29.1 (UG1), 36–39 (F1–F4) and 42.4 (UG2). **CI:** 73 verification runs (34
passed, 39 failed, median 18 min, 21.4 runner-hours) and 35 deploys; no run
from 2026-09-03 to 09-21; 12 fix episodes needing a median of 2 and at most 10
runs. **Review rounds:** F1 11 (16 reports, 12 FAIL, 25 blockers), V05 9, UG1
10 reports; every other milestone one or two. **Commits:** 189, of which 46
touch only evidence or documents and 14 record owner feedback or decisions.

## Top ten frictions

Hours are the commands' wall time plus recovery (the gap to the thread's next
command, capped at 10 min). Token share is the tokens of the model calls that
read those results, out of 4.66 B attributed; for reviewers, their threads'
total. A strong correction is an owner message matching a revert, wrong, I-said
or doesn't-work lexicon (English and Italian).

### 1. Full verification is slow and agents wait on it — test infrastructure

- **Cost:** 553 full runs: 46 h (40.9 running, 5.3 recovery), 3.7% of tokens.
  Around them, Claude Code made 99 background check runs, 62 Monitor waits and
  134 sleep polls and hit the 10-minute Bash cap 20 times; Codex polled running
  commands 2,611 times.
- **Root cause:** one Windows PC runs the browser suite on one worker (37–41
  min), and F1–UG2 recorded `verify:all` at every close.
- **Addressed:** H1 cut unit tests by 75% and made an ordinary close `verify`
  plus focused specs. The browser suite was not reduced; the owner asked for T1.
- **Change (script):** at a gate, `npm run evidence -- <ID> --from-ci` records the
  green CI `verify:all` run of HEAD's commit (run id, commit, duration) instead
  of repeating it locally; the local run stays the fallback.
- **Check:** UG3's evidence cites a CI run whose commit is HEAD; no local full
  suite runs at the gate.

### 2. Review rounds that do not converge — process

- **Cost:** 81 reviewer threads, 937 M tokens (19.9%), 57 h of Claude reviewer
  threads beside the main session. F1: 11 rounds, 25 blockers. V05: 9 rounds.
- **Root cause:** F1 bundled several milestones' corrections and the history
  rewrite. Each round sent a fresh reviewer at the whole milestone, who found
  new blockers instead of re-checking the old ones; nothing stopped the loop.
- **Change (rule, `docs/agents/REVIEW_PROTOCOL.md`):** from round 2, the same
  persona re-checks only the previous blockers and the fix diff; new
  non-blocking findings go to the backlog; a third FAIL stops and asks the
  owner to split the milestone or accept.
- **Check:** at most 3 rounds per milestone and reviewers under 10% of tokens in
  0.4.0 (re-run the scripts at UG3).

### 3. CI red for days, unseen and duplicated — test infrastructure

- **Cost:** 5 red windows on the working branch lasted 204 h, with 6,805 agent
  commands inside them. The 2026-09-21 regression took 6 rounds, 13.7 h and 98 M
  tokens (2.1%). About 21 h in all: that day plus 11 episodes of about 40 min
  (two 18-minute runs). 32 runs repeated a commit already run on the other
  branch (9.5 runner-hours); no two runs of one commit ever disagreed.
- **Root cause:** agents cannot read CI (no `gh`; 11 ad-hoc API calls in the
  cycle). Nothing was pushed during 0.2.0, so CI never ran. Linux's wider fonts
  break geometry that passes on Windows. `main` and the working branch are
  pushed with the same commit.
- **Addressed:** H1 made CI push-only, cancels superseded runs and skips
  documentation-only pushes. Its concurrency group is per branch, so
  same-commit duplicates remain.
- **Change (script):** `npm run ci:status [-- --wait]` reads HEAD's run from the
  public API and prints the failed step and test titles; `milestone-close`
  requires it green before the next milestone; CI's first step calls it and
  passes at once when the commit already has a green run.
- **Check:** no red window outlasts one working session; at most 2 runs per fix;
  no full suite on a commit that already passed.

### 4. Corrections arrive after "Complete" — communication

- **Cost:** the turns after 9 strong corrections took 1,179 commands, 4.6 active
  hours and 283 M tokens (6.0%). 54 more messages carry weaker redirect wording,
  and there were 29 interrupts. F4 was completed twice, F3's evidence was
  re-recorded on the deployed source, and UX1 and UX2 were whole milestones of
  phone-preview corrections. Topics: layout (7), domain behaviour (7), process
  (7), wording (6), privacy (6), docs (4), tests (4).
- **Root cause:** the real acceptance test of visible work is the owner's phone,
  and `milestone-close` hands that check to the owner after the Complete commit.
- **Change (skill, `milestone-close`):** for visible changes, the owner's phone
  check comes before Complete: publish the preview, send the 320 px / 200%
  screenshots, wait, and record `owner-check.json`.
- **Check:** no closure reopened and no owner-feedback commit after a Complete in
  0.4.0.

### 5. Re-verification and evidence churn — process

- **Cost:** about 10 h: 42 full runs on unchanged source (2.6 h) and 18 long
  evidence runs for 6 `verify:all` milestones where 6 would do (12 × ~38 min).
  38 evidence runs failed (16 on lint, 9 on the repository check);
  `milestone:check` rejected stale evidence 10 times; 2 re-record commits.
- **Root cause:** evidence was recorded before the source was final, and nothing
  stops a re-run on an identical source.
- **Addressed:** `milestone-close` ("verify once on the final source").
- **Change (script):** `npm run evidence` prints "already recorded" and exits 0
  when the last `verification.json` passed on the same source digest.
- **Check:** no full run on an unchanged digest in 0.4.0 transcripts.

### 6. Concurrent browser runs time out — test infrastructure

- **Cost:** 149 test timeouts (137 in Codex): 7.0 h, 0.6% of tokens. A browser
  run overlapping another heavy run from a different thread timed out 22% of
  the time (n = 95); alone, 10% (n = 685).
- **Root cause:** parallel agents and subagents run Playwright on one 8-CPU,
  7.8 GB PC. H1's two-worker trial also turned flaky when it overlapped reviews.
- **Change (script):** `scripts/run-e2e.mjs` takes a machine-wide lock (a file in
  the OS temp directory with the holder's PID and start); a second run waits
  and says who holds it.
- **Check:** no overlapping browser runs in 0.4.0 transcripts; timeouts ≤ 10%.

### 7. Hidden exit codes and long output — environment and tooling

- **Cost:** 235 check runs reported failures in their output while the call
  returned 0 (220 in Claude Code): 5.4 h, 2.2% of tokens. 825 of 3,477 check
  runs (24%) were piped through `tail`, `head`, `Select-Object` or `findstr`.
- **Root cause:** the browser suite prints a line per test and repeated
  PowerSync warnings, so agents truncate it, and the pipe's exit code replaces
  the check's.
- **Change (script):** one quiet runner for the verify scripts: the full log to
  `test-results/`, then the counts, failed titles and log path, with the exit
  code kept. `docs/LOCAL_DEVELOPMENT.md`: never pipe a check.
- **Check:** piped check runs near 0; no reported failure with exit code 0.

### 8. Node 18 on PATH and two shells — environment

- **Cost:** 142 Node-version failures (57 Claude Code, 85 Codex), 129 version
  probes and 103 shell-syntax or not-found failures: 3.4 h, 1.4% of tokens.
  6,953 commands carried a PATH preamble (58 characters, about 1.4% of output
  tokens): 76% of Claude Code's 0.3.0 commands and 25% of Codex's.
- **Root cause:** `C:\Program Files\nodejs` gives every shell Node v18.13.0; fnm
  is not initialised in agent shells, and its `cd` alias skipped the command
  after `cd dir &&`. Codex runs PowerShell 5.1, Claude Code Bash, so commands
  copied between them break.
- **Addressed for Claude Code** by the SessionStart hook; Codex is not covered.
- **Change (document and owner action):** Node 24 becomes the machine default
  (`fnm default 24`; remove or demote the Program Files Node 18 on the system
  PATH), recorded in `docs/LOCAL_DEVELOPMENT.md`.
- **Check:** no Node-version failures and under 1% preambles for both agents.

### 9. Real roster data near Git and in transcripts — privacy

- **Cost:** mostly risk. Real names, birth dates and phone numbers reached the
  public history and were rewritten out on 2026-09-27
  (`.evidence/F1/history-rewrite.json`), followed by a GitHub Support purge
  request. 564 commands read `data/private/`; OCR measurement cost 285 M tokens
  (6.1%), S4 alone 1,659 commands. The transcripts in `~/.claude` and `~/.codex`
  still hold raw OCR of minors.
- **Root cause:** real photographs were the test input before the synthetic-data
  rule, and nothing checked staged content.
- **Addressed:** the privacy pre-commit and pre-push hooks and the synthetic-data
  rule target the measured incident; metadata shows no near miss after the
  rewrite (5 broad `git add` among 171).
- **Change (document, `docs/LOCAL_DEVELOPMENT.md`):** agent transcripts are
  private data. Once this report is accepted, the owner deletes the 0.x
  transcripts or moves them offline (`metrics.json` keeps what a later
  retrospective needs) and sets Claude Code's `cleanupPeriodDays`.
- **Check:** no pre-0.4.0 transcript of this project remains on the PC.

### 10. Documentation drift and plan churn — documentation drift

- **Cost:** the plan was edited in 110 of 189 commits (58%); its length swung
  854 → 1,045 → 606 → 1,513 → 410 → 432 → 250 lines; Claude Code read it 132
  times. `AGENTS.md` grew from 351 to 427 lines. 28 commits reconcile stale or
  contradicting text. Measured tokens are under 0.1%; the cost is risk.
- **Root cause:** status, history and rules shared files, and nothing enforced
  one home for each.
- **Addressed:** `docs/DOCS_SYSTEM.md` and `check:docs`, now in `verify:domain`;
  after H1, `AGENTS.md` has 298 lines and the plan 224.
- **Change (script):** `milestone:complete` writes the plan's status row from the
  manifest, so agents edit the plan only for decisions.
- **Check:** fewer than 25% of 0.4.0 commits touch the plan; `check:docs` green.

## Already addressed

The test-speed audit has no file of its own; its outcome is H1 §4 and
`.evidence/H1/test-timing.json`.

| Change on `claude/harness-0.4-prep`            | Does the data show it addresses a measured friction?                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Node 24 SessionStart hook                      | Yes for Claude Code (#8: 76% preamble, 57 failures). Not for Codex.                                                              |
| Privacy pre-commit, history pre-push           | Yes (#9: the history rewrite). No later near miss is visible.                                                                    |
| Reviewer personas, entropy protocol            | Partly. The measured problem is rounds and cost (#2); repeated angles are invisible in metadata. Seeded lenses may add findings. |
| `milestone-close`, `DOCS_SYSTEM`, `check:docs` | Yes (#5, #10).                                                                                                                   |
| Test-speed audit (H1 §4)                       | Yes for unit tests (287 s → 71 s) and the close ladder. Browser time is unchanged (#1); same-commit CI duplicates remain (#3).   |

## Keep doing

- Evidence-first closes with a source digest: `milestone:check` stopped stale
  evidence 10 times.
- Independent adversarial reviewers: 25 blockers found in F1 and the exact-slot
  persistence defect in UX1 before release. Keep them; bound the rounds.
- Focused runs while editing: 2,924 focused checks against 553 full runs.
- Changing something before a retry: only 62 of 265 repeats after a failure had
  no edit in between (AGENTS.md §14 works).
- Diagnosing by mechanism and recording it (`.evidence/CI-REGRESSION/`:
  letter-spacing stress instead of chasing fonts).
- Owner decisions dated and written into the contract the same day.
- Private measurements reported as aggregate counts only.
- Delegating to subagents, which ran half of all shell work.

## Limits of the data

- Owner messages are classified by lexicon, unread: "strong" is a lower bound,
  the weaker wording overcounts.
- Background runs are timed to their completion notice; servers left running
  are excluded; parallel agents count the same machine time more than once.
- Tokens are processed tokens, about 97% cached input, attributed to the call
  that read each result: context × calls, not price.
- Transcripts start on 2026-08-31 (Codex) and 2026-09-17 (Claude Code), so M0's
  first days are missing. A resumed Claude Code session copied earlier history;
  records are deduplicated by id.
- Milestones are attributed from the nearest milestone command or evidence time
  (36-hour window), so per-milestone figures are indicative. 153 failures match
  no error class.
- CI runs come from the public API; runs deleted with the pre-rewrite history
  are missing. Review rounds are counted from evidence file names, so re-checks
  recorded only in commits are missed.
