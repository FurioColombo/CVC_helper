import { expect, type Page, test } from "@playwright/test"

async function createCourse(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
}

async function addStudent(page: Page, surname: string, dateOfBirth: string) {
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill("Mario")
  await page.getByLabel("Cognome", { exact: true }).fill(surname)
  await page.getByLabel(/^Data di nascita/).fill(dateOfBirth)
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText("M", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
  await expect(page.getByRole("heading", { name: "Allievi" })).toBeVisible()
}

test("shows only the surname prefixes needed to distinguish same-initial names", async ({
  page,
}) => {
  await createCourse(page)
  await addStudent(page, "Rossi", "2010-01-01")
  await addStudent(page, "Rocchi", "2010-01-01")

  await expect(
    page.getByRole("button", { name: /Mario Ros\., \d+ anni, M, Minorenne/ }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Mario Roc\., \d+ anni, M, Minorenne/ }),
  ).toBeVisible()
})
