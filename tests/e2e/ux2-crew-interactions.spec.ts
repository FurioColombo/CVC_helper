import { expect, type Locator, type Page, test } from "@playwright/test"

async function createCourseWithStudents(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Barche" }).click()
  await page.getByRole("button", { name: "Configura barche" }).click()
  await page.getByLabel("Numeri barca").fill("1 2 3 4 5 6 7 8 9 10")
  await page.getByRole("button", { name: "Configura", exact: true }).click()
  await page.getByRole("button", { name: "Home", exact: true }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  for (const name of ["Alba", "Bruno", "Celia"]) {
    await page.getByRole("button", { name: "Aggiungi allievo" }).first().click()
    await page.getByLabel("Nome", { exact: true }).fill(name)
    await page.getByLabel("Cognome", { exact: true }).fill("Prova")
    await page.getByLabel(/^Data di nascita/).fill("2000-01-01")
    await page
      .getByRole("group", { name: "Sesso" })
      .getByText("M", { exact: true })
      .click()
    await page.getByRole("button", { name: "Salva allievo" }).click()
  }
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await page.getByRole("spinbutton").fill("3")
  await page.getByRole("button", { name: "Crea equipaggi" }).click()
}

test("selects, cancels and fills exact crew slots from the available pool", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "The reverse-assignment journey runs once on Pixel 7 Chrome",
  )
  test.setTimeout(90_000)
  await createCourseWithStudents(page)

  const crews = page.getByRole("region", { name: "Equipaggi della sessione" })
  const firstCrew = crews.getByRole("article").nth(0)
  const secondCrew = crews.getByRole("article").nth(1)
  const pool = page.getByRole("region", { name: "Allievi disponibili" })

  await secondCrew
    .getByRole("button", { name: "Posto libero 2 equipaggio 2" })
    .click()
  await expect(
    page.getByRole("dialog", { name: /Scegli un allievo per il posto libero/ }),
  ).toHaveCount(0)
  await expect(
    secondCrew.getByRole("button", {
      name: "Posto libero 2 equipaggio 2",
    }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect
    .poll(async () => {
      const box = await pool.boundingBox()
      return box?.y ?? Number.POSITIVE_INFINITY
    })
    .toBeLessThan((page.viewportSize()?.height ?? 900) - 80)
  await pool.getByRole("button", { name: "Bruno", exact: true }).click()
  await expect(secondCrew).toContainText("Bruno")
  await expect(firstCrew).not.toContainText("Bruno")
  await expect(
    secondCrew.getByRole("button", {
      name: "Posto libero 1 equipaggio 2",
    }),
  ).toBeVisible()

  const firstSlot = firstCrew.getByRole("button", {
    name: "Posto libero 1 equipaggio 1",
  })
  const secondSlot = firstCrew.getByRole("button", {
    name: "Posto libero 2 equipaggio 1",
  })
  await firstSlot.click()
  await expect(firstSlot).toHaveAttribute("aria-pressed", "true")
  await expect(pool).toBeInViewport()
  await expect(
    pool.getByRole("button", { name: "Alba", exact: true }),
  ).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(firstSlot).toHaveAttribute("aria-pressed", "false")
  await expect(firstSlot).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(firstSlot).toHaveAttribute("aria-pressed", "true")
  await expect(
    pool.getByRole("button", { name: "Alba", exact: true }),
  ).toBeFocused()

  await page.setViewportSize({ width: 320, height: 480 })
  await firstSlot.evaluate((element) =>
    element.scrollIntoView({ block: "start", behavior: "instant" }),
  )
  await expect(pool).not.toBeInViewport()
  await firstSlot.click()
  await expect(firstSlot).toHaveAttribute("aria-pressed", "false")

  await firstSlot.click()
  await secondSlot.click()
  await expect(firstSlot).toHaveAttribute("aria-pressed", "false")
  await expect(secondSlot).toHaveAttribute("aria-pressed", "true")
  await firstSlot.click()
  await expect(firstSlot).toHaveAttribute("aria-pressed", "true")
  await expect(secondSlot).toHaveAttribute("aria-pressed", "false")
  await pool.getByRole("button", { name: "Celia", exact: true }).click()
  await expect(firstCrew).toContainText("Celia")
  await expect(secondCrew).not.toContainText("Celia")

  const memberCard = firstCrew.getByRole("button", {
    name: "Celia, equipaggio 1",
  })
  const [cardBox, nameBox] = await Promise.all([
    memberCard.boundingBox(),
    memberCard.getByText("Celia", { exact: true }).boundingBox(),
  ])
  expect(cardBox).not.toBeNull()
  expect(nameBox).not.toBeNull()
  expect(
    Math.abs(
      (nameBox?.x ?? 0) +
        (nameBox?.width ?? 0) / 2 -
        ((cardBox?.x ?? 0) + (cardBox?.width ?? 0) / 2),
    ),
  ).toBeLessThan(10)

  await page.reload()
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Equipaggi" })
    .click()
  await expect(crews.getByRole("article").nth(0)).toContainText("Celia")
  await expect(crews.getByRole("article").nth(1)).toContainText("Bruno")
  await expect(
    crews
      .getByRole("article")
      .nth(0)
      .getByRole("button", { name: "Posto libero 2 equipaggio 1" }),
  ).toBeVisible()
  await expect(
    crews
      .getByRole("article")
      .nth(1)
      .getByRole("button", { name: "Posto libero 1 equipaggio 2" }),
  ).toBeVisible()
})

async function dispatchTouchSwipe(
  page: Page,
  grid: Locator,
  direction: "left" | "right",
) {
  const rect = await grid.boundingBox()
  expect(rect).not.toBeNull()
  const startX = (rect?.x ?? 0) + (rect?.width ?? 0) * 0.5
  const startY = (rect?.y ?? 0) + (rect?.height ?? 0) * 0.35
  const endX = startX + (direction === "left" ? -70 : 70)
  const session = await page.context().newCDPSession(page)
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { id: 1, x: startX, y: startY, radiusX: 1, radiusY: 1, force: 1 },
    ],
  })
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { id: 1, x: endX, y: startY, radiusX: 1, radiusY: 1, force: 1 },
    ],
  })
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  })
  await session.detach()
}

async function dispatchTouchVerticalScroll(page: Page, grid: Locator) {
  const rect = await grid.boundingBox()
  expect(rect).not.toBeNull()
  const startX = (rect?.x ?? 0) + (rect?.width ?? 0) / 2
  const startY = (rect?.y ?? 0) + (rect?.height ?? 0) * 0.75
  const endY = startY - 90
  const session = await page.context().newCDPSession(page)
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { id: 1, x: startX, y: startY, radiusX: 1, radiusY: 1, force: 1 },
    ],
  })
  for (let step = 1; step <= 6; step += 1) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          id: 1,
          x: startX,
          y: startY + ((endY - startY) * step) / 6,
          radiusX: 1,
          radiusY: 1,
          force: 1,
        },
      ],
    })
    await page.waitForTimeout(16)
  }
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  })
  await session.detach()
}

async function getVerticalScrollPosition(grid: Locator) {
  return grid.evaluate((element) => {
    let total = window.scrollY
    for (
      let ancestor = element.parentElement;
      ancestor;
      ancestor = ancestor.parentElement
    ) {
      const style = window.getComputedStyle(ancestor)
      if (
        /(auto|scroll)/.test(style.overflowY) &&
        ancestor.scrollHeight > ancestor.clientHeight
      ) {
        total += ancestor.scrollTop
      }
    }
    return total
  })
}

test("pages outgoing boats with pointer and touch without losing taps or keyboard access", async ({
  page,
}, testInfo) => {
  await createCourseWithStudents(page)
  await page.getByRole("button", { name: "Apri barche della sessione" }).click()
  if (testInfo.project.name === "pixel-7-chrome") {
    await page.setViewportSize({ width: 320, height: 480 })
  }

  const boatStrip = page.getByRole("region", { name: "Barche della sessione" })
  const grid = boatStrip.getByTestId("boat-page-grid")
  await expect(grid).toHaveCSS("touch-action", "pan-y")
  const gridBox = await grid.boundingBox()
  expect(gridBox).not.toBeNull()
  const startX = (gridBox?.x ?? 0) + (gridBox?.width ?? 0) * 0.5
  const startY = (gridBox?.y ?? 0) + (gridBox?.height ?? 0) * 0.3

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX - 80, startY + 1, { steps: 4 })
  await page.mouse.up()
  await expect(
    boatStrip.getByRole("button", { name: /^RS Quest 10 · Disponibile/ }),
  ).toBeVisible()
  await expect(boatStrip.getByText("0/10 selezionate")).toBeVisible()

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 80, startY, { steps: 4 })
  await page.mouse.up()
  const firstBoat = boatStrip.getByRole("button", {
    name: /^RS Quest 1 · Disponibile/,
  })
  await expect(firstBoat).toBeVisible()
  await expect(boatStrip.getByText("0/10 selezionate")).toBeVisible()

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX, startY + 60, { steps: 4 })
  await page.mouse.up()
  await expect(firstBoat).toBeVisible()
  await expect(boatStrip.getByText("0/10 selezionate")).toBeVisible()

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX - 60, startY + 60, { steps: 4 })
  await page.mouse.up()
  await expect(firstBoat).toBeVisible()
  await expect(boatStrip.getByText("0/10 selezionate")).toBeVisible()

  const verticalScrollBefore = await getVerticalScrollPosition(grid)
  await dispatchTouchVerticalScroll(page, grid)
  await expect
    .poll(() => getVerticalScrollPosition(grid))
    .toBeGreaterThan(verticalScrollBefore)
  await expect(firstBoat).toBeVisible()
  await expect(boatStrip.getByText("0/10 selezionate")).toBeVisible()

  await dispatchTouchSwipe(page, grid, "left")
  await expect(
    boatStrip.getByRole("button", { name: /^RS Quest 10 · Disponibile/ }),
  ).toBeVisible()
  await expect(boatStrip.getByText("0/10 selezionate")).toBeVisible()
  await page.waitForTimeout(550)
  await expect(boatStrip.getByText("0/10 selezionate")).toBeVisible()
  await dispatchTouchSwipe(page, grid, "right")
  await expect(firstBoat).toBeVisible()
  await page.waitForTimeout(550)
  await expect(boatStrip.getByText("0/10 selezionate")).toBeVisible()

  await firstBoat.focus()
  await page.keyboard.press("Enter")
  await expect(firstBoat).toHaveAttribute("aria-pressed", "true")
  await expect(firstBoat).toBeEnabled()
  await firstBoat.focus()
  await page.keyboard.press("Enter")
  await expect(firstBoat).toHaveAttribute("aria-pressed", "false")

  const moreBoats = boatStrip.getByRole("button", { name: "Altre barche" })
  await moreBoats.focus()
  await page.keyboard.press("Enter")
  await expect(
    boatStrip.getByRole("button", { name: /^RS Quest 10 · Disponibile/ }),
  ).toBeVisible()
  const previousBoats = boatStrip.getByRole("button", {
    name: "Barche precedenti",
  })
  await previousBoats.focus()
  await page.keyboard.press("Space")
  await expect(firstBoat).toBeVisible()
})
