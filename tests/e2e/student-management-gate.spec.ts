import path from "node:path"

import { expect, test } from "@playwright/test"

const CLEAR_ROSTER = path.resolve("tests/fixtures/ocr-sheet-clear.png")

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
  await page.getByRole("checkbox", { name: /Leggi anche il telefono/ }).check()
  await page
    .getByLabel("Scegli foto dell’elenco allievi dalla galleria")
    .setInputFiles(CLEAR_ROSTER)
  await page.getByRole("button", { name: "Usa questa area" }).click()
  await expect(
    page.getByRole("heading", { name: "Controlla prima di salvare" }),
  ).toBeVisible({ timeout: 30_000 })
  // The page reports its inferred order before the explicit commit.
  await expect(page.getByText(/Dedotto dal foglio/)).toBeVisible()
  const correctedSurname = page.getByLabel(/^Cognome riga/).nth(1)
  await expect(correctedSurname).toHaveValue("Bianchi")
  await correctedSurname.fill("Bianchini")
  await page.getByRole("button", { name: "Aggiungi 3 allievi" }).click()

  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill("Mario")
  await page.getByLabel("Cognome", { exact: true }).fill("Verdi")
  await page.getByLabel(/^Data di nascita/).fill("2010-01-01")
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText("M", { exact: true })
    .click()
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
  await page
    .getByRole("group", { name: "Taglia di Mario R." })
    .getByRole("button", { name: "L", exact: true })
    .click()
  await page.getByRole("button", { name: "Nota di Mario R." }).click()
  await page.getByLabel("Nota iniziale di Mario R.").fill("Esperienza Optimist")
  await page.getByRole("button", { name: "Fine" }).click()
  await expect(page.getByLabel("Stato salvataggio Mario R.")).toHaveText(
    "Salvato",
  )
  await page
    .getByRole("group", { name: "Taglia di Mario V." })
    .getByRole("button", { name: "XS", exact: true })
    .click()
  await page.getByRole("button", { name: "Nota di Mario V." }).click()
  await page
    .getByLabel("Nota iniziale di Mario V.")
    .fill("Minorenne, prima esperienza")
  await page.getByRole("button", { name: "Fine" }).click()
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
  await expect(
    page.getByRole("button", { name: "Riattiva allievo" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Indietro da Profilo" }).click()
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
  const reopenedLifecycle = page.getByRole("button", {
    name: "Disponibilità ed eliminazione",
  })
  await reopenedLifecycle.evaluate((element) =>
    element.scrollIntoView({ block: "center" }),
  )
  await reopenedLifecycle.click()
  const reactivateStudent = page.getByRole("button", {
    name: "Riattiva allievo",
  })
  await reactivateStudent.evaluate((element) =>
    element.scrollIntoView({ block: "center" }),
  )
  await reactivateStudent.click()
  await expect(
    page.getByRole("button", { name: "Disabilita allievo" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Indietro da Profilo" }).click()

  await page.getByRole("button", { name: /Giulia, 27 anni, F/ }).click()
  await expect(
    page.getByRole("heading", { name: "Giulia Bianchini", exact: true }),
  ).toBeVisible()
  await expect(page.getByText("24/11/1998")).not.toBeVisible()
  await expect(
    page
      .locator("dt", { hasText: /^Età$/ })
      .locator("xpath=following-sibling::dd[1]"),
  ).toHaveText("27 anni")
  // The date remains intact behind the normal age presentation.
  await page
    .getByRole("button", { name: "Modifica allievo", exact: true })
    .click()
  await expect(page.getByLabel("Data di nascita", { exact: true })).toHaveValue(
    "1998-11-24",
  )
  await page
    .getByRole("button", { name: "Indietro da Modifica allievo" })
    .click()
  await expect(page.getByText("347 765 4321")).toBeVisible()
  await page.getByRole("button", { name: "Indietro da Profilo" }).click()

  await page.getByRole("button", { name: /Mario R\., 18 anni, M/ }).click()
  await expect(page.getByText("Esperienza Optimist")).toBeVisible()
  await expect(page.getByText("L", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Indietro da Profilo" }).click()

  if (testInfo.project.name === "iphone-13-viewport") {
    await page.screenshot({
      fullPage: true,
      path: path.resolve("test-results/screenshots/final-list-iphone13.png"),
    })
  }
})

test("creates, corrects and reloads a declared age without a birth date", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-08-29T12:00:00+02:00"))
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()

  await page.getByLabel("Nome", { exact: true }).fill("Giulia")
  await page.getByLabel("Cognome", { exact: true }).fill("Bianchi")
  await page.getByLabel("Età compiuta il primo giorno del corso").fill("17")
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText("Altro", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()

  const student = page.getByRole("button", {
    name: /Giulia, 17 anni, Altro, Minorenne/,
  })
  await expect(student).toBeVisible()
  await student.click()
  await expect(
    page.getByText("Età dichiarata all’inizio del corso"),
  ).toBeVisible()
  await expect(page.getByText("17 anni · dichiarata")).toBeVisible()
  await expect(page.getByText("Minorenne")).toBeVisible()

  await page.getByRole("button", { name: "Modifica allievo" }).click()
  await expect(
    page.getByLabel("Età compiuta il primo giorno del corso"),
  ).toHaveValue("17")
  await expect(page.getByLabel("Data di nascita", { exact: true })).toHaveValue(
    "",
  )
  await page.getByLabel("Età compiuta il primo giorno del corso").fill("18")
  await page.getByRole("button", { name: "Fine" }).click()
  await expect(page.getByText("18 anni · dichiarata")).toBeVisible()
  await expect(page.getByText("Minorenne")).not.toBeVisible()

  await page.getByRole("button", { name: "Indietro da Profilo" }).click()
  await page.reload()
  await page.getByRole("button", { name: "Allievi" }).click()
  await expect(
    page.getByRole("button", { name: /Giulia, 18 anni, Altro/ }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Giulia, 18 anni, Altro, Minorenne/ }),
  ).toHaveCount(0)
})
