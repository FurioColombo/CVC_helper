# Quickstart

CVC Helper is a mobile-first offline PWA for running one week of a CVC sailing course:
students, boats and faults, Comandate, crews with boat assignment, evaluations and
volunteers (ADV/IS/CT). Data stays on the device in a local PowerSync database — no
account, backend or sync; Italian OCR reads student sheets and Italian speech dictates
notes. 0.2.0, the field-UX release, was tagged on 2026-09-21; the 0.3.0 cycle is the
active work and lives on `codex/0.3.0`.

## Where things are

- `AGENTS.md` — execution protocol: read order, evidence and Git rules; start here.
- `CLAUDE.md` — the small Claude Code entry point to the shared contract.
- `docs/LOCAL_DEVELOPMENT.md` — Node 24, ports and browser verification, read
  when needed.
- `01`–`03_*.md` — product spec, scope and technical decisions; consult the
  relevant sections for the active milestone.
- `04_IMPLEMENTATION_PLAN.md` — short active ledger. Completed plan history is
  preserved under `archive/` and is not in the default read path.
- `src/domain`, `src/persistence` — pure rules, canonical tables, local database.
- `src/features`, `src/components`, `src/capabilities` — pages, shared UI, OCR/speech.
- `tests/e2e`, `tests/fixtures`, `scripts/` — Playwright journeys and their inputs;
  verification and milestone tooling, the speech benchmark and the OCR diagnostic.
- `.evidence/<ID>/` — per-milestone verification, reviews and screenshots for the
  active cycles; the closed 0.1.0 evidence is in `archive/v0.1.0/evidence/`.
- `docs/post-mvp/` — design rulebook, page changelog, frozen mock, device checklist,
  and `0_3_0_OWNER_BRIEF.md`, the human decision record driving 0.3.0.

## Run it

Node 24 is required (`.node-version`); Node 18 and 22 fail on Vite. If
`node --version` is not 24.x, `docs/LOCAL_DEVELOPMENT.md` explains the runtime.
Then `npm ci`, `npm run dev` for the app on http://localhost:5173, and
`npm run build` for the PWA. Checks: `npm run verify:quick` (lint, format, types,
unit), `npm run verify` (adds domain checks and the build), `npm run verify:all`
(adds full week and Playwright); record a milestone with `npm run evidence -- <ID>`.
Ports: dev 5173, `npm run preview` 4173, Playwright 4174.
