# M14 code-quality review

## Verdict

PASS_WITH_FINDINGS

## Blockers

None.

## Important findings

None. Node 24 is pinned and checked; Duty and Crew loading now share their invariant-validated readers; retry behavior is covered; obsolete probe, predicate and type paths were removed; the retained `meta` table has a compatibility rationale; and the built PWA is asserted.

## Quality-of-life findings

- MediaRecorder lifecycle code remains similar across three voice-entry flows. Their behavior differs enough that extraction is optional post-MVP cleanup.
- The app and transformer bundles remain large, but the expensive capabilities are used and reached lazily. Optimization should follow measured device evidence.
- A few helper packages are reported as extraneous by `npm ls`, while `npm prune --dry-run` removes nothing; no safe application dependency removal was identified.

## Evidence inspected

- Complete M14 diff and `git diff --check`.
- Runtime pinning, package scripts, README, repository checks, PWA build assertions, manifest, icons and service worker.
- Duty retry implementation/test and Crew shared load/validation path/tests.
- Domain and persistence dead-code cleanup, dependency usage and CI/browser configuration.
- Final reported quick verification (31 files / 233 tests), domain checks and production build.
