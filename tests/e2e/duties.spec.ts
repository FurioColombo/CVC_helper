import path from "node:path"

import { expect, type Locator, type Page, test } from "@playwright/test"

async function dutyCardNames(card: Locator) {
  return card
    .locator("[data-student-name]")
    .evaluateAll((elements) =>
      elements.map(
        (element) => (element as HTMLElement).dataset.studentName ?? "",
      ),
    )
}

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
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText(options.female ? "F" : "M", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
}

test("plans, overrides and recalculates remaining duties without rewriting history", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000)
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
  await page.getByText("Scegli tra tutti gli allievi").click()
  const stayOverNames = Array.from(
    { length: 5 },
    (_, index) => `Nome${index + 1}`,
  )
  for (const name of stayOverNames) {
    await page.getByText(name, { exact: true }).click()
  }
  await page.getByRole("button", { name: "Conferma proposta" }).click()

  await expect(
    page.getByRole("region", { name: "Piano comandate" }),
  ).toBeVisible()
  const initialFridayCard = page.getByRole("button", {
    name: /Venerdì, 3 assegnati/,
  })
  const initialFridayNames = await dutyCardNames(initialFridayCard)
  expect(initialFridayNames).toHaveLength(3)
  expect(initialFridayNames.every((name) => stayOverNames.includes(name))).toBe(
    true,
  )

  const thursdayCard = page.getByRole("button", {
    name: /Giovedì, 3 assegnati/,
  })
  const manualOverrideName = (await dutyCardNames(thursdayCard)).find(
    (name) => !stayOverNames.includes(name),
  )!
  await initialFridayCard.click()
  await page
    .getByRole("button", {
      name: `Rimuovi ${initialFridayNames[0]!} da Venerdì`,
    })
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
  const completedNames = await saturdayCard
    .locator("[data-duty-names]")
    .textContent()
  const disabledMidweekName = (
    await dutyCardNames(
      page.getByRole("button", { name: /Mercoledì, 3 assegnati/ }),
    )
  )[0]!
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
  const lifecycle = page.getByRole("button", {
    name: "Disponibilità ed eliminazione",
  })
  await lifecycle.evaluate((element) =>
    element.scrollIntoView({ block: "center" }),
  )
  await lifecycle.click()
  const disableStudent = page.getByRole("button", {
    name: "Disabilita allievo",
  })
  await disableStudent.evaluate((element) =>
    element.scrollIntoView({ block: "center" }),
  )
  await disableStudent.click()
  await page.getByRole("button", { name: "Indietro da Profilo" }).click()
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await page.getByRole("button", { name: "Comandate" }).click()

  await page.getByRole("button", { name: "Ricalcola" }).click()
  await page.getByRole("button", { name: "Domenica con più persone" }).click()
  await page.getByRole("button", { name: "Venerdì con più persone" }).click()
  await page.getByRole("button", { name: "Conferma proposta" }).click()
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
    const fridayNames = await dutyCardNames(
      page.getByRole("button", { name: /Venerdì, 3 assegnati/ }),
    )
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
      path: path.resolve("test-results/screenshots/duties-gate-iphone13.png"),
    })
  }
})
