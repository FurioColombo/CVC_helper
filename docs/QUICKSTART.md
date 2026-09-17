# Quickstart

CVC Helper is a mobile-first offline PWA for running one week of a CVC sailing course:
students, boats and faults, Comandate, crews with boat assignment, evaluations and
volunteers (ADV/IS/CT). Data stays on the device in a local PowerSync database — no
account, backend or sync; Italian OCR reads student sheets and Italian speech dictates
notes. Baseline 0.1.0 is released; the 0.2.0 field-UX cycle is open at its release gate.

## Where things are

- `AGENTS.md` — execution protocol: read order, evidence and Git rules; start here.
- `CLAUDE.md` — the same contract plus this machine's runtime, ports and handover rules.
- `01`–`04_*.md` — product spec, scope, technical decisions, milestone plan.
- `src/domain`, `src/persistence` — pure rules, canonical tables, local database.
- `src/features`, `src/components`, `src/capabilities` — pages, shared UI, OCR/speech.
- `tests/e2e`, `scripts/` — Playwright journeys; verification and milestone tooling.
- `.evidence/<ID>/` — per-milestone verification, reviews and screenshots.
- `docs/post-mvp/` — design rulebook, page changelog, frozen mock, device checklist.

## Run it

Node 24 is required (`.node-version`); Node 18 and 22 fail on Vite. This machine
has no Node 24 on PATH — `CLAUDE.md` records where to find one. Then `npm ci`,
`npm run dev` for the app on http://localhost:5173, `npm run build` for the PWA.
Checks: `npm run verify:quick` (lint, format, types, unit), `npm run verify` (adds
domain checks and the build), `npm run verify:all` (adds full week and Playwright);
record a milestone with `npm run evidence -- <ID>`. Ports: dev 5173,
`npm run preview` 4173, Playwright 4174.
