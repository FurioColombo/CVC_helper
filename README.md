# CVC Helper

CVC Helper is a mobile-first offline PWA for running one week of a CVC sailing
course: students, boats and faults, Comandate, crews with boat assignment,
evaluations and volunteers (ADV/IS/CT). The released app (0.4.0) keeps data on
the device in a local PowerSync database, with no account or sync; 0.5.0, in
progress on `claude/0.5.0-prep`, adds an online backup after sign-in. Italian
OCR reads student sheets and Italian speech dictates notes. Releases are in
`CHANGELOG.md`.

## Start here

`AGENTS.md` is the shared operating contract for Codex and Claude Code: its
read order, source-of-truth hierarchy, evidence and Git rules. A startup prompt
can be as short as:

> Read `AGENTS.md` and the authoritative documents it references. Start from the
> first incomplete milestone in `04_IMPLEMENTATION_PLAN.md` and execute it
> autonomously. Follow its scope, target, verification, evidence, review and Git
> requirements.

## Where things are

- `01`–`03_*.md` — product spec, scope and the road to 1.0.0 (`02` §4),
  technical decisions; `04_IMPLEMENTATION_PLAN.md` — the active plan, with
  **Where this cycle stands**.
- `docs/LOCAL_DEVELOPMENT.md` — Node 24, ports and browser verification;
  `docs/DOCS_SYSTEM.md` — how documents are kept current.
- `docs/design/` — design rulebook, page changelog and frozen mocks;
  `docs/DEVICE_CHECKS.md` — the owner's phone checks; `docs/OWNER_TODO.md` —
  open owner actions; `docs/working/` — temporary owner-facing documents,
  including `BACKLOG.md`; `docs/agents/` — the review protocol.
- `src/domain`, `src/persistence` — pure rules, canonical tables, local database.
- `src/features`, `src/components`, `src/capabilities` — pages, shared UI, OCR/speech.
- `tests/e2e`, `tests/fixtures`, `scripts/` — Playwright journeys and their inputs;
  verification and milestone tooling, the speech benchmark and the OCR diagnostic.
- `.evidence/<ID>/` — per-milestone verification, reviews and screenshots for the
  active cycles; the closed 0.1.0 evidence is in `archive/v0.1.0/evidence/`.
- `archive/` — frozen history, read only when someone asks why.

## Run it

Node 24 is required (`.node-version`, `package.json`); Node 18 and 22 fail on
Vite. If `node --version` is not 24.x, `docs/LOCAL_DEVELOPMENT.md` has the
runtime procedure; do not lower the repository runtime requirement. Then
`npm ci`, `npm run dev` for the app on http://localhost:5173, and
`npm run build` for the PWA. Checks: `npm run verify:quick` for the fast checks,
`npm run verify:all` for the complete build and browser suite
(`03_TECHNICAL_DECISIONS.md` §6 lists every command); record milestone
verification with `npm run evidence -- <ID>`. Ports: dev 5173,
`npm run preview` 4173, Playwright 4174.

## Third-party assets

Icons come from `lucide-react`, the project's icon dependency (ISC licence).
Three student figures in `src/components/PersonBadges.tsx` are Material Symbols
outlines — `face_6`, `face_3` and `face` — © Google, used under the Apache
License 2.0, with the sunglasses added by this project. The attribution is kept
in that file; no icon dependency is added for them.

Boat marks under `public/brand/boats/` were supplied by the club and authorised
for use by the owner on 2026-09-18; see `02_MVP_SCOPE.md` section 3.
