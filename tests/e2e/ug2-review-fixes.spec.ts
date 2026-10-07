import { expect, type Page, test } from "@playwright/test"

/**
 * UG2 review fixes, through the visible app on a real 0.2.0 course: the
 * damaged records the reviews found (a malformed stored birth date, a fault
 * stamped before its creation, a duty for a student who is gone) no longer take
 * Allievi, Equipaggi, Comandate, Avarie or Barche with them; a week whose every
 * day is completed opens and closes; the lists sort accented names with their
 * letter; the manual age form refuses ages a course cannot have; and copying
 * crews keeps a Mezzi crew.
 */

// Matching by pathname keeps this independent of the port the suite runs on.
const isAppRoot = (target: URL) => target.pathname === "/"

async function seedAndOpen(page: Page) {
  await page.route(isAppRoot, async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: `<html><body>Preparing 0.2.0 course<script type="module">
        import { seedV020Fixture } from "/src/test/v020MigrationHarness.ts";
        try {
          await seedV020Fixture("cvc-helper.db");
          document.body.textContent = "0.2.0 course ready";
        } catch (error) {
          document.body.textContent = "0.2.0 seed failed: " + error;
        }
      </script></body></html>`,
    })
  })
  await page.goto("/")
  await expect(page.getByText("0.2.0 course ready")).toBeVisible()
  await page.unroute(isAppRoot)
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "D2 - 38 | 2026" }),
  ).toBeVisible()
}

type Statement = [query: string, params: unknown[]]

/** Writes straight to the app's database, the way damaged data got there. */
async function execute(page: Page, statements: Statement[]) {
  await page.evaluate(async (items) => {
    const modulePath = "/src/persistence/db.ts"
    const { db } = (await import(/* @vite-ignore */ modulePath)) as {
      db: { execute: (query: string, params: unknown[]) => Promise<unknown> }
    }
    for (const [query, params] of items) await db.execute(query, params)
  }, statements)
}

async function select<Row>(page: Page, query: string, params: unknown[] = []) {
  return page.evaluate(
    async ([sql, values]) => {
      const modulePath = "/src/persistence/db.ts"
      const { db } = (await import(/* @vite-ignore */ modulePath)) as {
        db: {
          getAll: (query: string, params: unknown[]) => Promise<unknown[]>
        }
      }
      return db.getAll(sql as string, values as unknown[])
    },
    [query, params],
  ) as Promise<Row[]>
}

const nav = (page: Page) =>
  page.getByRole("navigation", { name: "Navigazione principale" })

async function goHome(page: Page) {
  await nav(page).getByRole("button", { name: "Home", exact: true }).click()
}

/** From Home: the area's card (the bottom navigation has a button of the same name). */
async function openArea(page: Page, name: string) {
  await page
    .getByLabel("Aree del corso")
    .getByRole("button", { name, exact: true })
    .click()
}

const AGE_LABEL = "Età compiuta il primo giorno del corso"
const AGE_MESSAGE = "L’età deve essere tra 4 e 99 anni."
const FAULT_ID = "fault-v020-quest-7-open"

test("opens every area with damaged stored records and repairs them through the app", async ({
  page,
}) => {
  await seedAndOpen(page)
  await execute(page, [
    // One malformed legacy birth date per student, and one with stray spaces.
    [
      "UPDATE students SET dateOfBirth = ? WHERE id = ?",
      ["2000-02-30", "student-v020-tommaso"],
    ],
    [
      "UPDATE students SET dateOfBirth = ? WHERE id = ?",
      ["0002-03-12", "student-v020-elisa"],
    ],
    [
      "UPDATE students SET dateOfBirth = ? WHERE id = ?",
      ["20000-03-12", "student-v020-irene"],
    ],
    [
      "UPDATE students SET dateOfBirth = ? WHERE id = ?",
      ["12/03/2000", "student-v020-davide"],
    ],
    [
      "UPDATE students SET dateOfBirth = ? WHERE id = ?",
      [" 2001-06-08 ", "student-v020-sara"],
    ],
    // A fault the phone clock stepped back on: updated before it was created.
    [
      "UPDATE faults SET createdAt = ?, updatedAt = ? WHERE id = ?",
      ["2099-01-01T00:00:00.000Z", "2098-12-31T23:59:00.000Z", FAULT_ID],
    ],
    // A duty written by a second window for a student deleted meanwhile.
    [
      "INSERT INTO dutyAssignments(id, courseId, dayId, studentId) VALUES (?, ?, ?, ?)",
      ["duty-dangling", "course-v020-d2", "wednesday", "student-v020-deleted"],
    ],
  ])
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "D2 - 38 | 2026" }),
  ).toBeVisible()

  // --- Allievi: every student is listed; the damaged ones say what is missing
  await openArea(page, "Allievi")
  for (const label of [
    /^Tom, età da completare, M$/,
    /^Elisa, età da completare, F$/,
    /^Irene, età da completare, F$/,
    /^Davide, età da completare, M$/,
    // Only stray spaces around a real date: the age is still known.
    /^Sara, 25 anni, F$/,
    /^Paolo, 38 anni, M, Non disponibile$/,
  ]) {
    await expect(page.getByRole("button", { name: label })).toBeVisible()
  }
  await expect(
    page.getByRole("region", { name: "Elenco allievi" }).getByText("Minorenne"),
  ).toHaveCount(0)

  // The edit form is reachable, the age is typed, and the date is replaced.
  await page.getByRole("button", { name: /^Davide,/ }).click()
  await expect(page.getByText("Età da completare")).toBeVisible()
  await page.getByRole("button", { name: "Modifica allievo" }).click()
  const age = page.getByLabel(AGE_LABEL)
  await expect(age).toHaveValue("")
  await age.fill("31")
  await expect(page.getByRole("status")).toHaveText("Salvato")
  await page.getByRole("button", { name: "Fine" }).click()
  await expect(page.getByText("31 anni · dichiarata")).toBeVisible()
  await page.getByRole("button", { name: "Indietro da Profilo" }).click()
  await expect(
    page.getByRole("button", { name: /^Davide, 31 anni, M$/ }),
  ).toBeVisible()
  const [davide] = await select<{
    dateOfBirth: string
    declaredAgeAtCourseStart: number
  }>(
    page,
    "SELECT dateOfBirth, declaredAgeAtCourseStart FROM students WHERE id = ?",
    ["student-v020-davide"],
  )
  expect(davide).toEqual({ dateOfBirth: "", declaredAgeAtCourseStart: 31 })
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()

  // --- Equipaggi: the saved session opens, with its three crews -----------
  await openArea(page, "Equipaggi")
  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sat-pm")
  await expect(
    page
      .getByRole("region", { name: "Equipaggi della sessione" })
      .getByRole("article"),
  ).toHaveCount(3)
  await goHome(page)

  // --- Comandate: opens; the duty of the missing student is not shown, and
  // the first save removes it from the stored plan ---------------------------
  await openArea(page, "Comandate")
  await expect(
    page.getByRole("button", { name: /^Mercoledì, 0 assegnati/ }),
  ).toBeVisible()
  await expect(page.getByText("Allievo mancante")).toHaveCount(0)
  expect(
    await select(page, "SELECT id FROM dutyAssignments WHERE studentId = ?", [
      "student-v020-deleted",
    ]),
  ).toHaveLength(1)
  await page.getByRole("button", { name: /^Giovedì, 0 assegnati/ }).click()
  await page.getByRole("button", { name: "Sara", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Rimuovi Sara da Giovedì" }),
  ).toBeVisible()
  expect(
    await select(page, "SELECT id FROM dutyAssignments WHERE studentId = ?", [
      "student-v020-deleted",
    ]),
  ).toHaveLength(0)
  await page
    .getByRole("button", { name: "Indietro da Comandata giovedì" })
    .click()
  await page.getByRole("button", { name: "Indietro da Comandate" }).click()

  // --- Avarie: opens; editing the fault never stamps it before its creation -
  await nav(page).getByRole("button", { name: "Avarie", exact: true }).click()
  const card = page
    .getByRole("article")
    .filter({ hasText: "Cima della randa consumata" })
  await expect(card).toBeVisible()
  await card.getByRole("button", { name: "Comunicata" }).click()
  await expect(
    card.getByRole("button", { name: "Comunicata" }),
  ).toHaveAttribute("aria-pressed", "true")
  const [fault] = await select<{
    state: string
    createdAt: string
    updatedAt: string
  }>(page, "SELECT state, createdAt, updatedAt FROM faults WHERE id = ?", [
    FAULT_ID,
  ])
  expect(fault!.state).toBe("reported")
  // The clock now is long before the 2099 creation time written above.
  expect(fault!.updatedAt).toBe("2099-01-01T00:00:00.000Z")
  await page.getByRole("button", { name: "Indietro da Avarie" }).click()

  // --- Barche: opens with the boat that carries the fault ------------------
  await openArea(page, "Barche")
  await expect(
    page.getByRole("button", { name: /^RS Quest 7, .*1 avaria/ }),
  ).toBeVisible()
})

test("completes the last duty day with a student still without a duty, and reopens the screen", async ({
  page,
}) => {
  await seedAndOpen(page)
  await execute(page, [
    // Sara has no duty, and every day but Friday is already completed.
    ["DELETE FROM dutyAssignments WHERE id = ?", ["duty-v020-tuesday-sara"]],
    [
      "UPDATE dutySettings SET completedDayIds = ? WHERE id = ?",
      [
        '["saturday","sunday","monday","tuesday","wednesday","thursday"]',
        "course-v020-d2",
      ],
    ],
  ])
  await page.reload()
  await openArea(page, "Comandate")
  await expect(
    page.getByRole("status", { name: "Copertura comandate 4/5" }),
  ).toBeVisible()

  await page.getByRole("button", { name: /^Venerdì, 0 assegnati/ }).click()
  await page.getByRole("button", { name: "Segna completata" }).click()
  await expect(
    page.getByRole("button", { name: "Venerdì, 0 assegnati, completata" }),
  ).toBeVisible()
  await expect(page.getByRole("alert")).toHaveCount(0)

  // Closed and reopened (the app comes back on the same screen): every day is
  // completed and Sara is still reported.
  await page.reload()
  await expect(
    page.getByRole("heading", { name: "Comandate non disponibili" }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("status", { name: "Copertura comandate 4/5" }),
  ).toBeVisible()
  await page.getByRole("button", { name: /^Avvisi/ }).click()
  await expect(page.getByText("Sara Fontana non assegnato")).toBeVisible()
  await page.getByRole("button", { name: /^Indietro da/ }).click()

  // Ricalcola has nothing left to distribute, and says so.
  await page.getByRole("button", { name: "Ricalcola" }).click()
  await expect(
    page.getByText(
      "Tutte le comandate sono completate: non resta niente da distribuire.",
    ),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Conferma proposta" }),
  ).toBeDisabled()
})

test("sorts accented surnames and volunteer names with their base letter", async ({
  page,
}) => {
  await seedAndOpen(page)
  const student = (
    id: string,
    firstName: string,
    surname: string,
  ): Statement => [
    `INSERT INTO students(id, courseId, firstName, surname, nickname, dateOfBirth,
       declaredAgeAtCourseStart, sex, phone, size, initialNote, courseNote, active)
     VALUES (?, 'course-v020-d2', ?, ?, NULL, '', 27, 'male', NULL, NULL, NULL, NULL, 1)`,
    [id, firstName, surname],
  ]
  await execute(page, [
    student("student-accent-1", "José", "Álvarez"),
    student("student-accent-2", "Lars", "Östergaard"),
    student("student-accent-3", "Ivan", "Šimunić"),
    [
      "INSERT INTO volunteers(id, courseId, name, role) VALUES (?, ?, ?, ?)",
      ["volunteer-accent", "course-v020-d2", "Élodie CT", "CT"],
    ],
  ])
  await page.reload()

  await openArea(page, "Allievi")
  const studentButtons = page
    .getByRole("region", { name: "Elenco allievi" })
    .getByRole("button")
  await expect(studentButtons).toHaveCount(9)
  const labels = await studentButtons.evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("aria-label")!.split(",")[0]),
  )
  // Álvarez, Ferri, Fontana, Gallo, Marchetti, Östergaard, Sartori, Šimunić,
  // and the disabled Conti last.
  expect(labels).toEqual([
    "José",
    "Tom",
    "Sara",
    "Irene",
    "Elisa",
    "Lars",
    "Davide",
    "Ivan",
    "Paolo",
  ])
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()

  await openArea(page, "Volontari")
  const volunteerButtons = page
    .getByRole("region", { name: "Elenco volontari" })
    .getByRole("button")
  await expect(volunteerButtons).toHaveCount(4)
  const volunteers = await volunteerButtons.evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("aria-label")),
  )
  expect(volunteers).toEqual([
    "Alba ADV, ruolo ADV",
    "Élodie CT, ruolo CT",
    "Nico CT, ruolo CT",
    "Ugo IS, ruolo IS",
  ])
})

test("refuses ages a course cannot have in the manual and the edit form", async ({
  page,
}) => {
  await seedAndOpen(page)
  await openArea(page, "Allievi")

  await page.getByRole("button", { name: "Aggiungi allievo" }).first().click()
  await page.getByLabel("Nome", { exact: true }).fill("Marta")
  await page.getByLabel("Cognome", { exact: true }).fill("Nuvola")
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText("F", { exact: true })
    .click()
  for (const refused of ["0", "3", "100", "120"]) {
    await page.getByLabel(AGE_LABEL).fill(refused)
    await expect(page.getByText(AGE_MESSAGE)).toBeVisible()
    await page.getByRole("button", { name: "Salva allievo" }).click()
    await expect(
      page.getByRole("heading", { name: "Nuovo allievo" }),
    ).toBeVisible()
  }
  await page.getByLabel(AGE_LABEL).fill("4")
  await expect(page.getByText(AGE_MESSAGE)).toHaveCount(0)
  await page.getByRole("button", { name: "Salva allievo" }).click()
  await expect(
    page.getByRole("button", { name: /^Marta, 4 anni, F, Minorenne$/ }),
  ).toBeVisible()
  expect(
    await select(page, "SELECT id FROM students WHERE surname = ?", ["Nuvola"]),
  ).toHaveLength(1)

  // The edit form holds an implausible age back and keeps the stored date.
  await page.getByRole("button", { name: /^Sara,/ }).click()
  await page.getByRole("button", { name: "Modifica allievo" }).click()
  await page.getByLabel(AGE_LABEL).fill("3")
  await expect(page.getByText(AGE_MESSAGE)).toBeVisible()
  await expect(page.getByText("Non salvato: completa età.")).toBeVisible()
  await page.waitForTimeout(900)
  const [sara] = await select<{
    dateOfBirth: string
    declaredAgeAtCourseStart: number | null
  }>(
    page,
    "SELECT dateOfBirth, declaredAgeAtCourseStart FROM students WHERE id = ?",
    ["student-v020-sara"],
  )
  expect(sara).toEqual({
    dateOfBirth: "2001-06-08",
    declaredAgeAtCourseStart: null,
  })
  await page.getByLabel(AGE_LABEL).fill("26")
  await expect(page.getByRole("status")).toHaveText("Salvato")
})

test("keeps a Mezzi crew when the previous session's crews are copied", async ({
  page,
}) => {
  await seedAndOpen(page)
  await openArea(page, "Equipaggi")
  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sat-pm")
  // Saturday PM: crew 2 is the Mezzi crew.
  await expect(
    page.getByRole("button", { name: "Destinazione equipaggio 2: Mezzi" }),
  ).toBeVisible()

  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sun-am")
  await page
    .getByRole("button", { name: "Copia equipaggi da Sabato PM" })
    .click()
  await page.getByRole("button", { name: "Sostituisci" }).click()
  await page
    .getByRole("dialog", { name: "Equipaggi copiati" })
    .getByRole("button", { name: "Ho capito" })
    .click()

  await expect(
    page.getByRole("button", { name: "Destinazione equipaggio 2: Mezzi" }),
  ).toBeVisible()
  // A crew that was on a boat does not keep the boat for the new session.
  await expect(
    page.getByRole("button", {
      name: "Destinazione equipaggio 1: Non assegnato",
    }),
  ).toBeVisible()

  // The reload brings the app back on Equipaggi.
  await page.reload()
  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sun-am")
  await expect(
    page.getByRole("button", { name: "Destinazione equipaggio 2: Mezzi" }),
  ).toBeVisible()
})
