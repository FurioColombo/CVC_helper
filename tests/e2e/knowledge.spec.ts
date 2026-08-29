import { expect, type Page, test } from "@playwright/test"

async function createCourseAndStudent(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill("Mario")
  await page.getByLabel("Cognome", { exact: true }).fill("Rossi")
  await page.getByLabel(/^Data di nascita/).fill("2010-01-01")
  await page.getByText("M", { exact: true }).click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
}

async function openKnowledge(page: Page) {
  await page.getByRole("button", { name: "Menu allievi" }).click()
  await page.getByRole("button", { name: "Conoscenza allievi" }).click()
}

test("autosaves and restores student knowledge", async ({ page }) => {
  await createCourseAndStudent(page)
  await openKnowledge(page)

  const size = page.getByLabel("Taglia di Mario")
  const note = page.getByLabel("Nota iniziale di Mario")
  const saveStatus = page.getByLabel("Stato salvataggio Mario")
  await expect(
    page.getByRole("button", { name: "Detta nota di Mario" }),
  ).toBeVisible()
  await size.selectOption("L")
  await note.fill("Esperienza Optimist, molto sicuro al timone")
  await expect(saveStatus).toHaveText("Salvataggio…")
  await expect(saveStatus).toHaveText("Salvato")

  await page
    .getByRole("button", { name: "Indietro da Conoscenza allievi" })
    .click()
  await page
    .getByRole("button", { name: /Mario, \d+ anni, M, Minorenne/ })
    .click()
  await expect(page.getByText("L", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Esperienza Optimist, molto sicuro al timone", {
      exact: true,
    }),
  ).toBeVisible()

  await page.reload()
  await page.getByRole("button", { name: "Allievi" }).click()
  await openKnowledge(page)
  await expect(page.getByLabel("Taglia di Mario")).toHaveValue("L")
  await expect(page.getByLabel("Nota iniziale di Mario")).toHaveValue(
    "Esperienza Optimist, molto sicuro al timone",
  )
})
