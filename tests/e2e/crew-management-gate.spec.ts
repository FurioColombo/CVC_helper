import { mkdirSync } from "node:fs"
import path from "node:path"

import { expect, type Page, test } from "@playwright/test"

const STUDENTS = [
  { firstName: "Aldo", surname: "Rossi", size: "XS", female: false },
  { firstName: "Bea", surname: "Verdi", size: "S", female: true },
  { firstName: "Carlo", surname: "Neri", size: "M", female: false },
  { firstName: "Dina", surname: "Blu", size: "L", female: true },
  { firstName: "Enzo", surname: "Gialli", size: "XL", female: false },
  { firstName: "Fina", surname: "Bianchi", size: "M", female: true },
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

async function assignDestination(
  page: Page,
  crewNumber: number,
  destination: string,
) {
  await page
    .getByRole("button", {
      name: new RegExp(`^Destinazione equipaggio ${crewNumber}:`),
    })
    .click()
  await page
    .getByRole("button", {
      name:
        destination === "Mezzi"
          ? "Mezzi"
          : `Assegna equipaggio ${crewNumber} a ${destination}`,
    })
    .click()
  await expect(
    page.getByRole("button", {
      name: `Destinazione equipaggio ${crewNumber}: ${destination}`,
    }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Chiudi destinazioni" }).click()
}

test("verifies the complete crew workflow across students, duties and boats", async ({
  page,
}, testInfo) => {
  test.setTimeout(360_000)

  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()

  await page.getByRole("button", { name: "Barche" }).click()
  await page.getByRole("button", { name: "Configura barche" }).click()
  await page.getByLabel("Numeri barca").fill("2, 7, 9")
  await page.getByRole("button", { name: "Configura", exact: true }).click()
  await page.getByRole("button", { name: "RS Quest 7, Disponibile" }).click()
  await page.getByRole("button", { name: "Segnala", exact: true }).click()
  await page.getByLabel("Descrizione").fill("Timone da controllare")
  await page.getByRole("button", { name: "Salva avaria" }).click()
  await page.getByRole("button", { name: "Home", exact: true }).click()

  await page.getByRole("button", { name: "Allievi" }).click()
  for (const student of STUDENTS) await addStudent(page, student)
  await page.getByRole("button", { name: "Menu allievi" }).click()
  await page.getByRole("button", { name: "Conoscenza allievi" }).click()
  for (const student of STUDENTS) {
    await page
      .getByRole("group", { name: `Taglia di ${student.firstName}` })
      .getByRole("button", { name: student.size, exact: true })
      .click()
    await expect(
      page.getByLabel(`Stato salvataggio ${student.firstName}`),
    ).toHaveText("Salvato")
  }
  await page
    .getByRole("button", { name: "Indietro da Conoscenza allievi" })
    .click()
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()

  await page.getByRole("button", { name: "Volontari" }).click()
  await page.getByRole("button", { name: "Aggiungi volontario" }).click()
  await page.getByLabel("Nome completo").fill("Vera ADV")
  await page.getByRole("button", { name: "Salva volontario" }).click()
  await page.getByRole("button", { name: "Indietro da Volontari" }).click()

  await page.getByRole("button", { name: "Comandate" }).click()
  await page.getByRole("button", { name: "Proponi comandate" }).click()
  const confirmProposal = page.getByRole("button", {
    name: "Conferma proposta",
  })
  for (const day of [
    "Sabato",
    "Domenica",
    "Lunedì",
    "Martedì",
    "Mercoledì",
    "Giovedì",
    "Venerdì",
  ]) {
    if (await confirmProposal.isEnabled()) break
    const extraDay = page.getByRole("button", {
      name: `${day} con più persone`,
    })
    if ((await extraDay.getAttribute("aria-pressed")) !== "true")
      await extraDay.click()
  }
  await confirmProposal.click()
  const saturday = page.getByRole("button", { name: /^Sabato,/ })
  await saturday.click()
  for (const student of STUDENTS.filter(
    ({ firstName }) => firstName !== "Carlo",
  )) {
    const remove = page.getByRole("button", {
      name: `Rimuovi ${student.firstName} da Sabato`,
    })
    if (await remove.count()) await remove.click()
  }
  const addCarlo = page.getByRole("button", { name: "Carlo", exact: true })
  if (await addCarlo.count()) await addCarlo.click()
  await page
    .getByRole("button", { name: "Indietro da Comandata sabato" })
    .click()
  await expect(page.getByRole("button", { name: /^Sabato,/ })).toContainText(
    "Carlo",
  )
  await page.getByRole("button", { name: "Indietro da Comandate" }).click()

  const primaryNav = page.getByRole("navigation", {
    name: "Navigazione principale",
  })
  await primaryNav.getByRole("button", { name: "Equipaggi" }).click()
  await page.getByRole("spinbutton").fill("3")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()

  await placeStudent(page, "Aldo", 1)
  await placeStudent(page, "Bea", 1)
  await placeStudent(page, "Carlo", 2)
  await placeStudent(page, "Dina", 2)
  await placeStudent(page, "Enzo", 3)
  const staffPool = page.getByRole("region", { name: "Volontari disponibili" })
  await staffPool.getByRole("button", { name: "Vera ADV" }).click()
  await page
    .getByRole("button", { name: "Sposta Vera ADV in equipaggio 3" })
    .click()
  const studentPool = page.getByRole("region", {
    name: "Allievi disponibili",
  })
  await studentPool.getByRole("button", { name: "Fina" }).click()
  await page.getByRole("button", { name: "Sposta Fina A terra" }).click()
  await expect(page.getByText("Allievi sistemati 6/6")).toBeVisible()

  await page.getByRole("button", { name: "Apri barche della sessione" }).click()
  for (const boatName of ["RS Quest 2", "RS Quest 9"]) {
    await page
      .getByRole("button", { name: new RegExp(`^${boatName} · Disponibile`) })
      .click()
  }
  await page
    .getByRole("button", {
      name: /^RS Quest 7 · Disponibile.*avaria da controllare/,
    })
    .click()
  await page.getByRole("button", { name: "Torna agli equipaggi" }).click()
  await assignDestination(page, 1, "RS Quest 2")
  await assignDestination(page, 2, "Mezzi")
  await assignDestination(page, 3, "RS Quest 7")
  await expect(
    page.getByRole("button", {
      name: "Destinazione equipaggio 3: RS Quest 7",
    }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Avvisi equipaggio 3: giallo/ }),
  ).toBeVisible()

  const sourceWarning = page.getByRole("button", {
    name: /Avvisi equipaggio 1: rosso/,
  })
  await sourceWarning.click()
  await expect(page.getByText(/Taglie (XS \+ S|S \+ XS)/)).toBeVisible()

  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sun-am")
  await page.getByRole("spinbutton").fill("3")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()
  await studentPool.getByRole("button", { name: "Fina" }).click()
  await page.getByRole("button", { name: "Sposta Fina A terra" }).click()
  await page
    .getByRole("button", { name: "Copia equipaggi da Sabato PM" })
    .click()
  const copyReport = page.getByRole("dialog", { name: "Equipaggi copiati" })
  await expect(copyReport).toContainText("Carlo — comandata")
  await copyReport.getByRole("button", { name: "Ho capito" }).click()
  await expect(
    page.getByRole("button", { name: "Aldo, equipaggio 1" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Bea, equipaggio 1" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Vera ADV, equipaggio 3" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Fina, A terra" }),
  ).toBeVisible()
  const carlo = studentPool.getByRole("button", { name: "Carlo" })
  await expect(carlo).toContainText("Allievo · M")
  // The comandata is the badge the rulebook names, and its meaning reaches
  // assistive technology through the description rather than the name.
  await expect(carlo.getByLabel("In comandata")).toHaveText("C")
  await expect(carlo).toHaveAttribute("aria-description", "in comandata")
  await expect(page.getByText("Allievi sistemati 5/6")).toBeVisible()

  const copiedWarning = page.getByRole("button", {
    name: /Avvisi equipaggio 1: rosso, 2/,
  })
  await copiedWarning.click()
  const copiedWarningDetail = page.getByRole("region", {
    name: "Dettaglio avvisi equipaggio 1",
  })
  await expect(
    copiedWarningDetail.getByText("Coppia nelle ultime 3 sessioni"),
  ).toBeVisible()
  await expect(copiedWarningDetail.getByText(/Taglie/)).toBeVisible()

  await page.getByRole("button", { name: "Copia barche da Sabato PM" }).click()
  const copiedBoats = page.getByRole("dialog", { name: "Barche copiate" })
  for (const boatName of ["RS Quest 2", "RS Quest 7", "RS Quest 9"]) {
    await expect(
      copiedBoats.getByRole("button", { name: `${boatName} nella copia` }),
    ).toHaveAttribute("aria-pressed", "true")
  }
  await copiedBoats.getByRole("button", { name: "Conferma barche" }).click()
  await assignDestination(page, 1, "RS Quest 2")
  await assignDestination(page, 2, "Mezzi")
  await assignDestination(page, 3, "RS Quest 7")

  await page.getByRole("button", { name: "Dina, equipaggio 2" }).click()
  await page.getByRole("button", { name: "Enzo, equipaggio 3" }).click()
  await expect(
    page.getByRole("button", { name: "Enzo, equipaggio 2" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Dina, equipaggio 3" }),
  ).toBeVisible()

  await assignDestination(page, 3, "RS Quest 9")
  await expect(
    page.getByRole("button", {
      name: "Destinazione equipaggio 3: RS Quest 9",
    }),
  ).toBeVisible()

  await primaryNav.getByRole("button", { name: "Home", exact: true }).click()
  await page.getByRole("button", { name: "Barche" }).click()
  await page.getByRole("button", { name: "RS Quest 2, Disponibile" }).click()
  await page.getByRole("button", { name: "Rendi indisponibile" }).click()
  await primaryNav.getByRole("button", { name: "Equipaggi" }).click()
  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sun-am")

  const finalWarning = page.getByRole("button", {
    name: /Avvisi equipaggio 1: rosso, 3/,
  })
  await finalWarning.click()
  const finalWarningDetail = page.getByRole("region", {
    name: "Dettaglio avvisi equipaggio 1",
  })
  await expect(
    finalWarningDetail.getByText("Barca non disponibile"),
  ).toBeVisible()
  await expect(
    finalWarningDetail.getByText("Coppia nelle ultime 3 sessioni"),
  ).toBeVisible()
  await expect(
    finalWarningDetail.getByText(/Taglie (XS \+ S|S \+ XS)/),
  ).toBeVisible()

  await page.getByRole("button", { name: "Apri vista lettura" }).click()
  const readView = page.getByRole("dialog", {
    name: "Vista lettura equipaggi",
  })
  const firstRow = readView.getByRole("listitem", {
    name: "Equipaggio 1, RS Quest 2",
  })
  await expect(firstRow.getByText("Aldo")).toBeVisible()
  await expect(firstRow.getByText("Bea")).toBeVisible()
  const secondRow = readView.getByRole("listitem", {
    name: "Equipaggio 2, Mezzi",
  })
  await expect(secondRow.getByText("Enzo")).toBeVisible()
  const thirdRow = readView.getByRole("listitem", {
    name: "Equipaggio 3, RS Quest 9",
  })
  await expect(thirdRow.getByText("Dina")).toBeVisible()
  await expect(thirdRow.getByText("Vera ADV")).toBeVisible()
  await expect(readView).not.toContainText(
    /Allievi sistemati|Barche in uscita|Avvisi|Taglie/,
  )
  if (testInfo.project.name === "iphone-13-viewport") {
    const screenshotPath = path.resolve(".evidence/G4/crew-gate-iphone13.png")
    mkdirSync(path.dirname(screenshotPath), { recursive: true })
    await page.screenshot({ path: screenshotPath })
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
  await expect(
    page.getByRole("button", {
      name: "Destinazione equipaggio 3: RS Quest 9",
    }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Fina, A terra" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Enzo, equipaggio 2" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Dina, equipaggio 3" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Avvisi equipaggio 1: rosso, 3/ }),
  ).toBeVisible()
})
