import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test"
import sharp from "sharp"

/**
 * What the F4 summary image has to be: a screenshot of the summary's content.
 * These checks tap the real floating button, take the file the browser
 * downloads and compare it with Playwright's own screenshot of the same
 * content, so a blank, shifted, cropped or unstyled image fails.
 */

const BACKGROUND = { r: 0xff, g: 0xfd, b: 0xf8 }
const BACKGROUND_HEX = "#fffdf8"

/** With `CVC_REVIEW_DIR` set, the images a run makes are also copied there for
 *  a person to look at (synthetic data only; nothing is committed). */
export function saveReviewFile(name: string, data: Buffer) {
  const directory = process.env.CVC_REVIEW_DIR
  if (!directory) return
  mkdirSync(directory, { recursive: true })
  writeFileSync(path.join(directory, name), data)
}

/**
 * How far two images are apart, in two ways, once both are brought to the
 * same CSS-pixel grid.
 *
 * `mean` and `share` are about shape and place, in greyscale: each pixel is
 * compared with the other image's pixels within one CSS pixel of it and takes
 * the closest, so a half-pixel of rounding between two renderers (the
 * screenshot and the canvas round their sizes differently) and the coloured
 * fringes of the screenshot's sub-pixel text do not show as the outline of
 * every letter, while a missing line, a logo or a card that moved 2 px or more
 * does. `mean` is the average per-pixel difference (0 to 255), `share` the
 * fraction of pixels still off by more than 40.
 *
 * `colour` is about colour: the largest per-channel difference of the two
 * images averaged over 6 × 6 CSS-pixel blocks, where text fringes cancel out
 * but a wrong class colour, background or edge does not.
 */
export type ImageDifference = { mean: number; share: number; colour: number }

const COLOUR_BLOCK = 6

export async function imageDifference(
  first: Buffer,
  second: Buffer,
  cssWidth: number,
  cssHeight: number,
): Promise<ImageDifference> {
  const prepared = (input: Buffer) =>
    sharp(input).flatten({ background: BACKGROUND })
  const grid = (input: Buffer, width: number, height: number) =>
    prepared(input)
      .resize(width, height, { fit: "fill", kernel: "lanczos3" })
      .removeAlpha()
  const [lumaA, lumaB] = await Promise.all(
    [first, second].map((input) =>
      grid(input, cssWidth, cssHeight).greyscale().raw().toBuffer(),
    ),
  )
  let total = 0
  let differing = 0
  for (let row = 0; row < cssHeight; row += 1) {
    for (let column = 0; column < cssWidth; column += 1) {
      const here = row * cssWidth + column
      // Each image's pixel has to be found, nearly, in the other.
      let aInB = 255
      let bInA = 255
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const y = row + dy
          const x = column + dx
          if (y < 0 || y >= cssHeight || x < 0 || x >= cssWidth) continue
          const there = y * cssWidth + x
          aInB = Math.min(aInB, Math.abs(lumaA![here]! - lumaB![there]!))
          bInA = Math.min(bInA, Math.abs(lumaB![here]! - lumaA![there]!))
        }
      }
      const closest = Math.max(aInB, bInA)
      total += closest
      if (closest > 40) differing += 1
    }
  }

  const columns = Math.max(1, Math.round(cssWidth / COLOUR_BLOCK))
  const rows = Math.max(1, Math.round(cssHeight / COLOUR_BLOCK))
  const [blocksA, blocksB] = await Promise.all(
    [first, second].map((input) => grid(input, columns, rows).raw().toBuffer()),
  )
  let colourTotal = 0
  for (let pixel = 0; pixel < columns * rows; pixel += 1) {
    let largest = 0
    for (let channel = 0; channel < 3; channel += 1) {
      largest = Math.max(
        largest,
        Math.abs(
          blocksA![pixel * 3 + channel]! - blocksB![pixel * 3 + channel]!,
        ),
      )
    }
    colourTotal += largest
  }
  return {
    mean: total / (cssWidth * cssHeight),
    share: differing / (cssWidth * cssHeight),
    colour: colourTotal / (columns * rows),
  }
}

/** A faithful render stays under all three (measured on the F4 journeys: mean
 *  0.9-1.4, share 0.3-0.5%, colour 0.9-1.3); a blank, 6 px shifted or
 *  colourless one is over at least one by a factor of 2 or more (the F4 crew
 *  test measures them on every run). */
export const MAX_MEAN_DIFFERENCE = 2.5
export const MAX_DIFFERENT_SHARE = 0.012
export const MAX_COLOUR_DIFFERENCE = 3.5

/** Pixels in `box` (CSS px, relative to the image's top-left) that are not
 *  the page background: `share` of them, as a fraction. */
export async function inkShare(
  png: Buffer,
  ratio: number,
  box: { x: number; y: number; width: number; height: number },
): Promise<number> {
  const region = await sharp(png)
    .flatten({ background: BACKGROUND })
    .extract({
      left: Math.max(0, Math.round(box.x * ratio)),
      top: Math.max(0, Math.round(box.y * ratio)),
      width: Math.max(1, Math.round(box.width * ratio)),
      height: Math.max(1, Math.round(box.height * ratio)),
    })
    .removeAlpha()
    .raw()
    .toBuffer()
  let inked = 0
  for (let pixel = 0; pixel < region.length / 3; pixel += 1) {
    const largest = Math.max(
      Math.abs(region[pixel * 3]! - BACKGROUND.r),
      Math.abs(region[pixel * 3 + 1]! - BACKGROUND.g),
      Math.abs(region[pixel * 3 + 2]! - BACKGROUND.b),
    )
    if (largest > 24) inked += 1
  }
  return inked / (region.length / 3)
}

export type SummaryImageResult = {
  png: Buffer
  /** Device pixels per CSS pixel the image was made at. */
  ratio: number
  /** The capture root's CSS width, and the CSS height the image should have. */
  cssWidth: number
  cssHeight: number
  difference: ImageDifference
  /** Playwright's own screenshot of the same visible content, buttons
   *  covered, and its height in CSS px: what `difference` is measured against. */
  screenshot: Buffer
  visibleHeight: number
  /** The root's position in the viewport before the tap. */
  root: { x: number; y: number; width: number; height: number }
}

/**
 * Taps "Salva immagine" on the open summary `view`, takes the downloaded PNG
 * and checks it against the screen: width is the content width at the ratio
 * used, height covers every group (including those below the fold), the
 * visible top of it matches a screenshot of the same content with the close
 * and save buttons covered, and the close button's place is empty.
 */
export async function saveAndCheckSummaryImage(
  page: Page,
  view: Locator,
  testInfo: TestInfo,
  options: { name: string; expectedNote?: RegExp },
): Promise<SummaryImageResult> {
  const root = view.locator(":scope > div").first()
  await view.evaluate((element) => {
    element.scrollTop = 0
  })
  // Everything the image should reproduce is measured before the tap, in the
  // state the person sees.
  const measured = await root.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    let contentBottom = rect.top
    for (const child of Array.from(element.querySelectorAll("*"))) {
      if (child.closest("[data-snapshot-exclude]")) continue
      contentBottom = Math.max(
        contentBottom,
        child.getBoundingClientRect().bottom,
      )
    }
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      // The image's own padding is a plain 16px above and below the content.
      imageHeight: contentBottom - rect.top + 16,
      ratio: window.devicePixelRatio,
      closeX: (() => {
        const close = element.querySelector<HTMLElement>(
          "[data-snapshot-exclude]",
        )
        const box = close?.getBoundingClientRect()
        return box
          ? {
              x: box.x - rect.x,
              y: box.y - rect.y,
              width: box.width,
              height: box.height,
            }
          : null
      })(),
    }
  })
  const viewport = page.viewportSize()!
  const visibleHeight = Math.min(
    measured.imageHeight,
    viewport.height - measured.y,
  )
  const screenshot = await page.screenshot({
    clip: {
      x: measured.x,
      y: measured.y,
      width: measured.width,
      height: visibleHeight,
    },
    mask: [view.locator('[data-snapshot-exclude="true"]')],
    maskColor: BACKGROUND_HEX,
  })

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    view
      .getByRole("button", { name: "Salva immagine riepilogo e copiala" })
      .click(),
  ])
  // The note is up for a few seconds only, so it is read before the slow part.
  if (options.expectedNote) {
    await expect(view.getByRole("status")).toHaveText(options.expectedNote)
  }
  const filePath = testInfo.outputPath(`${options.name}.png`)
  await download.saveAs(filePath)
  const png = await sharp(filePath).toBuffer()
  const metadata = await sharp(png).metadata()
  expect(metadata.format).toBe("png")
  saveReviewFile(`${options.name}.png`, png)
  saveReviewFile(`${options.name}-screen.png`, screenshot)

  const cssWidth = Math.ceil(measured.width)
  // Width: the content's width at the density used (the screen's, 2× to 3×).
  const ratio = metadata.width! / cssWidth
  expect(ratio, `density ${ratio}`).toBeGreaterThanOrEqual(2 - 0.01)
  expect(ratio, `density ${ratio}`).toBeLessThanOrEqual(3 + 0.01)
  expect(Math.abs(ratio - measured.ratio), `density ${ratio}`).toBeLessThan(
    0.01,
  )
  // Height: every group, even below the fold, and no empty tail.
  const cssHeight = metadata.height! / ratio
  expect(
    Math.abs(cssHeight - measured.imageHeight),
    `height ${cssHeight} vs ${measured.imageHeight}`,
  ).toBeLessThanOrEqual(3)

  // It looks like the screen: the same content, buttons aside.
  const shown = await sharp(png)
    .extract({
      left: 0,
      top: 0,
      width: metadata.width!,
      height: Math.min(metadata.height!, Math.round(visibleHeight * ratio)),
    })
    .toBuffer()
  const difference = await imageDifference(
    shown,
    screenshot,
    cssWidth,
    Math.round(visibleHeight),
  )
  testInfo.annotations.push({
    type: "difference",
    description: JSON.stringify(difference),
  })
  expect(
    difference.mean,
    `mean ${difference.mean}, share ${difference.share}`,
  ).toBeLessThanOrEqual(MAX_MEAN_DIFFERENCE)
  expect(
    difference.share,
    `mean ${difference.mean}, share ${difference.share}`,
  ).toBeLessThanOrEqual(MAX_DIFFERENT_SHARE)
  expect(difference.colour, JSON.stringify(difference)).toBeLessThanOrEqual(
    MAX_COLOUR_DIFFERENCE,
  )

  // The close button is not in the picture.
  if (measured.closeX) {
    expect(
      await inkShare(png, ratio, measured.closeX),
      "the close button's place is empty",
    ).toBe(0)
  }
  return {
    png,
    ratio,
    cssWidth,
    cssHeight,
    difference,
    screenshot,
    visibleHeight,
    root: {
      x: measured.x,
      y: measured.y,
      width: measured.width,
      height: measured.height,
    },
  }
}

/** Every logo on the summary is in the picture, not an empty slot: the
 *  region it occupies on screen holds ink. */
export async function expectLogosInImage(
  view: Locator,
  result: SummaryImageResult,
) {
  const logos = await view.locator("img").evaluateAll(
    (images, root) =>
      images.map((image) => {
        const box = image.getBoundingClientRect()
        return {
          alt: image.getAttribute("alt"),
          loaded: (image as HTMLImageElement).naturalWidth > 0,
          x: box.x - root.x,
          y: box.y - root.y,
          width: box.width,
          height: box.height,
        }
      }),
    result.root,
  )
  expect(logos.length, "the summary shows boat logos").toBeGreaterThan(0)
  for (const logo of logos) {
    expect(logo.loaded, `${logo.alt} loaded on screen`).toBe(true)
    expect(
      await inkShare(result.png, result.ratio, logo),
      `${logo.alt} is drawn in the image`,
    ).toBeGreaterThan(0.04)
  }
}

/**
 * At the end of the scroll nothing on the summary is under the floating save
 * button, at the top the close button is not either, the button keeps its
 * touch size and stays on the screen, and neither the page nor the dialog
 * scrolls sideways. `where` names the viewport in a failure.
 */
export async function expectSaveButtonLayout(
  view: Locator,
  where: string,
  minHeight = 48,
) {
  const save = view.getByRole("button", {
    name: "Salva immagine riepilogo e copiala",
  })
  const close = view.getByRole("button", { name: "Chiudi vista lettura" })
  await view.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  const boxes = await view.evaluate((element) => {
    const button = element.querySelector<HTMLElement>(
      "button[aria-label^='Salva immagine']",
    )!
    const box = button.getBoundingClientRect()
    let contentBottom = 0
    for (const child of Array.from(
      element.querySelectorAll(":scope > div:first-child *"),
    )) {
      const rect = child.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        contentBottom = Math.max(contentBottom, rect.bottom)
      }
    }
    return {
      top: box.top,
      right: box.right,
      left: box.left,
      height: box.height,
      contentBottom,
      text: button.textContent,
      viewport: window.innerWidth,
      pageOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      dialogOverflow: element.scrollWidth - element.clientWidth,
    }
  })
  const detail = `${where}: ${JSON.stringify(boxes)}`
  expect(boxes.contentBottom, detail).toBeLessThanOrEqual(boxes.top)
  expect(boxes.height, detail).toBeGreaterThanOrEqual(minHeight)
  expect(boxes.left, detail).toBeGreaterThanOrEqual(0)
  expect(boxes.right, detail).toBeLessThanOrEqual(boxes.viewport)
  expect(boxes.text, detail).toContain("Salva immagine")
  expect(boxes.pageOverflow, detail).toBeLessThanOrEqual(1)
  expect(boxes.dialogOverflow, detail).toBeLessThanOrEqual(1)

  await view.evaluate((element) => {
    element.scrollTop = 0
  })
  const closeBox = (await close.boundingBox())!
  const saveBox = (await save.boundingBox())!
  expect(
    closeBox.y + closeBox.height <= saveBox.y ||
      saveBox.y + saveBox.height <= closeBox.y,
    `${where}: close ${JSON.stringify(closeBox)} save ${JSON.stringify(saveBox)}`,
  ).toBe(true)
}

/**
 * The button and its note on the screen, at 390 × 844 and at the 320 px /
 * 200% text stress profile, saved for a person to judge (`CVC_REVIEW_DIR`);
 * at 320 px the note still fits the width. Leaves the page at 320 px / 200%.
 */
export async function captureSaveButtonWithNote(
  page: Page,
  view: Locator,
  prefix: string,
) {
  const save = view.getByRole("button", {
    name: "Salva immagine riepilogo e copiala",
  })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = ""
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await save.click()
  await expect(view.getByRole("status")).toContainText("Immagine salvata")
  saveReviewFile(`${prefix}-button-390x844.png`, await page.screenshot())
  await page.setViewportSize({ width: 320, height: 664 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await save.click()
  await expect(view.getByRole("status")).toContainText("Immagine salvata")
  saveReviewFile(`${prefix}-button-320-200pct.png`, await page.screenshot())
  const noteBox = (await view.getByRole("status").boundingBox())!
  expect(noteBox.x).toBeGreaterThanOrEqual(0)
  expect(noteBox.x + noteBox.width).toBeLessThanOrEqual(320)
}
