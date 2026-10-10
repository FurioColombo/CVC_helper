// CI: does this push need the browser suite? Documentation, evidence, the
// archive, milestone metadata and agent definitions cannot change what the
// browser suite exercises, so a push that touches only them runs `verify`
// (lint, types, unit, domain and documentation checks, build) instead of
// `verify:all` — but only when this workflow's push run passed on the commit
// it builds on. By induction that commit's code passed the browser suite,
// either in its own run or in the run of the commit it built on. A failed,
// cancelled or running previous run, an unknown old tip (a new branch, a
// force-push to a commit not in this clone), an unreachable GitHub API or any
// other changed file runs everything. Prints `browser=true|false` for
// $GITHUB_OUTPUT.
import { execFileSync } from "node:child_process"
import { pathToFileURL } from "node:url"

const NO_BROWSER_IMPACT = [
  /\.md$/,
  /^\.evidence\//,
  /^archive\//,
  /^docs\//,
  /^\.milestones\//,
  /^\.claude\//,
  /^\.mcp\.json$/,
]

/** This workflow's file, whose push runs vouch for a commit's code. */
export const WORKFLOW_FILE = "ci.yml"

export function needsBrowser(changedFiles, previousTipPassed) {
  if (!previousTipPassed || changedFiles.length === 0) return true
  return changedFiles.some(
    (file) => !NO_BROWSER_IMPACT.some((pattern) => pattern.test(file)),
  )
}

/** The newest completed push run of this workflow on that commit succeeded. */
export function latestRunPassed(workflowRuns) {
  const completed = workflowRuns
    .filter((run) => run.event === "push" && run.status === "completed")
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
  return completed[0]?.conclusion === "success"
}

function changedFiles(before, after) {
  try {
    return execFileSync(
      "git",
      ["diff", "--name-only", "--no-renames", `${before}..${after}`],
      { encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean)
  } catch {
    // The old tip is not in this clone: run everything.
    return []
  }
}

async function previousTipPassed(before) {
  const { GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_API_URL } = process.env
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) return false
  try {
    const response = await fetch(
      `${GITHUB_API_URL ?? "https://api.github.com"}/repos/${GITHUB_REPOSITORY}/actions/workflows/${WORKFLOW_FILE}/runs?head_sha=${before}&event=push&per_page=100`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${GITHUB_TOKEN}`,
        },
      },
    )
    if (!response.ok) return false
    return latestRunPassed((await response.json()).workflow_runs ?? [])
  } catch {
    return false
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [before, after] = process.argv.slice(2)
  const known = Boolean(before) && !/^0+$/.test(before) && Boolean(after)
  const files = known ? changedFiles(before, after) : []
  const passed = known && (await previousTipPassed(before))
  console.log(`browser=${needsBrowser(files, passed)}`)
}
