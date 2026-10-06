import {
  expect,
  type Locator,
  type Page,
  test,
  type TestInfo,
} from "@playwright/test"

import {
  calculateStudentAge,
  getStudentDisplayName,
  isStudentMinor,
} from "../../src/domain/student"
import {
  auditLayout,
  auditWhileScrolling,
  expectCleanLayout,
  expectCleanWhileScrolling,
  type LayoutAudit,
} from "./layout-audit"
import {
  HOSTILE_AVAILABLE,
  HOSTILE_CREWS,
  HOSTILE_DUTIES,
  HOSTILE_LAND,
  HOSTILE_SESSION,
  HOSTILE_STUDENTS,
  HOSTILE_VOLUNTEERS,
  birthDateFor,
  seedHostileRoster,
  summarizeHostileRoster,
} from "./ug2-hostile-roster-data"
import {
  copyAndCheckSummaryImage,
  expectClipboardImage,
  expectCopyButtonLayout,
  expectIconsInImage,
  expectLogosInImage,
  saveReviewFile,
  type SummaryImageResult,
} from "./summary-image-checks"

/**
 * UG2: a hostile fictitious 40-student D2 course (see
 * `ug2-hostile-roster-data.ts` for what is in it and why) through the pages
 * and exports that carry names: the Allievi list, the crew page, the crew
 * summary, the Comandate page and the Comandate summary, and the images the
 * two summaries copy. Each page is measured at 390 x 844, 360 x 780, 320 px
 * and 320 px with 200% text (the rulebook's stress profile, R05/R18).
 */

const PROFILES = [
  { name: "390x844", width: 390, height: 844, fontSize: "" },
  { name: "360x780", width: 360, height: 780, fontSize: "" },
  { name: "320", width: 320, height: 664, fontSize: "" },
  { name: "320-200pct", width: 320, height: 664, fontSize: "200%" },
] as const
type Profile = (typeof PROFILES)[number]

async function applyProfile(page: Page, profile: Profile) {
  await page.setViewportSize({ width: profile.width, height: profile.height })
  await page.evaluate((fontSize) => {
    document.documentElement.style.fontSize = fontSize
  }, profile.fontSize)
}

async function openHostileCourse(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await seedHostileRoster(page)
  await page.reload()
}

/** The crew page's measures: dense person buttons may be 40 px (R04), the
 *  remove button's tap area covers up to 4 px of a clipped name's last glyph,
 *  and the boat chip of a header at 320 px has its own fixme. */
const CREW_PAGE_AUDIT = {
  minDenseControl: 40,
  denseControls: "[aria-label*='equipaggio'], [aria-label*='A terra']",
  textUnderControlTolerance: 4,
  ignore: "[aria-label^='Destinazione equipaggio']",
}

const nav = (page: Page) =>
  page.getByRole("navigation", { name: "Navigazione principale" })

/** What the app calls each student where it shows names, from its own rule
 *  (`getStudentDisplayName`). Students with an identical name get an ordinal
 *  by their (random) id, so those two are matched without it. */
function expectedLabels() {
  const identities = HOSTILE_STUDENTS.map((student, index) => ({
    id: String(index + 1).padStart(2, "0"),
    firstName: student.firstName,
    surname: student.surname,
    nickname: student.nickname ?? null,
  }))
  return identities.map((student) => getStudentDisplayName(student, identities))
}
const LABELS = expectedLabels()
const label = (number: number) => LABELS[number - 1]!

function reviewName(testInfo: TestInfo, name: string) {
  const suffix = testInfo.project.name === "pixel-7-chrome" ? "" : "-webkit"
  return `ug2-hostile-${name}${suffix}`
}

async function saveScreen(
  page: Page,
  testInfo: TestInfo,
  name: string,
  fullPage = false,
) {
  saveReviewFile(
    `${reviewName(testInfo, name)}.png`,
    await page.screenshot({ fullPage }),
  )
}

function noteAudit(testInfo: TestInfo, where: string, audit: LayoutAudit) {
  testInfo.annotations.push({
    type: "layout-audit",
    description: JSON.stringify({
      where,
      truncated: audit.truncated.length,
      ...audit.stats,
    }),
  })
}

test("the hostile roster is what the evidence says it is", () => {
  const summary = summarizeHostileRoster()
  expect(summary).toMatchObject({
    students: 40,
    volunteers: 5,
    minors: 8,
    withNickname: 3,
    storedBirthDate: 3,
    ageOnly: 37,
    longFirstName: 4,
    doubleFirstName: 7,
    crews: 15,
    boatCrews: 12,
    mezziCrews: 2,
    crewsWithoutBoat: 1,
    studentsInCrews: 26,
    volunteersInCrews: 4,
    land: 8,
    available: 6,
    onDuty: 38,
  })
  // Every student is in exactly one place on the crew day.
  const placed = [
    ...HOSTILE_CREWS.flatMap(({ members }) =>
      members.filter((member) => typeof member === "number"),
    ),
    ...HOSTILE_LAND,
    ...HOSTILE_AVAILABLE,
  ].sort((a, b) => Number(a) - Number(b))
  expect(placed).toEqual(HOSTILE_STUDENTS.map((_, index) => index + 1))
  // Every student is on duty once, except the two Anna Marias.
  const onDuty = Object.values(HOSTILE_DUTIES).flat()
  expect(new Set(onDuty).size).toBe(onDuty.length)
  expect(
    HOSTILE_STUDENTS.map((_, index) => index + 1).filter(
      (number) => !onDuty.includes(number),
    ),
  ).toEqual([9, 10])
  expect(HOSTILE_VOLUNTEERS.map(({ role }) => role).sort()).toEqual([
    "ADV",
    "ADV",
    "CT",
    "CT",
    "IS",
  ])
})

test("the stored birth dates the hostile roster builds give the ages it declares, including the 18th birthday on day 4", () => {
  const start = "2026-09-19"
  const age = (dateOfBirth: string, on = start) =>
    calculateStudentAge({ dateOfBirth }, on)
  // 17 on the first day, 18 on the fourth, a minor at the start.
  const turning = birthDateFor(start, 17, 3)
  expect(age(turning)).toBe(17)
  expect(isStudentMinor({ dateOfBirth: turning }, start)).toBe(true)
  expect(age(turning, "2026-09-21")).toBe(17)
  expect(age(turning, "2026-09-22")).toBe(18)
  // A birthday already past: the declared age on the first day.
  expect(age(birthDateFor(start, 34, -20))).toBe(34)
  expect(age(birthDateFor(start, 39, -20))).toBe(39)
  // 29 February has no anniversary in most years: the 28th, still the age.
  const leap = "2028-02-26"
  expect(age(birthDateFor(leap, 17, 3), leap)).toBe(17)
})

test("the layout audit finds what it is for: an overlap, a word under a control, a small control, a clipped container and a sideways scroll", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "A property of the audit, not of an engine; one run proves it",
  )
  await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body style="margin:0">
    <main style="position:relative;width:200px;height:200px">
      <p style="position:absolute;left:10px;top:10px;margin:0">Overlapping</p>
      <p style="position:absolute;left:20px;top:12px;margin:0">Words</p>
      <button style="position:absolute;left:10px;top:60px;width:20px;height:20px">x</button>
      <p style="position:absolute;left:12px;top:60px;margin:0">Covered</p>
      <div style="position:absolute;top:100px;width:50px;overflow:hidden"><span style="display:inline-block;width:120px">wide</span></div>
      <div style="position:absolute;top:140px;width:900px">far</div>
    </main></body></html>`)
  const audit = await auditLayout(page.locator("main"))
  const found = audit.issues.join(" | ")
  expect(found).toMatch(/"Overlapping" overlaps "Words"/)
  expect(found).toMatch(/"Covered" is under button\[x\]/)
  expect(found).toMatch(/button\[x\] is 20x20, under 44/)
  expect(found).toMatch(/is wider inside \(120\) than outside \(50\)/)
  expect(found).toMatch(/the page scrolls sideways/)
  // And a clean page is clean.
  await page.setContent(
    `<main style="width:200px"><p>Nothing wrong here</p><button style="width:60px;height:48px">OK</button></main>`,
  )
  expect((await auditLayout(page.locator("main"))).issues).toEqual([])
})

test("lists the hostile roster in Allievi at four sizes without overlap, clipping or sideways scroll", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "The page layout is the same in every engine; one run measures it",
  )
  test.setTimeout(180_000)
  await openHostileCourse(page)
  await page.getByRole("button", { name: "Allievi" }).click()
  const list = page.getByRole("region", { name: "Elenco allievi" })
  await expect(list.getByRole("button")).toHaveCount(40)

  // The disambiguation rule on the two same-first-name groups and the pair.
  const has = (name: RegExp) => list.getByRole("button", { name })
  await expect(has(/^Luca Bi\., 23 anni, M$/)).toHaveCount(1)
  await expect(has(/^Luca Be\., 14 anni, M, Minorenne$/)).toHaveCount(1)
  await expect(has(/^Luca G\., 41 anni, M$/)).toHaveCount(1)
  await expect(has(/^Anna Maria De S\., 40 anni, F$/)).toHaveCount(1)
  await expect(has(/^Anna Maria De L\., 38 anni, F$/)).toHaveCount(1)
  await expect(has(/^Maria Esposito \(1\), \d+ anni, F/)).toHaveCount(1)
  await expect(has(/^Maria Esposito \(2\), \d+ anni, F/)).toHaveCount(1)
  // Nicknames, long names and the ages: declared and from a stored date.
  await expect(has(/^Gigi, 47 anni, M$/)).toHaveCount(1)
  await expect(has(/^Il Capitano, 39 anni, M$/)).toHaveCount(1)
  await expect(has(/^Fra, 17 anni, M, Minorenne$/)).toHaveCount(1)
  await expect(has(/^Alessandromassimiliano, 31 anni, M$/)).toHaveCount(1)
  await expect(has(/^Pierfrancescoalessandro, 27 anni, M$/)).toHaveCount(1)
  await expect(has(/^Maria Concetta Immacolata, 52 anni, F$/)).toHaveCount(1)
  await expect(has(/^Łucja, 17 anni, F, Minorenne$/)).toHaveCount(1)
  await expect(has(/^Renée, 34 anni, F$/)).toHaveCount(1)
  await expect(has(/^Çağla, 21 anni, F$/)).toHaveCount(1)
  await expect(has(/^Maria Esposito \(\d\), 18 anni, F$/)).toHaveCount(1)
  await expect(has(/, Minorenne$/)).toHaveCount(summarizeHostileRoster().minors)

  for (const profile of PROFILES) {
    await applyProfile(page, profile)
    const audit = await expectCleanWhileScrolling(
      page.locator("main"),
      null,
      `Allievi ${profile.name}`,
    )
    noteAudit(testInfo, `allievi ${profile.name}`, audit)
    // Nothing truncated: the list wraps names rather than clipping them.
    expect(audit.truncated, `Allievi ${profile.name}`).toEqual([])

    // The last row is clear of the bottom navigation at the end of the page.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const lastRow = await list.getByRole("button").last().boundingBox()
    const bar = await nav(page).boundingBox()
    expect(lastRow!.y + lastRow!.height, profile.name).toBeLessThanOrEqual(
      bar!.y,
    )
    await saveScreen(page, testInfo, `allievi-${profile.name}-end`)
    await page.evaluate(() => window.scrollTo(0, 0))
    await saveScreen(page, testInfo, `allievi-${profile.name}`)
  }
  await saveScreen(page, testInfo, "allievi-320-200pct-full", true)
})

test("composes the hostile Tuesday on the crew page at four sizes without overlap or sideways scroll", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "The page layout is the same in every engine; one run measures it",
  )
  test.setTimeout(180_000)
  await openHostileCourse(page)
  await nav(page).getByRole("button", { name: "Equipaggi" }).click()
  await page
    .getByRole("combobox", { name: "Sessione" })
    .selectOption(HOSTILE_SESSION)

  const crews = page
    .getByRole("region", { name: "Equipaggi della sessione" })
    .getByRole("article")
  await expect(crews).toHaveCount(HOSTILE_CREWS.length)
  await expect(page.getByText("Allievi sistemati 34/40")).toBeVisible()
  await expect(page.getByText("· 6 disponibili")).toBeVisible()
  // A crew without a boat, a volunteer of each role seated, one left free.
  await expect(
    crews.nth(14).getByRole("button", {
      name: `${HOSTILE_VOLUNTEERS[3]!.name}, equipaggio 15`,
    }),
  ).toBeVisible()
  await expect(
    crews.nth(4).getByRole("button", {
      name: `${HOSTILE_VOLUNTEERS[0]!.name}, equipaggio 5`,
    }),
  ).toBeVisible()
  await expect(
    page
      .getByRole("region", { name: "Volontari disponibili" })
      .getByRole("button"),
  ).toHaveCount(1)
  // The longest name is in the accessible name in full, whatever the card
  // draws of it.
  await expect(
    crews
      .nth(0)
      .getByRole("button", { name: `${label(1)}, equipaggio 1`, exact: true }),
  ).toHaveCount(1)

  const clipped: Record<string, unknown> = {}
  for (const profile of PROFILES) {
    await applyProfile(page, profile)
    const composition = page.getByRole("region", {
      name: "Composizione equipaggi",
    })
    // The stress profile is recorded, not asserted: see the first fixme.
    const audit = profile.fontSize
      ? await auditWhileScrolling(
          page.locator("main"),
          composition,
          CREW_PAGE_AUDIT,
        )
      : await expectCleanWhileScrolling(
          page.locator("main"),
          composition,
          `Equipaggi ${profile.name}`,
          CREW_PAGE_AUDIT,
        )
    if (profile.fontSize) {
      testInfo.annotations.push({
        type: "crew-page-200pct-findings",
        description: JSON.stringify({
          count: audit.issues.length,
          sample: audit.issues.slice(0, 12),
          brokenWords: audit.brokenWords.slice(0, 20),
        }),
      })
    }
    noteAudit(testInfo, `crew-page ${profile.name}`, audit)
    clipped[profile.name] = await measureNameClipping(crews)
    await saveScreen(page, testInfo, `crews-${profile.name}`)
    await composition.evaluate((element) =>
      element.scrollTo(0, element.scrollHeight),
    )
    await saveScreen(page, testInfo, `crews-${profile.name}-end`)
    await composition.evaluate((element) => element.scrollTo(0, 0))
  }
  // Where the card clips a name it is by design (an ellipsis, the full name
  // in the accessible name); how much is lost is recorded, and the rule that
  // would make it legible is the fixme below.
  testInfo.annotations.push({
    type: "name-clipping",
    description: JSON.stringify(clipped),
  })
})

/**
 * What a crew card shows of each name: the name span of every person on every
 * card, how wide it is on screen against the width of its first three letters
 * plus an ellipsis, and how many are clipped at all.
 */
async function measureNameClipping(crews: Locator) {
  return crews.evaluateAll((cards) => {
    const range = document.createRange()
    const names: Array<{ text: string; shown: number; needed: number }> = []
    for (const card of cards) {
      for (const span of Array.from(
        card.querySelectorAll<HTMLElement>("span.truncate"),
      )) {
        const text = span.firstChild as Text | null
        const content = span.textContent ?? ""
        // Names only: not the "Allievo · M" detail line or a role.
        if (
          !text ||
          !/^\p{L}/u.test(content) ||
          content.startsWith("Allievo")
        ) {
          continue
        }
        if (span.scrollWidth <= span.clientWidth + 1) continue
        range.setStart(text, 0)
        range.setEnd(text, Math.min(3, text.data.length))
        names.push({
          text: content,
          shown: Math.round(span.clientWidth),
          needed: Math.round(range.getBoundingClientRect().width + 12),
        })
      }
    }
    return {
      clippedNames: names.length,
      underThreeLetters: names.filter(({ shown, needed }) => shown < needed)
        .length,
      narrowest: [...names].sort((a, b) => a.shown - b.shown).slice(0, 3),
    }
  })
}

test.fixme("keeps at least the first three letters of every name legible on the crew cards at 390, 360 and 320 px", async ({
  page,
}, testInfo) => {
  // Measured by UG2 (the name-clipping annotation of the crew page test):
  // at 390 px 1 of the 16 clipped names shows under three letters, at 360 px
  // 10 of 25 and at 320 px 17 of 30, where a minor with a smontante or
  // comandata badge (Łucja, José) keeps 3 px of the name;
  // with 200% text a volunteer's name has no width at all. The accessible
  // name and the student page keep the identity, and the c1 spec pins the
  // ellipsis, so this is a design decision for the owner (rulebook R05,
  // "niente perdita di identità"), not something to bend in the release gate.
  test.skip(testInfo.project.name !== "pixel-7-chrome")
  test.setTimeout(180_000)
  await openHostileCourse(page)
  await nav(page).getByRole("button", { name: "Equipaggi" }).click()
  await page
    .getByRole("combobox", { name: "Sessione" })
    .selectOption(HOSTILE_SESSION)
  const crews = page
    .getByRole("region", { name: "Equipaggi della sessione" })
    .getByRole("article")
  await expect(crews).toHaveCount(HOSTILE_CREWS.length)
  for (const profile of PROFILES.slice(0, 3)) {
    await applyProfile(page, profile)
    const clipping = await measureNameClipping(crews)
    expect(clipping.underThreeLetters, JSON.stringify(clipping)).toBe(0)
  }
})

test.fixme("keeps the crew page inside the screen at 320 px with 200% text", async ({
  page,
}, testInfo) => {
  // Measured by UG2, and not special to the hostile roster (the plain
  // 13-crew course of F3 does it too): at 320 px with 200% text the
  // "Composizione equipaggi" region scrolls sideways by 42 px (R18) because
  // the crew cards and their header rows are wider than the screen; the M, SM,
  // C and role badges of a person run under the 44 px remove button (R04);
  // the A terra rows draw words outside their buttons; and the bottom bar
  // breaks "Collocati", "A terra" and "Volontari" in the middle of the word.
  // The ug1 and c1 specs only look at the document's width, which the
  // region's own scroll hides. The cards and the bar are the owner's frozen
  // design, so this is a design decision, not a fix for the release gate.
  test.skip(testInfo.project.name !== "pixel-7-chrome")
  test.setTimeout(180_000)
  await openHostileCourse(page)
  await nav(page).getByRole("button", { name: "Equipaggi" }).click()
  await page
    .getByRole("combobox", { name: "Sessione" })
    .selectOption(HOSTILE_SESSION)
  await expect(
    page
      .getByRole("region", { name: "Equipaggi della sessione" })
      .getByRole("article"),
  ).toHaveCount(HOSTILE_CREWS.length)
  await applyProfile(page, PROFILES[3])
  await expectCleanWhileScrolling(
    page.locator("main"),
    page.getByRole("region", { name: "Composizione equipaggi" }),
    "Equipaggi 320-200pct",
    CREW_PAGE_AUDIT,
  )
})

test.fixme("keeps the boat mark and number inside their chip in a crew header at 320 px", async ({
  page,
}, testInfo) => {
  // Measured by UG2: with the warning chip beside it, the header's boat chip
  // ("RS Quest 12") at 320 px is 90 px wide for 94 px of content, so the
  // number reaches past the chip's border by about 3 px. Cosmetic (the number
  // stays readable and nothing is under it), and the header is the frozen C
  // design the one-row specs pin, so it is left for the owner.
  test.skip(testInfo.project.name !== "pixel-7-chrome")
  test.setTimeout(180_000)
  await openHostileCourse(page)
  await nav(page).getByRole("button", { name: "Equipaggi" }).click()
  await page
    .getByRole("combobox", { name: "Sessione" })
    .selectOption(HOSTILE_SESSION)
  await expect(
    page
      .getByRole("region", { name: "Equipaggi della sessione" })
      .getByRole("article"),
  ).toHaveCount(HOSTILE_CREWS.length)
  await applyProfile(page, PROFILES[2])
  const composition = page.getByRole("region", {
    name: "Composizione equipaggi",
  })
  const found: string[] = []
  for (const top of [0, 500, 1000, 1500, 2000, 2500, 3000]) {
    await composition.evaluate((element, to) => element.scrollTo(0, to), top)
    const audit = await auditLayout(page.locator("main"), {
      textUnderControlTolerance: 4,
    })
    found.push(...audit.issues.filter((issue) => /Destinazione/.test(issue)))
  }
  expect([...new Set(found)]).toEqual([])
})

async function openCrewSummary(page: Page) {
  await nav(page).getByRole("button", { name: "Equipaggi" }).click()
  await page
    .getByRole("combobox", { name: "Sessione" })
    .selectOption(HOSTILE_SESSION)
  await page.getByRole("button", { name: "Apri vista lettura" }).click()
  const view = page.getByRole("dialog", { name: "Vista lettura equipaggi" })
  await expect(view.getByRole("listitem")).toHaveCount(HOSTILE_CREWS.length)
  return view
}

async function openDutySummary(page: Page) {
  await page.getByRole("button", { name: "Comandate" }).click()
  await page.getByRole("button", { name: "Apri riepilogo comandate" }).click()
  const view = page.getByRole("dialog", { name: "Vista lettura comandate" })
  await expect(view.getByRole("listitem")).toHaveCount(7)
  return view
}

test("shows and copies the hostile crew summary exactly as the screen has it, at four sizes", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "iphone-13-viewport",
    "Chromium (Android) and WebKit (iPhone) are the two engines the phones use",
  )
  test.setTimeout(420_000)
  if (testInfo.project.name === "pixel-7-chrome") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
  }
  await openHostileCourse(page)
  const view = await openCrewSummary(page)

  for (const profile of PROFILES) {
    await applyProfile(page, profile)
    const audit = await expectCleanLayout(
      view,
      `Riepilogo equipaggi ${profile.name}`,
      { ignore: "[data-snapshot-exclude]" },
    )
    noteAudit(testInfo, `crew-summary ${profile.name}`, audit)
    // The summary wraps every name; nothing is clipped.
    expect(audit.truncated, `Riepilogo equipaggi ${profile.name}`).toEqual([])
    for (const crew of HOSTILE_CREWS) {
      for (const member of crew.members) {
        if (typeof member !== "number") continue
        const name = view.getByText(label(member), { exact: true })
        await expect(name, `${label(member)} at ${profile.name}`).toHaveCount(1)
      }
    }
    await saveScreen(page, testInfo, `crew-summary-${profile.name}-top-screen`)
    await expectCopyButtonLayout(view, `crew summary ${profile.name}`)

    const result: SummaryImageResult = await copyAndCheckSummaryImage(
      page,
      view,
      testInfo,
      { name: reviewName(testInfo, `crew-summary-${profile.name}`) },
    )
    await expectLogosInImage(view, result)
    await expectIconsInImage(view, result)
    // Chromium can be read back: the clipboard holds the same image.
    if (testInfo.project.name === "pixel-7-chrome") {
      await expectClipboardImage(page, result.png)
    }
    // Every long name is in the image in the lines the screen has it in.
    for (const number of [1, 2, 3, 4, 5, 13]) {
      const text = label(number)
      const leaf = result.measure.leaves.find((item) => item.text === text)
      expect(leaf, `${text} is in the image at ${profile.name}`).toBeDefined()
    }
    // The badges the hostile Tuesday carries: minors, in comandata (C) and
    // smontante (SM), and the volunteers' roles.
    for (const badge of ["M", "C", "SM", "CT", "ADV", "IS"]) {
      expect(
        result.measure.leaves.some((leaf) => leaf.text === badge),
        `badge ${badge} at ${profile.name}`,
      ).toBe(true)
    }
    // A summary of fifteen crews and two lists is longer than the screen.
    expect(result.cssHeight).toBeGreaterThan(profile.height)
  }
})

test("shows and copies the hostile Comandate summary exactly as the screen has it, at four sizes", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "iphone-13-viewport",
    "Chromium (Android) and WebKit (iPhone) are the two engines the phones use",
  )
  test.setTimeout(420_000)
  if (testInfo.project.name === "pixel-7-chrome") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
  }
  await openHostileCourse(page)
  const view = await openDutySummary(page)

  for (const profile of PROFILES) {
    await applyProfile(page, profile)
    const audit = await expectCleanLayout(
      view,
      `Riepilogo comandate ${profile.name}`,
      { ignore: "[data-snapshot-exclude]" },
    )
    noteAudit(testInfo, `duty-summary ${profile.name}`, audit)
    expect(audit.truncated, `Riepilogo comandate ${profile.name}`).toEqual([])
    // All 38 names are in the seven cards (the two Anna Marias are off duty).
    for (const numbers of Object.values(HOSTILE_DUTIES)) {
      for (const number of numbers) {
        const name = view.getByText(label(number), { exact: true })
        await expect(name, `${label(number)} at ${profile.name}`).toHaveCount(1)
      }
    }
    await saveScreen(page, testInfo, `duty-summary-${profile.name}-top-screen`)
    await expectCopyButtonLayout(view, `duty summary ${profile.name}`)

    const result = await copyAndCheckSummaryImage(page, view, testInfo, {
      name: reviewName(testInfo, `duty-summary-${profile.name}`),
      endsWithLastCard: true,
    })
    if (testInfo.project.name === "pixel-7-chrome") {
      await expectClipboardImage(page, result.png)
    }
    expect(
      result.measure.leaves.some((leaf) => leaf.text === label(1)),
      `${label(1)} is in the image at ${profile.name}`,
    ).toBe(true)
    expect(result.measure.cards).toHaveLength(7)
  }
})

test("shows the hostile Comandate page at 390, 360 and 320 px without overlap or sideways scroll", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "The page layout is the same in every engine; one run measures it",
  )
  test.setTimeout(180_000)
  await openHostileCourse(page)
  await page.getByRole("button", { name: "Comandate" }).click()
  await expect(
    page.getByRole("region", { name: "Piano comandate" }),
  ).toBeVisible()
  for (const profile of PROFILES) {
    await applyProfile(page, profile)
    if (profile.fontSize) {
      // The stress profile is recorded, not asserted: see the fixme below.
      const audit = await auditWhileScrolling(page.locator("main"), null)
      testInfo.annotations.push({
        type: "duty-page-200pct-findings",
        description: JSON.stringify({
          count: audit.issues.length,
          sample: audit.issues.slice(0, 12),
          documentWidth: audit.stats.documentWidth,
        }),
      })
    } else {
      const audit = await expectCleanWhileScrolling(
        page.locator("main"),
        null,
        `Comandate ${profile.name}`,
      )
      noteAudit(testInfo, `duty-page ${profile.name}`, audit)
    }
    await saveScreen(page, testInfo, `duty-page-${profile.name}`)
  }
})

test.fixme("keeps the populated Comandate page inside the screen at 320 px with 200% text", async ({
  page,
}, testInfo) => {
  // Measured by UG2, and not special to the hostile roster (the populated
  // plan page is not in the ug1 reflow spec, which covers the empty state and
  // the proposal): at 320 px with 200% text the document scrolls sideways by
  // 12 px (R18) because the "Ricalcola" / "Avvisi" row and the coverage chip
  // are wider than the screen; the day cards cut their titles to "Sa…" and
  // "D…" and the count touches the ellipsis; and "Comandate" breaks in the
  // header. The page is the owner's frozen design, so this is a design
  // decision, not a fix for the release gate.
  test.skip(testInfo.project.name !== "pixel-7-chrome")
  test.setTimeout(180_000)
  await openHostileCourse(page)
  await page.getByRole("button", { name: "Comandate" }).click()
  await expect(
    page.getByRole("region", { name: "Piano comandate" }),
  ).toBeVisible()
  await applyProfile(page, PROFILES[3])
  await expectCleanWhileScrolling(
    page.locator("main"),
    null,
    "Comandate 320-200pct",
  )
})
