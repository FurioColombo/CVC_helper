import { expect, type Page, test } from "@playwright/test"

type EngineEvent = {
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
}

type LargeUpgradeResult = {
  expectedRows: number
  expectedInjectedStudentRows: number
  expectedInjectedEvaluationRows: number
  rows: number
  reopenRows: number
  injectedStudentRows: number
  reopenInjectedStudentRows: number
  injectedEvaluationRows: number
  reopenInjectedEvaluationRows: number
  rowIssues: unknown[]
  reopenRowIssues: unknown[]
  reopenedIdentical: boolean
  engineEvents?: EngineEvent[]
}

type LifecycleResult = {
  markerObservedAfterIndependentWrite: boolean
  reopenedRows: number
  reopenedRowIssues: unknown[]
  oldRowsAfterReset: number
  resetMarkerObserved: boolean
  resetRows: number
  indexedDbDeleteUnblocked: boolean
}

type BrowserProbeState = Window & {
  __CVC_ENGINE_DIAGNOSTIC__?: EngineEvent[]
  __D3_INIT_OUTCOME__?: string
  __D3_CAPTURED_BROKER_PORTS__?: MessagePort[]
  __D3_READY_DATABASE__?: {
    init: () => Promise<void>
    execute: (sql: string, parameters: unknown[]) => Promise<unknown>
    get: <Row>(sql: string, parameters: unknown[]) => Promise<Row>
    close: () => Promise<void>
  }
}

const isAppRoot = (target: URL) => target.pathname === "/"
// Vite's ?import&url response is JavaScript needed to load the worker. Fault
// only the actual engine binary, after the broker has requested compilation.
const wasmRoute = (target: URL) =>
  target.pathname.endsWith("/wa-sqlite-async.wasm") &&
  !target.searchParams.has("import") &&
  !target.searchParams.has("url")

async function openBlankPage(page: Page, captureBrokerPort = false) {
  if (captureBrokerPort) {
    await page.addInitScript(() => {
      const probeWindow = window as BrowserProbeState
      const captured: MessagePort[] = []
      probeWindow.__D3_CAPTURED_BROKER_PORTS__ = captured
      const NativeMessageChannel = window.MessageChannel
      class CapturingMessageChannel extends NativeMessageChannel {
        constructor() {
          super()
          captured.push(this.port2)
        }
      }
      Object.defineProperty(window, "MessageChannel", {
        configurable: true,
        value: CapturingMessageChannel,
      })
    })
  }

  await page.route(isAppRoot, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body></body></html>",
    }),
  )
  await page.goto("/")
  await page.unroute(isAppRoot)
}

async function seedLargeUpgrade(page: Page) {
  await openBlankPage(page)
  return page.evaluate(async () => {
    const modulePath = "/src/test/d1MigrationHarness.ts"
    const harness = (await import(/* @vite-ignore */ modulePath)) as {
      seedLargeUpgrade: () => Promise<string>
    }
    return harness.seedLargeUpgrade()
  })
}

async function measureLargeUpgrade(page: Page, filename: string) {
  return page.evaluate(async (dbFilename) => {
    const modulePath = "/src/test/d1MigrationHarness.ts"
    const harness = (await import(/* @vite-ignore */ modulePath)) as {
      measureLargeUpgrade: (filename: string) => Promise<LargeUpgradeResult>
    }
    return harness.measureLargeUpgrade(dbFilename)
  }, filename)
}

async function verifyLargeUpgradeLifecycle(page: Page, filename: string) {
  return page.evaluate(async (dbFilename) => {
    const modulePath = "/src/test/d1MigrationHarness.ts"
    const harness = (await import(/* @vite-ignore */ modulePath)) as {
      verifyLargeUpgradeLifecycle: (
        filename: string,
      ) => Promise<LifecycleResult>
    }
    return harness.verifyLargeUpgradeLifecycle(dbFilename)
  }, filename)
}

async function beginUnawaitedOpen(page: Page, filename: string) {
  await page.evaluate(async (dbFilename) => {
    const modulePath = "/src/persistence/schema.ts"
    const schema = (await import(/* @vite-ignore */ modulePath)) as {
      createDatabase: (filename: string) => { init: () => Promise<void> }
    }
    const probeWindow = window as BrowserProbeState
    probeWindow.__D3_INIT_OUTCOME__ = "pending"
    const database = schema.createDatabase(dbFilename)
    void database.init().then(
      () => {
        probeWindow.__D3_INIT_OUTCOME__ = "resolved"
      },
      (error: unknown) => {
        probeWindow.__D3_INIT_OUTCOME__ =
          "rejected:" +
          (error instanceof Error
            ? error.name + ": " + error.message
            : String(error))
      },
    )
  }, filename)
}

async function readEngineEvents(page: Page) {
  return page.evaluate(() => {
    const probeWindow = window as BrowserProbeState
    return probeWindow.__CVC_ENGINE_DIAGNOSTIC__ ?? []
  })
}

function coldEvidenceIssue(events: EngineEvent[]) {
  if (events.some(({ type }) => type === "fallback" || type === "error")) {
    return "worker module transport fell back or errored"
  }
  const instances = events.filter(({ type }) => type === "instance-created")
  if (
    instances.some(
      ({ workerId, moduleKey, instanceId }) =>
        !workerId.trim() || !moduleKey.trim() || !instanceId?.trim(),
    )
  ) {
    return "engine instance identity telemetry was missing"
  }
  if (events[0]?.type !== "cache-miss") {
    return "first open did not start with a cold module-cache miss"
  }
  return null
}

async function waitForInitOutcome(page: Page, timeout = 35_000) {
  return page
    .waitForFunction(
      () => {
        const outcome = (window as BrowserProbeState).__D3_INIT_OUTCOME__
        return outcome && outcome !== "pending" ? outcome : false
      },
      undefined,
      { timeout },
    )
    .then(async (handle) => {
      const outcome = await handle.jsonValue()
      await handle.dispose()
      return String(outcome)
    })
    .catch(() => null)
}

async function finishBlockedRoute(
  release: (() => void) | undefined,
  pageClosed: boolean,
) {
  release?.()
  return pageClosed
}

async function verifyFreshOpenAfterFailure(page: Page, filename: string) {
  const context = page.context()
  await page.close()
  const recoveryPage = await context.newPage()
  await openBlankPage(recoveryPage)
  const marker = await recoveryPage.evaluate(async (dbFilename) => {
    const schemaPath = "/src/persistence/schema.ts"
    const schema = (await import(/* @vite-ignore */ schemaPath)) as {
      createDatabase: (filename: string) => {
        init: () => Promise<void>
        execute: (sql: string, parameters: unknown[]) => Promise<unknown>
        get: <Row>(sql: string, parameters: unknown[]) => Promise<Row>
        close: () => Promise<void>
      }
    }
    const database = schema.createDatabase(dbFilename)
    await database.init()
    await database.execute(
      "INSERT OR REPLACE INTO meta(id, value) VALUES (?, ?)",
      ["probe:d3-pending-failure-reopen", 67],
    )
    const row = await database.get<{ value: number }>(
      "SELECT value FROM meta WHERE id = ?",
      ["probe:d3-pending-failure-reopen"],
    )
    await database.close()
    const deleted = await new Promise<string>((resolve) => {
      const request = indexedDB.deleteDatabase(dbFilename)
      const timeout = setTimeout(() => resolve("timeout"), 5_000)
      request.onsuccess = () => {
        clearTimeout(timeout)
        resolve("deleted")
      }
      request.onerror = () => {
        clearTimeout(timeout)
        resolve("error")
      }
      request.onblocked = () => {
        clearTimeout(timeout)
        resolve("blocked")
      }
    })
    return { value: row.value, deleted }
  }, filename)
  await recoveryPage.close()
  return marker
}

function expectLargeUpgradeIntact(result: LargeUpgradeResult) {
  expect(result.expectedRows).toBe(609)
  expect(result.rows).toBe(609)
  expect(result.reopenRows).toBe(609)
  expect(result.expectedInjectedStudentRows).toBe(40)
  expect(result.injectedStudentRows).toBe(40)
  expect(result.reopenInjectedStudentRows).toBe(40)
  expect(result.expectedInjectedEvaluationRows).toBe(520)
  expect(result.injectedEvaluationRows).toBe(520)
  expect(result.reopenInjectedEvaluationRows).toBe(520)
  expect(result.rowIssues).toEqual([])
  expect(result.reopenRowIssues).toEqual([])
  expect(result.reopenedIdentical).toBe(true)
}

test("a fresh page recovers the 609-row course after its predecessor closes during a blocked WASM fetch", async ({
  page,
}) => {
  const seedPage = await page.context().newPage()
  const filename = await seedLargeUpgrade(seedPage)
  await seedPage.close()

  const blockedPage = await page.context().newPage()
  await openBlankPage(blockedPage)
  let releaseFetch: (() => void) | undefined
  let signalRequest: (() => void) | undefined
  const heldFetch = new Promise<void>((resolve) => {
    releaseFetch = resolve
  })
  const requestObserved = new Promise<void>((resolve) => {
    signalRequest = resolve
  })
  await blockedPage.route(wasmRoute, async (route) => {
    signalRequest?.()
    await heldFetch
    await route.abort().catch(() => undefined)
  })

  await beginUnawaitedOpen(blockedPage, filename)
  await requestObserved
  const blockedEvents = await readEngineEvents(blockedPage)
  test.info().annotations.push({
    type: "blocked-startup",
    description: JSON.stringify(blockedEvents),
  })
  expect(blockedEvents.some(({ type }) => type === "cache-miss")).toBe(true)
  expect(blockedEvents.some(({ type }) => type === "compile-start")).toBe(true)
  expect(blockedEvents.some(({ type }) => type === "compile-complete")).toBe(
    false,
  )

  const closePending = blockedPage.close()
  const closedWhileFetchWasHeld = await Promise.race([
    closePending.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ])
  await finishBlockedRoute(releaseFetch, closedWhileFetchWasHeld)
  await closePending
  expect(closedWhileFetchWasHeld).toBe(true)

  await openBlankPage(page)
  const recovered = await measureLargeUpgrade(page, filename)
  const lifecycle = await verifyLargeUpgradeLifecycle(page, filename)
  test.info().annotations.push({
    type: "startup-recovered-course",
    description: JSON.stringify({ recovered, lifecycle }),
  })

  expectLargeUpgradeIntact(recovered)
  expect(recovered.engineEvents?.some(({ type }) => type === "fallback")).toBe(
    false,
  )
  expect(lifecycle.markerObservedAfterIndependentWrite).toBe(true)
  expect(lifecycle.reopenedRows).toBe(609)
  expect(lifecycle.reopenedRowIssues).toEqual([])
  expect(lifecycle.oldRowsAfterReset).toBe(0)
  expect(lifecycle.resetMarkerObserved).toBe(true)
  expect(lifecycle.resetRows).toBe(0)
  expect(lifecycle.indexedDbDeleteUnblocked).toBe(true)
})

test("an abrupt page close during a held write transaction rolls back before a fresh page opens", async ({
  page,
}) => {
  const seedPage = await page.context().newPage()
  const filename = await seedLargeUpgrade(seedPage)
  await seedPage.close()

  const interruptedPage = await page.context().newPage()
  await openBlankPage(interruptedPage)
  await interruptedPage.evaluate(async (dbFilename) => {
    const modulePath = "/src/persistence/schema.ts"
    const schema = (await import(/* @vite-ignore */ modulePath)) as {
      createDatabase: (filename: string) => {
        init: () => Promise<void>
        writeTransaction: (
          callback: (transaction: {
            execute: (sql: string, parameters: unknown[]) => Promise<unknown>
          }) => Promise<void>,
        ) => Promise<void>
      }
    }
    const probeWindow = window as BrowserProbeState & {
      __D3_WRITE_HELD__?: boolean
      __D3_TRANSACTION_OUTCOME__?: string
    }
    const database = schema.createDatabase(dbFilename)
    await database.init()
    probeWindow.__D3_WRITE_HELD__ = false
    probeWindow.__D3_TRANSACTION_OUTCOME__ = "pending"
    void database
      .writeTransaction(async (transaction) => {
        await transaction.execute(
          "UPDATE students SET courseNote = ? WHERE id = ?",
          ["d3-uncommitted-probe", "student-load-0"],
        )
        probeWindow.__D3_WRITE_HELD__ = true
        await new Promise<void>(() => undefined)
      })
      .then(
        () => {
          probeWindow.__D3_TRANSACTION_OUTCOME__ = "committed"
        },
        (error: unknown) => {
          probeWindow.__D3_TRANSACTION_OUTCOME__ =
            "rejected:" + (error instanceof Error ? error.name : String(error))
        },
      )
  }, filename)

  await expect
    .poll(
      () =>
        interruptedPage.evaluate(
          () =>
            (window as BrowserProbeState & { __D3_WRITE_HELD__?: boolean })
              .__D3_WRITE_HELD__,
        ),
      { timeout: 15_000 },
    )
    .toBe(true)

  const closePending = interruptedPage.close()
  const closedWithTransactionHeld = await Promise.race([
    closePending.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ])
  await closePending
  expect(closedWithTransactionHeld).toBe(true)

  await openBlankPage(page)
  const recovered = await measureLargeUpgrade(page, filename)
  const uncommittedValue = await page.evaluate(async (dbFilename) => {
    const modulePath = "/src/persistence/schema.ts"
    const schema = (await import(/* @vite-ignore */ modulePath)) as {
      createDatabase: (filename: string) => {
        init: () => Promise<void>
        get: <Row>(sql: string, parameters: unknown[]) => Promise<Row>
        close: () => Promise<void>
      }
    }
    const database = schema.createDatabase(dbFilename)
    await database.init()
    const row = await database.get<{ courseNote: string | null }>(
      "SELECT courseNote FROM students WHERE id = ?",
      ["student-load-0"],
    )
    await database.close()
    return row.courseNote
  }, filename)
  const lifecycle = await verifyLargeUpgradeLifecycle(page, filename)
  test.info().annotations.push({
    type: "transaction-recovery",
    description: JSON.stringify({
      recovered,
      uncommittedValue,
      lifecycle,
    }),
  })

  expectLargeUpgradeIntact(recovered)
  expect(uncommittedValue).not.toBe("d3-uncommitted-probe")
  expect(lifecycle.markerObservedAfterIndependentWrite).toBe(true)
  expect(lifecycle.indexedDbDeleteUnblocked).toBe(true)
})

test("a compile failure settles once and a new explicit open succeeds after the route is released", async ({
  page,
}) => {
  await openBlankPage(page)
  const filename = "d3-compile-failure-" + crypto.randomUUID() + ".db"
  let wasmRequests = 0
  await page.route(wasmRoute, async (route) => {
    wasmRequests += 1
    if (wasmRequests === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/wasm",
        body: "not a wasm module",
      })
      return
    }
    await route.continue()
  })

  const firstAttempt = await page.evaluate(async (dbFilename) => {
    const schemaPath = "/src/persistence/schema.ts"
    const schema = (await import(/* @vite-ignore */ schemaPath)) as {
      createDatabase: (filename: string) => {
        init: () => Promise<void>
        close: () => Promise<void>
      }
    }
    const database = schema.createDatabase(dbFilename)
    let initOutcome: string
    try {
      await database.init()
      initOutcome = "resolved"
    } catch (error) {
      initOutcome =
        "rejected:" + (error instanceof Error ? error.name : String(error))
    }
    const closeOutcome = await Promise.race([
      database.close().then(
        () => "closed",
        () => "close-rejected",
      ),
      new Promise<string>((resolve) =>
        setTimeout(() => resolve("close-timeout"), 5_000),
      ),
    ])
    return { initOutcome, closeOutcome }
  }, filename)

  await page.waitForTimeout(250)
  const requestsBeforeExplicitOpen = wasmRequests
  const failedEvents = await readEngineEvents(page)
  test.info().annotations.push({
    type: "compile-failure",
    description: JSON.stringify({
      firstAttempt,
      requestsBeforeExplicitOpen,
      events: failedEvents,
    }),
  })
  expect(firstAttempt.initOutcome).toMatch(/^rejected:/)
  // The pinned SDK close() awaits its failed readiness promise and rejects.
  // The scope must release the worker independently of that SDK close result.
  expect(firstAttempt.closeOutcome).toBe("close-rejected")
  expect(requestsBeforeExplicitOpen).toBe(1)
  expect(failedEvents.some(({ type }) => type === "error")).toBe(true)
  expect(coldEvidenceIssue(failedEvents)).toBe(
    "worker module transport fell back or errored",
  )
  expect(failedEvents.some(({ type }) => type === "fallback")).toBe(false)

  // Only the first response is corrupt; keep counting to detect extra opens.
  const secondAttempt = await page.evaluate(async (dbFilename) => {
    const schemaPath = "/src/persistence/schema.ts"
    const schema = (await import(/* @vite-ignore */ schemaPath)) as {
      createDatabase: (filename: string) => {
        init: () => Promise<void>
        execute: (sql: string, parameters: unknown[]) => Promise<unknown>
        get: <Row>(sql: string, parameters: unknown[]) => Promise<Row>
        close: () => Promise<void>
      }
    }
    const database = schema.createDatabase(dbFilename)
    await database.init()
    await database.execute(
      "INSERT OR REPLACE INTO meta(id, value) VALUES (?, ?)",
      ["probe:d3-explicit-reopen", 41],
    )
    const marker = await database.get<{ value: number }>(
      "SELECT value FROM meta WHERE id = ?",
      ["probe:d3-explicit-reopen"],
    )
    await database.close()
    return marker.value
  }, filename)
  const eventsAfterExplicitOpen = await readEngineEvents(page)
  test.info().annotations.push({
    type: "compile-failure-recovery",
    description: JSON.stringify({
      secondAttempt,
      wasmRequests,
      events: eventsAfterExplicitOpen,
    }),
  })

  expect(secondAttempt).toBe(41)
  expect(wasmRequests).toBe(2)
  expect(
    eventsAfterExplicitOpen.filter(({ type }) => type === "cache-miss"),
  ).toHaveLength(2)
  expect(
    eventsAfterExplicitOpen.some(({ type }) => type === "compile-complete"),
  ).toBe(true)
})

test("structured-clone fallback is recorded and excluded from cold evidence", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalPostMessage = MessagePort.prototype.postMessage
    MessagePort.prototype.postMessage = function (
      this: MessagePort,
      message: unknown,
      transfer?: Transferable[] | StructuredSerializeOptions,
    ) {
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        (message as { type?: unknown }).type === "compiled-module"
      ) {
        throw new DOMException(
          "d3 diagnostic forced structured-clone rejection",
          "DataCloneError",
        )
      }
      return originalPostMessage.call(
        this,
        message,
        Array.isArray(transfer) ? { transfer } : transfer,
      )
    }
  })
  await openBlankPage(page)
  const filename = "d3-clone-fallback-" + crypto.randomUUID() + ".db"

  const result = await page.evaluate(async (dbFilename) => {
    const schemaPath = "/src/persistence/schema.ts"
    const schema = (await import(/* @vite-ignore */ schemaPath)) as {
      createDatabase: (filename: string) => {
        init: () => Promise<void>
        execute: (sql: string, parameters: unknown[]) => Promise<unknown>
        get: <Row>(sql: string, parameters: unknown[]) => Promise<Row>
        close: () => Promise<void>
      }
    }
    const database = schema.createDatabase(dbFilename)
    await database.init()
    await database.execute(
      "INSERT OR REPLACE INTO meta(id, value) VALUES (?, ?)",
      ["probe:d3-clone-fallback", 59],
    )
    const marker = await database.get<{ value: number }>(
      "SELECT value FROM meta WHERE id = ?",
      ["probe:d3-clone-fallback"],
    )
    await database.close()
    return marker.value
  }, filename)
  const events = await readEngineEvents(page)
  const issue = coldEvidenceIssue(events)
  test.info().annotations.push({
    type: "structured-clone-fallback",
    description: JSON.stringify({ result, events, coldEvidenceIssue: issue }),
  })

  expect(result).toBe(59)
  expect(events.some(({ type }) => type === "fallback")).toBe(true)
  expect(
    events.some(
      ({ type, workerId, moduleKey }) =>
        type === "fallback" && workerId.trim() && moduleKey.trim(),
    ),
  ).toBe(true)
  expect(issue).toBe("worker module transport fell back or errored")
})

test("a lost broker port settles a pending module request", async ({
  page,
}) => {
  await openBlankPage(page, true)
  const filename = "d3-broker-loss-" + crypto.randomUUID() + ".db"
  let releaseFetch: (() => void) | undefined
  let signalRequest: (() => void) | undefined
  const heldFetch = new Promise<void>((resolve) => {
    releaseFetch = resolve
  })
  const requestObserved = new Promise<void>((resolve) => {
    signalRequest = resolve
  })
  await page.route(wasmRoute, async (route) => {
    signalRequest?.()
    await heldFetch
    await route.abort().catch(() => undefined)
  })

  await beginUnawaitedOpen(page, filename)
  await requestObserved
  const pendingEvents = await readEngineEvents(page)
  expect(pendingEvents.map(({ type }) => type)).toEqual([
    "cache-miss",
    "compile-start",
  ])
  const portCount = await page.evaluate(
    () =>
      (window as BrowserProbeState).__D3_CAPTURED_BROKER_PORTS__?.length ?? 0,
  )
  expect(portCount).toBeGreaterThan(0)

  await page.evaluate(() => {
    const ports =
      (window as BrowserProbeState).__D3_CAPTURED_BROKER_PORTS__ ?? []
    ports[ports.length - 1]?.close()
  })
  releaseFetch?.()
  const outcome = await waitForInitOutcome(page)
  test.info().annotations.push({
    type: "broker-loss-outcome",
    description: JSON.stringify({ outcome }),
  })

  expect(outcome).toMatch(/^rejected:/)
  expect(await verifyFreshOpenAfterFailure(page, filename)).toEqual({
    value: 67,
    deleted: "deleted",
  })
})

test("a crashed worker settles its pending module request", async ({
  page,
}) => {
  await openBlankPage(page)
  const filename = "d3-worker-loss-" + crypto.randomUUID() + ".db"
  let releaseFetch: (() => void) | undefined
  let signalRequest: (() => void) | undefined
  const heldFetch = new Promise<void>((resolve) => {
    releaseFetch = resolve
  })
  const requestObserved = new Promise<void>((resolve) => {
    signalRequest = resolve
  })
  await page.route(wasmRoute, async (route) => {
    signalRequest?.()
    await heldFetch
    await route.abort().catch(() => undefined)
  })

  const workerObserved = page.waitForEvent("worker")
  await beginUnawaitedOpen(page, filename)
  await requestObserved
  const pendingEvents = await readEngineEvents(page)
  expect(pendingEvents.map(({ type }) => type)).toEqual([
    "cache-miss",
    "compile-start",
  ])
  const worker = await workerObserved
  expect(worker.url()).toContain("engineModuleWorker")

  await worker.evaluate(() => {
    setTimeout(() => {
      throw new Error("d3 diagnostic worker crash")
    }, 0)
  })
  releaseFetch?.()
  const outcome = await waitForInitOutcome(page)
  test.info().annotations.push({
    type: "worker-loss-outcome",
    description: JSON.stringify({ outcome, workerUrl: worker.url() }),
  })

  expect(outcome).toMatch(/^rejected:/)
  expect(await verifyFreshOpenAfterFailure(page, filename)).toEqual({
    value: 67,
    deleted: "deleted",
  })
})

test("a ready database stays writable after the startup failure deadline", async ({
  page,
}) => {
  await openBlankPage(page)
  const filename = "d3-ready-deadline-" + crypto.randomUUID() + ".db"
  await page.evaluate(async (dbFilename) => {
    const schemaPath = "/src/persistence/schema.ts"
    const schema = (await import(/* @vite-ignore */ schemaPath)) as {
      createDatabase: (
        filename: string,
      ) => NonNullable<BrowserProbeState["__D3_READY_DATABASE__"]>
    }
    const database = schema.createDatabase(dbFilename)
    await Promise.all([database.init(), database.init()])
    ;(window as BrowserProbeState).__D3_READY_DATABASE__ = database
  }, filename)

  // This intentionally crosses the real watchdog deadline after successful init.
  await page.waitForTimeout(31_000)
  const value = await page.evaluate(async () => {
    const database = (window as BrowserProbeState).__D3_READY_DATABASE__!
    await database.execute(
      "INSERT OR REPLACE INTO meta(id, value) VALUES (?, ?)",
      ["probe:d3-ready-after-deadline", 43],
    )
    const marker = await database.get<{ value: number }>(
      "SELECT value FROM meta WHERE id = ?",
      ["probe:d3-ready-after-deadline"],
    )
    await database.close()
    return marker.value
  })
  expect(value).toBe(43)
  expect(
    (await readEngineEvents(page)).filter(
      ({ type }) => type === "instance-created",
    ),
  ).toHaveLength(1)
  expect(await verifyFreshOpenAfterFailure(page, filename)).toEqual({
    value: 67,
    deleted: "deleted",
  })
})
