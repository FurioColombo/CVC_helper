import { mkdirSync } from "node:fs"
import path from "node:path"

import { expect, test } from "@playwright/test"

/**
 * Every model mark, measured in its slot.
 *
 * The marks shipped with `h-full` on the image. `content-center` makes the grid
 * row content-sized, so that percentage had nothing definite to resolve
 * against and each mark fell back to its intrinsic 60px height inside a 36px
 * row. A wide mark was still capped by the column's 88px and looked correct,
 * so the only fleet the suite ever rendered — RS Quest — hid it, while J/80,
 * RS 500 and the First marks stood over the rows below them.
 *
 * This measures the image against its own slot for every type in the canonical
 * list, which is the assertion that would have caught it.
 */

const TYPES = [
  "RS Toura",
  "RS Quest",
  "Laser Vago",
  "RS 500",
  "J/80",
  "First 25.7",
  "First 27",
] as const

test("keeps every model mark inside its slot", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "Mark geometry is measured on one project",
  )
  test.setTimeout(120_000)

  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Barche" }).click()
  await page.getByRole("button", { name: "Configura barche" }).click()
  await page.getByLabel("Tipo").selectOption(TYPES[0])
  await page.getByLabel("Numeri barca").fill("1")
  await page.getByRole("button", { name: "Configura", exact: true }).click()

  for (const [index, type] of TYPES.slice(1).entries()) {
    await page.getByRole("button", { name: "Aggiungi barca" }).click()
    await page.getByLabel("Tipo").selectOption(type)
    await page.getByLabel("Numero barca").fill(String(index + 2))
    await page.getByRole("button", { name: "Aggiungi", exact: true }).click()
  }

  for (const type of TYPES) {
    const slot = page.getByLabel(`Modello ${type}`).first()
    await expect(slot).toBeVisible()
    const fit = await slot.evaluate((element) => {
      const image = element.querySelector("img")
      const slotBox = element.getBoundingClientRect()
      if (!image) return { fallback: true, overflowX: 0, overflowY: 0 }
      const imageBox = image.getBoundingClientRect()
      return {
        fallback: false,
        overflowX: Math.max(
          0,
          imageBox.right - slotBox.right,
          slotBox.left - imageBox.left,
        ),
        overflowY: Math.max(
          0,
          imageBox.bottom - slotBox.bottom,
          slotBox.top - imageBox.top,
        ),
      }
    })
    // A missing asset is allowed — the written mark is the fallback — but a
    // mark that renders must stay inside the slot the row reserved for it.
    expect(fit.overflowX, `${type} overflows horizontally`).toBeLessThanOrEqual(
      1,
    )
    expect(fit.overflowY, `${type} overflows vertically`).toBeLessThanOrEqual(1)
  }

  // The rows must also stay the height the list expects: a mark taller than
  // its slot pushed the card over the one below it, and the 2026-09-20 pass
  // took a quarter of the height out of every card — 72px around a 36px mark.
  const cardHeights = await page
    .getByRole("region", { name: "Elenco barche" })
    .evaluate((list) =>
      [...list.querySelectorAll("button")].map(
        (card) => card.getBoundingClientRect().height,
      ),
    )
  expect(Math.max(...cardHeights)).toBeLessThanOrEqual(56)

  const evidenceDirectory = path.resolve(".evidence/UG1")
  mkdirSync(evidenceDirectory, { recursive: true })
  await page.screenshot({
    path: path.join(evidenceDirectory, "boat-marks-every-type.png"),
    fullPage: true,
  })
})
