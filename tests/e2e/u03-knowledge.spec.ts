import { expect, type Page, test } from "@playwright/test"

async function createCourse(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
}

async function addStudent(page: Page, firstName: string, surname: string) {
  await page.getByRole("button", { name: "Menu allievi" }).click()
  await page
    .getByLabel("Azioni allievi")
    .getByRole("button", { name: "Aggiungi allievo" })
    .click()
  await page.getByLabel("Nome", { exact: true }).fill(firstName)
  await page.getByLabel("Cognome", { exact: true }).fill(surname)
  await page.getByLabel(/^Data di nascita/).fill("2000-01-01")
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText("M", { exact: true })
    .click()
  const save = page.getByRole("button", { name: "Salva allievo" })
  await save.evaluate((element) => element.scrollIntoView({ block: "center" }))
  await save.click()
}

test("keeps P05 compact and preserves a rapid note edit at stress width", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 664 })
  await createCourse(page)
  await addStudent(page, "Alessandro", "Rossi")
  await addStudent(page, "Alessandro", "Montesquieu")
  await addStudent(page, "Beatrice", "Dal Verme")

  await page.getByRole("button", { name: "Menu allievi" }).click()
  await page.getByRole("button", { name: "Conoscenza allievi" }).click()

  const cards = page.locator("article")
  await expect(cards).toHaveCount(3)
  for (const name of ["Alessandro M.", "Alessandro R.", "Beatrice"]) {
    const card = cards.filter({ has: page.getByRole("heading", { name }) })
    await expect(card).toHaveCount(1)
    const heading = card.getByRole("heading", { name })
    expect(
      await heading.evaluate(
        (element) =>
          element.getBoundingClientRect().height <=
          Number.parseFloat(getComputedStyle(element).lineHeight) + 1,
      ),
    ).toBe(true)
    const sizeButtons = card
      .getByRole("group", { name: `Taglia di ${name}` })
      .getByRole("button")
    await expect(sizeButtons).toHaveCount(5)
    const controlsInsideCard = await card.evaluate((element) => {
      const cardBox = element.getBoundingClientRect()
      return [...element.querySelectorAll('[role="group"] button')].every(
        (button) => {
          const box = button.getBoundingClientRect()
          return box.left >= cardBox.left && box.right <= cardBox.right
        },
      )
    })
    expect(controlsInsideCard).toBe(true)
  }

  const target = cards.filter({
    has: page.getByRole("heading", { name: "Alessandro M." }),
  })

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
  await page.screenshot({
    fullPage: true,
    path: `.evidence/U03/p05-stress-${testInfo.project.name}.png`,
  })

  await target
    .getByRole("group", { name: "Taglia di Alessandro M." })
    .getByRole("button", { name: "XL", exact: true })
    .click()
  await target.getByRole("button", { name: "Nota di Alessandro M." }).click()
  await expect(
    page.getByRole("dialog", { name: "Nota · Alessandro M." }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Detta nota di Alessandro M." }),
  ).toBeVisible()
  await page.screenshot({
    path: `.evidence/U03/p05-note-panel-${testInfo.project.name}.png`,
  })
  await page
    .getByLabel("Nota iniziale di Alessandro M.")
    .fill("Esperienza su derive leggere")
  await page.getByRole("button", { name: "Fine" }).click()

  await page
    .getByRole("button", { name: "Indietro da Conoscenza allievi" })
    .click()

  await page.getByRole("button", { name: /Alessandro M\., 26 anni/ }).click()
  await expect(page.getByText("XL", { exact: true })).toBeVisible()
  await expect(page.getByText("Esperienza su derive leggere")).toBeVisible()
})

test("keeps enlarged text and a reduced-height note dialog operable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 664 })
  await createCourse(page)
  await addStudent(page, "Alessandro", "Montesquieu")
  await page.getByRole("button", { name: "Menu allievi" }).click()
  await page.getByRole("button", { name: "Conoscenza allievi" }).click()

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true)

  await page.getByRole("button", { name: "Nota di Alessandro" }).click()
  await page.setViewportSize({ width: 320, height: 420 })
  const dialog = page.getByRole("dialog", {
    name: "Nota · Alessandro",
  })
  await expect(dialog).toBeVisible()
  const dialogOverflow = await dialog.evaluate((element) => {
    const boundary = element.getBoundingClientRect()
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      offenders: [...element.querySelectorAll<HTMLElement>("*")]
        .map((child) => {
          const box = child.getBoundingClientRect()
          return {
            name:
              child.getAttribute("aria-label") ??
              child.textContent?.trim().slice(0, 40) ??
              child.tagName,
            left: Math.round(box.left),
            right: Math.round(box.right),
          }
        })
        .filter(
          ({ left, right }) =>
            left < Math.floor(boundary.left) ||
            right > Math.ceil(boundary.right),
        ),
    }
  })
  expect(
    dialogOverflow.scrollWidth,
    JSON.stringify(dialogOverflow),
  ).toBeLessThanOrEqual(dialogOverflow.clientWidth)

  const done = page.getByRole("button", { name: "Fine" })
  await done.evaluate((element) => element.scrollIntoView({ block: "center" }))
  const doneBox = await done.boundingBox()
  expect(doneBox).not.toBeNull()
  expect(doneBox!.y).toBeGreaterThanOrEqual(0)
  expect(doneBox!.y + doneBox!.height).toBeLessThanOrEqual(420)
})
