import { expect, type Page, test } from "@playwright/test"
import sharp from "sharp"

/**
 * F3, last part (owner, 2026-09-28): "the summary of the Comandate in a
 * similar format [to the crew summary]... add that option to the Comandate
 * after you have created them." A fourteen-student, two-per-day D2 course
 * (a typical size, evenly divisible by the seven duty days) is created and
 * proposed entirely through the visible UI, the same setup
 * `tests/e2e/duties.spec.ts` and `tests/e2e/u08-duties.spec.ts` already use,
 * then the new "Riepilogo comandate" read view is opened, checked to fit one
 * 390×844 screen and to stay readable (no horizontal overflow, no truncated
 * name) at the 320 px/200% text accessibility stress
 * (`docs/post-mvp/06_DESIGN_RULEBOOK.md` §5), and its PNG export is
 * downloaded and measured.
 */

const TOTAL_STUDENTS = 14
const LONG_NAME_INDEX = TOTAL_STUDENTS
const LONG_NAME = `NomeLunghissimoDiProva${LONG_NAME_INDEX}`

async function createCourse(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
}

async function addStudent(
  page: Page,
  index: number,
  options: { minor?: boolean; female?: boolean; longName?: boolean } = {},
) {
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page
    .getByLabel("Nome", { exact: true })
    .fill(options.longName ? LONG_NAME : `Nome${index}`)
  await page.getByLabel("Cognome", { exact: true }).fill(`Cognome${index}`)
  await page
    .getByLabel("Età compiuta il primo giorno del corso")
    .fill(options.minor ? "15" : "26")
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText(options.female ? "F" : "M", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
}

test("shows a readable Comandate summary for a typical week and exports it as a PNG", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "One full synthetic Comandate-summary journey is sufficient",
  )
  test.setTimeout(180_000)

  await createCourse(page)
  await page.getByRole("button", { name: "Allievi" }).click()
  for (let index = 1; index <= TOTAL_STUDENTS; index += 1) {
    await addStudent(page, index, {
      minor: index === 1,
      female: index % 2 === 0,
      longName: index === LONG_NAME_INDEX,
    })
  }
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await page.getByRole("button", { name: "Comandate" }).click()
  await page.getByRole("button", { name: "Proponi comandate" }).click()
  await page.getByRole("button", { name: "Conferma proposta" }).click()
  await expect(
    page.getByRole("region", { name: "Piano comandate" }),
  ).toBeVisible()

  await page.getByRole("button", { name: "Apri riepilogo comandate" }).click()
  const view = page.getByRole("dialog", { name: "Vista lettura comandate" })
  await expect(view.getByRole("listitem")).toHaveCount(7)

  // The seven days appear in canonical Sabato→Venerdì order, the same order
  // `01_PRODUCT_SPEC.md` §6.1's "main view shows all seven groups" describes.
  const dayLabels = await view
    .getByRole("listitem")
    .evaluateAll((items) =>
      items.map(
        (item) => (item.getAttribute("aria-label") ?? "").split(",")[0],
      ),
    )
  expect(dayLabels).toEqual([
    "Sabato",
    "Domenica",
    "Lunedì",
    "Martedì",
    "Mercoledì",
    "Giovedì",
    "Venerdì",
  ])

  // 390×844: every day card visible with no vertical scroll needed, for a
  // typical (evenly divisible) course size.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: testInfo.outputPath("f3-duty-summary-390x844.png"),
    fullPage: false,
  })
  const overflow390 = await view.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }))
  expect(
    overflow390.scrollHeight,
    JSON.stringify(overflow390),
  ).toBeLessThanOrEqual(overflow390.clientHeight + 1)
  for (const card of await view.getByRole("listitem").all()) {
    await expect(card).toBeInViewport()
  }

  // 320 px/200% text: scroll is allowed, horizontal overflow is not
  // (docs/post-mvp/06_DESIGN_RULEBOOK.md §5's accessibility stress profile).
  await page.setViewportSize({ width: 320, height: 664 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))
  expect(widths.document, JSON.stringify(widths)).toBeLessThanOrEqual(
    widths.viewport + 1,
  )
  const stressCards = view.getByRole("listitem")
  await expect(stressCards).toHaveCount(7)

  // One column: every card starts at the same left edge, the same
  // `minmax(min(100%, 9rem), 1fr)` column rule `f3-crew-summary.spec.ts`
  // exercises for the crew summary.
  const cardLefts = await Promise.all(
    (await stressCards.all()).map(async (card) => {
      const box = await card.boundingBox()
      if (!box) throw new Error("Duty day card has no bounding box at 320 px")
      return box.x
    }),
  )
  for (const left of cardLefts) {
    expect(
      Math.abs(left - cardLefts[0]!),
      JSON.stringify(cardLefts),
    ).toBeLessThanOrEqual(1)
  }

  // No truncated name: the long name is still exactly in the DOM (an
  // ellipsis would leave the text but clip the box) and its own element
  // never overflows its own box.
  const nameEl = view.getByText(LONG_NAME, { exact: true })
  await expect(nameEl).toHaveCount(1)
  const overflow = await nameEl.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    text: element.textContent,
  }))
  expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(
    overflow.clientWidth,
  )
  expect(overflow.text).toBe(LONG_NAME)

  await page.screenshot({
    path: testInfo.outputPath("f3-duty-summary-320-200pct.png"),
    fullPage: false,
  })

  // Back to a normal viewport before exercising the PNG export.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = ""
  })
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    view.getByRole("button", { name: "Scarica immagine riepilogo" }).click(),
  ])
  const pngPath = testInfo.outputPath("f3-duty-summary-export.png")
  await download.saveAs(pngPath)
  const metadata = await sharp(pngPath).metadata()
  expect(metadata.format).toBe("png")
  // `dutySummaryImage.ts` lays the summary out at a fixed logical width of
  // 1080px, then rasterises at its default 2× pixel ratio, exactly like the
  // crew export — so the file the browser actually saves is 2160px wide.
  expect(metadata.width).toBe(1080 * 2)
  // Seven day cards across four rows stack well past a phone screen at the
  // 2× pixel ratio; a height under this floor would mean the export
  // collapsed instead of growing to fit every day.
  expect(metadata.height).toBeGreaterThan(1000)
})
