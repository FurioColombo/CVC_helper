import path from "node:path"

import { expect, type Locator, type Page, test } from "@playwright/test"

const CANONICAL_DEFAULTS = [
  ["Deriva", 1, "RS Toura"],
  ["Deriva", 2, "RS Quest"],
  ["Deriva", 3, "RS Quest"],
  ["Deriva", 4, "Laser Vago"],
  ["Deriva", 5, "RS 500"],
  ["Cabinato", 1, "J/80"],
  ["Cabinato", 2, "First 25.7"],
  ["Cabinato", 3, "First 27"],
] as const

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function boatName(type: string, number: string | number, state?: string) {
  return new RegExp(
    `${escapeRegExp(type)}\\s+${escapeRegExp(String(number))}${state ? `.*${escapeRegExp(state)}` : ""}`,
    "i",
  )
}

async function createCourse(
  page: Page,
  family: "Deriva" | "Cabinato" = "Deriva",
  level = 2,
) {
  await page.goto("/")
  await page.getByRole("button", { name: family }).click()
  await page.getByRole("button", { name: `Livello ${level}` }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Barche" }).click()
}

async function configureBoats(
  page: Page,
  numbers: string,
  expectedType?: string,
) {
  await page
    .getByRole("button", { name: /Configura/ })
    .first()
    .click()
  if (expectedType) {
    await expect(page.getByLabel("Tipo")).toHaveValue(expectedType)
  }
  await page.getByLabel("Numeri barca").fill(numbers)
  await page.getByRole("button", { name: "Configura", exact: true }).click()
  await expect(
    page.getByRole("region", { name: "Elenco barche" }),
  ).toBeVisible()
}

function boatList(page: Page) {
  return page.getByRole("region", { name: "Elenco barche" })
}

function boatCard(page: Page, type: string, number: string | number) {
  return boatList(page).getByRole("button", {
    name: boatName(type, number),
  })
}

async function openBoat(page: Page, type: string, number: string | number) {
  await boatCard(page, type, number).click()
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
}

async function expectInsideViewport(page: Page, locator: Locator) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height)
}

for (const [family, level, defaultType] of CANONICAL_DEFAULTS) {
  test(`keeps the canonical default for ${family} ${level}`, async ({
    page,
  }) => {
    await createCourse(page, family, level)
    await page
      .getByRole("button", { name: /Configura/ })
      .first()
      .click()
    await expect(page.getByLabel("Tipo")).toHaveValue(defaultType)
    await page.getByLabel("Numeri barca").fill("12")
    await page.getByRole("button", { name: "Configura", exact: true }).click()
    await expect(page.getByLabel(`Modello ${defaultType}`)).toBeVisible()
    await expect(boatCard(page, defaultType, 12)).toBeVisible()
  })
}

test("normalizes repeated separators, deduplicates, and shows existing boats when setup is reopened", async ({
  page,
}) => {
  await createCourse(page)
  await configureBoats(page, "2,  2; 7\n11\t14 15", "RS Quest")

  const list = boatList(page)
  await expect(list.getByRole("button")).toHaveCount(5)
  for (const number of [2, 7, 11, 14, 15]) {
    const card = boatCard(page, "RS Quest", number)
    await expect(card).toBeVisible()
    await expect(card.getByText("Disponibile", { exact: true })).toBeVisible()
    await expect(card).toHaveAccessibleName(/Disponibile/i)
  }

  const reconfigure = page.getByRole("button", {
    name: /Configura numeri barche|Configura barche/,
  })
  await expect(reconfigure).toBeVisible()
  await reconfigure.click()
  await expect(
    page.getByRole("heading", { name: "Configura barche" }),
  ).toBeVisible()
  await expect(page.getByText(/RS Quest 2/)).toBeVisible()
  await expect(page.getByText(/RS Quest 15/)).toBeVisible()

  await page.getByLabel("Numeri barca").fill("2 17")
  await page.getByRole("button", { name: "Configura", exact: true }).click()
  await expect(boatList(page).getByRole("button")).toHaveCount(6)
  await expect(boatCard(page, "RS Quest", 17)).toBeVisible()
  await expect(boatCard(page, "RS Quest", 2)).toHaveCount(1)

  await page.getByRole("button", { name: "Aggiungi barca" }).click()
  await page.getByLabel("Numero barca").fill("20 21")
  await expect(page.getByRole("alert")).toContainText(
    "Inserisci un solo numero",
  )
  await expect(
    page.getByRole("button", { name: "Aggiungi", exact: true }),
  ).toBeDisabled()
})

test("keeps two-digit boat identities readable at the stress viewport", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 664 })
  await createCourse(page)
  await configureBoats(page, "11 14", "RS Quest")

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await expectNoHorizontalOverflow(page)
  await expectInsideViewport(
    page,
    page.getByRole("button", { name: "Indietro da Barche" }),
  )
  await expectInsideViewport(
    page,
    page.getByRole("heading", { name: "Barche" }),
  )
  await expectInsideViewport(
    page,
    page.getByRole("button", { name: "Configura numeri barche" }),
  )
  await expectInsideViewport(
    page,
    page.getByRole("button", { name: "Aggiungi barca" }),
  )
  await expect(boatCard(page, "RS Quest", 11)).toBeVisible()
  await expect(boatCard(page, "RS Quest", 14)).toBeVisible()
  await expect(
    boatCard(page, "RS Quest", 11).getByText("11", { exact: true }),
  ).toBeVisible()
  await expect(
    boatCard(page, "RS Quest", 14).getByText("14", { exact: true }),
  ).toBeVisible()
  await expectInsideViewport(
    page,
    boatCard(page, "RS Quest", 11).getByText("Disponibile", { exact: true }),
  )
  await page.screenshot({
    path: path.resolve(
      `.evidence/U05/boats-stress-${testInfo.project.name}.png`,
    ),
  })
})

test("separates fault state from availability and keeps explicit state cues", async ({
  page,
}, testInfo) => {
  await createCourse(page)
  await configureBoats(page, "2, 7", "RS Quest")

  await openBoat(page, "RS Quest", 7)
  await expect(page.getByText("Disponibile", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Segnala", exact: true }).click()
  await page.getByLabel("Descrizione").fill("Timone da controllare")
  await page.getByRole("button", { name: "Salva avaria" }).click()
  await expect(page.getByText("Timone da controllare")).toBeVisible()
  await expect(page.getByText("Disponibile", { exact: true })).toBeVisible()

  await page
    .getByRole("button", { name: "Elimina barca inserita per errore" })
    .click()
  await page.getByRole("button", { name: "Elimina", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("ha avarie")
  await expect(page.getByText("Timone da controllare")).toBeVisible()

  await page.getByRole("button", { name: /Indietro da RS Quest 7/ }).click()
  const faultBoat = boatCard(page, "RS Quest", 7)
  await expect(faultBoat).toBeVisible()
  await expect(faultBoat.getByText(/Da controllare/)).toBeVisible()
  await expect(faultBoat.getByText("1 avaria", { exact: true })).toBeVisible()
  await expect(faultBoat).toHaveAccessibleName(/Da controllare.*1 avaria/i)
  expect(await faultBoat.locator("svg").count()).toBeGreaterThan(0)
  await page.screenshot({
    fullPage: true,
    path: path.resolve(
      `.evidence/U05/boats-status-${testInfo.project.name}.png`,
    ),
  })

  await faultBoat.click()
  await page.getByRole("button", { name: "Rendi indisponibile" }).click()
  await expect(page.getByText("Non disponibile", { exact: true })).toBeVisible()
  await expect(page.getByText("Timone da controllare")).toBeVisible()
  await page.getByRole("button", { name: /Indietro da RS Quest 7/ }).click()
  await expect(
    boatCard(page, "RS Quest", 7).getByText(/Non disponibile/),
  ).toBeVisible()
  await expect(boatCard(page, "RS Quest", 7)).toHaveAccessibleName(
    /Non disponibile.*1 avaria/i,
  )

  await openBoat(page, "RS Quest", 7)
  await page.getByRole("button", { name: "Rendi disponibile" }).click()
  await page
    .getByRole("article")
    .filter({ hasText: "Timone da controllare" })
    .getByRole("button", { name: "Risolta" })
    .click()
  await page.getByRole("button", { name: /Indietro da RS Quest 7/ }).click()
  await expect(
    boatCard(page, "RS Quest", 7).getByText(/Disponibile/),
  ).toBeVisible()
  await expect(boatCard(page, "RS Quest", 7)).toHaveAccessibleName(
    /Disponibile/i,
  )
})

test("persists unavailable status and permits deletion only for an unreferenced entry", async ({
  page,
}) => {
  await createCourse(page)
  await configureBoats(page, "2, 9", "RS Quest")

  await openBoat(page, "RS Quest", 9)
  await page
    .getByRole("button", { name: "Elimina barca inserita per errore" })
    .click()
  await page.getByRole("button", { name: "Elimina", exact: true }).click()
  await expect(
    boatList(page).getByRole("button", { name: boatName("RS Quest", 9) }),
  ).toHaveCount(0)

  await openBoat(page, "RS Quest", 2)
  await page.getByRole("button", { name: "Rendi indisponibile" }).click()
  await page.getByRole("button", { name: /Indietro da RS Quest 2/ }).click()
  await page.reload()
  await page.getByRole("button", { name: "Barche" }).click()
  await expect(
    boatCard(page, "RS Quest", 2).getByText(/Non disponibile/),
  ).toBeVisible()
  await expect(boatCard(page, "RS Quest", 2)).toHaveAccessibleName(
    /Non disponibile/i,
  )
})
