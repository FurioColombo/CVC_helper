import path from "node:path"

import { expect, test } from "@playwright/test"

const CLEAR_ROSTER = path.resolve("tests/fixtures/ocr-sheet-clear.png")
const BLURRED_ROSTER = path.resolve("tests/fixtures/ocr-sheet-blurred.png")

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

  await expect(page.getByRole("button", { name: "Fai una foto" })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Scegli dalla galleria" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Inserisci manualmente" }),
  ).toBeVisible()
  await expect(
    page.getByLabel("Scatta foto dell’elenco allievi"),
  ).toHaveAttribute("capture", "environment")

  const input = page.getByLabel(
    "Scegli foto dell’elenco allievi dalla galleria",
  )
  await input.setInputFiles(BLURRED_ROSTER)
  await expect(
    page.getByRole("dialog", { name: "Raddrizza e ritaglia foto" }),
  ).toBeVisible()
  // The rotation slider was replaced by the document workspace's ruler dial.
  const tilt = page.getByRole("slider", { name: "Inclinazione in gradi" })
  await tilt.press("ArrowRight")
  await expect(tilt).toHaveAttribute("aria-valuenow", "0.1")
  await tilt.press("Home")
  await expect(tilt).toHaveAttribute("aria-valuenow", "0")
  await page
    .getByRole("group", { name: /Area di ritaglio/ })
    .press("ArrowRight")
  await page.getByRole("button", { name: "Usa questa area" }).click()
  await expect(page.getByText("Immagine poco leggibile")).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText("Controlla prima di salvare")).not.toBeVisible()

  await input.setInputFiles(CLEAR_ROSTER)
  await page.getByRole("button", { name: "Usa questa area" }).click()
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
  // The review now insists the operator says which name came first before a
  // row can be committed; answering once applies to the whole sheet.
  await expect(
    page.getByRole("heading", { name: "Come sono scritti i nomi?" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Applica Nome · Cognome" }).click()
  await expect(page.getByText("Nomi letti come")).toBeVisible()

  const counters = page.getByLabel("Stato revisione scansione")
  await expect(counters.getByText("3")).toHaveCount(1)
  await expect(counters.getByText("0")).toHaveCount(2)
  await page.setViewportSize({ width: 320, height: 664 })
  const enlargedText = await page.addStyleTag({
    content: "html { font-size: 200% !important; }",
  })
  const focusedReviewField = page.getByLabel(/^Nome riga/).nth(1)
  await focusedReviewField.focus()
  const reviewOverflow = await page.evaluate(() => ({
    document:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    cards: Math.max(
      ...Array.from(document.querySelectorAll("article")).map(
        (card) => card.scrollWidth - card.clientWidth,
      ),
    ),
  }))
  expect(reviewOverflow.document).toBeLessThanOrEqual(0)
  expect(reviewOverflow.cards).toBeLessThanOrEqual(3)
  const focusClearance = await page.evaluate(() => {
    const focused = document.activeElement?.getBoundingClientRect()
    const counters = document
      .querySelector('[aria-label="Stato revisione scansione"]')
      ?.getBoundingClientRect()
    return {
      counterBottom: counters?.bottom ?? Number.POSITIVE_INFINITY,
      focusedTop: focused?.top ?? Number.NEGATIVE_INFINITY,
    }
  })
  expect(focusClearance.focusedTop).toBeGreaterThanOrEqual(
    focusClearance.counterBottom,
  )
  await enlargedText.evaluate((element) => (element as HTMLElement).remove())
  if (testInfo.project.name === "iphone-13-viewport") {
    await page.screenshot({
      fullPage: true,
      path: path.resolve("test-results/screenshots/review-iphone13.png"),
    })
  }

  await page
    .getByLabel(/^Cognome riga/)
    .nth(0)
    .fill("Rossi corretto")
  await page.getByRole("button", { name: "Rimuovi allievo 3" }).click()
  await expect(counters.getByText("2")).toBeVisible()
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
