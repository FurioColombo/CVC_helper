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
  // This click times out on the Linux runner and not here, with the empty-state
  // section reported as intercepting pointer events. The annotation text is
  // truncated at exactly the useful word, so the spec says what it sees: what
  // is at the click point, and which state the screen is actually in.
  try {
    await page.getByRole("button", { name: "Aggiungi allievo" }).click()
  } catch (error) {
    const seen = await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find(
        (candidate) =>
          (candidate.textContent || "").trim().startsWith("Aggiungi allievo"),
      )
      const box = button?.getBoundingClientRect()
      const at =
        box &&
        document.elementFromPoint(
          Math.round(box.left + box.width / 2),
          Math.round(box.top + box.height / 2),
        )
      return {
        screen: document.querySelector("main")?.innerText?.slice(0, 200),
        buttonFound: Boolean(button),
        buttonBox: box && {
          x: Math.round(box.x),
          y: Math.round(box.y),
          w: Math.round(box.width),
          h: Math.round(box.height),
        },
        viewport: { w: innerWidth, h: innerHeight },
        scrollable:
          document.scrollingElement!.scrollHeight -
          document.scrollingElement!.clientHeight,
        atClickPoint: at && {
          tag: at.tagName,
          className: at.className?.toString().slice(0, 90),
          isTheButton: at === button,
          containsTheButton: button ? at.contains(button) : null,
        },
      }
    })
    throw new Error(
      `${String(error).split("\n")[0]}\nwhat the page looked like: ${JSON.stringify(seen, null, 2)}`,
      { cause: error },
    )
  }
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
        // Reported because a page width on its own cannot be acted on. This
        // assertion failed for a while saying only 355 against 320, and the
        // element responsible — a grid of two buttons whose longest word plus
        // padding no longer fitted at 200% text — took a separate run to find.
        // Widest first, so the cause leads and its ancestors follow.
        offenders: [...document.querySelectorAll<HTMLElement>("body *")]
          .map((element) => ({
            tag: element.tagName,
            className: element.className,
            text: (element.textContent || "").trim().slice(0, 40),
            right: Math.round(element.getBoundingClientRect().right),
            selfOverflow: element.scrollWidth - element.clientWidth,
          }))
          .filter(
            (entry) =>
              entry.right > document.documentElement.clientWidth + 1 ||
              entry.selfOverflow > 1,
          )
          .sort((a, b) => b.right - a.right || b.selfOverflow - a.selfOverflow)
          .slice(0, 6),
      })),
    ).toEqual(
      expect.objectContaining({
        pageWidth: 320,
        viewportWidth: 320,
        offenders: [],
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
