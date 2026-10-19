import type { Page } from "@playwright/test"

export type EngineDiagnosticEvent = {
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

export async function openBlankPage(page: Page) {
  await page.route(isAppRoot, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body></body></html>",
    }),
  )
  await page.goto("/")
  await page.unroute(isAppRoot)
}

export function coldEvidenceIssue(events: EngineDiagnosticEvent[]) {
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

/** The real legacy writer closes before the current app's measured page opens. */
export async function seedLargeUpgradeFromSeparatePage(page: Page) {
  const seedPage = await page.context().newPage()
  try {
    await openBlankPage(seedPage)
    return await seedPage.evaluate(async () => {
      const modulePath = "/src/test/d1MigrationHarness.ts"
      const harness = (await import(
        /* @vite-ignore */ modulePath
      )) as typeof import("../../../src/test/d1MigrationHarness")
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

/** Collect after both timed opens; this wait never extends the measured bound. */
export async function collectEngineDiagnostics(page: Page) {
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
  return { diagnosticReady, events }
}
