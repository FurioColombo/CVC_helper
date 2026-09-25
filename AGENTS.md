# AGENTS.md

This repository is the shared operating contract for Codex and Claude Code.

The human should be able to start work with a very short prompt. Therefore the repository itself is the operating contract, source of truth, progress tracker, and verification harness.

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
   `docs/post-mvp/06_DESIGN_RULEBOOK.md` and
   `docs/post-mvp/07_PAGE_CHANGELOG.md`, then inspect the frozen mock target linked
   there.
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
6. `docs/post-mvp/06_DESIGN_RULEBOOK.md` and the frozen target in
   `docs/post-mvp/07_PAGE_CHANGELOG.md` for visual/interaction implementation;
7. code/tests/configuration.

Do not silently resolve a real contradiction by changing product semantics.

## 3. Core operating principle

A milestone is not complete because code was written.

A milestone is COMPLETE only when the repository contains verifiable evidence that the required behavior works.

Prefer programmatic evidence over prose whenever possible.

If a rule can reasonably be:
- represented as canonical data;
- linted;
- type-checked;
- tested;
- checked as an invariant;
- exercised through the browser;
- or re-run in CI,

then implement that verification instead of relying only on memory or narrative instructions.

## 4. Harness-first rule

The original 0.1.0 Harness Foundation and the 0.2.0 activation milestone are
complete. Do not replace the harness or reopen old milestones. Before substantive
work, confirm the first incomplete milestone and its baseline in
`04_IMPLEMENTATION_PLAN.md`.

The harness must be in place first so all later work is continuously verifiable.

The Harness Foundation includes, at minimum:
- Git repository hygiene and checkpoint workflow;
- package scripts for quick and full verification;
- ESLint;
- formatting check;
- TypeScript typecheck;
- Vitest;
- React Testing Library;
- Playwright;
- production build verification;
- deterministic seed/scenario helpers;
- domain invariant checking;
- a small custom repository/domain check script;
- milestone metadata;
- evidence storage;
- milestone start/check/complete commands;
- browser smoke testing;
- CI that re-runs deterministic checks.

Do not begin a feature milestone when a previous milestone is incomplete.

## 5. Required verification commands

Create and maintain a simple command surface. Exact internal implementation may vary, but the repository should expose commands equivalent to:

- `npm run verify:quick`
  - lint
  - formatting check
  - typecheck
  - fast/unit/domain tests

- `npm run verify:e2e`
  - Playwright user-visible browser tests required by the current scope

- `npm run verify:domain`
  - canonical domain-table checks
  - domain invariants
  - structural checks

- `npm run verify`
  - all deterministic checks appropriate for an ordinary milestone
  - production build

- `npm run verify:all`
  - complete deterministic MVP verification including E2E and full-week scenario once available

- `npm run milestone:start -- <ID>`
- `npm run milestone:check -- <ID>`
- `npm run milestone:complete -- <ID>`
- `npm run evidence -- <ID>`

Keep these commands boring, transparent, and easy for an agent to inspect.

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
9. Review the diff.
10. Perform the required self-review/reviewer level.
11. Fix findings.
12. Re-run required verification.
13. Run `milestone:complete`.
14. Update milestone status, evidence summary, decisions, and known limitations in `04_IMPLEMENTATION_PLAN.md`.
15. Sweep the working and evidence directories and move or remove what the milestone made and nobody needs.
16. Create a descriptive Git checkpoint commit.
17. Only then begin the next milestone.

Do not carry an unexplained dirty working tree from one completed milestone into the next.

## 7. Milestone categories

### FOUNDATION
Use for environment, persistence and infrastructure.

Required emphasis:
- reproducibility;
- buildability;
- deterministic verification;
- persistence smoke tests;
- minimal complexity.

Independent reviewer is not normally required.

### FEATURE
Use for a normal user-facing feature.

Required emphasis:
- relevant unit/component tests;
- browser exercise of the real UI;
- screenshots or visual inspection where useful;
- persistence if the feature stores data;
- self-review.

### RULE_HEAVY
Use for business-rule-dense features such as Comandate and warning logic.

Required emphasis:
- canonical tables where appropriate;
- table-driven tests;
- edge/boundary tests;
- domain invariant checks;
- browser workflows;
- one independent adversarial/domain reviewer before closure.

The reviewer should attempt to falsify the implementation, not merely approve it.

### INTEGRATION_GATE
Use after a meaningful subsystem or at final MVP validation.

Required emphasis:
- realistic multi-step scenario;
- regression across dependent features;
- browser exercise;
- invariant checks;
- at least one functional reviewer and one UX reviewer;
- fix and rerun before closure.

The final MVP gate uses multiple specialized reviewers.

## 8. Reviewer policy

Do not spam reviewers for trivial work.

Use the reviewer level specified by the milestone.

Possible roles:
- domain prosecutor: find business-rule violations;
- field UX reviewer: assess hurried/mobile/outdoor usage;
- data-integrity reviewer: find impossible or inconsistent states;
- regression hunter: probe interactions between features;
- scope reviewer: detect missing MVP behavior or unnecessary post-MVP work;
- code-quality reviewer: simplicity, duplication, dead code, overengineering;
- accessibility/mobile reviewer: touch targets, focus, viewport, input behavior;
- chaos user: use the app in unusual order and try to break assumptions.

Reviewer output is structured JSON recorded as
evidence with:
- verdict: PASS / PASS_WITH_FINDINGS / FAIL;
- blockers;
- important findings;
- QoL findings;
- evidence inspected.

FAIL blocks milestone completion.
PASS_WITH_FINDINGS may close only with zero blockers and when milestone acceptance criteria allow the remaining findings.

## 9. Browser verification

For user-visible features, direct browser use is required when the milestone says so.

Prefer Playwright journeys that interact with the application as a user:
- tap/click visible controls;
- enter data through UI;
- reload/close/reopen when persistence matters;
- verify visible outcomes;
- capture screenshots when they materially help review.

Do not claim UI completion based only on calling internal functions or mutating state directly.

Test setup/seeding may use helpers, but the behavior under verification should go through the visible app.

## 10. Canonical domain truth

Approved mappings and finite rule tables should live in explicit, inspectable domain configuration rather than being duplicated through the codebase.

Examples include:
- course -> default boat type;
- allowed boat types;
- course -> standard crew size where defined;
- session ordering;
- duty-day ordering;
- evaluation values;
- fault states;
- crew destinations;
- size-warning matrix;
- other finite enumerations/mappings in the Product Specification.

Use readable typed data structures and derive UI/options/tests from them when practical.

For algorithmic rules, prefer a deterministic domain function plus exhaustive/table-driven tests rather than forcing the rule into configuration.

Do not change canonical product semantics merely to make tests pass. If code/tests and Product Specification disagree, fix the implementation or escalate a genuine contradiction.

## 11. Domain invariant checker

Maintain a simple invariant checker over persisted course state.

It should detect impossible/corrupt states where feasible, for example:
- duplicate entity IDs;
- dangling references;
- same student assigned twice in the same session;
- same sailing boat assigned to multiple crews in one session;
- invalid session IDs;
- invalid destination/state enum values;
- evaluation referring to missing student/session;
- fault referring to missing boat.

This checker is not a replacement for user-facing warnings. It verifies structural/data integrity.

## 12. Evidence

Use a lightweight `.evidence/` directory for milestone artifacts produced during autonomous work.

Recommended shape:

`.evidence/<MILESTONE_ID>/`
- `verification.json` or equivalent machine-readable summary;
- reviewer reports when required;
- selected screenshots when useful;
- concise notes about known limitations.

Do not store unnecessary bulk artifacts.

Evidence is supportive. The source of truth remains the specs, code, tests and Git history.

## 13. Git protocol

Git is part of the harness.

Before a milestone:
- inspect `git status`;
- understand the latest checkpoint;
- confirm baseline is healthy.

Before completion:
- review `git diff`;
- ensure mandatory verification passes;
- update milestone status/evidence;
- commit with a descriptive message.

Prefer one clean checkpoint per completed milestone, with additional checkpoints inside very large/risky milestones if useful.

Do not rewrite or erase healthy history merely to hide a failed approach.

## 14. Retry and recovery

Do not repeat the same failing approach indefinitely.

After a repeated failure, classify the cause:
- implementation bug;
- test bug;
- environment/tooling issue;
- unclear requirement;
- dependency problem;
- architecture mismatch.

A repeated attempt must produce new information or use a changed approach.

Use only fallbacks currently authorized in Technical Decisions. The completed
PowerSync spike is a settled decision; do not reopen it or switch storage merely
because a later implementation is difficult.

Escalate only if:
- authoritative documents genuinely contradict;
- a required feature appears impossible on the target platform;
- satisfying a requirement requires materially changing the chosen stack;
- satisfying a requirement requires removing/reducing approved product behavior;
- a spike fails and no authorized fallback exists;
- a decision would materially change UX/domain semantics.

Do not stop for ordinary implementation choices, naming, local refactors, CSS details, straightforward dependency choices consistent with Technical Decisions, or fixable bugs.

## 15. Scope discipline

Implement only the current approved scope in `02_MVP_SCOPE.md`, the active plan
and the owner's latest explicit instructions. A deferred item requires an
explicit human scope change plus updated plan and evidence before implementation.

In particular, do not prematurely add:
- multi-device synchronization;
- multi-editor conflict UI;
- Supabase Auth;
- native packaging;
- broad backend infrastructure;
- generic content/document systems;
- automatic crew generation beyond approved scope;
- speculative abstractions.

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
