import { mkdirSync } from "node:fs"
import path from "node:path"

import type { TestInfo } from "@playwright/test"

/**
 * RR-10: `.evidence/<ID>/` holds tracked, reviewed artifacts for a closed
 * milestone (see AGENTS.md's Evidence section). An ordinary browser run must
 * never silently overwrite them.
 *
 * By default this returns a path inside Playwright's own per-test output
 * directory (`testInfo.outputPath`, already git-ignored), so a spec can keep
 * writing its screenshots/JSON exactly as before without touching tracked
 * evidence. Only when the environment variable `CVC_EVIDENCE_REFRESH` is set
 * to exactly this milestone ID does it return the tracked `.evidence/<ID>/`
 * path instead, for a deliberate, reviewed refresh, e.g.:
 *
 *   CVC_EVIDENCE_REFRESH=UG1 npx playwright test -c data/private/e2e/playwright.4374.config.ts ...
 */
export function evidenceOutputPath(
  testInfo: TestInfo,
  milestoneId: string,
  ...pathSegments: string[]
) {
  if (process.env.CVC_EVIDENCE_REFRESH === milestoneId) {
    const directory = path.resolve(".evidence", milestoneId)
    mkdirSync(directory, { recursive: true })
    return path.join(directory, ...pathSegments)
  }
  return testInfo.outputPath(...pathSegments)
}
