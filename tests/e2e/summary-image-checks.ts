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
 * These checks tap the real floating "Copia immagine" button, take the PNG it
 * makes (the page hands it over through a dev-only hook, because Playwright's
 * WebKit cannot read the clipboard back) and compare it with Playwright's own
 * screenshot of the same content, so a blank, shifted, cropped or unstyled
 * image fails. They also check, without a screenshot, that no text was laid
 * out again: the number of lines of every piece of text in the image is the
 * number on screen, and nothing is drawn outside its card.
 */

const BACKGROUND = { r: 0xff, g: 0xfd, b: 0xf8 }
const BACKGROUND_HEX = "#fffdf8"

export const COPY_BUTTON_NAME = "Copia immagine riepilogo"
export const COPIED_NOTE = /^Immagine copiata\. Incollala su WhatsApp\.$/

/** The plain space the image keeps above and below the content, in CSS px. */
const IMAGE_MARGIN = 16

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
 * screenshot and the canvas place text a little differently) and the coloured
 * fringes of the screenshot's sub-pixel text do not show as the outline of
 * every letter, while a missing line, a logo or a card that moved 2 px or more
 * does. `mean` is the average per-pixel difference (0 to 255), `share` the
 * fraction of pixels still off by more than 40.
 *
 * `colour` is about colour: the largest per-channel difference of the two
 * images averaged over 12 × 12 CSS-pixel blocks, where text fringes and the
 * 1-2 device pixels by which the screen's own raster sits off its layout
 * (visible at 320 px in a wide font) cancel out, but a wrong class colour,
 * background or edge does not.
 */
export type ImageDifference = { mean: number; share: number; colour: number }

const COLOUR_BLOCK = 12

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

/** A faithful render stays under all three (measured on the F4 journeys, in
 *  Chromium and WebKit, in the default font and in DejaVu Sans: mean 0.04-1.5,
 *  share 0-0.7%, colour 0.1-1.5); a blank, 6 px shifted or colourless one is
 *  over at least one by a factor of 1.8 or more (the crew journey measures them
 *  on every run: colourless is 4.8-5.3 against 2.5). The colour limit and its
 *  12 px blocks were 3.5 and 6 px blocks until a wide font at 320 px came to
 *  2.8 of the 3.5. */
export const MAX_MEAN_DIFFERENCE = 2.5
export const MAX_DIFFERENT_SHARE = 0.012
export const MAX_COLOUR_DIFFERENCE = 2.5

/** A box in CSS px, relative to the image's top-left corner. */
export type Box = { x: number; y: number; width: number; height: number }

/** The part of `box` that lies inside an image, in device pixels. */
function deviceRegion(
  box: Box,
  ratio: number,
  imageWidth: number,
  imageHeight: number,
) {
  const left = Math.min(imageWidth - 1, Math.max(0, Math.floor(box.x * ratio)))
  const top = Math.min(imageHeight - 1, Math.max(0, Math.floor(box.y * ratio)))
  const right = Math.min(imageWidth, Math.ceil((box.x + box.width) * ratio))
  const bottom = Math.min(imageHeight, Math.ceil((box.y + box.height) * ratio))
  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  }
}

/** Pixels in `box` (CSS px, relative to the image's top-left) that are not
 *  the page background: `share` of them, as a fraction. */
export async function inkShare(
  png: Buffer,
  ratio: number,
  box: Box,
): Promise<number> {
  const metadata = await sharp(png).metadata()
  const region = await sharp(png)
    .flatten({ background: BACKGROUND })
    .extract(deviceRegion(box, ratio, metadata.width!, metadata.height!))
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

/** One piece of text on the summary and where it is, relative to the image. */
type TextLeaf = { text: string; lines: number } & Box

/** What the screen shows of the summary, measured in the page before the tap. */
export type SummaryMeasure = {
  /** The capture root's box in the viewport, and the viewport row the image's
   *  first row is (16px above the root's content, whatever its own padding). */
  root: Box
  imageTop: number
  /** How tall the image has to be: the lowest thing painted, 16px each side. */
  imageHeight: number
  /** Device pixels per CSS pixel. */
  ratio: number
  /** The close button, when the summary has one, and every card. */
  close: Box | null
  cards: Array<Box & { name: string }>
  leaves: TextLeaf[]
  /** Every word, one box per line it sits on, and every picture or coloured
   *  box (a badge, a card's edge): where the screen has anything to draw. */
  words: Box[]
  shapes: Box[]
  lastCardBottom: number | null
}

export async function measureSummary(root: Locator): Promise<SummaryMeasure> {
  return root.evaluate((element, margin) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const contentTop =
      rect.top +
      Number.parseFloat(style.borderTopWidth) +
      Number.parseFloat(style.paddingTop)
    const imageTop = contentTop - margin
    const range = document.createRange()
    const relative = (box: {
      left: number
      top: number
      width: number
      height: number
    }) => ({
      x: box.left - rect.left,
      y: box.top - imageTop,
      width: box.width,
      height: box.height,
    })
    const textRects = (node: Text) => {
      const rects: DOMRect[] = []
      for (const match of node.data.matchAll(/\S+/gu)) {
        range.setStart(node, match.index)
        range.setEnd(node, match.index + match[0].length)
        for (const box of Array.from(range.getClientRects())) {
          if (box.width > 0 && box.height > 0) rects.push(box)
        }
      }
      return rects
    }

    // The lowest thing that paints: a box with a background or a border, an
    // image, an icon, a word. (The grid that holds the cards is not one: it
    // reaches past the last card to the note that is left out of the image.)
    let lowest = contentTop
    const leaves: Array<{
      text: string
      lines: number
      x: number
      y: number
      width: number
      height: number
    }> = []
    const words: ReturnType<typeof relative>[] = []
    const shapes: ReturnType<typeof relative>[] = []
    for (const item of [
      element,
      ...Array.from(element.querySelectorAll("*")),
    ]) {
      if (item.closest("[data-snapshot-exclude]")) continue
      const computed = getComputedStyle(item)
      if (computed.display === "none") continue
      const box = item.getBoundingClientRect()
      const paintsBox =
        computed.backgroundColor !== "rgba(0, 0, 0, 0)" ||
        ["Top", "Right", "Bottom", "Left"].some(
          (side) =>
            Number.parseFloat(
              computed.getPropertyValue(`border-${side.toLowerCase()}-width`),
            ) > 0 &&
            computed.getPropertyValue(`border-${side.toLowerCase()}-style`) !==
              "none",
        )
      const isPicture =
        item instanceof HTMLImageElement || item instanceof SVGSVGElement
      if ((paintsBox || isPicture) && box.width > 0 && box.height > 0) {
        lowest = Math.max(lowest, box.bottom)
      }
      // A white box (a card) holds other things; its border is paler than ink.
      const coloured =
        (computed.backgroundColor !== "rgba(0, 0, 0, 0)" &&
          computed.backgroundColor !== "rgb(255, 255, 255)") ||
        computed.boxShadow !== "none"
      if ((coloured || isPicture) && box.width > 0 && box.height > 0) {
        shapes.push(relative(box))
      }
      const rects: DOMRect[] = []
      for (const node of Array.from(item.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          rects.push(...textRects(node as Text))
        }
      }
      if (rects.length === 0) continue
      for (const box of rects) {
        lowest = Math.max(lowest, box.bottom)
        words.push(relative(box))
      }
      const tops = rects.map((box) => box.top).sort((a, b) => a - b)
      const height = Math.min(...rects.map((box) => box.height))
      let lines = 1
      for (let index = 1; index < tops.length; index += 1) {
        if (tops[index]! - tops[index - 1]! > height / 2) lines += 1
      }
      const left = Math.min(...rects.map((box) => box.left))
      const right = Math.max(...rects.map((box) => box.right))
      const top = tops[0]!
      const bottom = Math.max(...rects.map((box) => box.bottom))
      leaves.push({
        text: item.textContent ?? "",
        lines,
        ...relative({ left, top, width: right - left, height: bottom - top }),
      })
    }

    const closeButton = element.querySelector("[data-snapshot-exclude]")
    const cards = Array.from(element.querySelectorAll("li")).map((card) => ({
      name: card.getAttribute("aria-label") ?? "",
      ...relative(card.getBoundingClientRect()),
    }))
    const cardBottoms = cards.map((card) => card.y + card.height)
    return {
      root: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      imageTop,
      imageHeight: lowest - contentTop + 2 * margin,
      ratio: window.devicePixelRatio,
      close: closeButton ? relative(closeButton.getBoundingClientRect()) : null,
      cards,
      leaves,
      words,
      shapes,
      lastCardBottom: cardBottoms.length > 0 ? Math.max(...cardBottoms) : null,
    }
  }, IMAGE_MARGIN)
}

/**
 * What is wrong with the image given what the screen showed (nothing, when it
 * is faithful). The failure this guards against is the image laying its text
 * out a second time — a phone measuring names a little wider than its page
 * did — so that names wrap early, a second line lands on the next name and
 * the text spills out of its card. The screen says where every word, picture
 * and coloured box is; so: every word's place holds ink in the image, nearly
 * all the ink in the image (all but 0.5%) is in a place the screen has
 * something (a word re-wrapped differently leaves ink where the screen has
 * none), and no card has ink in the 4 px around it (the gap between cards is
 * 6 px).
 */
export async function layoutProblems(
  png: Buffer,
  measure: SummaryMeasure,
): Promise<string[]> {
  const problems: string[] = []
  const { ratio } = measure
  const { data, info } = await sharp(png)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const inked = (x: number, y: number) => {
    const at = (y * info.width + x) * 3
    return 255 - Math.min(data[at]!, data[at + 1]!, data[at + 2]!) > 80
  }
  const inside = (box: Box, grow: Box) => ({
    left: Math.max(0, Math.floor((box.x - grow.x) * ratio)),
    top: Math.max(0, Math.floor((box.y - grow.y) * ratio)),
    right: Math.min(
      info.width,
      Math.ceil((box.x + box.width + grow.width) * ratio),
    ),
    bottom: Math.min(
      info.height,
      Math.ceil((box.y + box.height + grow.height) * ratio),
    ),
  })

  // Where the screen has something: a word's box (its glyphs overhang it by a
  // pixel at most), and each picture or coloured box.
  const known = new Uint8Array(info.width * info.height)
  const mark = (box: Box, around: number) => {
    const area = inside(box, {
      x: around,
      y: around,
      width: around,
      height: around,
    })
    for (let y = area.top; y < area.bottom; y += 1) {
      known.fill(1, y * info.width + area.left, y * info.width + area.right)
    }
  }
  for (const word of measure.words) mark(word, 2)
  for (const shape of measure.shapes) mark(shape, 1)

  let stray = 0
  let total = 0
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (!inked(x, y)) continue
      total += 1
      if (!known[y * info.width + x]) stray += 1
    }
  }
  if (stray > total * 0.005) {
    problems.push(
      `${stray} of ${total} inked pixels are where the screen has nothing`,
    )
  }

  for (const word of measure.words) {
    // The glyphs lie inside the word's box, which is taller than its line.
    const area = inside(
      { ...word, y: word.y + 2, height: Math.max(2, word.height - 3.5) },
      { x: 0, y: 0, width: 0, height: 0 },
    )
    let count = 0
    for (let y = area.top; y < area.bottom; y += 1) {
      for (let x = area.left; x < area.right; x += 1) {
        if (inked(x, y)) count += 1
      }
    }
    const pixels = Math.max(
      1,
      (area.right - area.left) * (area.bottom - area.top),
    )
    if (count / pixels < 0.02) {
      problems.push(
        `no ink where the screen has a word at ${Math.round(word.x)},${Math.round(word.y)}`,
      )
    }
  }

  // A band 3 px thick, from 1 px outside each edge (the border's own rounding
  // to device pixels may spill one over), clear of the 6 px gap's far side.
  const near = 1
  const far = 4
  for (const card of measure.cards) {
    const { x, y, width, height } = card
    const around: Box[] = [
      { x: x - far, y: y - far, width: width + 2 * far, height: far - near },
      {
        x: x - far,
        y: y + height + near,
        width: width + 2 * far,
        height: far - near,
      },
      { x: x - far, y, width: far - near, height },
      { x: x + width + near, y, width: far - near, height },
    ]
    for (const strip of around) {
      if ((await inkShare(png, ratio, strip)) > 0) {
        problems.push(`ink outside the card "${card.name}"`)
        break
      }
    }
  }
  return problems
}

/** `image` with the page background painted over `boxes` (CSS px, relative to
 *  the image's top-left): the same parts of two images are then not compared. */
async function paintBackgroundOver(
  image: Buffer,
  boxes: Box[],
  ratio: number,
): Promise<Buffer> {
  const { width, height } = await sharp(image).metadata()
  const overlays = boxes
    .map((box) => ({
      left: Math.round(box.x * ratio),
      top: Math.round(box.y * ratio),
      width: Math.round(box.width * ratio),
      height: Math.round(box.height * ratio),
    }))
    .map((box) => {
      const left = Math.max(0, box.left)
      const top = Math.max(0, box.top)
      return {
        left,
        top,
        width: Math.min(width!, box.left + box.width) - left,
        height: Math.min(height!, box.top + box.height) - top,
      }
    })
    .filter((box) => box.width > 0 && box.height > 0)
  return sharp(image)
    .composite(
      overlays.map(({ left, top, width, height }) => ({
        input: {
          create: { width, height, channels: 3, background: BACKGROUND },
        },
        left,
        top,
      })),
    )
    .toBuffer()
}

/** Hands the page's test hook over, taps `tap`, and returns the PNG the page
 *  made (see `exposeImageToTests` in `src/lib/summaryShare.ts`). */
export async function takeSummaryImage(
  page: Page,
  tap: () => Promise<void>,
): Promise<Buffer> {
  type Hook = { __CVC_TEST__?: { summaryImage?: Blob } }
  await page.evaluate(() => {
    ;(window as unknown as Hook).__CVC_TEST__ = {}
  })
  await tap()
  await page.waitForFunction(
    () => Boolean((window as unknown as Hook).__CVC_TEST__?.summaryImage),
    undefined,
    { timeout: 60_000 },
  )
  const base64 = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(",")[1]!)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(
          (window as unknown as Hook).__CVC_TEST__!.summaryImage!,
        )
      }),
  )
  return Buffer.from(base64, "base64")
}

/** The PNG the "Copia immagine" button of the open summary `view` makes. */
export function copySummaryImage(page: Page, view: Locator): Promise<Buffer> {
  return takeSummaryImage(page, () =>
    view.getByRole("button", { name: COPY_BUTTON_NAME }).click(),
  )
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
  /** What the screen showed before the tap. */
  measure: SummaryMeasure
  /** The root's position in the viewport before the tap. */
  root: Box
}

/**
 * Taps "Copia immagine" on the open summary `view`, takes the PNG and checks
 * it against the screen: width is the content width at the ratio used, height
 * is the content plus 16 px each side, the visible top of it matches a
 * screenshot of the same content with the close button and the floating button
 * covered, the close button's place is empty, no text was laid out again, and
 * the clipboard (in Chromium, which can be read back) holds an image of the
 * same size.
 */
export async function copyAndCheckSummaryImage(
  page: Page,
  view: Locator,
  testInfo: TestInfo,
  options: {
    name: string
    expectedNote?: RegExp | null
    /** The last thing on the summary is its last card (nothing under it but
     *  what is left out of the image), so the image ends 16 px below it. */
    endsWithLastCard?: boolean
  } = { name: "summary" },
): Promise<SummaryImageResult> {
  const root = view.locator(":scope > div").first()
  await view.evaluate((element) => {
    element.scrollTop = 0
  })
  // Everything the image should reproduce is measured before the tap, in the
  // state the person sees.
  const measure = await measureSummary(root)
  const viewport = page.viewportSize()!
  const visibleHeight = Math.min(
    measure.imageHeight,
    viewport.height - measure.imageTop,
  )
  // What the image leaves out (the close button, the floating button and its
  // note, the closing note), with room for their shadows: not compared.
  const excluded = await view.locator("[data-snapshot-exclude]").evaluateAll(
    (items, origin) =>
      items.map((item) => {
        const box = item.getBoundingClientRect()
        return {
          x: box.x - origin.x - 24,
          y: box.y - origin.imageTop - 24,
          width: box.width + 48,
          height: box.height + 48,
        }
      }),
    { x: measure.root.x, imageTop: measure.imageTop },
  )
  const screenshot = await page.screenshot({
    clip: {
      x: measure.root.x,
      y: measure.imageTop,
      width: Math.ceil(measure.root.width),
      height: visibleHeight,
    },
    mask: [view.locator('[data-snapshot-exclude="true"]')],
    maskColor: BACKGROUND_HEX,
  })

  const png = await copySummaryImage(page, view)
  // The note is up for a few seconds only, so it is read before the slow part.
  const expectedNote =
    options.expectedNote === undefined ? COPIED_NOTE : options.expectedNote
  if (expectedNote) {
    await expect(view.getByRole("status")).toHaveText(expectedNote)
  }
  const metadata = await sharp(png).metadata()
  expect(metadata.format).toBe("png")
  saveReviewFile(`${options.name}.png`, png)
  saveReviewFile(`${options.name}-screen.png`, screenshot)

  const cssWidth = Math.ceil(measure.root.width)
  // Width: the content's width at the density used (the screen's, 2× to 3×).
  const ratio = metadata.width! / cssWidth
  expect(ratio, `density ${ratio}`).toBeGreaterThanOrEqual(2 - 0.01)
  expect(ratio, `density ${ratio}`).toBeLessThanOrEqual(3 + 0.01)
  expect(Math.abs(ratio - measure.ratio), `density ${ratio}`).toBeLessThan(0.01)
  // Height: every group, even below the fold, 16 px above and below, and no
  // empty tail (the note at the end of the crew summary is left out).
  const cssHeight = metadata.height! / ratio
  expect(
    Math.abs(cssHeight - measure.imageHeight),
    `height ${cssHeight} vs ${measure.imageHeight}`,
  ).toBeLessThanOrEqual(2)
  if (options.endsWithLastCard && measure.lastCardBottom !== null) {
    expect(
      Math.abs(cssHeight - (measure.lastCardBottom + IMAGE_MARGIN)),
      `the image ends 16 px below the last card: ${cssHeight} vs ${measure.lastCardBottom}`,
    ).toBeLessThanOrEqual(2)
  }
  // The margins are plain background: nothing above the header, nothing under
  // the last card.
  const margins: Box[] = [
    { x: 0, y: 0, width: cssWidth, height: IMAGE_MARGIN - 1 },
    {
      x: 0,
      y: cssHeight - IMAGE_MARGIN + 1,
      width: cssWidth,
      height: IMAGE_MARGIN - 2,
    },
  ]
  for (const margin of margins) {
    expect(
      await inkShare(png, ratio, margin),
      `margin ${JSON.stringify(margin)} is empty`,
    ).toBe(0)
  }

  // It looks like the screen: the same content, buttons aside.
  const shown = await sharp(await paintBackgroundOver(png, excluded, ratio))
    .extract({
      left: 0,
      top: 0,
      width: metadata.width!,
      height: Math.min(metadata.height!, Math.round(visibleHeight * ratio)),
    })
    .toBuffer()
  const difference = await imageDifference(
    shown,
    await paintBackgroundOver(screenshot, excluded, ratio),
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
  if (measure.close) {
    expect(
      await inkShare(png, ratio, measure.close),
      "the close button's place is empty",
    ).toBe(0)
  }
  // No text was laid out a second time.
  expect(await layoutProblems(png, measure)).toEqual([])

  return {
    png,
    ratio,
    cssWidth,
    cssHeight,
    difference,
    screenshot,
    visibleHeight,
    measure,
    root: measure.root,
  }
}

/** The clipboard (read in Chromium; WebKit cannot be read back) holds an image
 *  and it is as large as the image the page made. */
export async function expectClipboardImage(
  page: Page,
  png: Buffer,
): Promise<void> {
  const copied = await page.evaluate(async () => {
    const items = await navigator.clipboard.read()
    const item = items[0]
    if (!item) return null
    const blob = await item.getType("image/png")
    const bitmap = await createImageBitmap(blob)
    return { types: item.types, width: bitmap.width, height: bitmap.height }
  })
  const metadata = await sharp(png).metadata()
  expect(copied).toEqual({
    types: ["image/png"],
    width: metadata.width,
    height: metadata.height,
  })
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
          y: box.y - root.imageTop,
          width: box.width,
          height: box.height,
        }
      }),
    { x: result.root.x, imageTop: result.measure.imageTop },
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
 * At the end of the scroll nothing on the summary is under the floating copy
 * button, at the top the close button is not either, the button keeps its
 * touch size and stays on the screen, and neither the page nor the dialog
 * scrolls sideways. `where` names the viewport in a failure.
 */
export async function expectCopyButtonLayout(
  view: Locator,
  where: string,
  minHeight = 48,
) {
  const copy = view.getByRole("button", { name: COPY_BUTTON_NAME })
  const close = view.getByRole("button", { name: "Chiudi vista lettura" })
  await view.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  const boxes = await view.evaluate((element) => {
    const button = element.querySelector<HTMLElement>(
      "button[aria-label^='Copia immagine']",
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
  expect(boxes.text, detail).toContain("Copia immagine")
  expect(boxes.pageOverflow, detail).toBeLessThanOrEqual(1)
  expect(boxes.dialogOverflow, detail).toBeLessThanOrEqual(1)

  await view.evaluate((element) => {
    element.scrollTop = 0
  })
  const closeBox = (await close.boundingBox())!
  const copyBox = (await copy.boundingBox())!
  expect(
    closeBox.y + closeBox.height <= copyBox.y ||
      copyBox.y + copyBox.height <= closeBox.y,
    `${where}: close ${JSON.stringify(closeBox)} copy ${JSON.stringify(copyBox)}`,
  ).toBe(true)
}

/**
 * The button and its note on the screen, at 390 × 844 and at the 320 px /
 * 200% text stress profile, saved for a person to judge (`CVC_REVIEW_DIR`);
 * at 320 px the note still fits the width. Leaves the page at 320 px / 200%.
 */
export async function captureCopyButtonWithNote(
  page: Page,
  view: Locator,
  prefix: string,
) {
  const copy = view.getByRole("button", { name: COPY_BUTTON_NAME })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = ""
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await copy.click()
  await expect(view.getByRole("status")).toContainText("Immagine copiata")
  saveReviewFile(`${prefix}-button-390x844.png`, await page.screenshot())
  await page.setViewportSize({ width: 320, height: 664 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await copy.click()
  await expect(view.getByRole("status")).toContainText("Immagine copiata")
  saveReviewFile(`${prefix}-button-320-200pct.png`, await page.screenshot())
  const noteBox = (await view.getByRole("status").boundingBox())!
  expect(noteBox.x).toBeGreaterThanOrEqual(0)
  expect(noteBox.x + noteBox.width).toBeLessThanOrEqual(320)
}

/** Every icon on the summary is in the picture: the region it occupies on
 *  screen holds ink. (The close button's and the floating button's are left
 *  out of the image, so they are not looked for.) */
export async function expectIconsInImage(
  view: Locator,
  result: SummaryImageResult,
) {
  const icons = await view.locator("svg").evaluateAll(
    (svgs, origin) =>
      svgs
        .filter((svg) => !svg.closest("[data-snapshot-exclude]"))
        .map((svg) => {
          const box = svg.getBoundingClientRect()
          return {
            x: box.x - origin.x,
            y: box.y - origin.imageTop,
            width: box.width,
            height: box.height,
          }
        }),
    { x: result.root.x, imageTop: result.measure.imageTop },
  )
  expect(icons.length, "the summary shows icons").toBeGreaterThan(0)
  for (const icon of icons) {
    expect(
      await inkShare(result.png, result.ratio, icon),
      `the icon at ${JSON.stringify(icon)} is drawn in the image`,
    ).toBeGreaterThan(0.03)
  }
}
