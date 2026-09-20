import { mkdirSync } from "node:fs"
import path from "node:path"

import { expect, type Page, test } from "@playwright/test"

/**
 * The number of crews is chosen before composing, and until now it could not
 * be changed afterwards: a volunteer who does not sail left an empty crew
 * behind for the rest of the session. An empty crew can now be removed from
 * its own card, and a crew can be added back without leaving the workspace.
 */

async function addStudent(page: Page, firstName: string, surname: string) {
  await page.getByRole("button", { name: "Aggiungi allievo" }).first().click()
  await page.getByLabel("Nome", { exact: true }).fill(firstName)
  await page.getByLabel("Cognome", { exact: true }).fill(surname)
  await page.getByLabel(/^Data di nascita/).fill("2000-01-01")
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText("M", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
}

test("removes an empty crew from its card and adds one back", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000)

  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await addStudent(page, "Aldo", "Rossi")
  await addStudent(page, "Bea", "Verdi")
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await page.getByRole("spinbutton").fill("2")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()

  const crews = page.getByRole("region", { name: "Equipaggi della sessione" })
  await expect(crews.getByRole("heading")).toHaveCount(2)

  // A crew holding someone offers no delete control.
  const pool = page.getByRole("region", { name: "Allievi disponibili" })
  await pool.getByRole("button", { name: "Aldo", exact: true }).click()
  await page
    .getByRole("button", { name: /Sposta Aldo in equipaggio 1/ })
    .click()
  await expect(
    page.getByRole("button", { name: "Elimina equipaggio 1" }),
  ).toHaveCount(0)

  // The empty one does, and removing it renumbers what is left.
  await page.getByRole("button", { name: "Elimina equipaggio 2" }).click()
  await expect(crews.getByRole("heading")).toHaveCount(1)
  await expect(
    page.getByRole("heading", { name: "Equipaggio 1" }),
  ).toBeVisible()

  // It survives a reload, so the change is persisted and not just local state.
  await page.reload()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await expect(
    page
      .getByRole("region", { name: "Equipaggi della sessione" })
      .getByRole("heading"),
  ).toHaveCount(1)

  // And a crew can be added back without returning to the setup screen.
  await page.getByRole("button", { name: "Aggiungi equipaggio" }).click()
  await expect(
    page
      .getByRole("region", { name: "Equipaggi della sessione" })
      .getByRole("heading"),
  ).toHaveCount(2)
  await expect(
    page.getByRole("button", { name: "Elimina equipaggio 2" }),
  ).toBeVisible()

  if (testInfo.project.name === "pixel-7-chrome") {
    const evidenceDirectory = path.resolve(".evidence/UG1")
    mkdirSync(evidenceDirectory, { recursive: true })
    await page.screenshot({
      path: path.join(evidenceDirectory, "crew-count-controls.png"),
      fullPage: true,
    })
  }
})
