# 0.3.0 development audit — 2026-09-25

This audit follows the owner's phone feedback on crew interactions. It checks
the current code, the active plan and manifest, the R1 request ledger, and the
verification harness. It uses synthetic browser data only; no private roster
photograph, transcript or personal record was inspected or copied into Git.
The UX2 interaction result is recorded in `.evidence/UX2/`.

## 1. Functionality and field quality of life

| Priority              | Finding                                                                                                                                                                                                                           | Decision                                                                                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before 0.3.0 gate     | A failed evaluation save can leave an attempted value unsaved while changing view or session remains possible (`src/features/evaluations/EvaluationManagement.tsx`).                                                              | F1 must require explicit retry or discard before navigation.                                                                                                                                             |
| Before 0.3.0 gate     | Moving during a student-card long press can still open the profile; invalid student edits can leave Back apparently inert; queued autosave can briefly under-report pending work (`src/features/students/StudentManagement.tsx`). | F1 already owns these corrections; test the gestures and save failures through the visible UI.                                                                                                           |
| Before 0.3.0 gate     | The installed-app manifest launch colour is cream (`vite.config.ts`), while the app surface is blue-grey (`src/styles.css`); the R1 ledger marks this missing although N1 closed.                                                 | F1 now owns reconciling the launch colour and checking the built manifest. N1's owner device checks remain unclaimed.                                                                                    |
| Required release work | V03 still needs owner-run speech checks on PC, Android and iPhone; V05's optional paste route, F1, and UG2 remain unfinished in `.milestones/manifest.json`.                                                                      | A completed UX2 is a phone-feedback checkpoint, not a completed 0.3.0 release.                                                                                                                           |
| Explicitly deferred   | S4's under-five OCR target and the D2–D5 capacity override are assigned to the final Claude Code handoff.                                                                                                                         | Do not quietly make them gate blockers or implement them without a scope change.                                                                                                                         |
| Post-gate proposal    | Course data is stored locally. Clearing browser data or changing phones can lose courses, evaluations and roster details; no user-facing restore route was found.                                                                 | Consider a user-controlled export and restore flow after the gate. Decide the privacy boundary, encryption, file handling and import validation first because records can contain minors' personal data. |

The best immediate quality-of-life gain is reliability in F1, especially
preventing a failed evaluation save from disappearing on navigation. No new
feature outranks that work on the evidence inspected. The backup proposal is a
concrete next-cycle candidate, subject to the owner's decision; further field
ideas should come from phone use rather than speculative UI additions.

The functional pass read the boat/fault, duty, volunteer, evaluation/history,
OCR and PWA/navigation implementations and their relevant tests. It found no
additional unowned functional gap in those areas. This was a code-and-evidence
audit, not a fresh end-to-end certification of every page: V05, F1, V03 owner
checks and UG2 still supply the missing release proof.

The broader Pixel crew journey also has a **pre-existing** geometry failure:
`u09-crews.spec.ts` expects the P14 quick-access rail above the fixed app
navigation, but measured `railBottom=986` and `appNavTop=589.6`. The same test
fails at commit `3dc4360`, before UX2. F1 now owns deciding whether the static
rail or the old assertion is wrong, then fixing that side before UG2. An
intermittent volunteer-case timeout in the combined run passed when repeated
alone on both baseline and current code; it is not evidence of a UX2 regression.

## 2. Code quality

No independent review found a code-quality blocker or an obvious dead
application path. The useful small cleanups are specific:

- `src/features/boats/BoatManagement.tsx` and
  `src/features/boats/FaultManagement.tsx` duplicate the parallel boat/fault
  read and `validateBoatRecords` guard. A shared validated reader would stop
  these error paths drifting. Do it with one focused regression after UX2.
- `src/App.tsx` and `src/features/students/StudentManagement.tsx` repeat the
  browser-history state keys. A tiny shared constants module would reduce Back
  navigation drift.
- `src/features/crews/CrewManagement.tsx` is roughly 2,900 lines and owns
  composition, boat paging, dialogs and reading/export views. Extract a stable
  subview after the gate, one at a time, with browser regression. A broad state
  framework or cosmetic rewrite would add risk now.

The existing domain, persistence and UI tests cover distinct scenarios. The
audit found no reason to remove them merely to make the suite shorter.

## 3. Document context and accuracy

| File                                 |                     Measured size | Audit                                                                                                                                                                                                          |
| ------------------------------------ | --------------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                          |                  14 KB, 287 lines | Mandatory full read each turn; condense repeated lifecycle/reviewer examples only after checking every rule against the harness. Keep read order, hierarchy, privacy, runtime and gate rules in the root file. |
| `.milestones/manifest.json`          |                             20 KB | Machine-readable truth; `npm run milestone:status` now prints a compact active-status projection so agents need not dump all old milestones into context.                                                      |
| `04_IMPLEMENTATION_PLAN.md`          | 27 KB before, 16 KB after cleanup | The N1, C1, E1, UX1 and UX2 detailed completed sections were moved intact to `archive/v0.3.0-completed-milestones.md`; concise status rows and evidence links remain active.                                   |
| `docs/post-mvp/07_PAGE_CHANGELOG.md` |                             43 KB | Large, but the contract already directs agents to the relevant page only. Keep the per-page source; do not require a full read.                                                                                |
| `docs/post-mvp/0_3_0_OPEN_ITEMS.md`  |                             21 KB | R1-era “missing” verdicts now conflict with completed milestones. A historical-snapshot warning was added; F1 should reconcile the remaining live items.                                                       |

The active Markdown files' local links resolved in a repository check. The old
`CLAUDE.md` is already archived; no second live instruction file needs removal.
The next document cleanup should shorten `AGENTS.md` only with a line-by-line
retention check. Rewriting the product
spec or design rulebook would risk losing authoritative behavior for little
context gain because they are already read selectively.

## 4. Tooling, harness and lessons

- Node 24.19.0 ran the baseline `verify:quick` with 537 passing tests. Its
  Vitest phase took 143.97 seconds; the last UX1 `verify` evidence records
  228.3 seconds for lint, format, typecheck, tests, domain and build. UX2's
  ordinary `verify` passed 538 tests and took 421.3 seconds, with the Vitest
  phase taking 266.3 seconds. The runtime varies substantially on this host;
  focused tests during edits and one full ordinary-gate run remain the right
  ladder.
- `vitest.config.ts` currently limits the suite to one worker. Vitest documents
  `maxWorkers` as a speed/memory tradeoff. Benchmark one and two workers on the
  same machine before changing the default; do not assume concurrency is safe.
- Playwright already has Pixel/iPhone projects, failed-run traces and CI
  artifacts. Its device emulation supports touch, but cannot replace an
  owner-run physical-device check. The UX1 adversarial reviewer caught an
  exact-slot persistence defect that earlier tests missed; retain a visible
  selection-and-reload journey for slot-sensitive changes.
- Some browser specs write directly into tracked `.evidence/V02/` or
  `.evidence/UG1/` on every run. The two locally dirty V02 files are an example.
  Freeze completed milestone evidence and route ordinary test artifacts to
  Playwright's per-test output path; use an explicit evidence-refresh mode only
  when a milestone is being measured. This avoids silently rewriting history.
- The local PATH can expose Node 18 even though the repository requires 24.
  A compact Node 24 preflight was added to the build, measurement and verification
  npm entry points so a wrong runtime stops before expensive work. A read-only
  `milestone:status` command now saves repeated full-manifest reads.

The existing `field-operations-ui` skill helped frame the touch review. A new
general CVC skill would mostly duplicate `AGENTS.md` and the npm harness. A
focused private-OCR measurement skill could be useful if that workflow repeats:
it should invoke the existing aggregate-count script, enforce the ignored
`data/private/` boundary and emit no raw roster text. Do not add it solely to
restate the current instructions. Official OpenAI guidance recommends concise,
task-triggered skills and selective repository reads; the current documentation
audit points in the same direction.

Sources for tooling guidance: [OpenAI on concise AGENTS.md and skills](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra),
[OpenAI skill design](https://developers.openai.com/plugins/build/skills),
[Vitest worker parallelism](https://main.vitest.dev/guide/parallelism), and
[Playwright device emulation](https://playwright.dev/docs/emulation).
