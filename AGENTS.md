# AGENTS.md

This repository is the shared operating contract for Codex and Claude Code. The
human starts work with a very short prompt, so the repository itself is the
operating contract, source of truth, progress tracker and verification harness.

## 1. Read order

At the start of a turn, before writing application code:

1. Read this file completely.
2. Inspect `git status`, the latest checkpoint and milestone state (`npm run
   milestone:status` gives a compact projection of `.milestones/manifest.json`).
   Never erase or claim another agent's unfinished work.
3. In `04_IMPLEMENTATION_PLAN.md`, read **Where this cycle stands** and the
   active milestone. Read other milestone sections only for a dependency.
4. Read the relevant sections of `01_PRODUCT_SPEC.md`, `02_MVP_SCOPE.md` and
   `03_TECHNICAL_DECISIONS.md` for the active work. These remain authoritative;
   use search to find the relevant sections instead of loading old history.
5. For UI work, read the relevant sections of
   `docs/design/06_DESIGN_RULEBOOK.md` and `docs/design/07_PAGE_CHANGELOG.md`,
   then inspect the frozen mock target linked there.
6. Check Node 24 and follow `docs/LOCAL_DEVELOPMENT.md` for ports/browser tools.
7. Start from the first eligible incomplete milestone in the active plan; an
   explicitly deferred milestone is not eligible until the owner lifts it.

`archive/` holds prior plans and instructions. Read it only for requested
historical rationale or a specific active dependency. It is not authoritative.

## 2. Source-of-truth hierarchy

When information conflicts, use this order:

1. explicit human instruction in the current task;
2. `01_PRODUCT_SPEC.md` for user-visible behavior and domain/business rules;
3. `02_MVP_SCOPE.md` for scope boundaries;
4. `03_TECHNICAL_DECISIONS.md` for architecture and technology;
5. `04_IMPLEMENTATION_PLAN.md` for execution order and milestone-specific acceptance;
6. `docs/design/06_DESIGN_RULEBOOK.md` and the frozen target in
   `docs/design/07_PAGE_CHANGELOG.md` for visual/interaction implementation;
7. code/tests/configuration.

Do not silently resolve a real contradiction by changing product semantics.

## 3. Core operating principle

A milestone is not complete because code was written. It is COMPLETE only when
the repository contains verifiable evidence that the required behavior works.

Prefer programmatic evidence over prose. A rule that can be represented as
canonical data, linted, type-checked, tested, checked as an invariant, exercised
through the browser or re-run in CI is verified that way, not left to memory or
narrative instructions.

## 4. Harness-first rule

The harness is in place: Git checkpoints, ESLint, formatting, TypeScript,
Vitest with React Testing Library, Playwright, the production build,
deterministic seeds and scenarios, the domain invariant checker, the repository,
domain and documentation checks, milestone metadata, evidence and commands, the
Git hooks, browser smoke tests and CI (`03_TECHNICAL_DECISIONS.md` §6). Extend
it; do not replace it or reopen its old milestones. Before substantive work,
confirm the first incomplete milestone and its baseline in
`04_IMPLEMENTATION_PLAN.md`. Do not begin a feature milestone while an earlier
milestone is incomplete.

## 5. Required verification commands

Keep the command surface boring, transparent and easy to inspect; its detail is
`03_TECHNICAL_DECISIONS.md` §6 and `docs/LOCAL_DEVELOPMENT.md`.

- `npm run verify:quick`: lint, formatting, typecheck, unit and domain tests.
- `npm run verify:domain`: repository, domain, docs checks; controller self-test.
- `npm run verify`: both, plus the production build.
- `npm run verify:e2e`: the Playwright browser suite.
- `npm run verify:all`: all of it, the full week and the PWA offline check.
- `npm run milestone:start|status|check|complete -- <ID>`, `evidence -- <ID>`.

## 6. Milestone lifecycle

For every milestone:

1. Identify its category and required evidence in `04_IMPLEMENTATION_PLAN.md`.
2. Confirm previous milestone/checkpoint state.
3. Run the required baseline verification.
4. Run `milestone:start`.
5. Implement only the active milestone plus strictly necessary supporting work.
6. Add or update automated evidence while implementing.
7. Exercise user-visible behavior through the browser when required.
8. Run domain/invariant checks when relevant.
9. Close it with the `milestone-close` skill
   (`.claude/skills/milestone-close/SKILL.md`): review the diff, run the
   required reviewers, fix findings, re-run verification once on the final
   source, do the documentation sweep of `docs/DOCS_SYSTEM.md`, then
   `milestone:complete` and one descriptive checkpoint commit.
10. Only then begin the next milestone.

Do not carry an unexplained dirty working tree from one completed milestone into
the next.

## 7. Milestone categories

- **FOUNDATION** — environment, persistence and infrastructure. Emphasis:
  reproducibility, buildability, deterministic verification, persistence smoke
  tests, minimal complexity. An independent reviewer only when the milestone
  names one.
- **FEATURE** — a normal user-facing feature. Emphasis: relevant unit and
  component tests, browser exercise of the real UI, screenshots or visual
  inspection where useful, persistence when the feature stores data,
  self-review.
- **RULE_HEAVY** — business-rule-dense work such as Comandate and warnings.
  Emphasis: canonical tables, table-driven, edge and boundary tests, invariant
  checks, browser workflows, and one independent adversarial reviewer before
  closure who tries to falsify the implementation, not merely approve it.
- **INTEGRATION_GATE** — after a meaningful subsystem or at a release.
  Emphasis: a realistic multi-step scenario, regression across dependent
  features, browser exercise, invariant checks, at least one functional and
  one UX reviewer, fix and rerun before closure. A release gate uses multiple
  specialized reviewers.

## 8. Reviewer policy

Do not spam reviewers for trivial work; use the level the milestone specifies.
Possible roles:

- domain prosecutor: find business-rule violations;
- field UX reviewer: assess hurried/mobile/outdoor usage;
- data-integrity reviewer: find impossible or inconsistent states;
- regression hunter: probe interactions between features;
- scope reviewer: detect missing behavior or work outside the approved scope;
- code-quality reviewer: simplicity, duplication, dead code, overengineering;
- accessibility/mobile reviewer: touch targets, focus, viewport, input behavior;
- chaos user: use the app in unusual order and try to break assumptions;
- security/privacy reviewer: what leaves the device, access rules, keys,
  deletion — required for any milestone whose app adds network calls, a
  backend, authentication, sharing, export or logs;
- sync-chaos reviewer ("two phones offline"): concurrent offline edits,
  reconnect order, stale app versions, interrupted uploads — required for any
  milestone that touches sync, the upload queue, schema versions or conflict
  rules.

Each role is a persona in `.claude/agents/reviewer-<role>.md`, and every
reviewer follows `docs/agents/REVIEW_PROTOCOL.md`. Its structured JSON report,
recorded as evidence, gives the verdict (PASS / PASS_WITH_FINDINGS / FAIL),
blockers, important findings, QoL findings, evidence inspected and the angles
tried. FAIL blocks completion. PASS_WITH_FINDINGS closes only with zero
blockers and when the milestone's acceptance allows the remaining findings.

## 9. Browser verification

When a milestone requires browser use, prefer Playwright journeys that act as a
user: tap or click visible controls, enter data through the UI, reload or close
and reopen when persistence matters, assert visible outcomes, and capture
screenshots when they materially help review. Setup and seeding may use
helpers, but the behavior under verification goes through the visible app.
Never claim UI completion from internal function calls or direct state changes.

## 10. Canonical domain truth

Approved mappings and finite rule tables live once, in explicit typed domain
configuration, and UI, options and tests derive from them where practical:
course → default boat type and standard crew size where defined, allowed boat
types, session
and duty-day order, evaluation values, fault states, crew destinations, the
size-warning matrix and the other finite enumerations of the Product
Specification. Algorithmic rules are deterministic domain functions with
exhaustive or table-driven tests rather than configuration.

Do not change canonical product semantics to make tests pass. If code or tests
and the Product Specification disagree, fix the implementation or escalate a
genuine contradiction.

## 11. Domain invariant checker

Maintain a simple invariant checker over persisted course state. Where feasible
it detects duplicate IDs, dangling references, the same student twice or the
same sailing boat in two crews in one session, invalid session IDs or enum
values, and evaluations or faults pointing at missing records. It protects
structural integrity; it does not replace user-facing warnings.

## 12. Evidence

Each milestone owns a small `.evidence/<ID>/`: `verification.json` written by
`npm run evidence`, required reviews, useful screenshots and concise limitation
notes, never bulk artifacts. Evidence supports the specs, code, tests and Git
history without replacing them; once its milestone is complete it only grows.

## 13. Git protocol

Git is part of the harness. Before a milestone: inspect `git status`,
understand the latest checkpoint and confirm the baseline is healthy. Before
completion: review `git diff`, pass the mandatory verification, update
milestone status and evidence, and commit with a descriptive message. Prefer one
clean checkpoint per completed milestone, with extra checkpoints inside very
large or risky milestones. Do not rewrite or erase healthy history to hide a
failed approach.

The published history was rewritten once, immediately before the first 0.3.0
push, to remove real roster data (owner decision of 2026-09-26). Never pull,
merge, rebase, cherry-pick or push from a copy of the repository made before
that rewrite: re-clone, or reset its branches to `origin` first.
`npm run check:repository` fails when `HEAD` contains a commit listed in
`.evidence/F1/history-rewrite.json` as `preRewriteCommits`, CI fetches the full
history so the same check runs there, and the pre-push hook refuses such refs.

## 14. Retry and recovery

Do not repeat the same failing approach. After a repeated failure, classify the
cause — implementation bug, test bug, environment or tooling issue, unclear
requirement, dependency problem, architecture mismatch — and make the next
attempt produce new information or use a changed approach.

Use only fallbacks currently authorized in Technical Decisions. The completed
PowerSync spike is a settled decision; do not reopen it or switch storage
because a later implementation is difficult.

Escalate only if:

- authoritative documents genuinely contradict;
- a required feature appears impossible on the target platform;
- satisfying a requirement requires materially changing the chosen stack;
- satisfying a requirement requires removing/reducing approved product behavior;
- a spike fails and no authorized fallback exists;
- a decision would materially change UX/domain semantics.

Do not stop for ordinary implementation choices, naming, local refactors, CSS
details, straightforward dependency choices consistent with Technical
Decisions, or fixable bugs.

## 15. Scope discipline

Implement only the approved scope in `02_MVP_SCOPE.md`, the active plan and the
owner's latest explicit instructions. A deferred item requires an explicit
human scope change plus updated plan and evidence before implementation.

Do not prematurely add what `02_MVP_SCOPE.md` §4 assigns to a later release
(sync, sign-in and Supabase Auth, sharing, several courses, conflict handling)
or what §2 defers (native packaging, generic content systems, automatic crew
generation beyond scope), nor a non-goal of `03_TECHNICAL_DECISIONS.md` §8.
Never add speculative abstractions.

## 16. Runtime preflight

The repository requires Node 24. If PATH exposes an older Node, do not lower
`engines` or change the toolchain. `docs/LOCAL_DEVELOPMENT.md` has the local
runtime procedure. Record the actual runtime in verification evidence.

## 17. Completion standard

The active release is complete only when:

- all required active milestones and the integration gate are COMPLETE;
- `npm run verify:all` passes;
- the deterministic full-week scenario passes;
- final specialized reviews contain no blockers;
- known non-blocking limitations are recorded;
- the working tree is clean;
- the final Git checkpoint exists.

If deterministic or required physical-device verification fails, the release is
not complete. Physical-device evidence belongs to the owner on their devices;
never record a simulated PASS.

Private roster photographs and derivatives remain under ignored `data/private/`.
Never commit or publish them, raw OCR text or real students' personal data.
Only aggregate counts may enter evidence in this public repository.
Development, tests, seeds, CI and development backends use synthetic data
only, and no agent tool is ever connected to a production backend.

## 18. Agents, models and shared tools

**Model routing.** Claude Code: the latest Opus orchestrates, plans and
reviews every diff and screenshot; it delegates bounded implementation to
Sonnet through `.claude/agents/implementer.md`, and runs reviewers on Opus.
Codex: the latest Sol at xhigh orchestrates and decides what to delegate to
Luna at xhigh.

**Shared definitions.** Both agents use the same files. Reviewer personas are
in `.claude/agents/`; skills are in `.claude/skills/`, and Codex reads a
skill's `SKILL.md` directly when its description fits the task:

- `milestone-close`: closing a milestone and the documentation sweep;
- `field-operations-ui`: any screen or mockup work, with the design rulebook;
- `powersync` (vendored, `.vendor.json`): this project uses PowerSync. Load the
  powersync skill before any data, schema, or sync work. Repository rules win
  over its general advice: dependencies stay pinned by the lockfile.

`.mcp.json` adds the PowerSync documentation search (read-only).

**Hooks.** `npm install` points Git at `scripts/git-hooks`: a privacy and
secrets check before each commit, and a pre-rewrite history check before each
push. Never bypass them with `--no-verify`; fix a false positive in
`scripts/privacy-rules.mjs` with a test. Claude Code's SessionStart hook puts
Node 24 first in its Bash tool.

**Documents** follow `docs/DOCS_SYSTEM.md`: contracts describe the present,
evidence records what happened, the archive is frozen, and each sweep happens
at its moment.
