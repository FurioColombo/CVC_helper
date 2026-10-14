import { expect, type Page, test } from "@playwright/test"

type EngineDiagnosticEvent = {
  type:
    | "cache-miss"
    | "cache-hit"
    | "compile-start"
    | "compile-complete"
    | "instance-created"
    | "fallback"
    | "error"
  workerId: string
  moduleKey: string
  instanceId?: string
  elapsedMs?: number
}

const isAppRoot = (target: URL) => target.pathname === "/"

async function openBlankPage(page: Page) {
  await page.route(isAppRoot, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body></body></html>",
    }),
  )
  await page.goto("/")
  await page.unroute(isAppRoot)
}

function coldEvidenceIssue(events: EngineDiagnosticEvent[]) {
  if (events.some(({ type }) => type === "fallback" || type === "error")) {
    return "worker module transport fell back or errored"
  }

  const instances = events.filter(({ type }) => type === "instance-created")
  if (instances.length !== 2) {
    return "the two measured opens did not create exactly two engine instances"
  }
  if (
    instances.some(
      ({ workerId, moduleKey, instanceId }) =>
        !workerId.trim() || !moduleKey.trim() || !instanceId?.trim(),
    )
  ) {
    return "engine instance identity telemetry was missing"
  }
  if (
    new Set(instances.map(({ workerId }) => workerId)).size !== 2 ||
    new Set(instances.map(({ instanceId }) => instanceId)).size !== 2
  ) {
    return "reopen reused a worker or Emscripten instance"
  }
  if (events[0]?.type !== "cache-miss") {
    return "first measured open did not start with a cold module-cache miss"
  }
  if (events.filter(({ type }) => type === "cache-miss").length !== 1) {
    return "the measured opens did not share exactly one compiled module"
  }

  const firstInstanceIndex = events.findIndex(
    ({ type }) => type === "instance-created",
  )
  const firstOpen = events.slice(0, firstInstanceIndex + 1)
  for (const type of ["compile-start", "compile-complete"] as const) {
    if (!firstOpen.some((event) => event.type === type)) {
      return `first measured open did not record ${type}`
    }
  }

  const secondOpen = events.slice(firstInstanceIndex + 1)
  if (secondOpen[0]?.type !== "cache-hit") {
    return "reopen did not reuse only the compiled module"
  }
  if (
    secondOpen.some(
      ({ type }) => type === "compile-start" || type === "compile-complete",
    )
  ) {
    return "reopen compiled the module again"
  }
  if (
    secondOpen.filter(({ type }) => type === "instance-created").length !== 1
  ) {
    return "reopen did not create exactly one fresh engine instance"
  }

  const moduleKeys = new Set(instances.map(({ moduleKey }) => moduleKey))
  if (moduleKeys.size !== 1 || !moduleKeys.values().next().value) {
    return "open and reopen did not use the same compiled module"
  }
  return null
}

async function seedLargeUpgradeFromSeparatePage(page: Page) {
  const seedPage = await page.context().newPage()
  try {
    await openBlankPage(seedPage)
    return await seedPage.evaluate(async () => {
      const modulePath = "/src/test/d1MigrationHarness.ts"
      const harness = (await import(/* @vite-ignore */ modulePath)) as {
        seedLargeUpgrade: () => Promise<string>
      }
      return harness.seedLargeUpgrade()
    })
  } finally {
    await seedPage.close()
  }
}

async function readDiagnostics(page: Page) {
  return page.evaluate(() => {
    const diagnosticWindow = window as Window & {
      __CVC_ENGINE_DIAGNOSTIC__?: EngineDiagnosticEvent[]
    }
    return diagnosticWindow.__CVC_ENGINE_DIAGNOSTIC__ ?? []
  })
}

test("cold upgrade, close/reopen, and IDB reset preserve engine lifecycle", async ({
  page,
}) => {
  await openBlankPage(page)
  const filename = await seedLargeUpgradeFromSeparatePage(page)

  const measured = await page.evaluate(async (dbFilename) => {
    const diagnosticWindow = window as Window & {
      __CVC_ENGINE_DIAGNOSTIC__?: EngineDiagnosticEvent[]
    }
    const priorEvents = diagnosticWindow.__CVC_ENGINE_DIAGNOSTIC__ ?? []
    const priorEventCount = priorEvents.length
    const firstStartedAt = performance.now()
    const modulePath = "/src/test/d1MigrationHarness.ts"
    const harness = (await import(/* @vite-ignore */ modulePath)) as {
      measureLargeUpgrade: (
        filename: string,
        firstStartedAt?: number,
      ) => Promise<{
        durationMs: number
        reopenMs: number
        expectedRows: number
        expectedInjectedStudentRows: number
        injectedStudentRows: number
        reopenInjectedStudentRows: number
        expectedInjectedEvaluationRows: number
        injectedEvaluationRows: number
        reopenInjectedEvaluationRows: number
        rows: number
        reopenRows: number
        rowIssues: unknown[]
        reopenRowIssues: unknown[]
        reopenedIdentical: boolean
      }>
    }
    const result = await harness.measureLargeUpgrade(dbFilename, firstStartedAt)
    return { priorEventCount, result }
  }, filename)

  const diagnosticReady = await page
    .waitForFunction(
      () => {
        const diagnosticWindow = window as Window & {
          __CVC_ENGINE_DIAGNOSTIC__?: EngineDiagnosticEvent[]
        }
        return (
          (diagnosticWindow.__CVC_ENGINE_DIAGNOSTIC__?.filter(
            ({ type }) => type === "instance-created",
          ).length ?? 0) >= 2
        )
      },
      undefined,
      { timeout: 5_000 },
    )
    .then(async (handle) => {
      await handle.dispose()
      return true
    })
    .catch(() => false)
  const events = await readDiagnostics(page)

  test.info().annotations.push({
    type: "startup-measurement",
    description: JSON.stringify({
      ...measured.result,
      diagnosticReady,
      events,
    }),
  })

  const lifecycle = await page.evaluate(async (dbFilename) => {
    const modulePath = "/src/test/d1MigrationHarness.ts"
    const harness = (await import(/* @vite-ignore */ modulePath)) as {
      verifyLargeUpgradeLifecycle: (filename: string) => Promise<{
        markerObservedAfterIndependentWrite: boolean
        reopenedRows: number
        reopenedRowIssues: unknown[]
        oldRowsAfterReset: number
        resetMarkerObserved: boolean
        resetRows: number
        indexedDbDeleteUnblocked: boolean
      }>
    }
    return harness.verifyLargeUpgradeLifecycle(dbFilename)
  }, filename)
  test.info().annotations.push({
    type: "startup-lifecycle",
    description: JSON.stringify(lifecycle),
  })

  expect(measured.priorEventCount).toBe(0)
  expect(diagnosticReady).toBe(true)
  expect(coldEvidenceIssue(events)).toBeNull()
  expect(measured.result.rowIssues).toEqual([])
  expect(measured.result.reopenRowIssues).toEqual([])
  expect(measured.result.reopenedIdentical).toBe(true)
  expect(measured.result.expectedRows).toBe(609)
  expect(measured.result.rows).toBe(609)
  expect(measured.result.reopenRows).toBe(609)
  expect(measured.result.expectedInjectedStudentRows).toBe(40)
  expect(measured.result.injectedStudentRows).toBe(40)
  expect(measured.result.reopenInjectedStudentRows).toBe(40)
  expect(measured.result.expectedInjectedEvaluationRows).toBe(520)
  expect(measured.result.injectedEvaluationRows).toBe(520)
  expect(measured.result.reopenInjectedEvaluationRows).toBe(520)
  expect(measured.result.durationMs).toBeLessThan(5000)
  expect(measured.result.reopenMs).toBeLessThan(5000)
  expect(lifecycle.markerObservedAfterIndependentWrite).toBe(true)
  expect(lifecycle.reopenedRows).toBe(609)
  expect(lifecycle.reopenedRowIssues).toEqual([])
  expect(lifecycle.oldRowsAfterReset).toBe(0)
  expect(lifecycle.resetMarkerObserved).toBe(true)
  expect(lifecycle.resetRows).toBe(0)
  expect(lifecycle.indexedDbDeleteUnblocked).toBe(true)
})

test("a real same-page prewarm cannot be reported as a cold pass", async ({
  page,
}) => {
  await openBlankPage(page)
  const filename = await seedLargeUpgradeFromSeparatePage(page)
  const prewarm = await page.evaluate(async () => {
    const modulePath = "/src/persistence/schema.ts"
    const schema = (await import(/* @vite-ignore */ modulePath)) as {
      createDatabase: (filename: string) => {
        init: () => Promise<void>
        close: () => Promise<void>
      }
    }
    const prewarmFilename = `d3-prewarm-${crypto.randomUUID()}.db`
    const database = schema.createDatabase(prewarmFilename)
    await database.init()
    await database.close()
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(prewarmFilename)
      request.onsuccess = () => resolve()
      request.onerror = () =>
        reject(request.error ?? new Error("Could not delete prewarm database"))
      request.onblocked = () =>
        reject(new Error("Prewarm database remained open after close"))
    })

    const diagnosticWindow = window as Window & {
      __CVC_ENGINE_DIAGNOSTIC__?: EngineDiagnosticEvent[]
    }
    const events = diagnosticWindow.__CVC_ENGINE_DIAGNOSTIC__ ?? []
    const prewarmEvents = [...events]
    events.length = 0
    return prewarmEvents
  })
  test.info().annotations.push({
    type: "startup-prewarm",
    description: JSON.stringify(prewarm),
  })

  const measured = await page.evaluate(async (dbFilename) => {
    const modulePath = "/src/test/d1MigrationHarness.ts"
    const harness = (await import(/* @vite-ignore */ modulePath)) as {
      measureLargeUpgrade: (filename: string) => Promise<{
        expectedRows: number
        rows: number
        reopenRows: number
        rowIssues: unknown[]
        reopenRowIssues: unknown[]
        reopenedIdentical: boolean
      }>
    }
    const result = await harness.measureLargeUpgrade(dbFilename)
    const diagnosticWindow = window as Window & {
      __CVC_ENGINE_DIAGNOSTIC__?: EngineDiagnosticEvent[]
    }
    return {
      result,
      events: diagnosticWindow.__CVC_ENGINE_DIAGNOSTIC__ ?? [],
    }
  }, filename)
  test.info().annotations.push({
    type: "startup-warm-control",
    description: JSON.stringify(measured),
  })
  const lifecycle = await page.evaluate(async (dbFilename) => {
    const modulePath = "/src/test/d1MigrationHarness.ts"
    const harness = (await import(/* @vite-ignore */ modulePath)) as {
      verifyLargeUpgradeLifecycle: (filename: string) => Promise<{
        markerObservedAfterIndependentWrite: boolean
        oldRowsAfterReset: number
        resetMarkerObserved: boolean
        resetRows: number
        indexedDbDeleteUnblocked: boolean
      }>
    }
    return harness.verifyLargeUpgradeLifecycle(dbFilename)
  }, filename)
  test.info().annotations.push({
    type: "startup-warm-lifecycle",
    description: JSON.stringify(lifecycle),
  })

  expect(prewarm.length).toBeGreaterThan(0)
  expect(prewarm.some(({ type }) => type === "instance-created")).toBe(true)
  expect(measured.events[0]?.type).toBe("cache-hit")
  expect(coldEvidenceIssue(measured.events)).toMatch(/cold module-cache miss/)
  expect(measured.result.expectedRows).toBe(609)
  expect(measured.result.rows).toBe(609)
  expect(measured.result.reopenRows).toBe(609)
  expect(measured.result.rowIssues).toEqual([])
  expect(measured.result.reopenRowIssues).toEqual([])
  expect(measured.result.reopenedIdentical).toBe(true)
  expect(lifecycle.markerObservedAfterIndependentWrite).toBe(true)
  expect(lifecycle.oldRowsAfterReset).toBe(0)
  expect(lifecycle.resetMarkerObserved).toBe(true)
  expect(lifecycle.resetRows).toBe(0)
  expect(lifecycle.indexedDbDeleteUnblocked).toBe(true)
})
