import { expect, type Page, test } from "@playwright/test"

async function createCourse(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
}

async function addStudent(
  page: Page,
  input: { firstName: string; surname: string; dateOfBirth: string },
) {
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill(input.firstName)
  await page.getByLabel("Cognome", { exact: true }).fill(input.surname)
  await page.getByLabel(/^Data di nascita/).fill(input.dateOfBirth)
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText("M", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
  await expect(page.getByRole("heading", { name: "Allievi" })).toBeVisible()
}

test("adds, disambiguates, edits, disables and restores students", async ({
  page,
}) => {
  await createCourse(page)

  await expect(
    page.getByRole("heading", { name: "Nessun allievo" }),
  ).toBeVisible()
  await addStudent(page, {
    firstName: "Mario",
    surname: "Rossi",
    dateOfBirth: "2010-01-01",
  })
  await expect(
    page.getByRole("button", {
      name: /Mario, \d+ anni, M, Minorenne/,
    }),
  ).toBeVisible()

  await addStudent(page, {
    firstName: "Mario",
    surname: "Bianchi",
    dateOfBirth: "2000-01-01",
  })
  await expect(page.getByText("Mario R.", { exact: true })).toBeVisible()
  await expect(page.getByText("Mario B.", { exact: true })).toBeVisible()

  await page
    .getByRole("button", { name: /Mario R\., \d+ anni, M, Minorenne/ })
    .click()
  await expect(page.getByText("Minorenne", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Modifica allievo" }).click()
  await page.getByLabel(/^Nome visualizzato \/ soprannome/).fill("Marty")
  await page.getByLabel("Telefono", { exact: true }).fill("333 1234567")
  await expect(page.getByText("Salvato", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Fine" }).click()
  await expect(page.getByRole("heading", { name: "Marty" })).toBeVisible()
  await expect(page.getByText("333 1234567", { exact: true })).toBeVisible()

  await page
    .getByRole("button", { name: "Disponibilità ed eliminazione" })
    .click()
  await page.getByRole("button", { name: "Disabilita allievo" }).click()
  await expect(
    page.getByRole("button", { name: "Riattiva allievo" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Indietro da Profilo" }).click()
  await expect(
    page.getByRole("button", {
      name: /Marty, \d+ anni, M, Minorenne, Non disponibile/,
    }),
  ).toBeVisible()

  await page.reload()
  await page
    .getByRole("button", { name: "Indietro da Allievi", exact: true })
    .click()
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await page
    .getByRole("button", {
      name: /Marty, \d+ anni, M, Minorenne, Non disponibile/,
    })
    .click()
  await page
    .getByRole("button", { name: "Disponibilità ed eliminazione" })
    .click()
  await page.getByRole("button", { name: "Riattiva allievo" }).click()
  await expect(
    page.getByRole("button", { name: "Disabilita allievo" }),
  ).toBeVisible()
})
