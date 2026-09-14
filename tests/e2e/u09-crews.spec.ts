import { mkdirSync } from "node:fs"
import path from "node:path"

import { expect, type Page, test } from "@playwright/test"

async function addStudent(page: Page, firstName: string, surname: string) {
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill(firstName)
  await page.getByLabel("Cognome", { exact: true }).fill(surname)
  await page.getByLabel(/^Data di nascita/).fill("2000-01-01")
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText("M", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
}

async function assertNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
    innerWidth,
    body: document.body.scrollWidth,
    offenders: [...document.querySelectorAll<HTMLElement>("body *")]
      .filter(
        (element) =>
          element.getBoundingClientRect().right >
            document.documentElement.clientWidth + 1 ||
          element.scrollWidth > element.clientWidth + 1,
      )
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        label: element.getAttribute("aria-label"),
        right: Math.round(element.getBoundingClientRect().right),
      })),
  }))
  expect(widths.document, JSON.stringify(widths)).toBeLessThanOrEqual(
    widths.viewport + 1,
  )
}

test("keeps P14–P16 compact while assigning and unlinking session boats", async ({
  page,
}, testInfo) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Barche" }).click()
  await page.getByRole("button", { name: "Configura barche" }).click()
  await page.getByLabel("Numeri barca").fill("1 2 3 4 5 6 7 8 9 10")
  await page.getByRole("button", { name: "Configura", exact: true }).click()
  await page.getByRole("button", { name: "Home", exact: true }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await addStudent(page, "Aldo", "Rossi")
  await addStudent(page, "Bea", "Verdi")
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await page.getByRole("spinbutton").fill("2")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()

  const pool = page.getByRole("region", { name: "Allievi disponibili" })
  for (const student of ["Aldo", "Bea"]) {
    await pool.getByRole("button", { name: student }).click()
    await page
      .getByRole("button", { name: `Sposta ${student} in equipaggio 1` })
      .click()
  }
  await expect(page.getByText("Allievi sistemati 2/2")).toBeVisible()

  await page.setViewportSize({ width: 320, height: 664 })
  await assertNoHorizontalOverflow(page)
  const crewContent = page.getByRole("region", {
    name: "Composizione equipaggi",
  })
  const crewRail = page.getByRole("navigation", {
    name: "Accesso rapido equipaggi",
  })
  const railGeometry = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>(
      '[aria-label="Composizione equipaggi"]',
    )
    const rail = document.querySelector<HTMLElement>(
      '[aria-label="Accesso rapido equipaggi"]',
    )
    return {
      contentBottom: content?.getBoundingClientRect().bottom,
      railTop: rail?.getBoundingClientRect().top,
    }
  })
  expect(railGeometry.contentBottom).toBeLessThanOrEqual(
    (railGeometry.railTop ?? 0) + 1,
  )
  const railBottom = await crewRail.evaluate(
    (element) => element.getBoundingClientRect().bottom,
  )
  const appNavTop = await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .evaluate((element) => element.getBoundingClientRect().top)
  expect(railBottom).toBeLessThanOrEqual(appNavTop + 1)
  await crewContent
    .getByRole("button", { name: "Bea, equipaggio 1" })
    .scrollIntoViewIfNeeded()
  const memberBottom = await crewContent
    .getByRole("button", { name: "Bea, equipaggio 1" })
    .evaluate((element) => element.getBoundingClientRect().bottom)
  const railTop = await crewRail.evaluate(
    (element) => element.getBoundingClientRect().top,
  )
  expect(memberBottom).toBeLessThanOrEqual(railTop + 1)
  if (testInfo.project.name === "pixel-7-chrome") {
    const screenshotPath = path.resolve(".evidence/U09/p14-320.png")
    mkdirSync(path.dirname(screenshotPath), { recursive: true })
    await page.screenshot({ path: screenshotPath })
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await assertNoHorizontalOverflow(page)
  await expect(
    crewContent.getByRole("button", { name: "Bea, equipaggio 1" }),
  ).toBeVisible()
  await page.evaluate(() => {
    document.documentElement.style.fontSize = ""
  })

  await page.getByRole("button", { name: "Apri barche della sessione" }).click()
  const boatStrip = page.getByRole("region", { name: "Barche della sessione" })
  await expect(
    boatStrip.getByRole("button", { name: "Altre barche" }),
  ).toBeVisible()
  const firstPage = await boatStrip
    .locator("button[aria-pressed]")
    .evaluateAll((buttons) =>
      buttons.map((button) => ({
        name: button.getAttribute("aria-label"),
        top: Math.round(button.getBoundingClientRect().top),
      })),
    )
  expect(
    firstPage.map(({ name }) => name?.match(/RS Quest (\d+)/)?.[1]),
  ).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"])
  expect(new Set(firstPage.map(({ top }) => top)).size).toBe(2)
  await assertNoHorizontalOverflow(page)
  await page.setViewportSize({ width: 320, height: 480 })
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  const stickyTop = await boatStrip.evaluate(
    (element) => element.getBoundingClientRect().top,
  )
  expect(stickyTop).toBeGreaterThanOrEqual(-1)
  expect(stickyTop).toBeLessThanOrEqual(2)
  await page.setViewportSize({ width: 320, height: 664 })
  await page.evaluate(() => window.scrollTo(0, 0))
  if (testInfo.project.name === "pixel-7-chrome") {
    await page.screenshot({ path: path.resolve(".evidence/U09/p15-320.png") })
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await assertNoHorizontalOverflow(page)
  await expect(
    boatStrip.getByRole("button", { name: "Altre barche" }),
  ).toBeVisible()
  await page.evaluate(() => {
    document.documentElement.style.fontSize = ""
  })
  await boatStrip.getByRole("button", { name: "Altre barche" }).click()
  await expect(
    boatStrip.getByRole("button", { name: /^RS Quest 10 · Disponibile/ }),
  ).toBeVisible()
  await boatStrip.getByRole("button", { name: "Barche precedenti" }).click()

  // A blue boat can be assigned directly to a boatless crew, including it in
  // this outing in the same persisted operation.
  await page.getByRole("button", { name: "Equipaggio 1, senza barca" }).click()
  await boatStrip
    .getByRole("button", { name: /^RS Quest 2 · Disponibile/ })
    .click()
  await expect(
    boatStrip.getByRole("button", { name: /^RS Quest 2 · Assegnata/ }),
  ).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "Torna agli equipaggi" }).click()
  await expect(
    page.getByRole("button", { name: "Destinazione equipaggio 1: RS Quest 2" }),
  ).toBeVisible()

  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sun-am")
  await page.getByRole("spinbutton").fill("1")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()
  await page.getByRole("button", { name: "Apri barche della sessione" }).click()
  await page.getByRole("button", { name: "Equipaggio 1, senza barca" }).click()
  await boatStrip
    .getByRole("button", { name: /^RS Quest 2 · Disponibile/ })
    .click()
  await page.getByRole("button", { name: "Torna agli equipaggi" }).click()

  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sat-pm")
  await page.getByRole("button", { name: "Apri barche della sessione" }).click()
  await boatStrip
    .getByRole("button", { name: /^RS Quest 2 · Assegnata/ })
    .click()
  await page.getByRole("button", { name: "Torna agli equipaggi" }).click()
  await expect(
    page.getByRole("button", {
      name: "Destinazione equipaggio 1: Non assegnato",
    }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Aldo, equipaggio 1" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Bea, equipaggio 1" }),
  ).toBeVisible()

  await page.reload()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sun-am")
  await expect(
    page.getByRole("button", { name: "Destinazione equipaggio 1: RS Quest 2" }),
  ).toBeVisible()
  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sat-pm")

  await page.getByRole("button", { name: "Aldo, equipaggio 1" }).dblclick()
  await expect(pool.getByRole("button", { name: "Aldo" })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Bea, equipaggio 1" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Rendi disponibile Bea" }).click()
  await expect(pool.getByRole("button", { name: "Bea" })).toBeVisible()
  await pool.getByRole("button", { name: "Aldo" }).click()
  await page.getByRole("button", { name: "Sposta Aldo A terra" }).click()
  await expect(
    page.getByRole("button", { name: "Aldo, A terra" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Rendi disponibile Aldo" }).click()
  await expect(pool.getByRole("button", { name: "Aldo" })).toBeVisible()
  await assertNoHorizontalOverflow(page)

  await page.getByRole("button", { name: "Apri barche della sessione" }).click()
  await boatStrip
    .getByRole("button", { name: /^RS Quest 1 · Disponibile/ })
    .click()
  await page.getByRole("button", { name: "Torna agli equipaggi" }).click()
  await page.getByRole("button", { name: "Apri vista lettura" }).click()
  const readView = page.getByRole("dialog", { name: "Vista lettura equipaggi" })
  await expect(
    readView.getByRole("listitem", { name: "Equipaggio 1, senza barca" }),
  ).toBeVisible()
  await expect(readView.getByText("Senza barca").first()).toBeVisible()
  await assertNoHorizontalOverflow(page)
  if (testInfo.project.name === "pixel-7-chrome") {
    await page.screenshot({ path: path.resolve(".evidence/U09/p16-320.png") })
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await assertNoHorizontalOverflow(page)
  await expect(readView.getByText("Senza barca").first()).toBeVisible()
})

test("returns an embarked CT to volunteers by gesture and explicit action", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Volontari" }).click()
  await page.getByRole("button", { name: "Aggiungi volontario" }).click()
  await page.getByLabel("Nome completo").fill("Carlo CT")
  await page.getByText("CT", { exact: true }).click()
  await page.getByRole("button", { name: "Salva volontario" }).click()
  await page.getByRole("button", { name: "Indietro da Volontari" }).click()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await page.getByRole("spinbutton").fill("1")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()

  const pool = page.getByRole("region", { name: "Volontari disponibili" })
  await pool.getByRole("button", { name: "Carlo CT" }).click()
  await page
    .getByRole("button", { name: "Sposta Carlo CT in equipaggio 1" })
    .click()
  await page.getByRole("button", { name: "Carlo CT, equipaggio 1" }).dblclick()
  await expect(pool.getByRole("button", { name: "Carlo CT" })).toBeVisible()

  await pool.getByRole("button", { name: "Carlo CT" }).click()
  await page
    .getByRole("button", { name: "Sposta Carlo CT in equipaggio 1" })
    .click()
  await page.getByRole("button", { name: "Rendi disponibile Carlo CT" }).click()
  await expect(pool.getByRole("button", { name: "Carlo CT" })).toBeVisible()
  await page.reload()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await expect(pool.getByRole("button", { name: "Carlo CT" })).toBeVisible()
})
