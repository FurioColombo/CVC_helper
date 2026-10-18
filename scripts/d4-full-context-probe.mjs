#!/usr/bin/env node
import os from "node:os"
import path from "node:path"
import { spawn, execFile as execFileCallback } from "node:child_process"
import { promisify } from "node:util"
import {
  appendFile,
  mkdir,
  readFile,
  stat,
  truncate,
  unlink,
  writeFile,
} from "node:fs/promises"
import assert from "node:assert/strict"

const execFile = promisify(execFileCallback)
const MAX_LOG_BYTES = 32 * 1024 * 1024
const SUMMARY_RESERVE_BYTES = 2048
const MAX_STACK_FILE_BYTES = 2 * 1024 * 1024
const MAX_STACK_TOTAL_BYTES = 16 * 1024 * 1024
const MAX_STACKS_PER_ATTEMPT = 12
const MAX_STACKS_TOTAL = 36
const STACK_DIR =
  process.env.CVC_D4_STACK_DIR ||
  path.join(os.tmpdir(), "cvc-d4-full-context-stacks")
const CASE_MARKER_PATH =
  process.env.CVC_D4_CASE_MARKER_OUTPUT ||
  path.join(os.tmpdir(), "cvc-d4-full-context-case-markers.jsonl")
const TARGET_CASE_TITLE =
  "upgrades and reopens a 40-student course within five seconds each"
const WEB_CONTENT_NAME = /^com\.apple\.WebKit\.WebContent(?:\.Development)?$/i
const PS_ARGS = [
  "-ww",
  "-axo",
  "pid=,ppid=,uid=,etime=,time=,rss=,state=,lstart=,comm=",
]
const PS_BUFFER = 1024 * 1024
const OUTPUT_PATH =
  process.env.CVC_D4_HOST_OUTPUT ||
  path.join(os.tmpdir(), "cvc-d4-full-context-host.jsonl")
const PREFLIGHT_REPORT_PATH =
  process.env.CVC_D4_PREFLIGHT_REPORT_PATH ||
  path.join(os.tmpdir(), "cvc-d4-stack-preflight.json")
const PREFLIGHT_STACK_PATH =
  process.env.CVC_D4_PREFLIGHT_STACK_PATH ||
  path.join(os.tmpdir(), "cvc-d4-stack-preflight.sample")
const ERROR_COUNTS = new Map()

function parsePs(text) {
  const rows = []
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(
      /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\d+)\s+(\S+)\s+(\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+?)\s*$/,
    )
    if (!m) continue
    rows.push({
      pid: Number(m[1]),
      ppid: Number(m[2]),
      uid: Number(m[3]),
      elapsed: m[4],
      cpuTime: m[5],
      rssKb: Number(m[6]),
      state: m[7],
      startIdentity: m[8],
      name: path.basename(m[9].trim()),
    })
  }
  return rows
}

function selectProcesses(rows, childPid) {
  const children = new Map()
  for (const row of rows) {
    if (!children.has(row.ppid)) children.set(row.ppid, [])
    children.get(row.ppid).push(row.pid)
  }
  const descendants = new Set([childPid])
  const pending = [childPid]
  while (pending.length) {
    for (const pid of children.get(pending.pop()) || []) {
      if (!descendants.has(pid)) {
        descendants.add(pid)
        pending.push(pid)
      }
    }
  }
  return rows.filter(
    (row) =>
      descendants.has(row.pid) ||
      /node|playwright|webkit|minibrowser/i.test(row.name),
  )
}

function parseVmStat(text) {
  const page = text.match(/page size of ([\d,]+) bytes/i)
  const pages = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([^:]+):\s*([\d,]+)\.?$/)
    if (m) pages[m[1].trim()] = Number(m[2].replaceAll(",", ""))
  }
  return {
    pageSizeBytes: page ? Number(page[1].replaceAll(",", "")) : null,
    pages,
  }
}

function parseSwap(text) {
  const m = text.match(
    /total\s*=\s*([\d.]+\s*[KMGTP]?)(?:\s+\S+)?\s+used\s*=\s*([\d.]+\s*[KMGTP]?)(?:\s+\S+)?\s+free\s*=\s*([\d.]+\s*[KMGTP]?)/i,
  )
  return m ? { total: m[1].trim(), used: m[2].trim(), free: m[3].trim() } : null
}

function parseThermal(text) {
  const fields = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(
      /^\s*(System-wide thermal level|CPU_Speed_Limit|Scheduler_Limit)\s*[:=]\s*(.{0,100})$/i,
    )
    if (m) fields[m[1]] = m[2].trim()
  }
  if (
    /^\s*(?:Note:\s*)?No thermal warning level has been recorded\.?$/im.test(
      text,
    )
  )
    fields.thermalWarningRecorded = false
  if (
    /^\s*(?:Note:\s*)?No performance warning level has been recorded\.?$/im.test(
      text,
    )
  )
    fields.performanceWarningRecorded = false
  return fields
}

function errorKind(error) {
  const details =
    String(error?.code || "") +
    " " +
    String(error?.message || "") +
    " " +
    String(error?.stderr || "")
  if (
    /operation not permitted|permission denied|task_for_pid|task\s+for\s+pid|could not get task|system integrity protection/i.test(
      details,
    )
  )
    return "permission_denied"
  if (error && (error.killed || error.code === "ETIMEDOUT")) return "timeout"
  if (error && typeof error.code === "string") return error.code.slice(0, 32)
  return "command_failed"
}

function sampleOutputErrorKind(output) {
  if (/system integrity protection|\bSIP\b/i.test(output))
    return "system_integrity_protection"
  if (
    /operation not permitted|permission denied|task_for_pid|task\s+for\s+pid|could not get task/i.test(
      output,
    )
  )
    return "permission_denied"
  return null
}

function sampleErrorKind(error) {
  const details = [error?.code, error?.message, error?.stderr, error?.stdout]
    .filter(Boolean)
    .join(" ")
  const outputKind = sampleOutputErrorKind(details)
  if (outputKind) return outputKind
  if (error?.code === "EPERM" || error?.code === "EACCES")
    return "permission_denied"
  return errorKind(error)
}

function classifyStackCapture(capture, file) {
  if (capture.kind) return capture.kind
  if (file.error && file.error !== "ENOENT")
    return file.error === "EPERM" || file.error === "EACCES"
      ? "permission_denied"
      : file.error
  return file.size > 0 ? "captured" : "empty_output"
}

function checkProcessIdentity(rows, target, uid) {
  const current = rows.find((row) => row.pid === target.pid)
  if (!current) return { ok: false, reason: "process_exited" }
  if (current.uid !== uid || target.uid !== uid)
    return { ok: false, reason: "uid_changed" }
  if (current.startIdentity !== target.startIdentity)
    return { ok: false, reason: "start_identity_changed" }
  if (current.name !== target.name || !WEB_CONTENT_NAME.test(current.name))
    return { ok: false, reason: "process_name_changed" }
  return { ok: true, process: current }
}

function isOwnedSelection(selection) {
  return Boolean(
    selection.process &&
    (selection.reason === "runner_descendant" || selection.browserPid !== null),
  )
}

function noteError(errors, source, kind) {
  errors.push({ source, kind })
  const key = source + ":" + kind
  ERROR_COUNTS.set(key, (ERROR_COUNTS.get(key) || 0) + 1)
}

function createCappedWriter(
  writeLine,
  initialBytes = 0,
  maxBytes = MAX_LOG_BYTES,
  reserveBytes = SUMMARY_RESERVE_BYTES,
) {
  let bytes = initialBytes
  let truncated = false
  let chain = Promise.resolve()
  let writeFailure = null
  const enqueue = (record, final = false) => {
    const line = JSON.stringify(record) + "\n"
    chain = chain
      .then(async () => {
        if (writeFailure || (truncated && !final)) return
        const length = Buffer.byteLength(line)
        if (bytes + length + (final ? 0 : reserveBytes) <= maxBytes) {
          await writeLine(line)
          bytes += length
          return
        }
        if (!truncated) {
          truncated = true
          const notice =
            JSON.stringify({
              type: "truncation",
              reason: "log byte cap reached",
              maxBytes,
            }) + "\n"
          const noticeLength = Buffer.byteLength(notice)
          if (bytes + noticeLength + (final ? 0 : reserveBytes) <= maxBytes) {
            await writeLine(notice)
            bytes += noticeLength
          }
        }
      })
      .catch((error) => {
        writeFailure = errorKind(error)
      })
    return chain
  }
  return { enqueue, state: () => ({ bytes, truncated, writeFailure }) }
}

async function command(
  file,
  args,
  { maxBuffer = 16 * 1024, outputLimit = 8000 } = {},
) {
  try {
    const result = await execFile(file, args, {
      timeout: 1000,
      maxBuffer,
      encoding: "utf8",
    })
    return { ok: true, text: String(result.stdout || "").slice(0, outputLimit) }
  } catch (error) {
    return { ok: false, kind: errorKind(error) }
  }
}

async function readPs() {
  return command("ps", PS_ARGS, {
    maxBuffer: PS_BUFFER,
    outputLimit: PS_BUFFER,
  })
}

function descendantsOf(rows, rootPid) {
  const children = new Map()
  for (const row of rows) {
    if (!children.has(row.ppid)) children.set(row.ppid, [])
    children.get(row.ppid).push(row.pid)
  }
  const descendants = new Set([rootPid])
  const pending = [rootPid]
  while (pending.length) {
    for (const pid of children.get(pending.pop()) || []) {
      if (!descendants.has(pid)) {
        descendants.add(pid)
        pending.push(pid)
      }
    }
  }
  return descendants
}

function selectStackProcess(rows, childPid, marker, uid, now = Date.now()) {
  if (!marker || !Number.isFinite(marker.epochMs) || !Number.isFinite(uid))
    return { process: null, reason: "no_active_case" }
  const descendants = descendantsOf(rows, childPid)
  const browsers = rows.filter(
    (row) =>
      descendants.has(row.pid) && /playwright|minibrowser/i.test(row.name),
  )
  const candidates = rows
    .filter((row) => row.uid === uid && WEB_CONTENT_NAME.test(row.name))
    .map((row) => {
      const startEpochMs = Date.parse(row.startIdentity)
      const recent =
        Number.isFinite(startEpochMs) &&
        startEpochMs >= marker.epochMs - 5000 &&
        startEpochMs <= now + 1000
      const browser = browsers
        .map((item) => ({
          item,
          gapMs: Math.abs(Date.parse(item.startIdentity) - startEpochMs),
        }))
        .filter((item) => Number.isFinite(item.gapMs) && item.gapMs <= 3000)
        .sort((a, b) => a.gapMs - b.gapMs)[0]
      const direct = descendants.has(row.pid)
      return {
        row,
        startEpochMs,
        recent,
        direct,
        browser: browser?.item || null,
        browserStartGapMs: browser?.gapMs ?? null,
      }
    })
    .filter(
      (candidate) => candidate.recent || candidate.direct || candidate.browser,
    )
    .sort((a, b) => {
      if (a.direct !== b.direct) return Number(b.direct) - Number(a.direct)
      if (a.recent !== b.recent) return Number(b.recent) - Number(a.recent)
      return (b.startEpochMs || 0) - (a.startEpochMs || 0)
    })
  if (!candidates.length)
    return { process: null, reason: "no_correlated_webcontent" }
  const chosen = candidates[0]
  return {
    process: chosen.row,
    reason: chosen.direct
      ? "runner_descendant"
      : chosen.recent
        ? "case_recent_start"
        : "browser_start_identity_match",
    candidateCount: candidates.length,
    browserPid: chosen.browser?.pid ?? null,
    browserStartIdentity: chosen.browser?.startIdentity ?? null,
    browserStartGapMs: chosen.browserStartGapMs,
  }
}

async function readCaseMarkers(state) {
  let content
  try {
    content = await readFile(CASE_MARKER_PATH, "utf8")
  } catch (error) {
    if (error.code === "ENOENT") return { markers: [], error: null }
    return { markers: [], error: errorKind(error) }
  }
  const markers = []
  let invalidRows = 0
  const lines = content.split(/\r?\n/)
  if (!content.endsWith("\n")) lines.pop()
  for (const line of lines) {
    if (!line) continue
    try {
      const row = JSON.parse(line)
      if (
        (row.type !== "case_start" && row.type !== "case_end") ||
        row.project !== "iphone-13-webkit-core" ||
        row.file !== "d1-migration.spec.ts" ||
        row.title !== TARGET_CASE_TITLE ||
        !Number.isFinite(row.epochMs) ||
        !Number.isInteger(row.retry)
      ) {
        invalidRows++
        continue
      }
      const key = `${row.type}:${row.retry}:${row.epochMs}`
      if (!state.seen.has(key)) {
        state.seen.add(key)
        markers.push(row)
      }
    } catch {
      invalidRows++
    }
  }
  return { markers, error: invalidRows ? "invalid_output" : null }
}

function applyCaseMarker(state, marker) {
  if (marker.type === "case_start") state.starts.set(marker.retry, marker)
  else state.ends.add(marker.retry)
}

function activeCase(state) {
  return [...state.starts.values()]
    .filter((marker) => !state.ends.has(marker.retry))
    .sort((a, b) => b.epochMs - a.epochMs)[0]
}

async function runSampleCommand(pid, file, timeout = 3000) {
  const startedEpochMs = Date.now()
  try {
    const result = await execFile(
      "/usr/bin/sample",
      [String(pid), "1", "10", "-file", file],
      { timeout, maxBuffer: 16 * 1024, encoding: "utf8" },
    )
    const kind = sampleOutputErrorKind(
      String(result.stdout || "") + " " + String(result.stderr || ""),
    )
    return {
      ok: !kind,
      ...(kind ? { kind } : {}),
      startedEpochMs,
      endedEpochMs: Date.now(),
      durationMs: Date.now() - startedEpochMs,
    }
  } catch (error) {
    return {
      ok: false,
      kind: sampleErrorKind(error),
      startedEpochMs,
      endedEpochMs: Date.now(),
      durationMs: Date.now() - startedEpochMs,
    }
  }
}

async function stackPermissionPreflight() {
  if (process.platform !== "darwin") {
    process.stderr.write(
      "D4 WebKit stack preflight requires macOS; no browser was started.\n",
    )
    process.exitCode = 2
    return
  }

  const startedEpochMs = Date.now()
  const marker = { epochMs: startedEpochMs }
  const uid = process.getuid()
  const report = {
    type: "stack_permission_preflight",
    timestamp: new Date(startedEpochMs).toISOString(),
    epochMs: startedEpochMs,
    browser: "webkit",
    page: "about:blank",
    status: "failed",
    classification: "not_completed",
    browserClosed: null,
    target: null,
    capture: null,
  }
  let browser

  try {
    await mkdir(path.dirname(PREFLIGHT_STACK_PATH), { recursive: true })
    await mkdir(path.dirname(PREFLIGHT_REPORT_PATH), { recursive: true })
    try {
      await unlink(PREFLIGHT_STACK_PATH)
    } catch (error) {
      if (error.code !== "ENOENT") throw error
    }
    const { webkit } = await import("@playwright/test")
    browser = await webkit.launch({ headless: true, timeout: 5000 })
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto("about:blank", { timeout: 5000 })

    let ownedSelection = null
    for (let attempt = 0; attempt < 12; attempt++) {
      const census = await readPs()
      if (!census.ok) {
        report.classification = census.kind
        break
      }
      const rows = parsePs(census.text)
      if (!rows.some((row) => row.pid === process.pid)) {
        report.classification = "invalid_process_census"
        break
      }
      const selection = selectStackProcess(
        rows,
        process.pid,
        marker,
        uid,
        Date.now(),
      )
      if (isOwnedSelection(selection)) {
        ownedSelection = selection
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    if (!ownedSelection) {
      if (report.classification === "not_completed")
        report.classification = "no_correlated_webcontent"
    } else {
      const target = ownedSelection.process
      const immediatelyBefore = await readPs()
      if (!immediatelyBefore.ok) {
        report.classification = immediatelyBefore.kind
      } else {
        const freshRows = parsePs(immediatelyBefore.text)
        const identity = checkProcessIdentity(freshRows, target, uid)
        const freshSelection = selectStackProcess(
          freshRows,
          process.pid,
          marker,
          uid,
          Date.now(),
        )
        if (!identity.ok) report.classification = identity.reason
        else if (
          !isOwnedSelection(freshSelection) ||
          freshSelection.process.pid !== target.pid ||
          freshSelection.process.startIdentity !== target.startIdentity
        )
          report.classification = "process_correlation_changed"
        else {
          const capture = await runSampleCommand(
            target.pid,
            PREFLIGHT_STACK_PATH,
          )
          const file = await boundedFileSize(
            PREFLIGHT_STACK_PATH,
            MAX_STACK_FILE_BYTES,
          )
          const classification = classifyStackCapture(capture, file)
          report.target = {
            pid: target.pid,
            uid: target.uid,
            startIdentity: target.startIdentity,
            processName: target.name,
          }
          report.capture = {
            startedEpochMs: capture.startedEpochMs,
            endedEpochMs: capture.endedEpochMs,
            durationMs: capture.durationMs,
            requestedDurationSeconds: 1,
            requestedIntervalMs: 10,
            maxOutputBytes: MAX_STACK_FILE_BYTES,
            outputBytes: file.size,
            outputTruncated: file.truncated || false,
            classification,
          }
          report.classification = classification
          if (capture.ok && classification === "captured")
            report.status = "passed"
        }
      }
    }
  } catch (error) {
    report.classification = errorKind(error)
  } finally {
    if (browser) {
      try {
        await browser.close()
        report.browserClosed = true
      } catch {
        report.browserClosed = false
        if (report.status === "passed") {
          report.status = "failed"
          report.classification = "browser_close_failed"
        }
      }
    }
  }

  report.durationMs = Date.now() - startedEpochMs
  try {
    await writeFile(PREFLIGHT_REPORT_PATH, JSON.stringify(report) + "\n", {
      encoding: "utf8",
      mode: 0o600,
    })
  } catch (error) {
    process.stderr.write(
      "D4 WebKit stack preflight report could not be written (" +
        errorKind(error) +
        ").\n",
    )
    process.exitCode = 2
    return
  }
  process.stdout.write(
    "D4 WebKit stack preflight " +
      report.status +
      " (" +
      report.classification +
      ").\n",
  )
  if (report.status !== "passed") process.exitCode = 1
}

async function boundedFileSize(file, limit) {
  let size
  try {
    size = (await stat(file)).size
  } catch (error) {
    return { size: 0, error: errorKind(error) }
  }
  const retainedBytes = Math.min(size, limit)
  if (retainedBytes < size) await truncate(file, retainedBytes)
  return { size: retainedBytes, truncated: retainedBytes < size }
}
async function startupInfo(errors) {
  const specs = [
    ["swVers", "sw_vers", []],
    ["uname", "uname", ["-a"]],
    ["cpuCount", "sysctl", ["-n", "hw.ncpu"]],
    ["memoryBytes", "sysctl", ["-n", "hw.memsize"]],
  ]
  const results = await Promise.all(
    specs.map(async ([key, file, args]) => [key, await command(file, args)]),
  )
  const info = {}
  for (const [key, result] of results) {
    if (!result.ok) {
      noteError(errors, key, result.kind)
      continue
    }
    if (key === "swVers") {
      info.swVers = Object.fromEntries(
        result.text
          .split(/\r?\n/)
          .map((line) => line.match(/^([^:]{1,80}):\s*(.{0,200})$/))
          .filter(Boolean)
          .map((m) => [m[1], m[2]]),
      )
    } else if (key === "uname") info.uname = result.text.trim().slice(0, 500)
    else {
      const value = Number(result.text.trim())
      if (Number.isFinite(value)) info[key] = value
      else noteError(errors, key, "invalid_output")
    }
  }
  const runnerImage = {}
  for (const key of ["ImageOS", "ImageVersion"]) {
    if (process.env[key]) runnerImage[key] = process.env[key].slice(0, 200)
  }
  return { ...info, runnerImage }
}

async function openWriter() {
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  let existing = 0
  try {
    existing = (await stat(OUTPUT_PATH)).size
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
  return createCappedWriter(
    (line) => appendFile(OUTPUT_PATH, line, "utf8"),
    existing,
  )
}

async function run() {
  if (process.platform !== "darwin") {
    process.stderr.write(
      "D4 host sampler requires macOS; no verification child was started.\n",
    )
    process.exitCode = 2
    return
  }

  let writer
  try {
    writer = await openWriter()
  } catch (error) {
    process.stderr.write(
      "D4 host sampler could not open its telemetry log (" +
        errorKind(error) +
        ").\n",
    )
    process.exitCode = 2
    return
  }

  const startupErrors = []
  const host = await startupInfo(startupErrors)

  await writer.enqueue({
    type: "run_start",
    timestamp: new Date().toISOString(),
    epochMs: Date.now(),
    host,
    telemetryErrors: startupErrors,
  })

  const stackState = {
    ready: false,
    commandCount: 0,
    totalSamples: 0,
    totalBytes: 0,
    attemptSamples: new Map(),
    nextIndex: 0,
    runTag: `${Date.now()}-${process.pid}`,
  }
  try {
    await mkdir(STACK_DIR, { recursive: true })
    stackState.ready = true
    const preflightPath = path.join(
      STACK_DIR,
      `preflight-${stackState.runTag}.txt`,
    )
    try {
      await unlink(preflightPath)
    } catch (error) {
      if (error.code !== "ENOENT") throw error
    }
    stackState.commandCount++
    const preflight = await runSampleCommand(process.pid, preflightPath)
    const preflightFile = await boundedFileSize(
      preflightPath,
      MAX_STACK_FILE_BYTES,
    )
    const preflightEvent = {
      type: "stack_preflight",
      timestamp: new Date(preflight.startedEpochMs).toISOString(),
      epochMs: preflight.startedEpochMs,
      endedEpochMs: preflight.endedEpochMs,
      durationMs: preflight.durationMs,
      pid: process.pid,
      status: preflight.ok && preflightFile.size > 0 ? "captured" : "failed",
      failureKind:
        preflight.kind ||
        preflightFile.error ||
        (preflightFile.size ? null : "empty_output"),
      outputBytes: preflightFile.size,
    }
    if (preflightEvent.failureKind)
      noteError(startupErrors, "stack_preflight", preflightEvent.failureKind)
    await writer.enqueue(preflightEvent)
    await unlink(preflightPath).catch(() => {})
  } catch (error) {
    stackState.ready = false
    noteError(startupErrors, "stack_preflight", errorKind(error))
    await writer.enqueue({
      type: "stack_preflight",
      timestamp: new Date().toISOString(),
      epochMs: Date.now(),
      pid: process.pid,
      status: "unavailable",
      failureKind: errorKind(error),
    })
  }

  const child = spawn("npm", ["run", "verify:all"], {
    stdio: "inherit",
    shell: false,
  })
  let sampleInFlight = null
  let sampleCount = 0
  let lastExtendedAt = 0
  let previousCpu = process.cpuUsage()
  const runStart = Date.now()
  const markerState = {
    seen: new Set(),
    starts: new Map(),
    ends: new Set(),
    lastError: null,
  }
  const sample = async () => {
    const startedEpochMs = Date.now()
    const started = process.hrtime.bigint()
    const errors = []
    const includeExtended =
      sampleCount === 0 || startedEpochMs - lastExtendedAt >= 10000
    if (includeExtended) lastExtendedAt = startedEpochMs
    const jobs = [
      ["ps", readPs()],
      ["caseMarkers", readCaseMarkers(markerState)],
    ]
    if (includeExtended)
      jobs.push(
        ["vmStat", command("vm_stat", [])],
        ["swap", command("sysctl", ["vm.swapusage"])],
        ["thermal", command("pmset", ["-g", "therm"])],
      )
    const results = await Promise.all(
      jobs.map(async ([key, promise]) => [key, await promise]),
    )
    const values = {}
    let allProcesses = []
    let markerRead = { markers: [], error: null }
    for (const [key, result] of results) {
      if (key === "caseMarkers") {
        markerRead = result
        continue
      }
      if (!result.ok) {
        noteError(errors, key, result.kind)
        continue
      }
      if (key === "ps") {
        allProcesses = parsePs(result.text)
        values.processes = selectProcesses(allProcesses, child.pid)
        if (!values.processes.length) noteError(errors, "ps", "invalid_output")
      }
      if (key === "vmStat") {
        values.vmStat = parseVmStat(result.text)
        if (!Object.keys(values.vmStat.pages).length)
          noteError(errors, "vmStat", "invalid_output")
      }
      if (key === "swap") {
        values.swap = parseSwap(result.text)
        if (!values.swap) noteError(errors, "swap", "invalid_output")
      }
      if (key === "thermal") {
        values.thermal = parseThermal(result.text)
        if (!Object.keys(values.thermal).length)
          noteError(errors, "thermal", "invalid_output")
      }
    }
    for (const marker of markerRead.markers) {
      applyCaseMarker(markerState, marker)
      await writer.enqueue({
        type: "case_marker",
        timestamp: marker.timestamp,
        epochMs: marker.epochMs,
        markerType: marker.type,
        project: marker.project,
        file: marker.file,
        title: marker.title,
        retry: marker.retry,
        status: marker.status,
        durationMs: marker.durationMs,
      })
    }
    if (markerRead.error && markerRead.error !== markerState.lastError) {
      noteError(errors, "case_markers", markerRead.error)
      markerState.lastError = markerRead.error
    } else if (!markerRead.error) markerState.lastError = null

    const currentCase = activeCase(markerState)
    let stackDecision = null
    if (currentCase) {
      const selection = selectStackProcess(
        allProcesses,
        child.pid,
        currentCase,
        process.getuid(),
        startedEpochMs,
      )
      const attemptSamples =
        stackState.attemptSamples.get(currentCase.retry) || 0
      const selectedProcess = selection.process
      if (!selectedProcess) {
        stackDecision = {
          retry: currentCase.retry,
          reason: selection.reason,
          candidateCount: selection.candidateCount || 0,
        }
      } else if (!stackState.ready) {
        stackDecision = {
          retry: currentCase.retry,
          reason: "stack_dir_unavailable",
        }
      } else if (stackState.commandCount >= MAX_STACKS_TOTAL) {
        stackDecision = { retry: currentCase.retry, reason: "sample_count_cap" }
      } else if (attemptSamples >= MAX_STACKS_PER_ATTEMPT) {
        stackDecision = {
          retry: currentCase.retry,
          reason: "attempt_sample_cap",
        }
      } else if (stackState.totalBytes >= MAX_STACK_TOTAL_BYTES) {
        stackDecision = { retry: currentCase.retry, reason: "byte_cap" }
      } else {
        const stackIndex = stackState.nextIndex++
        const stackPath = path.join(
          STACK_DIR,
          `run-${stackState.runTag}-retry-${currentCase.retry}-sample-${stackIndex}.txt`,
        )
        const target = selectedProcess
        const freshCensus = await readPs()
        const identity = freshCensus.ok
          ? checkProcessIdentity(
              parsePs(freshCensus.text),
              target,
              process.getuid(),
            )
          : { ok: false, reason: freshCensus.kind }
        if (!identity.ok) {
          stackDecision = {
            retry: currentCase.retry,
            reason: `identity_recheck_${identity.reason}`,
            pid: target.pid,
          }
          noteError(errors, "stack_identity_recheck", identity.reason)
        } else {
          stackState.commandCount++
          const capture = await runSampleCommand(
            identity.process.pid,
            stackPath,
          )
          const remainingBytes = MAX_STACK_TOTAL_BYTES - stackState.totalBytes
          const file = await boundedFileSize(
            stackPath,
            Math.min(MAX_STACK_FILE_BYTES, remainingBytes),
          )
          stackState.totalSamples++
          stackState.attemptSamples.set(currentCase.retry, attemptSamples + 1)
          const failureKind = classifyStackCapture(capture, file)
          const status =
            capture.ok && failureKind === "captured" ? "captured" : "failed"
          if (file.size > 0) {
            stackState.totalBytes += file.size
          } else await unlink(stackPath).catch(() => {})
          if (failureKind !== "captured")
            noteError(errors, "stack_sample", failureKind)
          stackDecision = {
            type: "stack_sample",
            timestamp: new Date(capture.startedEpochMs).toISOString(),
            epochMs: capture.startedEpochMs,
            endedEpochMs: capture.endedEpochMs,
            durationMs: capture.durationMs,
            retry: currentCase.retry,
            sample: attemptSamples,
            totalSample: stackState.commandCount,
            status,
            failureKind: status === "captured" ? null : failureKind,
            pid: identity.process.pid,
            ppid: identity.process.ppid,
            uid: identity.process.uid,
            processName: identity.process.name,
            startIdentity: identity.process.startIdentity,
            selectionReason: selection.reason,
            candidateCount: selection.candidateCount,
            browserPid: selection.browserPid,
            browserStartIdentity: selection.browserStartIdentity,
            browserStartGapMs: selection.browserStartGapMs,
            outputFile: path.basename(stackPath),
            outputBytes: file.size,
            outputTruncated: file.truncated || false,
            totalOutputBytes: stackState.totalBytes,
          }
        }
      }
    }
    const currentCpu = process.cpuUsage()
    const samplerCpuMicros = {
      user: currentCpu.user - previousCpu.user,
      system: currentCpu.system - previousCpu.system,
    }
    previousCpu = currentCpu
    const endedEpochMs = Date.now()
    const record = {
      type: "sample",
      sample: sampleCount++,
      timestamp: new Date(startedEpochMs).toISOString(),
      epochMs: startedEpochMs,
      endedEpochMs,
      durationMs: Number(process.hrtime.bigint() - started) / 1e6,
      elapsedMs: endedEpochMs - runStart,
      host: {
        loadavg: os.loadavg(),
        freeMemoryBytes: os.freemem(),
        totalMemoryBytes: os.totalmem(),
      },
      samplerCpuMicros,
      activeCase: currentCase
        ? { retry: currentCase.retry, epochMs: currentCase.epochMs }
        : null,
      stackDecision,
      ...values,
      telemetryErrors: errors,
    }
    await writer.enqueue(record)
    if (stackDecision?.type === "stack_sample")
      await writer.enqueue(stackDecision)
  }
  const safeSample = () => {
    if (sampleInFlight) return
    sampleInFlight = sample()
      .catch((error) => {
        const errors = []
        noteError(errors, "sample", errorKind(error))
        return writer.enqueue({
          type: "sample_error",
          timestamp: new Date().toISOString(),
          telemetryErrors: errors,
        })
      })
      .finally(() => {
        sampleInFlight = null
      })
  }
  const timer = setInterval(safeSample, 2000)
  safeSample()

  const forwardedSignals = []
  const handlers = new Map()
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    const handler = () => {
      forwardedSignals.push(signal)
      try {
        if (child.exitCode === null && child.signalCode === null)
          child.kill(signal)
      } catch (error) {
        noteError([], "signal_forward", errorKind(error))
      }
    }
    handlers.set(signal, handler)
    process.on(signal, handler)
  }

  const outcome = await new Promise((resolve) => {
    let spawnError = null
    child.once("error", (error) => {
      spawnError = errorKind(error)
    })
    child.once("close", (code, signal) => resolve({ code, signal, spawnError }))
  })

  clearInterval(timer)
  if (sampleInFlight) await sampleInFlight
  for (const [signal, handler] of handlers)
    process.removeListener(signal, handler)
  await writer.enqueue(
    {
      type: "run_end",
      timestamp: new Date().toISOString(),
      epochMs: Date.now(),
      exitCode: outcome.code,
      signal: outcome.signal,
      spawnError: outcome.spawnError,
      elapsedMs: Date.now() - runStart,
      sampleCount,
      stackCommands: stackState.commandCount,
      stackSamples: stackState.totalSamples,
      stackBytes: stackState.totalBytes,
      forwardedSignals,
      telemetryErrors: Object.fromEntries(ERROR_COUNTS),
      log: writer.state(),
    },
    true,
  )

  if (writer.state().writeFailure)
    process.stderr.write(
      "D4 host sampler telemetry log failed (" +
        writer.state().writeFailure +
        ")." +
        String.fromCharCode(10),
    )
  if (outcome.signal) process.kill(process.pid, outcome.signal)
  else process.exitCode = outcome.code ?? 1
}

async function selfCheck() {
  const rows = parsePs(
    [
      "100  1  501 00:04  00:00.40  12000 S Sun Oct 18 10:00:00 2026 /usr/bin/npm",
      "101  100 501 00:03  00:00.20  9000  S Sun Oct 18 10:00:01 2026 /opt/node",
      "102  101 501 00:02  00:00.10  8000  S Sun Oct 18 10:00:02 2026 /tmp/WebKitNetworkProcess",
      "200  1  501 10:00  00:00.01  1000  S Sun Oct 18 09:00:00 2026 /Applications/Other.app/Contents/MacOS/WebKitWebContent",
      "201  1  501 10:00  00:00.01  1000  S Sun Oct 18 09:00:00 2026 /Applications/Other.app/Contents/MacOS/MiniBrowser",
      "300  1  501 10:00  00:00.01  1000  S Sun Oct 18 09:00:00 2026 /bin/bash",
    ].join("\n"),
  )
  assert.equal(rows.length, 6)
  assert.deepEqual(
    selectProcesses(rows, 100).map((row) => row.pid),
    [100, 101, 102, 200, 201],
  )
  assert.equal(rows[1].name, "node")
  assert.equal(rows[2].startIdentity, "Sun Oct 18 10:00:02 2026")
  assert.equal(rows[1].uid, 501)
  const caseStart = Date.parse("Sun Oct 18 10:00:00 2026")
  const selected = selectStackProcess(
    [
      {
        pid: 100,
        ppid: 50,
        uid: 501,
        name: "npm",
        startIdentity: "Sun Oct 18 09:59:00 2026",
      },
      {
        pid: 101,
        ppid: 100,
        uid: 501,
        name: "Playwright",
        startIdentity: "Sun Oct 18 09:59:01 2026",
      },
      {
        pid: 102,
        ppid: 1,
        uid: 501,
        name: "com.apple.WebKit.WebContent.Development",
        startIdentity: "Sun Oct 18 10:00:01 2026",
      },
      {
        pid: 103,
        ppid: 1,
        uid: 501,
        name: "com.apple.WebKit.WebContent.Development",
        startIdentity: "Sun Oct 18 09:50:00 2026",
      },
      {
        pid: 104,
        ppid: 1,
        uid: 502,
        name: "com.apple.WebKit.WebContent.Development",
        startIdentity: "Sun Oct 18 10:00:01 2026",
      },
    ],
    100,
    { epochMs: caseStart },
    501,
    caseStart + 2000,
  )
  assert.equal(selected.process.pid, 102)
  assert.equal(selected.reason, "case_recent_start")
  assert.equal(selected.candidateCount, 1)
  assert.equal(isOwnedSelection(selected), false)
  const ownedSelection = selectStackProcess(
    [
      {
        pid: 100,
        ppid: 50,
        uid: 501,
        name: "node",
        startIdentity: "Sun Oct 18 09:59:00 2026",
      },
      {
        pid: 101,
        ppid: 100,
        uid: 501,
        name: "MiniBrowser",
        startIdentity: "Sun Oct 18 10:00:01 2026",
      },
      {
        pid: 102,
        ppid: 1,
        uid: 501,
        name: "com.apple.WebKit.WebContent.Development",
        startIdentity: "Sun Oct 18 10:00:02 2026",
      },
    ],
    100,
    { epochMs: caseStart },
    501,
    caseStart + 2000,
  )
  assert.equal(ownedSelection.process.pid, 102)
  assert.equal(isOwnedSelection(ownedSelection), true)
  const identityRows = [
    {
      ...rows[0],
      pid: 102,
      uid: 501,
      name: "com.apple.WebKit.WebContent",
      startIdentity: rows[2].startIdentity,
    },
  ]
  const identityTarget = identityRows[0]
  assert.equal(checkProcessIdentity(identityRows, identityTarget, 501).ok, true)
  assert.equal(
    checkProcessIdentity(
      [{ ...identityTarget, startIdentity: "Sun Oct 18 10:00:03 2026" }],
      identityTarget,
      501,
    ).reason,
    "start_identity_changed",
  )
  assert.equal(
    checkProcessIdentity([{ ...identityTarget, uid: 502 }], identityTarget, 501)
      .reason,
    "uid_changed",
  )
  assert.equal(classifyStackCapture({ ok: true }, { size: 0 }), "empty_output")
  assert.equal(
    classifyStackCapture({ kind: "permission_denied" }, { size: 0 }),
    "permission_denied",
  )
  assert.equal(classifyStackCapture({ ok: true }, { size: 10 }), "captured")
  const vm = parseVmStat(
    "Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages free: 1,234.\nPages active: 42.",
  )
  assert.equal(vm.pageSizeBytes, 16384)
  assert.equal(vm.pages["Pages free"], 1234)
  assert.deepEqual(
    parseSwap("vm.swapusage: total = 1.00G used = 0.25G free = 0.75G"),
    { total: "1.00G", used: "0.25G", free: "0.75G" },
  )
  assert.equal(errorKind({ killed: true }), "timeout")
  assert.equal(errorKind({ code: "EPERM" }), "EPERM")
  assert.equal(sampleErrorKind({ code: "EPERM" }), "permission_denied")
  assert.equal(
    sampleErrorKind({
      stderr: "System Integrity Protection prevents sampling",
    }),
    "system_integrity_protection",
  )
  assert.equal(
    sampleOutputErrorKind("Operation not permitted while sampling"),
    "permission_denied",
  )
  assert.deepEqual(
    parseThermal(
      [
        "CPU_Speed_Limit = 100",
        "  Note: No thermal warning level has been recorded",
        "Note: No performance warning level has been recorded",
      ].join(String.fromCharCode(10)),
    ),
    {
      CPU_Speed_Limit: "100",
      thermalWarningRecorded: false,
      performanceWarningRecorded: false,
    },
  )
  const lines = []
  const capped = createCappedWriter(
    async (line) => lines.push(line),
    0,
    300,
    60,
  )
  await capped.enqueue({ type: "sample", payload: "x".repeat(110) })
  await capped.enqueue({ type: "sample", payload: "y".repeat(110) })
  await capped.enqueue({ type: "run_end", exitCode: 0 }, true)
  assert.ok(capped.state().bytes <= 300)
  assert.equal(
    lines.filter((line) => JSON.parse(line).type === "truncation").length,
    1,
  )
  assert.equal(JSON.parse(lines.at(-1)).type, "run_end")
  let unhandledRejection = false
  const captureUnhandled = () => {
    unhandledRejection = true
  }
  process.on("unhandledRejection", captureUnhandled)
  try {
    const failing = createCappedWriter(
      async () => {
        throw Object.assign(new Error("synthetic writer failure"), {
          code: "EACCES",
        })
      },
      0,
      300,
      60,
    )
    await failing.enqueue({ type: "sample" })
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(failing.state().writeFailure, "EACCES")
    assert.equal(unhandledRejection, false)
  } finally {
    process.removeListener("unhandledRejection", captureUnhandled)
  }
  if (process.platform === "darwin") {
    const livePs = await readPs()
    assert.ok(livePs.ok, "macOS ps command failed")
    const liveRows = parsePs(livePs.text)
    assert.ok(
      liveRows.some((row) => row.pid === process.pid),
      "macOS ps parser missed this process",
    )
    const liveVmResult = await command("vm_stat", [])
    assert.ok(liveVmResult.ok, "macOS vm_stat command failed")
    const liveVm = parseVmStat(liveVmResult.text)
    assert.ok(liveVm.pageSizeBytes > 0, "macOS vm_stat parser missed page size")
    process.stdout.write(
      "macOS live parser preflight passed: " +
        liveRows.length +
        " rows, page size " +
        liveVm.pageSizeBytes +
        " bytes.\n",
    )
  }
  process.stdout.write("D4 host sampler self-check passed.\n")
}

if (process.argv.includes("--stack-preflight")) await stackPermissionPreflight()
else if (process.argv.includes("--self-check")) await selfCheck()
else await run()
