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

test("persists outgoing boats, exact destinations and unavailable-boat warnings", async ({
  page,
}, testInfo) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()

  await page.getByRole("button", { name: "Barche" }).click()
  await page.getByRole("button", { name: "Configura barche" }).click()
  await page.getByLabel("Numeri barca").fill("2, 7")
  await page.getByRole("button", { name: "Configura", exact: true }).click()
  await page.getByRole("button", { name: "RS Quest 7, Disponibile" }).click()
  await page.getByRole("button", { name: "Segnala", exact: true }).click()
  await page.getByLabel("Descrizione").fill("Timone da controllare")
  await page.getByRole("button", { name: "Salva avaria" }).click()
  await page.getByRole("button", { name: "Home", exact: true }).click()

  await page.getByRole("button", { name: "Allievi" }).click()
  await addStudent(page, "Aldo", "Rossi")
  await addStudent(page, "Bea", "Verdi")
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()

  const primaryNav = page.getByRole("navigation", {
    name: "Navigazione principale",
  })
  await primaryNav.getByRole("button", { name: "Equipaggi" }).click()
  await page.getByRole("spinbutton").fill("2")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()

  await page.getByRole("button", { name: "Apri barche della sessione" }).click()
  const boat2 = page.getByRole("button", { name: /^RS Quest 2 · Disponibile/ })
  const boat7 = page.getByRole("button", {
    name: /^RS Quest 7 · Disponibile.*avaria da controllare/,
  })
  await expect(boat7).toBeEnabled()
  await boat2.click()
  await boat7.click()
  await expect(boat2).toHaveAttribute("aria-pressed", "true")
  await expect(boat7).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "Torna agli equipaggi" }).click()

  await page
    .getByRole("button", {
      name: "Destinazione equipaggio 1: Non assegnato",
    })
    .click()
  await page
    .getByRole("button", { name: "Assegna equipaggio 1 a RS Quest 2" })
    .click()
  await page
    .getByRole("button", {
      name: "Destinazione equipaggio 2: Non assegnato",
    })
    .click()
  await expect(
    page.getByRole("button", { name: "Assegna equipaggio 2 a RS Quest 2" }),
  ).toBeDisabled()
  await page.getByRole("button", { name: "Mezzi" }).click()
  await expect(
    page.getByRole("button", { name: "Destinazione equipaggio 2: Mezzi" }),
  ).toBeVisible()

  await page.reload()
  await primaryNav.getByRole("button", { name: "Equipaggi" }).click()
  await expect(
    page.getByRole("button", {
      name: "Destinazione equipaggio 1: RS Quest 2",
    }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Destinazione equipaggio 2: Mezzi" }),
  ).toBeVisible()

  await page.getByRole("button", { name: "Home", exact: true }).click()
  await page.getByRole("button", { name: "Barche" }).click()
  await page.getByRole("button", { name: "RS Quest 2, Disponibile" }).click()
  await page.getByRole("button", { name: "Rendi indisponibile" }).click()
  await primaryNav.getByRole("button", { name: "Equipaggi" }).click()

  const warning = page.getByRole("button", {
    name: "Avvisi equipaggio 1: rosso, 1",
  })
  await expect(warning).toBeVisible()
  await warning.click()
  await expect(page.getByText("Barca non disponibile")).toBeVisible()
  await expect(page.getByText(/RS Quest 2 resta assegnata/)).toBeVisible()
  await page.getByRole("button", { name: "Apri barche della sessione" }).click()
  await expect(
    page.getByRole("button", { name: /^RS Quest 2 · Non disponibile/ }),
  ).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "Torna agli equipaggi" }).click()
  await page
    .getByRole("button", { name: "Destinazione equipaggio 2: Mezzi" })
    .click()
  await expect(
    page.getByRole("button", { name: "Assegna equipaggio 2 a RS Quest 2" }),
  ).toBeDisabled()
  await page.getByRole("button", { name: "Chiudi destinazioni" }).click()
  await page
    .getByRole("button", { name: "Destinazione equipaggio 1: RS Quest 2" })
    .click()
  await expect(
    page.getByRole("button", { name: "Assegna equipaggio 1 a RS Quest 2" }),
  ).toBeEnabled()

  if (testInfo.project.name === "iphone-13-viewport") {
    const screenshotPath = path.resolve(
      ".evidence/M10/crew-destinations-iphone13.png",
    )
    mkdirSync(path.dirname(screenshotPath), { recursive: true })
    await page.screenshot({ fullPage: true, path: screenshotPath })
  }
})
