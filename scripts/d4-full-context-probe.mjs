#!/usr/bin/env node
import os from "node:os"
import path from "node:path"
import { spawn, execFile as execFileCallback } from "node:child_process"
import { promisify } from "node:util"
import { appendFile, mkdir, stat } from "node:fs/promises"
import assert from "node:assert/strict"

const execFile = promisify(execFileCallback)
const MAX_LOG_BYTES = 32 * 1024 * 1024
const SUMMARY_RESERVE_BYTES = 2048
const PS_ARGS = [
  "-ww",
  "-axo",
  "pid=,ppid=,etime=,time=,rss=,state=,lstart=,comm=",
]
const PS_BUFFER = 1024 * 1024
const OUTPUT_PATH =
  process.env.CVC_D4_HOST_OUTPUT ||
  path.join(os.tmpdir(), "cvc-d4-full-context-host.jsonl")
const ERROR_COUNTS = new Map()

function parsePs(text) {
  const rows = []
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(
      /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\d+)\s+(\S+)\s+(\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+?)\s*$/,
    )
    if (!m) continue
    rows.push({
      pid: Number(m[1]),
      ppid: Number(m[2]),
      elapsed: m[3],
      cpuTime: m[4],
      rssKb: Number(m[5]),
      state: m[6],
      startIdentity: m[7],
      name: path.basename(m[8].trim()),
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
  if (error && (error.killed || error.code === "ETIMEDOUT")) return "timeout"
  if (error && typeof error.code === "string") return error.code.slice(0, 32)
  return "command_failed"
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

  const child = spawn("npm", ["run", "verify:all"], {
    stdio: "inherit",
    shell: false,
  })
  let sampleInFlight = null
  let sampleCount = 0
  let lastExtendedAt = 0
  let previousCpu = process.cpuUsage()
  const runStart = Date.now()
  const sample = async () => {
    const startedEpochMs = Date.now()
    const started = process.hrtime.bigint()
    const errors = []
    const includeExtended =
      sampleCount === 0 || startedEpochMs - lastExtendedAt >= 10000
    if (includeExtended) lastExtendedAt = startedEpochMs
    const jobs = [["ps", readPs()]]
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
    for (const [key, result] of results) {
      if (!result.ok) {
        noteError(errors, key, result.kind)
        continue
      }
      if (key === "ps") {
        values.processes = selectProcesses(parsePs(result.text), child.pid)
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
      ...values,
      telemetryErrors: errors,
    }
    await writer.enqueue(record)
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
      "100  1  00:04  00:00.40  12000 S Sun Oct 18 10:00:00 2026 /usr/bin/npm",
      "101  100 00:03  00:00.20  9000  S Sun Oct 18 10:00:01 2026 /opt/node",
      "102  101 00:02  00:00.10  8000  S Sun Oct 18 10:00:02 2026 /tmp/WebKitNetworkProcess",
      "200  1  10:00  00:00.01  1000  S Sun Oct 18 09:00:00 2026 /Applications/Other.app/Contents/MacOS/WebKitWebContent",
      "201  1  10:00  00:00.01  1000  S Sun Oct 18 09:00:00 2026 /Applications/Other.app/Contents/MacOS/MiniBrowser",
      "300  1  10:00  00:00.01  1000  S Sun Oct 18 09:00:00 2026 /bin/bash",
    ].join("\n"),
  )
  assert.equal(rows.length, 6)
  assert.deepEqual(
    selectProcesses(rows, 100).map((row) => row.pid),
    [100, 101, 102, 200, 201],
  )
  assert.equal(rows[1].name, "node")
  assert.equal(rows[2].startIdentity, "Sun Oct 18 10:00:02 2026")
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

if (process.argv.includes("--self-check")) await selfCheck()
else await run()
