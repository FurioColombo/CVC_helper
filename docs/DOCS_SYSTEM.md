# Documentation system

How this repository keeps its documents short, current and trustworthy for
the people and agents who read them every turn. `npm run check:docs` enforces
the rules below; `.claude/skills/milestone-close/SKILL.md` performs the sweeps.

## The idea

**Documents describe the present. History is evidence.**

An agent rereads the contract at the start of every turn, so every stale
sentence is paid for again and again, and a stale rule is followed. The
repository therefore keeps one current statement of each truth, records what
happened as append-only evidence, and freezes the past in an archive that is
read only when someone asks why.

Where a file lives says what it is. Each Markdown file belongs to exactly one
class.

| Class    | Where                                                                                                                              | Reader and moment                     | Changes                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------ |
| Contract | `AGENTS.md`, `README.md`, `01`–`04` at the root; `docs/*.md`, `docs/agents/`, `docs/design/`; `.claude/agents/`, `.claude/skills/` | agents at every turn or task          | edited in place, present tense |
| Working  | `docs/working/`                                                                                                                    | the owner, during one stretch of work | temporary; folded at a moment  |
| Ledger   | `CHANGELOG.md`, `.evidence/<ID>/`                                                                                                  | reviewers, release notes              | append-only                    |
| Archive  | `archive/<cycle>/`                                                                                                                 | someone asking why, on request        | frozen                         |
| Vendored | `.claude/skills/powersync/`                                                                                                        | agents, through the skill             | replaced whole from upstream   |

## Rules

1. **One home per truth.** A rule, decision or mapping is written in exactly
   one contract document; others link to it. An owner decision goes into the
   contract document it changes on the day it is made.
2. **Present tense in contracts.** No closure stories, no "was", no review
   rounds. What happened belongs in the milestone's evidence; why belongs in
   the archive.
3. **Budgets.** `AGENTS.md` ≤ 300 lines, `04_IMPLEMENTATION_PLAN.md` ≤ 250,
   `README.md` ≤ 80, `docs/LOCAL_DEVELOPMENT.md` ≤ 120, any other contract
   document ≤ 700, a working document ≤ 300. A status-table row in the plan is at
   most 60 words and links its evidence.
4. **The plan holds open work only.** A completed milestone's section leaves
   the plan at its close and is appended to
   `archive/<cycle>/completed-milestones.md`; the plan keeps its status row.
5. **Working documents expire.** The first lines carry
   `> Working document · Owner: <who> · Fold at: <milestone ID or version>`.
   When that milestone completes, or that version ships, the document is
   folded: decisions go into the contract, open items move to the next working
   document or into the plan, and the file moves to the archive.
6. **The archive and the ledger are frozen.** Files under `archive/` are never
   edited or deleted. `CHANGELOG.md` and the evidence of a completed milestone
   only grow. The one exception is removing personal data, with the owner's
   approval: the edit is listed, with its date and the file's path, under "The
   one exception" in `archive/README.md`, in the same commit. A new entry lets
   that one change through; it approves nothing later. A re-run after
   completion is a new file, not an edit. The page changelog
   (`docs/design/07_PAGE_CHANGELOG.md`) is a contract despite its name: it
   holds each page's current state, amended in place with a date.
7. **Links resolve.** Every relative link in a contract or working document
   points at a file that exists.
8. **No private data, ever,** in any class (`AGENTS.md`; the pre-commit hook).

## Moments

| Moment          | What happens                                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner decision  | Same day: written into the contract document it changes, and removed from the working document's open questions.                                                                                                                      |
| Milestone close | Light sweep, part of the `milestone-close` skill: section to the archive, status row of ≤ 60 words, decisions folded, working documents whose fold-at is this milestone folded, evidence directory swept, `check:docs` green.         |
| Release gate    | Heavy sweep: every working document of the cycle folded; every contract document reread in full and rewritten in the present tense; `CHANGELOG.md` entry; the cycle's plan archived as `archive/<version>/04_IMPLEMENTATION_PLAN.md`. |
| Cycle start     | A fresh plan: objective, goals, status table, execution order and the open milestones' sections only. New working documents get their fold-at.                                                                                        |

## Enforcement

`npm run check:docs` checks classes, budgets, the plan's open-work rule,
working-document headers and expiry, links, and frozen files. It runs in
`verify:domain` and before `milestone:complete`. Frozen files are compared
with `HEAD` locally, with the staged changes in the pre-commit hook, and with
the previous tip in CI (`CVC_DOCS_BASE`), so a committed edit is caught too;
for a new branch, which has no previous tip, CI compares with `main`.
