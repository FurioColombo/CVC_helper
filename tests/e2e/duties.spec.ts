import path from "node:path"

import { expect, type Page, test } from "@playwright/test"

async function addStudent(
  page: Page,
  index: number,
  options: { minor?: boolean; female?: boolean } = {},
) {
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill(`Nome${index}`)
  await page.getByLabel("Cognome", { exact: true }).fill(`Cognome${index}`)
  await page
    .getByLabel(/^Data di nascita/)
    .fill(options.minor ? "2010-01-01" : "2000-01-01")
  await page.getByText(options.female ? "F" : "M", { exact: true }).click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
}

test("plans, overrides and recalculates remaining duties without rewriting history", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()

  for (let index = 1; index <= 8; index += 1) {
    await addStudent(page, index, {
      minor: index === 1 || index === 5,
      female: index % 2 === 1,
    })
  }

  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await page.getByRole("button", { name: "Comandate" }).click()
  await page.getByRole("button", { name: "Proponi comandate" }).click()
  await page.getByText("Nome1", { exact: true }).click()
  await page.getByRole("button", { name: "Genera" }).click()

  await expect(
    page.getByRole("region", { name: "Piano comandate" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Venerdì, 1 assegnati/ }),
  ).toContainText("Nome1")

  await page.getByRole("button", { name: /Venerdì, 1 assegnati/ }).click()
  await page.getByRole("button", { name: /Nome1/ }).click()
  await page.getByRole("button", { name: /Nome8/ }).click()
  await page
    .getByRole("button", { name: "Indietro da Comandata venerdì" })
    .click()

  await page.getByRole("button", { name: /Avvisi/ }).click()
  await expect(
    page.getByText("Preferenza venerdì non soddisfatta"),
  ).toBeVisible()
  await page.getByRole("button", { name: "Accetta eccezione" }).click()
  await expect(
    page.getByText("Preferenza venerdì non soddisfatta"),
  ).not.toBeVisible()
  await page
    .getByRole("button", { name: "Indietro da Avvisi comandate" })
    .click()

  const saturdayCard = page.getByRole("button", { name: /Sabato, 2 assegnati/ })
  const completedNames = await saturdayCard.locator("span").last().textContent()
  await saturdayCard.click()
  await page.getByRole("button", { name: "Segna completata" }).click()
  await expect(
    page.getByRole("button", { name: /Sabato, 2 assegnati, completata/ }),
  ).toBeVisible()

  await page.getByRole("button", { name: "Indietro da Comandate" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await page.getByRole("button", { name: /Nome4,/ }).click()
  await page.getByRole("button", { name: "Disabilita allievo" }).click()
  await page.getByRole("button", { name: "Indietro da Dettaglio" }).click()
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await page.getByRole("button", { name: "Comandate" }).click()

  await page.getByRole("button", { name: "Ricalcola" }).click()
  await page.getByRole("button", { name: "Ricalcola", exact: true }).click()
  const completedSaturday = page.getByRole("button", {
    name: /Sabato, 2 assegnati, completata/,
  })
  await expect(completedSaturday).toContainText(completedNames ?? "")
  await expect(
    page.getByRole("button", { name: /Venerdì, 1 assegnati/ }),
  ).toContainText("Nome1")

  await page.reload()
  await page.getByRole("button", { name: "Comandate" }).click()
  await expect(
    page.getByRole("button", { name: /Sabato, 2 assegnati, completata/ }),
  ).toContainText(completedNames ?? "")

  if (testInfo.project.name === "iphone-13-viewport") {
    await page.screenshot({
      path: path.resolve(".evidence/M7/duties-iphone13.png"),
    })
  }
})
