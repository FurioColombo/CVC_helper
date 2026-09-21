import { resolve } from "node:path"

import { chromium } from "@playwright/test"
import { preview } from "vite"

const root = resolve(import.meta.dirname, "..")
const port = 4175
const roster = resolve(root, "tests/fixtures/ocr-sheet-clear.png")

const server = await preview({
  configFile: resolve(root, "vite.config.ts"),
  preview: { host: "127.0.0.1", port, strictPort: true },
})
// The app may be built for a subdirectory of its host, in which case both the
// page and the service worker's scope live under that base. Take it from the
// resolved config rather than assuming the origin root, or this check proves
// the offline behaviour of a URL nobody will visit.
const base = server.config.base || "/"
const url = `http://127.0.0.1:${port}${base}`
const browser = await chromium.launch()

try {
  const context = await browser.newContext({
    locale: "it-IT",
    serviceWorkers: "allow",
  })
  const page = await context.newPage()
  page.setDefaultTimeout(60_000)
  await page.goto(url, { waitUntil: "domcontentloaded" })
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))

  await context.setOffline(true)
  await page.reload({ waitUntil: "domcontentloaded" })
  // Ask for something under the app's own base that the precache cannot hold.
  // The base is passed in rather than read from the page, so this file needs no
  // browser globals.
  const networkIsBlocked = await page.evaluate(async (pageUrl) => {
    try {
      await fetch(`${pageUrl}not-precached-${crypto.randomUUID()}`, {
        cache: "no-store",
      })
      return false
    } catch {
      return true
    }
  }, url)
  if (!networkIsBlocked) {
    throw new Error("Unexpected network response while browser is offline")
  }

  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await page.getByRole("button", { name: "Scan allievi" }).click()
  await page
    .getByLabel("Scegli foto dell’elenco allievi dalla galleria")
    .setInputFiles(roster)
  await page.getByRole("button", { name: "Usa questa area" }).click()
  await page
    .getByRole("heading", { name: "Controlla prima di salvare" })
    .waitFor()

  const names = await page
    .getByLabel(/^Nome riga/)
    .evaluateAll((inputs) => inputs.map((input) => input.value))
  const surnames = await page
    .getByLabel(/^Cognome riga/)
    .evaluateAll((inputs) => inputs.map((input) => input.value))
  if (
    JSON.stringify(names) !== JSON.stringify(["Mario", "Giulia", "Luca"]) ||
    JSON.stringify(surnames) !==
      JSON.stringify(["Rossi", "Bianchi", "De Angelis"])
  ) {
    throw new Error(
      `Offline OCR returned unexpected people: ${JSON.stringify({ names, surnames })}`,
    )
  }

  console.log(
    `PASS: installed PWA at ${base} completed its first local OCR scan while offline (3/3 people correctly associated)`,
  )
  await context.close()
} finally {
  await browser.close()
  await server.close()
}
