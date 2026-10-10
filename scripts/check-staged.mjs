// Pre-commit check of what is about to be committed (scripts/git-hooks/
// pre-commit). It reads only the staged diff so a commit stays fast. It is the
// only content scan for personal data: check:repository checks only that
// data/private is untracked and that no absolute paths are committed.
//
// Never bypass it with --no-verify. A false positive is fixed in
// scripts/privacy-rules.mjs with a test, or, with the owner's explicit approval
// for that commit, CVC_PRIVACY_OVERRIDE="<reason>" lets content rules through
// (forbidden paths never pass).
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

import {
  addedLines,
  lineProblems,
  parseDenylist,
  pathProblem,
} from "./privacy-rules.mjs"

function git(args, cwd) {
  return execFileSync("git", ["-c", "core.quotePath=false", ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 256 << 20,
  })
}

const root = git(["rev-parse", "--show-toplevel"]).trim()
// A worktree has no ignored data/ of its own; the denylist lives in the main
// checkout, next to the shared .git directory.
const commonRoot = dirname(
  resolve(root, git(["rev-parse", "--git-common-dir"], root).trim()),
)
const denylistPath = [root, commonRoot]
  .map((base) => resolve(base, "data/private/privacy-denylist.txt"))
  .find((path) => existsSync(path))
const denylist = denylistPath
  ? parseDenylist(readFileSync(denylistPath, "utf8"))
  : []

const staged = git(
  ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
  root,
)
  .split("\0")
  .filter(Boolean)

const pathFailures = staged
  .map((path) => [path, pathProblem(path)])
  .filter(([, problem]) => problem)

const contentFailures = []
const diff = git(
  [
    "diff",
    "--cached",
    "-U0",
    "--no-color",
    "--no-ext-diff",
    // Fixed prefixes: diff.noprefix or a custom prefix would otherwise shift
    // every path and silently skip the phone rule.
    "--src-prefix=a/",
    "--dst-prefix=b/",
    "--diff-filter=ACMR",
    "--",
    ".",
    ":(exclude)package-lock.json",
  ],
  root,
)
for (const [path, lines] of addedLines(diff)) {
  for (const { lineNumber, text } of lines) {
    for (const problem of lineProblems(path, text, denylist)) {
      contentFailures.push(`${path}:${lineNumber}: ${problem}`)
    }
  }
}

const override = process.env.CVC_PRIVACY_OVERRIDE?.trim()
if (pathFailures.length > 0) {
  console.error("Commit refused: these files must never be committed.")
  for (const [path, problem] of pathFailures) {
    console.error(`- ${path}: ${problem}`)
  }
  process.exitCode = 1
}
if (contentFailures.length > 0) {
  if (override) {
    console.error(
      `Privacy content rules overridden for this commit: ${override}`,
    )
  } else {
    console.error(
      "Commit refused: staged lines look like real course data or secrets.",
    )
    for (const failure of contentFailures) console.error(`- ${failure}`)
    console.error(
      "Remove them, or use the synthetic values the fixtures use. See scripts/check-staged.mjs for the only override.",
    )
    process.exitCode = 1
  }
}
if (!process.exitCode) {
  console.log(
    `PASS: staged privacy check (${staged.length} files${denylistPath ? `, denylist of ${denylist.length}` : ", no local denylist"})`,
  )
}
