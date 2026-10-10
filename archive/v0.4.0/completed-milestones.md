# 0.4.0 completed milestone sections

Each completed milestone's section, moved here unchanged at its close
(`docs/DOCS_SYSTEM.md` rule 4). The plan keeps its status row.

## H1 — Harness and documentation reset

**Category:** FOUNDATION
**Status:** IN_PROGRESS

1. Merge `claude/harness-0.4-prep`. `npm install` activates the Git hooks; the
   owner adds the PowerSync documentation server to Codex's configuration.
2. Run the retrospective with `docs/agents/RETROSPECTIVE_PROMPT.md` in a
   separate session; adopt the changes the owner picks from its report.
3. Move the documents into the `docs/DOCS_SYSTEM.md` layout:
   - `docs/post-mvp/06`, `07` and `mockups/` go to `docs/design/`;
   - `UG1_DEVICE_VALIDATION.md` becomes the contract `docs/DEVICE_CHECKS.md`;
   - the 0.3.0 working documents are folded, open items going to
     `docs/working/BACKLOG.md`, and archived under `archive/v0.3.0/`;
   - `AGENTS.md` is trimmed to 300 lines, each removed rule given a home;
   - `02_MVP_SCOPE.md` is rewritten in the present tense;
   - every path in scripts, tests and documents is updated, and `check:docs`
     runs in `verify:domain` and before `milestone:complete`.
4. Make the checks faster, measuring before and after on an idle machine:
   - unit tests in a Node environment by default, the browser environment only
     for component tests;
   - the `iphone-13-viewport` project limited to layout-sensitive specs;
   - Playwright with two workers if three runs show no new flake;
   - CI on `push` only (the deploy waits for it), superseded runs cancelled,
     and browser tests skipped for documentation-only commits;
   - a flaky test listed in evidence and the backlog as a defect;
   - the new verification ladder written into `03_TECHNICAL_DECISIONS.md` §6:
     an ordinary close runs `verify` plus the affected browser specs,
     `verify:all` runs at gates and in CI.
5. Review npm 11's install-script allowlist (esbuild, onnxruntime-node,
   protobufjs, tesseract.js) so `npm ci` is clean locally and in CI.

**Success predicate:** on the merged branch `check:docs` passes inside
`verify:domain`, `verify:all` passes with no test lost except duplicates named
in the timing evidence, and local unit and browser test times each fall by at
least 30% against the recorded baseline.

**Adversarial checklist:** a spec that ends up in no project; a geometry check
moved off a viewport it needed; a moved document breaks a path used by a script
or test; a hook that blocks a legitimate commit, or passes on Windows when it
should fail; the Pages deploy no longer waiting for CI on `main`; a rule lost in
the `AGENTS.md` trim; tests that pass in the Node environment only because their
DOM assertions no longer run.

**Evidence:** `verification.json` (`verify:all`), `test-timing.json` (before and
after), `docs-move.json` (old path → new home), `retro-adoption.json` (the
owner's picks from the retrospective), self-review, scope and code-quality
reviews.
