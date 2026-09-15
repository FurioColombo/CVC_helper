import { expect, test } from "@playwright/test"

test("Comandate empty state and proposal reflow at 320 px with 200% text", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "pixel-7-chrome",
    "One stress viewport is sufficient",
  )
  context.setDefaultTimeout(30_000)
  await page.setViewportSize({ width: 320, height: 664 })
  await page.goto("/")
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  await page.getByLabel("Nome", { exact: true }).fill("Mario")
  await page.getByLabel("Cognome", { exact: true }).fill("Rossi")
  await page.getByLabel(/^Data di nascita/).fill("2000-01-01")
  await page
    .getByRole("group", { name: "Sesso" })
    .getByText("M", { exact: true })
    .click()
  await page.getByRole("button", { name: "Salva allievo" }).click()
  await page.getByRole("button", { name: "Indietro da Allievi" }).click()
  await page.getByRole("button", { name: "Comandate" }).click()

  async function expectReflow() {
    expect(
      await page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        headings: [...document.querySelectorAll("h1, h2")].map((heading) => ({
          text: heading.textContent,
          width: heading.clientWidth,
          contentWidth: heading.scrollWidth,
        })),
      })),
    ).toEqual(
      expect.objectContaining({
        pageWidth: 320,
        viewportWidth: 320,
        headings: expect.arrayContaining([
          expect.objectContaining({ width: expect.any(Number) }),
        ]),
      }),
    )
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll("h1, h2")]
        .filter((heading) => heading.scrollWidth > heading.clientWidth)
        .map((heading) => heading.textContent),
    )
    expect(clipped).toEqual([])
  }

  await expect(page.getByRole("heading", { name: "Comandate" })).toBeVisible()
  await expect(page.getByText("Nessuna comandata pianificata")).toBeVisible()
  await expectReflow()
  await page.getByRole("button", { name: "Proponi comandate" }).click()
  await expect(
    page.getByRole("heading", { name: "Proposta comandate" }),
  ).toBeVisible()
  await expectReflow()
})
