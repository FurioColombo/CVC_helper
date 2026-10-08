import { expect, type Locator, type Page, test } from "@playwright/test"

import {
  auditWhileScrolling,
  expectCleanWhileScrolling,
  expectNoSidewaysScroll,
  type LayoutAudit,
} from "./layout-audit"
import {
  HOSTILE_CREWS,
  HOSTILE_SESSION,
  HOSTILE_STUDENTS,
  HOSTILE_VOLUNTEERS,
  seedHostileRoster,
} from "./ug2-hostile-roster-data"

/**
 * UG2 field-UX review fixes (UG2-UX-1, -4, -5, -7, -9), through the visible
 * app. Only fictitious people. Every layout is measured at the sizes a phone
 * has (412, 390, 360 px), at 320 px, and at 320 px with 200% text.
 */

const PROFILES = [
  { name: "412x915", width: 412, height: 915, fontSize: "" },
  { name: "390x844", width: 390, height: 844, fontSize: "" },
  { name: "360x780", width: 360, height: 780, fontSize: "" },
  { name: "320", width: 320, height: 664, fontSize: "" },
  { name: "320-200pct", width: 320, height: 664, fontSize: "200%" },
] as const
type Profile = (typeof PROFILES)[number]

async function applyProfile(
  page: Page,
  profile: Pick<Profile, "width" | "height"> & { fontSize: string },
) {
  await page.setViewportSize({ width: profile.width, height: profile.height })
  await page.evaluate((fontSize) => {
    document.documentElement.style.fontSize = fontSize
  }, profile.fontSize)
}

async function createCourse(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
}

async function openHostileCourse(page: Page) {
  await createCourse(page)
  await seedHostileRoster(page)
  await page.reload()
}

const nav = (page: Page) =>
  page.getByRole("navigation", { name: "Navigazione principale" })

const area = (page: Page, name: string) =>
  page.getByLabel("Aree del corso").getByRole("button", { name, exact: true })

/** The long names no column can hold: a line may break these in the middle
 *  (R05, the same allowance the hostile-roster spec makes), no other word. */
const LONG_WORDS = new Set(
  [
    ...HOSTILE_STUDENTS.map(
      ({ firstName, surname }) => `${firstName} ${surname}`,
    ),
    ...HOSTILE_VOLUNTEERS.map(({ name }) => name),
  ]
    .flatMap((name) => name.split(/\s+/))
    .filter((word) => word.length >= 13),
)

// ---------------------------------------------------------------- UG2-UX-1

/** Fictitious ordinary course: the names the review saw cut to initials. */
const REVIEW_NAMES = [
  ["Marta", "Bruno", "female", 24],
  ["Federico", "Conti", "male", 31],
  ["Chiara", "De Luca", "female", 17],
  ["Matteo Maria", "Ferrari", "male", 29],
  ["Anna Lisa", "Gallo", "female", 45],
  ["Edoardo", "Greco", "male", 22],
  ["Giorgia", "Lombardi", "female", 27],
  ["Alessandro", "Marino", "male", 35],
  ["Valentina", "Barbieri", "female", 26],
  ["Davide", "Rinaldi", "male", 19],
  ["Elena", "Sala", "female", 33],
  ["Giulia", "Bianchi", "female", 16],
] as const

/** Seeds the names above through the app's persistence, one duty day each. */
async function seedReviewNames(page: Page) {
  await page.evaluate(async (people) => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { getActiveCourse } = await load("/src/persistence/courses.ts")
    const { createStudents } = await load("/src/persistence/students.ts")
    const { saveDutyPlan } = await load("/src/persistence/duties.ts")
    const course = await getActiveCourse()
    const created = await createStudents(
      course.id,
      people.map(([firstName, surname, sex, age]) => ({
        firstName,
        surname,
        nickname: null,
        dateOfBirth: "",
        declaredAgeAtCourseStart: age,
        sex,
        phone: null,
        size: "M",
        initialNote: null,
        courseNote: null,
      })),
    )
    const days = [
      "saturday",
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
    ]
    await saveDutyPlan(
      course.id,
      created.map((student: { id: string }, index: number) => ({
        dayId: days[index % 7],
        studentId: student.id,
      })),
      {
        desiredPerDay: 2,
        fewerDayIds: [],
        extraDayIds: ["sunday", "monday", "tuesday", "wednesday", "thursday"],
        balanceMinors: false,
        balanceSex: false,
        tieBreaker: "alphabetical",
        stayOverStudentIds: [],
        completedDayIds: [],
        acknowledgedWarningKeys: [],
      },
    )
  }, REVIEW_NAMES)
  await page.reload()
}

async function openDay(page: Page, label: RegExp) {
  await area(page, "Comandate").click()
  const plan = page.getByRole("region", { name: "Piano comandate" })
  await expect(plan).toBeVisible()
  await plan.getByRole("button", { name: label }).first().click()
  await expect(
    page.getByRole("heading", { name: /^Comandata /, level: 1 }),
  ).toBeVisible()
}

/**
 * What the person tapping a name needs: every card's name is drawn whole (no
 * ellipsis, nothing cut by the card or an ancestor, every word of it inside
 * the card), and no word of an ordinary length is broken in the middle.
 */
async function expectNamesWhole(page: Page, where: string) {
  const cards = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        "section[aria-label^='Allievi comandata'] article",
      ),
    ).map((card) => {
      const box = card.getBoundingClientRect()
      const nameElement = card.firstElementChild as HTMLElement
      const text = nameElement.getAttribute("title") ?? ""
      // The text and the boxes that hold it, not the "+" drawing beside it.
      const styles = Array.from(nameElement.querySelectorAll("*"))
        .filter((node) => !(node instanceof SVGElement))
        .concat(nameElement)
        .map((node) => getComputedStyle(node))
      const range = document.createRange()
      range.selectNodeContents(nameElement)
      const rects = Array.from(range.getClientRects()).filter(
        (rect) => rect.width > 0,
      )
      // Where each word of the name is drawn, one entry per piece of a word.
      const words: Array<{ word: string; pieces: number }> = []
      const walker = document.createTreeWalker(
        nameElement,
        NodeFilter.SHOW_TEXT,
      )
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const data = (node as Text).data
        for (const match of data.matchAll(/\S+/gu)) {
          range.setStart(node, match.index)
          range.setEnd(node, match.index + match[0].length)
          const pieces = Array.from(range.getClientRects()).filter(
            (rect) => rect.width > 0,
          )
          words.push({
            word: match[0],
            pieces: new Set(pieces.map((piece) => Math.round(piece.top))).size,
          })
        }
      }
      return {
        text,
        ellipsis: styles.some((style) => style.textOverflow === "ellipsis"),
        clipped: styles.some((style) => style.overflowX !== "visible"),
        selfOverflow: nameElement.scrollWidth - nameElement.clientWidth,
        outside: rects.some(
          (rect) => rect.left < box.left - 1 || rect.right > box.right + 1,
        ),
        words,
        shown: nameElement.textContent?.trim() ?? "",
      }
    }),
  )
  expect(cards.length, `${where}: cards`).toBeGreaterThan(0)
  for (const card of cards) {
    const here = `${where}: "${card.text}"`
    expect(card.shown, here).toBe(card.text)
    expect(card.ellipsis, `${here} has an ellipsis`).toBe(false)
    expect(card.clipped, `${here} is clipped`).toBe(false)
    expect(
      card.selfOverflow,
      `${here} is wider than its box`,
    ).toBeLessThanOrEqual(1)
    expect(card.outside, `${here} is drawn outside its card`).toBe(false)
    for (const { word, pieces } of card.words) {
      if (LONG_WORDS.has(word)) continue
      expect(pieces, `${here}: "${word}" is broken in the middle`).toBe(1)
    }
  }
}

function expectNoTruncation(audit: LayoutAudit, where: string) {
  expect(audit.truncated, `${where}: a word is cut`).toEqual([])
  expect(
    audit.brokenWords.filter((word) => !LONG_WORDS.has(word)),
    `${where}: a word a line broke in the middle`,
  ).toEqual([])
}

const DAY_PAGE_AUDIT = {
  // The name and the remove button of a student card are a dense repeated
  // group (R04 allows 40 px); the rest of the page keeps 44.
  denseControls: "article button",
  minDenseControl: 40,
}

test("UG2-UX-1: the day-edit page of Comandate shows every name whole at 412, 390, 360 and 320 px, and at 320 px with 200% text", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "The page layout is the same in every engine; one run measures it",
  )
  test.setTimeout(240_000)
  await createCourse(page)
  await seedReviewNames(page)
  await openDay(page, /Sabato/)
  // The two sections the review measured: this day's own list (a card whose
  // name is a plain label) and "Assegnati ad altri giorni" (a button).
  await expect(
    page.getByRole("region", { name: "Assegnati ad altri giorni" }),
  ).toBeVisible()
  for (const profile of PROFILES) {
    await applyProfile(page, profile)
    const where = `review names, ${profile.name}`
    await expectNamesWhole(page, where)
    const audit = await expectCleanWhileScrolling(
      page.locator("main"),
      null,
      where,
      DAY_PAGE_AUDIT,
    )
    expectNoTruncation(audit, where)
    await expectNoSidewaysScroll(page, where)
    // The full first name of "Federico", "Matteo Maria" and the rest is drawn:
    // 360 px is where it was a single letter.
    for (const [firstName] of REVIEW_NAMES) {
      const word = firstName.split(" ")[0]!
      expect(audit.truncated, `${where}: ${word}`).not.toContain(word)
    }
  }
})

test("UG2-UX-1: the day-edit page keeps long and double names whole on the hostile roster, in every section and at every size", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "The page layout is the same in every engine; one run measures it",
  )
  test.setTimeout(300_000)
  await openHostileCourse(page)
  // Tuesday has its own list, "never assigned" (the two Anna Maria) and every
  // other day's students under "elsewhere".
  await openDay(page, /Martedì/)
  await expect(
    page.getByRole("region", { name: "Mai assegnati" }),
  ).toBeVisible()
  for (const profile of PROFILES) {
    await applyProfile(page, profile)
    const where = `hostile roster, ${profile.name}`
    await expectNamesWhole(page, where)
    const audit = await expectCleanWhileScrolling(
      page.locator("main"),
      null,
      where,
      DAY_PAGE_AUDIT,
    )
    expectNoTruncation(audit, where)
    await expectNoSidewaysScroll(page, where)
  }
  // Student names that are one 22-letter word wrap inside the card: all of the
  // letters are drawn.
  await applyProfile(page, PROFILES[2])
  const first = page.getByRole("button", {
    name: /^Alessandromassimiliano/,
  })
  await first.scrollIntoViewIfNeeded()
  const box = await first.boundingBox()
  expect(box!.width).toBeGreaterThan(100)
})

// ---------------------------------------------------------------- UG2-UX-4

test("UG2-UX-4: the phone's Back from the session boats panel returns to the crew composition, not to Home", async ({
  page,
}) => {
  test.setTimeout(180_000)
  await openHostileCourse(page)
  await area(page, "Equipaggi").click()
  await page
    .getByRole("combobox", { name: "Sessione" })
    .selectOption(HOSTILE_SESSION)
  const crews = page.getByRole("region", { name: "Equipaggi della sessione" })
  const boatsPanel = page.getByRole("region", { name: "Barche della sessione" })
  const boatsTitle = page.getByRole("heading", { name: "Barche in uscita" })
  await expect(crews.getByRole("article")).toHaveCount(HOSTILE_CREWS.length)
  const home = page.getByRole("heading", { name: /D2 - \d+ \| \d{4}/ })

  // The header's helm icon: Back closes the panel and the composition is
  // back, with its crews, on the same session.
  await page.getByRole("button", { name: "Apri barche della sessione" }).click()
  await expect(boatsTitle).toBeVisible()
  await expect(boatsPanel).toBeVisible()
  await expect(crews).toHaveCount(0)
  await page.goBack()
  await expect(boatsPanel).toHaveCount(0)
  await expect(crews).toBeVisible()
  await expect(page.getByRole("combobox", { name: "Sessione" })).toHaveValue(
    HOSTILE_SESSION,
  )
  await expect(home).toHaveCount(0)

  // The "Barche nell'uscita" row of the composition does the same.
  await page.getByRole("button", { name: "Gestisci barche in uscita" }).click()
  await expect(boatsPanel).toBeVisible()
  await page.goBack()
  await expect(boatsPanel).toHaveCount(0)
  await expect(crews).toBeVisible()

  // Pressing the helm icon again inside the panel adds no second entry: one
  // Back is enough.
  await page.getByRole("button", { name: "Apri barche della sessione" }).click()
  await expect(boatsPanel).toBeVisible()
  await page.getByRole("button", { name: "Apri barche della sessione" }).click()
  await page.goBack()
  await expect(crews).toBeVisible()

  // The visible "Torna agli equipaggi" leaves the history as it was: a Back
  // after it goes to Home, as from the composition.
  await page.getByRole("button", { name: "Apri barche della sessione" }).click()
  await page.getByRole("button", { name: "Torna agli equipaggi" }).click()
  await expect(boatsPanel).toHaveCount(0)
  await expect(crews).toBeVisible()

  // A reload inside the panel reopens the panel, like the other nested
  // screens (the app opens the area on its default session after a reload,
  // Sabato PM), and Back from there still reaches the composition.
  await page.getByRole("button", { name: "Apri barche della sessione" }).click()
  await expect(boatsPanel).toBeVisible()
  await page.reload()
  await expect(boatsPanel).toBeVisible()
  await page.goBack()
  await expect(boatsPanel).toHaveCount(0)
  await expect(page.getByRole("combobox", { name: "Sessione" })).toBeVisible()

  await page.goBack()
  await expect(home).toBeVisible()
})

// ---------------------------------------------------------------- UG2-UX-7

type ContrastFailure = {
  text: string
  ratio: number
  needed: number
  color: string
  background: string
}

/**
 * WCAG 2.x contrast of every drawn word under `rootSelector`, measured from
 * the computed colours in the page: the text colour (with the opacity of its
 * ancestors) against the background that is actually behind it (the nearest
 * ancestors' backgrounds composited, then the page's white). Disabled controls
 * are exempt (WCAG 1.4.3), as is text over a gradient or an image, which this
 * does not model (listed in `unmeasured`). Large text (24 px, or 18.66 px and
 * bold) needs 3:1, the rest 4.5:1.
 */
async function measureTextContrast(page: Page, rootSelector: string) {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector)
    if (!root) throw new Error(`no ${selector}`)
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const context = canvas.getContext("2d", { willReadFrequently: true })!
    type Colour = [number, number, number, number]
    const parse = (css: string): Colour => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = "#000000"
      context.fillStyle = css
      context.fillRect(0, 0, 1, 1)
      const data = context.getImageData(0, 0, 1, 1).data
      return [data[0]!, data[1]!, data[2]!, data[3]! / 255]
    }
    const over = (top: Colour, bottom: Colour): Colour => {
      const alpha = top[3] + bottom[3] * (1 - top[3])
      return [0, 1, 2]
        .map(
          (i) =>
            (top[i]! * top[3] + bottom[i]! * bottom[3] * (1 - top[3])) /
            (alpha || 1),
        )
        .concat(alpha) as Colour
    }
    const luminance = ([r, g, b]: Colour) => {
      const channel = (value: number) => {
        const unit = value / 255
        return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }
    const ratioOf = (first: Colour, second: Colour) => {
      const [high, low] = [luminance(first), luminance(second)].sort(
        (a, b) => b - a,
      ) as [number, number]
      return (high + 0.05) / (low + 0.05)
    }
    const show = (colour: Colour) =>
      `rgba(${colour.slice(0, 3).map(Math.round).join(",")},${Math.round(colour[3] * 100) / 100})`

    const failures: ContrastFailure[] = []
    const unmeasured: string[] = []
    let measured = 0
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? "").replace(/\s+/g, " ").trim()
      const element = node.parentElement
      if (!text || !element) continue
      const style = getComputedStyle(element)
      if (style.display === "none" || style.visibility === "hidden") continue
      // aria-hidden text is still drawn (the course year is): only what is
      // not drawn is skipped.
      if (element.closest(".sr-only, [hidden]")) continue
      if (element.closest("[disabled], [aria-disabled='true']")) continue

      let opacity = 1
      let background: Colour = [0, 0, 0, 0]
      let gradient = false
      for (
        let ancestor: Element | null = element;
        ancestor;
        ancestor = ancestor.parentElement
      ) {
        const own = getComputedStyle(ancestor)
        opacity *= Number(own.opacity)
        if (background[3] < 1) {
          if (own.backgroundImage !== "none") gradient = true
          background = over(background, parse(own.backgroundColor))
        }
      }
      if (gradient) {
        unmeasured.push(text.slice(0, 30))
        continue
      }
      background = over(background, [255, 255, 255, 1])
      const textColour = parse(style.color)
      const drawn = over(
        [textColour[0], textColour[1], textColour[2], textColour[3] * opacity],
        background,
      )
      const size = parseFloat(style.fontSize)
      const bold = Number(style.fontWeight) >= 700
      const needed = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5
      const ratio = ratioOf(drawn, background)
      measured += 1
      if (ratio < needed) {
        failures.push({
          text: text.slice(0, 40),
          ratio: Math.round(ratio * 100) / 100,
          needed,
          color: show(drawn),
          background: show(background),
        })
      }
    }
    return { failures, unmeasured, measured }
  }, rootSelector)
}

test("UG2-UX-7: the course year beside the course code reads at 4.5:1 on Home and in Settings", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "A colour, the same in every engine",
  )
  await createCourse(page)
  await expect(page.locator(".course-identity > span").first()).toHaveText(
    /\| \d{4}/,
  )
  const onHome = await measureTextContrast(page, ".course-identity")
  expect(onHome.measured).toBeGreaterThan(0)
  expect(onHome.failures, "Home").toEqual([])
  await page.getByRole("button", { name: "Impostazioni", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Impostazioni" }),
  ).toBeVisible()
  const inSettings = await measureTextContrast(page, "main")
  expect(inSettings.failures, "Settings").toEqual([])
})

test("UG2-UX-7: every word of the crew summary reads at WCAG AA contrast, the small labels included", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "A colour, the same in every engine",
  )
  test.setTimeout(180_000)
  await openHostileCourse(page)
  await area(page, "Equipaggi").click()
  await page
    .getByRole("combobox", { name: "Sessione" })
    .selectOption(HOSTILE_SESSION)
  await expect(
    page
      .getByRole("region", { name: "Equipaggi della sessione" })
      .getByRole("article"),
  ).toHaveCount(HOSTILE_CREWS.length)
  await page.getByRole("button", { name: "Apri vista lettura" }).click()
  const summary = page.getByRole("dialog", { name: /Vista lettura equipaggi/ })
  await expect(summary).toBeVisible()
  const result = await measureTextContrast(
    page,
    "[role='dialog'][aria-modal='true']",
  )
  expect(result.measured).toBeGreaterThan(40)
  expect(result.failures, "crew summary").toEqual([])
})

test("UG2-UX-7: every word of the Comandate summary reads at WCAG AA contrast, the small labels included", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "A colour, the same in every engine",
  )
  test.setTimeout(180_000)
  await openHostileCourse(page)
  await area(page, "Comandate").click()
  await page.getByRole("button", { name: "Apri riepilogo comandate" }).click()
  const summary = page.getByRole("dialog", { name: "Vista lettura comandate" })
  await expect(summary.getByRole("listitem")).toHaveCount(7)
  const result = await measureTextContrast(
    page,
    "[role='dialog'][aria-modal='true']",
  )
  expect(result.measured).toBeGreaterThan(40)
  expect(result.failures, "Comandate summary").toEqual([])
})

/**
 * WCAG 1.4.11: the keyboard focus indicator against what it is drawn on. The
 * ring is a `box-shadow` spread; its colour (with its alpha) is the custom
 * property the utility sets, composited over the colour behind the control.
 */
async function measureFocusRing(page: Page, control: Locator) {
  await control.scrollIntoViewIfNeeded()
  // The ring only shows for keyboard focus: a Tab first puts the page in
  // keyboard modality, then the control is focused.
  await page.keyboard.press("Tab")
  await control.focus()
  return control.evaluate((element) => {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const context = canvas.getContext("2d", { willReadFrequently: true })!
    type Colour = [number, number, number, number]
    const parse = (css: string): Colour => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = "#000000"
      context.fillStyle = css
      context.fillRect(0, 0, 1, 1)
      const data = context.getImageData(0, 0, 1, 1).data
      return [data[0]!, data[1]!, data[2]!, data[3]! / 255]
    }
    const over = (top: Colour, bottom: Colour): Colour => {
      const alpha = top[3] + bottom[3] * (1 - top[3])
      return [0, 1, 2]
        .map(
          (i) =>
            (top[i]! * top[3] + bottom[i]! * bottom[3] * (1 - top[3])) /
            (alpha || 1),
        )
        .concat(alpha) as Colour
    }
    const luminance = ([r, g, b]: Colour) => {
      const channel = (value: number) => {
        const unit = value / 255
        return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }
    const ratioOf = (first: Colour, second: Colour) => {
      const [high, low] = [luminance(first), luminance(second)].sort(
        (a, b) => b - a,
      ) as [number, number]
      return (high + 0.05) / (low + 0.05)
    }
    const style = getComputedStyle(element)
    const ringCss = style.getPropertyValue("--tw-ring-color").trim()
    // What is behind the control: the nearest backgrounds up the tree.
    let behind: Colour = [0, 0, 0, 0]
    for (
      let ancestor: Element | null = element.parentElement;
      ancestor && behind[3] < 1;
      ancestor = ancestor.parentElement
    ) {
      behind = over(behind, parse(getComputedStyle(ancestor).backgroundColor))
    }
    behind = over(behind, [255, 255, 255, 1])
    const ring = over(parse(ringCss), behind)
    return {
      ringCss,
      focusVisible: element.matches(":focus-visible"),
      ratio: Math.round(ratioOf(ring, behind) * 100) / 100,
    }
  })
}

test("UG2-UX-7: the keyboard focus ring is at least 3:1 against what is behind it, on the controls the review measured", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "A colour, the same in every engine",
  )
  test.setTimeout(180_000)
  await openHostileCourse(page)
  const onHome: Array<[string, Locator]> = [
    [
      "a header icon button (Home)",
      page.getByRole("button", { name: "Impostazioni", exact: true }),
    ],
    [
      "the bottom navigation",
      nav(page).getByRole("button", { name: "Equipaggi" }),
    ],
  ]
  for (const [where, control] of onHome) {
    const ring = await measureFocusRing(page, control)
    expect(ring.focusVisible, where).toBe(true)
    expect(ring.ratio, `${where}: ${ring.ringCss}`).toBeGreaterThanOrEqual(3)
  }
  await area(page, "Comandate").click()
  await page
    .getByRole("region", { name: "Piano comandate" })
    .getByRole("button", { name: /Sabato/ })
    .first()
    .click()
  const onDay: Array<[string, Locator]> = [
    [
      "Segna completata (the shared Button)",
      page.getByRole("button", { name: "Segna completata" }),
    ],
    [
      "a student name on the day page",
      page.getByRole("button", { name: /^Øystein/ }),
    ],
    [
      "a remove button",
      page.getByRole("button", { name: /^Rimuovi Øystein/ }).first(),
    ],
  ]
  for (const [where, control] of onDay) {
    const ring = await measureFocusRing(page, control)
    expect(ring.focusVisible, where).toBe(true)
    expect(ring.ratio, `${where}: ${ring.ringCss}`).toBeGreaterThanOrEqual(3)
  }
})

// ---------------------------------------------------------------- UG2-UX-9

test("UG2-UX-9: the paste review names its fields by row number and visible letters, and a refused save raises one alert", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await createCourse(page)
  await page.getByRole("button", { name: "Allievi", exact: true }).click()
  await page.getByRole("button", { name: "Scan allievi", exact: true }).click()
  await page
    .getByRole("button", { name: "Oppure usa un assistente", exact: true })
    .click()
  // Fictitious names a reader cannot take for a man's or a woman's: every row
  // lacks its sex, so a save is refused for all of them.
  const rows = [
    "Brux;Kelm",
    "Dorv;Plin",
    "Ezk;Tavr",
    "Fonz;Quil",
    "Gref;Zond",
    "Hask;Vrel",
    "Jorn;Wick",
    "Kyl;Xan",
  ]
  const answer = [
    "CVC-ALLIEVI v1",
    "Cognome;Nome;Data di nascita;Età;Telefono",
    ...rows.map((row) => `${row};12/04/2011;15;`),
    "FINE",
  ].join("\n")
  await page.getByLabel("Risposta dell’assistente").fill(answer)
  await page.getByRole("button", { name: "Leggi risposta" }).click()
  await expect(
    page.getByRole("heading", { name: "Controlla prima di salvare" }),
  ).toBeVisible()
  const review = page.getByRole("region", { name: "Allievi estratti" })
  await expect(review.getByRole("article")).toHaveCount(rows.length)

  // The accessible names, as the accessibility tree has them.
  const tree = await review.ariaSnapshot()
  expect(tree, "an internal row id in a name").not.toMatch(/paste-|line-/)
  for (const number of [1, 4, rows.length]) {
    expect(tree).toContain(`textbox "Nome riga ${number}"`)
    expect(tree).toContain(`textbox "Cognome riga ${number}"`)
    expect(tree).toContain(`textbox "Età riga ${number}"`)
  }
  // Each sex radio is named with the letters it shows ("M", "F", "Alt"):
  // saying "F" to a voice command finds it (WCAG 2.5.3).
  for (const [shown, name] of [
    ["M", "M — uomo"],
    ["F", "F — donna"],
    ["Alt", "Alt — altro"],
  ] as const) {
    const radios = review.getByRole("radio", { name, exact: true })
    await expect(radios).toHaveCount(rows.length)
    expect(
      await radios.first().evaluate((radio, letters) => {
        const visible = radio.closest("label")?.textContent?.trim()
        return {
          visible,
          label: radio.getAttribute("aria-label") ?? "",
          letters,
        }
      }, shown),
    ).toMatchObject({ visible: shown })
    expect(name.startsWith(shown)).toBe(true)
  }
  expect(tree).toContain('radio "M — uomo"')
  expect(tree).not.toMatch(/radio "(Uomo|Donna|Altro)"/)

  // Refuse the save for every row: one alert, and per-row text that is not an
  // alert but names the row and what it lacks.
  await page
    .getByRole("button", { name: `Aggiungi ${rows.length} allievi` })
    .click()
  // (The screen's separate "Sono tutti" count question is an alert of its own,
  // as before: only the refusal's alerts are counted here.)
  const alerts = page
    .getByRole("alert")
    .filter({ hasText: "Prima di aggiungere" })
  await expect(alerts).toHaveCount(1)
  await expect(alerts).toHaveText(
    `Prima di aggiungere, correggi le righe ${rows.map((_, i) => i + 1).join(", ")}.`,
  )
  await expect(review.getByRole("alert")).toHaveCount(0)
  for (const number of [1, rows.length]) {
    await expect(
      review.getByText(`Allievo ${number}: completa sesso.`),
    ).toBeVisible()
  }
  // Choosing the sex in one row fixes that row's problem text on the next
  // attempt: the alert then lists one row fewer.
  await review
    .getByRole("article")
    .first()
    .getByRole("radio", { name: "M — uomo" })
    .check({ force: true })
  await page
    .getByRole("button", { name: `Aggiungi ${rows.length} allievi` })
    .click()
  await expect(alerts).toHaveCount(1)
  await expect(alerts).toHaveText(
    `Prima di aggiungere, correggi le righe ${rows
      .slice(1)
      .map((_, i) => i + 2)
      .join(", ")}.`,
  )
})

// ---------------------------------------------------------------- UG2-UX-5

/**
 * The hostile course with what Volontari, Valutazioni and the student profile
 * need to show something: a rating on most sessions of the first days (some
 * with a long note), and a phone and two notes on every student.
 */
async function seedProfilesAndEvaluations(page: Page) {
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { getActiveCourse } = await load("/src/persistence/courses.ts")
    const { listStudents, updateStudent } = await load(
      "/src/persistence/students.ts",
    )
    const { saveEvaluation } = await load("/src/persistence/evaluations.ts")
    const course = await getActiveCourse()
    const students = await listStudents(course.id)
    const sessions = ["sat-pm", "sun-am", "sun-pm", "mon-am", "tue-pm"]
    const values = ["++", "+", "=", "-", "--"]
    for (let i = 0; i < students.length; i += 1) {
      const student = students[i]
      await updateStudent(student.id, course.id, {
        firstName: student.firstName,
        surname: student.surname,
        nickname: student.nickname,
        dateOfBirth: student.dateOfBirth,
        declaredAgeAtCourseStart: student.declaredAgeAtCourseStart,
        sex: student.sex,
        phone: "+39 333 123 4567",
        size: student.size,
        initialNote: "Esperienza di derive su laser in lago e vela leggera",
        courseNote: "Migliora nelle virate ma deve tenere la randa più chiusa",
      })
      for (let s = 0; s < sessions.length; s += 1) {
        if ((i + s) % 3 === 2) continue
        await saveEvaluation(course.id, student.id, sessions[s], {
          value: values[(i * 2 + s) % 5],
          note: (i + s) % 4 === 0 ? "Buona partenza e virata pulita" : null,
        })
      }
    }
  })
  await page.reload()
}

const EVALUATION_AUDIT = {
  // The rating buttons and the name that opens the note are a dense group
  // (R04 allows 40 px); the calendar cells of the weekly grid are 28 px high
  // by the design of P04/P18 (they are not controls for a thumb), so the
  // general minimum here is the WCAG 2.2 AA one.
  denseControls:
    "[aria-label^='Valutazione di'], [aria-label*='nota valutazione']",
  minDenseControl: 40,
  minControl: 24,
}

/**
 * `expectCleanWhileScrolling`, minus one known thing: the two-mark cells of
 * the weekly grid (++, --) draw 2-3 px wider than their cell, at every size
 * (the P04/P18 design: a mark is a drawing the size of its text, the cell a
 * share of the card). Nothing is cut or covered by it; every other finding of
 * the audit, the grid's included, still fails.
 */
async function expectCleanEvaluationPage(page: Page, where: string) {
  const audit = await auditWhileScrolling(
    page.locator("main"),
    null,
    EVALUATION_AUDIT,
  )
  const markOvershoot =
    /(?:AM|PM)[^\]]*\] is wider inside \((\d+)\) than outside \((\d+)\)/
  const issues = audit.issues.filter((issue) => {
    const match = markOvershoot.exec(issue)
    return !match || Number(match[1]) - Number(match[2]) > 3
  })
  expect(issues, `${where}: ${JSON.stringify(audit.stats)}`).toEqual([])
  return audit
}

type UxPage = {
  name: string
  open: (page: Page) => Promise<void>
  /** When the names must be whole (no ellipsis, no word broken in the middle):
   *  at every size, or only when text is enlarged to 200% (a Valutazioni row
   *  keeps its name and five marks on one line at ordinary text, and a long
   *  surname there ends in an ellipsis, as the review accepted). */
  wholeNames: "always" | "enlarged"
}

const UX5_PAGES: UxPage[] = [
  {
    name: "Volontari",
    open: async (page) => {
      await area(page, "Volontari").click()
      await expect(
        page.getByRole("heading", { name: "Volontari", level: 1 }),
      ).toBeVisible()
    },
    wholeNames: "always",
  },
  {
    name: "Valutazioni, Allievi",
    open: async (page) => {
      await area(page, "Valutazioni").click()
      await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")
      await expect(
        page.getByRole("button", { name: /^Valutazione di .*: \+\+$/ }).first(),
      ).toBeVisible()
    },
    wholeNames: "enlarged",
  },
  {
    name: "Valutazioni, Equipaggi",
    open: async (page) => {
      await area(page, "Valutazioni").click()
      await page
        .getByLabel("Sessione valutazioni")
        .selectOption(HOSTILE_SESSION)
      await page
        .getByRole("group", { name: "Vista valutazioni" })
        .getByRole("button", { name: "Equipaggi" })
        .click()
      await expect(
        page.getByRole("button", { name: /^Valutazione di .*: \+\+$/ }).first(),
      ).toBeVisible()
    },
    wholeNames: "enlarged",
  },
  {
    name: "Valutazioni, Riepilogo",
    open: async (page) => {
      await area(page, "Valutazioni").click()
      await page
        .getByRole("group", { name: "Vista valutazioni" })
        .getByRole("button", { name: "Riepilogo" })
        .click()
      await expect(
        page.getByRole("heading", { name: "Riepilogo del corso" }),
      ).toBeVisible()
    },
    wholeNames: "enlarged",
  },
]

test("UG2-UX-5: Volontari and Valutazioni (Allievi, Equipaggi, Riepilogo) fit the screen with every name whole, at 412, 390, 360 and 320 px and at 320 px with 200% text", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "The page layout is the same in every engine; one run measures it",
  )
  test.setTimeout(600_000)
  await openHostileCourse(page)
  await seedProfilesAndEvaluations(page)
  for (const uxPage of UX5_PAGES) {
    for (const profile of PROFILES) {
      await applyProfile(page, { ...profile, fontSize: "" })
      await nav(page).getByRole("button", { name: "Home", exact: true }).click()
      await uxPage.open(page)
      await applyProfile(page, profile)
      const where = `${uxPage.name}, ${profile.name}`
      await expectNoSidewaysScroll(page, where)
      const audit = uxPage.name.startsWith("Valutazioni")
        ? await expectCleanEvaluationPage(page, where)
        : await expectCleanWhileScrolling(page.locator("main"), null, where)
      if (
        uxPage.wholeNames === "always" ||
        (profile.fontSize === "200%" && uxPage.wholeNames === "enlarged")
      ) {
        // R05: a name goes on to a second line, it is not cut.
        expect(audit.truncated, `${where}: a word is cut`).toEqual([])
        expect(
          audit.brokenWords.filter((word) => !LONG_WORDS.has(word)),
          `${where}: a word a line broke in the middle`,
        ).toEqual([])
      }
    }
  }
})

test("UG2-UX-5: the student profile fits the screen at 412, 390, 360 and 320 px and at 320 px with 200% text, long names and the weekly grid included", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "The page layout is the same in every engine; one run measures it",
  )
  test.setTimeout(600_000)
  await openHostileCourse(page)
  await seedProfilesAndEvaluations(page)
  // A long single first name, a triple first name, a name with an apostrophe
  // and an ordinary one.
  for (const index of [0, 4, 21, 36]) {
    for (const profile of PROFILES) {
      await applyProfile(page, { ...profile, fontSize: "" })
      await nav(page).getByRole("button", { name: "Home", exact: true }).click()
      await area(page, "Allievi").click()
      await page
        .getByRole("region", { name: "Elenco allievi" })
        .getByRole("button")
        .nth(index)
        .click()
      await expect(
        page.getByRole("region", { name: "Storico valutazioni" }),
      ).toBeVisible()
      await applyProfile(page, profile)
      const where = `profile ${index}, ${profile.name}`
      await expectNoSidewaysScroll(page, where)
      const audit = await expectCleanEvaluationPage(page, where)
      if (profile.fontSize === "200%") {
        expect(audit.truncated, `${where}: a word is cut`).toEqual([])
        expect(
          audit.brokenWords.filter((word) => !LONG_WORDS.has(word)),
          `${where}: a word a line broke in the middle`,
        ).toEqual([])
      }
    }
  }
})
