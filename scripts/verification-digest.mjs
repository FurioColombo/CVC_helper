import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

/**
 * A digest of every file a verification run can depend on: tracked and
 * untracked, ignored files excepted. Evidence, milestone metadata and
 * Markdown are left out, because they are written after verification (reviews,
 * plan status) without changing what was verified. A completion is accepted
 * only while this digest still equals the one its recorded run saw, so code
 * changed after the run, or a run made on another tree, cannot close a
 * milestone.
 */
export function sourceDigest(root) {
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 },
  )
    .split("\0")
    .filter(Boolean)
    .filter(
      (path) =>
        !path.startsWith(".evidence/") &&
        !path.startsWith(".milestones/") &&
        !path.endsWith(".md"),
    )
    .sort()
  const hash = createHash("sha256")
  for (const path of files) {
    let content
    try {
      content = readFileSync(resolve(root, path))
    } catch {
      // A tracked file deleted in the working tree is part of the state.
      content = Buffer.from("<deleted>")
    }
    hash.update(path)
    hash.update("\0")
    hash.update(createHash("sha256").update(content).digest("hex"))
    hash.update("\n")
  }
  return { digest: hash.digest("hex"), files: files.length }
}

export const RECORDER_ID = "scripts/record-verification.mjs@3"
