import { mkdirSync } from "node:fs"
import path from "node:path"

import { expect, type Page, test } from "@playwright/test"

const SESSIONS = [
  "sat-pm",
  "sun-am",
  "sun-pm",
  "mon-am",
  "mon-pm",
  "tue-am",
  "tue-pm",
  "wed-am",
  "wed-pm",
  "thu-am",
  "thu-pm",
  "fri-am",
  "fri-pm",
] as const

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

async function expectNoHorizontalPageScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}

async function expectEvaluationLabelsFit(page: Page) {
  const labels = [
    page.getByRole("heading", { name: "Valutazioni", exact: true }),
    ...["Allievi", "Equipaggi", "Riepilogo"].map((name) =>
      page
        .getByRole("group", { name: "Vista valutazioni" })
        .getByRole("button", { name }),
    ),
  ]
  for (const label of labels) {
    const { scrollWidth, clientWidth } = await label.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }))
    expect(scrollWidth - clientWidth).toBeLessThanOrEqual(1)
  }
}

test("edits thirteen sessions through one compact row and reads the same week in overview and history", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 320, height: 664 })
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await addStudent(page, "Alessandro", "Bernardeschi")
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await page.getByRole("button", { name: "Valutazioni" }).click()
  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")

  const evaluation = page.getByRole("group", {
    name: "Valutazione di Alessandro",
  })
  await expect(evaluation.getByRole("button")).toHaveCount(5)
  await expect(
    page.getByRole("button", { name: "Valutazione di Alessandro: mancante" }),
  ).toHaveCount(0)
  await expectNoHorizontalPageScroll(page)
  const nameButton = page.getByRole("button", {
    name: "Aggiungi nota valutazione di Alessandro",
  })
  const nameBounds = await nameButton.boundingBox()
  const markBounds = await evaluation.getByRole("button").first().boundingBox()
  expect(nameBounds).not.toBeNull()
  expect(markBounds).not.toBeNull()
  expect(Math.abs(nameBounds!.y - markBounds!.y)).toBeLessThanOrEqual(1)
  expect(markBounds!.width).toBeGreaterThanOrEqual(40)

  for (const [index, sessionId] of SESSIONS.entries()) {
    await page.getByLabel("Sessione valutazioni").selectOption(sessionId)
    if (index === 8) continue // Missing is distinct from a neutral mark.
    const value = index === 1 ? "=" : index === 3 ? "--" : "+"
    await page
      .getByRole("button", {
        name: `Valutazione di Alessandro: ${value}`,
        exact: true,
      })
      .click()
    await expect(
      page.getByLabel("Stato salvataggio valutazione di Alessandro"),
    ).toHaveText("Salvato")
  }

  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")
  await page
    .getByRole("button", { name: "Aggiungi nota valutazione di Alessandro" })
    .click()
  await page
    .getByRole("textbox", { name: "Nota valutazione di Alessandro" })
    .fill("Progressi nella virata")
  await page.getByRole("button", { name: "Salva nota" }).click()
  await page
    .getByRole("button", {
      name: "Valutazione di Alessandro: +",
      exact: true,
    })
    .click()
  await expect(
    page.getByLabel("Stato salvataggio valutazione di Alessandro"),
  ).toHaveText("Salvato")
  await expect(
    page.getByRole("button", {
      name: "Valutazione di Alessandro: +",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "false")

  await page.reload()
  await page.getByRole("button", { name: "Valutazioni" }).click()
  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")
  await expect(
    page.getByRole("button", {
      name: "Modifica nota valutazione di Alessandro",
    }),
  ).toBeVisible()
  await page
    .getByRole("group", { name: "Vista valutazioni" })
    .getByRole("button", { name: "Riepilogo" })
    .click()
  await expect(
    page.getByRole("heading", { name: "Riepilogo del corso" }),
  ).toBeVisible()
  await expect(page.getByText("11 valutazioni")).toBeVisible()
  await expect(page.getByText("Ordinamento")).toBeVisible()
  await expectNoHorizontalPageScroll(page)
  const overviewGrid = page.getByRole("table", {
    name: "Valutazioni settimanali di Alessandro",
  })
  await expect(overviewGrid.locator("tbody > tr")).toHaveCount(7)
  await expect(overviewGrid.locator("[data-evaluation]")).toHaveCount(13)

  const screenshotDirectory = path.resolve("test-results/screenshots")
  mkdirSync(screenshotDirectory, { recursive: true })
  await page.screenshot({
    path: path.join(screenshotDirectory, `p18-${testInfo.project.name}.png`),
  })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await expectNoHorizontalPageScroll(page)
  await expectEvaluationLabelsFit(page)
  const nameHeading = page.getByRole("heading", {
    name: "Alessandro",
    level: 3,
  })
  const nameFit = await nameHeading.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }))
  expect(nameFit.scrollWidth - nameFit.clientWidth).toBeLessThanOrEqual(1)
  await page.screenshot({
    path: path.join(
      screenshotDirectory,
      `p18-stress-${testInfo.project.name}.png`,
    ),
    fullPage: true,
  })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = ""
  })

  await page
    .getByRole("button", {
      name: "Apri dettaglio di Alessandro, cognome Bernardeschi",
    })
    .click()
  const history = page.getByRole("region", { name: "Storico valutazioni" })
  await expect(history).toBeVisible()
  await expect(
    history.getByRole("table", {
      name: "Valutazioni settimanali di Alessandro",
    }),
  ).toBeVisible()
  await expect(history.getByLabel("Domenica AM: =")).toBeVisible()
  await expect(history.getByLabel("Lunedì AM: --")).toBeVisible()
  await expectNoHorizontalPageScroll(page)
  await page.screenshot({
    path: path.join(screenshotDirectory, `p19-${testInfo.project.name}.png`),
  })

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await expectNoHorizontalPageScroll(page)
  await page.screenshot({
    path: path.join(
      screenshotDirectory,
      `p19-stress-${testInfo.project.name}.png`,
    ),
    fullPage: true,
  })
  await page.getByRole("button", { name: "Indietro da Profilo" }).click()
  await page
    .getByRole("group", { name: "Vista valutazioni" })
    .getByRole("button", { name: "Allievi" })
    .click()
  await expectNoHorizontalPageScroll(page)
  await expectEvaluationLabelsFit(page)
  const stressedMarks = page
    .getByRole("group", { name: "Valutazione di Alessandro" })
    .getByRole("button")
  await expect(stressedMarks).toHaveCount(5)
  for (const mark of await stressedMarks.all()) {
    const bounds = await mark.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.width).toBeGreaterThanOrEqual(40)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(321)
  }
  await page.screenshot({
    path: path.join(
      screenshotDirectory,
      `p17-stress-${testInfo.project.name}.png`,
    ),
  })
})

test("keeps a typed evaluation note recoverable when microphone permission is denied", async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => {
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: class {},
    })
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () =>
          Promise.reject(new DOMException("Denied", "NotAllowedError")),
      },
    })
  })
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await addStudent(page, "Aldo", "Rossi")
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await page.getByRole("button", { name: "Valutazioni" }).click()
  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")
  await page
    .getByRole("button", { name: "Aggiungi nota valutazione di Aldo" })
    .click()
  const note = page.getByRole("textbox", { name: "Nota valutazione di Aldo" })
  await note.fill("Testo scritto prima della dettatura")
  await page
    .getByRole("button", { name: "Detta nota valutazione di Aldo" })
    .click()
  await expect(page.getByRole("alert")).toContainText(
    "Permesso microfono non concesso",
  )
  await expect(note).toHaveValue("Testo scritto prima della dettatura")
  await page
    .getByRole("button", { name: "Riprovare dettatura valutazione di Aldo" })
    .click()
  await expect(page.getByRole("alert")).toContainText(
    "Permesso microfono non concesso",
  )
  await note.fill("Testo corretto e salvato")
  await page.getByRole("button", { name: "Salva nota" }).click()
  await expect(
    page.getByLabel("Stato salvataggio valutazione di Aldo"),
  ).toHaveText("Salvato")
  await expect(
    page.getByRole("button", { name: "Modifica nota valutazione di Aldo" }),
  ).toBeVisible()
  await page.reload()
  await page.getByRole("button", { name: "Valutazioni" }).click()
  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")
  await page
    .getByRole("button", { name: "Modifica nota valutazione di Aldo" })
    .click()
  await expect(note).toHaveValue("Testo corretto e salvato")
})

test("shows the evaluation note itself, clamped to two lines however long it is", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 320, height: 664 })
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await addStudent(page, "Alessandro", "Bernardeschi")
  await addStudent(page, "Bea", "Verdi")
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await page.getByRole("button", { name: "Valutazioni" }).click()
  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")

  const shortNote = "Bene in bolina."
  const longNote =
    "Virata molto pulita anche con la raffica, ha tenuto la barca piatta per " +
    "tutta la bolina e ha corretto la rotta da sola senza che nessuno le " +
    "dicesse niente, ottimo lavoro anche in poppa con il vento in calo e mare " +
    "formato da ovest."

  for (const [name, text] of [
    ["Alessandro", longNote],
    ["Bea", shortNote],
  ] as const) {
    await page
      .getByRole("button", { name: `Aggiungi nota valutazione di ${name}` })
      .click()
    await page
      .getByRole("textbox", { name: `Nota valutazione di ${name}` })
      .fill(text)
    await page.getByRole("button", { name: "Salva nota" }).click()
    await expect(
      page.getByRole("button", {
        name: `Modifica nota valutazione di ${name}`,
      }),
    ).toBeVisible()
  }

  // The note is shown, not the words "Nota presente".
  await expect(page.getByText("Nota presente")).toHaveCount(0)
  const long = page.getByText(longNote)
  await expect(long).toBeVisible()
  await expect(page.getByText(shortNote)).toBeVisible()

  // Clamped: the element is shorter than its own content, and the clamp holds
  // the row to two lines whatever the note says.
  const clamp = await long.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
  }))
  expect(clamp.scrollHeight).toBeGreaterThan(clamp.clientHeight)
  expect(clamp.clientHeight).toBeLessThanOrEqual(clamp.lineHeight * 2 + 1)
  await expectNoHorizontalPageScroll(page)

  const evidenceDirectory = path.join(process.cwd(), ".evidence", "UG1")
  mkdirSync(evidenceDirectory, { recursive: true })
  await page.screenshot({
    path: path.join(
      evidenceDirectory,
      `evaluation-note-preview-${testInfo.project.name}.png`,
    ),
    fullPage: true,
  })

  // The clamp must survive 200% text as well, where two lines are much taller.
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await expectNoHorizontalPageScroll(page)
  const enlarged = await long.evaluate((element) => ({
    clientHeight: element.clientHeight,
    lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
  }))
  expect(enlarged.clientHeight).toBeLessThanOrEqual(enlarged.lineHeight * 2 + 1)
  await page.screenshot({
    path: path.join(
      evidenceDirectory,
      `evaluation-note-preview-200-${testInfo.project.name}.png`,
    ),
    fullPage: true,
  })
})
