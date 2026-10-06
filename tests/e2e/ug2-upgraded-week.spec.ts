import { readFileSync } from "node:fs"

import { expect, type Page, test } from "@playwright/test"

import { evidenceOutputPath } from "./evidence"
import { copyAndCheckSummaryImage } from "./summary-image-checks"

/**
 * UG2: a week created by 0.2.0 (birth dates, no declared ages, crews with no
 * stored capacity) is opened by today's app and run through the visible UI:
 * the ages come from the stored birth dates, an edit saves an age only, crews
 * are read in place and new ones are made with a free seat and a volunteer,
 * both summaries are copied as images, evaluations are added, and after the
 * page is closed and reopened every original table, row id and value that was
 * not intentionally edited is compared with the fixture. The 0.1.0 path is
 * `ug1-upgraded-week.spec.ts`; both run on every release.
 */

// Matching by pathname keeps this independent of the port the suite runs on.
const isAppRoot = (target: URL) => target.pathname === "/"

type Rows = Array<Record<string, unknown>>
const fixture = JSON.parse(
  readFileSync(
    new URL("../../src/test/fixtures/v0.2.0-course.json", import.meta.url),
    "utf8",
  ),
) as { tables: Record<string, Rows> }

const TABLES = [
  "courses",
  "students",
  "volunteers",
  "boats",
  "faults",
  "dutyAssignments",
  "dutySettings",
  "crews",
  "crewMembers",
  "landAssignments",
  "sessionBoats",
  "evaluations",
  "meta",
]

async function readDatabase(page: Page) {
  return page.evaluate(async (tables) => {
    const modulePath = "/src/persistence/db.ts"
    const { db } = (await import(/* @vite-ignore */ modulePath)) as {
      db: {
        getAll: (query: string) => Promise<Array<Record<string, unknown>>>
      }
    }
    const snapshot: Record<string, Array<Record<string, unknown>>> = {}
    for (const table of tables) {
      snapshot[table] = await db.getAll(`SELECT * FROM ${table}`)
    }
    return snapshot
  }, TABLES)
}

/** Every fixture row is still there with the same id and value, except the
 *  fields a row is expected to have changed (`changed`, keyed by table:id). */
function expectOriginalRowsRetained(
  database: Record<string, Rows>,
  changed: Record<string, Record<string, unknown>>,
) {
  for (const [table, rows] of Object.entries(fixture.tables)) {
    for (const original of rows) {
      const retained = database[table]?.find(({ id }) => id === original.id)
      expect(
        retained,
        `${table}:${String(original.id)} survives the week and the reopen`,
      ).toBeDefined()
      expect(retained, `${table}:${String(original.id)}`).toMatchObject({
        ...original,
        ...changed[`${table}:${String(original.id)}`],
      })
    }
  }
}

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

const nav = (page: Page) =>
  page.getByRole("navigation", { name: "Navigazione principale" })

async function openCrews(page: Page, sessionId: string) {
  await nav(page).getByRole("button", { name: "Equipaggi" }).click()
  await page.getByRole("combobox", { name: "Sessione" }).selectOption(sessionId)
}

const crewCards = (page: Page) =>
  page
    .getByRole("region", { name: "Equipaggi della sessione" })
    .getByRole("article")
const pool = (page: Page) =>
  page.getByRole("region", { name: "Allievi disponibili" })

async function expectStudentList(page: Page, expected: RegExp[]) {
  for (const label of expected) {
    await expect(page.getByRole("button", { name: label })).toBeVisible()
  }
}

test("opens a 0.2.0 database with the current schema, keeps every column and reopens it with the new columns usable", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("heading", { name: "Crea il corso" }).waitFor()
  const result = await page.evaluate(async () => {
    const modulePath = "/src/test/v020MigrationHarness.ts"
    const harness = (await import(/* @vite-ignore */ modulePath)) as {
      runV020MigrationHarness: () => Promise<{
        fixture: Record<string, Array<Record<string, unknown>>>
        afterUpgrade: Record<string, Array<Record<string, unknown>>>
        afterReopen: Record<string, Array<Record<string, unknown>>>
        ages: Array<{
          id: string
          declaredAgeAtCourseStart: number | null
          age: number
          minor: boolean
        }>
        legacyCapacities: Array<{ id: string; capacity: number | null }>
        ageOnlyStudent: {
          dateOfBirth: string
          declaredAgeAtCourseStart: number | null
        }
        storedCapacity: number | null
      }>
    }
    return harness.runV020MigrationHarness()
  })

  expect(Object.keys(result.afterUpgrade).sort()).toEqual(
    Object.keys(result.fixture).sort(),
  )
  for (const [table, rows] of Object.entries(result.fixture)) {
    expect(result.afterUpgrade[table], `${table} count`).toHaveLength(
      rows.length,
    )
    expect(
      result.afterReopen[table],
      `${table} count after reopen`,
    ).toHaveLength(rows.length)
    for (const original of rows) {
      const upgraded = result.afterUpgrade[table]?.find(
        ({ id }) => id === original.id,
      )
      expect(upgraded, `${table}:${String(original.id)}`).toMatchObject(
        original,
      )
    }
  }

  // The two columns added since 0.2.0 start empty, never invented.
  for (const student of result.afterUpgrade.students!) {
    expect(student.declaredAgeAtCourseStart, String(student.id)).toBeNull()
  }
  expect(result.legacyCapacities.map(({ capacity }) => capacity)).toEqual([
    null,
    null,
    null,
    null,
  ])
  // Ages come from the stored birth dates at the course start.
  expect(
    Object.fromEntries(
      result.ages.map(({ id, age, minor }) => [
        id,
        `${age}${minor ? "m" : ""}`,
      ]),
    ),
  ).toEqual({
    "student-v020-davide": "31",
    "student-v020-elisa": "17m",
    "student-v020-irene": "18",
    "student-v020-paolo": "38",
    "student-v020-sara": "25",
    "student-v020-tommaso": "15m",
  })

  // An age-only student and a stored capacity written after the update
  // survive a reopen; everything else is exactly as seeded.
  expect(result.ageOnlyStudent).toEqual({
    dateOfBirth: "",
    declaredAgeAtCourseStart: 26,
  })
  expect(result.storedCapacity).toBe(2)
  const changed: Record<string, Record<string, unknown>> = {
    "students:student-v020-sara": {
      dateOfBirth: "",
      declaredAgeAtCourseStart: 26,
    },
    "crews:crew-v020-sun-am-1": { capacity: 2 },
  }
  for (const [table, rows] of Object.entries(result.fixture)) {
    for (const original of rows) {
      expect(
        result.afterReopen[table]?.find(({ id }) => id === original.id),
        `${table}:${String(original.id)} after reopen`,
      ).toMatchObject({
        ...original,
        ...changed[`${table}:${String(original.id)}`],
      })
    }
  }
})

test("runs an upgraded 0.2.0 course through the visible week, closes and reopens it, and keeps every original row", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "One full migrated week is sufficient",
  )
  test.setTimeout(900_000)
  context.setDefaultTimeout(30_000)
  await context.grantPermissions(["clipboard-read", "clipboard-write"])

  await seedAndOpen(page)

  // --- Allievi: ages from the stored birth dates at the course start ------
  await page.getByRole("button", { name: "Allievi" }).click()
  await expectStudentList(page, [
    /^Tom, 15 anni, M, Minorenne$/,
    /^Elisa, 17 anni, F, Minorenne$/, // turns 18 on day 4, a minor at the start
    /^Irene, 18 anni, F$/, // turns 18 on the first day: an adult
    /^Davide, 31 anni, M$/,
    /^Sara, 25 anni, F$/,
    /^Paolo, 38 anni, M, Non disponibile$/,
  ])

  // An edit that leaves the age alone keeps the stored birth date.
  await page.getByRole("button", { name: /^Davide,/ }).click()
  await expect(page.getByText("31 anni", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Modifica allievo" }).click()
  await expect(
    page.getByLabel("Età compiuta il primo giorno del corso"),
  ).toHaveValue("31")
  await page.getByLabel("Telefono").fill("+390000000099")
  await expect(page.getByRole("status")).toHaveText("Salvato")
  await page.getByRole("button", { name: "Fine" }).click()
  await page.getByRole("button", { name: "Indietro da Profilo" }).click()

  // An edit that changes the age makes the record age-only.
  await page.getByRole("button", { name: /^Sara,/ }).click()
  await page.getByRole("button", { name: "Modifica allievo" }).click()
  await expect(
    page.getByLabel("Età compiuta il primo giorno del corso"),
  ).toHaveValue("25")
  await page.getByLabel("Età compiuta il primo giorno del corso").fill("26")
  await expect(page.getByRole("status")).toHaveText("Salvato")
  await page.getByRole("button", { name: "Fine" }).click()
  await expect(page.getByText("26 anni · dichiarata")).toBeVisible()
  await page.getByRole("button", { name: "Indietro da Profilo" }).click()
  await expectStudentList(page, [/^Sara, 26 anni, F$/, /^Davide, 31 anni, M$/])

  // A new student is age-only from the start, and a minor.
  await page.getByRole("button", { name: "Aggiungi allievo" }).first().click()
  await page.getByLabel("Nome", { exact: true }).fill("Marta")
  await page.getByLabel("Cognome", { exact: true }).fill("Nuvola")
  await page.getByLabel("Età compiuta il primo giorno del corso").fill("16")
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText("F", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
  await expectStudentList(page, [/^Marta, 16 anni, F, Minorenne$/])
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()

  // --- Equipaggi: existing session read in place --------------------------
  await openCrews(page, "sat-pm")
  const satPm = crewCards(page)
  await expect(satPm).toHaveCount(3)
  await expect(
    satPm.nth(0).getByRole("button", { name: "Tom, equipaggio 1" }),
  ).toBeVisible()
  await expect(
    satPm.nth(0).getByRole("button", { name: "Nico CT, equipaggio 1" }),
  ).toBeVisible()
  await expect(
    satPm.nth(1).getByRole("button", { name: "Elisa, equipaggio 2" }),
  ).toBeVisible()
  // 0.2.0 stored no capacity: D2's fixed pair leaves a free seat.
  await expect(
    satPm.nth(1).getByRole("button", { name: "Posto libero 2 equipaggio 2" }),
  ).toBeVisible()
  await expect(
    satPm.nth(2).getByRole("button", { name: "Davide, equipaggio 3" }),
  ).toBeVisible()
  await expect(
    satPm.nth(2).getByRole("button", { name: "Sara, equipaggio 3" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Irene, A terra" }),
  ).toBeVisible()
  // Marta is new and not placed yet.
  await expect(page.getByText("Allievi sistemati 5/6")).toBeVisible()
  await expect(pool(page).getByRole("button", { name: "Marta" })).toBeVisible()

  // Sunday morning: one 0.2.0 crew, one student A terra, the rest available.
  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sun-am")
  await expect(crewCards(page)).toHaveCount(1)
  await expect(
    crewCards(page).nth(0).getByRole("button", { name: "Irene, equipaggio 1" }),
  ).toBeVisible()
  await expect(
    crewCards(page)
      .nth(0)
      .getByRole("button", { name: "Davide, equipaggio 1" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Elisa, A terra" }),
  ).toBeVisible()
  await expect(page.getByText("Allievi sistemati 3/6")).toBeVisible()
  // A second crew: a student in the first seat, a volunteer in the free one.
  await page.getByRole("button", { name: "Aggiungi equipaggio" }).click()
  await expect(crewCards(page)).toHaveCount(2)
  await page
    .getByRole("button", { name: "Posto libero 1 equipaggio 2" })
    .click()
  await pool(page).getByRole("button", { name: "Tom", exact: true }).click()
  await expect(
    crewCards(page).nth(1).getByRole("button", { name: "Tom, equipaggio 2" }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Posto libero 2 equipaggio 2" })
    .click()
  await page
    .getByRole("region", { name: "Volontari disponibili" })
    .getByRole("button", { name: "Alba ADV" })
    .click()
  await expect(
    crewCards(page)
      .nth(1)
      .getByRole("button", { name: "Alba ADV, equipaggio 2" }),
  ).toBeVisible()
  await pool(page).getByRole("button", { name: "Sara", exact: true }).click()
  await page.getByRole("button", { name: "Sposta Sara A terra" }).click()
  await pool(page).getByRole("button", { name: "Marta", exact: true }).click()
  await page.getByRole("button", { name: "Sposta Marta A terra" }).click()
  await expect(page.getByText("Allievi sistemati 6/6")).toBeVisible()

  // --- An empty session: crews made from nothing, a volunteer in a free seat
  await page.getByRole("combobox", { name: "Sessione" }).selectOption("mon-am")
  await page.getByRole("spinbutton").fill("2")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()
  await expect(crewCards(page)).toHaveCount(2)
  await page
    .getByRole("button", { name: "Posto libero 2 equipaggio 1" })
    .click()
  await page
    .getByRole("region", { name: "Volontari disponibili" })
    .getByRole("button", { name: "Ugo IS" })
    .click()
  await expect(
    crewCards(page)
      .nth(0)
      .getByRole("button", { name: "Ugo IS, equipaggio 1" }),
  ).toBeVisible()
  await pool(page).getByRole("button", { name: "Davide", exact: true }).click()
  await page
    .getByRole("button", { name: "Sposta Davide in equipaggio 1" })
    .click()
  await pool(page).getByRole("button", { name: "Tom", exact: true }).click()
  await page.getByRole("button", { name: "Sposta Tom in equipaggio 2" }).click()
  await pool(page).getByRole("button", { name: "Sara", exact: true }).click()
  await page
    .getByRole("button", { name: "Sposta Sara in equipaggio 2" })
    .click()
  for (const name of ["Irene", "Elisa", "Marta"]) {
    await pool(page).getByRole("button", { name, exact: true }).click()
    await page.getByRole("button", { name: `Sposta ${name} A terra` }).click()
  }
  await expect(page.getByText("Allievi sistemati 6/6")).toBeVisible()

  // --- The crew summary of the migrated Saturday, copied as an image ------
  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sat-pm")
  await page.getByRole("button", { name: "Apri vista lettura" }).click()
  const crewSummary = page.getByRole("dialog", {
    name: "Vista lettura equipaggi",
  })
  await expect(crewSummary.getByRole("listitem")).toHaveCount(3)
  await expect(crewSummary.getByText("Nico CT")).toBeVisible()
  await expect(crewSummary.getByText("Tom", { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await copyAndCheckSummaryImage(page, crewSummary, testInfo, {
    name: "ug2-v020-crew-summary",
  })
  await page.getByRole("button", { name: "Chiudi vista lettura" }).click()

  // --- Comandate: the 0.2.0 plan, one more duty, the summary as an image ---
  await nav(page).getByRole("button", { name: "Home", exact: true }).click()
  await page.getByRole("button", { name: "Comandate" }).click()
  await expect(
    page.getByRole("button", { name: /^Sabato, 1 assegnati/ }),
  ).toContainText("Davide")
  await expect(
    page.getByRole("button", { name: /^Lunedì, 2 assegnati/ }),
  ).toContainText("Tom")
  await page.getByRole("button", { name: /^Mercoledì, 0 assegnati/ }).click()
  await page.getByRole("button", { name: "Marta", exact: true }).click()
  await page
    .getByRole("button", { name: "Indietro da Comandata mercoledì" })
    .click()
  await expect(
    page.getByRole("button", { name: /^Mercoledì, 1 assegnati/ }),
  ).toContainText("Marta")
  await page.getByRole("button", { name: "Apri riepilogo comandate" }).click()
  const dutySummary = page.getByRole("dialog", {
    name: "Vista lettura comandate",
  })
  await expect(dutySummary.getByRole("listitem")).toHaveCount(7)
  await copyAndCheckSummaryImage(page, dutySummary, testInfo, {
    name: "ug2-v020-duty-summary",
    endsWithLastCard: true,
  })
  await page.getByRole("button", { name: "Chiudi vista lettura" }).click()
  await page.getByRole("button", { name: "Indietro da Comandate" }).click()

  // --- Valutazioni: new evaluations beside the 0.2.0 ones -----------------
  await page.getByRole("button", { name: "Valutazioni" }).click()
  for (const sessionId of ["sun-am", "mon-am"]) {
    await page.getByLabel("Sessione valutazioni").selectOption(sessionId)
    for (const [name, value] of [
      ["Tom", "+"],
      ["Davide", "++"],
    ] as const) {
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
  }
  // The 0.2.0 evaluation is where it was left.
  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")
  await expect(
    page.getByRole("button", {
      name: "Valutazione di Davide: ++",
      exact: true,
    }),
  ).toBeVisible()

  // --- Close and reopen ----------------------------------------------------
  await page.close()
  const reopened = await context.newPage()
  await reopened.goto("/")
  await expect(
    reopened.getByRole("heading", { name: "D2 - 38 | 2026" }),
  ).toBeVisible()

  await reopened.getByRole("button", { name: "Allievi" }).click()
  await expectStudentList(reopened, [
    /^Tom, 15 anni, M, Minorenne$/,
    /^Elisa, 17 anni, F, Minorenne$/,
    /^Irene, 18 anni, F$/,
    /^Davide, 31 anni, M$/,
    /^Sara, 26 anni, F$/,
    /^Marta, 16 anni, F, Minorenne$/,
    /^Paolo, 38 anni, M, Non disponibile$/,
  ])
  await reopened.getByRole("button", { name: /^Davide,/ }).click()
  await expect(reopened.getByText("+390000000099")).toBeVisible()
  await expect(reopened.getByText("31 anni", { exact: true })).toBeVisible()
  await reopened.getByRole("button", { name: "Indietro da Profilo" }).click()
  await reopened.getByRole("button", { name: "Indietro da Allievi" }).click()

  await nav(reopened).getByRole("button", { name: "Equipaggi" }).click()
  await reopened
    .getByRole("combobox", { name: "Sessione" })
    .selectOption("sat-pm")
  await expect(crewCards(reopened)).toHaveCount(3)
  await expect(
    crewCards(reopened)
      .nth(0)
      .getByRole("button", { name: "Nico CT, equipaggio 1" }),
  ).toBeVisible()
  await reopened
    .getByRole("combobox", { name: "Sessione" })
    .selectOption("sun-am")
  await expect(crewCards(reopened)).toHaveCount(2)
  await expect(
    crewCards(reopened)
      .nth(1)
      .getByRole("button", { name: "Alba ADV, equipaggio 2" }),
  ).toBeVisible()
  await reopened
    .getByRole("combobox", { name: "Sessione" })
    .selectOption("mon-am")
  await expect(crewCards(reopened)).toHaveCount(2)
  await expect(
    crewCards(reopened)
      .nth(0)
      .getByRole("button", { name: "Ugo IS, equipaggio 1" }),
  ).toBeVisible()
  await expect(reopened.getByText("Allievi sistemati 6/6")).toBeVisible()

  await nav(reopened).getByRole("button", { name: "Home", exact: true }).click()
  await reopened.getByRole("button", { name: "Valutazioni" }).click()
  await reopened
    .getByRole("group", { name: "Vista valutazioni" })
    .getByRole("button", { name: "Riepilogo" })
    .click()
  await reopened
    .getByRole("button", { name: "Tom, Sabato PM: +, nota presente" })
    .click()
  await expect(reopened.getByText("Timone sicuro")).toBeVisible()

  // --- Every original row, id and value, except what was edited -----------
  const database = await readDatabase(reopened)
  const changed: Record<string, Record<string, unknown>> = {
    // Phone edited; the stored birth date and the empty declared age stay.
    "students:student-v020-davide": { phone: "+390000000099" },
    // Age changed: the record is age-only now.
    "students:student-v020-sara": {
      dateOfBirth: "",
      declaredAgeAtCourseStart: 26,
    },
    // Saved once after the update: D2's standard capacity is stored.
    "crews:crew-v020-sun-am-1": { capacity: 2 },
  }
  expectOriginalRowsRetained(database, changed)

  // Untouched Saturday crews were never rewritten: still no stored capacity.
  for (const id of [
    "crew-v020-sat-pm-1",
    "crew-v020-sat-pm-2",
    "crew-v020-sat-pm-3",
  ]) {
    expect(database.crews!.find((crew) => crew.id === id)!.capacity, id).toBe(
      null,
    )
  }
  expect(database.students).toHaveLength(fixture.tables.students!.length + 1)
  const marta = database.students!.find(
    ({ firstName }) => firstName === "Marta",
  )
  expect(marta).toMatchObject({
    dateOfBirth: "",
    declaredAgeAtCourseStart: 16,
  })
  // Two new crews on the empty Monday and one on Sunday: all D2 pairs.
  const newCrews = database.crews!.filter(
    ({ id }) => !fixture.tables.crews!.some((crew) => crew.id === id),
  )
  expect(newCrews).toHaveLength(3)
  expect(newCrews.every(({ capacity }) => capacity === 2)).toBe(true)
  // Four new evaluations on top of the five from 0.2.0.
  expect(database.evaluations).toHaveLength(
    fixture.tables.evaluations!.length + 4,
  )
  expect(database.dutyAssignments).toHaveLength(
    fixture.tables.dutyAssignments!.length + 1,
  )

  await reopened.screenshot({
    path: evidenceOutputPath(testInfo, "UG2", "upgraded-v020-week.png"),
  })
})
