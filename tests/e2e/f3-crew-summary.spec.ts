import { expect, type Page, test } from "@playwright/test"

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
 * two-column card grid now sizes its columns from `min(100%, 9rem)` rather
 * than a fixed `grid-cols-2`, so both crew shapes must be exercised, not just
 * the mixed-model one.
 */

const BOATS_BY_TYPE: Record<string, string[]> = {
  "RS Toura": ["4", "7", "9"],
  "RS Quest": ["12", "15", "18", "21"],
  "Laser Vago": ["3", "6"],
  "RS 500": ["2", "5"],
}
const TOTAL_BOATS = Object.values(BOATS_BY_TYPE).flat().length // 11
const MEZZI_CREW_COUNT = 2
const TOTAL_CREWS = TOTAL_BOATS + MEZZI_CREW_COUNT // 13
const MEMBERS_PER_CREW = 2
const TOTAL_STUDENTS = TOTAL_CREWS * MEMBERS_PER_CREW

async function seedThirteenCrewCourse(page: Page) {
  const seededStudents = Array.from({ length: TOTAL_STUDENTS }, (_, index) => ({
    firstName: `Allievo${String(index + 1).padStart(2, "0")}`,
    surname: "Prova",
    nickname: null,
    dateOfBirth: "2000-01-01",
    declaredAgeAtCourseStart: null,
    sex: "male",
    phone: null,
    size: null,
    initialNote: null,
    courseNote: null,
  }))

  await page.evaluate(
    async ({ students, boatsByType, membersPerCrew, mezziCrewCount }) => {
      // Each path goes through a variable rather than an inline string
      // literal: `import(<literal>)` is statically resolved by `tsc -b`
      // (which does not see the Vite-only ignore comment) and fails to find
      // these absolute dev-server paths, exactly as the 40-student stress
      // seed in c1-crew-management.spec.ts already works around.
      const courseModulePath = "/src/persistence/courses.ts"
      const studentsModulePath = "/src/persistence/students.ts"
      const boatsModulePath = "/src/persistence/boats.ts"
      const crewsModulePath = "/src/persistence/crews.ts"
      const courseApi = (await import(/* @vite-ignore */ courseModulePath)) as {
        getActiveCourse: () => Promise<{ id: string } | null>
      }
      const studentApi = (await import(
        /* @vite-ignore */ studentsModulePath
      )) as {
        createStudents: (
          courseId: string,
          entries: Array<Record<string, unknown>>,
        ) => Promise<Array<{ id: string }>>
      }
      const boatApi = (await import(/* @vite-ignore */ boatsModulePath)) as {
        createBoats: (
          courseId: string,
          inputs: Array<{ type: string; number: string }>,
        ) => Promise<Array<{ id: string; type: string; number: string }>>
      }
      const crewApi = (await import(/* @vite-ignore */ crewsModulePath)) as {
        saveCrewPlan: (
          courseId: string,
          sessionId: string,
          plan: {
            crews: Array<{
              id: string
              sessionId: string
              members: Array<{ personId: string; personType: string }>
              capacity: number
              destination: string
              boatId: string | null
            }>
            landStudentIds: string[]
            selectedBoatIds: string[]
          },
        ) => Promise<unknown>
      }
      const course = await courseApi.getActiveCourse()
      if (!course) {
        throw new Error("Synthetic 13-crew course requires an active course")
      }
      const createdStudents = await studentApi.createStudents(
        course.id,
        students,
      )
      const createdBoats: Array<{ id: string }> = []
      for (const [type, numbers] of Object.entries(boatsByType)) {
        const boats = await boatApi.createBoats(
          course.id,
          numbers.map((number) => ({ type, number })),
        )
        createdBoats.push(...boats)
      }

      let studentIndex = 0
      function nextMembers() {
        const members = Array.from({ length: membersPerCrew }, () => ({
          personId: createdStudents[studentIndex++]!.id,
          personType: "student",
        }))
        return members
      }

      const crews = [
        ...createdBoats.map((boat) => ({
          id: crypto.randomUUID(),
          sessionId: "sat-pm",
          members: nextMembers(),
          capacity: membersPerCrew,
          destination: "boat",
          boatId: boat.id,
        })),
        ...Array.from({ length: mezziCrewCount }, () => ({
          id: crypto.randomUUID(),
          sessionId: "sat-pm",
          members: nextMembers(),
          capacity: membersPerCrew,
          destination: "mezzi",
          boatId: null,
        })),
      ]

      await crewApi.saveCrewPlan(course.id, "sat-pm", {
        crews,
        landStudentIds: [],
        selectedBoatIds: createdBoats.map((boat) => boat.id),
      })
    },
    {
      students: seededStudents,
      boatsByType: BOATS_BY_TYPE,
      membersPerCrew: MEMBERS_PER_CREW,
      mezziCrewCount: MEZZI_CREW_COUNT,
    },
  )
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
  const stressCards = readView.getByRole("listitem")
  await expect(stressCards).toHaveCount(TOTAL_CREWS)

  // One column: 9rem no longer fits twice in the available width, so every
  // card starts at the same left edge instead of the two ~150 px columns
  // that used to truncate every name to a couple of letters.
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

const D1_BOAT_TYPE = "RS Toura"
const D1_BOAT_COUNT = 10
const D1_MEMBERS_PER_CREW = 4
const D1_TOTAL_STUDENTS = D1_BOAT_COUNT * D1_MEMBERS_PER_CREW // 40

/**
 * D1's own default (`COURSE_CONFIG.D1.defaultBoatType`, no fixed standard
 * crew size so the app's own `getInitialCrewCapacity` falls back to 4): a
 * single-model, denser roster than the mixed 13-crew course above, seeded
 * the same way (through the app's own persistence, same pattern as the
 * 40-student stress case in c1-crew-management.spec.ts) so this exercises
 * the read view itself rather than 40 manual student forms.
 */
async function seedTenCrewCourseD1(page: Page) {
  const seededStudents = Array.from(
    { length: D1_TOTAL_STUDENTS },
    (_, index) => ({
      firstName: `Allievo${String(index + 1).padStart(2, "0")}`,
      surname: "Prova",
      nickname: null,
      dateOfBirth: "2000-01-01",
      declaredAgeAtCourseStart: null,
      sex: "male",
      phone: null,
      size: null,
      initialNote: null,
      courseNote: null,
    }),
  )

  await page.evaluate(
    async ({ students, boatType, boatCount, membersPerCrew }) => {
      // Same absolute-path-via-variable workaround as the 13-crew seed above:
      // `import(<literal>)` is statically resolved by `tsc -b`, which does
      // not see the Vite-only ignore comment, and fails to find these
      // dev-server-only paths.
      const studentsModulePath = "/src/persistence/students.ts"
      const boatsModulePath = "/src/persistence/boats.ts"
      const crewsModulePath = "/src/persistence/crews.ts"
      const courseModulePath = "/src/persistence/courses.ts"
      const courseApi = (await import(/* @vite-ignore */ courseModulePath)) as {
        getActiveCourse: () => Promise<{ id: string } | null>
      }
      const studentApi = (await import(
        /* @vite-ignore */ studentsModulePath
      )) as {
        createStudents: (
          courseId: string,
          entries: Array<Record<string, unknown>>,
        ) => Promise<Array<{ id: string }>>
      }
      const boatApi = (await import(/* @vite-ignore */ boatsModulePath)) as {
        createBoats: (
          courseId: string,
          inputs: Array<{ type: string; number: string }>,
        ) => Promise<Array<{ id: string; type: string; number: string }>>
      }
      const crewApi = (await import(/* @vite-ignore */ crewsModulePath)) as {
        saveCrewPlan: (
          courseId: string,
          sessionId: string,
          plan: {
            crews: Array<{
              id: string
              sessionId: string
              members: Array<{ personId: string; personType: string }>
              capacity: number
              destination: string
              boatId: string | null
            }>
            landStudentIds: string[]
            selectedBoatIds: string[]
          },
        ) => Promise<unknown>
      }
      const course = await courseApi.getActiveCourse()
      if (!course) {
        throw new Error("Synthetic 10-crew D1 course requires an active course")
      }
      const createdStudents = await studentApi.createStudents(
        course.id,
        students,
      )
      const createdBoats = await boatApi.createBoats(
        course.id,
        Array.from({ length: boatCount }, (_, index) => ({
          type: boatType,
          number: String(index + 1),
        })),
      )

      let studentIndex = 0
      const crews = createdBoats.map((boat) => ({
        id: crypto.randomUUID(),
        sessionId: "sat-pm",
        members: Array.from({ length: membersPerCrew }, () => ({
          personId: createdStudents[studentIndex++]!.id,
          personType: "student",
        })),
        capacity: membersPerCrew,
        destination: "boat",
        boatId: boat.id,
      }))

      await crewApi.saveCrewPlan(course.id, "sat-pm", {
        crews,
        landStudentIds: [],
        selectedBoatIds: createdBoats.map((boat) => boat.id),
      })
    },
    {
      students: seededStudents,
      boatType: D1_BOAT_TYPE,
      boatCount: D1_BOAT_COUNT,
      membersPerCrew: D1_MEMBERS_PER_CREW,
    },
  )
}

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
})
