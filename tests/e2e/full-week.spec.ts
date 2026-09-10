import { mkdirSync } from "node:fs"
import path from "node:path"

import { expect, type BrowserContext, type Page, test } from "@playwright/test"

import { SESSION_SEQUENCE } from "../../src/domain/config"
import { formatCourseIdentity, getIsoWeekInfo } from "../../src/domain/course"
import { buildD2FullWeekScenario } from "../../src/domain/scenarios"

const scenario = buildD2FullWeekScenario()
const duplicateNames = new Set(
  scenario.students
    .map(({ firstName }) => firstName)
    .filter(
      (name, index, names) =>
        names.indexOf(name) !== index || names.lastIndexOf(name) !== index,
    ),
)

function displayName(student: (typeof scenario.students)[number]) {
  return duplicateNames.has(student.firstName)
    ? `${student.firstName} ${student.surname[0]}.`
    : student.firstName
}

async function addStudent(
  page: Page,
  student: (typeof scenario.students)[number],
) {
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill(student.firstName)
  await page.getByLabel("Cognome", { exact: true }).fill(student.surname)
  await page.getByLabel(/^Data di nascita/).fill(student.dateOfBirth)
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText(student.sex === "female" ? "F" : "M", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
}

async function addVolunteer(
  page: Page,
  name: string,
  role: "ADV" | "IS" | "CT",
) {
  await page.getByRole("button", { name: "Aggiungi volontario" }).click()
  await page.getByLabel("Nome completo").fill(name)
  if (role !== "ADV") {
    await page
      .getByRole("group", { name: "Ruolo" })
      .getByText(role, { exact: true })
      .click()
  }
  await page.getByRole("button", { name: "Salva volontario" }).click()
  await expect(
    page.getByRole("button", { name: `${name}, ruolo ${role}` }),
  ).toBeVisible()
}

async function placeStudent(page: Page, name: string, crewNumber: number) {
  const pool = page.getByRole("region", { name: "Allievi disponibili" })
  await pool.getByRole("button", { name, exact: true }).click()
  await page
    .getByRole("button", {
      name: `Sposta ${name} in equipaggio ${crewNumber}`,
      exact: true,
    })
    .click()
}

async function moveAvailableStudentsToLand(page: Page) {
  const pool = page.getByRole("region", { name: "Allievi disponibili" })
  const poolHeading = page.getByRole("heading", {
    name: /^Allievi disponibili · \d+$/,
  })
  const poolCount = Number((await poolHeading.textContent())?.split("·")[1])
  for (let remaining = poolCount; remaining > 0; remaining -= 1) {
    const person = pool.locator("button:not([disabled])").first()
    await expect(person).toBeVisible()
    const name = await person.getAttribute("aria-label")
    expect(name).toBeTruthy()
    await person.click()
    const moveToLand = page.getByRole("button", {
      name: `Sposta ${name} A terra`,
    })
    await expect(moveToLand).toBeEnabled()
    await moveToLand.click()
    await expect(poolHeading).toHaveText(
      `Allievi disponibili · ${remaining - 1}`,
    )
  }
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
  await page.getByRole("button", { name: "Chiudi destinazioni" }).click()
}

async function copyPreviousCrews(page: Page, previousLabel: string) {
  const copyButton = page.getByRole("button", {
    name: `Copia equipaggi da ${previousLabel}`,
  })
  await copyButton.click()
  await expect(copyButton).toBeEnabled()
  const report = page.getByRole("dialog", { name: "Equipaggi copiati" })
  if (await report.isVisible()) {
    await report.getByRole("button", { name: "Ho capito" }).click()
  }
}

async function setStudentAvailability(
  page: Page,
  name: string,
  available: boolean,
) {
  const primaryNav = page.getByRole("navigation", {
    name: "Navigazione principale",
  })
  await primaryNav.getByRole("button", { name: "Home", exact: true }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await page
    .getByRole("button", { name: new RegExp(`^${name.replace(".", "\\.")},`) })
    .click()
  const lifecycle = page.getByRole("button", {
    name: "Disponibilità ed eliminazione",
  })
  await lifecycle.evaluate((element) =>
    element.scrollIntoView({ block: "center" }),
  )
  await lifecycle.click()
  const availabilityButton = page.getByRole("button", {
    name: available ? "Riattiva allievo" : "Disabilita allievo",
  })
  await availabilityButton.evaluate((element) =>
    element.scrollIntoView({ block: "center" }),
  )
  await availabilityButton.click()
  await expect(
    page.getByRole("button", {
      name: available ? "Disabilita allievo" : "Riattiva allievo",
    }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Indietro da Profilo" }).click()
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await primaryNav.getByRole("button", { name: "Equipaggi" }).click()
}

async function reopenPage(context: BrowserContext, page: Page) {
  await page.close()
  const reopened = await context.newPage()
  await reopened.goto("/")
  const visibleCourseIdentity = formatCourseIdentity({
    ...scenario.course,
    ...getIsoWeekInfo(new Date(`${scenario.course.startDate}T12:00:00Z`)),
  })
  await expect(
    reopened.getByRole("heading", { name: visibleCourseIdentity }),
  ).toBeVisible()
  return reopened
}

test("runs one deterministic D2 course through a complete sailing week", async ({
  context,
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "The full-week baseline runs once; the shared flows have separate iPhone coverage.",
  )
  test.setTimeout(600_000)
  context.setDefaultTimeout(30_000)
  let app = page

  await app.clock.setFixedTime(new Date("2026-08-26T12:00:00.000Z"))
  await app.goto("/")
  await app.getByRole("button", { name: "Deriva" }).click()
  await app.getByRole("button", { name: "Livello 2" }).click()
  await app.getByRole("button", { name: "Crea corso" }).click()

  await app.getByRole("button", { name: "Allievi" }).click()
  for (const student of scenario.students) await addStudent(app, student)
  await expect(app.getByRole("button", { name: /^Aldo C\.,/ })).toBeVisible()
  await expect(
    app.getByRole("button", { name: /^Aldo R\.,.*Minorenne/ }),
  ).toBeVisible()
  await expect(
    app.getByRole("button", { name: /^Marta,.*Minorenne/ }),
  ).toBeVisible()

  await app.getByRole("button", { name: "Menu allievi" }).click()
  await app.getByRole("button", { name: "Conoscenza allievi" }).click()
  for (const student of scenario.students) {
    const name = displayName(student)
    await app
      .getByRole("group", { name: `Taglia di ${name}` })
      .getByRole("button", { name: student.size, exact: true })
      .click()
    await expect(app.getByLabel(`Stato salvataggio ${name}`)).toHaveText(
      "Salvato",
    )
  }
  await app
    .getByRole("button", { name: "Indietro da Conoscenza allievi" })
    .click()
  await app.getByRole("button", { name: "Indietro da Allievi" }).click()

  await app.getByRole("button", { name: "Volontari" }).click()
  for (const volunteer of scenario.volunteers) {
    await addVolunteer(app, volunteer.name!, volunteer.role)
  }
  await app.getByRole("button", { name: "Indietro da Volontari" }).click()

  await app.getByRole("button", { name: "Barche" }).click()
  await app.getByRole("button", { name: "Configura barche" }).click()
  await app.getByLabel("Numeri barca").fill("2, 7, 9, 12")
  await app.getByRole("button", { name: "Configura", exact: true }).click()
  for (const [boatNumber, description] of [
    ["7", "Timone da controllare"],
    ["9", "Scotta randa usurata"],
  ] as const) {
    await app
      .getByRole("button", {
        name: new RegExp(`RS Quest ${boatNumber}, Disponibile`),
      })
      .click()
    await app.getByRole("button", { name: "Segnala", exact: true }).click()
    await app.getByLabel("Descrizione").fill(description)
    await app.getByRole("button", { name: "Salva avaria" }).click()
    await app
      .getByRole("button", { name: `Indietro da RS Quest ${boatNumber}` })
      .click()
  }
  await app.getByRole("button", { name: /RS Quest 12, Disponibile/ }).click()
  await app.getByRole("button", { name: "Rendi indisponibile" }).click()
  await app.getByRole("button", { name: "Home", exact: true }).click()

  await app.getByRole("button", { name: "Comandate" }).click()
  await app.getByRole("button", { name: "Proponi comandate" }).click()
  for (const student of scenario.students.slice(0, 5)) {
    await app.getByText(displayName(student), { exact: true }).click()
  }
  await app.getByRole("button", { name: "Genera" }).click()
  for (const day of [
    "Sabato",
    "Domenica",
    "Lunedì",
    "Martedì",
    "Mercoledì",
    "Giovedì",
    "Venerdì",
  ]) {
    await expect(
      app.getByRole("button", { name: new RegExp(`^${day}, 3 assegnati`) }),
    ).toBeVisible()
  }
  const wednesday = app.getByRole("button", {
    name: /^Mercoledì, 3 assegnati/,
  })
  const assignedWednesday = (
    (await wednesday.locator("span").last().textContent()) ?? ""
  ).split(" · ")
  const replacement = scenario.students
    .map(displayName)
    .find((name) => !assignedWednesday.includes(name))!
  await wednesday.click()
  await app
    .getByRole("button", { name: assignedWednesday[0]!, exact: true })
    .click()
  await app.getByRole("button", { name: replacement, exact: true }).click()
  await app
    .getByRole("button", { name: "Indietro da Comandata mercoledì" })
    .click()
  await expect(wednesday).toContainText(replacement)
  await app.reload()
  await app.getByRole("button", { name: "Comandate" }).click()
  await expect(wednesday).toContainText(replacement)
  await app.getByRole("button", { name: "Indietro da Comandate" }).click()

  const primaryNav = app.getByRole("navigation", {
    name: "Navigazione principale",
  })
  await primaryNav.getByRole("button", { name: "Equipaggi" }).click()
  await app.getByRole("spinbutton").fill("10")
  await app.getByRole("button", { name: "Crea equipaggi" }).click()
  const seaStudents = scenario.students.slice(3, 20)
  for (const [index, student] of seaStudents.slice(0, 16).entries()) {
    await placeStudent(app, displayName(student), Math.floor(index / 2) + 1)
  }
  await placeStudent(app, displayName(seaStudents[16]!), 9)
  await placeStudent(app, displayName(scenario.students[0]!), 10)
  await placeStudent(app, displayName(scenario.students[1]!), 10)
  const staffPool = app.getByRole("region", { name: "Volontari disponibili" })
  await staffPool.getByRole("button", { name: "Anna Bianchi" }).click()
  await app
    .getByRole("button", { name: "Sposta Anna Bianchi in equipaggio 9" })
    .click()
  const studentPool = app.getByRole("region", { name: "Allievi disponibili" })
  for (const student of [scenario.students[2]!, scenario.students[20]!]) {
    const landStudent = displayName(student)
    await studentPool.getByRole("button", { name: landStudent }).click()
    await app
      .getByRole("button", { name: `Sposta ${landStudent} A terra` })
      .click()
  }
  await app.getByRole("button", { name: "RS Quest 2" }).click()
  await app.getByRole("button", { name: "RS Quest 7, avaria aperta" }).click()
  await assignDestination(app, 1, "RS Quest 2")
  await assignDestination(app, 2, "Mezzi")
  await expect(app.getByText("Allievi sistemati 21/21")).toBeVisible()

  for (let index = 1; index < SESSION_SEQUENCE.length; index += 1) {
    const session = SESSION_SEQUENCE[index]!
    const previous = SESSION_SEQUENCE[index - 1]!
    await app
      .getByRole("combobox", { name: "Sessione" })
      .selectOption(session.id)
    await app.getByRole("spinbutton").fill("10")
    await app.getByRole("button", { name: "Crea equipaggi" }).click()
    await copyPreviousCrews(app, `${previous.day} ${previous.period}`)
    await moveAvailableStudentsToLand(app)
    await expect(
      app.getByText(
        session.id === "wed-am" || session.id === "wed-pm"
          ? "Allievi sistemati 20/20"
          : "Allievi sistemati 21/21",
      ),
    ).toBeVisible()

    if (session.id === "tue-pm") {
      await setStudentAvailability(
        app,
        displayName(scenario.students[12]!),
        false,
      )
      await app
        .getByRole("combobox", { name: "Sessione" })
        .selectOption(session.id)
      await expect(app.getByText("Allievi sistemati 20/20")).toBeVisible()
    }
    if (session.id === "wed-am") {
      app = await reopenPage(context, app)
      await app
        .getByRole("navigation", { name: "Navigazione principale" })
        .getByRole("button", { name: "Equipaggi" })
        .click()
      await app
        .getByRole("combobox", { name: "Sessione" })
        .selectOption(session.id)
      await expect(app.getByText("Allievi sistemati 20/20")).toBeVisible()
    }
    if (session.id === "wed-pm") {
      await setStudentAvailability(
        app,
        displayName(scenario.students[12]!),
        true,
      )
      await app
        .getByRole("combobox", { name: "Sessione" })
        .selectOption(session.id)
      await expect(app.getByText("Allievi sistemati 20/21")).toBeVisible()
    }
  }

  await app.getByRole("combobox", { name: "Sessione" }).selectOption("mon-am")
  const repeatedPairWarning = app
    .getByRole("button", { name: /Avvisi equipaggio/ })
    .first()
  await repeatedPairWarning.click()
  await expect(
    app.getByText("Coppia nelle ultime 3 sessioni").first(),
  ).toBeVisible()

  await app
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Home", exact: true })
    .click()
  await app.getByRole("button", { name: "Valutazioni" }).click()
  for (const sessionId of ["sat-pm", "wed-pm", "fri-pm"] as const) {
    await app.getByLabel("Sessione valutazioni").selectOption(sessionId)
    for (const [student, value] of [
      [scenario.students[0]!, "+"],
      [scenario.students[1]!, "++"],
      [scenario.students[2]!, "="],
    ] as const) {
      const name = displayName(student)
      await app
        .getByRole("button", {
          name: `Valutazione di ${name}: ${value}`,
          exact: true,
        })
        .click()
      await expect(
        app.getByLabel(`Stato salvataggio valutazione di ${name}`),
      ).toHaveText("Salvato")
    }
  }
  const notedStudent = displayName(scenario.students[0]!)
  await app.getByLabel("Sessione valutazioni").selectOption("sat-pm")
  await app
    .getByRole("button", {
      name: `Valutazione di ${notedStudent}: ++`,
      exact: true,
    })
    .click()
  await expect(
    app.getByLabel(`Stato salvataggio valutazione di ${notedStudent}`),
  ).toHaveText("Salvato")
  await app
    .getByRole("button", {
      name: `Aggiungi nota valutazione di ${notedStudent}`,
    })
    .click()
  await app
    .getByRole("textbox", { name: `Nota valutazione di ${notedStudent}` })
    .fill("Conduzione sicura e comunicazione chiara")
  await app.getByRole("button", { name: "Salva nota" }).click()
  await expect(
    app.getByLabel(`Stato salvataggio valutazione di ${notedStudent}`),
  ).toHaveText("Salvato")

  app = await reopenPage(context, app)
  await app
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  for (const { id } of SESSION_SEQUENCE) {
    await app.getByRole("combobox", { name: "Sessione" }).selectOption(id)
    await expect(
      app.getByText(
        id === "wed-am" || id === "wed-pm"
          ? "Allievi sistemati 20/21"
          : "Allievi sistemati 21/21",
      ),
    ).toBeVisible()
  }
  await app
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Home", exact: true })
    .click()
  await app.getByRole("button", { name: "Valutazioni" }).click()
  await app
    .getByRole("group", { name: "Vista valutazioni" })
    .getByRole("button", { name: "Riepilogo" })
    .click()
  await expect(
    app
      .getByRole("article")
      .filter({ hasText: notedStudent })
      .getByText("3 valutazioni"),
  ).toBeVisible()
  await app
    .getByRole("button", {
      name: `${notedStudent}, Sabato PM: ++, nota presente`,
    })
    .click()
  await expect(
    app.getByText("Conduzione sicura e comunicazione chiara"),
  ).toBeVisible()
  const notedSequence = app.getByLabel(
    `Sequenza valutazioni di ${notedStudent}`,
  )
  await expect(notedSequence).toBeVisible()
  expect(
    await notedSequence.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true)
  expect(
    await app.evaluate(
      () => document.documentElement.scrollWidth === window.innerWidth,
    ),
  ).toBe(true)

  const evidenceDirectory = path.resolve(".evidence/M15")
  mkdirSync(evidenceDirectory, { recursive: true })
  await app.screenshot({
    fullPage: true,
    path: path.join(evidenceDirectory, "full-week-final.png"),
  })
})
