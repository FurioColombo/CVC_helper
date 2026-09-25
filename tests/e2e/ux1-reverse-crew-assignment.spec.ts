import { mkdirSync } from "node:fs"
import path from "node:path"

import { expect, type Page, test } from "@playwright/test"

async function createCourseWithStudents(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  for (const name of ["Alba", "Bruno", "Celia"]) {
    await page.getByRole("button", { name: "Aggiungi allievo" }).first().click()
    await page.getByLabel("Nome", { exact: true }).fill(name)
    await page.getByLabel("Cognome", { exact: true }).fill("Prova")
    await page.getByLabel(/^Data di nascita/).fill("2000-01-01")
    await page
      .getByRole("group", { name: "Sesso" })
      .getByText("M", { exact: true })
      .click()
    await page.getByRole("button", { name: "Salva allievo" }).click()
  }
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await page.getByRole("spinbutton").fill("2")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()
}

test("assigns students by selecting a free crew slot, including after dismissing the picker", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "The reverse-assignment journey runs once on Pixel 7 Chrome",
  )
  test.setTimeout(90_000)
  await createCourseWithStudents(page)

  const crews = page.getByRole("region", { name: "Equipaggi della sessione" })
  const firstCrew = crews.getByRole("article").nth(0)
  const secondCrew = crews.getByRole("article").nth(1)
  const pool = page.getByRole("region", { name: "Allievi disponibili" })

  await secondCrew
    .getByRole("button", { name: "Posto libero 2 equipaggio 2" })
    .click()
  const picker = page.getByRole("dialog", {
    name: "Scegli un allievo per il posto libero 2 equipaggio 2",
  })
  await expect(picker).toBeVisible()
  await expect(
    secondCrew.getByRole("button", {
      name: "Posto libero 2 equipaggio 2",
    }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect
    .poll(async () => {
      const box = await pool.boundingBox()
      return box?.y ?? Number.POSITIVE_INFINITY
    })
    .toBeLessThan((page.viewportSize()?.height ?? 900) - 80)
  await picker
    .getByRole("button", {
      name: "Bruno, inserisci nel posto libero 2 equipaggio 2",
    })
    .click()
  await expect(secondCrew).toContainText("Bruno")
  await expect(firstCrew).not.toContainText("Bruno")
  await expect(
    secondCrew.getByRole("button", {
      name: "Posto libero 1 equipaggio 2",
    }),
  ).toBeVisible()

  await firstCrew
    .getByRole("button", { name: "Posto libero 1 equipaggio 1" })
    .click()
  await expect(
    page.getByRole("dialog", {
      name: "Scegli un allievo per il posto libero 1 equipaggio 1",
    }),
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(
    page.getByRole("dialog", {
      name: "Scegli un allievo per il posto libero 1 equipaggio 1",
    }),
  ).toHaveCount(0)
  await pool.getByRole("button", { name: "Celia", exact: true }).click()
  await expect(firstCrew).toContainText("Celia")
  await expect(secondCrew).not.toContainText("Celia")

  const memberCard = firstCrew.getByRole("button", {
    name: "Celia, equipaggio 1",
  })
  const [cardBox, nameBox] = await Promise.all([
    memberCard.boundingBox(),
    memberCard.getByText("Celia", { exact: true }).boundingBox(),
  ])
  expect(cardBox).not.toBeNull()
  expect(nameBox).not.toBeNull()
  expect(
    Math.abs(
      (nameBox?.x ?? 0) +
        (nameBox?.width ?? 0) / 2 -
        ((cardBox?.x ?? 0) + (cardBox?.width ?? 0) / 2),
    ),
  ).toBeLessThan(10)

  mkdirSync(path.resolve(".evidence/UX1"), { recursive: true })
  await firstCrew.screenshot({
    path: path.resolve(".evidence/UX1/crew-card-two-column-phone.png"),
  })

  await page.reload()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await expect(crews.getByRole("article").nth(0)).toContainText("Celia")
  await expect(crews.getByRole("article").nth(1)).toContainText("Bruno")
  await expect(
    crews
      .getByRole("article")
      .nth(1)
      .getByRole("button", { name: "Posto libero 1 equipaggio 2" }),
  ).toBeVisible()
})
