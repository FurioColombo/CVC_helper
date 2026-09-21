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

async function placeInCrew(page: Page, name: string, crewNumber: number) {
  await page
    .getByRole("region", { name: "Allievi disponibili" })
    .getByRole("button", { name })
    .click()
  await page
    .getByRole("button", {
      name: `Sposta ${name} in equipaggio ${crewNumber}`,
    })
    .click()
}

test("shows one worst-severity crew warning with all size and pair details", async ({
  page,
}, testInfo) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await addStudent(page, "Aldo", "Rossi")
  await addStudent(page, "Bea", "Verdi")

  await page.getByRole("button", { name: "Menu allievi" }).click()
  await page.getByRole("button", { name: "Conoscenza allievi" }).click()
  await page
    .getByRole("group", { name: "Taglia di Aldo" })
    .getByRole("button", { name: "XS", exact: true })
    .click()
  await expect(page.getByLabel("Stato salvataggio Aldo")).toHaveText("Salvato")
  await page
    .getByRole("group", { name: "Taglia di Bea" })
    .getByRole("button", { name: "S", exact: true })
    .click()
  await expect(page.getByLabel("Stato salvataggio Bea")).toHaveText("Salvato")
  await page
    .getByRole("button", { name: "Indietro da Conoscenza allievi" })
    .click()
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()

  const primaryNav = page.getByRole("navigation", {
    name: "Navigazione principale",
  })
  await primaryNav.getByRole("button", { name: "Equipaggi" }).click()
  await page.getByRole("button", { name: "Crea equipaggi" }).click()
  await placeInCrew(page, "Aldo", 1)
  await placeInCrew(page, "Bea", 1)

  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sun-am")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()
  await placeInCrew(page, "Aldo", 1)
  await placeInCrew(page, "Bea", 1)

  const warning = page.getByRole("button", {
    name: "Avvisi equipaggio 1: rosso, 2",
  })
  await expect(warning).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Avvisi equipaggio/ }),
  ).toHaveCount(1)
  await warning.click()
  const detail = page.getByRole("region", {
    name: "Dettaglio avvisi equipaggio 1",
  })
  await expect(detail.getByText(/Taglie (XS \+ S|S \+ XS)/)).toBeVisible()
  await expect(detail.getByText("Coppia nelle ultime 3 sessioni")).toBeVisible()
  await expect(detail.getByText(/ultima Sabato PM/)).toBeVisible()

  if (testInfo.project.name === "iphone-13-viewport") {
    const screenshotPath = path.resolve(
      "test-results/screenshots/crew-warnings-iphone13.png",
    )
    mkdirSync(path.dirname(screenshotPath), { recursive: true })
    await page.screenshot({ path: screenshotPath })
  }
})
