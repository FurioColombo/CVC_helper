/**
 * Renders a live DOM element to a PNG the way the screen shows it — a
 * screenshot taken from inside the page. The summaries (crews, Comandate) used
 * to be redrawn by hand on a canvas and never looked like the page; this hands
 * the page itself to the browser's own renderer instead, so Tailwind's
 * colours, the grid, fonts and icons come out exactly as on screen.
 *
 * How: the element is cloned with every computed style written inline (an SVG
 * `<foreignObject>` has no access to the page's stylesheets), wrapped in an
 * SVG, loaded as an image and drawn on a canvas at the phone's pixel density.
 * Pseudo-elements (`::before`, `::after`) are not copied; the summaries use
 * none.
 */

export type SnapshotOptions = {
  /** Device pixels per CSS pixel; defaults to the screen's own, between 2× and
   *  3× (a phone's gallery wants a crisp image even on a 1× desktop). */
  pixelRatio?: number
  /** Canvas colour under the element's own (transparent) background. */
  background?: string
  /** Inline overrides for the root only, in the image and for measuring: the
   *  screen's safe-area and button padding, which the image does not want. */
  rootStyle?: Record<string, string>
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

// An image the service worker has not cached, on a poor signal, can sit
// unanswered for far longer than anyone will wait. Past this it is dropped
// from the picture (an empty logo) rather than failing the whole image.
export const IMAGE_LOAD_TIMEOUT_MS = 8000

const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA="

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

/** Text and attribute values go through an XML serializer, which would make
 *  an unloadable image of a name holding a control character. */
export function cleanText(value: unknown): string {
  const source = String(value ?? "")
  let result = ""

  for (const character of source) {
    const codePoint = character.codePointAt(0) ?? 0
    const validXmlCharacter =
      codePoint === 0x9 ||
      codePoint === 0xa ||
      codePoint === 0xd ||
      (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint >= 0x10000 && codePoint <= 0x10ffff)
    result += validXmlCharacter ? character : "�"
  }

  return result
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms))

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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** An `<img>`'s picture as a data URL: its own bytes when the browser can
 *  fetch them (offline too: `force-cache` and the service worker both answer),
 *  else the already-decoded pixels. */
async function imageDataUrl(
  image: HTMLImageElement,
  timeoutMs: number,
): Promise<string> {
  const src = image.currentSrc || image.src
  if (src.startsWith("data:")) return src
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(src, {
      cache: "force-cache",
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const blob = await response.blob()
    if (blob.type && !blob.type.startsWith("image/")) {
      throw new Error("Not an image")
    }
    return await blobToDataUrl(blob)
  } catch (error) {
    if (!image.complete || image.naturalWidth === 0) throw error
    const canvas = document.createElement("canvas")
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    canvas.getContext("2d")?.drawImage(image, 0, 0)
    return canvas.toDataURL("image/png")
  } finally {
    window.clearTimeout(timer)
  }
}

// A tag's style with no author CSS at all, to tell what the page changed.
// The sandbox is a hidden same-origin frame: the browser's own defaults, not
// an approximation (a `<div>` is block, a `<ul>` indented, text is black).
type DefaultStyles = Map<string, string>
type Sandbox = {
  frame: HTMLIFrameElement
  document: Document
  svg: Element
  cache: Map<string, DefaultStyles>
}
let sandboxPromise: Promise<Sandbox> | null = null

async function getSandbox(): Promise<Sandbox> {
  // A frame taken out of the page (a test clearing the body) no longer
  // computes styles; make another.
  if (sandboxPromise && !(await sandboxPromise).frame.isConnected) {
    sandboxPromise = null
  }
  sandboxPromise ??= new Promise<Sandbox>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("Sandbox unavailable")),
      IMAGE_LOAD_TIMEOUT_MS,
    )
    const frame = document.createElement("iframe")
    frame.setAttribute("aria-hidden", "true")
    frame.tabIndex = -1
    frame.style.cssText =
      "position:fixed;left:-10000px;top:0;width:100px;height:100px;border:0;visibility:hidden;pointer-events:none"
    frame.srcdoc = "<!doctype html><html><body></body></html>"
    frame.onload = () => {
      window.clearTimeout(timer)
      const frameDocument = frame.contentDocument
      if (!frameDocument) return reject(new Error("Sandbox unavailable"))
      const svg = frameDocument.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      )
      frameDocument.body.append(svg)
      resolve({ frame, document: frameDocument, svg, cache: new Map() })
    }
    frame.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error("Sandbox unavailable"))
    }
    document.body.append(frame)
  }).catch((error) => {
    sandboxPromise = null
    throw error
  })
  return sandboxPromise
}

function defaultStylesFor(sandbox: Sandbox, element: Element): DefaultStyles {
  const key = `${element.namespaceURI}|${element.localName}`
  let styles = sandbox.cache.get(key)
  if (styles) return styles
  const pristine = sandbox.document.createElementNS(
    element.namespaceURI,
    element.localName,
  )
  const inSvg = element.namespaceURI === "http://www.w3.org/2000/svg"
  ;(inSvg ? sandbox.svg : sandbox.document.body).append(pristine)
  const computed = sandbox.document.defaultView!.getComputedStyle(pristine)
  styles = new Map()
  for (let index = 0; index < computed.length; index += 1) {
    const name = computed[index]!
    styles.set(name, computed.getPropertyValue(name))
  }
  pristine.remove()
  sandbox.cache.set(key, styles)
  return styles
}

// What never changes a still picture, or only restates another property: the
// logical twins (`margin-inline-start` of `margin-left`, `inline-size` of
// `width`) keep the output a third smaller, with the physical ones written.
const SKIPPED_PROPERTY =
  /^(?:transition|animation|scroll|overscroll|cursor$|pointer-events$|user-select$|touch-action$|will-change$|resize$|interactivity$|-webkit-(?:tap-highlight|user|locale))|(?:^|-)(?:inline|block)(?:-|$)/u

// Written whatever the sandbox says, because their computed value depends on
// other properties and so is no evidence of what the element asked for. A
// size the sandbox happens to share with an element is not "the default": an
// element laid out `auto` there would not take the same width here. A border
// width computes to 0 under `border-style: none`, but the same 0 left out
// would come back as the initial `medium` once the style is `solid`.
const ALWAYS_WRITTEN_PROPERTY =
  /^(?:width|height|(?:border-(?:top|right|bottom|left)|outline|column-rule)-width)$/u

const NOT_COPIED_ELEMENTS = new Set(["script", "style", "noscript", "template"])

function camelToKebab(name: string) {
  return name.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)
}

/** Sets inline overrides and returns the function that puts back what was
 *  there; the page is changed only while it is measured and read, in one
 *  synchronous stretch, so nothing is painted in between. */
function applyTemporaryStyle(
  element: HTMLElement,
  style: Record<string, string> | undefined,
): () => void {
  if (!style) return () => undefined
  const previous = element.getAttribute("style")
  for (const [name, value] of Object.entries(style)) {
    element.style.setProperty(camelToKebab(name), value)
  }
  return () => {
    if (previous === null) element.removeAttribute("style")
    else element.setAttribute("style", previous)
  }
}

type CloneContext = {
  sandbox: Sandbox
  exclude: (element: Element) => boolean
  images: Array<{ source: HTMLImageElement; clone: HTMLImageElement }>
}

/** The attributes worth keeping: SVG geometry (`d`, `viewBox`, ...) and an
 *  image's `src`. Classes mean nothing without the page's stylesheets, and
 *  accessible names carry people's names the picture does not need. */
function pruneAttributes(clone: Element) {
  const isSvg = clone.namespaceURI === "http://www.w3.org/2000/svg"
  for (const { name, value } of Array.from(clone.attributes)) {
    const keep = isSvg
      ? !/^(?:xmlns$|class$|style$|role$|aria-|data-)/u.test(name)
      : name === "src"
    if (!keep) clone.removeAttribute(name)
    else clone.setAttribute(name, cleanText(value))
  }
}

function cloneTree(source: Element, context: CloneContext): Element | null {
  const computed = getComputedStyle(source)
  if (computed.display === "none") return null
  const clone = source.cloneNode(false) as Element
  pruneAttributes(clone)

  const defaults = defaultStylesFor(context.sandbox, source)
  let css = ""
  for (let index = 0; index < computed.length; index += 1) {
    const name = computed[index]!
    if (SKIPPED_PROPERTY.test(name)) continue
    const value = computed.getPropertyValue(name)
    if (ALWAYS_WRITTEN_PROPERTY.test(name) || defaults.get(name) !== value) {
      css += `${name}:${value};`
    }
  }
  clone.setAttribute("style", cleanText(css))

  if (source instanceof HTMLImageElement) {
    clone.removeAttribute("srcset")
    context.images.push({ source, clone: clone as HTMLImageElement })
    return clone
  }
  for (const child of Array.from(source.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      clone.append(document.createTextNode(cleanText(child.textContent)))
    } else if (
      child instanceof Element &&
      !NOT_COPIED_ELEMENTS.has(child.localName) &&
      !context.exclude(child)
    ) {
      const childClone = cloneTree(child, context)
      if (childClone) clone.append(childClone)
    }
  }
  return clone
}

async function embedImages(context: CloneContext, timeoutMs: number) {
  await Promise.all(
    context.images.map(async ({ source, clone }) => {
      try {
        const dataUrl = await imageDataUrl(source, timeoutMs)
        await loadImage(dataUrl, timeoutMs)
        clone.setAttribute("src", dataUrl)
      } catch {
        // The slot keeps its size (its dimensions are inline); only the
        // picture is missing.
        clone.setAttribute("src", TRANSPARENT_PIXEL)
      }
    }),
  )
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("Impossibile creare l’immagine PNG."))
    }, "image/png")
  })
}

// WebKit (every iPhone browser) can paint a foreignObject's images blank on
// the first draw of a freshly loaded SVG; a second draw a moment later shows
// them. Other engines get it right the first time and are drawn once.
function needsSecondDraw() {
  const agent = navigator.userAgent
  return (
    /AppleWebKit/u.test(agent) &&
    !/(?:Chrome|Chromium|Edg|OPR|Android)\//u.test(agent)
  )
}

/**
 * Renders `element` — its full height, not only the part on screen — to a PNG
 * at the screen's pixel density. The page is read synchronously and left as
 * it was; everything after that (images, rendering) works on the copy.
 */
export async function renderElementToPng(
  element: HTMLElement,
  options: SnapshotOptions = {},
): Promise<Blob> {
  const sandbox = await getSandbox()
  const context: CloneContext = {
    sandbox,
    exclude: options.exclude ?? defaultExclude,
    images: [],
  }

  // Measured and copied with the image's own padding in force, so the
  // styles and the size agree. Restored before anything else can paint.
  const restore = applyTemporaryStyle(element, options.rootStyle)
  let root: Element | null
  let width: number
  let height: number
  try {
    const rect = element.getBoundingClientRect()
    width = Math.ceil(rect.width)
    height = Math.ceil(Math.max(rect.height, element.scrollHeight))
    root = cloneTree(element, context)
  } finally {
    restore()
  }
  if (!root || width < 1 || height < 1) {
    throw new Error("Niente da trasformare in immagine.")
  }
  for (const [name, value] of Object.entries(options.rootStyle ?? {})) {
    ;(root as HTMLElement).style.setProperty(camelToKebab(name), value)
  }
  ;(root as HTMLElement).style.setProperty("width", `${width}px`)

  await embedImages(context, IMAGE_LOAD_TIMEOUT_MS)

  const ratio = snapshotPixelRatio(width, height, options.pixelRatio)
  // Rounded down, so the 16M-pixel clamp is never exceeded by a rounded-up row.
  const canvasWidth = Math.max(1, Math.floor(width * ratio))
  const canvasHeight = Math.max(1, Math.floor(height * ratio))
  const markup = new XMLSerializer().serializeToString(root)
  // The SVG is exactly canvas-sized and drawn 1:1; the density comes from a
  // CSS scale on the content, not from the SVG's viewBox. WebKit, scaling a
  // foreignObject by viewBox, paints every positioned element (each card here)
  // unscaled at the wrong place; a plain CSS transform is laid out right and
  // still rasterised at full density.
  const scaleX = canvasWidth / width
  const scaleY = canvasHeight / height
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}">` +
    `<foreignObject x="0" y="0" width="${canvasWidth}" height="${canvasHeight}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden;transform:scale(${scaleX},${scaleY});transform-origin:0 0">${markup}</div>` +
    `</foreignObject></svg>`
  const image = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    IMAGE_LOAD_TIMEOUT_MS,
  )

  const canvas = document.createElement("canvas")
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const canvasContext = canvas.getContext("2d")
  if (!canvasContext) throw new Error("Il browser non supporta i PNG.")
  const paint = () => {
    canvasContext.fillStyle = options.background ?? "#ffffff"
    canvasContext.fillRect(0, 0, canvasWidth, canvasHeight)
    canvasContext.drawImage(image, 0, 0)
  }
  paint()
  if (needsSecondDraw()) {
    await delay(100)
    paint()
  }

  const png = await canvasToPng(canvas)
  if (png.type && png.type !== "image/png") {
    throw new Error("Il browser ha restituito un formato immagine inatteso.")
  }
  return png.type ? png : new Blob([png], { type: "image/png" })
}
