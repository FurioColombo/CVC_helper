import { mkdirSync } from "node:fs"
import path from "node:path"

import { expect, type Page, test } from "@playwright/test"

async function addStudent(page: Page, firstName: string, surname: string) {
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill(firstName)
  await page.getByLabel("Cognome", { exact: true }).fill(surname)
  await page.getByLabel(/^Data di nascita/).fill("2000-01-01")
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText("M", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
}

async function placeInCrew(page: Page, name: string) {
  const pool = page.getByRole("region", { name: "Allievi disponibili" })
  await pool.getByRole("button", { name }).click()
  await page
    .getByRole("button", { name: `Sposta ${name} in equipaggio 1` })
    .click()
}

test("evaluates one session by student and crew, including A terra and past edits", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000)
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()

  await page.getByRole("button", { name: "Allievi" }).click()
  await addStudent(page, "Aldo", "Rossi")
  await addStudent(page, "Bea", "Verdi")
  await addStudent(page, "Carlo", "Neri")
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()

  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await page.getByRole("spinbutton").fill("1")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()
  await placeInCrew(page, "Aldo")
  await placeInCrew(page, "Bea")
  const pool = page.getByRole("region", { name: "Allievi disponibili" })
  await pool.getByRole("button", { name: "Carlo" }).click()
  await page.getByRole("button", { name: "Sposta Carlo A terra" }).click()
  await expect(page.getByText("Allievi sistemati 3/3")).toBeVisible()

  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Home", exact: true })
    .click()
  await page.getByRole("button", { name: "Valutazioni" }).click()
  await page
    .getByRole("button", { name: /Aggiungi nota valutazione di Aldo/ })
    .waitFor()
  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")

  await page.getByRole("button", { name: "Valutazione di Aldo: ++" }).click()
  await expect(
    page.getByLabel("Stato salvataggio valutazione di Aldo"),
  ).toHaveText("Salvato")
  await page.getByRole("button", { name: "Valutazione di Bea: =" }).click()
  await expect(
    page.getByLabel("Stato salvataggio valutazione di Bea"),
  ).toHaveText("Salvato")
  await expect(
    page.getByText("Valutazione mancante: resta comunque valutabile."),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Valutazione di Carlo: -", exact: true })
    .click()
  await expect(
    page.getByLabel("Stato salvataggio valutazione di Carlo"),
  ).toHaveText("Salvato")

  await page
    .getByRole("button", { name: "Aggiungi nota valutazione di Aldo" })
    .click()
  await page
    .getByRole("textbox", { name: "Nota valutazione di Aldo" })
    .fill("Ottima conduzione")
  await page.getByRole("button", { name: "Salva nota" }).click()
  await expect(
    page.getByRole("button", { name: "Modifica nota valutazione di Aldo" }),
  ).toBeVisible()

  await page
    .getByRole("group", { name: "Vista valutazioni" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  const crew = page.getByRole("region", { name: "Equipaggio 1" })
  await expect(
    crew.getByRole("button", { name: "Valutazione di Aldo: ++" }),
  ).toHaveAttribute("aria-pressed", "true")
  const land = page.getByRole("region", { name: "A terra" })
  await expect(
    land.getByRole("button", {
      name: "Valutazione di Carlo: -",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true")

  await page.getByLabel("Sessione valutazioni").selectOption("sun-am")
  await page.getByRole("button", { name: "Valutazione di Bea: --" }).click()
  await expect(
    page.getByLabel("Stato salvataggio valutazione di Bea"),
  ).toHaveText("Salvato")
  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")
  await expect(
    page.getByRole("button", { name: "Valutazione di Bea: =" }),
  ).toHaveAttribute("aria-pressed", "true")
  await page
    .getByRole("button", { name: "Valutazione di Bea: +", exact: true })
    .click()
  await expect(
    page.getByLabel("Stato salvataggio valutazione di Bea"),
  ).toHaveText("Salvato")

  await page.reload()
  await page.getByRole("button", { name: "Valutazioni" }).click()
  await page
    .getByRole("button", {
      name: /(?:Aggiungi|Modifica) nota valutazione di Aldo/,
    })
    .waitFor()
  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")
  await expect(
    page.getByRole("button", { name: "Valutazione di Aldo: ++" }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    page.getByRole("button", {
      name: "Valutazione di Bea: +",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    page.getByRole("button", { name: "Modifica nota valutazione di Aldo" }),
  ).toBeVisible()
  await page.getByLabel("Sessione valutazioni").selectOption("sun-am")
  await expect(
    page.getByRole("button", { name: "Valutazione di Bea: --" }),
  ).toHaveAttribute("aria-pressed", "true")
  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")
  await page
    .getByRole("group", { name: "Vista valutazioni" })
    .getByRole("button", { name: "Equipaggi" })
    .click()

  if (testInfo.project.name === "iphone-13-viewport") {
    const evidenceDirectory = path.join(process.cwd(), ".evidence", "M12")
    mkdirSync(evidenceDirectory, { recursive: true })
    await page.screenshot({
      path: path.join(evidenceDirectory, "evaluations-iphone13.png"),
      fullPage: true,
    })
  }
})
