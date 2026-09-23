import path from "node:path"

import { expect, test } from "@playwright/test"

const CLEAR_ROSTER = path.resolve("tests/fixtures/ocr-sheet-clear.png")

async function openScan(page: import("@playwright/test").Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Deriva" }).click()
  await page.getByRole("button", { name: "Livello 2" }).click()
  await page.getByRole("button", { name: "Crea corso" }).click()
  await page.getByRole("button", { name: "Allievi" }).click()
  await page.getByRole("button", { name: "Scan allievi" }).click()
}

test("keeps acquisition and adjustment usable on compact screens", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 664 })
  await openScan(page)

  await expect(page.getByRole("button", { name: "Fai una foto" })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Scegli dalla galleria" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Inserisci manualmente" }),
  ).toBeVisible()
  await expect(page.locator("html")).toHaveJSProperty("scrollLeft", 0)

  await page
    .getByLabel("Scegli foto dell’elenco allievi dalla galleria")
    .setInputFiles(CLEAR_ROSTER)
  const dialog = page.getByRole("dialog", { name: "Raddrizza e ritaglia foto" })
  await expect(dialog).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Usa questa area" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", {
      name: "Ridimensiona ritaglio dall’angolo in basso a destra",
    }),
  ).toBeVisible()
  const workspace = page.getByLabel("Area di lavoro foto")
  await expect(workspace).toBeVisible()
  await expect(page.getByAltText("Anteprima foto da ritagliare")).toBeVisible()
  const workspaceBounds = await workspace.boundingBox()
  expect(workspaceBounds).not.toBeNull()
  const edgeHandles = [
    "Ridimensiona ritaglio dal bordo superiore",
    "Ridimensiona ritaglio dal bordo destro",
    "Ridimensiona ritaglio dal bordo inferiore",
    "Ridimensiona ritaglio dal bordo sinistro",
  ]
  for (const name of edgeHandles) {
    const handle = page.getByRole("button", { name })
    await expect(handle).toBeVisible()
    const bounds = await handle.boundingBox()
    expect(bounds?.width).toBeGreaterThanOrEqual(44)
    expect(bounds?.height).toBeGreaterThanOrEqual(44)
    expect(bounds?.x).toBeGreaterThanOrEqual(workspaceBounds!.x - 1)
    expect(bounds?.y).toBeGreaterThanOrEqual(workspaceBounds!.y - 1)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
      workspaceBounds!.x + workspaceBounds!.width + 1,
    )
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
      workspaceBounds!.y + workspaceBounds!.height + 1,
    )
  }
  // The correction replaced the rotation slider with a document workspace.
  await expect(page.locator('input[type="range"]')).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Raddrizza con una linea" }),
  ).toBeVisible()
  const dial = page.getByRole("slider", { name: "Inclinazione in gradi" })
  await dial.focus()
  await dial.press("ArrowRight")
  await expect(dial).toHaveAttribute("aria-valuenow", "0.1")
  await page.getByRole("group", { name: /Area di ritaglio/ }).press("ArrowDown")
  await page.screenshot({
    fullPage: true,
    path: path.resolve(
      `test-results/screenshots/editor-${testInfo.project.name}.png`,
    ),
  })

  const overflow = await page.evaluate(() => ({
    document:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    dialog:
      (document.querySelector('[role="dialog"]')?.scrollWidth ?? 0) -
      (document.querySelector('[role="dialog"]')?.clientWidth ?? 0),
  }))
  expect(overflow.document).toBeLessThanOrEqual(0)
  expect(overflow.dialog).toBeLessThanOrEqual(0)

  await page.getByRole("button", { name: "Chiudi regolazione foto" }).click()
  await expect(
    page.getByRole("button", { name: "Scegli dalla galleria" }),
  ).toBeFocused()
})

test("keeps scan entry readable at 200 percent text", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 664 })
  await openScan(page)
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" })

  for (const name of [
    "Fai una foto",
    "Scegli dalla galleria",
    "Inserisci manualmente",
  ]) {
    await expect(page.getByRole("button", { name })).toBeVisible()
  }
  // S1 added a choice to this screen; at 200% text it is two lines of Italian
  // beside a box, which is exactly the shape that overflowed elsewhere.
  const readPhone = page.getByRole("checkbox", {
    name: /Leggi anche il telefono/,
  })
  await expect(readPhone).toBeVisible()
  await expect(readPhone).not.toBeChecked()
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test("edge handles work by keyboard and tilt updates the crop image live", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openScan(page)
  await page
    .getByLabel("Scegli foto dell’elenco allievi dalla galleria")
    .setInputFiles(CLEAR_ROSTER)

  const preview = page.getByTestId("student-scan-live-preview")
  const frame = page.getByTestId("student-scan-crop-frame")
  await expect(preview).toBeVisible()
  await expect(frame).toBeVisible()
  const edgeGestures = [
    {
      name: "Ridimensiona ritaglio dal bordo superiore",
      key: "ArrowDown",
      dimension: "height",
    },
    {
      name: "Ridimensiona ritaglio dal bordo destro",
      key: "ArrowLeft",
      dimension: "width",
    },
    {
      name: "Ridimensiona ritaglio dal bordo inferiore",
      key: "ArrowUp",
      dimension: "height",
    },
    {
      name: "Ridimensiona ritaglio dal bordo sinistro",
      key: "ArrowRight",
      dimension: "width",
    },
  ] as const

  // The default crop includes the whole sheet. Pull both corners inward before
  // exercising edge adjustments so every edge has room to move on every browser.
  const bottomRight = page.getByRole("button", {
    name: "Ridimensiona ritaglio dall’angolo in basso a destra",
  })
  await bottomRight.press("Shift+ArrowLeft")
  await bottomRight.press("Shift+ArrowUp")
  const topLeft = page.getByRole("button", {
    name: "Ridimensiona ritaglio dall’angolo in alto a sinistra",
  })
  await topLeft.press("Shift+ArrowRight")
  await topLeft.press("Shift+ArrowDown")

  for (const { name, key, dimension } of edgeGestures) {
    const before = await frame.boundingBox()
    expect(before).not.toBeNull()
    await page.getByRole("button", { name }).press(key)
    const after = await frame.boundingBox()
    expect(after).not.toBeNull()
    expect(after![dimension]).toBeLessThan(before![dimension])
  }

  const dial = page.getByRole("slider", { name: "Inclinazione in gradi" })
  const dialBounds = await dial.boundingBox()
  expect(dialBounds).not.toBeNull()
  await page.mouse.move(
    dialBounds!.x + dialBounds!.width / 2,
    dialBounds!.y + dialBounds!.height / 2,
  )
  await expect(dial).toHaveAttribute("aria-valuenow", "0")
  const imageTransformBefore = await preview.evaluate(
    (element) => getComputedStyle(element).transform,
  )
  const frameBefore = await frame.boundingBox()
  expect(frameBefore).not.toBeNull()

  // Time the DOM response from the real pointer event to the shared image/crop
  // transform. The pointer stays down while we sample, before the debounced
  // high-resolution preview can replace the temporary rotation.
  await page.evaluate(() => {
    const dialElement = document.querySelector<HTMLElement>(
      '[role="slider"][aria-label="Inclinazione in gradi"]',
    )
    const previewElement = document.querySelector<HTMLElement>(
      '[data-testid="student-scan-live-preview"]',
    )
    if (!dialElement || !previewElement) throw new Error("V04 surface missing")
    const windowWithTiming = window as typeof window & {
      __v04Timing?: { pointerMoveAt: number | null; transformAt: number | null }
    }
    windowWithTiming.__v04Timing = { pointerMoveAt: null, transformAt: null }
    dialElement.addEventListener(
      "pointermove",
      () => {
        const timing = windowWithTiming.__v04Timing
        if (timing && timing.pointerMoveAt === null)
          timing.pointerMoveAt = performance.now()
      },
      { capture: true, once: true },
    )
    new MutationObserver(() => {
      const timing = windowWithTiming.__v04Timing
      if (timing && timing.transformAt === null)
        timing.transformAt = performance.now()
    }).observe(previewElement, { attributes: true, attributeFilter: ["style"] })
  })

  await page.mouse.down()
  await page.mouse.move(
    dialBounds!.x + dialBounds!.width / 2 + 90,
    dialBounds!.y + dialBounds!.height / 2,
  )
  await page.waitForFunction(
    () => {
      const timing = (
        window as typeof window & {
          __v04Timing?: {
            pointerMoveAt: number | null
            transformAt: number | null
          }
        }
      ).__v04Timing
      const dialElement = document.querySelector<HTMLElement>(
        '[role="slider"][aria-label="Inclinazione in gradi"]',
      )
      return (
        timing?.transformAt !== null &&
        timing?.transformAt !== undefined &&
        dialElement?.getAttribute("aria-valuenow") !== "0"
      )
    },
    undefined,
    { timeout: 100 },
  )
  const timing = await page.evaluate(() => {
    const value = (
      window as typeof window & {
        __v04Timing?: {
          pointerMoveAt: number | null
          transformAt: number | null
        }
      }
    ).__v04Timing
    const previewElement = document.querySelector<HTMLElement>(
      '[data-testid="student-scan-live-preview"]',
    )
    const frameElement = document.querySelector<HTMLElement>(
      '[data-testid="student-scan-crop-frame"]',
    )
    if (!value || !previewElement || !frameElement)
      throw new Error("V04 timing sample missing")
    const rect = frameElement.getBoundingClientRect()
    return {
      pointerMoveAt: value.pointerMoveAt,
      transformAt: value.transformAt,
      imageTransform: getComputedStyle(previewElement).transform,
      frame: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    }
  })
  expect(timing.imageTransform).not.toBe(imageTransformBefore)
  expect(timing.pointerMoveAt).not.toBeNull()
  expect(timing.transformAt).not.toBeNull()
  const responseMs = timing.transformAt! - timing.pointerMoveAt!
  expect(responseMs).toBeGreaterThanOrEqual(0)
  expect(responseMs).toBeLessThan(120)
  expect(
    Math.abs(timing.frame.x - frameBefore!.x) +
      Math.abs(timing.frame.y - frameBefore!.y) +
      Math.abs(timing.frame.width - frameBefore!.width) +
      Math.abs(timing.frame.height - frameBefore!.height),
  ).toBeGreaterThan(1)
  console.log(
    JSON.stringify({
      metric: "pointermove-to-live-crop-transform-ms",
      project: testInfo.project.name,
      value: responseMs,
      frameMoved: true,
    }),
  )
  if (testInfo.project.name === "pixel-7-chrome") {
    await page.screenshot({
      path: path.resolve("test-results/screenshots/editor-mid-drag.png"),
    })
  }
  await page.mouse.up()
})

test("all eight crop targets resize only their intended edges at 20 percent", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 664 })
  await openScan(page)
  await page
    .getByLabel("Scegli foto dell’elenco allievi dalla galleria")
    .setInputFiles(CLEAR_ROSTER)

  const frame = page.getByTestId("student-scan-crop-frame")
  const workspace = page.getByLabel("Area di lavoro foto")
  await expect(frame).toBeVisible()
  await expect(workspace).toBeVisible()

  const topLeft = page.getByRole("button", {
    name: "Ridimensiona ritaglio dall’angolo in alto a sinistra",
  })
  const bottomRight = page.getByRole("button", {
    name: "Ridimensiona ritaglio dall’angolo in basso a destra",
  })
  await page.getByRole("button", { name: "Ripristina foto" }).click()
  for (let step = 0; step < 8; step += 1) {
    await topLeft.press("Shift+ArrowRight")
    await topLeft.press("Shift+ArrowDown")
    await bottomRight.press("Shift+ArrowLeft")
    await bottomRight.press("Shift+ArrowUp")
  }

  const readCropEdges = () =>
    frame.evaluate((element) => {
      const style = (element as HTMLElement).style
      const left = Number.parseFloat(style.left)
      const top = Number.parseFloat(style.top)
      return {
        left,
        top,
        right: left + Number.parseFloat(style.width),
        bottom: top + Number.parseFloat(style.height),
      }
    })
  const centeredCrop = await readCropEdges()
  expect(centeredCrop.left).toBeCloseTo(40, 3)
  expect(centeredCrop.top).toBeCloseTo(40, 3)
  expect(centeredCrop.right).toBeCloseTo(60, 3)
  expect(centeredCrop.bottom).toBeCloseTo(60, 3)

  const edgeNames = ["left", "top", "right", "bottom"] as const
  type CropEdge = (typeof edgeNames)[number]
  type EdgeDirection = "increase" | "decrease"
  const handles: Array<{
    name: string
    dx: number
    dy: number
    edges: Partial<Record<CropEdge, EdgeDirection>>
  }> = [
    {
      name: "Ridimensiona ritaglio dall’angolo in alto a sinistra",
      dx: -20,
      dy: -20,
      edges: { left: "decrease", top: "decrease" },
    },
    {
      name: "Ridimensiona ritaglio dall’angolo in alto a destra",
      dx: 20,
      dy: -20,
      edges: { right: "increase", top: "decrease" },
    },
    {
      name: "Ridimensiona ritaglio dall’angolo in basso a sinistra",
      dx: -20,
      dy: 20,
      edges: { left: "decrease", bottom: "increase" },
    },
    {
      name: "Ridimensiona ritaglio dall’angolo in basso a destra",
      dx: 20,
      dy: 20,
      edges: { right: "increase", bottom: "increase" },
    },
    {
      name: "Ridimensiona ritaglio dal bordo superiore",
      dx: 0,
      dy: -20,
      edges: { top: "decrease" },
    },
    {
      name: "Ridimensiona ritaglio dal bordo destro",
      dx: 20,
      dy: 0,
      edges: { right: "increase" },
    },
    {
      name: "Ridimensiona ritaglio dal bordo inferiore",
      dx: 0,
      dy: 20,
      edges: { bottom: "increase" },
    },
    {
      name: "Ridimensiona ritaglio dal bordo sinistro",
      dx: -20,
      dy: 0,
      edges: { left: "decrease" },
    },
  ] as const
  for (const handleCase of handles) {
    const handle = page.getByRole("button", { name: handleCase.name })
    const bounds = await handle.boundingBox()
    expect(bounds, `${handleCase.name} has no visible bounds`).not.toBeNull()
    // Chromium can report 43.99997px after opposing zoom transforms; accept
    // sub-tenth-pixel float rounding while rejecting a genuinely short target.
    expect(bounds!.width).toBeGreaterThanOrEqual(43.9)
    expect(bounds!.height).toBeGreaterThanOrEqual(43.9)
    const start = {
      x: bounds!.x + bounds!.width / 2,
      y: bounds!.y + bounds!.height / 2,
    }
    await page.mouse.move(start.x, start.y)
    const hit = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y)
      const button = element?.closest<HTMLButtonElement>("button[aria-label]")
      return {
        tag: element?.tagName ?? null,
        className: element?.getAttribute("class") ?? null,
        nearestButton: button?.getAttribute("aria-label") ?? null,
      }
    }, start)
    expect(
      hit.nearestButton,
      `Center of ${handleCase.name} hit ${JSON.stringify(hit)}`,
    ).toBe(handleCase.name)

    await page.evaluate(() => {
      document.body.dataset.v04PointerTarget = ""
      document.addEventListener(
        "pointerdown",
        (event) => {
          const target = event.target as Element | null
          const button =
            target?.closest<HTMLButtonElement>("button[aria-label]")
          document.body.dataset.v04PointerTarget =
            button?.getAttribute("aria-label") ??
            `<${target?.tagName ?? "null"}>`
        },
        { capture: true, once: true },
      )
    })
    const before = await readCropEdges()
    await page.mouse.down()
    const pointerTarget = await page
      .locator("body")
      .getAttribute("data-v04-pointer-target")
    expect(
      pointerTarget,
      `Pointer-down for ${handleCase.name} landed on ${pointerTarget}`,
    ).toBe(handleCase.name)
    await page.mouse.move(start.x + handleCase.dx, start.y + handleCase.dy, {
      steps: 2,
    })
    await page.mouse.up()
    const after = await readCropEdges()

    for (const edge of edgeNames) {
      const direction = handleCase.edges[edge]
      if (direction === "increase") {
        expect(
          after[edge],
          `${handleCase.name} should increase ${edge}`,
        ).toBeGreaterThan(before[edge])
      } else if (direction === "decrease") {
        expect(
          after[edge],
          `${handleCase.name} should decrease ${edge}`,
        ).toBeLessThan(before[edge])
      } else {
        expect(
          after[edge],
          `${handleCase.name} must preserve ${edge}`,
        ).toBeCloseTo(before[edge], 3)
      }
    }
    console.log(
      JSON.stringify({
        handle: handleCase.name,
        hit,
        pointerTarget,
        before,
        after,
      }),
    )
  }
})
