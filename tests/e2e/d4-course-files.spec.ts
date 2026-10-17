import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { expect, test, type Page } from "@playwright/test"
import type { CourseArchive } from "../../src/persistence/courseArchiveFormat"
import { evidenceOutputPath } from "./evidence"

async function upgradedCourse(page: Page) {
  const root = (url: URL) => url.pathname === "/"
  await page.route(root, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body>Fixture setup</body></html>",
    }),
  )
  await page.goto("/")
  await page.unroute(root)
  await page.evaluate(async () => {
    const modulePath = "/src/test/d1MigrationHarness.ts"
    const { seed } = await import(/* @vite-ignore */ modulePath)
    await seed("0.3.0", "cvc-helper.db")
  })
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "D2 - 38 | 2026" }),
  ).toBeVisible()
}

async function rows(page: Page) {
  return page.evaluate(async () => {
    const load = (file: string) => import(/* @vite-ignore */ file)
    const { db } = await load("/src/persistence/db.ts")
    const { COURSE_TABLES } = await load("/src/persistence/schema.ts")
    return db.readTransaction(
      async (tx: { getAll: (sql: string) => Promise<unknown[]> }) => {
        const tables: Record<string, unknown[]> = {}
        for (const table of COURSE_TABLES)
          tables[table] = await tx.getAll(`SELECT * FROM ${table} ORDER BY id`)
        return tables
      },
    ) as Promise<CourseArchive["tables"]>
  })
}

async function exportFile(page: Page) {
  await page.getByRole("button", { name: "Impostazioni", exact: true }).click()
  await expect(
    page.getByText(/Il file contiene i dati personali/),
  ).toBeVisible()
  await page.getByRole("button", { name: "Prepara il file del corso" }).click()
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Salva file", exact: true }).click()
  const downloaded = await download
  expect(downloaded.suggestedFilename()).toMatch(
    /^cvc-helper-corso-\d{4}-W\d{2}\.json$/,
  )
  return JSON.parse(
    readFileSync((await downloaded.path())!, "utf8"),
  ) as CourseArchive
}

async function chooseArchive(page: Page, archive: unknown) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "cvc-helper-corso.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      typeof archive === "string" ? archive : JSON.stringify(archive),
    ),
  })
}

async function confirmImport(page: Page, hasCourse: boolean) {
  await expect(
    page.getByRole("heading", { name: "Corso trovato" }),
  ).toBeVisible()
  const confirm = page.getByRole("button", {
    name: hasCourse ? "Sostituisci il corso" : "Importa il corso",
    exact: true,
  })
  await expect(confirm).toBeDisabled()
  await page
    .getByRole("checkbox", {
      name: hasCourse
        ? "Ho capito: il corso attuale sarà sostituito"
        : "Confermo di importare questo corso sul dispositivo",
    })
    .check()
  await confirm.click()
  await expect(
    page.getByRole("heading", { name: "Il corso è cambiato" }),
  ).toBeVisible()
}

test("exports the upgraded course and imports it through the fresh app, every row unchanged even after immediate close", async ({
  page,
  browser,
  baseURL,
}, info) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await upgradedCourse(page)
  const before = await rows(page)
  const archive = await exportFile(page)
  expect(archive.tables).toEqual(before)
  expect(Object.keys(archive.tables)).not.toContain("meta")
  // A fresh browser represents the recipient device. Retain this project's
  // device identity; a default context would silently use a desktop UA.
  const userAgent = await page.evaluate(() => navigator.userAgent)
  const destinationBrowser = await browser.browserType().launch()
  const fresh = await destinationBrowser.newContext({
    baseURL,
    viewport: page.viewportSize(),
    locale: "it-IT",
    userAgent,
    deviceScaleFactor: info.project.use.deviceScaleFactor,
    isMobile: info.project.use.isMobile,
    hasTouch: info.project.use.hasTouch,
  })
  try {
    const imported = await fresh.newPage()
    const openingEvents: unknown[] = []
    imported.on("crash", () => openingEvents.push({ type: "crash" }))
    imported.on("framenavigated", (frame) => {
      if (frame === imported.mainFrame())
        openingEvents.push({ type: "navigation", url: frame.url() })
    })
    imported.on("websocket", (socket) => {
      socket.on("framereceived", ({ payload }) => {
        if (typeof payload === "string" && /full-reload|update/.test(payload))
          openingEvents.push({ type: "dev-server-message", payload })
      })
    })
    imported.on("pageerror", (error) => errors.push(error.message))
    await imported.goto("/")
    expect(await imported.evaluate(() => navigator.userAgent)).toBe(userAgent)
    try {
      await expect(
        imported.getByRole("heading", { name: "Crea il corso" }),
      ).toBeVisible()
    } catch (error) {
      await info.attach("fresh-open-events.json", {
        contentType: "application/json",
        body: Buffer.from(JSON.stringify(openingEvents, null, 2)),
      })
      // Read-only failure context: distinguish compilation, adapter opening
      // and a pending database lock without changing readiness or its limit.
      for (const [name, diagnosticPage] of [
        ["source", page],
        ["recipient", imported],
      ] as const) {
        const diagnostic = await Promise.race([
          diagnosticPage.evaluate(async () => ({
            userAgent: navigator.userAgent,
            body: document.body.innerText,
            engine: Reflect.get(window, "__CVC_ENGINE_DIAGNOSTIC__"),
            locks: await navigator.locks.query(),
            resources: performance
              .getEntriesByType("resource")
              .filter((entry) => /wasm|engineModuleCompiler/.test(entry.name))
              .map((entry) => entry.toJSON()),
          })),
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ unavailable: "diagnostic timeout" }),
              2000,
            ),
          ),
        ]).catch(() => ({ unavailable: "page closed" }))
        await info.attach(`fresh-open-${name}.json`, {
          contentType: "application/json",
          body: Buffer.from(JSON.stringify(diagnostic, null, 2)),
        })
      }
      throw error
    }
    await chooseArchive(imported, archive)
    expect((await rows(imported)).courses).toEqual([])
    await confirmImport(imported, false)
    // A real page close straight after the committed write, rather than an
    // injected read or sleep masking WebKit's D2 close-after-write failure.
    await imported.close()
    const reopened = await fresh.newPage()
    reopened.on("pageerror", (error) => errors.push(error.message))
    await reopened.goto("/")
    await expect(
      reopened.getByRole("heading", { name: "D2 - 38 | 2026" }),
    ).toBeVisible()
    expect(await rows(reopened)).toEqual(before)
    await reopened.getByRole("button", { name: "Allievi", exact: true }).click()
    await expect(
      reopened.getByRole("heading", { name: "Allievi", exact: true }),
    ).toBeVisible()
    expect(errors).toEqual([])
    const file = evidenceOutputPath(
      info,
      "D4",
      `round-trip-${info.project.name}.json`,
    )
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(
      file,
      JSON.stringify(
        {
          status: "PASS",
          sourceFixture: "0.3.0",
          rowsIdentical: true,
          immediateClose: true,
          freshBrowserProcess: true,
          destinationDeviceIdentityPreserved: true,
          counts: Object.fromEntries(
            Object.entries(before).map(([name, records]) => [
              name,
              records.length,
            ]),
          ),
          pageErrors: errors,
          physicalDevice: "PENDING_OWNER",
        },
        null,
        2,
      ) + "\n",
    )
  } finally {
    await fresh.close()
    await destinationBrowser.close()
  }
})

test("refuses corrupt, invalid and too-new files without changing the current course", async ({
  page,
}) => {
  await upgradedCourse(page)
  const before = await rows(page)
  const archive = await exportFile(page)
  const invalid = structuredClone(archive)
  invalid.tables.evaluations[0]!.studentId = "missing-student"
  const tooNew = structuredClone(archive)
  tooNew.dataVersion = {
    version: { major: 99, minor: 0, patch: 0 },
    minimumWriter: { major: 99, minor: 0, patch: 0 },
  }
  for (const candidate of ["{broken-json", invalid, tooNew]) {
    await chooseArchive(page, candidate)
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "Corso trovato" }),
    ).toHaveCount(0)
    expect(await rows(page)).toEqual(before)
  }
})

test("a same-ID import rejects an unnotified tab's first real UI save", async ({
  page,
  context,
}) => {
  await upgradedCourse(page)
  const archive = await exportFile(page)
  const student = archive.tables.students.find((row) => row.active === 1)!
  const displayName = String(student.nickname || student.firstName)
  const stale = await context.newPage()
  await stale.addInitScript(() => {
    const Original = window.BroadcastChannel
    // Lose only the app's advisory notification. The PowerSync engine and
    // its own cross-tab messaging remain real; the in-lock guard must hold.
    window.BroadcastChannel = function (name: string) {
      if (name.startsWith("cvc-local-data:"))
        return { onmessage: null, postMessage() {}, close() {} }
      return new Original(name)
    } as unknown as typeof BroadcastChannel
  })
  await stale.goto("/")
  await stale.getByRole("button", { name: "Allievi", exact: true }).click()
  await stale.getByRole("button", { name: "Menu allievi" }).click()
  await stale.getByRole("button", { name: "Conoscenza allievi" }).click()
  await stale
    .getByRole("button", { name: `Nota di ${displayName}`, exact: true })
    .click()
  student.initialNote = "Nota conservata nel file importato"
  await chooseArchive(page, archive)
  await confirmImport(page, true)
  await stale
    .getByLabel(`Nota iniziale di ${displayName}`, { exact: true })
    .fill("Scrittura tardiva della vecchia schermata")
  await expect(
    stale.getByRole("heading", { name: "Il corso è cambiato" }),
  ).toBeVisible()
  expect(
    (await rows(page)).students.find((row) => row.id === student.id)
      ?.initialNote,
  ).toBe("Nota conservata nel file importato")
  await stale.close()
})

test("course-file and reset controls remain usable at narrow widths and enlarged text", async ({
  page,
}, info) => {
  await upgradedCourse(page)
  const archive = await exportFile(page)
  await chooseArchive(page, archive)
  await expect(
    page.getByRole("heading", { name: "Corso trovato" }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Azzera tutti i dati locali", exact: true })
    .click()
  for (const width of [320, 390, 412]) {
    await page.setViewportSize({ width, height: 844 })
    for (const scale of ["100%", "200%"]) {
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = size
      }, scale)
      const layout = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
        controls: [
          ...document.querySelectorAll<HTMLElement>(
            '[aria-labelledby="course-files-title"] button, [aria-labelledby="full-reset-title"] button, fieldset:has(input[name="crew-display-columns"]) label',
          ),
        ]
          .filter((button) => button.getClientRects().length > 0)
          .map((button) => ({
            label: button.innerText,
            width: button.getBoundingClientRect().width,
            height: button.getBoundingClientRect().height,
            textWidth: button.scrollWidth,
            availableWidth: button.clientWidth,
            textHeight: button.scrollHeight,
            availableHeight: button.clientHeight,
          })),
      }))
      expect(layout.page, `${width}/${scale} page width`).toBeLessThanOrEqual(
        layout.viewport,
      )
      for (const button of layout.controls) {
        expect(
          button.width,
          `${width}/${scale} ${button.label}`,
        ).toBeGreaterThanOrEqual(44)
        expect(
          button.height,
          `${width}/${scale} ${button.label}`,
        ).toBeGreaterThanOrEqual(44)
        expect(
          button.textWidth,
          `${width}/${scale} ${button.label}`,
        ).toBeLessThanOrEqual(button.availableWidth + 1)
        expect(
          button.textHeight,
          `${width}/${scale} ${button.label}`,
        ).toBeLessThanOrEqual(button.availableHeight + 1)
      }
      if (width === 320 && scale === "200%") {
        await page
          .getByRole("button", { name: "Sostituisci il corso", exact: true })
          .scrollIntoViewIfNeeded()
        await page.screenshot({
          path: evidenceOutputPath(
            info,
            "D4",
            `course-file-controls-320-200-${info.project.name}.png`,
          ),
        })
      }
      if (width === 390 && scale === "100%") {
        await page
          .getByRole("heading", { name: "Copia del corso", exact: true })
          .scrollIntoViewIfNeeded()
        await page.screenshot({
          path: evidenceOutputPath(
            info,
            "D4",
            `course-file-controls-390-${info.project.name}.png`,
          ),
        })
      }
    }
  }
})
