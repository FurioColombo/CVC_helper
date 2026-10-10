# Retrospective prompt

Give this file to a fresh agent (Codex: Sol at xhigh; Claude Code: Opus) at a
release gate or at the start of a cycle. It was written for the 0.x → 0.4.0
boundary; replace the cycle names when you reuse it.

---

You are running the development retrospective of CVC Helper's 0.x cycles
(0.1.0 to 0.3.0). Your job is to find the friction that recurred while agents
built this app, measure what it cost, and propose specific harness changes
for 0.4.0. You propose; the owner decides. Do not change code, harness or
documents other than the two outputs below.

## Privacy comes first

The session transcripts contain raw OCR of real rosters: names, phone numbers
and birth dates of minors and staff. Therefore:

- Process transcripts only with scripts that extract metadata: timestamps,
  tool names, command shapes (`npm run verify:all`, `playwright test <spec>`),
  exit codes, durations, error classes. Strip digits and capitalised words
  from any text you keep.
- Never print transcript text into your conversation, and never quote a user
  or tool message. Count and describe instead ("14 owner corrections about
  layout").
- Keep raw extracts only in `data/private/retro-0x/` (ignored by Git).
- The committed report contains aggregates and generic descriptions only. Run
  `npm run check:staged` on it before you hand it over.

## Sources

1. Claude Code transcripts: `~/.claude/projects/<this repository's project
folder>/*.jsonl`, including subagent folders.
2. Codex sessions: `~/.codex/sessions/` and `~/.codex/archived_sessions/`,
   only those whose working directory is this repository.
3. `git log --stat` on all local branches, and CI runs (`gh run list` and
   `gh run view` if `gh` is available).
4. `.evidence/*/verification.json` (recorded durations),
   `.evidence/*/self-review.json` and the review rounds.
5. `archive/v0.3.0-completed-milestones.md`, the archived plans and the owner
   decision records in `archive/v0.3.0/`.

## Method

1. **Inventory.** Sessions per agent and model, dates, sizes, milestones
   covered.
2. **Mechanical metrics,** per session and in total:
   - shell calls and failed calls;
   - identical commands repeated after a failure;
   - verification runs by kind, with durations;
   - full runs repeated on unchanged source;
   - CI round trips per fix;
   - review rounds per milestone;
   - permission denials and context compactions;
   - subagent spawns and the share of work they did.
3. **Friction taxonomy.** Sort every recurring problem into one of these:
   - environment (Node/PATH, Windows, browsers);
   - test infrastructure (slowness, flakes, CI-only failures);
   - process (review rounds, re-verification, digest invalidation);
   - communication (owner corrections, redone work, misunderstood requests;
     count owner messages that correct or reverse a result);
   - privacy (near misses and the history rewrite);
   - documentation drift (stale rules followed, docs contradicting each
     other).
4. **Cost.** For the top ten, estimate the hours and the share of tokens each
   one consumed. Say how you estimated.
5. **Root cause and fix.** For each of the top ten:
   - the root cause;
   - one proposed change, typed as a hook, skill, script, rule, test change or
     document change;
   - the check that would prove the change worked.
6. **Already addressed.** Branch `claude/harness-0.4-prep` adds:
   - a Node 24 SessionStart hook;
   - privacy pre-commit and history pre-push hooks;
   - reviewer personas with an entropy protocol;
   - the `milestone-close` skill and `docs/DOCS_SYSTEM.md` with
     `check:docs`;
   - a test-speed audit.

   For each, say whether the data shows it addresses a measured friction.
   Do not propose it again.

7. **Keep doing.** What worked and must survive the next cycle.

## Outputs

- `docs/working/RETRO_0X.md`, at most 300 lines, starting with
  `> Working document · Owner: the owner · Fold at: <first 0.4.0 milestone ID>`.
  It holds these sections:
  - summary (five bullets);
  - metrics table;
  - top ten frictions with cost, root cause, proposed change and check;
  - keep doing;
  - limits of the data.
- `data/private/retro-0x/` for raw metrics and scripts. Never commit it.

Finish with a short message to the owner: the three changes you would make
first and why.
