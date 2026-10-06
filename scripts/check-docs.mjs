// Enforces docs/DOCS_SYSTEM.md: every Markdown file has a class, contracts
// stay within budget, the plan holds open work only, working documents expire,
// the archive and the ledger stay frozen, and relative links resolve.
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const read = (path) => readFileSync(resolve(root, path), "utf8")
const git = (args) =>
  execFileSync("git", ["-c", "core.quotePath=false", ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 << 20,
  })

const PLAN = "04_IMPLEMENTATION_PLAN.md"
const ROOT_CONTRACTS = new Set([
  "AGENTS.md",
  "README.md",
  "01_PRODUCT_SPEC.md",
  "02_MVP_SCOPE.md",
  "03_TECHNICAL_DECISIONS.md",
  PLAN,
])
const PAGE_CHANGELOG = "docs/design/07_PAGE_CHANGELOG.md"
const BUDGETS = new Map([
  ["AGENTS.md", 300],
  [PLAN, 250],
  ["README.md", 80],
  ["docs/LOCAL_DEVELOPMENT.md", 120],
])
const CONTRACT_BUDGET = 700
const WORKING_BUDGET = 300
const STATUS_ROW_WORDS = 60

function classify(path) {
  if (path.startsWith("archive/")) return "archive"
  if (path.startsWith(".claude/skills/powersync/")) return "vendored"
  if (
    path === "CHANGELOG.md" ||
    path === PAGE_CHANGELOG ||
    path.startsWith(".evidence/")
  )
    return "ledger"
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

const problems = []
const report = (path, message) => problems.push(`${path}: ${message}`)

const markdown = git([
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "-z",
])
  .split("\0")
  .filter((path) => path.endsWith(".md") && existsSync(resolve(root, path)))

const manifest = JSON.parse(read(".milestones/manifest.json"))
const statusOf = new Map(manifest.milestones.map((m) => [m.id, m.status]))
const appVersion = JSON.parse(read("package.json")).version

function versionAtLeast(version, target) {
  const a = version.split(".").map(Number)
  const b = target.split(".").map(Number)
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return true
}

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
    } else {
      const foldAt = header[1]
      const expired = /^\d+\.\d+\.\d+$/.test(foldAt)
        ? versionAtLeast(appVersion, foldAt)
        : statusOf.get(foldAt) === "COMPLETE"
      if (!statusOf.has(foldAt) && !/^\d+\.\d+\.\d+$/.test(foldAt))
        report(
          path,
          `fold-at ${foldAt} is neither a milestone ID nor a version`,
        )
      else if (expired) report(path, `fold-at ${foldAt} has passed: fold it`)
    }
  }

  for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1]
    if (/^(?:[a-z]+:|#)/i.test(target)) continue
    const file = decodeURI(target.replace(/[#?].*$/, "").replace(/:\d+$/, ""))
    if (!file) continue
    if (!existsSync(resolve(root, dirname(path), file)))
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

// 3. Frozen files: the archive, the changelogs, completed milestones' evidence.
const allowFrozenEdit = process.env.CVC_DOCS_ALLOW_FROZEN_EDIT?.trim()
const changed = git([
  "diff",
  "HEAD",
  "--numstat",
  "--no-renames",
  "--",
  "archive",
  ".evidence",
  "CHANGELOG.md",
  PAGE_CHANGELOG,
])
  .split("\n")
  .filter(Boolean)
  .map((line) => line.split("\t"))
for (const [added, deleted, path] of changed) {
  const evidenceOf = /^\.evidence\/([^/]+)\//.exec(path)?.[1]
  const frozen =
    path.startsWith("archive/") ||
    path === "CHANGELOG.md" ||
    path === PAGE_CHANGELOG ||
    (evidenceOf && statusOf.get(evidenceOf) === "COMPLETE")
  if (!frozen || deleted === "0") continue
  if (allowFrozenEdit) continue
  report(
    path,
    `frozen file changed (${added} added, ${deleted} removed); only additions are allowed`,
  )
}

if (problems.length > 0) {
  console.error(`check:docs found ${problems.length} problem(s):`)
  for (const problem of problems) console.error(`- ${problem}`)
  process.exitCode = 1
} else {
  console.log(`PASS: documentation system (${markdown.length} Markdown files)`)
}
