import path from "node:path"

import { expect, type Page, test } from "@playwright/test"

async function addStudent(page: Page, firstName: string, surname: string) {
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill(firstName)
  await page.getByLabel("Cognome", { exact: true }).fill(surname)
  await page.getByLabel(/^Data di nascita/).fill("2000-01-01")
  await page.getByText("M", { exact: true }).click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
}

test("composes, swaps and persists session-specific crews and A terra", async ({
  page,
}, testInfo) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()

  await addStudent(page, "Aldo", "Rossi")
  await addStudent(page, "Bea", "Verdi")
  await addStudent(page, "Carlo", "Neri")
  await addStudent(page, "Dina", "Blu")

  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await page.getByRole("button", { name: "Volontari" }).click()
  await page.getByRole("button", { name: "Aggiungi volontario" }).click()
  await page.getByLabel("Nome completo").fill("Vera ADV")
  await page.getByRole("button", { name: "Salva volontario" }).click()
  await page.getByRole("button", { name: "Indietro da Volontari" }).click()

  const primaryNav = page.getByRole("navigation", {
    name: "Navigazione principale",
  })
  await primaryNav.getByRole("button", { name: "Equipaggi" }).click()
  await page.getByRole("spinbutton").fill("2")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()

  const studentPool = page.getByRole("region", {
    name: "Allievi disponibili",
  })
  const staffPool = page.getByRole("region", {
    name: "ADV e IS disponibili",
  })
  await studentPool.getByRole("button", { name: "Aldo" }).click()
  if (testInfo.project.name === "iphone-13-viewport") {
    await page.screenshot({
      path: path.resolve(".evidence/M8/crew-shortcuts-iphone13.png"),
    })
  }
  await page
    .getByRole("button", { name: "Sposta Aldo in equipaggio 1" })
    .click()
  await studentPool.getByRole("button", { name: "Bea" }).click()
  await page.getByRole("button", { name: "Sposta Bea in equipaggio 1" }).click()
  await studentPool.getByRole("button", { name: "Carlo" }).click()
  await page
    .getByRole("button", { name: "Sposta Carlo in equipaggio 2" })
    .click()
  await staffPool.getByRole("button", { name: "Vera ADV" }).click()
  await expect(
    page.getByRole("button", { name: "Sposta selezionato A terra" }),
  ).toBeDisabled()
  await page
    .getByRole("button", { name: "Sposta Vera ADV in equipaggio 2" })
    .click()
  await studentPool.getByRole("button", { name: "Dina" }).click()
  await page.getByRole("button", { name: "Sposta Dina A terra" }).click()

  await expect(page.getByText("Allievi sistemati 4/4")).toBeVisible()
  await page.getByRole("button", { name: "Aldo, equipaggio 1" }).click()
  await page.getByRole("button", { name: "Carlo, equipaggio 2" }).click()
  await expect(
    page.getByRole("button", { name: "Carlo, equipaggio 1" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Aldo, equipaggio 2" }),
  ).toBeVisible()

  await page.getByRole("button", { name: "Vera ADV, equipaggio 2" }).click()
  await page
    .getByRole("button", { name: "Rimuovi Vera ADV dall’assegnazione" })
    .click()
  await expect(
    staffPool.getByRole("button", { name: "Vera ADV" }),
  ).toBeVisible()
  await expect(page.getByText("Allievi sistemati 4/4")).toBeVisible()

  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sun-am")
  await expect(
    page.getByRole("heading", { name: "Prepara la sessione" }),
  ).toBeVisible()
  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sat-pm")
  await expect(
    page.getByRole("button", { name: "Dina, A terra" }),
  ).toBeVisible()

  await page.reload()
  await primaryNav.getByRole("button", { name: "Equipaggi" }).click()
  await expect(
    page.getByRole("button", { name: "Carlo, equipaggio 1" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Aldo, equipaggio 2" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Dina, A terra" }),
  ).toBeVisible()

  if (testInfo.project.name === "iphone-13-viewport") {
    await page.screenshot({
      fullPage: true,
      path: path.resolve(".evidence/M8/crews-iphone13.png"),
    })
  }
})
