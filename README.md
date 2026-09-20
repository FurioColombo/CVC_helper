# CVC Helper — 0.2.0 working set

This repository pack is intentionally designed so Codex can be started with a very short prompt and then operate autonomously from repository instructions.

## Read this first

Codex entrypoint: `AGENTS.md`

Authoritative documents:

1. `AGENTS.md` — autonomous execution protocol and verification contract.
2. `01_PRODUCT_SPEC.md` — user-visible behavior and business/domain rules.
3. `02_MVP_SCOPE.md` — completed 0.1.0 baseline and active 0.2.0 boundaries.
4. `03_TECHNICAL_DECISIONS.md` — architecture, stack and harness decisions.
5. `04_IMPLEMENTATION_PLAN.md` — ordered milestones, gates, evidence and progress ledger.

`archive/` is human-only design history unless explicitly requested.

For an active UI milestone, read only the relevant page sections in
`docs/post-mvp/06_DESIGN_RULEBOOK.md` and
`docs/post-mvp/07_PAGE_CHANGELOG.md`. The frozen r10 mock is linked there. Do not
load the design-review history by default.

## Intended startup prompt

A prompt can be as short as:

> Read `AGENTS.md` and the authoritative documents it references. Start from the
> first incomplete milestone in `04_IMPLEMENTATION_PLAN.md` and execute it
> autonomously. Follow its scope, target, verification, evidence, review and Git
> requirements.

The 0.1.0 harness and 0.2.0 activation foundation are complete. The plan's first
incomplete U-series milestone is the implementation entry point.

## Third-party assets

Icons come from `lucide-react`, the project's icon dependency (ISC licence).
Three student figures in `src/components/PersonBadges.tsx` are Material Symbols
outlines — `face_6`, `face_3` and `face` — © Google, used under the Apache
License 2.0, with the sunglasses added by this project. The attribution is kept
in that file; no icon dependency is added for them.

Boat marks under `public/brand/boats/` were supplied by the club and authorised
for use by the owner on 2026-09-18; see `02_MVP_SCOPE.md` section 5.

## Local environment

Use Node.js 24 and install the locked dependencies with `npm ci`. The required
major version is recorded in `.node-version` and `package.json`; older Node
releases are not supported by the current Vite and test toolchain.

Run `npm run verify:quick` for the fast checks or `npm run verify:all` for the
complete build and browser suite.

If the desktop PATH exposes an older Node, use Codex Desktop's bundled workspace
Node 24. Do not lower the repository runtime requirement. Record milestone
verification with `npm run evidence -- <ID>`.
