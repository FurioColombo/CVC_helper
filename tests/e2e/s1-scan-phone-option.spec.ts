import path from "node:path"

import { expect, test } from "@playwright/test"

const CLEAR_ROSTER = path.resolve("tests/fixtures/ocr-sheet-clear.png")

/**
 * S1. The telephone column is the third of the roster and the one the course
 * does not need. Left unread it must be absent from the whole journey: not
 * shown in the review, not counted against the operator, not saved on the
 * student — while the two fields the course does need are read exactly as they
 * are when the number is asked for (student-scan.spec.ts asks for it).
 */
test("scans without reading the telephone, and saves no number", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "One OCR pass is sufficient; the option is not platform-specific",
  )
  test.setTimeout(90_000)
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await page.getByRole("button", { name: "Scan allievi" }).click()

  // Unread is the default: the operator has to ask for the number.
  await expect(
    page.getByRole("checkbox", { name: /Leggi anche il telefono/ }),
  ).not.toBeChecked()

  await page
    .getByLabel("Scegli foto dell’elenco allievi dalla galleria")
    .setInputFiles(CLEAR_ROSTER)
  await page.getByRole("button", { name: "Usa questa area" }).click()
  await expect(
    page.getByRole("heading", { name: "Controlla prima di salvare" }),
  ).toBeVisible({ timeout: 30_000 })

  // Same three rows, same names and ages as the journey that reads the number:
  // switching the column off costs nothing on the fields that matter.
  await expect(page.getByLabel(/^Nome riga/)).toHaveCount(3)
  await expect(page.getByLabel(/^Nome riga/).nth(0)).toHaveValue("Mario")
  await expect(page.getByLabel(/^Età riga/).nth(1)).toHaveValue("27")
  await expect(
    page.getByLabel(/^Data esatta per le regole sui minori riga/),
  ).toHaveCount(0)
  // Nothing about a telephone anywhere on the review.
  await expect(page.getByLabel(/^Telefono riga/)).toHaveCount(0)

  await expect(page.getByText(/Dedotto dal foglio/)).toBeVisible()
  const counters = page.getByLabel("Stato revisione scansione")
  await expect(counters.getByText("3")).toHaveCount(1)
  await expect(counters.getByText("0")).toHaveCount(2)

  await page.getByRole("button", { name: "Aggiungi 3 allievi" }).click()
  await expect(
    page.getByRole("button", { name: /Mario, 18 anni, M/ }),
  ).toBeVisible()

  // And no number reached the record: the student's own profile has none.
  await page.getByRole("button", { name: /Mario, 18 anni, M/ }).click()
  await expect(page.getByRole("heading", { name: "Profilo" })).toBeVisible()
  await expect(
    page
      .locator("dt", { hasText: /^Telefono$/ })
      .locator("xpath=following-sibling::dd[1]"),
  ).toHaveText("—")
})
