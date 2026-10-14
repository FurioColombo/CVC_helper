import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createServer } from "node:http"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { extname, relative, resolve, sep } from "node:path"
import { tmpdir } from "node:os"
import { chromium, expect as playwrightExpect, webkit } from "@playwright/test"
import { getAppChannelConfig } from "../src/appChannel.ts"

// Keep standalone checks aligned with playwright.config.ts.
const expect = playwrightExpect.configure({ timeout: 30_000 })
const root = resolve(import.meta.dirname, "..")
const packageJson = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
)
const basePaths = {
  regular: "/CVC_helper/",
  test: "/CVC_helper_test/",
}
const regularStoragePrefix = "cvc-helper."
const testStoragePrefix = "cvc-helper-test."
const regularOcrKey = `${getAppChannelConfig("regular").ocrLanguageCachePath}/ita.traineddata`
const testOcrKey = `${getAppChannelConfig("test").ocrLanguageCachePath}/ita.traineddata`
const ocrFixture = resolve(root, "tests/fixtures/ocr-sheet-clear.png")
const idbKeyvalSource = readFileSync(
  resolve(root, "node_modules/idb-keyval/dist/index.js"),
  "utf8",
)
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".gz": "application/gzip",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff2": "font/woff2",
}

function build(channel, basePath, outputDir) {
  const result = spawnSync(
    process.execPath,
    [
      resolve(root, "node_modules/vite/bin/vite.js"),
      "build",
      "--outDir",
      outputDir,
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        CVC_APP_CHANNEL: channel,
        CVC_BASE_PATH: basePath,
      },
    },
  )
  if (result.status !== 0) {
    throw new Error(
      `Vite failed for ${channel} (${result.status ?? result.signal}):\n${result.stdout}\n${result.stderr}`,
    )
  }
  process.stdout.write(result.stdout)
}

function readManifest(outputDir) {
  return JSON.parse(
    readFileSync(resolve(outputDir, "manifest.webmanifest"), "utf8"),
  )
}

function assertBuildIdentity(channel, outputDir) {
  const basePath = basePaths[channel]
  const manifest = readManifest(outputDir)
  const expectedName = channel === "test" ? "CVC Helper Test" : "CVC Helper"
  const html = readFileSync(resolve(outputDir, "index.html"), "utf8")
  const worker = readFileSync(resolve(outputDir, "sw.js"), "utf8")
  const applicationAssets = readdirRecursively(outputDir)
    .filter((path) => path.endsWith(".js"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n")

  assert.equal(manifest.name, expectedName)
  assert.equal(manifest.short_name, expectedName)
  assert.equal(manifest.start_url, basePath)
  assert.equal(manifest.scope, basePath)
  assert.equal(manifest.id, basePath)
  assert.ok(html.includes(`<title>${expectedName}</title>`))

  if (channel === "test") {
    assert.ok(applicationAssets.includes("cvc-helper-test.db"))
    assert.ok(worker.includes("cvc-helper-test"))
    assert.ok(worker.includes("cvc-helper-test-ocr-runtime"))
    assert.ok(worker.includes("cvc-helper-test-speech-runtime"))
    assert.ok(applicationAssets.includes("cvc-helper-test-transformers-cache"))
  } else {
    assert.ok(applicationAssets.includes("cvc-helper.db"))
    assert.ok(worker.includes("cvc-ocr-runtime"))
    assert.ok(worker.includes("cvc-speech-runtime"))
    assert.ok(!worker.includes("cvc-helper-test-ocr-runtime"))
    assert.ok(applicationAssets.includes("transformers-cache"))
    // Both channel configurations can remain in the bundle. Runtime selection,
    // not absence of unused literals, determines which cache the app uses.
  }
}

function readdirRecursively(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? readdirRecursively(path) : [path]
  })
}

function speechRuntimeAsset(outputDir) {
  const asset = readdirRecursively(outputDir).find((path) =>
    /[\\/]ort-wasm-[^\\/]+\.mjs$/.test(path),
  )
  assert.ok(
    asset,
    `Could not find a built ONNX speech runtime module in ${outputDir}`,
  )
  return relative(outputDir, asset).split(sep).join("/")
}

function startStaticServer(directories) {
  let unavailable = false
  const server = createServer((request, response) => {
    if (unavailable) {
      request.socket.destroy()
      return
    }
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname
    if (pathname === "/_isolation/idb-keyval.js") {
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": "text/javascript; charset=utf-8",
      })
      response.end(idbKeyvalSource)
      return
    }
    const channel = Object.keys(directories).find((candidate) =>
      pathname.startsWith(basePaths[candidate]),
    )
    if (!channel) {
      response.writeHead(404).end("Not found")
      return
    }

    const outputDir = directories[channel]
    const pathWithinApp = decodeURIComponent(
      pathname.slice(basePaths[channel].length),
    )
    let filePath = resolve(outputDir, pathWithinApp || "index.html")
    const relativePath = relative(outputDir, filePath)
    if (relativePath.startsWith(`..${sep}`) || relativePath === "..") {
      response.writeHead(403).end("Forbidden")
      return
    }
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = resolve(filePath, "index.html")
    }
    if (!existsSync(filePath)) {
      response.writeHead(404).end("Not found")
      return
    }

    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Type":
        contentTypes[extname(filePath)] ?? "application/octet-stream",
      "Service-Worker-Allowed": basePaths[channel],
    })
    response.end(readFileSync(filePath))
  })

  return new Promise((resolveServer, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("Could not read the isolation server address"))
        return
      }
      resolveServer({
        origin: `http://127.0.0.1:${address.port}`,
        setUnavailable(value) {
          unavailable = value
          // Drop open transports too; the service worker must satisfy the
          // reload from cache. This avoids Playwright WebKit's setOffline
          // service-worker emulation bug (microsoft/playwright#42775).
          if (value) server.closeAllConnections()
        },
        close: () =>
          new Promise((resolveClose, rejectClose) =>
            server.close((error) =>
              error ? rejectClose(error) : resolveClose(undefined),
            ),
          ),
      })
    })
  })
}

async function createCourse(
  page,
  family,
  level,
  code,
  startupStartedAt,
  pageErrors,
  pageCrashes,
) {
  const creationHeading = page.getByRole("heading", {
    name: "Crea il corso",
  })
  const failureHeading = page.getByRole("heading", {
    name: "Non riesco ad aprire i dati locali",
  })
  const loadingSurface = await page
    .getByRole("status")
    .innerText()
    .catch(() => null)
  const appReady = await Promise.any([
    creationHeading
      .waitFor({ state: "visible", timeout: 30_000 })
      .then(() => "ready"),
    failureHeading
      .waitFor({ state: "visible", timeout: 30_000 })
      .then(() => "error"),
  ]).catch(async (error) => {
    const surface = await page
      .locator("main")
      .innerText()
      .catch((surfaceError) => String(surfaceError))
    throw new Error(
      `App readiness did not resolve within the configured 30s browser assertion timeout: ${JSON.stringify(
        {
          elapsedMs: Math.round(performance.now() - startupStartedAt),
          visibleStatusAtReadinessWait: loadingSurface,
          currentSurface: surface,
          pageClosed: page.isClosed(),
          pageErrors,
          pageCrashes,
        },
      )}`,
      { cause: error },
    )
  })
  assert.equal(appReady, "ready", `App displayed its local-data error screen`)
  const startup = {
    elapsedMs: Math.round(performance.now() - startupStartedAt),
    visibleStatusAtReadinessWait: loadingSurface,
  }
  await page.getByRole("button", { name: family, exact: true }).click()
  await page.getByRole("button", { name: `Livello ${level}` }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: new RegExp(`^${code} - `) }),
  ).toBeVisible()
  return startup
}

async function readLocalStorage(page) {
  return page.evaluate(() =>
    Object.fromEntries(
      Array.from(
        { length: globalThis.window.localStorage.length },
        (_, index) => {
          const key = globalThis.window.localStorage.key(index)
          return [key, globalThis.window.localStorage.getItem(key)]
        },
      ),
    ),
  )
}

function storageWithPrefix(storage, prefix) {
  return Object.fromEntries(
    Object.entries(storage).filter(([key]) => key.startsWith(prefix)),
  )
}

async function waitForAppWorker(page, basePath) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForFunction(
    (expectedScope) =>
      navigator.serviceWorker.controller?.scriptURL.includes(expectedScope),
    basePath,
  )
}

async function verifyOfflineAvailability(
  page,
  browser,
  staticServer,
  basePath,
  browserName,
  expectedHeading,
) {
  const preflight = await page.evaluate(async () => {
    const registration =
      await globalThis.navigator.serviceWorker.getRegistration()
    return {
      url: globalThis.location.href,
      controller:
        globalThis.navigator.serviceWorker.controller?.scriptURL ?? null,
      activeWorkerState: registration?.active?.state ?? null,
      documentReadyState: globalThis.document.readyState,
      cacheNames: await globalThis.caches.keys(),
    }
  })
  assert.ok(
    preflight.controller?.includes(`${basePath}sw.js`),
    `No ${basePath} service worker controlled the page before offline reload: ${JSON.stringify(preflight)}`,
  )
  assert.ok(
    preflight.cacheNames.some((name) =>
      name.startsWith("workbox-precache-v2-"),
    ),
    `The regular Workbox precache was missing before offline reload: ${JSON.stringify(preflight)}`,
  )
  staticServer.setUnavailable(true)
  let blockedContext
  const cachedDocumentResponses = []
  const onResponse = (response) => {
    if (
      response.url() === new URL("index.html", preflight.url).href &&
      !response.request().isNavigationRequest()
    ) {
      cachedDocumentResponses.push(response)
    }
  }
  page.on("response", onResponse)
  try {
    const indexUrl = new URL("index.html", preflight.url).href
    const cachedDocument = await page.evaluate(async (url) => {
      try {
        const response = await globalThis.fetch(url)
        return { ok: response.ok, status: response.status }
      } catch (error) {
        return { error: String(error) }
      }
    }, indexUrl)
    assert.deepEqual(cachedDocument, { ok: true, status: 200 })
    assert.equal(
      cachedDocumentResponses.at(-1)?.fromServiceWorker(),
      true,
      "The cached regular document response did not come from its service worker",
    )

    const uncachedRequestFailed = await page.evaluate(async (path) => {
      try {
        await globalThis.fetch(
          new URL(
            `${path}not-cached-${globalThis.crypto.randomUUID()}`,
            globalThis.location.origin,
          ),
          { cache: "no-store" },
        )
        return false
      } catch {
        return true
      }
    }, basePath)
    assert.equal(
      uncachedRequestFailed,
      true,
      "An uncached request succeeded while the origin transport was unavailable",
    )

    const reloadResponse = await page.reload({
      waitUntil: "domcontentloaded",
    })
    assert.equal(
      reloadResponse?.fromServiceWorker(),
      true,
      "The regular-app reload was not served by its service worker",
    )
    await expect(expectedHeading).toBeVisible()

    blockedContext = await browser.newContext({ serviceWorkers: "block" })
    const blockedPage = await blockedContext.newPage()
    let serviceWorkerBlockedNavigationError = null
    try {
      await blockedPage.goto(preflight.url, {
        waitUntil: "domcontentloaded",
      })
    } catch (error) {
      serviceWorkerBlockedNavigationError = String(error)
    }
    assert.ok(
      serviceWorkerBlockedNavigationError,
      "A fresh context without service workers unexpectedly opened the site while its origin was unavailable",
    )

    const result = {
      method: "origin-unreachable/server-transport",
      preflight,
      cachedResponseFromServiceWorker: true,
      reloadResponseFromServiceWorker: true,
      uncachedRequestFailed: true,
      freshContextWithoutServiceWorkersFailed: true,
      freshContextFailure: serviceWorkerBlockedNavigationError,
    }
    console.log(
      `Offline availability in ${browserName}: ${JSON.stringify(result)}`,
    )
    return result
  } finally {
    page.off("response", onResponse)
    staticServer.setUnavailable(false)
    await blockedContext?.close()
  }
}

async function verifyRuntimeCacheRequest(page, assetUrl, cacheName) {
  const response = await page.evaluate(async (url) => {
    const result = await fetch(url)
    return { ok: result.ok, status: result.status }
  }, assetUrl)
  assert.deepEqual(response, { ok: true, status: 200 })
  await expect
    .poll(() => page.evaluate(() => globalThis.caches.keys()))
    .toContain(cacheName)
}

async function readOcrLanguageCache(page, adapterUrl, key) {
  return page.evaluate(
    async ({ moduleUrl, cacheKey }) => {
      const { get } = await import(moduleUrl)
      const data = await get(cacheKey)
      if (data === undefined) return null
      const bytes =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : ArrayBuffer.isView(data)
            ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
            : null
      if (!bytes) throw new Error(`Unsupported OCR cache value for ${cacheKey}`)
      const digest = await crypto.subtle.digest("SHA-256", bytes)
      return {
        byteLength: bytes.byteLength,
        sha256: Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join(""),
      }
    },
    { moduleUrl: adapterUrl, cacheKey: key },
  )
}

async function exerciseTestOcrKey(page, adapterUrl) {
  return page.evaluate(
    async ({ moduleUrl, regularKey, testKey }) => {
      const { get, set, del } = await import(moduleUrl)
      const summarize = async (data) => {
        if (data === undefined) return null
        const bytes =
          data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : ArrayBuffer.isView(data)
              ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
              : null
        if (!bytes) throw new Error("Unsupported OCR cache value")
        const digest = await crypto.subtle.digest("SHA-256", bytes)
        return {
          byteLength: bytes.byteLength,
          sha256: Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join(""),
        }
      }
      const regularBefore = await summarize(await get(regularKey))
      const testBefore = await summarize(await get(testKey))
      await set(testKey, new Uint8Array([19, 29, 31, 41]))
      const testWritten = Array.from(await get(testKey))
      await del(testKey)
      const testAfterDelete = await get(testKey)
      const regularAfter = await summarize(await get(regularKey))
      return {
        regularBefore,
        testBefore,
        testWritten,
        testKeyDeleted: testAfterDelete === undefined,
        regularAfter,
      }
    },
    { moduleUrl: adapterUrl, regularKey: regularOcrKey, testKey: testOcrKey },
  )
}

async function scanRosterWithoutSaving(page) {
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await page.getByRole("button", { name: "Scan allievi", exact: true }).click()
  await page
    .getByLabel("Scegli foto dell’elenco allievi dalla galleria", {
      exact: true,
    })
    .setInputFiles(ocrFixture)
  await page
    .getByRole("button", { name: "Usa questa area", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Controlla prima di salvare" }),
  ).toBeVisible({ timeout: 90_000 })
  await expect(page.getByLabel(/^Nome riga/)).toHaveCount(3)
  await expect(page.getByLabel(/^Nome riga/).nth(0)).toHaveValue("Mario")
  await expect(page.getByLabel(/^Cognome riga/).nth(2)).toHaveValue(
    "De Angelis",
  )
  await page.getByRole("button", { name: "Indietro da Scan allievi" }).click()
  await page.getByRole("button", { name: "Scarta", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Allievi" })).toBeVisible()
  await returnToHomeFromStudent(page)
}

async function setCrewColumns(page, columns) {
  await page.getByRole("button", { name: "Impostazioni" }).click()
  const radio = page.getByRole("radio", { name: `${columns} per riga` })
  if (await radio.isChecked()) {
    const otherColumns = columns === 2 ? 3 : 2
    await page.getByRole("radio", { name: `${otherColumns} per riga` }).check()
  }
  await radio.check()
  await expect(radio).toBeChecked()
  await page.getByRole("button", { name: "Torna alla Home" }).click()
}

async function createAndUpdateStudent(
  page,
  {
    firstName,
    initialSurname,
    updatedSurname,
    initialNote,
    updatedNote,
    afterCreate,
    afterUpdate,
  },
) {
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Allievi" })).toBeVisible()
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill(firstName)
  await page.getByLabel("Cognome", { exact: true }).fill(initialSurname)
  await page
    .getByLabel("Età compiuta il primo giorno del corso", { exact: true })
    .fill("16")
  await page.getByRole("radio", { name: "Altro" }).check()
  await page.getByLabel("Nota del corso", { exact: true }).fill(initialNote)
  await page.getByRole("button", { name: "Salva allievo" }).click()
  await afterCreate?.()

  const student = page.getByRole("button", {
    name: new RegExp(`${firstName}, 16`),
  })
  await expect(student).toBeVisible()
  await student.click()
  await page.getByRole("button", { name: "Modifica allievo" }).click()
  await page.getByLabel("Cognome", { exact: true }).fill(updatedSurname)
  await page.getByLabel("Nota del corso", { exact: true }).fill(updatedNote)
  await page.getByRole("button", { name: "Fine" }).click()
  await afterUpdate?.()
  await expect(
    profileFullName(page, `${firstName} ${updatedSurname}`),
  ).toBeVisible()
  await expect(page.getByText(updatedNote, { exact: true })).toBeVisible()
}

async function assertRegularStorageUnchanged(page, expected, operation) {
  assert.deepEqual(
    storageWithPrefix(await readLocalStorage(page), regularStoragePrefix),
    expected,
    `Test ${operation} changed a regular-app preference`,
  )
}

function profileFullName(page, name) {
  return page
    .getByTitle("Doppio clic o pressione prolungata per modificare: Nome", {
      exact: true,
    })
    .getByText(name, { exact: true })
}

async function verifyStudentProfile(
  page,
  { firstName, updatedSurname, updatedNote },
) {
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await page
    .getByRole("button", { name: new RegExp(`${firstName}, 16`) })
    .click()
  await expect(
    profileFullName(page, `${firstName} ${updatedSurname}`),
  ).toBeVisible()
  await expect(page.getByText(updatedNote, { exact: true })).toBeVisible()
}

async function returnToHomeFromStudent(page) {
  const profileBack = page.getByRole("button", { name: "Indietro da Profilo" })
  const studentsBack = page.getByRole("button", { name: "Indietro da Allievi" })
  const isProfileVisible = await profileBack.isVisible().catch(() => false)
  if (isProfileVisible) {
    await profileBack.click()
    await expect(studentsBack).toBeVisible()
  }
  if (await studentsBack.isVisible().catch(() => false))
    await studentsBack.click()
}

async function eraseTestCourse(page) {
  await returnToHomeFromStudent(page)
  await page.getByRole("button", { name: "Impostazioni" }).click()
  await page
    .getByRole("button", {
      name: "Elimina il corso e inizia un nuovo corso",
    })
    .click()
  await page
    .getByRole("checkbox", {
      name: "Ho capito: i dati non si possono recuperare",
    })
    .check()
  await page.getByRole("button", { name: "Elimina tutto" }).click()
  await expect(
    page.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible()
}

async function verifyBrowserIsolation(
  origin,
  browserType,
  browserName,
  runtimeAssets,
  staticServer,
) {
  const browser = await browserType.launch()
  const context = await browser.newContext({ serviceWorkers: "allow" })
  const page = await context.newPage()
  let testPage
  page.setDefaultTimeout(90_000)
  const pageErrors = []
  const pageCrashes = []
  page.on("pageerror", (error) => pageErrors.push(error.message))
  page.on("crash", () => pageCrashes.push("page crashed"))

  try {
    await page.goto(`${origin}${basePaths.regular}`, {
      waitUntil: "domcontentloaded",
    })
    assert.equal(await page.title(), "CVC Helper")
    await waitForAppWorker(page, basePaths.regular)
    const offlineBaseline = await verifyOfflineAvailability(
      page,
      browser,
      staticServer,
      basePaths.regular,
      browserName,
      page.getByRole("heading", { name: "Crea il corso" }),
    )
    await createCourse(
      page,
      "Deriva",
      2,
      "D2",
      performance.now(),
      pageErrors,
      pageCrashes,
    )
    await setCrewColumns(page, 3)
    await scanRosterWithoutSaving(page)
    const regularOcrBytes = await readOcrLanguageCache(
      page,
      `${origin}/_isolation/idb-keyval.js`,
      regularOcrKey,
    )
    assert.ok(regularOcrBytes, "Regular OCR did not write its language cache")
    const regularStudent = {
      firstName: "Regolare",
      initialSurname: "Iniziale",
      updatedSurname: "Stabile",
      initialNote: "Nota regolare iniziale",
      updatedNote: "Nota regolare invariata",
    }
    await createAndUpdateStudent(page, regularStudent)
    await returnToHomeFromStudent(page)
    const regularStorageSnapshot = await readLocalStorage(page)
    const regularStorageBefore = storageWithPrefix(
      regularStorageSnapshot,
      regularStoragePrefix,
    )
    assert.equal(regularStorageBefore["cvc-helper.crew-display-columns"], "3")
    assert.ok(regularStorageBefore["cvc-helper.installed-version"])

    await verifyRuntimeCacheRequest(
      page,
      `${origin}${basePaths.regular}ocr/worker.min.js?isolation-proof=regular`,
      "cvc-ocr-runtime",
    )
    await verifyRuntimeCacheRequest(
      page,
      `${origin}${basePaths.regular}${runtimeAssets.regularSpeech}`,
      "cvc-speech-runtime",
    )

    const regularCacheNamesBefore = await page.evaluate(() =>
      globalThis.caches.keys(),
    )

    testPage = await context.newPage()
    testPage.setDefaultTimeout(90_000)
    testPage.on("pageerror", (error) =>
      pageErrors.push(`test app: ${error.message}`),
    )
    testPage.on("crash", () => pageCrashes.push("test app page crashed"))
    const testStartupStartedAt = performance.now()
    await testPage.goto(`${origin}${basePaths.test}`, {
      waitUntil: "domcontentloaded",
    })
    assert.equal(await testPage.title(), "CVC Helper Test")
    await waitForAppWorker(testPage, basePaths.test)
    await verifyRuntimeCacheRequest(
      testPage,
      `${origin}${basePaths.test}ocr/worker.min.js?isolation-proof=test`,
      "cvc-helper-test-ocr-runtime",
    )
    await verifyRuntimeCacheRequest(
      testPage,
      `${origin}${basePaths.test}${runtimeAssets.testSpeech}`,
      "cvc-helper-test-speech-runtime",
    )
    const testAppStartup = await createCourse(
      testPage,
      "Cabinato",
      4,
      "C4",
      testStartupStartedAt,
      pageErrors,
      pageCrashes,
    )
    assert.equal(page.url(), `${origin}${basePaths.regular}`)
    await assertRegularStorageUnchanged(
      testPage,
      regularStorageBefore,
      "course creation",
    )
    const regularOcrBytesFromTest = await readOcrLanguageCache(
      testPage,
      `${origin}/_isolation/idb-keyval.js`,
      regularOcrKey,
    )
    assert.deepEqual(
      regularOcrBytesFromTest,
      regularOcrBytes,
      "The test app could not read the unchanged regular OCR language cache",
    )
    assert.equal(
      await readOcrLanguageCache(
        testPage,
        `${origin}/_isolation/idb-keyval.js`,
        testOcrKey,
      ),
      null,
      "The test OCR cache existed before the test OCR worker initialized",
    )
    await scanRosterWithoutSaving(testPage)
    assert.equal(page.url(), `${origin}${basePaths.regular}`)
    await assertRegularStorageUnchanged(
      testPage,
      regularStorageBefore,
      "OCR initialization",
    )
    const testOcrBytes = await readOcrLanguageCache(
      testPage,
      `${origin}/_isolation/idb-keyval.js`,
      testOcrKey,
    )
    assert.ok(testOcrBytes, "Test OCR did not write its language cache key")
    assert.deepEqual(
      await readOcrLanguageCache(
        testPage,
        `${origin}/_isolation/idb-keyval.js`,
        regularOcrKey,
      ),
      regularOcrBytes,
      "Test OCR changed the regular language cache bytes",
    )
    const ocrDeleteProbe = await exerciseTestOcrKey(
      testPage,
      `${origin}/_isolation/idb-keyval.js`,
    )
    assert.deepEqual(ocrDeleteProbe.regularBefore, regularOcrBytes)
    assert.deepEqual(ocrDeleteProbe.testBefore, testOcrBytes)
    assert.deepEqual(ocrDeleteProbe.testWritten, [19, 29, 31, 41])
    assert.equal(ocrDeleteProbe.testKeyDeleted, true)
    assert.deepEqual(ocrDeleteProbe.regularAfter, regularOcrBytes)
    await setCrewColumns(testPage, 2)
    await assertRegularStorageUnchanged(
      testPage,
      regularStorageBefore,
      "preference update",
    )
    const testStudent = {
      firstName: "Prova",
      initialSurname: "Iniziale",
      updatedSurname: "Aggiornato",
      initialNote: "Nota test iniziale",
      updatedNote: "Nota test aggiornata",
      afterCreate: () =>
        assertRegularStorageUnchanged(
          testPage,
          regularStorageBefore,
          "student creation",
        ),
      afterUpdate: () =>
        assertRegularStorageUnchanged(
          testPage,
          regularStorageBefore,
          "student update",
        ),
    }
    await createAndUpdateStudent(testPage, testStudent)
    assert.equal(page.url(), `${origin}${basePaths.regular}`)

    const testStorageSnapshot = await readLocalStorage(testPage)
    const testStorage = storageWithPrefix(
      testStorageSnapshot,
      testStoragePrefix,
    )
    assert.equal(testStorage["cvc-helper-test.crew-display-columns"], "2")
    assert.ok(testStorage["cvc-helper-test.installed-version"])
    assert.deepEqual(
      storageWithPrefix(testStorageSnapshot, regularStoragePrefix),
      regularStorageBefore,
    )

    await page.reload({ waitUntil: "domcontentloaded" })
    assert.equal(await page.title(), "CVC Helper")
    await page
      .getByRole("navigation", { name: "Navigazione principale" })
      .getByRole("button", { name: "Home", exact: true })
      .click()
    await expect(page.getByRole("heading", { name: /^D2 - / })).toBeVisible()
    await expect(page.getByRole("heading", { name: /^C4 - / })).toHaveCount(0)
    await page.getByRole("button", { name: "Impostazioni" }).click()
    await expect(page.getByRole("radio", { name: "3 per riga" })).toBeChecked()
    assert.deepEqual(
      storageWithPrefix(await readLocalStorage(page), regularStoragePrefix),
      regularStorageBefore,
      "Test revisit changed a regular-app preference",
    )
    await page.getByRole("button", { name: "Torna alla Home" }).click()
    await verifyStudentProfile(page, regularStudent)
    await returnToHomeFromStudent(page)

    await returnToHomeFromStudent(testPage)
    await expect(
      testPage.getByRole("heading", { name: /^C4 - / }),
    ).toBeVisible()
    await verifyStudentProfile(testPage, testStudent)
    await eraseTestCourse(testPage)
    assert.equal(page.url(), `${origin}${basePaths.regular}`)
    const testStorageAfterErase = await readLocalStorage(testPage)
    assert.equal(
      testStorageAfterErase["cvc-helper-test.crew-display-columns"],
      "2",
      `Test preference disappeared after erasure: ${JSON.stringify(testStorageAfterErase)}`,
    )
    assert.ok(testStorageAfterErase["cvc-helper-test.installed-version"])
    assert.deepEqual(
      storageWithPrefix(testStorageAfterErase, regularStoragePrefix),
      regularStorageBefore,
    )
    assert.deepEqual(
      storageWithPrefix(testStorageAfterErase, testStoragePrefix),
      testStorage,
      "Erasing the test course changed its persistent test preferences",
    )

    await page.reload({ waitUntil: "domcontentloaded" })
    assert.equal(await page.title(), "CVC Helper")
    await page
      .getByRole("navigation", { name: "Navigazione principale" })
      .getByRole("button", { name: "Home", exact: true })
      .click()
    await expect(page.getByRole("heading", { name: /^D2 - / })).toBeVisible()
    await page.getByRole("button", { name: "Impostazioni" }).click()
    await expect(page.getByRole("radio", { name: "3 per riga" })).toBeChecked()
    assert.deepEqual(
      storageWithPrefix(await readLocalStorage(page), regularStoragePrefix),
      regularStorageBefore,
      "Test erasure changed a regular-app preference",
    )
    await page.getByRole("button", { name: "Torna alla Home" }).click()
    await verifyStudentProfile(page, regularStudent)
    await page
      .getByRole("navigation", { name: "Navigazione principale" })
      .getByRole("button", { name: "Home", exact: true })
      .click()
    await expect(page.getByRole("heading", { name: /^D2 - / })).toBeVisible()
    const offlineAfterTest = await verifyOfflineAvailability(
      page,
      browser,
      staticServer,
      basePaths.regular,
      browserName,
      page.getByRole("heading", { name: /^D2 - / }),
    )
    assert.equal(await page.title(), "CVC Helper")
    await page.getByRole("button", { name: "Impostazioni" }).click()
    await expect(page.getByRole("radio", { name: "3 per riga" })).toBeChecked()
    await page.getByRole("button", { name: "Torna alla Home" }).click()
    await verifyStudentProfile(page, regularStudent)
    await assertRegularStorageUnchanged(
      page,
      regularStorageBefore,
      "offline reopen after test erasure",
    )

    assert.equal(testPage.url(), `${origin}${basePaths.test}`)
    const regularCacheNamesAfterTest = await page.evaluate(() =>
      globalThis.caches.keys(),
    )

    const isolation = await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations()
      const cacheNames = await globalThis.caches.keys()
      return {
        scopes: registrations
          .map(({ scope }) => new URL(scope).pathname)
          .sort(),
        scripts: registrations
          .map(({ active }) => active?.scriptURL)
          .filter((url) => Boolean(url))
          .sort(),
        cacheNames: cacheNames.sort(),
      }
    })
    assert.deepEqual(isolation.scopes, ["/CVC_helper/", "/CVC_helper_test/"])
    assert.ok(
      isolation.scripts.some(
        (url) => new URL(url).pathname === "/CVC_helper/sw.js",
      ),
    )
    assert.ok(
      isolation.scripts.some(
        (url) => new URL(url).pathname === "/CVC_helper_test/sw.js",
      ),
    )
    assert.ok(
      isolation.cacheNames.some((name) =>
        name.startsWith("cvc-helper-test-precache-v2-"),
      ),
      `Test Workbox precache missing: ${isolation.cacheNames.join(", ")}`,
    )
    const testOwnedCacheNames = isolation.cacheNames.filter((name) =>
      name.startsWith("cvc-helper-test-"),
    )
    assert.ok(testOwnedCacheNames.length > 0)
    assert.ok(
      testOwnedCacheNames.every(
        (name) => !regularCacheNamesBefore.includes(name),
      ),
      "Test Workbox or runtime cache reused a regular-app cache name",
    )
    assert.ok(
      regularCacheNamesBefore.every((name) =>
        regularCacheNamesAfterTest.includes(name),
      ),
      "Test app removed a cache created by the regular app",
    )
    assert.equal(
      new Set(isolation.cacheNames).size,
      isolation.cacheNames.length,
    )
    assert.deepEqual(pageErrors, [])
    assert.deepEqual(pageCrashes, [])
    console.log(`PASS: same-origin storage isolation in ${browserName}`)
    return {
      engine: browserName,
      browserVersion: browser.version(),
      appStartup: {
        readinessHeading: "Crea il corso",
        test: testAppStartup,
        pageErrors,
        pageCrashes,
      },
      regularDatabase: {
        course: "D2",
        student: `${regularStudent.firstName} ${regularStudent.updatedSurname}`,
        courseNote: regularStudent.updatedNote,
        unchangedAfterTestCreationUpdateAndErasure: true,
      },
      ocrLanguageCache: {
        regularKey: regularOcrKey,
        testKey: testOcrKey,
        regularBytes: regularOcrBytes,
        testBytesCreatedByRealWorker: testOcrBytes,
        regularBytesUnchangedAfterTestReadWriteDelete:
          ocrDeleteProbe.regularAfter.sha256 === regularOcrBytes.sha256,
        testKeyDeletedByTestAdapter: ocrDeleteProbe.testKeyDeleted,
      },
      testDatabase: {
        course: "C4",
        student: `${testStudent.firstName} ${testStudent.updatedSurname}`,
        courseNote: testStudent.updatedNote,
        erasedThroughUi: true,
      },
      regularAppReopenedOffline: true,
      offlineAvailability: {
        beforeTestInstallation: offlineBaseline,
        afterTestErasure: offlineAfterTest,
      },
      preferences: {
        regularPrefix: regularStoragePrefix,
        testPrefix: testStoragePrefix,
        regularSnapshotUnchangedAfterEachTestOperation: true,
        regularCrewDisplayColumns:
          regularStorageBefore["cvc-helper.crew-display-columns"],
        testCrewDisplayColumns:
          testStorageAfterErase["cvc-helper-test.crew-display-columns"],
      },
      scopes: isolation.scopes,
      cacheNames: isolation.cacheNames,
      testOwnedCacheNames,
      regularCachesPresentBeforeTest: regularCacheNamesBefore,
      separateCacheNamespaces: true,
    }
  } finally {
    await testPage?.close()
    await context.close()
    await browser.close()
  }
}

const temporaryRoot = await mkdtemp(resolve(tmpdir(), "cvc-helper-isolation-"))
let server
const runs = []
try {
  const regularOutput = resolve(temporaryRoot, "regular")
  const testOutput = resolve(temporaryRoot, "test")
  build("regular", basePaths.regular, regularOutput)
  build("test", basePaths.test, testOutput)
  assertBuildIdentity("regular", regularOutput)
  assertBuildIdentity("test", testOutput)
  const runtimeAssets = {
    regularSpeech: speechRuntimeAsset(regularOutput),
    testSpeech: speechRuntimeAsset(testOutput),
  }
  server = await startStaticServer({ regular: regularOutput, test: testOutput })
  runs.push(
    await verifyBrowserIsolation(
      server.origin,
      chromium,
      "Chromium",
      runtimeAssets,
      server,
    ),
  )
  runs.push(
    await verifyBrowserIsolation(
      server.origin,
      webkit,
      "WebKit",
      runtimeAssets,
      server,
    ),
  )
  const report = {
    milestone: "D3",
    recordedAt: new Date().toISOString(),
    source:
      "scripts/check-test-app-isolation.mjs (npm run check:test-isolation)",
    origin: server.origin,
    basePaths,
    builds: {
      regular: { manifestName: "CVC Helper", database: "cvc-helper.db" },
      test: { manifestName: "CVC Helper Test", database: "cvc-helper-test.db" },
    },
    runs,
  }
  const reportPath =
    process.env.CVC_EVIDENCE_REFRESH === "D3"
      ? resolve(root, ".evidence/D3/test-isolation.json")
      : resolve(root, "test-results/test-isolation.json")
  mkdirSync(resolve(reportPath, ".."), { recursive: true })
  writeFileSync(resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`)
  console.log(
    `PASS: ${packageJson.name} regular and test builds stayed isolated on one origin at ${basePaths.regular} and ${basePaths.test}`,
  )
} finally {
  if (server) await server.close()
  const allowedTempRoot = resolve(tmpdir())
  const cleanupTarget = resolve(temporaryRoot)
  const cleanupRelative = relative(allowedTempRoot, cleanupTarget)
  assert.ok(
    cleanupRelative &&
      cleanupRelative !== ".." &&
      !cleanupRelative.startsWith(`..${sep}`),
    `Refusing to remove a path outside the temporary directory: ${cleanupTarget}`,
  )
  await rm(cleanupTarget, { recursive: true, force: true })
}
