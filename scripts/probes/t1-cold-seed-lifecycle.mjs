import { createRequire } from "node:module"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { availableParallelism, totalmem, freemem, loadavg } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

if (Number(process.versions.node.split(".")[0]) !== 24)
  throw new Error("Requires repository Node 24.")
const root = resolve(process.argv[2] ?? process.cwd())
for (const p of [
  "package.json",
  "vite.config.ts",
  "src/test/d1MigrationHarness.ts",
]) {
  if (!existsSync(join(root, p)))
    throw new Error("Missing repository path: " + p)
}
const out = join(dirname(fileURLToPath(import.meta.url)), "results.json")
const seed =
  process.env.CVC_T1_AB_SEED === undefined
    ? 0xd1d3ab08
    : Number(process.env.CVC_T1_AB_SEED)
if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
  throw new Error("CVC_T1_AB_SEED must be uint32.")
const req = createRequire(join(root, "package.json"))
const { createServer } = await import(pathToFileURL(req.resolve("vite")).href)
const { devices, webkit } = req("@playwright/test")

function rngFor(n) {
  let s = n >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function shuffle(xs, rng) {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const random = rngFor(seed)
const pairOrder = shuffle(
  Array.from({ length: 8 }, (_, i) => i + 1),
  random,
)
const plan = []
for (const pairId of pairOrder) {
  const variants = ["same-page", "sibling-page-close"]
  if (random() < 0.5) variants.reverse()
  for (const variant of variants)
    plan.push({ pairId, variant, order: plan.length + 1 })
}
const report = {
  diagnostic: "D1 legacy seed lifecycle A/B",
  status: "running",
  repoRoot: root,
  nodeVersion: process.versions.node,
  sourceCommit: process.env.GITHUB_SHA ?? null,
  playwrightVersion: req("@playwright/test/package.json").version,
  seed,
  pairOrder,
  plan,
  environment: {
    browser: "fresh Playwright WebKit launch per case; default headless mode",
    context: "fresh browser context per case",
    device: "iPhone 13 descriptor",
    locale: "it-IT",
    platform: process.platform,
    architecture: process.arch,
    cpuCount: availableParallelism(),
    memoryBytes: totalmem(),
    retries: 0,
    caseTimeoutMs: 120000,
    tracing:
      "Playwright-style tracing; retained with screenshot only for a failed case",
    server: "dedicated Vite server on an OS-assigned port",
    waits:
      "none before measurement; bounded event collection after measurement only",
  },
  sourceReferences: [
    "tests/e2e/d1-migration.spec.ts:285-347",
    "tests/e2e/d3-engine-startup.spec.ts:33-90,96-117,122-228",
    "src/test/d1MigrationHarness.ts:455-468,473-586",
    "playwright.config.ts:51-62",
  ],
  cases: [],
  notRunCases: [],
}
function persist() {
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n", "utf8")
}

function coldIssue(events) {
  if (events.some(({ type }) => type === "fallback" || type === "error"))
    return "fallback/error event"
  const instances = events.filter(({ type }) => type === "instance-created")
  if (instances.length !== 2)
    return "expected exactly two instance-created events"
  if (
    instances.some(
      ({ workerId, moduleKey, instanceId }) =>
        !workerId?.trim() || !moduleKey?.trim() || !instanceId?.trim(),
    )
  )
    return "missing instance identity"
  if (
    new Set(instances.map((x) => x.workerId)).size !== 2 ||
    new Set(instances.map((x) => x.instanceId)).size !== 2
  )
    return "worker or instance reused"
  if (
    events[0]?.type !== "cache-miss" ||
    events.filter(({ type }) => type === "cache-miss").length !== 1
  )
    return "missing unique initial cache miss"
  const first = events.findIndex(({ type }) => type === "instance-created")
  const firstOpen = events.slice(0, first + 1)
  if (
    !firstOpen.some((x) => x.type === "compile-start") ||
    !firstOpen.some((x) => x.type === "compile-complete")
  )
    return "missing first-open compile evidence"
  const reopen = events.slice(first + 1)
  if (reopen[0]?.type !== "cache-hit")
    return "reopen did not start with cache-hit"
  if (
    reopen.some(
      (x) => x.type === "compile-start" || x.type === "compile-complete",
    )
  )
    return "reopen recompiled"
  if (reopen.filter((x) => x.type === "instance-created").length !== 1)
    return "reopen did not create one fresh instance"
  if (new Set(instances.map((x) => x.moduleKey)).size !== 1)
    return "module key changed"
  return null
}
function checksOf(o, events, ready) {
  const r = o?.measurement
  const prior = [
    o?.candidateEventsBeforeImport ?? 0,
    o?.candidateEventsAfterImport ?? 0,
    o?.candidateEventsBeforeMeasure ?? 0,
    r?.priorEventCount,
  ]
  const checks = [
    [
      "zero candidate events before measurement",
      prior.every((x) => x === 0),
      prior,
    ],
    [
      "first-open invariant issues empty",
      Array.isArray(r?.rowIssues) && r.rowIssues.length === 0,
      r?.rowIssues,
    ],
    [
      "reopen count equals first count",
      r?.reopenRows === r?.rows,
      { rows: r?.rows, reopenRows: r?.reopenRows },
    ],
    [
      "reopen invariant issues empty",
      Array.isArray(r?.reopenRowIssues) && r.reopenRowIssues.length === 0,
      r?.reopenRowIssues,
    ],
    [
      "reopened tables identical",
      r?.reopenedIdentical === true,
      r?.reopenedIdentical,
    ],
    [
      "expected, first and reopened rows exactly 609",
      r?.expectedRows === 609 && r?.rows === 609 && r?.reopenRows === 609,
      { expected: r?.expectedRows, rows: r?.rows, reopenRows: r?.reopenRows },
    ],
    [
      "expected, first and reopened injected students exactly 40",
      r?.expectedInjectedStudentRows === 40 &&
        r?.injectedStudentRows === 40 &&
        r?.reopenInjectedStudentRows === 40,
      {
        expected: r?.expectedInjectedStudentRows,
        first: r?.injectedStudentRows,
        reopen: r?.reopenInjectedStudentRows,
      },
    ],
    [
      "expected, first and reopened injected evaluations exactly 520",
      r?.expectedInjectedEvaluationRows === 520 &&
        r?.injectedEvaluationRows === 520 &&
        r?.reopenInjectedEvaluationRows === 520,
      {
        expected: r?.expectedInjectedEvaluationRows,
        first: r?.injectedEvaluationRows,
        reopen: r?.reopenInjectedEvaluationRows,
      },
    ],
    [
      "first open remains below 5000 ms",
      typeof r?.durationMs === "number" && r.durationMs < 5000,
      r?.durationMs,
    ],
    [
      "reopen remains below 5000 ms",
      typeof r?.reopenMs === "number" && r.reopenMs < 5000,
      r?.reopenMs,
    ],
    ["diagnostic collection saw two instance events", ready, ready],
    [
      "cold cache-miss, compile, fresh instances and reopen cache-hit",
      coldIssue(events) === null,
      coldIssue(events),
    ],
  ].map(([name, passed, observed]) => ({ name, passed, observed }))
  return { checks, allChecksPassed: checks.every((x) => x.passed) }
}
const isRoot = (url) => new URL(url).pathname === "/"
async function blank(page, base) {
  await page.route(isRoot, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body></body></html>",
    }),
  )
  await page.goto(new URL("/", base).href)
  await page.unroute(isRoot)
}
async function collect(page) {
  const ready = await page
    .waitForFunction(
      () =>
        (globalThis.__CVC_ENGINE_DIAGNOSTIC__ ?? []).filter(
          (x) => x.type === "instance-created",
        ).length >= 2,
      undefined,
      { timeout: 5000 },
    )
    .then(async (h) => {
      await h.dispose()
      return true
    })
    .catch(() => false)
  const events = await page.evaluate(() => [
    ...(globalThis.__CVC_ENGINE_DIAGNOSTIC__ ?? []),
  ])
  return { ready, events }
}
async function samePage(page) {
  return page.evaluate(async () => {
    const candidateEventsBeforeImport =
      globalThis.__CVC_ENGINE_DIAGNOSTIC__?.length ?? 0
    const path = "/src/test/d1MigrationHarness.ts"
    const h = await import(/* @vite-ignore */ path)
    const candidateEventsAfterImport =
      globalThis.__CVC_ENGINE_DIAGNOSTIC__?.length ?? 0
    const filename = await h.seedLargeUpgrade()
    const candidateEventsBeforeMeasure =
      globalThis.__CVC_ENGINE_DIAGNOSTIC__?.length ?? 0
    const measurement = await h.measureLargeUpgrade(filename)
    return {
      filename,
      candidateEventsBeforeImport,
      candidateEventsAfterImport,
      candidateEventsBeforeMeasure,
      measurement,
    }
  })
}
async function siblingMeasure(page, filename) {
  return page.evaluate(async (dbFilename) => {
    const candidateEventsBeforeImport =
      globalThis.__CVC_ENGINE_DIAGNOSTIC__?.length ?? 0
    const path = "/src/test/d1MigrationHarness.ts"
    const h = await import(/* @vite-ignore */ path)
    const candidateEventsAfterImport =
      globalThis.__CVC_ENGINE_DIAGNOSTIC__?.length ?? 0
    const candidateEventsBeforeMeasure =
      globalThis.__CVC_ENGINE_DIAGNOSTIC__?.length ?? 0
    const measurement = await h.measureLargeUpgrade(dbFilename)
    return {
      filename: dbFilename,
      candidateEventsBeforeImport,
      candidateEventsAfterImport,
      candidateEventsBeforeMeasure,
      measurement,
    }
  }, filename)
}
const CASE_TIMEOUT_MS = 120000

async function runCase(item, base) {
  const rec = {
    ...item,
    attempt: 1,
    startedAt: new Date().toISOString(),
    hostAtStart: { freeMemoryBytes: freemem(), loadAverage: loadavg() },
    status: "running",
  }
  let browser,
    context,
    candidate,
    tracingStarted = false,
    timedOut = false,
    timer
  const closeOwnedResources = async () => {
    const closures = []
    if (context) closures.push(context.close().catch(() => {}))
    if (browser) closures.push(browser.close().catch(() => {}))
    await Promise.all(closures)
  }
  const timeoutPromise = new Promise((resolveTimeout) => {
    timer = setTimeout(async () => {
      timedOut = true
      rec.status = "case-timeout"
      rec.error = {
        name: "TimeoutError",
        message:
          "Case exceeded the original 120000 ms Playwright test deadline.",
        timeoutMs: CASE_TIMEOUT_MS,
      }
      await closeOwnedResources()
      resolveTimeout()
    }, CASE_TIMEOUT_MS)
  })

  const workPromise = (async () => {
    try {
      browser = await webkit.launch()
      if (timedOut) {
        await closeOwnedResources()
        return
      }
      context = await browser.newContext({
        ...devices["iPhone 13"],
        locale: "it-IT",
      })
      if (timedOut) {
        await context.close().catch(() => {})
        return
      }
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true,
      })
      tracingStarted = true
      candidate = await context.newPage()
      await blank(candidate, base)
      let observation
      if (item.variant === "same-page") {
        observation = await samePage(candidate)
      } else {
        const seedPage = await context.newPage()
        let filename
        try {
          await blank(seedPage, base)
          filename = await seedPage.evaluate(async () => {
            const path = "/src/test/d1MigrationHarness.ts"
            const h = await import(/* @vite-ignore */ path)
            return h.seedLargeUpgrade()
          })
          await seedPage.close()
        } finally {
          if (!seedPage.isClosed()) await seedPage.close()
        }
        observation = await siblingMeasure(candidate, filename)
      }
      rec.filename = observation.filename
      rec.observation = observation
      const d = await collect(candidate)
      rec.diagnosticReady = d.ready
      rec.engineEvents = d.events
      const outcome = checksOf(observation, d.events, d.ready)
      rec.checks = outcome.checks
      rec.allChecksPassed = outcome.allChecksPassed
      rec.status = outcome.allChecksPassed
        ? "completed-all-checks-pass"
        : "completed-with-check-failures"
      if (!outcome.allChecksPassed && candidate && !candidate.isClosed()) {
        try {
          const screenshotDir = join(
            dirname(fileURLToPath(import.meta.url)),
            "screenshots",
          )
          mkdirSync(screenshotDir, { recursive: true })
          rec.screenshotFile = join(
            screenshotDir,
            "case-" + rec.order + "-" + rec.variant + ".png",
          )
          await candidate.screenshot({
            path: rec.screenshotFile,
            fullPage: false,
          })
        } catch (error) {
          rec.screenshotError =
            error instanceof Error ? error.message : String(error)
        }
      }
    } catch (error) {
      if (!timedOut) {
        rec.status = "case-error"
        rec.error = {
          name: error instanceof Error ? error.name : "UnknownError",
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
        if (candidate && !candidate.isClosed()) {
          try {
            rec.engineEventsAfterError = await candidate.evaluate(() => [
              ...(globalThis.__CVC_ENGINE_DIAGNOSTIC__ ?? []),
            ])
          } catch {
            rec.engineEventsAfterError = []
          }
        }
      }
    } finally {
      if (!timedOut && context && tracingStarted) {
        if (rec.status !== "completed-all-checks-pass") {
          try {
            const traceDir = join(
              dirname(fileURLToPath(import.meta.url)),
              "traces",
            )
            mkdirSync(traceDir, { recursive: true })
            rec.traceFile = join(
              traceDir,
              "case-" + rec.order + "-" + rec.variant + ".zip",
            )
            await context.tracing.stop({ path: rec.traceFile })
          } catch (error) {
            rec.traceCollectionError =
              error instanceof Error ? error.message : String(error)
          }
        } else {
          await context.tracing.stop().catch(() => {})
        }
      }
      await closeOwnedResources()
    }
  })()

  await Promise.race([workPromise, timeoutPromise])
  clearTimeout(timer)
  if (!timedOut) await workPromise
  if (timedOut) {
    rec.status = "case-timeout"
    rec.allChecksPassed = false
  }
  rec.finishedAt = new Date().toISOString()
  rec.hostAtEnd = { freeMemoryBytes: freemem(), loadAverage: loadavg() }
  return timedOut ? JSON.parse(JSON.stringify(rec)) : rec
}
const server = await createServer({
  root,
  configFile: join(root, "vite.config.ts"),
  clearScreen: false,
  logLevel: "warn",
  server: { host: "127.0.0.1", port: 0, strictPort: true, open: false },
})
try {
  await server.listen()
  const addr = server.httpServer?.address()
  if (!addr || typeof addr === "string")
    throw new Error("Vite did not expose its assigned port.")
  const base = "http://127.0.0.1:" + addr.port
  report.startedAt = new Date().toISOString()
  report.environment.baseURL = base
  report.environment.port = addr.port
  persist()
  let consecutiveCaseErrors = 0
  let stoppedEarly = false
  for (let index = 0; index < plan.length; index += 1) {
    const item = plan[index]
    const rec = await runCase(item, base)
    report.cases.push(rec)
    persist()
    console.log(
      "Case " +
        rec.order +
        "/16 pair " +
        rec.pairId +
        " " +
        rec.variant +
        ": " +
        rec.status,
    )
    if (rec.status === "case-error" || rec.status === "case-timeout") {
      consecutiveCaseErrors += 1
    } else {
      consecutiveCaseErrors = 0
    }
    if (consecutiveCaseErrors >= 2) {
      stoppedEarly = true
      report.notRunCases = plan.slice(index + 1).map((item) => ({
        ...item,
        status: "not-run",
        reason: "Stopped after two consecutive case errors or timeouts.",
      }))
      break
    }
  }
  const passed = report.cases.filter((x) => x.allChecksPassed === true).length
  report.finishedAt = new Date().toISOString()
  report.status = stoppedEarly
    ? "stopped-after-two-consecutive-case-errors"
    : passed === 16
      ? "complete-all-checks-pass"
      : "complete-with-failures-or-errors"
  report.summary = {
    totalPlannedCases: plan.length,
    totalExecutedCases: report.cases.length,
    allChecksPassed: passed,
    failedChecks: report.cases.filter(
      (x) => x.status === "completed-with-check-failures",
    ).length,
    runnerErrors: report.cases.filter(
      (x) => x.status === "case-error" || x.status === "case-timeout",
    ).length,
    notRunCases: report.notRunCases.length,
    caseTimeoutMs: CASE_TIMEOUT_MS,
    platform: process.platform,
    architecture: process.arch,
    cpuCount: availableParallelism(),
    memoryBytes: totalmem(),
    retries: 0,
    tracing:
      "Playwright-style tracing; retained with screenshot only for a failed case",
    interpretation:
      "Descriptive same-machine observations only; not causal proof or a cross-platform speed comparison.",
  }
  process.exitCode =
    report.cases.length === 16 &&
    passed === 16 &&
    report.notRunCases.length === 0
      ? 0
      : 1
  persist()
  console.log("Results saved to " + out)
} catch (error) {
  process.exitCode = 1
  report.status = "runner-error"
  report.finishedAt = new Date().toISOString()
  report.error = {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }
  persist()
  throw error
} finally {
  await server.close().catch(() => {})
}
