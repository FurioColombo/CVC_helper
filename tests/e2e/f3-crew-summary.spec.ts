import { expect, type Locator, type Page, test } from "@playwright/test"
import sharp from "sharp"
import {
  D1_BOAT_COUNT,
  D1_BOAT_TYPE,
  TOTAL_CREWS,
  TOTAL_STUDENTS,
  seedTenCrewCourseD1,
  seedThirteenCrewCourse,
} from "./summary-helpers"
import {
  MAX_COLOUR_DIFFERENCE,
  MAX_DIFFERENT_SHARE,
  MAX_MEAN_DIFFERENCE,
  captureSaveButtonWithNote,
  expectLogosInImage,
  expectSaveButtonLayout,
  imageDifference,
  saveAndCheckSummaryImage,
} from "./summary-image-checks"

/**
 * F3 C6 target: a realistic 13-crew course (owner, 2026-09-28) grouped by
 * boat model under the class logo — RS Toura, RS Quest, Laser Vago, RS 500,
 * then Mezzi — fits one 390×844 screen without scrolling, and degrades to
 * scroll-but-no-overflow at 320 px/200% text. Student and boat rosters are
 * seeded through the app's own persistence (same pattern as the 40-student
 * stress case in c1-crew-management.spec.ts) so the test exercises the crew
 * summary itself, not 26 manual student forms; the read view is opened and
 * inspected through the visible UI.
 *
 * A second, single-model course (10 crews of 4 on RS Toura, the D1 default)
 * checks that a denser but visually simpler roster also fits one screen: the
 * two-column card grid now sizes its columns from `min(100%, 8.8rem)` rather
 * than a fixed `grid-cols-2`, so both crew shapes must be exercised, not just
 * the mixed-model one. A third course gives its boats numbers of three or
 * four characters (115, 1234, A12) to check the number column keeps them
 * clear of the first name, on screen and in the saved image.
 *
 * F4: the saved image is a screenshot of this very summary, saved and copied
 * by a floating button; `f4-summary-image` tests below cover it.
 */

/** The distinct left edges the cards start at, left to right: one value for a
 *  single column, two for two columns. */
async function distinctCardLefts(cards: Locator): Promise<number[]> {
  const lefts = await cards.evaluateAll((items) =>
    items.map((item) => Math.round(item.getBoundingClientRect().left)),
  )
  return [...new Set(lefts)].sort((a, b) => a - b)
}

test("fits a realistic 13-crew course on one 390×844 screen, grouped by boat model, and degrades cleanly at 320 px/200% text", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "One full synthetic 13-crew journey is sufficient",
  )
  test.setTimeout(60_000)

  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 1" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()

  await seedThirteenCrewCourse(page)
  await page.reload()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()

  await page.getByRole("button", { name: "Apri vista lettura" }).click()
  const readView = page.getByRole("dialog", {
    name: "Vista lettura equipaggi",
  })
  await expect(readView.getByRole("listitem")).toHaveCount(TOTAL_CREWS)

  // 390×844: the frozen C6 target's own viewport. Every crew must be on
  // screen with no vertical scroll needed to reach any of them.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: testInfo.outputPath("f3-crew-summary-390x844.png"),
    fullPage: false,
  })
  const overflow390 = await readView.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }))
  expect(
    overflow390.scrollHeight,
    JSON.stringify(overflow390),
  ).toBeLessThanOrEqual(overflow390.clientHeight + 1)
  for (const card of await readView.getByRole("listitem").all()) {
    await expect(card).toBeInViewport()
  }
  // Every student is seated, so the summary closes on its small centred note
  // (spec §7.5), and that too stays on the one screen.
  await expect(
    readView.getByText("Tutti gli allievi assegnati"),
  ).toBeInViewport()

  // Boat-model groups appear in canonical order (RS Toura, RS Quest, Laser
  // Vago, RS 500), Mezzi always last, regardless of crew-plan or
  // boat-creation order.
  const touraLogo = readView.getByAltText("RS Toura")
  const questLogo = readView.getByAltText("RS Quest")
  const vagoLogo = readView.getByAltText("Laser Vago")
  const rs500Logo = readView.getByAltText("RS 500")
  const mezziHeading = readView.getByText("Mezzi")
  const [touraEl, questEl, vagoEl, rs500El, mezziEl] = await Promise.all([
    touraLogo.elementHandle(),
    questLogo.elementHandle(),
    vagoLogo.elementHandle(),
    rs500Logo.elementHandle(),
    mezziHeading.elementHandle(),
  ])
  const order = await page.evaluate(
    ([tourasEl, questsEl, vagosEl, rs500sEl, mezzisEl]) => {
      const isBefore = (a: Element, b: Element) =>
        Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
      return {
        touraBeforeQuest: isBefore(tourasEl as Element, questsEl as Element),
        questBeforeVago: isBefore(questsEl as Element, vagosEl as Element),
        vagoBeforeRs500: isBefore(vagosEl as Element, rs500sEl as Element),
        rs500BeforeMezzi: isBefore(rs500sEl as Element, mezzisEl as Element),
      }
    },
    [touraEl, questEl, vagoEl, rs500El, mezziEl],
  )
  expect(order).toEqual({
    touraBeforeQuest: true,
    questBeforeVago: true,
    vagoBeforeRs500: true,
    rs500BeforeMezzi: true,
  })

  // 320 px with normal text: two columns still fit (8.8rem tracks, 2 × 140.8
  // plus the 6px gap = 287.6px of the 288px left after the side padding), so
  // the phone-sized stress width is not spent on a single column.
  await page.setViewportSize({ width: 320, height: 664 })
  const normalCards = readView.getByRole("listitem")
  await expect(normalCards).toHaveCount(TOTAL_CREWS)
  const normalLefts = await distinctCardLefts(normalCards)
  expect(normalLefts, JSON.stringify(normalLefts)).toHaveLength(2)
  const normalWidths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))
  expect(
    normalWidths.document,
    JSON.stringify(normalWidths),
  ).toBeLessThanOrEqual(normalWidths.viewport + 1)
  await page.screenshot({
    path: testInfo.outputPath("f3-crew-summary-320.png"),
    fullPage: false,
  })

  // 320 px/200% text: scroll is allowed, horizontal overflow is not
  // (docs/post-mvp/06_DESIGN_RULEBOOK.md §5's accessibility stress profile).
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
  const stressCards = readView.getByRole("listitem")
  await expect(stressCards).toHaveCount(TOTAL_CREWS)

  // One column: 8.8rem (281.6px at 200%) no longer fits twice in the 256px
  // available, so every card starts at the same left edge instead of the two
  // ~150 px columns that used to truncate every name to a couple of letters.
  expect(await distinctCardLefts(stressCards)).toHaveLength(1)
  const cardLefts = await Promise.all(
    (await stressCards.all()).map(async (card) => {
      const box = await card.boundingBox()
      if (!box) throw new Error("Crew card has no bounding box at 320 px")
      return box.x
    }),
  )
  for (const left of cardLefts) {
    expect(
      Math.abs(left - cardLefts[0]!),
      JSON.stringify(cardLefts),
    ).toBeLessThanOrEqual(1)
  }

  // No truncated name: each member's full name is still exactly in the DOM
  // (an ellipsis would leave the text but clip the box, so this alone would
  // not catch the regression) and its own element never overflows its own
  // box (the ellipsis bug this milestone fixes: `overflow-wrap: anywhere` on
  // a flex-item span replaces `truncate`'s `white-space:nowrap` clipping).
  const stressMemberNames = Array.from(
    { length: TOTAL_STUDENTS },
    (_, index) => `Allievo${String(index + 1).padStart(2, "0")}`,
  )
  for (const name of stressMemberNames) {
    const nameEl = readView.getByText(name, { exact: true })
    await expect(nameEl, name).toHaveCount(1)
    const overflow = await nameEl.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      text: element.textContent,
    }))
    expect(
      overflow.scrollWidth,
      `${name}: ${JSON.stringify(overflow)}`,
    ).toBeLessThanOrEqual(overflow.clientWidth)
    expect(overflow.text).toBe(name)
  }

  // The session title wraps rather than losing text to an ellipsis.
  const stressTitle = readView.locator("#crew-announcement-title")
  const titleOverflow = await stressTitle.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    text: element.textContent,
  }))
  expect(
    titleOverflow.scrollWidth,
    JSON.stringify(titleOverflow),
  ).toBeLessThanOrEqual(titleOverflow.clientWidth)
  expect(titleOverflow.text).toBe("Sabato PM")

  // Not `fullPage`: the read view is a fixed-position overlay, so a
  // full-page capture would scroll through the composition screen behind it
  // instead of the dialog's own (permitted) scroll. The viewport screenshot
  // shows the initial, unscrolled read.
  await page.screenshot({
    path: testInfo.outputPath("f3-crew-summary-320-200pct.png"),
    fullPage: false,
  })
})

test("fits ten 4-student D1 crews, single boat model, on one 390×844 screen", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "One full synthetic D1 journey is sufficient",
  )
  test.setTimeout(60_000)

  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 1" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()

  await seedTenCrewCourseD1(page)
  await page.reload()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()

  await page.getByRole("button", { name: "Apri vista lettura" }).click()
  const readView = page.getByRole("dialog", {
    name: "Vista lettura equipaggi",
  })
  await expect(readView.getByRole("listitem")).toHaveCount(D1_BOAT_COUNT)

  // 390×844: the frozen C6 target's own viewport. A denser, single-model
  // roster (four names per card instead of two) must still fit one screen.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: testInfo.outputPath("f3-crew-summary-d1-390x844.png"),
    fullPage: false,
  })
  const overflow390 = await readView.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }))
  expect(
    overflow390.scrollHeight,
    JSON.stringify(overflow390),
  ).toBeLessThanOrEqual(overflow390.clientHeight + 1)
  for (const card of await readView.getByRole("listitem").all()) {
    await expect(card).toBeInViewport()
  }

  // Four names a card, one model: the image is still the screen.
  await saveAndCheckSummaryImage(page, readView, testInfo, {
    name: "f4-crew-summary-d1",
  })
})

/**
 * A boat number is any text `normalizeBoatNumber` lets through, so "115",
 * "1234" and "A12" are real. The fixed 26px number column the C6 target draws
 * for two digits used to let them run into the first name; it now grows with
 * the group's widest number, on every card, and the image does the same.
 */
test("keeps boat numbers of three or four characters clear of the first name, on screen and in the image", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "One full synthetic long-number journey is sufficient",
  )
  test.setTimeout(60_000)
  const numbers = ["4", "115", "1234", "A12"]
  // CI’s Linux Chromium draws in DejaVu Sans, far wider than Segoe UI:
  // pin a wide font so a local pass means a CI pass (as in the V02 spec).
  await page.addInitScript(() => {
    document.documentElement.style.setProperty(
      "--font-sans",
      '"DejaVu Sans", Verdana, sans-serif',
    )
  })

  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 1" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()

  await seedTenCrewCourseD1(page, { numbers, membersPerCrew: 2 })
  await page.reload()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await page.getByRole("button", { name: "Apri vista lettura" }).click()
  const readView = page.getByRole("dialog", {
    name: "Vista lettura equipaggi",
  })
  await expect(readView.getByRole("listitem")).toHaveCount(numbers.length)

  /** Each card's number is fully drawn, on one line, ends before the first
   *  name starts, and the names of every card start the same distance in. */
  async function expectNumbersClearOfNames(where: string) {
    const nameOffsets: number[] = []
    for (const number of numbers) {
      const card = readView.getByRole("listitem", {
        name: new RegExp(`^Equipaggio \\d+, RS Toura ${number}$`),
      })
      const numberEl = card.getByText(number, { exact: true })
      const glyphs = await numberEl.evaluate((element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        const rect = range.getBoundingClientRect()
        return {
          right: rect.right,
          height: rect.height,
          fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        }
      })
      const nameBox = await card
        .getByText(/^Allievo\d+$/)
        .first()
        .boundingBox()
      const cardBox = await card.boundingBox()
      if (!nameBox || !cardBox) throw new Error(`No box for ${number}`)
      const context = `${where} ${number}: ${JSON.stringify({ glyphs, nameBox })}`
      expect(glyphs.right, context).toBeLessThanOrEqual(nameBox.x)
      expect(glyphs.scrollWidth, context).toBeLessThanOrEqual(
        glyphs.clientWidth,
      )
      // One line, not a number broken across two.
      expect(glyphs.height, context).toBeLessThan(glyphs.fontSize * 1.5)
      nameOffsets.push(nameBox.x - cardBox.x)
    }
    for (const offset of nameOffsets) {
      expect(
        Math.abs(offset - nameOffsets[0]!),
        `${where}: ${JSON.stringify(nameOffsets)}`,
      ).toBeLessThanOrEqual(1)
    }
  }
  async function expectNoHorizontalOverflow(where: string) {
    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }))
    expect(
      widths.document,
      `${where}: ${JSON.stringify(widths)}`,
    ).toBeLessThanOrEqual(widths.viewport + 1)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await expectNumbersClearOfNames("390")
  await page.screenshot({
    path: testInfo.outputPath("f3-crew-summary-long-numbers-390.png"),
    fullPage: false,
  })
  await page.setViewportSize({ width: 320, height: 664 })
  await expectNumbersClearOfNames("320")
  await expectNoHorizontalOverflow("320")
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await expectNumbersClearOfNames("320/200%")
  await expectNoHorizontalOverflow("320/200%")
  await page.screenshot({
    path: testInfo.outputPath("f3-crew-summary-long-numbers-320-200pct.png"),
    fullPage: false,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = ""
  })

  // In the wide pinned font too: the image is what the screen shows.
  await saveAndCheckSummaryImage(page, readView, testInfo, {
    name: "f4-crew-summary-long-numbers",
  })
})

/**
 * F3, offline read (owner, 2026-09-28): "readable on the water", where an
 * operator reopening the crew summary may already have lost connectivity.
 * `vite.config.ts`'s `BRAND_PRECACHED_IMAGES` gives the seven boat-model
 * marks that install-time guarantee in the real, built app (verified by
 * `scripts/check-ocr-offline.mjs`'s pattern of `context.setOffline` against a
 * production preview build). This suite runs against the plain Vite dev
 * server (`playwright.config.ts`'s `webServer`), which registers no service
 * worker at all, so the same precache cannot be exercised here. What this
 * test proves instead, deterministically and without a production build: a
 * boat-model `<img>` that already decoded once during this page's lifetime
 * keeps rendering from the browser's own in-page image cache — never the
 * `BoatModelHeaderMark` name-only fallback — when the read view is closed
 * and reopened while the browser is offline, the same guarantee the real
 * install's precache gives for a first offline open after an earlier one.
 */
test("keeps showing the boat-model logo in the read view after it was loaded once, even offline", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "Browser image-cache behaviour is Chromium-specific; one check is sufficient",
  )
  test.setTimeout(60_000)

  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 1" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()

  await seedTenCrewCourseD1(page)
  await page.reload()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()

  await page.getByRole("button", { name: "Apri vista lettura" }).click()
  const readView = page.getByRole("dialog", {
    name: "Vista lettura equipaggi",
  })
  const logo = readView.getByAltText(D1_BOAT_TYPE, { exact: true })
  await expect(logo).toBeVisible()
  await expect
    .poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0)

  // Close the read view through the app's own client-side navigation (no
  // full page reload), so React unmounts its `<img>`, then go offline: any
  // new network fetch from here on fails.
  await page.getByRole("button", { name: "Chiudi vista lettura" }).click()
  await context.setOffline(true)
  try {
    // Reopen the read view. React remounts an `<img>` pointing at the exact
    // same same-origin URL this page already decoded once above.
    await page.getByRole("button", { name: "Apri vista lettura" }).click()
    const reopenedLogo = readView.getByAltText(D1_BOAT_TYPE, { exact: true })
    await expect(reopenedLogo).toBeVisible()
    await expect
      .poll(() =>
        reopenedLogo.evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0)
    // Never the name-only text `BoatModelHeaderMark` falls back to when its
    // image errors.
    await expect(readView.getByText(D1_BOAT_TYPE, { exact: true })).toHaveCount(
      0,
    )
  } finally {
    await context.setOffline(false)
  }
})

/**
 * F4: "Scarica immagine riepilogo" is replaced by a floating "Salva immagine"
 * button. One tap saves the image (a screenshot of the summary's content, no
 * status bar, close button or save button) and copies it to the clipboard.
 */
async function openThirteenCrewSummary(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 1" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await seedThirteenCrewCourse(page)
  await page.reload()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await page.getByRole("button", { name: "Apri vista lettura" }).click()
  const view = page.getByRole("dialog", { name: "Vista lettura equipaggi" })
  await expect(view.getByRole("listitem")).toHaveCount(TOTAL_CREWS)
  return view
}

test("saves the 13-crew summary as a screenshot of the screen and copies the same image", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "One full synthetic 13-crew image journey is sufficient",
  )
  test.setTimeout(90_000)
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  const view = await openThirteenCrewSummary(page)
  await page.setViewportSize({ width: 390, height: 844 })

  const result = await saveAndCheckSummaryImage(page, view, testInfo, {
    name: "f4-crew-summary-13-crews",
    expectedNote: /^Immagine salvata e copiata\. Incollala su WhatsApp\.$/,
  })
  await expectLogosInImage(view, result)
  // Every group, below the 844 px fold or not, is in the image: thirteen
  // crews in five groups plus the closing note.
  expect(result.cssHeight).toBeGreaterThan(600)

  // The check above would also pass if its thresholds were loose. These are
  // what it must reject: a blank page, the right page 6 px out of place, and
  // the same page without colour. (The same page without its logos, and 2 px
  // out of place, are only measured: the logos have their own check below,
  // and 2 px is within what two renderers disagree on.)
  const cssHeight = Math.round(result.visibleHeight)
  const pixelWidth = Math.round(result.cssWidth * result.ratio)
  const pixelHeight = Math.round(cssHeight * result.ratio)
  const background = { r: 0xff, g: 0xfd, b: 0xf8 }
  const shiftedBy = (cssPixels: number) =>
    sharp(result.png)
      .extend({ top: Math.round(cssPixels * result.ratio), background })
      .extract({ left: 0, top: 0, width: pixelWidth, height: pixelHeight })
      .toBuffer()
  const logoBoxes = await view.locator("img").evaluateAll(
    (images, rootBox) =>
      images.map((image) => {
        const box = image.getBoundingClientRect()
        return {
          x: box.x - rootBox.x,
          y: box.y - rootBox.y,
          width: box.width,
          height: box.height,
        }
      }),
    result.root,
  )
  const wrongImages: Record<string, Buffer> = {
    blank: await sharp({
      create: {
        width: pixelWidth,
        height: pixelHeight,
        channels: 3,
        background,
      },
    })
      .png()
      .toBuffer(),
    shifted6px: await shiftedBy(6),

    shifted2px: await shiftedBy(2),
    withoutColour: await sharp(result.png).greyscale().toBuffer(),
    withoutLogos: await sharp(result.png)
      .composite(
        logoBoxes.map((box) => ({
          input: {
            create: {
              width: Math.round(box.width * result.ratio),
              height: Math.round(box.height * result.ratio),
              channels: 3,
              background,
            },
          },
          left: Math.round(box.x * result.ratio),
          top: Math.round(box.y * result.ratio),
        })),
      )
      .toBuffer(),
  }
  const measured: Record<string, unknown> = { faithful: result.difference }
  for (const [name, wrong] of Object.entries(wrongImages)) {
    const difference = await imageDifference(
      wrong,
      result.screenshot,
      result.cssWidth,
      cssHeight,
    )
    measured[name] = difference
    if (name === "shifted2px" || name === "withoutLogos") continue
    expect(
      difference.mean > MAX_MEAN_DIFFERENCE ||
        difference.share > MAX_DIFFERENT_SHARE ||
        difference.colour > MAX_COLOUR_DIFFERENCE,
      `${name} must be rejected: ${JSON.stringify(difference)}`,
    ).toBe(true)
  }
  testInfo.annotations.push({
    type: "difference",
    description: JSON.stringify(measured),
  })

  // The clipboard holds the same image, as an image.
  const copied = await page.evaluate(async () => {
    const items = await navigator.clipboard.read()
    const item = items[0]
    if (!item) return null
    const blob = await item.getType("image/png")
    const bitmap = await createImageBitmap(blob)
    return {
      types: item.types,
      width: bitmap.width,
      height: bitmap.height,
    }
  })
  const metadata = await sharp(result.png).metadata()
  expect(copied).toEqual({
    types: ["image/png"],
    width: metadata.width,
    height: metadata.height,
  })

  // The note goes away by itself.
  await expect(view.getByRole("status")).toHaveText("", { timeout: 10_000 })
})

test("keeps the boat logos in the saved image when the phone is offline", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "Browser network emulation is Chromium-specific; one check is sufficient",
  )
  test.setTimeout(90_000)
  const view = await openThirteenCrewSummary(page)
  await page.setViewportSize({ width: 390, height: 844 })
  const logos = view.locator("img")
  await expect(logos).toHaveCount(4)
  for (const logo of await logos.all()) {
    await expect
      .poll(() =>
        logo.evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0)
  }

  await context.setOffline(true)
  try {
    // A different width than the image may already have been prepared for, so
    // the tap has to make a new one, with no network.
    await page.setViewportSize({ width: 384, height: 844 })
    const result = await saveAndCheckSummaryImage(page, view, testInfo, {
      name: "f4-crew-summary-offline",
    })
    await expectLogosInImage(view, result)
  } finally {
    await context.setOffline(false)
  }
})

test("keeps the floating save button clear of the last card, the close button and the page width", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "One full synthetic layout journey is sufficient",
  )
  test.setTimeout(120_000)
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  const view = await openThirteenCrewSummary(page)

  await page.setViewportSize({ width: 390, height: 844 })
  await expectSaveButtonLayout(view, "390×844")
  await page.setViewportSize({ width: 320, height: 664 })
  await expectSaveButtonLayout(view, "320×664")
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await expectSaveButtonLayout(view, "320×664 / 200% text")

  await captureSaveButtonWithNote(page, view, "f4-crew-summary")
})

test("makes the image in WebKit too, with the boat logos", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "iphone-13-webkit-core",
    "WebKit renders foreignObject differently from Chromium; checked there",
  )
  test.setTimeout(120_000)
  const view = await openThirteenCrewSummary(page)
  // Playwright's WebKit is not an iPhone: no share sheet, so the image is
  // downloaded; the copy goes to its clipboard all the same.
  const result = await saveAndCheckSummaryImage(page, view, testInfo, {
    name: "f4-crew-summary-13-crews-webkit",
  })
  await expectLogosInImage(view, result)
  expect(result.ratio).toBe(3)
})
