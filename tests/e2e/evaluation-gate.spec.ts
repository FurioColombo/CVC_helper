import { mkdirSync } from "node:fs"
import path from "node:path"

import { expect, type Page, test } from "@playwright/test"

const STUDENTS = [
  { firstName: "Aldo", surname: "Rossi", female: false },
  { firstName: "Bea", surname: "Verdi", female: true },
  { firstName: "Carlo", surname: "Neri", female: false },
  { firstName: "Dina", surname: "Blu", female: true },
] as const

async function addStudent(page: Page, student: (typeof STUDENTS)[number]) {
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill(student.firstName)
  await page.getByLabel("Cognome", { exact: true }).fill(student.surname)
  await page.getByLabel(/^Data di nascita/).fill("2000-01-01")
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText(student.female ? "F" : "M", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
}

async function placeStudent(page: Page, name: string, crewNumber: number) {
  const pool = page.getByRole("region", { name: "Allievi disponibili" })
  await pool.getByRole("button", { name }).click()
  await page
    .getByRole("button", {
      name: `Sposta ${name} in equipaggio ${crewNumber}`,
    })
    .click()
}

async function placeOnLand(page: Page, name: string) {
  const pool = page.getByRole("region", { name: "Allievi disponibili" })
  await pool.getByRole("button", { name }).click()
  await page.getByRole("button", { name: `Sposta ${name} A terra` }).click()
}

async function setEvaluation(page: Page, name: string, value: string) {
  await page
    .getByRole("button", {
      name: `Valutazione di ${name}: ${value}`,
      exact: true,
    })
    .click()
  await expect(
    page.getByLabel(`Stato salvataggio valutazione di ${name}`),
  ).toHaveText("Salvato")
}

test("verifies the evaluation workflow across an evolving week", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)

  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()

  await page.getByRole("button", { name: "Allievi" }).click()
  for (const student of STUDENTS) await addStudent(page, student)
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()

  const primaryNav = page.getByRole("navigation", {
    name: "Navigazione principale",
  })
  await primaryNav.getByRole("button", { name: "Equipaggi" }).click()
  await page.getByRole("spinbutton").fill("2")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()
  await placeStudent(page, "Aldo", 1)
  await placeStudent(page, "Bea", 1)
  await placeStudent(page, "Carlo", 2)
  await placeOnLand(page, "Dina")
  await expect(page.getByText("Allievi sistemati 4/4")).toBeVisible()

  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sun-am")
  await page.getByRole("spinbutton").fill("2")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()
  await placeStudent(page, "Aldo", 1)
  await placeStudent(page, "Bea", 1)
  await placeStudent(page, "Dina", 2)
  await placeOnLand(page, "Carlo")
  await expect(page.getByText("Allievi sistemati 4/4")).toBeVisible()

  await primaryNav.getByRole("button", { name: "Home", exact: true }).click()
  await page.getByRole("button", { name: "Valutazioni" }).click()
  await page
    .getByRole("button", { name: /Aggiungi nota valutazione di Aldo/ })
    .waitFor()

  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")
  await setEvaluation(page, "Aldo", "+")
  await setEvaluation(page, "Bea", "++")
  await setEvaluation(page, "Carlo", "=")
  await page
    .getByRole("button", { name: "Aggiungi nota valutazione di Aldo" })
    .click()
  await page
    .getByRole("textbox", { name: "Nota valutazione di Aldo" })
    .fill("Conduzione sicura")
  await page.getByRole("button", { name: "Salva nota" }).click()
  await expect(
    page.getByRole("button", { name: "Modifica nota valutazione di Aldo" }),
  ).toBeVisible()

  await page
    .getByRole("group", { name: "Vista valutazioni" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await expect(
    page
      .getByRole("region", { name: "Equipaggio 1" })
      .getByRole("button", { name: "Valutazione di Aldo: +", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    page.getByRole("region", { name: "A terra" }).getByText("Dina"),
  ).toBeVisible()
  await expect(
    page.getByText("Valutazione mancante: resta comunque valutabile."),
  ).toBeVisible()

  await page.getByLabel("Sessione valutazioni").selectOption("sun-am")
  await page
    .getByRole("group", { name: "Vista valutazioni" })
    .getByRole("button", { name: "Allievi" })
    .click()
  await setEvaluation(page, "Aldo", "+")
  await setEvaluation(page, "Dina", "-")
  await page
    .getByRole("group", { name: "Vista valutazioni" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await expect(
    page.getByRole("region", { name: "A terra" }).getByText("Carlo"),
  ).toBeVisible()
  await expect(
    page.getByText("Valutazione mancante: resta comunque valutabile."),
  ).toBeVisible()
  await setEvaluation(page, "Carlo", "=")
  // A terra is a cue, not an exclusion: the student is evaluated where the
  // crew grouping puts him, and the value holds there. Folded in from
  // evaluations.spec.ts, which this journey otherwise supersedes.
  await expect(
    page
      .getByRole("region", { name: "A terra" })
      .getByRole("button", { name: "Valutazione di Carlo: =", exact: true }),
  ).toHaveAttribute("aria-pressed", "true")

  await page.getByLabel("Sessione valutazioni").selectOption("mon-am")
  await page
    .getByRole("group", { name: "Vista valutazioni" })
    .getByRole("button", { name: "Allievi" })
    .click()
  await setEvaluation(page, "Aldo", "+")
  await setEvaluation(page, "Bea", "++")

  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")
  await setEvaluation(page, "Bea", "+")

  await page.reload()
  await page.getByRole("button", { name: "Valutazioni" }).click()
  await page
    .getByRole("button", {
      name: /(?:Aggiungi|Modifica) nota valutazione di Aldo/,
    })
    .waitFor()
  await page
    .getByRole("group", { name: "Vista valutazioni" })
    .getByRole("button", { name: "Riepilogo" })
    .click()
  await expect(
    page.getByRole("heading", { name: "Riepilogo del corso" }),
  ).toBeVisible()

  expect(
    await page.getByRole("heading", { level: 3 }).allTextContents(),
  ).toEqual(["Dina", "Carlo", "Aldo", "Bea"])
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "Aldo" })
      .getByText("3 valutazioni"),
  ).toBeVisible()
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "Bea" })
      .getByText("2 valutazioni"),
  ).toBeVisible()
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "Carlo" })
      .getByText("2 valutazioni"),
  ).toBeVisible()
  await expect(
    page
      .getByRole("article")
      .filter({ hasText: "Dina" })
      .getByText("1 valutazione"),
  ).toBeVisible()

  await page.getByRole("button", { name: "Valutazione" }).click()
  expect(
    await page.getByRole("heading", { level: 3 }).allTextContents(),
  ).toEqual(["Bea", "Aldo", "Carlo", "Dina"])
  await page
    .getByRole("button", {
      name: "Aldo, Sabato PM: +, nota presente",
    })
    .click()
  const note = page.getByRole("region", { name: "Nota di Aldo" })
  await expect(note.getByText("Sabato PM")).toBeVisible()
  await expect(note.getByText("Conduzione sicura")).toBeVisible()

  await page
    .getByRole("button", { name: "Apri dettaglio di Bea, cognome Verdi" })
    .click()
  const history = page.getByRole("region", { name: "Storico valutazioni" })
  const weeklyGrid = history.getByRole("table", {
    name: "Valutazioni settimanali di Bea",
  })
  await expect(weeklyGrid.getByLabel("Sabato PM: +")).toBeVisible()
  await expect(weeklyGrid.getByLabel("Lunedì AM: ++")).toBeVisible()

  if (testInfo.project.name === "iphone-13-viewport") {
    const screenshotPath = path.resolve(
      "test-results/screenshots/evaluation-gate-iphone13.png",
    )
    mkdirSync(path.dirname(screenshotPath), { recursive: true })
    await page.screenshot({ path: screenshotPath, fullPage: true })
  }
})
