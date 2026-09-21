import { mkdir } from "node:fs/promises"
import path from "node:path"

import { expect, test, type Page } from "@playwright/test"

async function createCourse(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
}

async function addStudents(page: Page, count: number, longNames = false) {
  await page.getByRole("button", { name: "Allievi" }).click()
  for (let index = 1; index <= count; index += 1) {
    await page.getByRole("button", { name: "Aggiungi allievo" }).click()
    await page
      .getByLabel("Nome", { exact: true })
      .fill(longNames ? `NomeLunghissimo${index}` : `Nome${index}`)
    await page.getByLabel("Cognome", { exact: true }).fill(`Cognome${index}`)
    await page.getByLabel(/^Data di nascita/).fill("2000-01-01")
    await page
      .getByRole("group", { name: "Sesso" })
      .getByText(index % 2 === 0 ? "M" : "F", { exact: true })
      .click()
    await page.getByRole("button", { name: "Salva allievo" }).click()
  }
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
}

test("previews, confirms and edits duties directly from the seven day cards", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  await createCourse(page)
  await addStudents(page, 8)
  await page.getByRole("button", { name: "Comandate" }).click()
  await page.getByRole("button", { name: "Proponi comandate" }).click()

  await expect(
    page.getByRole("region", { name: "Anteprima proposta" }),
  ).toBeVisible()
  await expect(page.getByText("Nessun dato salvato")).toBeVisible()
  if (testInfo.project.name === "pixel-7-chrome") {
    const screenshotDirectory = path.resolve("test-results/screenshots")
    await mkdir(screenshotDirectory, { recursive: true })
    await page.screenshot({
      path: path.join(screenshotDirectory, "u08-p12-preview-pixel-7.png"),
      fullPage: true,
    })
  }

  const saturdayExtra = page.getByRole("button", {
    name: "Sabato con più persone",
  })
  await expect(saturdayExtra).toHaveAttribute("aria-pressed", "true")
  await saturdayExtra.click()
  await expect(
    page.getByRole("button", { name: "Conferma proposta" }),
  ).toBeDisabled()
  await page.getByRole("button", { name: "Annulla" }).click()
  await expect(
    page.getByRole("heading", { name: "Nessuna comandata pianificata" }),
  ).toBeVisible()

  await page.getByRole("button", { name: "Proponi comandate" }).click()
  await page.getByRole("button", { name: "Conferma proposta" }).click()
  await expect(
    page.getByRole("region", { name: "Piano comandate" }),
  ).toBeVisible()
  await expect(
    page.getByRole("status", { name: /Copertura comandate 8\/8/ }),
  ).toBeVisible()

  for (const label of [
    "Sabato",
    "Domenica",
    "Lunedì",
    "Martedì",
    "Mercoledì",
    "Giovedì",
    "Venerdì",
  ]) {
    await expect(
      page.getByRole("button", { name: new RegExp(`^${label},`) }),
    ).toBeVisible()
  }

  const saturdayCard = page.getByRole("button", {
    name: /^Sabato, \d+ assegnati/,
  })
  await saturdayCard.click()
  await expect(
    page.getByRole("heading", { name: /Comandata sabato/ }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: /Mai assegnati/ }),
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: /Assegnati ad altri giorni/ }),
  ).toBeVisible()
  await expect(
    page.getByRole("region", { name: "Allievi comandata Sabato" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Nome1", exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Rimuovi Nome1 da Sabato" }),
  ).toBeVisible()

  const duplicate = page.getByRole("button", {
    name: "Nome3",
    exact: true,
  })
  await duplicate.click()
  await expect(
    page.getByRole("img", { name: "Nome3 assegnato in più giorni" }),
  ).toBeVisible()
  const originalViewport = page.viewportSize()!
  await page.setViewportSize({ width: 320, height: 664 })
  expect(
    await page
      .getByRole("img", { name: "Nome3 assegnato in più giorni" })
      .locator("xpath=ancestor::article")
      .evaluate((element) => getComputedStyle(element).gridColumnEnd),
  ).toBe("span 2")
  await page.setViewportSize(originalViewport)
  await expect(
    page.getByRole("button", { name: "Nome3", exact: true }),
  ).toHaveCount(0)
  await expect(page.getByText("Dom", { exact: true })).toBeVisible()
  if (testInfo.project.name === "pixel-7-chrome") {
    await page.screenshot({
      path: path.resolve(
        "test-results/screenshots/u08-p13-direct-edit-pixel-7.png",
      ),
      fullPage: true,
    })
  }

  await page
    .getByRole("button", { name: "Indietro da Comandata sabato" })
    .click()
  await page.reload()
  await page.getByRole("button", { name: "Comandate" }).click()
  await expect(
    page.getByRole("status", { name: /Copertura comandate 8\/8/ }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /^Sabato, \d+ assegnati/ }),
  ).toContainText("Nome3")
  await page.getByRole("button", { name: /^Sabato, \d+ assegnati/ }).click()
  await page.getByRole("button", { name: "Rimuovi Nome3 da Domenica" }).click()
  await expect(
    page.getByRole("img", { name: "Nome3 assegnato in più giorni" }),
  ).toHaveCount(0)
  await page
    .getByRole("button", { name: "Indietro da Comandata sabato" })
    .click()
  await page.reload()
  await page.getByRole("button", { name: "Comandate" }).click()
  await expect(
    page.getByRole("button", { name: /^Sabato, \d+ assegnati/ }),
  ).toContainText("Nome3")
  await expect(
    page.getByRole("button", { name: /^Domenica, \d+ assegnati/ }),
  ).not.toContainText("Nome3")

  if (testInfo.project.name === "pixel-7-chrome") {
    const screenshotDirectory = path.resolve("test-results/screenshots")
    await mkdir(screenshotDirectory, { recursive: true })
    await page.screenshot({
      path: path.join(screenshotDirectory, "u08-p11-p13-pixel-7.png"),
      fullPage: true,
    })
  }
})

test("keeps long-name P13 cards readable and tappable at 320px and 200% text", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 320, height: 664 })
  await createCourse(page)
  await addStudents(page, 8, true)
  await page.getByRole("button", { name: "Comandate" }).click()
  await page.getByRole("button", { name: "Proponi comandate" }).click()
  await page.getByRole("button", { name: "Conferma proposta" }).click()
  await page.getByRole("button", { name: /^Sabato, \d+ assegnati/ }).click()
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320)
  const cards = page
    .getByRole("region", { name: "Allievi comandata Sabato" })
    .locator("article")
  await expect(cards).toHaveCount(8)
  const ordinaryGrid = cards.first().locator("..")
  expect(
    await ordinaryGrid.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(" ").length,
    ),
  ).toBe(2)
  const overflows = await cards.evaluateAll(
    (elements) =>
      elements.filter(
        (element) => element.scrollWidth > element.clientWidth + 1,
      ).length,
  )
  expect(overflows).toBe(0)
  const addButtons = page
    .getByRole("region", { name: "Allievi comandata Sabato" })
    .getByRole("button", { name: /^NomeLunghissimo/ })
  for (const button of await addButtons.all()) {
    const box = await button.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(40)
    expect(box!.height).toBeGreaterThanOrEqual(40)
  }
  const removeButton = page
    .getByRole("button", {
      name: /Rimuovi NomeLunghissimo.* da Sabato/,
    })
    .first()
  const removeBox = await removeButton.boundingBox()
  expect(removeBox).not.toBeNull()
  expect(removeBox!.width).toBeGreaterThanOrEqual(40)
  expect(removeBox!.height).toBeGreaterThanOrEqual(40)
  if (testInfo.project.name === "pixel-7-chrome") {
    await page.screenshot({
      path: path.resolve("test-results/screenshots/u08-p13-stress-pixel-7.png"),
      fullPage: true,
    })
  }
})

test("keeps the P12 controls usable at 320px and 200% text", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 664 })
  await createCourse(page)
  await addStudents(page, 1)
  await page.getByRole("button", { name: "Comandate" }).click()
  await page.getByRole("button", { name: "Proponi comandate" }).click()
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })

  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(viewport!.width)
  await expect(
    page.getByRole("heading", { name: "Proposta comandate" }),
  ).toBeVisible()
  await expect(
    page.getByRole("group", { name: "Giorni con più persone" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Sabato con più persone" }).click()
  await expect(
    page.getByRole("button", { name: "Conferma proposta" }),
  ).toBeDisabled()
  if (testInfo.project.name === "pixel-7-chrome") {
    await page.screenshot({
      path: path.resolve("test-results/screenshots/u08-p12-stress-pixel-7.png"),
      fullPage: true,
    })
  }
})
