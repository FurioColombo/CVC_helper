// Enforces docs/DOCS_SYSTEM.md: every Markdown file has a class, contracts
// stay within budget, the plan holds open work only, working documents expire,
// the archive and the ledger stay frozen, and relative links resolve. The page
// changelog in docs/design/ is a contract: it holds each page's current state,
// edited in place with a dated amendment.
//
//   node scripts/check-docs.mjs                 everything, frozen files
//                                               against HEAD (or the commit
//                                               in CVC_DOCS_BASE, as in CI)
//   node scripts/check-docs.mjs --cached --frozen-only
//                                               the pre-commit hook: frozen
//                                               files in the staged changes
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const PLAN = "04_IMPLEMENTATION_PLAN.md"
const ARCHIVE_INDEX = "archive/README.md"
const ROOT_CONTRACTS = new Set([
  "AGENTS.md",
  "README.md",
  "01_PRODUCT_SPEC.md",
  "02_MVP_SCOPE.md",
  "03_TECHNICAL_DECISIONS.md",
  PLAN,
])
const BUDGETS = new Map([
  ["AGENTS.md", 300],
  [PLAN, 250],
  ["README.md", 80],
  ["docs/LOCAL_DEVELOPMENT.md", 120],
])
const CONTRACT_BUDGET = 700
const WORKING_BUDGET = 300
const STATUS_ROW_WORDS = 60
const VERSION = /^\d+\.\d+\.\d+$/

export function classify(path) {
  if (path.startsWith("archive/")) return "archive"
  if (path.startsWith(".claude/skills/powersync/")) return "vendored"
  if (path === "CHANGELOG.md" || path.startsWith(".evidence/")) return "ledger"
  if (path.startsWith("docs/working/")) return "working"
  if (
    ROOT_CONTRACTS.has(path) ||
    /^docs\/[^/]+\.md$/.test(path) ||
    path.startsWith("docs/agents/") ||
    path.startsWith("docs/design/") ||
    path.startsWith(".claude/agents/") ||
    path.startsWith(".claude/skills/") ||
    /^scripts\/(?:.+\/)?README\.md$/.test(path)
  )
    return "contract"
  return null
}

function versionAtLeast(version, target) {
  const a = version.split(".").map(Number)
  const b = target.split(".").map(Number)
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return true
}

/**
 * Frozen-file problems from `git diff --numstat --diff-filter=DM` lines. Only
 * deletions and modifications are listed, so an added file never appears; a
 * deleted file, a changed binary ("-") and a text file that lost lines are
 * edits. The archive is frozen, and so is the ledger: the changelog always,
 * a milestone's evidence once it was COMPLETE at the base (`completedAtBase`),
 * so the completing commit may still update its own. `allowed` holds the paths
 * whose edit archive/README.md newly approves.
 */
export function frozenProblems(numstatLines, completedAtBase, allowed) {
  const problems = []
  for (const line of numstatLines) {
    const [added, deleted, file] = line.split("\t")
    if (!file || deleted === "0") continue
    const evidenceOf = /^\.evidence\/([^/]+)\//.exec(file)?.[1]
    const docClass = classify(file)
    const frozen =
      docClass === "archive" ||
      (docClass === "ledger" &&
        (evidenceOf === undefined || completedAtBase.has(evidenceOf)))
    if (!frozen || allowed.has(file)) continue
    problems.push(
      `${file}: frozen file changed (${added} added, ${deleted} removed); only additions are allowed (docs/DOCS_SYSTEM.md rule 6)`,
    )
  }
  return problems
}

/** Paths that archive/README.md's exception section lists as approved. */
export function approvedFrozenEdits(archiveIndex) {
  // Only the dated list entries count, not the section's own explanation, and
  // the section ends at the next heading.
  const section = (archiveIndex.split(/^## The one exception/m)[1] ?? "").split(
    /^## /m,
  )[0]
  const entries = section.split("\n").filter((line) => line.startsWith("- "))
  return new Set(
    entries.flatMap((line) =>
      [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1]),
    ),
  )
}

/** An approval covers one change: only entries added since the base count. */
export function newlyApproved(indexNow, indexAtBase) {
  const atBase = approvedFrozenEdits(indexAtBase)
  return new Set(
    [...approvedFrozenEdits(indexNow)].filter((file) => !atBase.has(file)),
  )
}

function main() {
  // Not import.meta.dirname: the pre-commit hook may run on an older Node.
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const read = (path) => readFileSync(resolve(root, path), "utf8")
  const git = (args) =>
    execFileSync("git", ["-c", "core.quotePath=false", ...args], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 << 20,
      stdio: ["ignore", "pipe", "pipe"],
    })
  const args = process.argv.slice(2)
  const cached = args.includes("--cached")
  const frozenOnly = args.includes("--frozen-only")

  const problems = []
  const report = (path, message) => problems.push(`${path}: ${message}`)
  let markdownCount = 0

  if (!frozenOnly) {
    const manifest = JSON.parse(read(".milestones/manifest.json"))
    const statusOf = new Map(manifest.milestones.map((m) => [m.id, m.status]))
    const appVersion = JSON.parse(read("package.json")).version
    const markdown = git([
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
    ])
      .split("\0")
      .filter((path) => path.endsWith(".md") && existsSync(resolve(root, path)))
    markdownCount = markdown.length

    // 1. Classes, budgets, working headers, links.
    for (const path of markdown) {
      const docClass = classify(path)
      if (!docClass) {
        report(
          path,
          "no class: move it to docs/working/ (with a fold-at header), into archive/, or make it a contract (docs/DOCS_SYSTEM.md)",
        )
        continue
      }
      if (docClass !== "contract" && docClass !== "working") continue
      const text = read(path)
      const lines = text.split("\n").length
      const budget =
        docClass === "working"
          ? WORKING_BUDGET
          : (BUDGETS.get(path) ?? CONTRACT_BUDGET)
      if (lines > budget)
        report(path, `${lines} lines, over its budget of ${budget}`)

      if (docClass === "working") {
        const header = /Fold at:\s*([\w.-]+)/.exec(
          text.split("\n").slice(0, 6).join("\n"),
        )
        if (!header) {
          report(
            path,
            'missing "> Working document · Owner: … · Fold at: …" header',
          )
        } else if (!statusOf.has(header[1]) && !VERSION.test(header[1])) {
          report(
            path,
            `fold-at ${header[1]} is neither a milestone ID nor a version`,
          )
        } else if (
          VERSION.test(header[1])
            ? versionAtLeast(appVersion, header[1])
            : statusOf.get(header[1]) === "COMPLETE"
        ) {
          report(path, `fold-at ${header[1]} has passed: fold it`)
        }
      }

      for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = match[1]
        if (/^(?:[a-z]+:|#)/i.test(target)) continue
        const file = decodeURI(
          target.replace(/[#?].*$/, "").replace(/:\d+$/, ""),
        )
        if (file && !existsSync(resolve(root, dirname(path), file)))
          report(path, `broken link to ${target}`)
      }
    }

    // 2. The plan holds open work only, with short status rows.
    if (existsSync(resolve(root, PLAN))) {
      const plan = read(PLAN)
      for (const match of plan.matchAll(
        /^## (\S+) —[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/gm,
      )) {
        if (/\*\*Status:\*\* COMPLETE/.test(match[2]))
          report(
            PLAN,
            `completed milestone ${match[1]} still has a section: archive it`,
          )
      }
      for (const row of plan
        .split("\n")
        .filter((line) => /^\| [A-Z]+\d* \|/.test(line))) {
        const words =
          row.split("|")[2]?.trim().split(/\s+/).filter(Boolean).length ?? 0
        if (words > STATUS_ROW_WORDS)
          report(
            PLAN,
            `status row "${row.split("|")[1].trim()}" has ${words} words (max ${STATUS_ROW_WORDS})`,
          )
      }
    }
  }

  // 3. Frozen files: the archive, the changelog, completed milestones'
  // evidence, compared with the staged index, the commit in CVC_DOCS_BASE (CI
  // passes the previous tip, so committed edits are caught too) or HEAD. A new
  // branch has no previous tip; CI then compares with main.
  const isCommit = (ref) => {
    try {
      git(["cat-file", "-e", `${ref}^{commit}`])
      return true
    } catch {
      return false
    }
  }
  const requestedBase = process.env.CVC_DOCS_BASE?.trim()
  let base = "HEAD"
  if (!cached && requestedBase) {
    if (!/^0+$/.test(requestedBase) && isCommit(requestedBase)) {
      base = requestedBase
    } else if (isCommit("origin/main")) {
      base = git(["merge-base", "HEAD", "origin/main"]).trim()
      console.log(
        `check:docs: no usable previous tip; frozen files compared with origin/main at ${base.slice(0, 7)}`,
      )
    }
  }
  let completedAtBase = new Set()
  try {
    const baseManifest = JSON.parse(
      git(["show", `${base}:.milestones/manifest.json`]),
    )
    completedAtBase = new Set(
      baseManifest.milestones
        .filter((m) => m.status === "COMPLETE")
        .map((m) => m.id),
    )
  } catch {
    // No manifest at the base (a first commit): no evidence is frozen yet.
  }
  // The approvals come from the commit being made: the staged index before a
  // commit, the working tree otherwise.
  const show = (spec) => {
    try {
      return git(["show", spec])
    } catch {
      return ""
    }
  }
  const indexNow = cached
    ? show(`:${ARCHIVE_INDEX}`)
    : existsSync(resolve(root, ARCHIVE_INDEX))
      ? read(ARCHIVE_INDEX)
      : ""
  const allowed = newlyApproved(indexNow, show(`${base}:${ARCHIVE_INDEX}`))
  const numstat = git([
    "diff",
    ...(cached ? ["--cached"] : [base]),
    "--numstat",
    "--no-renames",
    "--diff-filter=DM",
    "--",
    "archive",
    ".evidence",
    "CHANGELOG.md",
  ])
    .split("\n")
    .filter(Boolean)
  for (const line of numstat) {
    const file = line.split("\t")[2]
    if (allowed.has(file))
      console.log(`Frozen edit approved in ${ARCHIVE_INDEX}: ${file}`)
  }
  problems.push(...frozenProblems(numstat, completedAtBase, allowed))

  if (problems.length > 0) {
    console.error(`check:docs found ${problems.length} problem(s):`)
    for (const problem of problems) console.error(`- ${problem}`)
    process.exitCode = 1
  } else {
    console.log(
      frozenOnly
        ? "PASS: frozen documents unchanged"
        : `PASS: documentation system (${markdownCount} Markdown files)`,
    )
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main()
