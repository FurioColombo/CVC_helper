# Caprera App — Codex Working Set

This repository pack is intentionally designed so Codex can be started with a very short prompt and then operate autonomously from repository instructions.

## Read this first

Codex entrypoint: `AGENTS.md`

Authoritative documents:
1. `AGENTS.md` — autonomous execution protocol and verification contract.
2. `01_PRODUCT_SPEC.md` — user-visible behavior and business/domain rules.
3. `02_MVP_SCOPE.md` — MVP boundaries.
4. `03_TECHNICAL_DECISIONS.md` — architecture, stack and harness decisions.
5. `04_IMPLEMENTATION_PLAN.md` — ordered milestones, gates, evidence and progress ledger.

`archive/` is human-only design history unless explicitly requested.

## Intended startup prompt

A prompt can be as short as:

> Read `AGENTS.md` and all authoritative documents it references. Start from the first incomplete milestone in `04_IMPLEMENTATION_PLAN.md` and execute autonomously. Follow all verification, evidence, review and Git requirements. Do not implement post-MVP scope.

The first real milestone is Harness Foundation: Codex must prepare the environment, verification tooling, milestone controller, browser automation, domain checks, CI and Git workflow before substantive feature implementation begins.
