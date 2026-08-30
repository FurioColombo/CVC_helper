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
  test.setTimeout(210_000)
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()

  for (let index = 1; index <= 21; index += 1) {
    await addStudent(page, index, {
      minor: index === 1 || index === 5,
      female: index % 2 === 1,
    })
  }

  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await page.getByRole("button", { name: "Comandate" }).click()
  await page.getByRole("button", { name: "Proponi comandate" }).click()
  const stayOverNames = Array.from(
    { length: 5 },
    (_, index) => `Nome${index + 1}`,
  )
  for (const name of stayOverNames) {
    await page.getByText(name, { exact: true }).click()
  }
  await page.getByRole("button", { name: "Genera" }).click()

  await expect(
    page.getByRole("region", { name: "Piano comandate" }),
  ).toBeVisible()
  const initialFridayCard = page.getByRole("button", {
    name: /Venerdì, 3 assegnati/,
  })
  const initialFridayNames = (
    (await initialFridayCard.locator("span").last().textContent()) ?? ""
  ).split(" · ")
  expect(initialFridayNames).toHaveLength(3)
  expect(initialFridayNames.every((name) => stayOverNames.includes(name))).toBe(
    true,
  )

  const thursdayCard = page.getByRole("button", {
    name: /Giovedì, 3 assegnati/,
  })
  const manualOverrideName = (
    (await thursdayCard.locator("span").last().textContent()) ?? ""
  )
    .split(" · ")
    .find((name) => !stayOverNames.includes(name))!
  await initialFridayCard.click()
  await page
    .getByRole("button", { name: initialFridayNames[0]!, exact: true })
    .click()
  await page
    .getByRole("button", { name: manualOverrideName, exact: true })
    .click()
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

  const saturdayCard = page.getByRole("button", { name: /Sabato, 3 assegnati/ })
  const completedNames = await saturdayCard.locator("span").last().textContent()
  const disabledMidweekName = (
    (await page
      .getByRole("button", { name: /Mercoledì, 3 assegnati/ })
      .locator("span")
      .last()
      .textContent()) ?? ""
  ).split(" · ")[0]!
  await saturdayCard.click()
  await page.getByRole("button", { name: "Segna completata" }).click()
  await expect(
    page.getByRole("button", { name: /Sabato, 3 assegnati, completata/ }),
  ).toBeVisible()

  await page.getByRole("button", { name: "Indietro da Comandate" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await page
    .getByRole("button", {
      name: new RegExp(`^${disabledMidweekName},`),
    })
    .click()
  await page.getByRole("button", { name: "Disabilita allievo" }).click()
  await page.getByRole("button", { name: "Indietro da Dettaglio" }).click()
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await page.getByRole("button", { name: "Comandate" }).click()

  await page.getByRole("button", { name: "Ricalcola" }).click()
  await page.getByRole("button", { name: "Ricalcola", exact: true }).click()
  const assertHealthyFuturePlan = async () => {
    await expect(page.getByRole("button", { name: "Avvisi · 0" })).toBeVisible()
    for (const label of [
      "Domenica",
      "Lunedì",
      "Martedì",
      "Mercoledì",
      "Giovedì",
      "Venerdì",
    ]) {
      await expect(
        page.getByRole("button", { name: new RegExp(`^${label},`) }),
      ).not.toContainText(disabledMidweekName)
    }
    const fridayNames = (
      (await page
        .getByRole("button", { name: /Venerdì, 3 assegnati/ })
        .locator("span")
        .last()
        .textContent()) ?? ""
    ).split(" · ")
    expect(fridayNames).toHaveLength(3)
    expect(fridayNames.every((name) => stayOverNames.includes(name))).toBe(true)
  }
  const completedSaturday = page.getByRole("button", {
    name: /Sabato, 3 assegnati, completata/,
  })
  await expect(completedSaturday).toContainText(completedNames ?? "")
  await assertHealthyFuturePlan()

  await page.reload()
  await page.getByRole("button", { name: "Comandate" }).click()
  await expect(
    page.getByRole("button", { name: /Sabato, 3 assegnati, completata/ }),
  ).toContainText(completedNames ?? "")
  await assertHealthyFuturePlan()

  if (testInfo.project.name === "iphone-13-viewport") {
    await page.screenshot({
      path: path.resolve(".evidence/G3/duties-gate-iphone13.png"),
    })
  }
})
