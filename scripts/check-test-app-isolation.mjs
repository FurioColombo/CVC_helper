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
import { chromium, expect, webkit } from "@playwright/test"

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
    assert.ok(!applicationAssets.includes("cvc-helper-test-transformers-cache"))
  }
}

function readdirRecursively(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? readdirRecursively(path) : [path]
  })
}

function startStaticServer(directories) {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname
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

async function createCourse(page, family, level, code) {
  await expect(
    page.getByRole("heading", { name: "Crea il corso" }),
  ).toBeVisible()
  await page.getByRole("button", { name: family, exact: true }).click()
  await page.getByRole("button", { name: `Livello ${level}` }).click()
  await page.getByRole("button", { name: "Crea corso", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: new RegExp(`^${code} - `) }),
  ).toBeVisible()
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
  await page.reload()
  await page.waitForFunction(
    (expectedScope) =>
      navigator.serviceWorker.controller?.scriptURL.includes(expectedScope),
    basePath,
  )
}

async function setCrewColumns(page, columns) {
  await page.getByRole("button", { name: "Impostazioni" }).click()
  const radio = page.getByRole("radio", { name: `${columns} per riga` })
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
  await page.getByLabel("Nome").fill(firstName)
  await page.getByLabel("Cognome").fill(initialSurname)
  await page.getByLabel("Età compiuta il primo giorno del corso").fill("16")
  await page.getByRole("radio", { name: "Altro" }).check()
  await page.getByLabel("Nota del corso").fill(initialNote)
  await page.getByRole("button", { name: "Salva allievo" }).click()
  await afterCreate?.()

  const student = page.getByRole("button", {
    name: new RegExp(`${firstName}, 16`),
  })
  await expect(student).toBeVisible()
  await student.click()
  await page.getByRole("button", { name: "Modifica allievo" }).click()
  await page.getByLabel("Cognome").fill(updatedSurname)
  await page.getByLabel("Nota del corso").fill(updatedNote)
  await page.getByRole("button", { name: "Fine" }).click()
  await afterUpdate?.()
  await expect(
    page.getByText(`${firstName} ${updatedSurname}`, { exact: true }),
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

async function verifyStudentProfile(
  page,
  { firstName, updatedSurname, updatedNote },
) {
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await page
    .getByRole("button", { name: new RegExp(`${firstName}, 16`) })
    .click()
  await expect(
    page.getByText(`${firstName} ${updatedSurname}`, { exact: true }),
  ).toBeVisible()
  await expect(page.getByText(updatedNote, { exact: true })).toBeVisible()
}

async function returnToHomeFromStudent(page) {
  const profileBack = page.getByRole("button", { name: "Indietro da Profilo" })
  if (await profileBack.isVisible().catch(() => false))
    await profileBack.click()
  const studentsBack = page.getByRole("button", { name: "Indietro da Allievi" })
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

async function verifyBrowserIsolation(origin, browserType, browserName) {
  const browser = await browserType.launch()
  const page = await browser.newPage()
  const pageErrors = []
  page.on("pageerror", (error) => pageErrors.push(error.message))

  try {
    await page.goto(`${origin}${basePaths.regular}`)
    assert.equal(await page.title(), "CVC Helper")
    await waitForAppWorker(page, basePaths.regular)
    await createCourse(page, "Deriva", 2, "D2")
    await setCrewColumns(page, 3)
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

    const regularCacheNamesBefore = await page.evaluate(() =>
      globalThis.caches.keys(),
    )

    await page.goto(`${origin}${basePaths.test}`)
    assert.equal(await page.title(), "CVC Helper Test")
    await waitForAppWorker(page, basePaths.test)
    await createCourse(page, "Cabinato", 4, "C4")
    await assertRegularStorageUnchanged(
      page,
      regularStorageBefore,
      "course creation",
    )
    await setCrewColumns(page, 2)
    await assertRegularStorageUnchanged(
      page,
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
          page,
          regularStorageBefore,
          "student creation",
        ),
      afterUpdate: () =>
        assertRegularStorageUnchanged(
          page,
          regularStorageBefore,
          "student update",
        ),
    }
    await createAndUpdateStudent(page, testStudent)

    const testStorageSnapshot = await readLocalStorage(page)
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

    await page.goto(`${origin}${basePaths.regular}`)
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

    await page.goto(`${origin}${basePaths.test}`)
    await expect(page.getByRole("heading", { name: /^C4 - / })).toBeVisible()
    await verifyStudentProfile(page, testStudent)
    await eraseTestCourse(page)
    const testStorageAfterErase = await readLocalStorage(page)
    assert.equal(
      testStorageAfterErase["cvc-helper-test.crew-display-columns"],
      "2",
    )
    assert.deepEqual(
      storageWithPrefix(testStorageAfterErase, regularStoragePrefix),
      regularStorageBefore,
    )

    await page.goto(`${origin}${basePaths.regular}`)
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
    assert.ok(
      regularCacheNamesBefore.every((name) =>
        regularCacheNamesAfterTest.includes(name),
      ),
      "Test app removed a cache created by the regular app",
    )
    const testCacheNames = isolation.cacheNames.filter(
      (name) =>
        name.startsWith("cvc-helper-test-") || name.includes("CVC_helper_test"),
    )
    const regularCacheNames = isolation.cacheNames.filter(
      (name) => !testCacheNames.includes(name),
    )
    assert.ok(testCacheNames.length > 0, "Test cache namespace was not created")
    assert.ok(
      testCacheNames.every((name) => !regularCacheNames.includes(name)),
      "Regular and test cache name sets overlap",
    )
    assert.equal(
      new Set(isolation.cacheNames).size,
      isolation.cacheNames.length,
    )
    assert.deepEqual(pageErrors, [])
    console.log(`PASS: same-origin storage isolation in ${browserName}`)
    return {
      engine: browserName,
      browserVersion: browser.version(),
      regularDatabase: {
        course: "D2",
        student: `${regularStudent.firstName} ${regularStudent.updatedSurname}`,
        courseNote: regularStudent.updatedNote,
        unchangedAfterTestCreationUpdateAndErasure: true,
      },
      testDatabase: {
        course: "C4",
        student: `${testStudent.firstName} ${testStudent.updatedSurname}`,
        courseNote: testStudent.updatedNote,
        erasedThroughUi: true,
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
      regularCachesPresentBeforeTest: regularCacheNamesBefore,
      separateCacheNamespaces: true,
    }
  } finally {
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
  server = await startStaticServer({ regular: regularOutput, test: testOutput })
  runs.push(await verifyBrowserIsolation(server.origin, chromium, "Chromium"))
  runs.push(await verifyBrowserIsolation(server.origin, webkit, "WebKit"))
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
