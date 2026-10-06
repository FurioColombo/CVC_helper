// Pre-push check (scripts/git-hooks/pre-push). The published history was
// rewritten before the first 0.3.0 push to remove real roster data; a copy made
// before that still holds the old commits. CI's check:repository can only
// report such a push after it happened. This refuses it here, for every ref
// being pushed, not only HEAD. Git passes "<local ref> <local sha> <remote ref>
// <remote sha>" lines on stdin.
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim()
const rewritePath = resolve(root, ".evidence/F1/history-rewrite.json")
if (!existsSync(rewritePath)) process.exit(0)

const { preRewriteCommits } = JSON.parse(readFileSync(rewritePath, "utf8"))
const input = readFileSync(0, "utf8")
const pushed = input
  .split("\n")
  .map((line) => line.trim().split(/\s+/))
  .filter(([localRef, localSha]) => localRef && /^[0-9a-f]{40}$/.test(localSha))
  .filter(([, localSha]) => !/^0+$/.test(localSha))

function isAncestor(commit, of) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", commit, of], {
      cwd: root,
      stdio: "ignore",
    })
    return true
  } catch {
    return false
  }
}

const refused = pushed.filter(([, localSha]) =>
  preRewriteCommits.some((commit) => isAncestor(commit, localSha)),
)
if (refused.length > 0) {
  console.error(
    "Push refused: these refs contain commits from before the 0.3.0 history rewrite (AGENTS.md §13). Re-clone, or reset this copy's branches to origin.",
  )
  for (const [localRef] of refused) console.error(`- ${localRef}`)
  process.exitCode = 1
}
