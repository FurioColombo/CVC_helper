import { expect, test } from "@playwright/test"

test("restores confirmed local data after closing and reopening the page", async ({
  context,
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill("Mario")
  await page.getByLabel("Cognome", { exact: true }).fill("Rossi")
  await page.getByLabel(/^Data di nascita/).fill("2000-01-01")
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText("M", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
  await expect(page.getByRole("button", { name: /^Mario,/ })).toBeVisible()

  await page.close()
  const reopened = await context.newPage()
  await reopened.goto("/")
  await expect(
    reopened.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ }),
  ).toBeVisible()
  await reopened.getByRole("button", { name: "Allievi" }).click()
  await expect(reopened.getByRole("button", { name: /^Mario,/ })).toBeVisible()
})
