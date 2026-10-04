/**
 * Renders a live DOM element to a PNG that looks like the screen: a screenshot
 * taken from inside the page. The summaries (crews, Comandate) are laid out by
 * the browser for this very phone, so the image does not lay anything out
 * again; it replays the geometry the screen already has.
 *
 * Why not hand the page to the browser's SVG `<foreignObject>` renderer: the
 * text is then laid out a second time, in a separate image document, where a
 * phone can measure it differently (another font, a text scale). Every frozen
 * box size was then wrong at once: names wrapped early, drew over the next
 * name and ran out of their cards.
 *
 * How, in two steps:
 *  1. `Recorder` reads the element's whole subtree synchronously, in tree
 *     order: each box's rectangle, colours, borders, radii and shadows, each
 *     word's rectangles (a `Range` over the word), each `<img>` and each
 *     inline `<svg>` icon. What it records is plain data.
 *  2. The data is painted on a canvas with the 2D API: boxes and borders,
 *     words at the x and baseline where the screen has them, images, and the
 *     icons (each a standalone SVG with no text in it, which renders the same
 *     everywhere).
 *
 * What the painter supports is what the summaries use: background colours,
 * solid and dashed borders with a differing side, per-corner radii, inset and
 * outer shadows, overflow clipping, text with letter spacing, `text-transform`
 * and tabular numerals, `object-fit` images and SVG icons. Not painted:
 * gradients and background images, text decoration, transforms, filters,
 * `z-index` (items are painted in tree order), pseudo-elements and form
 * controls; the summaries use none.
 */

export type SnapshotOptions = {
  /** Device pixels per CSS pixel; defaults to the screen's own, between 2× and
   *  3× (a phone's gallery wants a crisp image even on a 1× desktop). */
  pixelRatio?: number
  /** Canvas colour under the element's own (transparent) background. */
  background?: string
  /** Elements to leave out of the image. Default: those carrying a
   *  `data-snapshot-exclude` attribute that has a value. */
  exclude?: (element: Element) => boolean
}

export const SNAPSHOT_EXCLUDE_ATTRIBUTE = "data-snapshot-exclude"

const defaultExclude = (element: Element) =>
  Boolean(element.getAttribute(SNAPSHOT_EXCLUDE_ATTRIBUTE))

// iOS Safari refuses, or silently blanks, a canvas past 16,777,216 pixels
// (4096²); a round 16M keeps a margin under it.
export const MAX_CANVAS_PIXELS = 16_000_000

// Decoding an icon is instant; this only stops a browser that never answers
// from holding the whole image up. A missed icon is left out of the picture.
export const IMAGE_LOAD_TIMEOUT_MS = 8000

/** Plain space above the first and below the last thing in the image: the
 *  screen's safe-area inset and the room left for the floating button are
 *  about the phone, not the page. */
const MARGIN = 16

/** A text node whose words measure this much (as a share) off their width on
 *  screen is drawn at a corrected size; below it, the font is taken as is. */
const SIZE_TOLERANCE = 0.03

const SVG_NS = "http://www.w3.org/2000/svg"
const SKIPPED_TAGS = new Set(["script", "style", "noscript", "template"])

/**
 * The density to render at: the requested one (the screen's, by default),
 * held between 2× and 3×, then lowered — below 2× if it must — until the
 * canvas stays within `MAX_CANVAS_PIXELS`. A very long summary makes a tall
 * image; a slightly softer complete one beats a blank or failed one.
 */
export function snapshotPixelRatio(
  width: number,
  height: number,
  requested: number = typeof window === "undefined"
    ? 2
    : window.devicePixelRatio,
): number {
  const wanted = Number.isFinite(requested)
    ? Math.min(3, Math.max(2, requested))
    : 2
  return Math.min(wanted, Math.sqrt(MAX_CANVAS_PIXELS / (width * height)))
}

/**
 * Resolves once every `<img>` under `root` has loaded or failed, or after
 * `timeoutMs`: a snapshot taken before a logo arrives would be missing it.
 */
export async function waitForImages(
  root: HTMLElement,
  timeoutMs = 3000,
): Promise<void> {
  const pending = Array.from(root.querySelectorAll("img")).filter(
    (image) => !image.complete,
  )
  if (pending.length === 0) return
  let timer = 0
  await Promise.race([
    Promise.all(
      pending.map(
        (image) =>
          new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true })
            image.addEventListener("error", () => resolve(), { once: true })
          }),
      ),
    ),
    new Promise<void>((resolve) => {
      timer = window.setTimeout(resolve, timeoutMs)
    }),
  ])
  window.clearTimeout(timer)
}

// ---------------------------------------------------------------------------
// What is recorded
// ---------------------------------------------------------------------------

/** A rectangle in CSS px, relative to the image's top-left corner. */
type Rect = { x: number; y: number; width: number; height: number }
/** Corner radii, top-left first and clockwise: horizontal and vertical. */
type Radii = Array<[number, number]>
/** One border side; a side that paints nothing has width 0. */
type Side = { width: number; color: string; style: string }
type Shadow = {
  inset: boolean
  color: string
  x: number
  y: number
  blur: number
  spread: number
}

type BoxItem = {
  kind: "box"
  alpha: number
  rect: Rect
  radii: Radii
  background: string | null
  /** Top, right, bottom, left; null when no side paints. */
  borders: Side[] | null
  shadows: Shadow[]
}
/** Everything until the matching `end-clip` is cut to this rounded rectangle. */
type ClipItem = { kind: "clip"; rect: Rect; radii: Radii }
type EndClipItem = { kind: "end-clip" }
/** Where the screen has this text: a word's one rectangle (`whole`), or each
 *  of its characters' when it is broken over lines or set in tabular digits. */
type Piece = { text: string; rect: Rect }
type Word = { whole: boolean; pieces: Piece[] }
type TextItem = {
  kind: "text"
  alpha: number
  color: string
  fontStyle: string
  fontWeight: string
  fontSize: number
  fontFamily: string
  textRendering: string
  letterSpacing: number
  tabular: boolean
  words: Word[]
}
type ImageItem = {
  kind: "image"
  alpha: number
  /** The live, already decoded element (same origin, so the canvas stays readable). */
  image: HTMLImageElement
  /** Its content box. */
  rect: Rect
  fit: string
  position: string
}
type IconItem = {
  kind: "icon"
  alpha: number
  rect: Rect
  /** A detached copy with every paint property written inline. */
  svg: SVGSVGElement
}
type Item = BoxItem | ClipItem | EndClipItem | TextItem | ImageItem | IconItem

type Recording = { items: Item[]; width: number; height: number }

const px = (value: string) => {
  const number = Number.parseFloat(value)
  return Number.isFinite(number) ? number : 0
}

const isTransparent = (colour: string) =>
  colour === "" ||
  colour === "transparent" ||
  /[,/]\s*0(?:\.0+)?\s*\)$/u.test(colour)

const CORNERS = [
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
]
const SIDES = ["top", "right", "bottom", "left"]

/** Radii in px; a percentage is of the box. Like the browser, all are scaled
 *  down together when two neighbours would not fit along a side. */
function readRadii(style: CSSStyleDeclaration, rect: Rect): Radii {
  const radii = CORNERS.map((name): [number, number] => {
    const [horizontal = "0", vertical = horizontal] = style
      .getPropertyValue(name)
      .split(" ")
    const resolve = (value: string, whole: number) =>
      value.endsWith("%") ? (px(value) / 100) * whole : px(value)
    return [resolve(horizontal, rect.width), resolve(vertical, rect.height)]
  })
  const fits = (available: number, first: number, second: number) =>
    first + second > available ? available / (first + second) : 1
  const factor = Math.min(
    fits(rect.width, radii[0]![0], radii[1]![0]),
    fits(rect.height, radii[1]![1], radii[2]![1]),
    fits(rect.width, radii[3]![0], radii[2]![0]),
    fits(rect.height, radii[0]![1], radii[3]![1]),
  )
  return radii.map(([h, v]) => [h * factor, v * factor])
}

function readBorders(style: CSSStyleDeclaration): Side[] | null {
  const sides = SIDES.map((side): Side => {
    const borderStyle = style.getPropertyValue(`border-${side}-style`)
    const hidden = borderStyle === "none" || borderStyle === "hidden"
    return {
      width: hidden ? 0 : px(style.getPropertyValue(`border-${side}-width`)),
      color: style.getPropertyValue(`border-${side}-color`),
      style: borderStyle,
    }
  })
  return sides.some((side) => side.width > 0) ? sides : null
}

/** Splits at the commas that are not inside a colour function. */
function splitShadows(value: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (character === "(") depth += 1
    else if (character === ")") depth -= 1
    else if (character === "," && depth === 0) {
      parts.push(value.slice(start, index))
      start = index + 1
    }
  }
  parts.push(value.slice(start))
  return parts
}

function readShadows(style: CSSStyleDeclaration): Shadow[] {
  const value = style.boxShadow
  if (!value || value === "none") return []
  return splitShadows(value).map((part): Shadow => {
    const color = /(?:[a-z-]+)\([^)]*\)|#[0-9a-f]+/iu.exec(part)?.[0]
    const [x = 0, y = 0, blur = 0, spread = 0] = Array.from(
      part
        .replace(/(?:[a-z-]+)\([^)]*\)/giu, "")
        .matchAll(/-?[\d.]+px|\b0\b/gu),
      (match) => px(match[0]),
    )
    return {
      inset: /\binset\b/u.test(part),
      color: color ?? style.color,
      x,
      y,
      blur,
      spread,
    }
  })
}

const ICON_PROPERTIES = [
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-opacity",
  "opacity",
  "display",
  "visibility",
]

/**
 * A detached copy of an inline icon that needs no page: the paint properties
 * the page's CSS gave each element are written inline (as the computed values,
 * so `currentColor` is already a colour), and the classes that only the page's
 * stylesheet understands are dropped. Geometry and `transform` attributes stay.
 */
function cloneIcon(svg: SVGSVGElement): SVGSVGElement {
  const copy = svg.cloneNode(true) as SVGSVGElement
  const sources = [svg, ...Array.from(svg.querySelectorAll("*"))]
  const copies = [copy, ...Array.from(copy.querySelectorAll("*"))]
  sources.forEach((source, index) => {
    const target = copies[index]!
    const computed = getComputedStyle(source)
    let css = index === 0 ? `color:${computed.color};` : ""
    for (const name of ICON_PROPERTIES) {
      const value = computed.getPropertyValue(name)
      if (value) css += `${name}:${value};`
    }
    target.setAttribute("style", css)
    for (const { name } of Array.from(target.attributes)) {
      if (/^(?:class$|role$|aria-|data-)/u.test(name)) {
        target.removeAttribute(name)
      }
    }
  })
  return copy
}

/** Each character with its UTF-16 offset in the word (a letter with its
 *  accents, an emoji with its modifiers, count as one). */
function characters(word: string): Array<{ text: string; index: number }> {
  if (typeof Intl.Segmenter === "function") {
    return Array.from(
      new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(word),
      ({ segment, index }) => ({ text: segment, index }),
    )
  }
  let index = 0
  return Array.from(word, (text) => {
    const entry = { text, index }
    index += text.length
    return entry
  })
}

/** The text as the screen shows it: the DOM keeps what was typed, the
 *  `text-transform` is applied only when drawing. */
function transformText(text: string, transform: string, atWordStart: boolean) {
  if (transform === "uppercase") return text.toUpperCase()
  if (transform === "lowercase") return text.toLowerCase()
  if (transform === "capitalize" && atWordStart) {
    return text.charAt(0).toUpperCase() + text.slice(1)
  }
  return text
}

const visibleRects = (range: Range) =>
  Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0,
  )

/** What the root's box adds up to when the subtree is read: the item list, in
 *  paint order, and how far down it reaches. Every coordinate is read from the
 *  live layout in this one synchronous pass, so scrolling and later changes to
 *  the page do not matter. */
class Recorder {
  private readonly items: Item[] = []
  private readonly width: number
  private readonly originX: number
  private readonly originY: number
  private lowest = MARGIN

  constructor(
    private readonly root: HTMLElement,
    private readonly exclude: (element: Element) => boolean,
  ) {
    const rect = root.getBoundingClientRect()
    const style = getComputedStyle(root)
    this.width = Math.ceil(rect.width)
    this.originX = rect.left
    // The image starts 16px above the root's content, not above its padding.
    this.originY =
      rect.top + px(style.borderTopWidth) + px(style.paddingTop) - MARGIN
  }

  record(): Recording {
    this.visit(this.root, 1)
    return {
      items: this.items,
      width: this.width,
      height: Math.ceil(this.lowest + MARGIN),
    }
  }

  private place(rect: DOMRect): Rect {
    return {
      x: rect.left - this.originX,
      y: rect.top - this.originY,
      width: rect.width,
      height: rect.height,
    }
  }

  /** The image ends below the lowest thing that is painted, so what is left
   *  out (the note at the end, the floating button) leaves no blank space. */
  private reach(rect: Rect) {
    this.lowest = Math.max(this.lowest, rect.y + rect.height)
  }

  private visit(element: Element, parentAlpha: number) {
    if (SKIPPED_TAGS.has(element.localName) || this.exclude(element)) return
    const style = getComputedStyle(element)
    if (style.display === "none") return
    const opacity = Number.parseFloat(style.opacity)
    const alpha = parentAlpha * (Number.isFinite(opacity) ? opacity : 1)
    // `visibility: hidden` paints nothing, but a child may be visible again.
    const visible = style.visibility === "visible"
    const rect = this.place(element.getBoundingClientRect())
    // `display: contents` has no box of its own, only children.
    const hasBox =
      style.display !== "contents" && rect.width > 0 && rect.height > 0

    if (element.namespaceURI === SVG_NS && element.localName === "svg") {
      if (visible && hasBox) {
        this.items.push({
          kind: "icon",
          alpha,
          rect,
          svg: cloneIcon(element as SVGSVGElement),
        })
        this.reach(rect)
      }
      return
    }

    const radii = hasBox ? readRadii(style, rect) : []
    if (visible && hasBox) this.recordBox(rect, radii, style, alpha)

    const image =
      element.localName === "img" ? (element as HTMLImageElement) : null
    const clip =
      hasBox &&
      (image
        ? radii.some(([h, v]) => h > 0 && v > 0)
        : style.overflowX !== "visible" || style.overflowY !== "visible")
    if (clip) {
      this.items.push({
        kind: "clip",
        ...paddingBox(rect, radii, readBorders(style)),
      })
    }
    if (image) {
      if (visible && hasBox) this.recordImage(image, rect, style, alpha)
    } else {
      for (let child = element.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === Node.TEXT_NODE) {
          this.recordText(child as Text, style, alpha)
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          this.visit(child as Element, alpha)
        }
      }
    }
    if (clip) this.items.push({ kind: "end-clip" })
  }

  private recordBox(
    rect: Rect,
    radii: Radii,
    style: CSSStyleDeclaration,
    alpha: number,
  ) {
    const background = isTransparent(style.backgroundColor)
      ? null
      : style.backgroundColor
    const borders = readBorders(style)
    const shadows = readShadows(style)
    if (!background && !borders && shadows.length === 0) return
    this.items.push({
      kind: "box",
      alpha,
      rect,
      radii,
      background,
      borders,
      shadows,
    })
    if (background || borders) this.reach(rect)
  }

  private recordImage(
    image: HTMLImageElement,
    rect: Rect,
    style: CSSStyleDeclaration,
    alpha: number,
  ) {
    // One that has not loaded (or failed) is an empty slot, as on screen.
    if (!image.complete || image.naturalWidth === 0) return
    const [top, right, bottom, left] = SIDES.map(
      (side) =>
        px(style.getPropertyValue(`border-${side}-width`)) +
        px(style.getPropertyValue(`padding-${side}`)),
    ) as [number, number, number, number]
    this.items.push({
      kind: "image",
      alpha,
      image,
      rect: {
        x: rect.x + left,
        y: rect.y + top,
        width: rect.width - left - right,
        height: rect.height - top - bottom,
      },
      fit: style.objectFit,
      position: style.objectPosition,
    })
    this.reach(rect)
  }

  /** Where the screen has each word of the text node, asked of the browser:
   *  a `Range` over the word gives one rectangle per line it sits on. */
  private recordText(node: Text, style: CSSStyleDeclaration, alpha: number) {
    if (style.visibility !== "visible" || !/\S/u.test(node.data)) return
    const tabular = style.fontVariantNumeric.includes("tabular-nums")
    const transform = style.textTransform
    const range = node.ownerDocument.createRange()
    const words: Word[] = []

    for (const match of node.data.matchAll(/\S+/gu)) {
      const word = match[0]
      const start = match.index
      range.setStart(node, start)
      range.setEnd(node, start + word.length)
      const rects = visibleRects(range)
      if (rects.length === 0) continue
      if (rects.length === 1 && !tabular) {
        words.push({
          whole: true,
          pieces: [
            {
              text: transformText(word, transform, true),
              rect: this.place(rects[0]!),
            },
          ],
        })
        continue
      }
      // Broken over two lines, or digits that each own a column: draw each
      // character where the screen has it, never re-wrapping anything.
      const pieces: Piece[] = []
      for (const { text, index } of characters(word)) {
        range.setStart(node, start + index)
        range.setEnd(node, start + index + text.length)
        const [rect] = visibleRects(range)
        if (!rect) continue
        pieces.push({
          text: transformText(text, transform, index === 0),
          rect: this.place(rect),
        })
      }
      if (pieces.length > 0) words.push({ whole: false, pieces })
    }
    if (words.length === 0) return

    for (const word of words) {
      for (const piece of word.pieces) this.reach(piece.rect)
    }
    this.items.push({
      kind: "text",
      alpha,
      color: style.color,
      fontStyle: style.fontStyle,
      fontWeight: style.fontWeight,
      fontSize: px(style.fontSize),
      fontFamily: style.fontFamily,
      textRendering: style.textRendering,
      letterSpacing: px(style.letterSpacing),
      tabular,
      words,
    })
  }
}

// ---------------------------------------------------------------------------
// Painting
// ---------------------------------------------------------------------------

/** The padding box (inside the border) and its radii, the area overflow clips
 *  to and the inset shadow lies in. */
function paddingBox(
  rect: Rect,
  radii: Radii,
  borders: Side[] | null,
): { rect: Rect; radii: Radii } {
  if (!borders) return { rect, radii }
  const [top, right, bottom, left] = borders.map((side) => side.width) as [
    number,
    number,
    number,
    number,
  ]
  return {
    rect: {
      x: rect.x + left,
      y: rect.y + top,
      width: rect.width - left - right,
      height: rect.height - top - bottom,
    },
    radii: radii.map(([h, v], corner) => {
      // Top-left, top-right, bottom-right, bottom-left.
      const horizontal = corner === 0 || corner === 3 ? left : right
      const vertical = corner < 2 ? top : bottom
      return [Math.max(0, h - horizontal), Math.max(0, v - vertical)]
    }),
  }
}

/** Adds a rounded rectangle, with an elliptical arc per corner, to the path. */
function addRoundedRect(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  radii: Radii,
) {
  const { x, y, width, height } = rect
  const [tl, tr, br, bl] = radii as [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ]
  const corner = (
    cx: number,
    cy: number,
    [rx, ry]: [number, number],
    from: number,
  ) => {
    if (rx > 0 && ry > 0) {
      ctx.ellipse(cx, cy, rx, ry, 0, from, from + Math.PI / 2)
    }
  }
  ctx.moveTo(x + tl[0], y)
  ctx.lineTo(x + width - tr[0], y)
  corner(x + width - tr[0], y + tr[1], tr, -Math.PI / 2)
  ctx.lineTo(x + width, y + height - br[1])
  corner(x + width - br[0], y + height - br[1], br, 0)
  ctx.lineTo(x + bl[0], y + height)
  corner(x + bl[0], y + height - bl[1], bl, Math.PI / 2)
  ctx.lineTo(x, y + tl[1])
  corner(x + tl[0], y + tl[1], tl, Math.PI)
  ctx.closePath()
}

const NO_RADII: Radii = [
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
]
const withRadii = (radii: Radii) => (radii.length === 4 ? radii : NO_RADII)

/** Grows (or, with a negative amount, shrinks) a rounded rectangle. */
function grow(rect: Rect, radii: Radii, amount: number) {
  return {
    rect: {
      x: rect.x - amount,
      y: rect.y - amount,
      width: rect.width + 2 * amount,
      height: rect.height + 2 * amount,
    },
    radii: withRadii(radii).map(([h, v]): [number, number] => [
      h > 0 ? Math.max(0, h + amount) : 0,
      v > 0 ? Math.max(0, v + amount) : 0,
    ]),
  }
}

/** Canvas shadows are in device pixels, whatever the scale in force. */
const deviceScale = (ctx: CanvasRenderingContext2D) => ctx.getTransform().a

function paintOuterShadow(
  ctx: CanvasRenderingContext2D,
  item: BoxItem,
  shadow: Shadow,
) {
  // A canvas shadow is only cast by something drawn; the shape is drawn far to
  // the left, off the canvas, and its shadow brought back.
  const far = 100_000
  const { rect, radii } = grow(item.rect, item.radii, shadow.spread)
  const scale = deviceScale(ctx)
  ctx.save()
  ctx.shadowColor = shadow.color
  ctx.shadowBlur = shadow.blur * scale
  ctx.shadowOffsetX = (shadow.x + far) * scale
  ctx.shadowOffsetY = shadow.y * scale
  ctx.fillStyle = "#000"
  ctx.beginPath()
  addRoundedRect(ctx, { ...rect, x: rect.x - far }, radii)
  ctx.fill()
  ctx.restore()
}

function paintInsetShadow(
  ctx: CanvasRenderingContext2D,
  item: BoxItem,
  shadow: Shadow,
) {
  const inside = paddingBox(item.rect, withRadii(item.radii), item.borders)
  const hole = grow(
    {
      ...inside.rect,
      x: inside.rect.x + shadow.x,
      y: inside.rect.y + shadow.y,
    },
    inside.radii,
    -shadow.spread,
  )
  // The shadow is the frame between a rectangle larger than the box and the
  // hole the spread and offset leave, cut to the box.
  const frame = grow(
    inside.rect,
    NO_RADII,
    shadow.blur * 2 +
      Math.abs(shadow.x) +
      Math.abs(shadow.y) +
      shadow.spread +
      2,
  ).rect
  ctx.save()
  ctx.beginPath()
  addRoundedRect(ctx, inside.rect, inside.radii)
  ctx.clip()
  ctx.beginPath()
  ctx.rect(frame.x, frame.y, frame.width, frame.height)
  if (hole.rect.width > 0 && hole.rect.height > 0) {
    addRoundedRect(ctx, hole.rect, hole.radii)
  }
  ctx.fillStyle = shadow.color
  if (shadow.blur > 0) {
    ctx.shadowColor = shadow.color
    ctx.shadowBlur = shadow.blur * deviceScale(ctx)
  }
  ctx.fill("evenodd")
  ctx.restore()
}

/** The four border sides, between the box's outer edge and its padding box. */
function paintBorders(ctx: CanvasRenderingContext2D, item: BoxItem) {
  const borders = item.borders!
  const [top, right, bottom, left] = borders as [Side, Side, Side, Side]
  const radii = withRadii(item.radii)
  const { rect } = item
  const inside = paddingBox(rect, radii, borders)
  const ring = () => {
    ctx.beginPath()
    addRoundedRect(ctx, rect, radii)
    if (inside.rect.width > 0 && inside.rect.height > 0) {
      addRoundedRect(ctx, inside.rect, inside.radii)
    }
  }

  const first = borders.find((side) => side.width > 0)!
  const alike = borders.every(
    (side) =>
      side.width === first.width &&
      side.color === first.color &&
      side.style === first.style,
  )
  ctx.save()
  if (alike && (first.style === "dashed" || first.style === "dotted")) {
    // Dashes run along the middle of the border, round the corners.
    const middle = grow(rect, radii, -first.width / 2)
    ctx.beginPath()
    addRoundedRect(ctx, middle.rect, middle.radii)
    ctx.lineWidth = first.width
    ctx.strokeStyle = first.color
    const dash = first.style === "dotted" ? 1 : first.width >= 3 ? 2 : 3
    const gap = first.style === "dotted" ? 1 : first.width >= 3 ? 1 : 2
    ctx.setLineDash([dash * first.width, gap * first.width])
    ctx.stroke()
  } else if (alike) {
    ring()
    ctx.fillStyle = first.color
    ctx.fill("evenodd")
  } else {
    // A side of its own colour or width (a coloured edge): each side is a
    // trapezoid mitred to its neighbours, cut to the ring so the rounded
    // corners stay right.
    ring()
    ctx.clip("evenodd")
    const { x, y, width, height } = rect
    const lW = left.width
    const rW = right.width
    const tW = top.width
    const bW = bottom.width
    const bands: Array<[Side, Array<[number, number]>]> = [
      [
        top,
        [
          [x, y],
          [x + width, y],
          [x + width - rW, y + tW],
          [x + lW, y + tW],
        ],
      ],
      [
        right,
        [
          [x + width, y],
          [x + width, y + height],
          [x + width - rW, y + height - bW],
          [x + width - rW, y + tW],
        ],
      ],
      [
        bottom,
        [
          [x + width, y + height],
          [x, y + height],
          [x + lW, y + height - bW],
          [x + width - rW, y + height - bW],
        ],
      ],
      [
        left,
        [
          [x, y + height],
          [x, y],
          [x + lW, y + tW],
          [x + lW, y + height - bW],
        ],
      ],
    ]
    for (const [side, points] of bands) {
      if (side.width <= 0) continue
      ctx.fillStyle = side.color
      ctx.beginPath()
      points.forEach(([px, py], index) =>
        index === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py),
      )
      ctx.closePath()
      ctx.fill()
    }
  }
  ctx.restore()
}

function paintBox(ctx: CanvasRenderingContext2D, item: BoxItem) {
  const radii = withRadii(item.radii)
  ctx.save()
  ctx.globalAlpha = item.alpha
  for (const shadow of item.shadows) {
    if (!shadow.inset) paintOuterShadow(ctx, item, shadow)
  }
  if (item.background) {
    ctx.fillStyle = item.background
    ctx.beginPath()
    addRoundedRect(ctx, item.rect, radii)
    ctx.fill()
  }
  for (const shadow of item.shadows) {
    if (shadow.inset) paintInsetShadow(ctx, item, shadow)
  }
  if (item.borders) paintBorders(ctx, item)
  ctx.restore()
}

/** Sets the canvas font; one the canvas rejects keeps the last one, so the
 *  shorthand is checked and, if refused, replaced by a plain one. */
function setFont(ctx: CanvasRenderingContext2D, item: TextItem, size: number) {
  const style = item.fontStyle.startsWith("oblique") ? "italic" : item.fontStyle
  ctx.font = "10px sans-serif"
  const unchanged = ctx.font
  ctx.font = `${style} ${item.fontWeight} ${size}px ${item.fontFamily}`
  if (ctx.font === unchanged) {
    ctx.font = `${style} ${item.fontWeight} ${size}px sans-serif`
  }
  const rendering = item.textRendering.toLowerCase()
  if ("textRendering" in ctx) {
    ctx.textRendering =
      rendering === "optimizelegibility"
        ? "optimizeLegibility"
        : rendering === "geometricprecision"
          ? "geometricPrecision"
          : rendering === "optimizespeed"
            ? "optimizeSpeed"
            : "auto"
  }
}

/** Letter spacing the canvas can apply itself (most can); otherwise it is
 *  added by hand, character by character. */
function setLetterSpacing(ctx: CanvasRenderingContext2D, spacing: number) {
  if (!("letterSpacing" in ctx)) return false
  ctx.letterSpacing = `${spacing}px`
  return true
}

function textWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  spacing: number,
  native: boolean,
) {
  const width = ctx.measureText(text).width
  return native ? width : width + spacing * Array.from(text).length
}

/** The font's ascent and descent, in the size in force. */
function fontExtent(ctx: CanvasRenderingContext2D, size: number) {
  const metrics = ctx.measureText("Hg")
  return {
    ascent:
      typeof metrics.fontBoundingBoxAscent === "number"
        ? metrics.fontBoundingBoxAscent
        : size * 0.8,
    descent:
      typeof metrics.fontBoundingBoxDescent === "number"
        ? metrics.fontBoundingBoxDescent
        : size * 0.2,
  }
}

/**
 * How much to scale the font size by so that a canvas word is as wide as the
 * same word on screen. This is what absorbs a phone whose canvas resolves the
 * font differently from its page, or scales its text: the screen's word widths
 * are the truth, whatever the computed font size says. 1 unless the words are
 * off by more than `SIZE_TOLERANCE`; a text with no whole word to measure
 * (digits, a word broken over lines) is judged by its height instead.
 */
function calibratedScale(ctx: CanvasRenderingContext2D, item: TextItem) {
  setFont(ctx, item, item.fontSize)
  const native = setLetterSpacing(ctx, item.letterSpacing)
  let onScreen = 0
  let measured = 0
  if (!item.tabular) {
    for (const word of item.words) {
      if (!word.whole) continue
      const piece = word.pieces[0]!
      onScreen += piece.rect.width
      measured += textWidth(ctx, piece.text, item.letterSpacing, native)
    }
  }
  const clamp = (scale: number) => Math.min(2, Math.max(0.5, scale))
  if (measured > 0 && onScreen > 0) {
    const scale = onScreen / measured
    return Math.abs(scale - 1) > SIZE_TOLERANCE ? clamp(scale) : 1
  }
  const { ascent, descent } = fontExtent(ctx, item.fontSize)
  const rectHeight = item.words[0]?.pieces[0]?.rect.height ?? 0
  const scale = rectHeight / (ascent + descent)
  // A line box's height is rounded, so this is judged more loosely.
  return rectHeight > 0 && Math.abs(scale - 1) > 0.1 ? clamp(scale) : 1
}

function paintText(ctx: CanvasRenderingContext2D, item: TextItem) {
  ctx.save()
  ctx.globalAlpha = item.alpha
  ctx.fillStyle = item.color
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  const scale = calibratedScale(ctx, item)
  const size = item.fontSize * scale
  const spacing = item.letterSpacing * scale
  setFont(ctx, item, size)
  const native = setLetterSpacing(ctx, spacing)
  const { ascent, descent } = fontExtent(ctx, size)

  for (const word of item.words) {
    for (const piece of word.pieces) {
      const { rect, text } = piece
      // The baseline sits where the font's ascent and descent divide the
      // line's box on screen.
      const baseline = rect.y + (rect.height * ascent) / (ascent + descent)
      let x = rect.x
      if (item.tabular) {
        // Digits that share a width are centred in their column.
        x += (rect.width - textWidth(ctx, text, spacing, native)) / 2
      }
      if (native || spacing === 0) {
        ctx.fillText(text, x, baseline)
      } else {
        for (const character of text) {
          ctx.fillText(character, x, baseline)
          x += textWidth(ctx, character, spacing, false)
        }
      }
    }
  }
  ctx.restore()
}

/** `object-position` as a pair of lengths or percentages of the free space. */
function positionOffsets(
  position: string,
  freeWidth: number,
  freeHeight: number,
): [number, number] {
  const [horizontal = "50%", vertical = "50%"] = position.split(" ")
  const resolve = (value: string, free: number) =>
    value.endsWith("%") ? (px(value) / 100) * free : px(value)
  return [resolve(horizontal, freeWidth), resolve(vertical, freeHeight)]
}

function paintImage(ctx: CanvasRenderingContext2D, item: ImageItem) {
  const { image, rect } = item
  const naturalWidth = image.naturalWidth
  const naturalHeight = image.naturalHeight
  const contain = Math.min(
    rect.width / naturalWidth,
    rect.height / naturalHeight,
  )
  const cover = Math.max(rect.width / naturalWidth, rect.height / naturalHeight)
  let scaleX = rect.width / naturalWidth
  let scaleY = rect.height / naturalHeight
  if (item.fit === "contain") scaleX = scaleY = contain
  else if (item.fit === "cover") scaleX = scaleY = cover
  else if (item.fit === "none") scaleX = scaleY = 1
  else if (item.fit === "scale-down") scaleX = scaleY = Math.min(1, contain)
  const width = naturalWidth * scaleX
  const height = naturalHeight * scaleY
  const [offsetX, offsetY] = positionOffsets(
    item.position,
    rect.width - width,
    rect.height - height,
  )
  ctx.save()
  ctx.globalAlpha = item.alpha
  ctx.beginPath()
  ctx.rect(rect.x, rect.y, rect.width, rect.height)
  ctx.clip()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(image, rect.x + offsetX, rect.y + offsetY, width, height)
  ctx.restore()
}

/** Loads `url` into an `Image` and decodes it, or rejects after `timeoutMs`. */
function loadImage(url: string, timeoutMs: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const fail = () => reject(new Error("Impossibile preparare l’immagine."))
    const timer = window.setTimeout(() => {
      image.onload = null
      image.onerror = null
      fail()
    }, timeoutMs)
    image.onload = () => {
      window.clearTimeout(timer)
      // `decode()` makes sure the first draw has pixels to paint; it is a
      // refinement, so a browser that rejects it still gets the loaded image.
      const decoded = image.decode?.() ?? Promise.resolve()
      decoded.catch(() => undefined).then(() => resolve(image))
    }
    image.onerror = () => {
      window.clearTimeout(timer)
      fail()
    }
    image.src = url
  })
}

/** Each icon as a standalone SVG image, sized to the pixels it is drawn in
 *  (so any browser rasterises it crisply). One that will not load is left out. */
async function loadIcons(
  items: Item[],
  ratio: number,
): Promise<Map<IconItem, HTMLImageElement>> {
  const icons = new Map<IconItem, HTMLImageElement>()
  await Promise.all(
    items.map(async (item) => {
      if (item.kind !== "icon") return
      const svg = item.svg
      svg.setAttribute("width", String(item.rect.width * ratio))
      svg.setAttribute("height", String(item.rect.height * ratio))
      let markup = new XMLSerializer().serializeToString(svg)
      if (!markup.includes(`xmlns="${SVG_NS}"`)) {
        markup = markup.replace("<svg", `<svg xmlns="${SVG_NS}"`)
      }
      try {
        icons.set(
          item,
          await loadImage(
            `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`,
            IMAGE_LOAD_TIMEOUT_MS,
          ),
        )
      } catch {
        // An icon is decoration: the picture is complete without it.
      }
    }),
  )
  return icons
}

function paint(
  ctx: CanvasRenderingContext2D,
  recording: Recording,
  icons: Map<IconItem, HTMLImageElement>,
  ratio: number,
  background: string,
) {
  ctx.fillStyle = background
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.scale(ratio, ratio)
  for (const item of recording.items) {
    switch (item.kind) {
      case "box":
        paintBox(ctx, item)
        break
      case "clip":
        ctx.save()
        ctx.beginPath()
        addRoundedRect(ctx, item.rect, withRadii(item.radii))
        ctx.clip()
        break
      case "end-clip":
        ctx.restore()
        break
      case "text":
        paintText(ctx, item)
        break
      case "image":
        paintImage(ctx, item)
        break
      case "icon": {
        const icon = icons.get(item)
        if (!icon) break
        ctx.save()
        ctx.globalAlpha = item.alpha
        ctx.drawImage(
          icon,
          item.rect.x,
          item.rect.y,
          item.rect.width,
          item.rect.height,
        )
        ctx.restore()
        break
      }
    }
  }
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("Impossibile creare l’immagine PNG."))
    }, "image/png")
  })
}

/**
 * Renders `element` — its full height, not only the part on screen — to a PNG
 * at the screen's pixel density. The page is read synchronously and left as
 * it was; everything after that (icons, painting) works on what was recorded.
 * The image is the element's width, runs from 16px above its content to 16px
 * below the lowest thing painted, and shows nothing marked for exclusion.
 */
export async function renderElementToPng(
  element: HTMLElement,
  options: SnapshotOptions = {},
): Promise<Blob> {
  const recording = new Recorder(
    element,
    options.exclude ?? defaultExclude,
  ).record()
  const { width, height } = recording
  if (recording.items.length === 0 || width < 1 || height < 1) {
    throw new Error("Niente da trasformare in immagine.")
  }

  const ratio = snapshotPixelRatio(width, height, options.pixelRatio)
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(width * ratio))
  canvas.height = Math.max(1, Math.round(height * ratio))
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Il browser non supporta i PNG.")

  const icons = await loadIcons(recording.items, ratio)
  paint(ctx, recording, icons, ratio, options.background ?? "#ffffff")

  const png = await canvasToPng(canvas)
  if (png.type && png.type !== "image/png") {
    throw new Error("Il browser ha restituito un formato immagine inatteso.")
  }
  return png.type ? png : new Blob([png], { type: "image/png" })
}
