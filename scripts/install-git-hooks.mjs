// npm's prepare script: point Git at the shared hooks in scripts/git-hooks, so
// the privacy and history checks run for every agent and person who commits or
// pushes from this clone. Outside a Git checkout (a packed tarball) it does
// nothing.
import { execFileSync } from "node:child_process"

try {
  execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
    stdio: "ignore",
  })
} catch {
  process.exit(0)
}
execFileSync("git", ["config", "core.hooksPath", "scripts/git-hooks"])
console.log("Git hooks: core.hooksPath = scripts/git-hooks")
