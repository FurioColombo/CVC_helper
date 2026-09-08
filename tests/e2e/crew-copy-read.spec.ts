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

test("adapts previous crews, confirms copied boats, and announces a clean persisted view", async ({
  page,
}, testInfo) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()

  await page.getByRole("button", { name: "Barche" }).click()
  await page.getByRole("button", { name: "Configura barche" }).click()
  await page.getByLabel("Numeri barca").fill("2, 7")
  await page.getByRole("button", { name: "Configura", exact: true }).click()
  await page.getByRole("button", { name: "Home", exact: true }).click()

  await page.getByRole("button", { name: "Allievi" }).click()
  await addStudent(page, "Aldo", "Rossi")
  await addStudent(page, "Bea", "Verdi")
  await addStudent(page, "Carlo", "Neri")
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()

  const primaryNav = page.getByRole("navigation", {
    name: "Navigazione principale",
  })
  await primaryNav.getByRole("button", { name: "Equipaggi" }).click()
  await page.getByRole("spinbutton").fill("2")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()

  const studentPool = page.getByRole("region", {
    name: "Allievi disponibili",
  })
  await studentPool.getByRole("button", { name: "Aldo" }).click()
  await page
    .getByRole("button", { name: "Sposta Aldo in equipaggio 1" })
    .click()
  await studentPool.getByRole("button", { name: "Bea" }).click()
  await page.getByRole("button", { name: "Sposta Bea in equipaggio 1" }).click()
  await studentPool.getByRole("button", { name: "Carlo" }).click()
  await page
    .getByRole("button", { name: "Sposta Carlo in equipaggio 2" })
    .click()
  await page.getByRole("button", { name: "RS Quest 2" }).click()
  await page.getByRole("button", { name: "RS Quest 7" }).click()

  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sun-am")
  await page.getByRole("spinbutton").fill("1")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()
  await studentPool.getByRole("button", { name: "Bea" }).click()
  await page.getByRole("button", { name: "Sposta Bea A terra" }).click()

  await primaryNav.getByRole("button", { name: "Home", exact: true }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await page.getByRole("button", { name: /^Carlo,/ }).click()
  const lifecycle = page.getByRole("button", {
    name: "Disponibilità ed eliminazione",
  })
  await lifecycle.evaluate((element) =>
    element.scrollIntoView({ block: "center" }),
  )
  await lifecycle.click()
  const disableStudent = page.getByRole("button", {
    name: "Disabilita allievo",
  })
  await disableStudent.evaluate((element) =>
    element.scrollIntoView({ block: "center" }),
  )
  await disableStudent.click()
  await page.getByRole("button", { name: "Indietro da Profilo" }).click()
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await primaryNav.getByRole("button", { name: "Equipaggi" }).click()

  await page
    .getByRole("button", { name: "Copia equipaggi da Sabato PM" })
    .click()
  const report = page.getByRole("dialog", { name: "Equipaggi copiati" })
  await expect(report).toContainText("Bea — A terra")
  await expect(report).toContainText("Carlo — non disponibile")
  await expect(report).not.toContainText("Aldo")
  if (testInfo.project.name === "iphone-13-viewport") {
    const reportPath = path.resolve(".evidence/M11/copy-report-iphone13.png")
    mkdirSync(path.dirname(reportPath), { recursive: true })
    await page.screenshot({ path: reportPath })
  }
  await report.getByRole("button", { name: "Ho capito" }).click()

  await page.getByRole("button", { name: "Apri vista lettura" }).click()
  const firstReadView = page.getByRole("dialog", {
    name: "Vista lettura equipaggi",
  })
  await expect(firstReadView.getByText("Aldo", { exact: true })).toBeVisible()
  await expect(firstReadView.getByText("Equipaggio vuoto")).toBeVisible()
  await firstReadView
    .getByRole("button", { name: "Chiudi vista lettura" })
    .click()

  await page.getByRole("button", { name: "Copia barche da Sabato PM" }).click()
  const boatDialog = page.getByRole("dialog", { name: "Barche copiate" })
  await expect(
    boatDialog.getByRole("button", { name: "RS Quest 2 nella copia" }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    boatDialog.getByRole("button", { name: "RS Quest 7 nella copia" }),
  ).toHaveAttribute("aria-pressed", "true")
  await boatDialog.getByRole("button", { name: "Conferma barche" }).click()

  await page
    .getByRole("button", {
      name: "Destinazione equipaggio 1: Non assegnato",
    })
    .click()
  await page
    .getByRole("button", { name: "Assegna equipaggio 1 a RS Quest 2" })
    .click()
  await page.getByRole("button", { name: "Apri vista lettura" }).click()
  const readView = page.getByRole("dialog", {
    name: "Vista lettura equipaggi",
  })
  await expect(readView.getByText("RS Quest 2 — Aldo")).toBeVisible()
  await expect(readView.getByText("RS Quest — Equipaggio vuoto")).toBeVisible()
  await expect(readView).not.toContainText(
    /Allievi sistemati|Barche in uscita|Avvisi/,
  )
  if (testInfo.project.name === "iphone-13-viewport") {
    await page.screenshot({
      path: path.resolve(".evidence/M11/announcement-iphone13.png"),
    })
  }
  await readView.getByRole("button", { name: "Chiudi vista lettura" }).click()

  await page.reload()
  await primaryNav.getByRole("button", { name: "Equipaggi" }).click()
  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sun-am")
  await expect(
    page.getByRole("button", {
      name: "Destinazione equipaggio 1: RS Quest 2",
    }),
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Bea, A terra" })).toBeVisible()
})
