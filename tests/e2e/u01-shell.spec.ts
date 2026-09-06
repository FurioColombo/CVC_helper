import { expect, test } from "@playwright/test"

const CONTRACT_VIEWPORTS = [
  { name: "stress", width: 320, height: 664 },
  { name: "medium", width: 390, height: 844 },
  { name: "large", width: 412, height: 915 },
] as const

async function expectNoHorizontalOverflow(
  page: import("@playwright/test").Page,
) {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .slice(0, 8)
      .map((element) => ({
        className: element.className,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        tagName: element.tagName,
        text: element.textContent?.trim().slice(0, 40),
      })),
  }))
  expect(
    overflow.scrollWidth,
    JSON.stringify(overflow.offenders),
  ).toBeLessThanOrEqual(overflow.clientWidth)
}

test("keeps course creation and Home usable at all contract viewports", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "The viewport matrix runs once; persistence is also covered in WebKit.",
  )

  await page.setViewportSize(CONTRACT_VIEWPORTS[0])
  await page.goto("/")

  await expect(
    page.getByRole("navigation", { name: "Navigazione principale" }),
  ).toHaveCount(0)
  const mark = page.getByRole("img", { name: "CVC" })
  await expect(mark).toBeVisible()
  await expect(mark.locator("img")).toHaveJSProperty("complete", true)

  await page.getByRole("button", { name: "Cabinato" }).click()
  await page.getByRole("button", { name: "Livello 4" }).click()
  await expect(page.locator('[data-course-identity^="C4 - "]')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.getByRole("button", { name: "Crea corso" }).click()
  await expect(page.getByRole("main")).toBeFocused()

  const interactiveSizes = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        ".home-card, .settings-button, .app-nav-button",
      ),
    ].map((element) => ({
      height: element.getBoundingClientRect().height,
      label: element.getAttribute("aria-label") ?? element.textContent?.trim(),
      width: element.getBoundingClientRect().width,
    })),
  )
  expect(interactiveSizes.length).toBe(10)
  for (const target of interactiveSizes) {
    expect(target.height, target.label).toBeGreaterThanOrEqual(44)
    expect(target.width, target.label).toBeGreaterThanOrEqual(44)
  }

  for (const viewport of CONTRACT_VIEWPORTS) {
    await page.setViewportSize(viewport)
    await expect(
      page.getByRole("heading", { name: /^C4 - \d{1,2} \| \d{4}$/ }),
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Allievi" })).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Valutazioni" }),
    ).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }

  await page.setViewportSize(CONTRACT_VIEWPORTS[0])
  await page.getByRole("button", { name: "Impostazioni" }).click()
  await expect(
    page.getByRole("heading", { name: "Impostazioni" }),
  ).toBeVisible()
  await expect(page.getByRole("main")).toBeFocused()
  await expect(page.locator('[data-course-identity^="C4 - "]')).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page
    .getByRole("navigation", { name: "Navigazione principale" })
    .getByRole("button", { name: "Home" })
    .click()

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await expectNoHorizontalOverflow(page)
  await expect(
    page.getByRole("heading", { name: /^C4 - \d{1,2} \| \d{4}$/ }),
  ).toBeVisible()
  const lastCard = page.getByRole("button", { name: "Volontari" })
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight)
  })
  const [lastCardBox, navBox] = await Promise.all([
    lastCard.boundingBox(),
    page
      .getByRole("navigation", { name: "Navigazione principale" })
      .boundingBox(),
  ])
  expect(lastCardBox).not.toBeNull()
  expect(navBox).not.toBeNull()
  expect(lastCardBox!.y + lastCardBox!.height).toBeLessThanOrEqual(navBox!.y)
  await page.evaluate(() => {
    document.documentElement.style.fontSize = ""
  })

  await page.reload()
  await expect(
    page.getByRole("heading", { name: /^C4 - \d{1,2} \| \d{4}$/ }),
  ).toBeVisible()
})
