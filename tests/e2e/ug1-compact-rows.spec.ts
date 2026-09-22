import { mkdirSync } from "node:fs"
import path from "node:path"

import { expect, type Page, test } from "@playwright/test"

/**
 * The 2026-09-20 density pass: the rows that repeat most in the application
 * lost a line each, and the markers the rulebook names — minore, comandata,
 * sesso, ruolo volontario — became badges instead of words competing with the
 * name. Each assertion here is the shape of a row, not its styling, so the
 * screens can keep changing without this spec turning into a pixel diff.
 */

const evidenceDirectory = path.resolve(".evidence/UG1")

async function addStudent(
  page: Page,
  firstName: string,
  surname: string,
  dateOfBirth: string,
  sex: "F" | "M" | "Altro" = "M",
) {
  await page.getByRole("button", { name: "Aggiungi allievo" }).first().click()
  await page.getByLabel("Nome", { exact: true }).fill(firstName)
  await page.getByLabel("Cognome", { exact: true }).fill(surname)
  await page.getByLabel(/^Data di nascita/).fill(dateOfBirth)
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText(sex, { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
}

async function expectNoHorizontalPageScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}

test("keeps the repeated rows compact and their markers legible", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "Row geometry is measured on one project",
  )
  test.setTimeout(180_000)
  mkdirSync(evidenceDirectory, { recursive: true })

  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Barche" }).click()
  await page.getByRole("button", { name: "Configura barche" }).click()
  await page.getByLabel("Numeri barca").fill("2 7")
  await page.getByRole("button", { name: "Configura", exact: true }).click()
  await page.getByRole("button", { name: "Home", exact: true }).click()

  // P03 — a student row is one card high, and the figure carries the sex.
  await page.getByRole("button", { name: "Allievi" }).click()
  await addStudent(page, "Marta", "Alberti", "2010-06-02", "F")
  await addStudent(page, "Aldo", "Rossi", "2000-01-01", "M")
  await addStudent(page, "Remo", "Zeta", "1998-03-04", "Altro")

  const minorCard = page.getByRole("button", {
    name: /^Marta, \d+ anni, F, Minorenne/,
  })
  const minorBox = await minorCard.boundingBox()
  expect(minorBox).not.toBeNull()
  expect(minorBox!.height).toBeLessThanOrEqual(64)
  await expect(minorCard.getByLabel("Minorenne")).toHaveText("M")
  // The row prints no bare sex letter any more: the only "M" is the minor
  // badge, so it cannot be read as the sex or as a size.
  await expect(minorCard.getByText("M", { exact: true })).toHaveCount(1)
  expect(await minorCard.locator("svg").count()).toBeGreaterThan(0)
  await expectNoHorizontalPageScroll(page)
  await page.screenshot({
    path: path.join(evidenceDirectory, "students-compact-rows.png"),
    fullPage: true,
  })

  // P04 — a double click on a profile field opens the form on that field.
  await page.getByRole("button", { name: /^Aldo, \d+ anni, M/ }).click()
  await page.getByText("Età", { exact: true }).dblclick()
  await expect(
    page.getByRole("heading", { name: "Modifica allievo" }),
  ).toBeVisible()
  await expect(page.getByLabel(/^Data di nascita/)).toBeFocused()
  await page.getByRole("button", { name: "Fine" }).click()
  await page.getByRole("button", { name: "Indietro da Profilo" }).click()
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()

  // P10 — the volunteer row names the role instead of one icon for all three.
  await page.getByRole("button", { name: "Volontari" }).click()
  for (const [name, role] of [
    ["Anna Bianchi", "ADV"],
    ["Carlo Verdi", "CT"],
  ] as const) {
    await page
      .getByRole("button", { name: "Aggiungi volontario" })
      .first()
      .click()
    await page.getByLabel("Nome completo").fill(name)
    await page
      .getByRole("group", { name: "Ruolo" })
      .getByText(role, { exact: true })
      .click()
    await page.getByRole("button", { name: "Salva volontario" }).click()
  }
  const volunteerRow = page.getByRole("button", {
    name: "Carlo Verdi, ruolo CT",
  })
  await expect(volunteerRow).toContainText("CT")
  const volunteerBox = await volunteerRow.boundingBox()
  expect(volunteerBox!.height).toBeLessThanOrEqual(64)
  await page.screenshot({
    path: path.join(evidenceDirectory, "volunteers-role-rows.png"),
    fullPage: true,
  })
  await page.getByRole("button", { name: "Indietro da Volontari" }).click()

  // A duty so the crew pool has a comandata to mark.
  await page.getByRole("button", { name: "Comandate" }).click()
  await page.getByRole("button", { name: "Configura manualmente" }).click()
  await page.getByRole("button", { name: /^Sabato, \d+ assegnati/ }).click()
  await page
    .getByRole("region", { name: "Allievi comandata Sabato" })
    .getByRole("button", { name: "Marta", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: /Rimuovi Marta da Sabato/ }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Indietro da Comandata sabato" })
    .click()
  await page.getByRole("button", { name: "Indietro da Comandate" }).click()

  // P14 — crew number, boat and headcount on one row; minore and comandata
  // beside the name they describe.
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await page.getByRole("spinbutton").fill("1")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()

  const pool = page.getByRole("region", { name: "Allievi disponibili" })
  const marta = pool.getByRole("button", { name: "Marta", exact: true })
  await expect(marta.getByLabel("Minorenne")).toHaveText("M")
  await expect(marta.getByLabel("In comandata")).toHaveText("C")
  // The button's name stays the person, so every journey that selects someone
  // by name keeps working; the badges are announced as its description.
  await expect(marta).toHaveAttribute(
    "aria-description",
    "minorenne, in comandata",
  )
  await marta.click()
  await page
    .getByRole("button", { name: /Sposta Marta in equipaggio 1/ })
    .click()

  // The placement is saved asynchronously and the pool loses a row when it
  // lands, which moves everything below it. Wait for the settled card, then
  // measure the three parts in one layout pass: three separate boundingBox
  // calls can straddle a re-render and disagree by the height of a pool row.
  const crewCard = page
    .getByRole("region", { name: "Equipaggi della sessione" })
    .getByRole("article")
    .first()
  await expect(crewCard.getByRole("button", { name: /^Marta,/ })).toBeVisible()
  await expect(pool.getByRole("button", { name: "Marta" })).toHaveCount(0)

  const header = await crewCard.evaluate((card) => {
    const rect = (element: Element | null) => {
      if (!element) return null
      const { x, y, width, height } = element.getBoundingClientRect()
      return { x, y, width, height }
    }
    return {
      destination: rect(card.querySelector('[aria-label^="Destinazione"]')),
      heading: rect(card.querySelector("h2")),
      count: rect(
        [...card.querySelectorAll("span")].find(
          (span) => span.textContent?.trim() === "1/2",
        ) ?? null,
      ),
    }
  })
  expect(header.destination).not.toBeNull()
  expect(header.heading).not.toBeNull()
  expect(header.count).not.toBeNull()
  // Same row: every centre falls inside the destination control's height.
  const rowCentre = header.destination!.y + header.destination!.height / 2
  for (const box of [header.heading!, header.count!]) {
    expect(Math.abs(box.y + box.height / 2 - rowCentre)).toBeLessThanOrEqual(
      header.destination!.height / 2,
    )
  }
  expect(header.heading!.x).toBeLessThan(header.destination!.x)
  expect(header.count!.x).toBeGreaterThan(
    header.destination!.x + header.destination!.width - 1,
  )
  await page.setViewportSize({ width: 320, height: 664 })
  await expectNoHorizontalPageScroll(page)
  await page.screenshot({
    path: path.join(evidenceDirectory, "crew-header-one-row.png"),
    fullPage: true,
  })

  // The header row has to wrap at 200% text rather than push the page sideways.
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await expectNoHorizontalPageScroll(page)
  await page.screenshot({
    path: path.join(evidenceDirectory, "crew-header-one-row-200.png"),
    fullPage: true,
  })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = ""
  })

  // P17 — the note and the save state share the line under the row.
  await page.getByRole("button", { name: "Indietro da Equipaggi" }).click()
  await page.getByRole("button", { name: "Valutazioni" }).click()
  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")
  await page
    .getByRole("button", { name: "Aggiungi nota valutazione di Aldo" })
    .click()
  await page
    .getByRole("textbox", { name: "Nota valutazione di Aldo" })
    .fill("Timone sicuro, bolina da rivedere")
  await page.getByRole("button", { name: "Salva nota" }).click()
  await page
    .getByRole("button", { name: "Valutazione di Aldo: +", exact: true })
    .click()
  const saveState = page.getByLabel("Stato salvataggio valutazione di Aldo")
  await expect(saveState).toHaveText("Salvato")
  const noteBox = await page
    .getByText("Timone sicuro, bolina da rivedere")
    .boundingBox()
  const stateBox = await saveState.boundingBox()
  expect(noteBox).not.toBeNull()
  expect(stateBox).not.toBeNull()
  expect(Math.abs(noteBox!.y - stateBox!.y)).toBeLessThanOrEqual(4)
  expect(stateBox!.x).toBeGreaterThan(noteBox!.x)
  await expectNoHorizontalPageScroll(page)
  await page.screenshot({
    path: path.join(evidenceDirectory, "evaluation-note-and-state-row.png"),
    fullPage: true,
  })

  // The same rows at 200% text, where every one of them has to reflow.
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await expectNoHorizontalPageScroll(page)
  await page.screenshot({
    path: path.join(evidenceDirectory, "evaluation-note-and-state-row-200.png"),
    fullPage: true,
  })
})
