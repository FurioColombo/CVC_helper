import { expect, test } from "@playwright/test"

const STORAGE_KEY = "cvc-v03-dictation-fixture-note"

test("successful dictation enters the editable field and saves without confirmation", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/dictation-success.html")
  await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY)
  await page.reload()

  const note = page.getByRole("textbox", { name: "Nota di prova" })
  await expect(note).toHaveValue("Nota già digitata")
  await page.getByRole("button", { name: "Detta nota di prova" }).click()
  await page
    .getByRole("button", { name: "Termina dettatura nota di prova" })
    .click()

  await expect(note).toHaveValue("Nota già digitata Vento teso da nord")
  await expect(
    page.getByRole("button", { name: /Scarta|Usa testo|Usa trascrizione/ }),
  ).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Salva nota" })).toBeEnabled()

  await note.fill("Nota già digitata Vento teso da nord, corretto")
  await page.getByRole("button", { name: "Salva nota" }).click()
  await expect(page.getByRole("status")).toHaveText("Nota salvata")
  await page.reload()

  await expect(
    page.getByRole("textbox", { name: "Nota di prova" }),
  ).toHaveValue("Nota già digitata Vento teso da nord, corretto")
})
