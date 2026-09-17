# CLAUDE.md

Claude Code and Codex both work on this repository, in alternating turns.

`AGENTS.md` is the operating contract for both of us and stays authoritative.
Read order, source-of-truth hierarchy, milestone lifecycle, reviewer policy,
evidence rules, Git protocol and scope discipline all live there and are not
repeated here. Read it completely before writing application code.

This file adds only what `AGENTS.md` does not cover: the local runtime, the
server ports, what can actually verify the app, and how to hand the repository
back to the other agent.

## Start of a turn

1. Run `git status` and `git log --oneline -5`. Identify the last checkpoint and
   any work in progress the other agent left behind. Do not clean up, revert or
   commit a dirty tree you did not create — ask first.
2. Follow the read order in `AGENTS.md` section 1.
3. Take the first milestone in `04_IMPLEMENTATION_PLAN.md` that is not COMPLETE.
   `.milestones/manifest.json` carries the same statuses in machine-readable form.
4. Do not reopen a COMPLETE milestone. A correction to already-completed work is
   recorded under the currently active milestone; the "Student scan redesign
   correction" entry under UG1 is the established pattern.

## Runtime: Node 24

The toolchain requires Node 24 (`.node-version`, `engines`). Vite 8, the test
runner and the build all fail on older releases. Do not lower `engines`, do not
change the toolchain, and do not substitute an ad-hoc server to work around a
wrong runtime.

A machine's default `node` is often older, so check before running anything:

```bash
node --version
```

If it is not 24.x, prefer a version manager that reads `.node-version` — fnm,
nvm, nvm-windows, asdf or volta — so this repository selects Node 24 without
changing the machine's default.

Failing that, put a Node 24 binary first on PATH for the whole shell. Calling
npm through the binary is not enough: npm scripts spawn `node` again from PATH,
so the child process silently falls back to the older runtime and fails on
`styleText`.

```bash
export PATH="/path/to/the/node24/directory:$PATH"
node --version
npm run verify:quick
```

Record the runtime actually used in milestone evidence, per `AGENTS.md`
section 16.

### Finding a Node 24 that is already present

`where node`, `which node` and `node --version` report only what PATH resolves
to, so none of them can tell you whether another runtime exists. Editors, CI
helpers, browser-test drivers and desktop agents commonly vendor their own Node
inside a cache directory, sometimes seven or eight levels deep, and those copies
work fine. Search the vendoring roots with generous depth before concluding
there is none:

```bash
# Windows (Git Bash)
find "$LOCALAPPDATA" "$APPDATA" "/c/Program Files" -maxdepth 8 -iname "node.exe" 2>/dev/null

# macOS and Linux
find ~/.cache ~/.local ~/Library /opt /usr/local -maxdepth 8 -name node -type f 2>/dev/null
```

Check each hit with `<path> --version`; any 24.x will do. Search the cache roots
themselves, not only the directories where applications are installed — a
vendored runtime is not an installed one. Such a copy can also disappear when
its owner updates, so treat it as a fallback rather than the arrangement, and
install a real Node 24 when you can.

Never conclude from a bounded search that a runtime the repository documents
does not exist. `AGENTS.md` section 16 asserts one, and that outranks a negative
result from a search whose limits you chose yourself.

## Servers and ports

| Port | Purpose           | Command              |
| ---- | ----------------- | -------------------- |
| 5173 | dev server        | `npm run dev`        |
| 4173 | built PWA preview | `npm run preview`    |
| 4174 | Playwright only   | `npm run verify:e2e` |

The browser suite owns 4174 with `strictPort`, and `scripts/run-e2e.mjs` reuses
a server on that port only after confirming it is really the Vite dev server.
Before this split, e2e shared 4173 with `vite preview`, and any stray process
there was adopted silently — a stale build could pass the suite.

Kill stray servers before an e2e run. Never serve `dist/` with an ad-hoc static
script: it does not reproduce the dev server's behavior and produces failures
that are not real.

## Verifying the app in a browser

- **Claude's built-in browser pane cannot run this app.** Its Chromium exposes no
  `SharedArrayBuffer`, so wa-sqlite cannot open the database and the app stops at
  "Archivio non disponibile / Non riesco ad aprire i dati locali". That is the
  pane, not a defect. Do not debug it.
- For a visual check, use the real Chrome tools instead. The app reaches the
  course-creation screen there against either the dev server or the preview build.
- Milestone evidence still means Playwright, per `AGENTS.md` section 9. A manual
  look in Chrome never substitutes for a journey.
- OCR and microphone acceptance require physical devices; follow
  `docs/post-mvp/UG1_DEVICE_VALIDATION.md` and never record a simulated PASS.

## Verification ladder

`npm run verify:all` is the release gate: unit and component tests, domain and
compatibility checks, the production build, the deterministic full week, and the
Playwright journeys across three device projects. Do not run it to check an edit.

- while editing — `npm run test -- <file>`, or
  `npm run verify:e2e -- <spec> --project=pixel-7-chrome`
- before a commit — `npm run verify:quick`
- at milestone close — whatever that milestone requires, up to `verify:all`

Do not pipe `eslint` output through `head` or `tail`. The broken pipe crashes its
formatter and hides the result; redirect to a file instead.

## Handing the repository back

Codex starts from `AGENTS.md` and the plan and treats the repository as the
contract, so before ending a turn:

- leave the tree clean, or leave an explicit note in the active milestone's
  section saying what is unfinished and why;
- keep `04_IMPLEMENTATION_PLAN.md`, `.milestones/manifest.json` and
  `.evidence/<ID>/` consistent with one another;
- make one descriptive checkpoint commit per completed milestone
  (`AGENTS.md` section 13);
- never rewrite history the other agent may already have built on.

## House conventions

- The product UI is Italian. Code, comments, documentation and commit messages
  are English.
- `archive/` is human design history. Do not read it unless a human asks.
- For an active UI milestone read only the relevant page sections of
  `docs/post-mvp/06_DESIGN_RULEBOOK.md` and `07_PAGE_CHANGELOG.md`.
- `docs/QUICKSTART.md` is the short orientation for a human arriving cold.
