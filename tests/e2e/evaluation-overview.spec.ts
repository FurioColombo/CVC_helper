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

async function waitSaved(page: Page, name: string) {
  await expect(
    page.getByLabel(`Stato salvataggio valutazione di ${name}`),
  ).toHaveText("Salvato")
}

test("summarizes actual marks and links exact evaluation history", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await addStudent(page, "Aldo", "Rossi")
  await addStudent(page, "Bea", "Verdi")
  await addStudent(page, "Carlo", "Neri")
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()

  await page.getByRole("button", { name: "Valutazioni" }).click()
  await page
    .getByRole("button", { name: /Aggiungi nota valutazione di Aldo/ })
    .waitFor()
  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")
  await page
    .getByRole("button", { name: "Valutazione di Aldo: +", exact: true })
    .click()
  await waitSaved(page, "Aldo")
  await page.getByRole("button", { name: "Valutazione di Bea: ++" }).click()
  await waitSaved(page, "Bea")
  await page
    .getByRole("button", { name: "Aggiungi nota valutazione di Bea" })
    .click()
  await page
    .getByRole("textbox", { name: "Nota valutazione di Bea" })
    .fill("Virata molto precisa")
  await page.getByRole("button", { name: "Salva nota" }).click()
  await waitSaved(page, "Bea")

  await page.getByLabel("Sessione valutazioni").selectOption("sun-am")
  await page
    .getByRole("button", { name: "Valutazione di Aldo: +", exact: true })
    .click()
  await waitSaved(page, "Aldo")
  await page.getByRole("button", { name: "Valutazione di Carlo: =" }).click()
  await waitSaved(page, "Carlo")

  await page
    .getByRole("group", { name: "Vista valutazioni" })
    .getByRole("button", { name: "Riepilogo" })
    .click()
  await expect(
    page.getByRole("heading", { name: "Riepilogo del corso" }),
  ).toBeVisible()
  expect(
    await page.getByRole("heading", { level: 3 }).allTextContents(),
  ).toEqual(["Carlo", "Aldo", "Bea"])

  const aldoCard = page.getByRole("article").filter({ hasText: "Aldo" })
  const beaCard = page.getByRole("article").filter({ hasText: "Bea" })
  const carloCard = page.getByRole("article").filter({ hasText: "Carlo" })
  await expect(aldoCard.getByText("2 valutazioni")).toBeVisible()
  await expect(beaCard.getByText("1 valutazione")).toBeVisible()
  await expect(carloCard.getByText("1 valutazione")).toBeVisible()
  await expect(page.getByText("1.5", { exact: true })).toHaveCount(0)

  await page
    .getByRole("button", {
      name: "Bea, Sabato PM: ++, nota presente",
    })
    .click()
  const note = page.getByRole("region", { name: "Nota di Bea" })
  await expect(note.getByText("Sabato PM")).toBeVisible()
  await expect(note.getByText("Virata molto precisa")).toBeVisible()

  await page.getByRole("button", { name: "Valutazione" }).click()
  await expect(
    page.getByRole("button", { name: "Valutazione" }),
  ).toHaveAttribute("aria-pressed", "true")
  expect(
    await page.getByRole("heading", { level: 3 }).allTextContents(),
  ).toEqual(["Bea", "Aldo", "Carlo"])

  await page
    .getByRole("button", { name: "Apri dettaglio di Aldo, cognome Rossi" })
    .click()
  // Exact: once the embedded history has loaded, its "Aldo Rossi" heading
  // also matches a loose /Aldo/, so the loose form is a race.
  await expect(
    page.getByRole("heading", { name: "Aldo", exact: true }),
  ).toBeVisible()
  const history = page.getByRole("region", { name: "Storico valutazioni" })
  const weeklyGrid = history.getByRole("table", {
    name: "Valutazioni settimanali di Aldo",
  })
  await expect(weeklyGrid.getByLabel("Sabato PM: +")).toBeVisible()
  await expect(weeklyGrid.getByLabel("Domenica AM: +")).toBeVisible()

  await page.getByRole("button", { name: "Indietro da Profilo" }).click()
  await expect(
    page.getByRole("heading", { name: "Riepilogo del corso" }),
  ).toBeVisible()
  await expect(
    page
      .getByRole("group", { name: "Vista valutazioni" })
      .getByRole("button", { name: "Riepilogo" }),
  ).toHaveAttribute("aria-pressed", "true")

  await page.getByRole("button", { name: "Indietro da Valutazioni" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await page.getByRole("button", { name: /^Aldo, 26 anni/ }).click()
  await expect(
    page.getByRole("region", { name: "Storico valutazioni" }),
  ).not.toBeFocused()

  if (testInfo.project.name === "iphone-13-viewport") {
    const evidenceDirectory = path.join(process.cwd(), ".evidence", "M13")
    mkdirSync(evidenceDirectory, { recursive: true })
    await page.screenshot({
      path: path.join(evidenceDirectory, "evaluation-overview-iphone13.png"),
      fullPage: true,
    })
  }
})
