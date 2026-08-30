import path from "node:path"

import { expect, test } from "@playwright/test"

const CLEAR_ROSTER = path.resolve(".evidence/M0/ocr-sheet-clear.png")
const BLURRED_ROSTER = path.resolve(".evidence/M0/ocr-sheet-blurred.png")

test("rejects a bad image and commits only reviewed OCR rows", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await page.getByRole("button", { name: "Scan allievi" }).click()

  const input = page.getByLabel("Foto o screenshot degli allievi")
  await input.setInputFiles(BLURRED_ROSTER)
  await expect(page.getByText("Immagine poco leggibile")).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText("Controlla prima di salvare")).not.toBeVisible()

  await input.setInputFiles(CLEAR_ROSTER)
  await expect(
    page.getByRole("heading", { name: "Controlla prima di salvare" }),
  ).toBeVisible({ timeout: 30_000 })
  await expect(page.getByLabel(/^Nome riga/)).toHaveCount(3)
  await expect(page.getByLabel(/^Nome riga/).nth(0)).toHaveValue("Mario")
  await expect(page.getByLabel(/^Cognome riga/).nth(2)).toHaveValue(
    "De Angelis",
  )
  await expect(page.getByLabel(/^Data di nascita riga/).nth(1)).toHaveValue(
    "1998-11-24",
  )
  await expect(page.getByLabel(/^Telefono riga/).nth(0)).toHaveValue(
    "333 123 4567",
  )
  if (testInfo.project.name === "iphone-13-viewport") {
    await page.screenshot({
      fullPage: true,
      path: path.resolve(".evidence/M4/review-iphone13.png"),
    })
  }

  await page
    .getByLabel(/^Cognome riga/)
    .nth(0)
    .fill("Rossi corretto")
  await page.getByRole("button", { name: "Rimuovi allievo 3" }).click()
  await page.getByRole("button", { name: "Aggiungi 2 allievi" }).click()

  await expect(
    page.getByRole("button", { name: /Mario, 18 anni, M/ }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Giulia, 27 anni, F/ }),
  ).toBeVisible()

  await page.reload()
  await page.getByRole("button", { name: "Allievi" }).click()
  await expect(
    page.getByRole("button", { name: /Mario, 18 anni, M/ }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Giulia, 27 anni, F/ }),
  ).toBeVisible()
})
