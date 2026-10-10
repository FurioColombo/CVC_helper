# Local development and verification

Read this when running the app or its checks. The operating contract is
`AGENTS.md`; the active work is in `04_IMPLEMENTATION_PLAN.md`.
Use `npm run milestone:status` for the compact current state before opening the
full milestone manifest.

## Runtime

Node **24.x** is required by `.node-version`, `package.json`, Vite and tests.
Check `node --version` before every verification run and record the version in
evidence. Do not change `engines` to accommodate a host's older default.

In Claude Code, the SessionStart hook in `.claude/settings.json` puts the fnm
Node 24 first on the Bash tool's PATH and removes fnm's `cd` alias, whose
failure used to make `cd dir && cmd` skip `cmd`. Run npm through the Bash
tool; the PowerShell tool still resolves the system Node.

In a Bash shell of your own with `fnm`, initialise it **before any `cd` in that
Bash call**:

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

## Git hooks

`npm install` (its `prepare` script) sets `core.hooksPath` to
`scripts/git-hooks`. Before each commit, `npm run check:staged` refuses private
paths (`data/`, database files, dumps, transcripts, network captures, `.env`
files, keys) and staged lines with secrets or, in docs, evidence and archives,
phone numbers other than the synthetic fixtures'. Real names are caught by an
optional local denylist, `data/private/privacy-denylist.txt` (one name or
number per line; it never leaves the machine). Before each push,
`scripts/check-push.mjs` refuses refs that contain pre-rewrite commits.

## Servers

| Port               | Purpose                 | Command                           |
| ------------------ | ----------------------- | --------------------------------- |
| 5173               | Vite development        | `npm run dev`                     |
| 4173               | Built PWA preview       | `npm run preview`                 |
| OS-assigned (RR-3) | Playwright-owned server | `npm run verify:e2e`              |
| 4174               | Playwright-owned server | `npx playwright test` (no runner) |

`npm run verify:e2e` (`scripts/run-e2e.mjs`) picks a free port itself and
passes it to Playwright as `CVC_E2E_BASE_URL`; `playwright.config.ts` starts
its own Vite dev server on that URL (`reuseExistingServer: false`), so a
browser run never attaches to a server left running by another worktree or a
stale build. Running Playwright directly, without the runner, falls back to
the historical fixed port 4174, still with its own dedicated server. For a
subpath preview use the same `CVC_BASE_PATH` used at build time;
`docs/DEPLOY.md` gives exact commands.

The built-in Claude browser pane stops inside the PowerSync worker with
`Failed to fetch a worker script`. Use Chrome or Playwright for browser
verification. V01 measured that the app works without `SharedArrayBuffer` and
does not require COOP/COEP; see `.evidence/V01/isolation-measurement.json`.
Do not substitute a manual glance for a required Playwright journey.

## Verification ladder

The ladder (what runs while editing, before a commit, at a close and at a gate)
and the flaky-test rule are `03_TECHNICAL_DECISIONS.md` §6. One spec runs with
`npm run verify:e2e -- tests/e2e/<spec>.spec.ts`; `npm run evidence -- <ID>`
records a milestone's scripts, `verify:e2e:focus` among them.

Do not pipe ESLint through `head` or `tail`; a broken pipe can hide its result.
OCR and microphone checks on actual phones belong to the owner and are never
recorded as passed from a simulator. The product UI is Italian; code, docs and
commit messages are English. Before handoff, keep plan, manifest and evidence
consistent and leave a clean checkpoint or a precise unfinished-state note.
