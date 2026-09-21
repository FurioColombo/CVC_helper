import path from "node:path"

import { expect, test } from "@playwright/test"

const CLEAR_ROSTER = path.resolve("tests/fixtures/ocr-sheet-clear.png")

async function openScan(page: import("@playwright/test").Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await page.getByRole("button", { name: "Scan allievi" }).click()
}

test("keeps acquisition and adjustment usable on compact screens", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 664 })
  await openScan(page)

  await expect(page.getByRole("button", { name: "Fai una foto" })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Scegli dalla galleria" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Inserisci manualmente" }),
  ).toBeVisible()
  await expect(page.locator("html")).toHaveJSProperty("scrollLeft", 0)

  await page
    .getByLabel("Scegli foto dell’elenco allievi dalla galleria")
    .setInputFiles(CLEAR_ROSTER)
  const dialog = page.getByRole("dialog", { name: "Raddrizza e ritaglia foto" })
  await expect(dialog).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Usa questa area" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", {
      name: "Ridimensiona ritaglio dall’angolo in basso a destra",
    }),
  ).toBeVisible()
  // The correction replaced the rotation slider with a document workspace.
  await expect(page.locator('input[type="range"]')).toHaveCount(0)
  await expect(page.getByLabel("Area di lavoro foto")).toBeVisible()
  await expect(page.getByAltText("Anteprima foto da ritagliare")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Raddrizza con una linea" }),
  ).toBeVisible()
  const dial = page.getByRole("slider", { name: "Inclinazione in gradi" })
  await dial.focus()
  await dial.press("ArrowRight")
  await expect(dial).toHaveAttribute("aria-valuenow", "0.1")
  await page.getByRole("group", { name: /Area di ritaglio/ }).press("ArrowDown")
  await page.screenshot({
    fullPage: true,
    path: path.resolve(
      `test-results/screenshots/editor-${testInfo.project.name}.png`,
    ),
  })

  const overflow = await page.evaluate(() => ({
    document:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    dialog:
      (document.querySelector('[role="dialog"]')?.scrollWidth ?? 0) -
      (document.querySelector('[role="dialog"]')?.clientWidth ?? 0),
  }))
  expect(overflow.document).toBeLessThanOrEqual(0)
  expect(overflow.dialog).toBeLessThanOrEqual(0)

  await page.getByRole("button", { name: "Chiudi regolazione foto" }).click()
  await expect(
    page.getByRole("button", { name: "Scegli dalla galleria" }),
  ).toBeFocused()
})

test("keeps scan entry readable at 200 percent text", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 664 })
  await openScan(page)
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" })

  for (const name of [
    "Fai una foto",
    "Scegli dalla galleria",
    "Inserisci manualmente",
  ]) {
    await expect(page.getByRole("button", { name })).toBeVisible()
  }
  // S1 added a choice to this screen; at 200% text it is two lines of Italian
  // beside a box, which is exactly the shape that overflowed elsewhere.
  const readPhone = page.getByRole("checkbox", {
    name: /Leggi anche il telefono/,
  })
  await expect(readPhone).toBeVisible()
  await expect(readPhone).not.toBeChecked()
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})
