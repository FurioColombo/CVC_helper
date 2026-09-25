# Local development and verification

Read this when running the app or its checks. The operating contract is
`AGENTS.md`; the active work is in `04_IMPLEMENTATION_PLAN.md`.
Use `npm run milestone:status` for the compact current state before opening the
full milestone manifest.

## Runtime

Node **24.x** is required by `.node-version`, `package.json`, Vite and tests.
Check `node --version` before every verification run and record the version in
evidence. Do not change `engines` to accommodate a host's older default.

In Bash with `fnm`, initialise it **before any `cd` in that Bash call**:

```bash
eval "$(fnm env --shell bash)"
cd /path/to/CVC_helper
fnm use
node --version
```

In Codex Desktop, `load_workspace_dependencies` supplies a bundled Node 24
when the host PATH is older. Put its `node/bin` directory first on PATH for
the entire shell, including npm's child processes. A direct call to Node 24
while npm scripts still resolve an older `node` is insufficient. A version
manager that reads `.node-version` is also valid.

## Servers

| Port | Purpose                 | Command              |
| ---- | ----------------------- | -------------------- |
| 5173 | Vite development        | `npm run dev`        |
| 4173 | Built PWA preview       | `npm run preview`    |
| 4174 | Playwright-owned server | `npm run verify:e2e` |

The browser suite checks that a reused 4174 process is the Vite server. Stop
stray servers before a browser run. For a subpath preview use the same
`CVC_BASE_PATH` used at build time; `docs/DEPLOY.md` gives exact commands.

The built-in Claude browser pane stops inside the PowerSync worker with
`Failed to fetch a worker script`. Use Chrome or Playwright for browser
verification. V01 measured that the app works without `SharedArrayBuffer` and
does not require COOP/COEP; see `.evidence/V01/isolation-measurement.json`.
Do not substitute a manual glance for a required Playwright journey.

## Verification ladder

- During edits: focused `npm run test -- <file>` or a relevant Playwright spec.
- Before every checkpoint commit: `npm run verify:quick`.
- At an ordinary milestone close: the commands required by its manifest entry,
  usually `npm run verify` plus focused browser evidence.
- At UG2 only: `npm run verify:all`, including full week and browser matrix.

Do not pipe ESLint through `head` or `tail`; a broken pipe can hide its result.
OCR and microphone checks on actual phones belong to the owner and are never
recorded as passed from a simulator. The product UI is Italian; code, docs and
commit messages are English. Before handoff, keep plan, manifest and evidence
consistent and leave a clean checkpoint or a precise unfinished-state note.
