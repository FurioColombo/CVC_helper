import { mkdir } from "node:fs/promises"
import path from "node:path"

import { expect, test, type Page } from "@playwright/test"

async function createCourse(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
}

async function addStudent(page: Page) {
  await page.getByRole("button", { name: "Allievi" }).click()
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill("Sofia")
  await page.getByLabel("Cognome", { exact: true }).fill("Student")
  await page.getByLabel(/^Data di nascita/).fill("2000-01-01")
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText("F", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
  await expect(page.getByRole("button", { name: /^Sofia,/ })).toBeVisible()
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
}

async function addVolunteer(
  page: Page,
  name: string,
  role: "ADV" | "IS" | "CT",
) {
  await page.getByRole("button", { name: "Aggiungi volontario" }).click()
  const nameField = page.getByLabel("Nome completo")
  await expect(nameField).toHaveValue("")
  await nameField.fill(name)
  await page.getByText(role, { exact: true }).click()
  await page.getByRole("button", { name: "Salva volontario" }).click()
  await expect(
    page.getByRole("button", { name: `${name}, ruolo ${role}` }),
  ).toBeVisible()
}

test("adds, edits and reloads every volunteer role across staff-only surfaces", async ({
  page,
}, testInfo) => {
  await createCourse(page)
  await addStudent(page)
  await page.getByRole("button", { name: "Volontari" }).click()

  await expect(
    page.getByRole("heading", { name: "Nessun volontario" }),
  ).toBeVisible()
  await addVolunteer(page, "Anna ADV", "ADV")
  await addVolunteer(page, "Irene IS", "IS")
  await addVolunteer(page, "Carlo CT", "CT")

  await page.getByRole("button", { name: "Carlo CT, ruolo CT" }).click()
  await page.getByLabel("Nome completo").fill("Carlo Capo Turno")
  await page.getByRole("button", { name: "Salva volontario" }).click()
  await expect(
    page.getByRole("button", { name: "Carlo Capo Turno, ruolo CT" }),
  ).toBeVisible()

  await page.reload()
  await page.getByRole("button", { name: "Volontari" }).click()
  await expect(
    page.getByRole("button", { name: "Anna ADV, ruolo ADV" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Irene IS, ruolo IS" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Carlo Capo Turno, ruolo CT" }),
  ).toBeVisible()
  if (testInfo.project.name === "pixel-7-chrome") {
    const evidenceDirectory = path.resolve(".evidence/U07")
    await mkdir(evidenceDirectory, { recursive: true })
    await page.screenshot({
      path: path.join(evidenceDirectory, "u07-volunteer-list-pixel-7.png"),
      fullPage: true,
    })
  }

  await page.getByRole("button", { name: "Indietro da Volontari" }).click()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await page.getByRole("spinbutton").fill("2")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()

  const volunteerPool = page.getByRole("region", {
    name: "Volontari disponibili",
  })
  await expect(volunteerPool).toBeVisible()
  await expect(
    volunteerPool.getByRole("button", { name: "Anna ADV" }),
  ).toBeVisible()
  await expect(
    volunteerPool.getByRole("button", { name: "Irene IS" }),
  ).toBeVisible()
  await expect(
    volunteerPool.getByRole("button", { name: "Carlo Capo Turno" }),
  ).toBeVisible()

  await volunteerPool.getByRole("button", { name: "Carlo Capo Turno" }).click()
  await page
    .getByRole("button", { name: "Sposta Carlo Capo Turno in equipaggio 1" })
    .click()
  await expect(page.getByText("Allievi sistemati 0/1")).toBeVisible()
  await expect(
    volunteerPool.getByRole("button", { name: "Carlo Capo Turno" }),
  ).not.toBeVisible()
  await expect(
    page.getByRole("button", {
      name: "Carlo Capo Turno, equipaggio 1",
    }),
  ).toBeVisible()
  if (testInfo.project.name === "pixel-7-chrome") {
    const evidenceDirectory = path.resolve(".evidence/U07")
    await page.screenshot({
      path: path.join(evidenceDirectory, "u07-crew-ct-pixel-7.png"),
      fullPage: true,
    })
  }

  const studentPool = page.getByRole("region", { name: "Allievi disponibili" })
  await studentPool.getByRole("button", { name: "Sofia" }).click()
  await page
    .getByRole("button", { name: "Sposta Sofia in equipaggio 2" })
    .click()
  await expect(page.getByText("Allievi sistemati 1/1")).toBeVisible()

  await page.getByRole("button", { name: "Indietro da Equipaggi" }).click()
  await page.getByRole("button", { name: "Comandate" }).click()
  await page.getByRole("button", { name: "Proponi comandate" }).click()
  await page.getByRole("button", { name: "Conferma proposta" }).click()
  await expect(page.getByText("Sofia", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Carlo Capo Turno", { exact: true })).toHaveCount(
    0,
  )

  await page.getByRole("button", { name: "Indietro da Comandate" }).click()
  await page.getByRole("button", { name: "Valutazioni" }).click()
  await expect(
    page.getByRole("group", { name: "Valutazione di Sofia" }),
  ).toBeVisible()
  await expect(page.getByText("Carlo Capo Turno", { exact: true })).toHaveCount(
    0,
  )

  if (testInfo.project.name === "pixel-7-chrome") {
    const evidenceDirectory = path.resolve(".evidence/U07")
    await mkdir(evidenceDirectory, { recursive: true })
    await page.screenshot({
      path: path.join(evidenceDirectory, "u07-staff-surfaces-pixel-7.png"),
      fullPage: true,
    })
  }

  await page.reload()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await expect(
    page.getByRole("button", {
      name: "Carlo Capo Turno, equipaggio 1",
    }),
  ).toBeVisible()
  await expect(
    page
      .getByRole("region", { name: "Volontari disponibili" })
      .getByRole("button", { name: "Carlo Capo Turno" }),
  ).not.toBeVisible()
})

test("keeps the direct volunteer form usable at 320px and 200% text", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 664 })
  await createCourse(page)
  await page.getByRole("button", { name: "Volontari" }).click()
  await page.getByRole("button", { name: "Aggiungi volontario" }).click()
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })

  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(viewport!.width)

  const heading = page.getByRole("heading", { name: "Nuovo volontario" })
  await expect(heading).toBeVisible()
  expect(
    await heading.evaluate(
      (element) =>
        element.scrollWidth <= element.clientWidth &&
        element.scrollHeight <= element.clientHeight,
    ),
  ).toBe(true)
  await expect(page.getByLabel("Nome completo")).toHaveValue("")
  const roleGroup = page.getByRole("group", { name: "Ruolo" })
  for (const role of ["ADV", "IS", "CT"]) {
    const choice = roleGroup.getByText(role, { exact: true })
    await expect(choice).toBeVisible()
    const labelBox = await choice.boundingBox()
    expect(labelBox).not.toBeNull()
    expect(labelBox!.x).toBeGreaterThanOrEqual(0)
    expect(labelBox!.x + labelBox!.width).toBeLessThanOrEqual(viewport!.width)
    expect(
      await choice.evaluate(
        (element) =>
          element.scrollWidth <= element.clientWidth &&
          element.scrollHeight <= element.clientHeight,
      ),
    ).toBe(true)
  }

  const save = page.getByRole("button", { name: "Salva volontario" })
  await save.evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "auto" }),
  )
  const saveBox = await save.boundingBox()
  const navigationBox = await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .boundingBox()
  expect(saveBox).not.toBeNull()
  expect(navigationBox).not.toBeNull()
  expect(saveBox!.y).toBeGreaterThanOrEqual(0)
  expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(navigationBox!.y)
  expect(
    await save.evaluate(
      (element) =>
        element.scrollWidth <= element.clientWidth &&
        element.scrollHeight <= element.clientHeight,
    ),
  ).toBe(true)

  if (testInfo.project.name === "pixel-7-chrome") {
    const evidenceDirectory = path.resolve(".evidence/U07")
    await mkdir(evidenceDirectory, { recursive: true })
    await page.screenshot({
      path: path.join(evidenceDirectory, "u07-volunteer-stress-pixel-7.png"),
    })
  }
})
