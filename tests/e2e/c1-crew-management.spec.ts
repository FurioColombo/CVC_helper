import { copyFileSync, mkdirSync, readFileSync, unlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { expect, type Page, test } from "@playwright/test"

const COUNT_STUDENTS = [
  "Alba",
  "Bruno",
  "Caterina",
  "Dario",
  "Elena",
  "Fabio",
  "Giada",
  "Lorenzo",
]

const CREW_STUDENTS = [
  { firstName: "Berto", surname: "Rossi", birthDate: "2000-01-01" },
  { firstName: "Carlo", surname: "Neri", birthDate: "2000-01-01" },
  { firstName: "Dina", surname: "Blu", birthDate: "2000-01-01" },
  { firstName: "Ernesto", surname: "Verdi", birthDate: "2000-01-01" },
  { firstName: "Fiona", surname: "Gialli", birthDate: "2000-01-01" },
  { firstName: "Giulio", surname: "Neri", birthDate: "2000-01-01" },
  { firstName: "Zeno", surname: "Bianchi", birthDate: "2012-01-01" },
] as const

async function createCourse(page: Page, level: 1 | 2) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: `Livello ${level}` }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
}

async function addStudent(
  page: Page,
  student: { firstName: string; surname: string; birthDate?: string },
) {
  await page.getByRole("button", { name: "Aggiungi allievo" }).first().click()
  await page.getByLabel("Nome", { exact: true }).fill(student.firstName)
  await page.getByLabel("Cognome", { exact: true }).fill(student.surname)
  await page
    .getByLabel(/^Data di nascita/)
    .fill(student.birthDate ?? "2000-01-01")
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText("M", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
}

async function returnToHome(page: Page, screen: "Allievi" | "Comandate") {
  if (screen === "Comandate") {
    await page.getByRole("button", { name: "Indietro da Comandate" }).click()
  } else {
    await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  }
}

test("allows a blank crew-count draft and normal replacement with eight", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "The crew-count journey is exercised once on Pixel 7 Chrome",
  )
  test.setTimeout(180_000)

  await createCourse(page, 2)
  await page.getByRole("button", { name: "Allievi" }).click()
  for (const firstName of COUNT_STUDENTS) {
    await addStudent(page, { firstName, surname: "Esempio" })
  }
  await returnToHome(page, "Allievi")
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()

  const count = page.getByRole("spinbutton")
  await count.fill("")
  await expect(count).toHaveValue("")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()
  await expect(count).toHaveValue("0")
  await expect(
    page.getByRole("heading", { name: "Prepara la sessione" }),
  ).toBeVisible()

  await count.fill("8")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()
  await expect(
    page
      .getByRole("region", { name: "Equipaggi della sessione" })
      .getByRole("article"),
  ).toHaveCount(8)
})

test("keeps a forty-student roster usable at 320 px with 200% text", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "One full synthetic-roster stress journey is sufficient",
  )
  test.setTimeout(90_000)
  page.setDefaultTimeout(15_000)

  await createCourse(page, 1)
  const longName = "Alessandromassimiliano"
  const seededStudents = Array.from({ length: 40 }, (_, index) => ({
    firstName:
      index === 0 ? longName : `Allievo${String(index).padStart(2, "0")}`,
    surname: index === 0 ? "Esempio" : "Prova",
    nickname: null,
    dateOfBirth: "2000-01-01",
    declaredAgeAtCourseStart: null,
    sex: "male",
    phone: null,
    size: null,
    initialNote: null,
    courseNote: null,
  }))
  await page.evaluate(async (inputs) => {
    const courseModulePath = "/src/persistence/courses.ts"
    const studentsModulePath = "/src/persistence/students.ts"
    const courseApi = (await import(/* @vite-ignore */ courseModulePath)) as {
      getActiveCourse: () => Promise<{ id: string } | null>
    }
    const studentApi = (await import(
      /* @vite-ignore */ studentsModulePath
    )) as {
      createStudents: (
        courseId: string,
        entries: Array<Record<string, unknown>>,
      ) => Promise<unknown>
    }
    const course = await courseApi.getActiveCourse()
    if (!course) throw new Error("Synthetic roster requires an active course")
    await studentApi.createStudents(course.id, inputs)
  }, seededStudents)
  await page.reload()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await page.getByRole("spinbutton").fill("1")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()

  await page.setViewportSize({ width: 320, height: 664 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  const pool = page.getByRole("region", { name: "Allievi disponibili" })
  await expect(pool.getByRole("button")).toHaveCount(40)
  const firstStudent = pool.getByRole("button", {
    name: longName,
    exact: true,
  })
  const geometry = await page.evaluate((label) => {
    const button = [...document.querySelectorAll("button")].find(
      (candidate) => candidate.getAttribute("aria-label") === label,
    )
    if (!button) return null
    const rect = button.getBoundingClientRect()
    const composition = document.querySelector<HTMLElement>(
      '[aria-label="Composizione equipaggi"]',
    )
    const compositionRect = composition?.getBoundingClientRect()
    return {
      button: { width: rect.width, height: rect.height },
      compositionHeight: compositionRect?.height ?? 0,
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
    }
  }, longName)
  expect(geometry).not.toBeNull()
  expect(geometry!.compositionHeight).toBeGreaterThan(100)
  expect(geometry!.pageWidth).toBe(geometry!.viewportWidth)
  await expect(firstStudent).toHaveAttribute("aria-label", longName)
  await firstStudent.click()
  await expect(
    page.getByRole("region", { name: "Destinazione persona selezionata" }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: `Sposta ${longName} in equipaggio 1` })
    .click()

  const crew = page
    .getByRole("region", { name: "Equipaggi della sessione" })
    .getByRole("article")
    .first()
  await expect(crew).toContainText("1/4")
  await expect(
    crew.getByRole("button", { name: `${longName}, equipaggio 1` }),
  ).toBeVisible()
  const renderedName = crew.getByText(longName, { exact: true })
  await expect(renderedName).toHaveCSS("white-space", "nowrap")
  await expect(renderedName).toHaveCSS("text-overflow", "ellipsis")
  const nameGeometry = await renderedName.evaluate((element) => ({
    nameWidth: element.getBoundingClientRect().width,
    personButtonWidth:
      element.closest("button")?.getBoundingClientRect().width ?? 0,
  }))
  expect(nameGeometry.nameWidth).toBeGreaterThan(0)
  expect(nameGeometry.personButtonWidth).toBeGreaterThanOrEqual(40)
  await expect(
    crew.getByRole("button", { name: `Rendi disponibile ${longName}` }),
  ).toHaveCSS("min-width", "40px")
  const columns = await crew
    .locator("div.grid-cols-2, div.grid-cols-3")
    .first()
    .evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(" ").length,
    )
  expect(columns).toBe(3)
  expect(
    await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
    })),
  ).toEqual({ viewportWidth: 320, pageWidth: 320 })

  mkdirSync(path.resolve(".evidence/C1"), { recursive: true })
  await crew.screenshot({
    path: path.resolve(
      ".evidence/C1/crew-card-long-name-320px-200-percent.png",
    ),
  })
  await page.screenshot({
    fullPage: true,
    path: path.resolve(
      ".evidence/C1/crew-manager-40-students-320px-200-percent.png",
    ),
  })
})

test("covers C1 capacity, duty ordering, destination previews, density and image export", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "The integrated C1 journey is exercised once on Pixel 7 Chrome",
  )
  test.setTimeout(90_000)
  page.setDefaultTimeout(15_000)

  await createCourse(page, 1)
  await page.getByRole("button", { name: "Allievi" }).click()
  for (const student of CREW_STUDENTS) await addStudent(page, student)
  await returnToHome(page, "Allievi")

  await page.getByRole("button", { name: "Comandate" }).click()
  await page.getByRole("button", { name: "Configura manualmente" }).click()
  await page.getByRole("button", { name: /^Sabato, \d+ assegnati/ }).click()
  await page
    .getByRole("region", { name: "Allievi comandata Sabato" })
    .getByRole("button", { name: "Zeno", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Indietro da Comandata sabato" })
    .click()
  await returnToHome(page, "Comandate")

  await page.getByRole("button", { name: "Impostazioni" }).click()
  await expect(page.getByRole("radio", { name: "3 per riga" })).toBeChecked()
  await page.getByRole("radio", { name: "2 per riga" }).check()
  await page.getByRole("button", { name: "Torna alla Home" }).click()

  const primaryNav = page.getByRole("navigation", {
    name: "Navigazione principale",
  })
  await primaryNav.getByRole("button", { name: "Equipaggi" }).click()
  await page.getByRole("combobox", { name: "Sessione" }).selectOption("sat-pm")
  await page.getByRole("spinbutton").fill("2")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()

  const crew1 = page
    .getByRole("region", { name: "Equipaggi della sessione" })
    .getByRole("article")
    .nth(0)
  const crew2 = page
    .getByRole("region", { name: "Equipaggi della sessione" })
    .getByRole("article")
    .nth(1)
  await expect(crew1).toContainText("0/4")
  await expect(crew2).toContainText("0/4")
  await page
    .getByRole("button", { name: "Aumenta capienza equipaggio 1" })
    .click()
  await expect(crew1).toContainText("0/5")
  for (const capacity of [3, 2, 1]) {
    await page
      .getByRole("button", { name: "Riduci capienza equipaggio 2" })
      .click()
    await expect(crew2).toContainText(`0/${capacity}`)
  }

  const pool = page.getByRole("region", { name: "Allievi disponibili" })
  await expect
    .poll(() =>
      pool
        .getByRole("button")
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getAttribute("aria-label")),
        ),
    )
    .toEqual(["Zeno", "Berto", "Carlo", "Dina", "Ernesto", "Fiona", "Giulio"])

  for (const firstName of ["Zeno", "Berto", "Carlo", "Dina", "Ernesto"]) {
    await pool.getByRole("button", { name: firstName, exact: true }).click()
    await page
      .getByRole("button", { name: `Sposta ${firstName} in equipaggio 1` })
      .click()
    await expect(
      crew1.getByRole("button", { name: `${firstName}, equipaggio 1` }),
    ).toBeVisible()
  }

  // Exercise the destination picker in a narrow portrait viewport. The first
  // available crew may already be near center, so assert its final position.
  await page.setViewportSize({ width: 320, height: 600 })
  await page.evaluate(() => window.scrollTo(0, 0))
  const composition = page.getByRole("region", {
    name: "Composizione equipaggi",
  })
  await composition.evaluate((element) => {
    element.scrollTop = 0
  })
  await pool.getByRole("button", { name: "Fiona", exact: true }).click()
  const picker = page.getByRole("region", {
    name: "Destinazione persona selezionata",
  })
  await expect(picker).toBeVisible()
  await expect(
    picker.getByRole("button", { name: "Sposta Fiona in equipaggio 2" }),
  ).toHaveAttribute("aria-description", "-")
  await expect(
    picker.getByRole("button", { name: "Sposta Fiona in equipaggio 1" }),
  ).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.getAttribute(
          "aria-label",
        ),
      ),
    )
    .toBe("Destinazione persona selezionata")
  await expect
    .poll(() =>
      composition.evaluate((container) => {
        const target = container.querySelectorAll("article")[1]!
        const containerRect = container.getBoundingClientRect()
        const targetRect = target.getBoundingClientRect()
        return Math.abs(
          targetRect.top +
            targetRect.height / 2 -
            (containerRect.top + containerRect.height / 2),
        )
      }),
    )
    .toBeLessThan(120)

  await picker
    .getByRole("button", { name: "Sposta Fiona in equipaggio 2" })
    .click()
  await expect(crew2).toContainText("1/1")
  await expect(pool.getByRole("button", { name: "Fiona" })).toHaveCount(0)

  await pool.getByRole("button", { name: "Giulio", exact: true }).click()
  await expect(picker.getByRole("status")).toHaveText("Equipaggi pieni")
  await expect(
    picker.getByRole("button", { name: "Nuovo equipaggio" }),
  ).toBeEnabled()
  await expect(picker.getByRole("button", { name: "A terra" })).toBeVisible()
  await expect(picker.getByRole("button", { name: "Mezzi" })).toBeVisible()
  await picker.getByRole("button", { name: "Sposta Giulio A terra" }).click()
  await expect(page.getByText("Allievi sistemati 7/7")).toBeVisible()

  await crew1.getByRole("button", { name: "Berto, equipaggio 1" }).click()
  await page.getByRole("button", { name: "Apri vista lettura" }).click()
  const summary = page.getByRole("dialog", { name: "Vista lettura equipaggi" })
  const summaryCrew1 = summary.getByRole("listitem", {
    name: /^Equipaggio 1,/,
  })
  await expect(summaryCrew1.getByLabel("In comandata")).toHaveText("C")
  await expect(summaryCrew1.getByLabel("Minorenne")).toHaveText("M")

  const downloadPromise = page.waitForEvent("download")
  await summary
    .getByRole("button", { name: "Scarica immagine riepilogo" })
    .click()
  const download = await downloadPromise
  const temporarySvgPath = path.join(
    tmpdir(),
    `cvc-crew-summary-${process.pid}-${testInfo.retry}.svg`,
  )
  const evidencePath = path.resolve(".evidence/C1/crew-summary-browser.svg")
  await download.saveAs(temporarySvgPath)
  const svg = readFileSync(temporarySvgPath, "utf8")
  expect(svg).toContain('aria-label="Riepilogo equipaggi"')
  expect(svg).toContain('data-columns="1"')
  expect(svg.match(/data-crew-number=/g)).toHaveLength(2)
  for (const firstName of [
    "Zeno",
    "Berto",
    "Carlo",
    "Dina",
    "Ernesto",
    "Fiona",
  ])
    expect(svg).toContain(firstName)
  expect(svg).toContain("Comandata")
  expect(svg).toContain("Minorenne")

  await page.getByRole("button", { name: "Chiudi vista lettura" }).click()

  await page.setViewportSize({ width: 320, height: 664 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  const gridColumnCount = await crew1
    .locator("div.grid-cols-2, div.grid-cols-3")
    .first()
    .evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(" ").length,
    )
  expect(gridColumnCount).toBe(2)
  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    pageWidth: document.documentElement.scrollWidth,
  }))
  expect(layout).toEqual({ viewportWidth: 320, pageWidth: 320 })
  mkdirSync(path.resolve(".evidence/C1"), { recursive: true })
  await page.screenshot({
    fullPage: true,
    path: path.resolve(".evidence/C1/crew-manager-320px-200-percent.png"),
  })
  copyFileSync(temporarySvgPath, evidencePath)
  unlinkSync(temporarySvgPath)
})
