import { randomUUID } from "node:crypto"
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const scriptRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)
const queueRelativePath = ".milestones/owner-checks.json"
const todoRelativePath = "docs/OWNER_TODO.md"
const fullCommitPattern = /^[0-9a-f]{40}$/i
const itemKinds = new Set(["DEVICE_CHECK", "DECISION"])
const itemStatuses = new Set([
  "NEEDS_SETUP",
  "READY",
  "PASSED",
  "CHANGES_REQUESTED",
])
const feedbackStatuses = new Set(["PASSED", "CHANGES_REQUESTED"])

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function canonicalItem(item) {
  const canonical = {}
  for (const key of [
    "id",
    "milestone",
    "kind",
    "title",
    "status",
    "required",
    "revision",
    "instructions",
    "expected",
    "testedCommit",
    "testUrl",
    "evidencePath",
    "updatedAt",
    "result",
    "history",
  ]) {
    if (!Object.hasOwn(item, key)) continue
    if (key === "result" && isRecord(item.result)) {
      canonical.result = Object.fromEntries(
        [
          "reportedBy",
          "source",
          "summary",
          "testedCommit",
          "device",
          "browser",
          "osVersion",
        ]
          .filter((resultKey) => Object.hasOwn(item.result, resultKey))
          .map((resultKey) => [resultKey, item.result[resultKey]]),
      )
    } else {
      canonical[key] = item[key]
    }
  }
  return canonical
}

function canonicalQueue(queue) {
  return {
    schemaVersion: queue.schemaVersion,
    items: queue.items.map(canonicalItem),
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}

function isFullCommit(value) {
  return typeof value === "string" && fullCommitPattern.test(value)
}

function unknownKeys(value, allowed) {
  return Object.keys(value).filter((key) => !allowed.has(key))
}

function isIsoTimestamp(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) &&
    Number.isFinite(Date.parse(value))
  )
}

function safeRepositoryPath(value) {
  if (!isNonEmptyString(value)) return false
  if (value.includes("\\") || value.includes("\0")) return false
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) return false
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return false

  const segments = value.split("/")
  if (
    segments.some((segment) => !segment || segment === "." || segment === "..")
  )
    return false
  if (
    segments.some((segment) => /private|roster|recordings?/i.test(segment)) ||
    /^data$/i.test(segments[0])
  )
    return false
  return true
}

function usableTestUrl(value) {
  if (!isNonEmptyString(value)) return false
  try {
    const url = new URL(value)
    if (url.username || url.password || url.hash) return false
    if (url.protocol === "https:") return Boolean(url.hostname)
    if (url.protocol !== "http:") return false
    return new Set(["localhost", "127.0.0.1", "[::1]"]).has(url.hostname)
  } catch {
    return false
  }
}

function validateResult(result, item, problems) {
  const prefix = `Item ${item.id} result`
  if (!isRecord(result)) {
    problems.push(`${prefix} must be an object`)
    return
  }
  const extraResultKeys = unknownKeys(
    result,
    new Set([
      "reportedBy",
      "source",
      "summary",
      "testedCommit",
      "device",
      "browser",
      "osVersion",
    ]),
  )
  if (extraResultKeys.length)
    problems.push(
      `${prefix} has unknown field(s): ${extraResultKeys.join(", ")}`,
    )
  if (item.kind === "DECISION") {
    const deviceResultKeys = ["testedCommit", "device", "browser", "osVersion"]
    const unexpectedDeviceKeys = deviceResultKeys.filter((key) =>
      Object.hasOwn(result, key),
    )
    if (unexpectedDeviceKeys.length)
      problems.push(
        `${prefix} has device-only field(s) for a DECISION: ${unexpectedDeviceKeys.join(", ")}`,
      )
  }
  if (result.reportedBy !== "owner")
    problems.push(`${prefix}.reportedBy must be "owner"`)
  if (!isNonEmptyString(result.source))
    problems.push(`${prefix}.source must name an explicit owner report`)
  if (!isNonEmptyString(result.summary))
    problems.push(`${prefix}.summary must be a non-empty owner report`)

  if (item.kind === "DEVICE_CHECK") {
    if (!isFullCommit(result.testedCommit))
      problems.push(`${prefix}.testedCommit must be a full 40-character commit`)
    for (const field of ["device", "browser", "osVersion"]) {
      if (!isNonEmptyString(result[field]))
        problems.push(`${prefix}.${field} must be non-empty`)
    }
    if (
      item.status === "PASSED" &&
      [result.device, result.browser, result.osVersion]
        .filter((part) => typeof part === "string")
        .some((part) => /simulat|emulator|fixture|mock/i.test(part))
    ) {
      problems.push(
        `${prefix} cannot claim a physical-device PASS from a simulator or fixture`,
      )
    }
    if (
      item.status === "PASSED" &&
      /\b(?:simulated|simulator|emulated|emulator)\b/i.test(
        `${result.source} ${result.summary}`,
      )
    ) {
      problems.push(
        `${prefix} cannot claim a physical-device PASS from a simulator or fixture`,
      )
    }
    if (
      item.status === "PASSED" &&
      isFullCommit(item.testedCommit) &&
      isFullCommit(result.testedCommit) &&
      result.testedCommit.toLowerCase() !== item.testedCommit.toLowerCase()
    ) {
      problems.push(`${prefix}.testedCommit must match the item's testedCommit`)
    }
  }
}

/** Return every queue contract problem without throwing. */
export function validateOwnerChecks(queue, manifest) {
  const problems = []
  if (!isRecord(queue)) return ["Owner checks queue must be an object"]
  const queueExtras = unknownKeys(queue, new Set(["schemaVersion", "items"]))
  if (queueExtras.length)
    problems.push(
      `Owner checks has unknown field(s): ${queueExtras.join(", ")}`,
    )
  if (queue.schemaVersion !== 1)
    problems.push("Owner checks schemaVersion must be 1")
  if (!Array.isArray(queue.items)) {
    problems.push("Owner checks items must be an array")
    return problems
  }

  const milestoneIds = new Set(
    Array.isArray(manifest?.milestones)
      ? manifest.milestones
          .filter(
            (milestone) =>
              isRecord(milestone) && isNonEmptyString(milestone.id),
          )
          .map((milestone) => milestone.id)
      : [],
  )
  if (!Array.isArray(manifest?.milestones))
    problems.push("Milestone manifest must contain a milestones array")

  const seenIds = new Set()
  const itemKeys = new Set([
    "id",
    "milestone",
    "kind",
    "title",
    "status",
    "required",
    "revision",
    "instructions",
    "expected",
    "testedCommit",
    "testUrl",
    "evidencePath",
    "updatedAt",
    "result",
    "history",
  ])
  for (const [index, item] of queue.items.entries()) {
    const prefix = `Item ${index + 1}`
    if (!isRecord(item)) {
      problems.push(`${prefix} must be an object`)
      continue
    }
    const extraItemKeys = unknownKeys(item, itemKeys)
    if (extraItemKeys.length)
      problems.push(
        `${prefix} has unknown field(s): ${extraItemKeys.join(", ")}`,
      )
    const label = isNonEmptyString(item.id) ? item.id : `${index + 1}`
    if (!isNonEmptyString(item.id))
      problems.push(`${prefix}.id must be non-empty`)
    else if (seenIds.has(item.id))
      problems.push(`Duplicate owner check ID: ${item.id}`)
    else seenIds.add(item.id)

    if (!isNonEmptyString(item.milestone))
      problems.push(`Item ${label}.milestone must be non-empty`)
    else if (!milestoneIds.has(item.milestone))
      problems.push(`Item ${label} names unknown milestone ${item.milestone}`)
    if (!itemKinds.has(item.kind))
      problems.push(`Item ${label}.kind must be DEVICE_CHECK or DECISION`)
    if (!isNonEmptyString(item.title))
      problems.push(`Item ${label}.title must be non-empty`)
    if (typeof item.required !== "boolean")
      problems.push(`Item ${label}.required must be a boolean`)
    if (!Number.isInteger(item.revision) || item.revision < 1)
      problems.push(`Item ${label}.revision must be a positive integer`)
    if (!Array.isArray(item.instructions))
      problems.push(`Item ${label}.instructions must be an array of strings`)
    else if (
      item.instructions.some((instruction) => !isNonEmptyString(instruction))
    )
      problems.push(
        `Item ${label}.instructions must contain only non-empty strings`,
      )
    if (!isNonEmptyString(item.expected))
      problems.push(`Item ${label}.expected must be non-empty`)
    if (!itemStatuses.has(item.status))
      problems.push(`Item ${label}.status is invalid`)
    if (!isFullCommit(item.testedCommit) && item.testedCommit !== null)
      problems.push(`Item ${label}.testedCommit must be a full commit or null`)
    if (item.testUrl !== null && !usableTestUrl(item.testUrl))
      problems.push(
        `Item ${label}.testUrl must be HTTPS or local loopback HTTP, or null`,
      )
    if (item.evidencePath !== null && !safeRepositoryPath(item.evidencePath))
      problems.push(
        `Item ${label}.evidencePath must be a safe repository-relative path or null`,
      )
    if (
      item.evidencePath !== null &&
      (typeof item.evidencePath !== "string" ||
        !item.evidencePath.startsWith(`.evidence/${item.milestone}/`) ||
        !item.evidencePath.endsWith(".json"))
    ) {
      problems.push(
        `Item ${label}.evidencePath must be a JSON report in its milestone's evidence directory`,
      )
    }
    const ownerEvidence = manifest?.milestones?.find(
      (entry) => entry.id === item.milestone,
    )?.ownerEvidence
    if (
      item.evidencePath !== null &&
      ownerEvidence &&
      !ownerEvidence.includes(item.evidencePath)
    ) {
      problems.push(
        `Item ${label}.evidencePath must be declared in its milestone's ownerEvidence`,
      )
    }
    if (!isIsoTimestamp(item.updatedAt))
      problems.push(`Item ${label}.updatedAt must be an ISO timestamp`)

    if (item.kind === "DEVICE_CHECK" && item.status === "READY") {
      if (!isFullCommit(item.testedCommit))
        problems.push(`Item ${label} in READY needs a full testedCommit`)
      if (!usableTestUrl(item.testUrl))
        problems.push(`Item ${label} in READY needs a usable testUrl`)
      if (!safeRepositoryPath(item.evidencePath))
        problems.push(`Item ${label} in READY needs a safe evidencePath`)
    }
    if (item.status === "PASSED" || item.status === "CHANGES_REQUESTED") {
      if (!Object.hasOwn(item, "result"))
        problems.push(
          `Item ${label} needs an explicit owner result in ${item.status}`,
        )
    }
    if (Object.hasOwn(item, "result"))
      validateResult(item.result, item, problems)
    if (Object.hasOwn(item, "history") && !Array.isArray(item.history))
      problems.push(`Item ${label}.history must be an array`)
    if (
      item.kind === "DEVICE_CHECK" &&
      item.status === "PASSED" &&
      (!isFullCommit(item.testedCommit) ||
        !usableTestUrl(item.testUrl) ||
        !safeRepositoryPath(item.evidencePath))
    ) {
      problems.push(
        `Item ${label} cannot be PASSED without its tested build, URL and evidence path`,
      )
    }
  }
  return problems
}

function markdownText(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("`", "\\`")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("|", "\\|")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", " ")
    .replaceAll("\r", " ")
}

function inlineCode(value) {
  return `\`${String(value ?? "").replaceAll("`", "'")}\``
}

function statusLabel(item) {
  return {
    NEEDS_SETUP: "Setup needed",
    READY: "Ready for owner check",
    PASSED: "Passed from owner report",
    CHANGES_REQUESTED: "Owner requested changes",
  }[item.status]
}

function itemInstructions(item) {
  if (item.instructions.length === 0)
    return "No owner instructions are recorded."
  return item.instructions
    .map((instruction, index) => `${index + 1}. ${markdownText(instruction)}`)
    .join("\n")
}

function itemAction(item) {
  if (item.status === "NEEDS_SETUP") {
    const setup = item.instructions.length
      ? itemInstructions(item)
      : "Choose and record the setup needed for this check."
    if (item.kind === "DEVICE_CHECK" && (!item.testedCommit || !item.testUrl)) {
      return `${setup}\n\nNo phone-test build is ready. Setup can be chosen now; wait until the item becomes READY before running the phone steps. Readiness requires the verified agent checkpoint and a prepared test address. Choosing setup does not mark that work verified.`
    }
    return setup
  }
  if (item.status === "READY") {
    return item.kind === "DECISION"
      ? itemInstructions(item)
      : `${itemInstructions(item)}\n\nUse the test address below and the linked device instructions.`
  }
  if (item.status === "PASSED") {
    return `The owner reported: ${markdownText(item.result?.summary ?? "No owner report is recorded.")}`
  }
  return `The owner reported: ${markdownText(item.result?.summary ?? "No owner report is recorded.")} Agent fixes are needed before this check can be ready again.`
}

function anchorId(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/** Render the current, owner-readable checklist in a stable order. */
export function renderOwnerTodo(queue) {
  const items = Array.isArray(queue?.items) ? [...queue.items] : []
  items.sort((left, right) => {
    const a = `${left.milestone}\0${left.id}`
    const b = `${right.milestone}\0${right.id}`
    return a < b ? -1 : a > b ? 1 : 0
  })
  const lines = [
    "# Owner todo",
    "",
    "This is the current owner checklist, regenerated from `.milestones/owner-checks.json` whenever a request changes. It is a living list; owner reports belong in the evidence file named by each request.",
    "",
    "Tell your agent the item name and what happened. It records your feedback and keeps this list current. [How pending checks affect agent work](./OWNER_WORKFLOW.md).",
  ]

  if (items.length === 0) {
    lines.push("", "There are no owner checks in the queue.")
    return `${lines.join("\n")}\n`
  }

  for (const item of items) {
    lines.push(
      "",
      `<a id="${anchorId(item.id)}"></a>`,
      "",
      `## ${markdownText(item.title)} — ${markdownText(item.milestone)}`,
      "",
      `**State:** ${statusLabel(item)}${item.required ? " · Required" : " · Optional"}`,
      "",
      "**What to do:**",
      "",
      itemAction(item),
      "",
      `**Expected:** ${markdownText(item.expected)}`,
      "",
      `**Build:** ${item.testedCommit ? inlineCode(item.testedCommit) : "No test build is assigned yet."}`,
    )
    if (item.testUrl)
      lines.push("", `**Test address:** ${markdownText(item.testUrl)}`)
    if (item.kind === "DEVICE_CHECK") {
      const guide =
        item.id === "D3-PHONE-UPDATE"
          ? "[Updates and versions](./DEVICE_CHECKS.md#updates-and-versions)"
          : "[Device check guide](./DEVICE_CHECKS.md)"
      lines.push("", `**Guide:** ${guide}`)
    }
    lines.push(
      "",
      `**Work affected:** ${item.status === "PASSED" ? "The owner report is recorded." : item.required ? `Completion of ${markdownText(item.milestone)} and the release gate wait for this result. Other agent work follows the plan's explicit dependency permissions.${item.status === "CHANGES_REQUESTED" ? " Work depending on the reported problem pauses for fixes." : ""}` : "No required milestone completion is blocked."}`,
    )
    if (item.result && item.status !== "PASSED")
      lines.push(
        "",
        `**Latest owner report:** ${markdownText(item.result.summary)}`,
      )
  }

  return `${lines.join("\n")}\n`
}

/** Read the canonical queue JSON from a repository root. */
export function readOwnerChecks(root) {
  const queuePath = path.resolve(root, queueRelativePath)
  try {
    return JSON.parse(readFileSync(queuePath, "utf8"))
  } catch (error) {
    throw new Error(`Cannot read ${queueRelativePath}: ${error.message}`, {
      cause: error,
    })
  }
}

function atomicWrite(root, relativePath, content) {
  assertUnlinkedPath(root, relativePath)
  const destination = path.resolve(root, relativePath)
  const parent = path.dirname(destination)
  mkdirSync(parent, { recursive: true })
  assertUnlinkedPath(root, relativePath)
  const temporary = path.join(
    parent,
    `.${path.basename(destination)}.${randomUUID()}.tmp`,
  )
  try {
    writeFileSync(temporary, content, { encoding: "utf8", flag: "wx" })
    renameSync(temporary, destination)
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { force: true })
  }
}

function assertUnlinkedPath(root, relativePath) {
  let current = path.resolve(root)
  for (const segment of relativePath.split("/")) {
    current = path.join(current, segment)
    try {
      if (lstatSync(current).isSymbolicLink())
        throw new Error(
          `Owner path crosses a symbolic link or junction: ${relativePath}`,
        )
    } catch (error) {
      if (error.code !== "ENOENT") throw error
    }
  }
}

/** Write canonical JSON and its generated owner checklist with per-file atomic replacement. */
export function writeOwnerChecks(root, queue) {
  const queuePath = path.resolve(root, queueRelativePath)
  const todoPath = path.resolve(root, todoRelativePath)
  if (!queuePath.startsWith(`${path.resolve(root)}${path.sep}`))
    throw new Error("Owner checks queue path escapes the repository")
  if (!todoPath.startsWith(`${path.resolve(root)}${path.sep}`))
    throw new Error("Owner todo path escapes the repository")
  atomicWrite(
    root,
    queueRelativePath,
    `${JSON.stringify(canonicalQueue(queue), null, 2)}\n`,
  )
  atomicWrite(root, todoRelativePath, renderOwnerTodo(queue))
}

/** Return only required items belonging to a milestone. */
export function ownerItemsFor(queue, milestoneId) {
  return (Array.isArray(queue?.items) ? queue.items : []).filter(
    (item) => item.milestone === milestoneId && item.required === true,
  )
}

/** Reset required owner results after a milestone's source changes. */
export function invalidateOwnerItems(queue, milestoneId) {
  const clone = structuredClone(queue)
  const now = new Date().toISOString()
  for (const item of clone.items ?? []) {
    if (item.milestone !== milestoneId || item.required !== true) continue
    if (Object.hasOwn(item, "result")) {
      item.history ??= []
      item.history.push({
        status: item.status,
        result: item.result,
        testedCommit: item.testedCommit,
        invalidatedAt: now,
      })
      delete item.result
    }
    item.status = "NEEDS_SETUP"
    item.testedCommit = null
    item.testUrl = null
    item.revision += 1
    item.updatedAt = now
  }
  return clone
}

/** Explain why owner checks prevent a milestone checkpoint from completing. */
export function ownerCompletionProblems(queue, milestoneId, checkpointCommit) {
  const problems = []
  const items = ownerItemsFor(queue, milestoneId)
  if (items.length === 0) {
    return [`No required owner check is configured for ${milestoneId}`]
  }
  for (const item of items) {
    if (item.status !== "PASSED") {
      problems.push(`${item.id} is required and has status ${item.status}`)
      continue
    }
    if (
      item.kind === "DEVICE_CHECK" &&
      item.testedCommit?.toLowerCase() !== checkpointCommit?.toLowerCase()
    ) {
      problems.push(
        `${item.id} was tested on ${item.testedCommit}, not checkpoint ${checkpointCommit}`,
      )
    }
  }
  return problems
}

/** Match the required audit report to the owner's accepted queue result. */
export function ownerEvidenceProblems(root, queue, milestoneId) {
  const problems = []
  for (const item of ownerItemsFor(queue, milestoneId)) {
    if (item.kind !== "DEVICE_CHECK" || item.status !== "PASSED") continue
    try {
      assertUnlinkedPath(root, item.evidencePath)
      const report = JSON.parse(
        readFileSync(path.resolve(root, item.evidencePath), "utf8"),
      )
      const latest = report.ownerReports?.findLast(
        (entry) => entry.id === item.id,
      )
      const expected = {
        result: "PASSED",
        reportedBy: "owner",
        source: item.result.source,
        summary: item.result.summary,
        testedCommit: item.testedCommit,
        testUrl: item.testUrl,
        device: item.result.device,
        browser: item.result.browser,
        osVersion: item.result.osVersion,
        reportedAt: item.updatedAt,
      }
      if (
        !latest ||
        report.milestone !== milestoneId ||
        Object.entries(expected).some(([key, value]) => latest[key] !== value)
      ) {
        problems.push(
          `${item.id}'s required owner evidence disagrees with its accepted result`,
        )
      }
    } catch {
      problems.push(
        `${item.id}'s required owner evidence is missing, invalid or crosses a linked path`,
      )
    }
  }
  return problems
}

function readManifest(root) {
  const manifestPath = path.resolve(root, ".milestones/manifest.json")
  return JSON.parse(readFileSync(manifestPath, "utf8"))
}

function validateOrThrow(queue, manifest) {
  const problems = validateOwnerChecks(queue, manifest)
  if (problems.length)
    throw new Error(`Owner checks invalid:\n- ${problems.join("\n- ")}`)
}

function parseJsonFile(file, cwd) {
  if (!file) throw new Error("Missing --file <json file>")
  const filePath = path.resolve(cwd, file)
  try {
    return JSON.parse(readFileSync(filePath, "utf8"))
  } catch (error) {
    throw new Error(`Cannot read JSON input ${filePath}: ${error.message}`, {
      cause: error,
    })
  }
}

function fileOption(args) {
  const index = args.indexOf("--file")
  if (index === -1 || !args[index + 1])
    throw new Error("Expected --file <json file>")
  if (args.filter((arg) => arg === "--file").length !== 1)
    throw new Error("Use --file exactly once")
  if (args.length !== 2)
    throw new Error(`Unexpected arguments: ${args.join(" ")}`)
  return args[index + 1]
}

function currentQueue(root) {
  const queue = readOwnerChecks(root)
  validateOrThrow(queue, readManifest(root))
  return queue
}

function checkProjection(root, queue) {
  const todoPath = path.resolve(root, todoRelativePath)
  if (!existsSync(todoPath)) throw new Error(`${todoRelativePath} is missing`)
  const expected = renderOwnerTodo(queue)
  const actual = readFileSync(todoPath, "utf8")
  if (actual !== expected)
    throw new Error(
      `${todoRelativePath} is out of date; regenerate it with an owner-checks write operation`,
    )
}

function requireValidCandidate(queue, manifest) {
  validateOrThrow(queue, manifest)
}

function runAdd(root, file, cwd, write) {
  const queue = currentQueue(root)
  const input = parseJsonFile(file, cwd)
  if (!isRecord(input))
    throw new Error("New owner check input must be an object")
  if (
    readManifest(root).milestones.some(
      (milestone) =>
        milestone.id === input.milestone && milestone.status === "COMPLETE",
    )
  ) {
    throw new Error(
      "A completed milestone cannot receive new owner acceptance work; use an open follow-up milestone",
    )
  }
  if (queue.items.some((item) => item.id === input.id))
    throw new Error(`Owner check already exists: ${input.id}`)
  if (input.status === "PASSED" || input.status === "CHANGES_REQUESTED")
    throw new Error(
      "Add cannot record an owner result; use feedback for an explicit report",
    )

  const item = { ...input, revision: 1, updatedAt: new Date().toISOString() }
  const next = { ...queue, items: [...queue.items, item] }
  requireValidCandidate(next, readManifest(root))
  writeOwnerChecks(root, next)
  write(
    `OWNER ACTION ADDED: ${markdownText(item.title)} — [Owner todo](docs/OWNER_TODO.md#${anchorId(item.id)})`,
  )
}

function runUpdate(root, file, cwd, write) {
  const queue = currentQueue(root)
  const input = parseJsonFile(file, cwd)
  if (!isRecord(input) || !isNonEmptyString(input.id))
    throw new Error("Owner check update needs an id")
  const index = queue.items.findIndex((item) => item.id === input.id)
  if (index === -1) throw new Error(`Unknown owner check ID: ${input.id}`)
  const current = queue.items[index]
  if (current.status === "CHANGES_REQUESTED") {
    throw new Error(
      "Resume the milestone and invalidate the old check before replacing owner-requested fixes",
    )
  }
  if (input.revision !== current.revision)
    throw new Error(
      `Stale owner check revision for ${input.id}; current revision is ${current.revision}`,
    )
  if (
    current.status === "PASSED" &&
    JSON.stringify(input.result) !== JSON.stringify(current.result)
  )
    throw new Error(
      "A passed owner result cannot be changed silently; use feedback",
    )
  if (current.status === "PASSED")
    throw new Error(
      "A passed owner check can only be changed through explicit feedback",
    )
  if (input.status === "PASSED" || input.status === "CHANGES_REQUESTED")
    throw new Error("Use feedback to record an explicit owner result")

  const item = {
    ...input,
    revision: current.revision + 1,
    updatedAt: new Date().toISOString(),
  }
  const items = [...queue.items]
  items[index] = item
  const next = { ...queue, items }
  requireValidCandidate(next, readManifest(root))
  writeOwnerChecks(root, next)
  write(
    `OWNER ACTION UPDATED: ${markdownText(item.title)} — [Owner todo](docs/OWNER_TODO.md#${anchorId(item.id)})`,
  )
}

function runFeedback(root, file, cwd, write) {
  const queue = currentQueue(root)
  const manifest = readManifest(root)
  const input = parseJsonFile(file, cwd)
  if (!isRecord(input) || !isNonEmptyString(input.id))
    throw new Error("Owner feedback needs an id")
  const extraKeys = unknownKeys(input, new Set(["id", "status", "result"]))
  if (extraKeys.length)
    throw new Error(
      `Owner feedback has unknown field(s): ${extraKeys.join(", ")}`,
    )
  if (!feedbackStatuses.has(input.status))
    throw new Error("Owner feedback status must be PASSED or CHANGES_REQUESTED")
  const index = queue.items.findIndex((item) => item.id === input.id)
  if (index === -1) throw new Error(`Unknown owner check ID: ${input.id}`)
  const milestone = manifest.milestones.find(
    (entry) => entry.id === queue.items[index].milestone,
  )
  if (milestone?.status === "COMPLETE")
    throw new Error(
      `Cannot change owner evidence for completed milestone ${milestone.id}`,
    )

  const items = [...queue.items]
  items[index] = {
    ...items[index],
    status: input.status,
    result: input.result,
    revision: items[index].revision + 1,
    updatedAt: new Date().toISOString(),
  }
  const next = { ...queue, items }
  requireValidCandidate(next, manifest)
  if (items[index].kind === "DEVICE_CHECK")
    writePhysicalReport(root, items[index])
  writeOwnerChecks(root, next)
  write(
    `OWNER ACTION UPDATED: ${markdownText(items[index].title)} — [Owner todo](docs/OWNER_TODO.md#${anchorId(input.id)})`,
  )
}

function writePhysicalReport(root, item) {
  if (!safeRepositoryPath(item.evidencePath))
    throw new Error(
      `Owner check ${item.id} needs a safe evidencePath before feedback`,
    )
  const evidencePath = path.resolve(root, item.evidencePath)
  assertUnlinkedPath(root, item.evidencePath)
  const relative = path.relative(path.resolve(root), evidencePath)
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error(
      `Owner check ${item.id} evidencePath escapes the repository`,
    )

  let report = { schemaVersion: 1, milestone: item.milestone, ownerReports: [] }
  if (existsSync(evidencePath)) {
    try {
      report = JSON.parse(readFileSync(evidencePath, "utf8"))
    } catch (error) {
      throw new Error(
        `Cannot update owner evidence ${item.evidencePath}: ${error.message}`,
        {
          cause: error,
        },
      )
    }
    if (!isRecord(report))
      throw new Error(
        `Owner evidence ${item.evidencePath} must be a JSON object`,
      )
    if (report.milestone && report.milestone !== item.milestone)
      throw new Error(
        `Owner evidence ${item.evidencePath} belongs to ${report.milestone}`,
      )
    if (report.ownerReports === undefined) report.ownerReports = []
    if (!Array.isArray(report.ownerReports))
      throw new Error(
        `Owner evidence ${item.evidencePath}.ownerReports must be an array`,
      )
  }

  report.milestone ??= item.milestone
  report.schemaVersion ??= 1
  const result = item.result
  report.ownerReports.push({
    id: item.id,
    check: item.title,
    result: item.status,
    reportedBy: "owner",
    source: result.source,
    summary: result.summary,
    testedCommit: result.testedCommit,
    testUrl: item.testUrl,
    device: result.device,
    browser: result.browser,
    osVersion: result.osVersion,
    reportedAt: item.updatedAt,
  })
  atomicWrite(root, item.evidencePath, `${JSON.stringify(report, null, 2)}\n`)
}

/** Run one CLI operation, with an injectable root and writer for focused tests. */
export function runOwnerChecksCommand(args, options = {}) {
  const root = path.resolve(options.root ?? scriptRoot)
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const write = options.write ?? ((line) => console.log(line))
  const [operation, ...rest] = args

  if (operation === "list") {
    if (rest.length) throw new Error(`Unexpected arguments: ${rest.join(" ")}`)
    const queue = currentQueue(root)
    write(renderOwnerTodo(queue))
    return
  }
  if (operation === "check") {
    if (rest.length) throw new Error(`Unexpected arguments: ${rest.join(" ")}`)
    const queue = currentQueue(root)
    checkProjection(root, queue)
    write(
      `Owner checks: ${queue.items.length} item(s); ${todoRelativePath} is current.`,
    )
    return
  }
  if (
    operation === "add" ||
    operation === "update" ||
    operation === "feedback"
  ) {
    const file = fileOption(rest)
    if (operation === "add") runAdd(root, file, cwd, write)
    if (operation === "update") runUpdate(root, file, cwd, write)
    if (operation === "feedback") runFeedback(root, file, cwd, write)
    return
  }
  throw new Error(
    "Usage: owner-checks.mjs list | check | add|update|feedback --file <json file>",
  )
}

function main() {
  try {
    runOwnerChecksCommand(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
)
  main()
