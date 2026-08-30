import path from "node:path"

import { expect, test } from "@playwright/test"

const CLEAR_ROSTER = path.resolve(".evidence/M0/ocr-sheet-clear.png")

test("keeps the complete student workflow consistent across reload", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  await page.clock.setFixedTime(new Date("2026-08-29T12:00:00+02:00"))
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()

  await page.getByRole("button", { name: "Scan allievi" }).click()
  await page
    .getByLabel("Foto o screenshot degli allievi")
    .setInputFiles(CLEAR_ROSTER)
  await expect(
    page.getByRole("heading", { name: "Controlla prima di salvare" }),
  ).toBeVisible({ timeout: 30_000 })
  const correctedSurname = page.getByLabel(/^Cognome riga/).nth(1)
  await expect(correctedSurname).toHaveValue("Bianchi")
  await correctedSurname.fill("Bianchini")
  await page.getByRole("button", { name: "Aggiungi 3 allievi" }).click()

  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill("Mario")
  await page.getByLabel("Cognome", { exact: true }).fill("Verdi")
  await page.getByLabel(/^Data di nascita/).fill("2010-01-01")
  await page.getByText("M", { exact: true }).click()
  await page.getByRole("button", { name: "Salva allievo" }).click()

  await expect(
    page.getByRole("button", { name: /Mario R\., 18 anni, M/ }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", {
      name: /Mario V\., 16 anni, M, Minorenne/,
    }),
  ).toBeVisible()

  await page.getByRole("button", { name: "Menu allievi" }).click()
  await page.getByRole("button", { name: "Conoscenza allievi" }).click()
  await page.getByLabel("Taglia di Mario R.").selectOption("L")
  await page.getByLabel("Nota iniziale di Mario R.").fill("Esperienza Optimist")
  await expect(page.getByLabel("Stato salvataggio Mario R.")).toHaveText(
    "Salvato",
  )
  await page.getByLabel("Taglia di Mario V.").selectOption("XS")
  await page
    .getByLabel("Nota iniziale di Mario V.")
    .fill("Minorenne, prima esperienza")
  await expect(page.getByLabel("Stato salvataggio Mario V.")).toHaveText(
    "Salvato",
  )
  await page
    .getByRole("button", { name: "Indietro da Conoscenza allievi" })
    .click()

  await page
    .getByRole("button", {
      name: /Mario V\., 16 anni, M, Minorenne/,
    })
    .click()
  await expect(page.getByText("Minorenne, prima esperienza")).toBeVisible()
  await expect(page.getByText("XS", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Disabilita allievo" }).click()
  await expect(
    page.getByRole("button", { name: "Riattiva allievo" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Indietro da Dettaglio" }).click()
  await expect(
    page.getByRole("button", {
      name: /Mario V\., 16 anni, M, Minorenne, Non disponibile/,
    }),
  ).toBeVisible()

  await page.reload()
  await page.getByRole("button", { name: "Allievi" }).click()
  await expect(
    page.getByRole("button", { name: /Mario R\., 18 anni, M/ }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", {
      name: /Mario V\., 16 anni, M, Minorenne, Non disponibile/,
    }),
  ).toBeVisible()

  await page
    .getByRole("button", {
      name: /Mario V\., 16 anni, M, Minorenne, Non disponibile/,
    })
    .click()
  await page.getByRole("button", { name: "Riattiva allievo" }).click()
  await expect(
    page.getByRole("button", { name: "Disabilita allievo" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Indietro da Dettaglio" }).click()

  await page.getByRole("button", { name: /Giulia, 27 anni, F/ }).click()
  await expect(page.getByText("Giulia Bianchini")).toBeVisible()
  await expect(page.getByText("24/11/1998")).toBeVisible()
  await expect(page.getByText("347 765 4321")).toBeVisible()
  await page.getByRole("button", { name: "Indietro da Dettaglio" }).click()

  await page.getByRole("button", { name: /Mario R\., 18 anni, M/ }).click()
  await expect(page.getByText("Esperienza Optimist")).toBeVisible()
  await expect(page.getByText("L", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Indietro da Dettaglio" }).click()

  if (testInfo.project.name === "iphone-13-viewport") {
    await page.screenshot({
      fullPage: true,
      path: path.resolve(".evidence/G1/final-list-iphone13.png"),
    })
  }
})
