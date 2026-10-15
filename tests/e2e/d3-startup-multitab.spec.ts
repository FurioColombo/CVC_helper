import { expect, type BrowserContext, type Page, test } from "@playwright/test"

type SharedWorkerRecord = {
  url: string
  name: string | null
}

type BrowserProbeState = Window & {
  __D3_SHARED_WORKERS__?: SharedWorkerRecord[]
  __D3_DATABASES__?: Array<{ close: () => Promise<void> }>
}

const isAppRoot = (target: URL) => target.pathname === "/"

async function installSharedWorkerRecorder(context: BrowserContext) {
  await context.addInitScript(() => {
    const probeWindow = window as BrowserProbeState
    const records: SharedWorkerRecord[] = []
    probeWindow.__D3_SHARED_WORKERS__ = records
    const NativeSharedWorker = window.SharedWorker
    if (typeof NativeSharedWorker !== "function") return

    class RecordingSharedWorker extends NativeSharedWorker {
      constructor(scriptURL: string | URL, options?: string | WorkerOptions) {
        super(scriptURL, options)
        records.push({
          url: new URL(String(scriptURL), window.location.href).href,
          name: typeof options === "string" ? options : (options?.name ?? null),
        })
      }
    }

    Object.defineProperty(window, "SharedWorker", {
      configurable: true,
      value: RecordingSharedWorker,
    })
  })
}

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

async function seedLegacyCourse(page: Page) {
  await openBlankPage(page)
  return page.evaluate(async () => {
    const runtimePath = "/src/runtimeConfig.ts"
    const harnessPath = "/src/test/d1MigrationHarness.ts"
    const runtime = (await import(/* @vite-ignore */ runtimePath)) as {
      appChannelConfig: { databaseFilename: string }
    }
    const harness = (await import(/* @vite-ignore */ harnessPath)) as {
      seed: (version: "0.3.0", filename: string) => Promise<void>
    }
    await harness.seed("0.3.0", runtime.appChannelConfig.databaseFilename)
    return runtime.appChannelConfig.databaseFilename
  })
}

async function openRawDatabase(page: Page, filename: string) {
  await openBlankPage(page)
  await page.evaluate(async (dbFilename) => {
    const schemaPath = "/src/persistence/schema.ts"
    const schema = (await import(/* @vite-ignore */ schemaPath)) as {
      createDatabase: (filename: string) => {
        init: () => Promise<void>
        close: () => Promise<void>
      }
    }
    const probeWindow = window as BrowserProbeState
    const database = schema.createDatabase(dbFilename)
    ;(probeWindow.__D3_DATABASES__ ??= []).push(database)
    await database.init()
  }, filename)
}

async function openActualOlderApp(page: Page) {
  await openBlankPage(page)
  return page.evaluate(async () => {
    const databasePath = "/src/persistence/db.ts"
    const migrationsPath = "/src/persistence/migrations.ts"
    const databaseModule = (await import(/* @vite-ignore */ databasePath)) as {
      db: {
        init: () => Promise<void>
        close: () => Promise<void>
        execute: (sql: string, parameters: unknown[]) => Promise<unknown>
        get: <Row>(sql: string, parameters: unknown[]) => Promise<Row>
        getAll: <Row>(sql: string, parameters: unknown[]) => Promise<Row[]>
      }
    }
    const migrations = (await import(/* @vite-ignore */ migrationsPath)) as {
      prepareDatabase: (database: unknown) => Promise<string>
    }
    const probeWindow = window as BrowserProbeState
    ;(probeWindow.__D3_DATABASES__ ??= []).push(databaseModule.db)
    const access = await migrations.prepareDatabase(databaseModule.db)
    return { access }
  })
}

async function closePageDatabases(page: Page) {
  return page.evaluate(async () => {
    const probeWindow = window as BrowserProbeState
    const databases = [...(probeWindow.__D3_DATABASES__ ?? [])].reverse()
    const outcomes: string[] = []
    for (const database of databases) {
      try {
        await database.close()
        outcomes.push("closed")
      } catch (error) {
        outcomes.push(
          "rejected:" + (error instanceof Error ? error.name : String(error)),
        )
      }
    }
    probeWindow.__D3_DATABASES__ = []
    return outcomes
  })
}

async function readSharedWorkerRecords(page: Page) {
  return page.evaluate(
    () => (window as BrowserProbeState).__D3_SHARED_WORKERS__ ?? [],
  )
}

async function deleteIndexedDb(page: Page, filename: string) {
  return page.evaluate(
    (dbFilename) =>
      new Promise<string>((resolve) => {
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
      }),
    filename,
  )
}

test("stock desktop SharedWorker survives one tab closing and preserves cross-tab write guards", async ({
  context,
}) => {
  await installSharedWorkerRecorder(context)
  const seedPage = await context.newPage()
  const filename = await seedLegacyCourse(seedPage)
  await seedPage.close()

  const firstPage = await context.newPage()
  await openRawDatabase(firstPage, filename)
  const olderPage = await context.newPage()
  const oldOpen = await openActualOlderApp(olderPage)
  expect(oldOpen.access).toBe("write")

  const firstRecords = await readSharedWorkerRecords(firstPage)
  const olderRecords = await readSharedWorkerRecords(olderPage)
  for (const records of [firstRecords, olderRecords]) {
    expect(
      records.some(
        ({ name, url }) =>
          name === "shared-powersync-" + filename &&
          url.includes("powersync") &&
          url.includes("worker.js"),
      ),
    ).toBe(true)
  }

  const initialDiagnostics = await olderPage.evaluate(() => {
    const diagnosticWindow = window as Window & {
      __CVC_ENGINE_DIAGNOSTIC__?: unknown[]
    }
    return diagnosticWindow.__CVC_ENGINE_DIAGNOSTIC__ ?? []
  })
  expect(initialDiagnostics).toEqual([])

  const firstClose = await closePageDatabases(firstPage)
  expect(firstClose).toEqual(["closed"])
  await firstPage.close()

  const survivingTab = await olderPage.evaluate(async () => {
    const databasePath = "/src/persistence/db.ts"
    const databaseModule = (await import(/* @vite-ignore */ databasePath)) as {
      db: {
        execute: (sql: string, parameters: unknown[]) => Promise<unknown>
        get: <Row>(sql: string, parameters: unknown[]) => Promise<Row>
      }
    }
    await databaseModule.db.execute(
      "INSERT OR REPLACE INTO meta(id, value) VALUES (?, ?)",
      ["probe:d3-shared-worker-survived", 31],
    )
    const marker = await databaseModule.db.get<{ value: number }>(
      "SELECT value FROM meta WHERE id = ?",
      ["probe:d3-shared-worker-survived"],
    )
    return marker.value
  })
  expect(survivingTab).toBe(31)

  const newerPage = await context.newPage()
  await openBlankPage(newerPage)
  const raised = await newerPage.evaluate(async (dbFilename) => {
    const schemaPath = "/src/persistence/schema.ts"
    const guardPath = "/src/persistence/writeGuard.ts"
    const migrationsPath = "/src/persistence/migrations.ts"
    const versionPath = "/src/appVersion.ts"
    const compatibilityPath = "/src/domain/compatibility.ts"
    const schema = (await import(/* @vite-ignore */ schemaPath)) as {
      createDatabase: (filename: string) => {
        init: () => Promise<void>
        execute: (sql: string, parameters: unknown[]) => Promise<unknown>
        get: <Row>(sql: string, parameters: unknown[]) => Promise<Row>
        getAll: <Row>(sql: string, parameters: unknown[]) => Promise<Row[]>
        close: () => Promise<void>
      }
    }
    const guard = (await import(/* @vite-ignore */ guardPath)) as {
      guardWrites: <Database extends object>(
        database: Database,
        app: { major: number; minor: number; patch: number },
      ) => Database
    }
    const migrations = (await import(/* @vite-ignore */ migrationsPath)) as {
      prepareDatabase: (
        database: unknown,
        migrations: readonly unknown[],
        app: { major: number; minor: number; patch: number },
      ) => Promise<string>
    }
    const versionModule = (await import(/* @vite-ignore */ versionPath)) as {
      APP_VERSION: { major: number; minor: number; patch: number }
    }
    const compatibility = (await import(
      /* @vite-ignore */ compatibilityPath
    )) as {
      encodeVersion: (version: {
        major: number
        minor: number
        patch: number
      }) => number
    }
    const newerVersion = {
      major: versionModule.APP_VERSION.major,
      minor: versionModule.APP_VERSION.minor + 2,
      patch: 0,
    }
    const database = guard.guardWrites(
      schema.createDatabase(dbFilename),
      newerVersion,
    )
    ;((window as BrowserProbeState).__D3_DATABASES__ ??= []).push(database)
    const access = await migrations.prepareDatabase(database, [], newerVersion)
    const row = await database.get<{ id: string }>(
      "SELECT id FROM students ORDER BY id LIMIT 1",
      [],
    )
    await database.execute(
      "UPDATE students SET createdAt = NULL, updatedAt = NULL WHERE id = ?",
      [row.id],
    )
    const version = await database.getAll<{ id: string; value: number }>(
      "SELECT id, value FROM meta WHERE id IN (?, ?)",
      ["data:version", "data:minimumWriter"],
    )
    return {
      access,
      newerVersion,
      version,
      currentVersionEncoded: compatibility.encodeVersion(
        versionModule.APP_VERSION,
      ),
      minimumWriterEncoded:
        version.find((record) => record.id === "data:minimumWriter")?.value ??
        -1,
      repairNeededStudentId: row.id,
    }
  }, filename)
  expect(raised.access).toBe("write")
  expect(raised.version).toHaveLength(2)
  expect(raised.minimumWriterEncoded).toBeGreaterThan(
    raised.currentVersionEncoded,
  )

  expect(raised.repairNeededStudentId).toBeTruthy()

  const newerRecords = await readSharedWorkerRecords(newerPage)
  expect(
    newerRecords.some(
      ({ name, url }) =>
        name === "shared-powersync-" + filename &&
        url.includes("powersync") &&
        url.includes("worker.js"),
    ),
  ).toBe(true)
  await closePageDatabases(newerPage)
  await newerPage.close()

  const oldWrite = await olderPage.evaluate(async () => {
    const databasePath = "/src/persistence/db.ts"
    const databaseModule = (await import(/* @vite-ignore */ databasePath)) as {
      db: {
        execute: (sql: string, parameters: unknown[]) => Promise<unknown>
        get: <Row>(sql: string, parameters: unknown[]) => Promise<Row>
      }
    }
    try {
      await databaseModule.db.execute(
        "INSERT OR REPLACE INTO meta(id, value) VALUES (?, ?)",
        ["probe:d3-old-write-must-refuse", 97],
      )
      return { outcome: "wrote" }
    } catch (error) {
      return {
        outcome: "rejected",
        name: error instanceof Error ? error.name : String(error),
      }
    }
  })
  expect(oldWrite).toEqual({
    outcome: "rejected",
    name: "ReadOnlyDataError",
  })

  const repairPage = await context.newPage()
  await openBlankPage(repairPage)
  const oldRepair = await repairPage.evaluate(async () => {
    const databasePath = "/src/persistence/db.ts"
    const migrationsPath = "/src/persistence/migrations.ts"
    const databaseModule = (await import(/* @vite-ignore */ databasePath)) as {
      db: {
        close: () => Promise<void>
        get: <Row>(sql: string, parameters: unknown[]) => Promise<Row>
        execute: (sql: string, parameters: unknown[]) => Promise<unknown>
      }
    }
    const migrations = (await import(/* @vite-ignore */ migrationsPath)) as {
      prepareDatabase: (database: unknown) => Promise<string>
    }
    const probeWindow = window as BrowserProbeState
    ;(probeWindow.__D3_DATABASES__ ??= []).push(databaseModule.db)
    const access = await migrations.prepareDatabase(databaseModule.db)
    const pendingRepair = await databaseModule.db.get<{
      createdAt: string | null
      updatedAt: string | null
    }>(
      "SELECT createdAt, updatedAt FROM students WHERE createdAt IS NULL LIMIT 1",
      [],
    )
    let writeOutcome = "wrote"
    try {
      await databaseModule.db.execute(
        "INSERT OR REPLACE INTO meta(id, value) VALUES (?, ?)",
        ["probe:d3-old-page-write-must-refuse", 98],
      )
    } catch (error) {
      writeOutcome = error instanceof Error ? error.name : String(error)
    }
    return { access, pendingRepair, writeOutcome }
  })
  expect(oldRepair.access).toBe("read-only")
  expect(oldRepair.pendingRepair).toMatchObject({
    createdAt: null,
    updatedAt: null,
  })
  expect(oldRepair.writeOutcome).toBe("ReadOnlyDataError")
  const repairRecords = await readSharedWorkerRecords(repairPage)
  expect(
    repairRecords.some(
      ({ name, url }) =>
        name === "shared-powersync-" + filename &&
        url.includes("powersync") &&
        url.includes("worker.js"),
    ),
  ).toBe(true)

  const oldClose = await closePageDatabases(olderPage)
  const repairClose = await closePageDatabases(repairPage)
  expect(oldClose).toEqual(["closed"])
  expect(repairClose).toEqual(["closed"])
  await olderPage.close()
  await repairPage.close()

  const cleanupPage = await context.newPage()
  await openBlankPage(cleanupPage)
  expect(await deleteIndexedDb(cleanupPage, filename)).toBe("deleted")
  await cleanupPage.close()
})
