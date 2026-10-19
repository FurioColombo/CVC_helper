import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { expect, type Page, type TestInfo, test } from "@playwright/test"

import { APP_CHANNEL_CONFIG } from "../../src/appChannel"
import type {
  StudentEditInput,
  StudentInput,
  StudentRecord,
} from "../../src/persistence/students"
import { evidenceOutputPath } from "./evidence"

const channel = APP_CHANNEL_CONFIG.regular
const otherChannel = APP_CHANNEL_CONFIG.test

type BrowserEvents = { pageErrors: number; crashes: number }
type CacheFailureProbe = {
  deleteCalls: string[]
  interruptions: number
}

function observeBrowserEvents(page: Page, events: BrowserEvents) {
  page.on("pageerror", () => {
    events.pageErrors += 1
  })
  page.on("crash", () => {
    events.crashes += 1
  })
}

function record(testInfo: TestInfo, name: string, result: unknown) {
  const file = evidenceOutputPath(
    testInfo,
    "D4",
    "local-reset",
    `${name}-${testInfo.project.name}.json`,
  )
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`)
}

async function createCourse(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await expect(page.getByRole("button", { name: "Allievi" })).toBeVisible()
}

async function addSyntheticStudent(page: Page) {
  await page.getByRole("button", { name: "Allievi" }).click()
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill("Prova")
  await page.getByLabel("Cognome", { exact: true }).fill("Reset")
  await page.getByLabel("Età compiuta il primo giorno del corso").fill("16")
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText("M", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
  await expect(page.getByRole("heading", { name: "Allievi" })).toBeVisible()
}

async function showSettings(page: Page) {
  await page.getByRole("button", { name: "Home", exact: true }).click()
  await page.getByRole("button", { name: "Impostazioni" }).click()
  await expect(
    page.getByRole("button", { name: "Azzera tutti i dati locali" }),
  ).toBeVisible()
}

async function confirmFullReset(page: Page) {
  await page.getByRole("button", { name: "Azzera tutti i dati locali" }).click()
  await page
    .getByRole("checkbox", {
      name: "Ho capito: corso, preferenze e file offline saranno cancellati",
    })
    .check()
  await page.getByRole("button", { name: "Azzera i dati" }).click()
}

async function enlargeResetText(page: Page) {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
}

async function expectResetTextFits(page: Page) {
  const layout = await page.evaluate(() => {
    const title = document.querySelector("h1")!
    return {
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      titleWidth: title.clientWidth,
      titleContent: title.scrollWidth,
    }
  })
  expect(layout.viewport).toBe(320)
  expect(layout.page).toBeLessThanOrEqual(layout.viewport)
  expect(layout.titleContent).toBeLessThanOrEqual(layout.titleWidth + 1)
}

async function seedAppAndOtherChannelStorage(page: Page) {
  return page.evaluate(
    async ({ selected, other }) => {
      const selectedPreferences = [
        selected.crewDisplayColumnsKey,
        selected.installedVersionKey,
        `${selected.scanNameOrderPrefix}first`,
      ]
      const otherPreferences = [
        other.crewDisplayColumnsKey,
        other.installedVersionKey,
        `${other.scanNameOrderPrefix}first`,
      ]
      for (const key of selectedPreferences)
        localStorage.setItem(key, "synthetic")
      for (const key of otherPreferences)
        localStorage.setItem(key, "keep-other-channel")
      localStorage.setItem("d4-unrelated-preference", "keep")

      const scope = new URL("/", location.origin).href
      const selectedCaches = [
        selected.ocrRuntimeCacheName,
        selected.speechRuntimeCacheName,
        selected.speechModelCacheName,
        `${selected.workboxCacheId ?? "workbox"}-precache-v2-${scope}`,
      ]
      const otherCaches = [
        other.ocrRuntimeCacheName,
        other.speechRuntimeCacheName,
        other.speechModelCacheName,
        `${other.workboxCacheId ?? "workbox"}-precache-v2-${scope}`,
      ]
      const markerUrl = new URL("/d4-storage-marker", location.origin).href
      for (const name of [
        ...selectedCaches,
        ...otherCaches,
        "d4-unrelated-cache",
      ]) {
        const cache = await caches.open(name)
        await cache.put(markerUrl, new Response(`synthetic:${name}`))
      }

      const modelKey = `${selected.ocrLanguageCachePath}/ita.traineddata`
      const databaseName = "keyval-store"
      const openModelDatabase = () =>
        new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(databaseName)
          request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains("keyval")) {
              request.result.createObjectStore("keyval")
            }
          }
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
      const modelDatabase = await openModelDatabase()
      await new Promise<void>((resolve, reject) => {
        const transaction = modelDatabase.transaction("keyval", "readwrite")
        transaction.oncomplete = () => resolve()
        transaction.onabort = () => reject(transaction.error)
        transaction.objectStore("keyval").put("synthetic-model-bytes", modelKey)
      })
      modelDatabase.close()

      return {
        selectedCaches,
        otherCaches,
        selectedPreferences,
        otherPreferences,
        modelKey,
      }
    },
    { selected: channel, other: otherChannel },
  )
}

async function storageAfterReset(
  page: Page,
  seeded: Awaited<ReturnType<typeof seedAppAndOtherChannelStorage>>,
) {
  return page.evaluate(
    async ({ appDatabase, seeded }) => {
      // List database names instead of opening the app database, which would
      // itself recreate the storage being checked.
      const databases = await indexedDB.databases()
      const cacheNames = await caches.keys()
      const otherCacheMarkers = await Promise.all(
        seeded.otherCaches.map(async (name) => {
          const cache = await caches.open(name)
          return Boolean(
            await cache.match(
              new URL("/d4-storage-marker", location.origin).href,
            ),
          )
        }),
      )

      const modelDatabase = await new Promise<IDBDatabase>(
        (resolve, reject) => {
          const request = indexedDB.open("keyval-store")
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        },
      )
      const modelPresent = await new Promise<boolean>((resolve, reject) => {
        const transaction = modelDatabase.transaction("keyval", "readonly")
        const request = transaction.objectStore("keyval").get(seeded.modelKey)
        request.onsuccess = () => resolve(request.result !== undefined)
        request.onerror = () => reject(request.error)
      })
      modelDatabase.close()

      return {
        appDatabasePresent: databases.some(({ name }) => name === appDatabase),
        selectedCachesRemaining: seeded.selectedCaches.filter((name) =>
          cacheNames.includes(name),
        ),
        otherChannelCacheMarkersPreserved: otherCacheMarkers.every(Boolean),
        selectedPreferencesRemaining: seeded.selectedPreferences.filter(
          (key) => localStorage.getItem(key) !== null,
        ),
        otherChannelPreferencesPreserved: seeded.otherPreferences.every(
          (key) => localStorage.getItem(key) === "keep-other-channel",
        ),
        unrelatedPreferencePreserved:
          localStorage.getItem("d4-unrelated-preference") === "keep",
        ocrModelKeyPresent: modelPresent,
      }
    },
    { appDatabase: channel.databaseFilename, seeded },
  )
}

test("full reset closes the other tab, clears held-write storage and rejects its stale save", async ({
  page,
  context,
}, testInfo) => {
  const events: BrowserEvents = { pageErrors: 0, crashes: 0 }
  observeBrowserEvents(page, events)
  await createCourse(page)
  await addSyntheticStudent(page)
  await showSettings(page)

  const secondTab = await context.newPage()
  observeBrowserEvents(secondTab, events)
  await secondTab.goto("/")
  await expect(secondTab.getByRole("button", { name: "Allievi" })).toBeVisible()

  const seedResult = await seedAppAndOtherChannelStorage(secondTab)
  await secondTab.evaluate(async () => {
    const loadModule = (file: string) => import(/* @vite-ignore */ file)
    const [databaseModule, studentModule] = await Promise.all([
      loadModule("/src/persistence/db.ts"),
      loadModule("/src/persistence/students.ts"),
    ])
    const { db } = databaseModule as {
      db: {
        get<T>(sql: string, parameters?: unknown[]): Promise<T>
        writeTransaction: (...args: unknown[]) => Promise<unknown>
      }
    }
    const { createStudent, updateStudent } = studentModule as {
      createStudent: (
        courseId: string,
        input: StudentInput,
      ) => Promise<StudentRecord>
      updateStudent: (
        studentId: string,
        courseId: string,
        input: StudentEditInput,
      ) => Promise<void>
    }
    const course = await db.get<{ id: string }>(
      "SELECT id FROM courses WHERE active = 1 LIMIT 1",
    )
    const student = await db.get<StudentRecord>(
      "SELECT * FROM students WHERE courseId = ? LIMIT 1",
      [course.id],
    )

    let releaseWrite: (() => void) | undefined
    const releasePromise = new Promise<void>((resolve) => {
      releaseWrite = resolve
    })
    const state = {
      createStudent,
      updateStudent,
      courseId: course.id,
      student,
      writeExecuted: false,
      saveOutcome: null as null | { status: string; errorName?: string },
      releaseWrite: () => releaseWrite?.(),
    }
    Object.assign(window, { __D4_RESET_RACE__: state })

    const writableDatabase = db as unknown as {
      writeTransaction: (...args: unknown[]) => Promise<unknown>
    }
    const originalWriteTransaction = writableDatabase.writeTransaction.bind(db)
    let holdNextTransaction = true
    writableDatabase.writeTransaction = ((
      callback: unknown,
      ...args: unknown[]
    ) => {
      if (!holdNextTransaction)
        return originalWriteTransaction(callback, ...args)
      holdNextTransaction = false
      const heldCallback = async (transaction: unknown) => {
        const result = await (
          callback as (transaction: unknown) => Promise<unknown>
        )(transaction)
        state.writeExecuted = true
        await releasePromise
        return result
      }
      return originalWriteTransaction(heldCallback, ...args)
    }) as typeof writableDatabase.writeTransaction

    void updateStudent(student.id, course.id, {
      firstName: student.firstName,
      surname: student.surname,
      nickname: student.nickname,
      dateOfBirth: student.dateOfBirth,
      declaredAgeAtCourseStart: student.declaredAgeAtCourseStart,
      sex: student.sex,
      phone: student.phone,
      size: student.size,
      initialNote: student.initialNote,
      courseNote: "d4-synthetic-held-write",
    }).then(
      () => {
        state.saveOutcome = { status: "saved" }
      },
      (error: unknown) => {
        state.saveOutcome = {
          status: "rejected",
          errorName: error instanceof Error ? error.name : "unknown",
        }
      },
    )
  })
  await secondTab.waitForFunction(() => {
    const state = (
      window as Window & { __D4_RESET_RACE__?: { writeExecuted: boolean } }
    ).__D4_RESET_RACE__
    return state?.writeExecuted === true
  })

  await confirmFullReset(page)
  await expect(
    page.getByRole("heading", { name: "Dati locali cancellati" }),
  ).toBeVisible()
  await expect(
    secondTab.getByRole("heading", { name: "Dati locali cancellati" }),
  ).toBeVisible()
  const appDatabasePresentWhileWriteHeld = await page.evaluate(
    async (name) =>
      (await indexedDB.databases()).some((database) => database.name === name),
    channel.databaseFilename,
  )
  expect(appDatabasePresentWhileWriteHeld).toBe(false)

  await secondTab.evaluate(() => {
    const state = (
      window as Window & {
        __D4_RESET_RACE__?: { releaseWrite: () => void }
      }
    ).__D4_RESET_RACE__
    state?.releaseWrite()
  })
  await expect(
    page.getByRole("heading", { name: "Dati locali cancellati" }),
  ).toBeVisible()
  await expect(
    secondTab.getByRole("heading", { name: "Dati locali cancellati" }),
  ).toBeVisible()

  await page.waitForTimeout(250)
  const heldSaveOutcome = await secondTab.evaluate(() => {
    const state = (
      window as Window & {
        __D4_RESET_RACE__?: {
          saveOutcome: null | { status: string; errorName?: string }
        }
      }
    ).__D4_RESET_RACE__!
    return state.saveOutcome ?? { status: "pending" }
  })
  expect(["saved", "rejected", "pending"]).toContain(heldSaveOutcome.status)
  const appDatabasePresentAfterHeldCallback = await page.evaluate(
    async (name) =>
      (await indexedDB.databases()).some((database) => database.name === name),
    channel.databaseFilename,
  )
  expect(appDatabasePresentAfterHeldCallback).toBe(false)

  const staleSaveOutcome = await secondTab.evaluate(async () => {
    const state = (
      window as Window & {
        __D4_RESET_RACE__?: {
          createStudent: (courseId: string, input: unknown) => Promise<unknown>
          courseId: string
        }
      }
    ).__D4_RESET_RACE__!
    const input: StudentInput = {
      firstName: "Stale",
      surname: "After Reset",
      nickname: null,
      dateOfBirth: "2010-01-01",
      declaredAgeAtCourseStart: 16,
      sex: "male",
      phone: null,
      size: null,
      initialNote: null,
      courseNote: null,
    }
    return Promise.race([
      state.createStudent(state.courseId, input).then(
        () => ({ status: "resolved" as const }),
        (error: unknown) => ({
          status: "rejected" as const,
          errorName: error instanceof Error ? error.name : "unknown",
        }),
      ),
      new Promise<{ status: "pending" }>((resolve) =>
        setTimeout(() => resolve({ status: "pending" }), 3000),
      ),
    ])
  })
  expect(staleSaveOutcome.status).toBe("rejected")
  if (staleSaveOutcome.status === "rejected")
    expect(staleSaveOutcome.errorName).toBe("CourseReplacedError")

  const storage = await storageAfterReset(page, seedResult)
  expect(storage).toEqual({
    appDatabasePresent: false,
    selectedCachesRemaining: [],
    otherChannelCacheMarkersPreserved: true,
    selectedPreferencesRemaining: [],
    otherChannelPreferencesPreserved: true,
    unrelatedPreferencePreserved: true,
    ocrModelKeyPresent: false,
  })
  expect(events).toEqual({ pageErrors: 0, crashes: 0 })

  await page.screenshot({
    path: evidenceOutputPath(
      testInfo,
      "D4",
      "local-reset",
      "reset-complete.png",
    ),
    fullPage: true,
  })
  record(testInfo, "full-reset", {
    tabs: 2,
    writeHeldUntilResetStarted: true,
    databaseAbsentBeforeHeldCallbackReleased: !appDatabasePresentWhileWriteHeld,
    heldSaveOutcome,
    databaseStillAbsentAfterHeldCallback: !appDatabasePresentAfterHeldCallback,
    staleSaveOutcome,
    storage,
    events,
  })
})

test("keeps reset visibly blocked until a legacy database connection closes", async ({
  page,
  context,
}, testInfo) => {
  const events: BrowserEvents = { pageErrors: 0, crashes: 0 }
  observeBrowserEvents(page, events)
  await createCourse(page)
  await showSettings(page)

  const secondTab = await context.newPage()
  observeBrowserEvents(secondTab, events)
  await secondTab.goto("/")
  await expect(secondTab.getByRole("button", { name: "Allievi" })).toBeVisible()

  const legacyPage = await context.newPage()
  observeBrowserEvents(legacyPage, events)
  await legacyPage.goto("/icons/cvc-helper.svg")
  const connectionVersion = await legacyPage.evaluate(
    (databaseName) =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open(databaseName)
        request.onsuccess = () => {
          const database = request.result
          Object.assign(window, { __D4_LEGACY_CONNECTION__: database })
          resolve(database.version)
        }
        request.onerror = () => reject(request.error)
      }),
    channel.databaseFilename,
  )

  await enlargeResetText(page)
  await confirmFullReset(page)
  await expect(
    page.getByText(/Chiudi le altre schede o finestre/),
  ).toBeVisible()
  await expectResetTextFits(page)
  await expect(
    page.getByRole("heading", { name: "Dati locali cancellati" }),
  ).not.toBeVisible()
  await page.screenshot({
    path: evidenceOutputPath(
      testInfo,
      "D4",
      "local-reset",
      "reset-blocked.png",
    ),
    fullPage: true,
  })

  await legacyPage.evaluate(() => {
    const database = (
      window as Window & { __D4_LEGACY_CONNECTION__?: IDBDatabase }
    ).__D4_LEGACY_CONNECTION__
    database?.close()
  })
  await expect(
    page.getByRole("heading", { name: "Dati locali cancellati" }),
  ).toBeVisible()
  await expect(
    secondTab.getByRole("heading", { name: "Dati locali cancellati" }),
  ).toBeVisible()
  const appDatabasePresent = await page.evaluate(
    async (name) =>
      (await indexedDB.databases()).some((database) => database.name === name),
    channel.databaseFilename,
  )
  expect(connectionVersion).toBeGreaterThan(0)
  await expectResetTextFits(page)
  expect(appDatabasePresent).toBe(false)
  expect(events).toEqual({ pageErrors: 0, crashes: 0 })
  record(testInfo, "blocked-reset", {
    connectionVersion,
    blockedMessageVisible: true,
    completedAfterLegacyConnectionClosed: true,
    appDatabasePresent,
    events,
  })
})

// Owner phone check, 2026-10-19: a long reset was abandoned by closing the
// app, and every later open hung on "Apertura del corso…" until reinstalling.
test("resumes a reset interrupted by closing the app on the next open", async ({
  page,
  context,
}, testInfo) => {
  const events: BrowserEvents = { pageErrors: 0, crashes: 0 }
  observeBrowserEvents(page, events)
  await createCourse(page)
  await addSyntheticStudent(page)
  await showSettings(page)

  // Hold the deletion open, as a connection the phone could not release did.
  const holder = await context.newPage()
  observeBrowserEvents(holder, events)
  await holder.goto("/icons/cvc-helper.svg")
  await holder.evaluate(
    (databaseName) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(databaseName)
        request.onsuccess = () => {
          Object.assign(window, { __D4_HELD_CONNECTION__: request.result })
          resolve()
        }
        request.onerror = () => reject(request.error)
      }),
    channel.databaseFilename,
  )

  await confirmFullReset(page)
  await expect(
    page.getByText(/Chiudi le altre schede o finestre/),
  ).toBeVisible()
  const pendingBeforeClose = await page.evaluate(
    (key) => localStorage.getItem(key),
    channel.resetPendingKey,
  )
  await page.close()

  const reopened = await context.newPage()
  observeBrowserEvents(reopened, events)
  await reopened.goto("/")
  await expect(
    reopened.getByRole("heading", { name: "Cancellazione dei dati locali…" }),
  ).toBeVisible()
  await expect(reopened.getByText("Apertura del corso…")).not.toBeVisible()
  await expect(
    reopened.getByRole("heading", {
      name: "Non riesco ad aprire i dati locali",
    }),
  ).not.toBeVisible()
  // Whether or not the resumed deletion gets a "blocked" event (WebKit does,
  // Chromium queues it silently), the screen says what to close (DI-R6-Q1).
  await expect(
    reopened.getByText(
      /Ci vuole più del solito|Chiudi le altre schede o finestre/,
    ),
  ).toBeVisible({ timeout: 15_000 })

  await holder.evaluate(() => {
    ;(
      window as Window & { __D4_HELD_CONNECTION__?: IDBDatabase }
    ).__D4_HELD_CONNECTION__?.close()
  })
  await expect(
    reopened.getByRole("heading", { name: "Dati locali cancellati" }),
  ).toBeVisible({ timeout: 40_000 })
  const pendingAfterReset = await reopened.evaluate(
    (key) => localStorage.getItem(key),
    channel.resetPendingKey,
  )

  await reopened.getByRole("button", { name: "Riapri l’app" }).click()
  await expect(
    reopened.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible()
  const studentsAfterReopen = await reopened.evaluate(async (name) => {
    const databases = await indexedDB.databases()
    return databases.some((database) => database.name === name)
  }, channel.databaseFilename)

  expect(pendingBeforeClose).toBe("1")
  expect(pendingAfterReset).toBeNull()
  expect(events).toEqual({ pageErrors: 0, crashes: 0 })
  record(testInfo, "interrupted-reset", {
    pendingBeforeClose,
    resumedOnReopen: true,
    pendingAfterReset,
    reopenedWithoutCourse: true,
    databasePresentAfterReopen: studentsAfterReopen,
    events,
  })
})

// D4 review SC-R3-I1: on a phone the engine gives up after its 30 s startup
// deadline when the database stays held, and the SDK's close then never
// returns. A resumed reset must still reach the deletion once the hold ends.
test("finishes a resumed reset even when the engine cannot start in time", async ({
  page,
  context,
}, testInfo) => {
  // Only the phone's dedicated-worker engine has the startup deadline.
  test.skip(testInfo.project.name !== "pixel-7-chrome", "phone engine path")
  test.setTimeout(150_000)
  const events: BrowserEvents = { pageErrors: 0, crashes: 0 }
  observeBrowserEvents(page, events)
  await createCourse(page)
  await showSettings(page)

  const holder = await context.newPage()
  await holder.goto("/icons/cvc-helper.svg")
  await holder.evaluate(
    (databaseName) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(databaseName)
        request.onsuccess = () => {
          Object.assign(window, { __D4_HELD_CONNECTION__: request.result })
          resolve()
        }
        request.onerror = () => reject(request.error)
      }),
    channel.databaseFilename,
  )
  await confirmFullReset(page)
  await expect(
    page.getByText(/Chiudi le altre schede o finestre/),
  ).toBeVisible()
  await page.close()

  const reopened = await context.newPage()
  observeBrowserEvents(reopened, events)
  await reopened.goto("/")
  await expect(
    reopened.getByRole("heading", { name: "Cancellazione dei dati locali…" }),
  ).toBeVisible()
  // Hold past the engine's 30 s startup deadline, then let go.
  await reopened.waitForTimeout(36_000)
  await holder.evaluate(() => {
    ;(
      window as Window & { __D4_HELD_CONNECTION__?: IDBDatabase }
    ).__D4_HELD_CONNECTION__?.close()
  })
  await expect(
    reopened.getByRole("heading", { name: "Dati locali cancellati" }),
  ).toBeVisible({ timeout: 30_000 })
  const pendingAfterReset = await reopened.evaluate(
    (key) => localStorage.getItem(key),
    channel.resetPendingKey,
  )
  expect(pendingAfterReset).toBeNull()
  expect(events.crashes).toBe(0)
  record(testInfo, "resumed-reset-past-engine-deadline", {
    heldForMs: 36_000,
    completedAfterRelease: true,
    pendingAfterReset,
    events,
  })
})

test("reports partial cleanup honestly and retries through the reset screen", async ({
  page,
}, testInfo) => {
  const events: BrowserEvents = { pageErrors: 0, crashes: 0 }
  observeBrowserEvents(page, events)
  await createCourse(page)
  await showSettings(page)

  const failingCache = channel.ocrRuntimeCacheName
  // Keep a strong browser handle until both attempts finish. WebKit can lose
  // an own-method mock on an otherwise unretained CacheStorage wrapper.
  const cacheFailure = await page.evaluateHandle(async (name) => {
    const storage = caches
    const cache = await storage.open(name)
    await cache.put(
      new URL("/d4-retry-marker", location.origin).href,
      new Response("synthetic"),
    )
    const originalDelete = storage.delete.bind(storage)
    let failOnce = true
    const probe: CacheFailureProbe = { deleteCalls: [], interruptions: 0 }
    Object.defineProperty(storage, "delete", {
      configurable: true,
      value: async (cacheName: string) => {
        probe.deleteCalls.push(cacheName)
        if (cacheName === name && failOnce) {
          failOnce = false
          probe.interruptions += 1
          throw new Error("synthetic deletion interruption")
        }
        return originalDelete(cacheName)
      },
    })
    return { storage, probe }
  }, failingCache)

  try {
    await enlargeResetText(page)
    await confirmFullReset(page)
    await expect(
      page.getByRole("heading", { name: "Cancellazione non completata" }),
    ).toBeVisible()
    expect(
      await cacheFailure.evaluate(({ storage, probe }) => ({
        ...probe,
        sameStorage: storage === caches,
      })),
    ).toEqual({
      deleteCalls: [failingCache],
      interruptions: 1,
      sameStorage: true,
    })
    expect(await page.evaluate(async () => caches.keys())).toContain(
      failingCache,
    )
    await expect(
      page.getByText(/Alcuni dati potrebbero essere già stati eliminati/),
    ).toBeVisible()
    await expectResetTextFits(page)
    await expect(
      page.getByRole("button", { name: "Riprova la cancellazione" }),
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Dati locali cancellati" }),
    ).not.toBeVisible()
    await page.screenshot({
      path: evidenceOutputPath(
        testInfo,
        "D4",
        "local-reset",
        "reset-retry-needed.png",
      ),
      fullPage: true,
    })

    await page.getByRole("button", { name: "Riprova la cancellazione" }).click()
    await expect(
      page.getByRole("heading", { name: "Dati locali cancellati" }),
    ).toBeVisible()
    const remainingCacheNames = await page.evaluate(async () => caches.keys())
    await expectResetTextFits(page)
    const appDatabasePresent = await page.evaluate(
      async (name) =>
        (await indexedDB.databases()).some(
          (database) => database.name === name,
        ),
      channel.databaseFilename,
    )
    expect(remainingCacheNames).not.toContain(failingCache)
    expect(
      await cacheFailure.evaluate(({ storage, probe }) => ({
        ...probe,
        sameStorage: storage === caches,
      })),
    ).toEqual({
      deleteCalls: [failingCache, failingCache],
      interruptions: 1,
      sameStorage: true,
    })
    expect(appDatabasePresent).toBe(false)
    expect(events).toEqual({ pageErrors: 0, crashes: 0 })
    record(testInfo, "reset-retry", {
      failureWasReportedAsPartial: true,
      cacheRemainingAfterRetry: remainingCacheNames.includes(failingCache),
      appDatabasePresent,
      events,
    })
  } finally {
    const observation = await cacheFailure
      .evaluate(async ({ storage, probe }) => ({
        probe,
        sameStorage: storage === caches,
        hasOwnDelete: Object.hasOwn(storage, "delete"),
        remainingCaches: await storage.keys(),
      }))
      .catch(() => ({ unavailable: true }))
    await testInfo.attach("cache-failure-injection", {
      body: JSON.stringify(observation),
      contentType: "application/json",
    })
    await cacheFailure.dispose()
  }
})
