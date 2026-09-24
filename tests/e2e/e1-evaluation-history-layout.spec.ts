import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { expect, type Page, test } from "@playwright/test"

async function createCourse(page: Page, level = 2) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: `Livello ${level}` }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
}

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

async function seedLargeCrewPlan(page: Page) {
  const inputs = Array.from({ length: 40 }, (_, index) => ({
    firstName: `Allievo${String(index).padStart(2, "0")}`,
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

  await page.evaluate(async (studentsInput) => {
    const courseModulePath = "/src/persistence/courses.ts"
    const studentsModulePath = "/src/persistence/students.ts"
    const crewsModulePath = "/src/persistence/crews.ts"
    const courses = (await import(/* @vite-ignore */ courseModulePath)) as {
      getActiveCourse: () => Promise<{ id: string } | null>
    }
    const students = (await import(/* @vite-ignore */ studentsModulePath)) as {
      createStudents: (
        courseId: string,
        entries: Array<Record<string, unknown>>,
      ) => Promise<Array<{ id: string }>>
    }
    const crews = (await import(/* @vite-ignore */ crewsModulePath)) as {
      saveCrewPlan: (
        courseId: string,
        sessionId: string,
        plan: {
          crews: Array<{
            id: string
            sessionId: string
            capacity: number
            members: Array<{ personId: string; personType: "student" }>
            destination: "unassigned"
            boatId: null
          }>
          landStudentIds: string[]
          selectedBoatIds: string[]
        },
      ) => Promise<void>
    }
    const course = await courses.getActiveCourse()
    if (!course) throw new Error("E1 fixture requires an active course")
    const created = await students.createStudents(
      course.id,
      studentsInput as Array<Record<string, unknown>>,
    )
    const members = created.map((student) => ({
      personId: student.id,
      personType: "student" as const,
    }))
    await crews.saveCrewPlan(course.id, "sat-pm", {
      crews: [
        {
          id: "e1-large-crew",
          sessionId: "sat-pm",
          capacity: 40,
          members: members.slice(0, 36),
          destination: "unassigned",
          boatId: null,
        },
        {
          id: "e1-small-crew",
          sessionId: "sat-pm",
          capacity: 4,
          members: members.slice(36, 38),
          destination: "unassigned",
          boatId: null,
        },
      ],
      landStudentIds: [created[38]!.id],
      selectedBoatIds: [],
    })
  }, inputs)
}

async function saveGeometry(pathName: string, geometry: unknown) {
  const outputPath = path.resolve("test-results", "e1", pathName)
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(geometry, null, 2)}\n`)
}

async function expectPageFits(page: Page) {
  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(layout.scrollWidth, JSON.stringify(layout)).toBeLessThanOrEqual(
    layout.clientWidth,
  )
  return layout
}

test("separates evaluation crew members from groups at a phone stress size", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "pixel-7-chrome")
  test.setTimeout(120_000)

  await createCourse(page, 1)
  await seedLargeCrewPlan(page)
  await page.reload()
  await page.getByRole("button", { name: "Valutazioni" }).click()
  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")
  await page
    .getByRole("group", { name: "Vista valutazioni" })
    .getByRole("button", { name: "Equipaggi" })
    .click()

  const crewOne = page.getByRole("region", { name: "Equipaggio 1" })
  const crewTwo = page.getByRole("region", { name: "Equipaggio 2" })
  const land = page.getByRole("region", { name: "A terra" })
  const unassigned = page.getByRole("region", { name: "Non assegnati" })
  await expect(crewOne.getByRole("article")).toHaveCount(36)
  await expect(crewTwo.getByRole("article")).toHaveCount(2)
  await expect(land.getByRole("article")).toHaveCount(1)
  await expect(unassigned.getByRole("article")).toHaveCount(1)

  await page.setViewportSize({ width: 320, height: 664 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await expectPageFits(page)

  const before = await page.evaluate(() => {
    const list = document.querySelector<HTMLElement>(".mt-3.grid.gap-4")
    const groups = list
      ? Array.from(list.children).filter(
          (child): child is HTMLElement =>
            child instanceof HTMLElement && child.matches("section"),
        )
      : []
    if (!list || groups.length < 4)
      throw new Error("Expected four evaluation groups")
    const rect = (element: Element) => {
      const box = element.getBoundingClientRect()
      return { top: Math.round(box.top), bottom: Math.round(box.bottom) }
    }
    const original = {
      outer: list.style.rowGap,
      inner: groups.map((group) => group.style.rowGap),
    }
    const cards = Array.from(groups[0]!.querySelectorAll("article"))
    const lastCrewOneCard = Array.from(
      groups[0]!.querySelectorAll("article"),
    ).at(-1)!
    list.style.rowGap = "0.375rem"
    groups.forEach((group) => {
      group.style.rowGap = "0.75rem"
    })
    const priorMemberGap = Math.round(
      rect(cards[1]!).top - rect(cards[0]!).bottom,
    )
    const priorGroupGap = Math.round(
      rect(groups[1]!.querySelector("article")!).top -
        rect(lastCrewOneCard).bottom,
    )
    list.style.rowGap = original.outer
    groups.forEach((group, index) => {
      group.style.rowGap = original.inner[index]!
    })
    return { memberGapPx: priorMemberGap, groupGapPx: priorGroupGap }
  })

  const crewOneCards = await crewOne.getByRole("article").evaluateAll((cards) =>
    cards.map((card) => {
      const box = card.getBoundingClientRect()
      return { top: Math.round(box.top), bottom: Math.round(box.bottom) }
    }),
  )
  const crewTwoCards = await crewTwo.getByRole("article").evaluateAll((cards) =>
    cards.map((card) => {
      const box = card.getBoundingClientRect()
      return { top: Math.round(box.top), bottom: Math.round(box.bottom) }
    }),
  )
  const landCards = await land.getByRole("article").evaluateAll((cards) =>
    cards.map((card) => {
      const box = card.getBoundingClientRect()
      return { top: Math.round(box.top), bottom: Math.round(box.bottom) }
    }),
  )
  const unassignedCards = await unassigned
    .getByRole("article")
    .evaluateAll((cards) =>
      cards.map((card) => {
        const box = card.getBoundingClientRect()
        return { top: Math.round(box.top), bottom: Math.round(box.bottom) }
      }),
    )
  const afterMemberGaps = crewOneCards
    .slice(1)
    .map((card, index) => card.top - crewOneCards[index]!.bottom)
  const groupGaps = [
    crewTwoCards[0]!.top - crewOneCards.at(-1)!.bottom,
    landCards[0]!.top - crewTwoCards.at(-1)!.bottom,
    unassignedCards[0]!.top - landCards.at(-1)!.bottom,
  ]
  expect(afterMemberGaps.every((gap) => gap === afterMemberGaps[0])).toBe(true)
  expect(afterMemberGaps[0]).toBeLessThan(before.memberGapPx)
  expect(groupGaps.every((gap) => gap > before.groupGapPx)).toBe(true)
  expect(groupGaps.every((gap) => gap > afterMemberGaps[0]! * 2)).toBe(true)

  const finalLayout = await expectPageFits(page)
  const geometry = {
    viewport: { width: 320, height: 664, rootFontSize: "200%" },
    students: 40,
    groups: [36, 2, 1, 1],
    memberGapPx: {
      before: before.memberGapPx,
      after: {
        min: Math.min(...afterMemberGaps),
        max: Math.max(...afterMemberGaps),
      },
    },
    groupGapPx: { before: before.groupGapPx, after: groupGaps },
    page: finalLayout,
  }
  await saveGeometry("evaluation-group-spacing.json", geometry)
  await page.screenshot({
    path: path.resolve(
      "test-results",
      "screenshots",
      "e1-evaluation-groups-320-200.png",
    ),
    fullPage: false,
  })
})

test("opens the selected student session and keeps the Valutazioni note editor usable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "pixel-7-chrome")
  test.setTimeout(120_000)

  await createCourse(page)
  await page.getByRole("button", { name: "Allievi" }).click()
  await addStudent(page, "Aldo", "Rossi")
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await page.getByRole("button", { name: "Valutazioni" }).click()
  await page.getByLabel("Sessione valutazioni").selectOption("sat-pm")
  await page
    .getByRole("button", { name: "Aggiungi nota valutazione di Aldo" })
    .click()

  const stressViewport = { width: 320, height: 664 }
  await page.setViewportSize(stressViewport)
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  const note = page.getByRole("textbox", { name: "Nota valutazione di Aldo" })
  const noteText = Array.from(
    { length: 8 },
    (_, index) => `Osservazione sintetica ${index + 1} sulla prova in acqua.`,
  ).join("\n")
  await note.fill(noteText)
  await expect(note).toHaveCSS("resize", "vertical")

  const noteBox = await note.boundingBox()
  expect(noteBox).not.toBeNull()
  await expect(note).toHaveValue(noteText)

  const stressFit = await expectPageFits(page)
  const panelFit = await note.evaluate((textarea) => {
    const panel = textarea.parentElement
    if (!panel) throw new Error("Note editor panel is missing")
    const panelRect = panel.getBoundingClientRect()
    const textareaRect = textarea.getBoundingClientRect()
    const childRects = Array.from(panel.querySelectorAll<HTMLElement>("*"))
      .map((child) => child.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
    return {
      panelWidth: Math.round(panelRect.width),
      panelScrollWidth: panel.scrollWidth,
      panelLeft: Math.round(panelRect.left),
      panelRight: Math.round(panelRect.right),
      textareaHeight: Math.round(textareaRect.height),
      childrenWithinPanel: childRects.every(
        (rect) =>
          rect.left >= panelRect.left - 1 && rect.right <= panelRect.right + 1,
      ),
    }
  })
  expect(panelFit.panelScrollWidth).toBeLessThanOrEqual(panelFit.panelWidth)
  expect(panelFit.childrenWithinPanel).toBe(true)
  await page.screenshot({
    path: path.resolve(
      "test-results",
      "screenshots",
      "e1-evaluation-note-320-200.png",
    ),
    fullPage: true,
  })

  const normalViewports = [
    { width: 390, height: 844 },
    { width: 412, height: 915 },
  ]
  const normalLayouts = []
  for (const viewport of normalViewports) {
    await page.setViewportSize(viewport)
    await page.evaluate(() => {
      document.documentElement.style.fontSize = ""
    })
    normalLayouts.push({
      viewport,
      page: await expectPageFits(page),
      panel: await note.evaluate((textarea) => {
        const panel = textarea.parentElement!
        return {
          width: panel.clientWidth,
          scrollWidth: panel.scrollWidth,
          textareaHeight: Math.round(textarea.getBoundingClientRect().height),
        }
      }),
    })
  }

  await saveGeometry("evaluation-note-panel.json", {
    stress: {
      viewport: stressViewport,
      rootFontSize: "200%",
      page: stressFit,
      panel: panelFit,
      textareaHeight: noteBox!.height,
    },
    normal: normalLayouts,
  })
  for (const { panel } of normalLayouts) {
    expect(panel.scrollWidth).toBeLessThanOrEqual(panel.width)
  }

  await page.getByRole("button", { name: "Salva nota" }).click()
  await expect(
    page.getByRole("button", { name: "Modifica nota valutazione di Aldo" }),
  ).toBeVisible()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Home", exact: true })
    .click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await page.getByRole("button", { name: /^Aldo, 26 anni/ }).click()

  const history = page.getByRole("region", { name: "Storico valutazioni" })
  const sundayAm = history.getByRole("button", {
    name: "Apri Valutazioni di Domenica AM; valutazione mancante",
  })
  await sundayAm.click()
  await expect(page.getByLabel("Sessione valutazioni")).toHaveValue("sun-am")
  await expect(page.getByRole("heading", { name: "Valutazioni" })).toBeVisible()
  await page.getByRole("button", { name: "Indietro da Valutazioni" }).click()
  await expect(page.getByRole("heading", { name: "Profilo" })).toBeVisible()
  await expect(
    page.getByRole("region", { name: "Storico valutazioni" }),
  ).toBeVisible()
})
