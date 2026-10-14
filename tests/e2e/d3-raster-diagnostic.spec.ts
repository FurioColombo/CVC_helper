import { Buffer } from "node:buffer"
import { readFile } from "node:fs/promises"
import path from "node:path"

import { test, type Page, type PageScreenshotOptions } from "@playwright/test"
import sharp from "sharp"

import "./f3-crew-summary.spec"
import { compareRasterRegions } from "./d3-raster-region-metrics"

type RasterProbeMode = "source" | "dom-auto" | "connected-canvas"

type RasterTextStyle = {
  tagName: string
  fontFamily: string
  fontSize: string
  fontWeight: string
  fontStyle: string
  textRendering: string
  fontOpticalSizing: string
  fontKerning: string
  fontSmoothing: string
}

type RasterBox = { x: number; y: number; width: number; height: number }

type RasterRegion = { name: string; boxes: RasterBox[] }

type RasterLayout = {
  viewportWidth: number
  rootFontSize: string
  clip: RasterBox
  excluded: RasterBox[]
  regions: RasterRegion[]
}

type ScreenshotCapture = { layout: RasterLayout; screenshot: Buffer }

type RasterBaselineSnapshot = {
  rootFontSize: string
  probes: Array<Record<string, unknown>>
}

type RasterStyleSnapshot = {
  reason: string
  atMs: number
  rootFontSize: string
  body: RasterTextStyle | null
  summaryHeading: RasterTextStyle | null
  summaryTextSample: RasterTextStyle | null
}

type RasterDiagnosticPayload = {
  mode: RasterProbeMode
  styleSnapshots: RasterStyleSnapshot[]
  fontAssignments: Array<{
    requested: string
    accepted: string
    canvasConnected: boolean
    rootFontSize: string
    measureTextWidth: number
    fontBoundingBoxAscent: number | null
    fontBoundingBoxDescent: number | null
    actualBoundingBoxAscent: number | null
    actualBoundingBoxDescent: number | null
  }>
  events: Array<Record<string, string | number | boolean | null>>
  droppedStyleSnapshots: number
  droppedFontAssignments: number
  droppedEvents: number
}

type RasterDiagnosticPage = Page & {
  screenshot: (options?: PageScreenshotOptions) => Promise<Buffer>
}

const screenshotCaptures = new WeakMap<Page, ScreenshotCapture[]>()
const baselineSnapshots = new WeakMap<
  Page,
  Map<string, RasterBaselineSnapshot>
>()

function captureRasterLayout(input: { clip: RasterBox }): RasterLayout | null {
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
  const root = dialog?.querySelector<HTMLElement>(":scope > div")
  if (!dialog || !root) return null

  const relativeBox = (rect: DOMRect): RasterBox => ({
    x: rect.left - input.clip.x,
    y: rect.top - input.clip.y,
    width: rect.width,
    height: rect.height,
  })
  const excluded = Array.from(
    dialog.querySelectorAll<HTMLElement>("[data-snapshot-exclude]"),
  ).map((element) => {
    const rect = element.getBoundingClientRect()
    return {
      x: rect.x - input.clip.x - 24,
      y: rect.y - input.clip.y - 24,
      width: rect.width + 48,
      height: rect.height + 48,
    }
  })

  const textBySize = (
    expectedSize: number,
    excludeHeading = false,
  ): RasterBox[] => {
    const boxes: RasterBox[] = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      const textNode = node as Text
      const parent = textNode.parentElement
      if (
        parent &&
        textNode.textContent?.trim() &&
        !parent.closest("[data-snapshot-exclude]") &&
        !(excludeHeading && parent.closest("h1"))
      ) {
        const size = Number.parseFloat(getComputedStyle(parent).fontSize)
        if (Math.abs(size - expectedSize) < 0.15) {
          const range = document.createRange()
          range.selectNodeContents(textNode)
          for (const rect of Array.from(range.getClientRects())) {
            if (rect.width > 0 && rect.height > 0) {
              boxes.push(relativeBox(rect))
            }
          }
        }
      }
      node = walker.nextNode()
    }
    return boxes
  }

  const heading = root.querySelector<HTMLElement>("h1")
  const headingBoxes = heading
    ? [relativeBox(heading.getBoundingClientRect())]
    : []

  const edgeBoxes: RasterBox[] = []
  for (const element of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    if (element.closest("[data-snapshot-exclude]")) continue
    const rect = element.getBoundingClientRect()
    if (rect.width * rect.height < 600) continue
    const style = getComputedStyle(element)
    const box = relativeBox(rect)
    const sides = ["top", "right", "bottom", "left"] as const
    for (const side of sides) {
      const width = Number.parseFloat(
        style.getPropertyValue(`border-${side}-width`),
      )
      if (
        width <= 0 ||
        style.getPropertyValue(`border-${side}-style`) === "none"
      ) {
        continue
      }
      const thickness = Math.max(2, width)
      if (side === "top") {
        edgeBoxes.push({ ...box, height: Math.min(box.height, thickness) })
      } else if (side === "bottom") {
        edgeBoxes.push({
          ...box,
          y: box.y + Math.max(0, box.height - thickness),
          height: Math.min(box.height, thickness),
        })
      } else if (side === "left") {
        edgeBoxes.push({ ...box, width: Math.min(box.width, thickness) })
      } else {
        edgeBoxes.push({
          ...box,
          x: box.x + Math.max(0, box.width - thickness),
          width: Math.min(box.width, thickness),
        })
      }
    }
  }

  return {
    viewportWidth: window.innerWidth,
    rootFontSize: getComputedStyle(document.documentElement).fontSize,
    clip: input.clip,
    excluded,
    regions: [
      { name: "heading-40px", boxes: headingBoxes },
      { name: "other-text-40px", boxes: textBySize(40, true) },
      { name: "text-13.5px", boxes: textBySize(13.5) },
      { name: "text-11px", boxes: textBySize(11) },
      { name: "text-9px", boxes: textBySize(9) },
      { name: "card-and-section-edges", boxes: edgeBoxes },
    ],
  }
}

function captureBaselineMetrics() {
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
  const root = dialog?.querySelector<HTMLElement>(":scope > div")
  if (!root) return []

  const findTextAtSize = (
    expectedSize: number,
    excludeHeading = false,
  ): HTMLElement | null => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      const textNode = node as Text
      const parent = textNode.parentElement
      if (
        parent &&
        textNode.textContent?.trim() &&
        !parent.closest("[data-snapshot-exclude]") &&
        !(excludeHeading && parent.closest("h1")) &&
        Math.abs(
          Number.parseFloat(getComputedStyle(parent).fontSize) - expectedSize,
        ) < 0.15
      ) {
        return parent
      }
      node = walker.nextNode()
    }
    return null
  }

  const probe = (name: string, element: HTMLElement | null) => {
    if (!element) return null
    const style = getComputedStyle(element)
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) return null
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const canvasMetrics = context.measureText("Hg")

    const host = document.createElement("div")
    host.style.cssText =
      "position:fixed;left:-10000px;top:0;visibility:hidden;white-space:nowrap;pointer-events:none;contain:layout style;"
    const text = document.createElement("span")
    for (const property of [
      "font-family",
      "font-size",
      "font-weight",
      "font-style",
      "font-variant",
      "font-stretch",
      "font-feature-settings",
      "font-variation-settings",
      "font-kerning",
      "font-optical-sizing",
      "letter-spacing",
      "line-height",
      "text-rendering",
    ]) {
      text.style.setProperty(property, style.getPropertyValue(property))
    }
    const sample = document.createTextNode("Hg")
    const baselineMarker = document.createElement("span")
    baselineMarker.style.cssText =
      "display:inline-block;width:0;height:0;padding:0;margin:0;border:0;overflow:hidden;vertical-align:baseline;"
    text.append(sample, baselineMarker)
    host.append(text)
    document.body.append(host)
    const range = document.createRange()
    range.selectNodeContents(sample)
    const rect = range.getBoundingClientRect()
    const baseline = baselineMarker.getBoundingClientRect().top
    const ascent = canvasMetrics.fontBoundingBoxAscent
    const descent = canvasMetrics.fontBoundingBoxDescent
    host.remove()

    const extent = ascent + descent
    return {
      name,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      textRendering: style.textRendering,
      fontKerning: style.getPropertyValue("font-kerning"),
      fontOpticalSizing: style.getPropertyValue("font-optical-sizing"),
      fontSmoothing: style.getPropertyValue("-webkit-font-smoothing"),
      domRangeHeight: rect.height,
      domBaselineOffset: baseline - rect.top,
      canvasFontBoundingBoxAscent: ascent,
      canvasFontBoundingBoxDescent: descent,
      currentFormulaOffset: extent > 0 ? (rect.height * ascent) / extent : null,
      formulaDeltaFromDomBaseline:
        extent > 0
          ? (rect.height * ascent) / extent - (baseline - rect.top)
          : null,
    }
  }

  return {
    rootFontSize: getComputedStyle(document.documentElement).fontSize,
    probes: [
      probe("heading", root.querySelector<HTMLElement>("h1")),
      probe("text-40px-other", findTextAtSize(40, true)),
      probe("text-13.5px", findTextAtSize(13.5)),
      probe("text-11px", findTextAtSize(11)),
      probe("text-9px", findTextAtSize(9)),
    ].filter((item) => item !== null),
  }
}

declare global {
  interface Window {
    __cvcRasterDiagnostic?: RasterDiagnosticPayload
  }
}

const modeValue = process.env.CVC_FONT_DIAGNOSTIC ?? "source"
if (
  modeValue !== "source" &&
  modeValue !== "dom-auto" &&
  modeValue !== "connected-canvas"
) {
  throw new Error(`Unsupported CVC_FONT_DIAGNOSTIC mode: ${modeValue}`)
}
const mode: RasterProbeMode = modeValue

function installRasterDiagnostic(selectedMode: RasterProbeMode) {
  const state: RasterDiagnosticPayload = {
    mode: selectedMode,
    styleSnapshots: [],
    fontAssignments: [],
    events: [],
    droppedStyleSnapshots: 0,
    droppedFontAssignments: 0,
    droppedEvents: 0,
  }
  const diagnosticWindow = window as Window & {
    __cvcRasterDiagnostic?: RasterDiagnosticPayload
  }
  diagnosticWindow.__cvcRasterDiagnostic = state

  const recordEvent = (
    event: Record<string, string | number | boolean | null>,
  ) => {
    if (state.events.length < 64) state.events.push(event)
    else state.droppedEvents += 1
  }

  const readStyle = (element: Element | null): RasterTextStyle | null => {
    if (!element) return null
    const style = window.getComputedStyle(element)
    return {
      tagName: element.tagName.toLowerCase(),
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      textRendering: style.textRendering,
      fontOpticalSizing: style.getPropertyValue("font-optical-sizing"),
      fontKerning: style.getPropertyValue("font-kerning"),
      fontSmoothing: style.getPropertyValue("-webkit-font-smoothing"),
    }
  }

  const captureStyles = (reason: string) => {
    if (!document.body) return
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    const summaryHeading = dialog?.querySelector("h1") ?? null
    const summaryTextSample = dialog
      ? (Array.from(
          dialog.querySelectorAll<HTMLElement>("li, p, span, strong"),
        ).find((element) =>
          Array.from(element.childNodes).some(
            (node) =>
              node.nodeType === Node.TEXT_NODE &&
              Boolean(node.textContent?.trim()),
          ),
        ) ?? null)
      : null
    const snapshot: RasterStyleSnapshot = {
      reason,
      atMs: performance.now(),
      rootFontSize: window.getComputedStyle(document.documentElement).fontSize,
      body: readStyle(document.body),
      summaryHeading: readStyle(summaryHeading),
      summaryTextSample: readStyle(summaryTextSample),
    }
    if (state.styleSnapshots.length < 64) state.styleSnapshots.push(snapshot)
    else state.droppedStyleSnapshots += 1
  }

  let bodySmoothingApplied = false
  let summaryCaptured = false
  const applyBodySmoothing = () => {
    if (selectedMode !== "dom-auto" || !document.body || bodySmoothingApplied) {
      return
    }
    document.body.style.setProperty("-webkit-font-smoothing", "auto")
    bodySmoothingApplied = true
    recordEvent({
      type: "body-font-smoothing-auto",
      atMs: performance.now(),
    })
    captureStyles("body-font-smoothing-auto")
  }

  const observer = new MutationObserver((records) => {
    applyBodySmoothing()

    const rootStyleChanged = records.some(
      (record) =>
        record.type === "attributes" &&
        record.target === document.documentElement &&
        record.attributeName === "style",
    )
    const bodyStyleChanged = records.some(
      (record) =>
        record.type === "attributes" &&
        record.target === document.body &&
        record.attributeName === "style",
    )
    if (rootStyleChanged) captureStyles("root-style-change")
    if (bodyStyleChanged) captureStyles("body-style-change")

    if (!summaryCaptured && document.querySelector('[role="dialog"] h1')) {
      summaryCaptured = true
      captureStyles("summary-mounted")
    }
  })
  observer.observe(document, {
    attributes: true,
    attributeFilter: ["style"],
    childList: true,
    subtree: true,
  })
  applyBodySmoothing()
  captureStyles("document-start")

  const contextPrototype = CanvasRenderingContext2D.prototype
  const recordedFontAssignments = new Set<string>()
  const fontDescriptor = Object.getOwnPropertyDescriptor(
    contextPrototype,
    "font",
  )
  if (
    fontDescriptor?.configurable &&
    typeof fontDescriptor.get === "function" &&
    typeof fontDescriptor.set === "function"
  ) {
    const nativeFontGetter = fontDescriptor.get
    const nativeFontSetter = fontDescriptor.set
    Object.defineProperty(contextPrototype, "font", {
      ...fontDescriptor,
      set(this: CanvasRenderingContext2D, value: string) {
        const result = Reflect.apply(nativeFontSetter, this, [value])
        try {
          const accepted = Reflect.apply(nativeFontGetter, this, [])
          const rootFontSize = getComputedStyle(
            document.documentElement,
          ).fontSize
          const requested = typeof value === "string" ? value : "[non-string]"
          const key = JSON.stringify([
            requested,
            String(accepted),
            this.canvas.isConnected,
            rootFontSize,
          ])
          if (!recordedFontAssignments.has(key)) {
            recordedFontAssignments.add(key)
            if (state.fontAssignments.length >= 256) {
              state.droppedFontAssignments += 1
              return result
            }
            const metrics = this.measureText("Hg")
            state.fontAssignments.push({
              requested,
              accepted: String(accepted),
              canvasConnected: this.canvas.isConnected,
              rootFontSize,
              measureTextWidth: metrics.width,
              fontBoundingBoxAscent:
                typeof metrics.fontBoundingBoxAscent === "number"
                  ? metrics.fontBoundingBoxAscent
                  : null,
              fontBoundingBoxDescent:
                typeof metrics.fontBoundingBoxDescent === "number"
                  ? metrics.fontBoundingBoxDescent
                  : null,
              actualBoundingBoxAscent:
                typeof metrics.actualBoundingBoxAscent === "number"
                  ? metrics.actualBoundingBoxAscent
                  : null,
              actualBoundingBoxDescent:
                typeof metrics.actualBoundingBoxDescent === "number"
                  ? metrics.actualBoundingBoxDescent
                  : null,
            })
          }
        } catch {
          // Diagnostics must not change the native setter's behavior.
        }
        return result
      },
    })
    recordEvent({
      type: "font-setter-observer-installed",
      atMs: performance.now(),
    })
  } else {
    recordEvent({
      type: "font-setter-observer-unavailable",
      atMs: performance.now(),
    })
  }

  if (selectedMode === "connected-canvas") {
    const getContextDescriptor = Object.getOwnPropertyDescriptor(
      HTMLCanvasElement.prototype,
      "getContext",
    )
    const nativeGetContext = getContextDescriptor?.value
    if (
      getContextDescriptor?.configurable &&
      typeof nativeGetContext === "function"
    ) {
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        ...getContextDescriptor,
        value: new Proxy(nativeGetContext, {
          apply(target, thisValue, argumentsList) {
            if (
              thisValue instanceof HTMLCanvasElement &&
              argumentsList[0] === "2d" &&
              !thisValue.isConnected &&
              document.body
            ) {
              try {
                const canvas = thisValue
                canvas.style.position = "fixed"
                canvas.style.left = "-10000px"
                canvas.style.top = "-10000px"
                canvas.style.width = "1px"
                canvas.style.height = "1px"
                canvas.style.opacity = "0"
                canvas.style.pointerEvents = "none"
                canvas.setAttribute("aria-hidden", "true")
                document.body.append(canvas)
                const computed = window.getComputedStyle(canvas)
                recordEvent({
                  type: "canvas-connected-before-context",
                  atMs: performance.now(),
                  connected: canvas.isConnected,
                  canvasFontFamily: computed.fontFamily,
                  canvasFontSize: computed.fontSize,
                  canvasFontKerning: computed.getPropertyValue("font-kerning"),
                })
              } catch {
                recordEvent({
                  type: "canvas-connect-failed",
                  atMs: performance.now(),
                })
              }
            }
            return Reflect.apply(target, thisValue, argumentsList)
          },
        }),
      })
      recordEvent({
        type: "canvas-context-observer-installed",
        atMs: performance.now(),
      })
    } else {
      recordEvent({
        type: "canvas-context-observer-unavailable",
        atMs: performance.now(),
      })
    }
  }
}

test.beforeEach(async ({ page }) => {
  screenshotCaptures.set(page, [])
  baselineSnapshots.set(page, new Map())
  const diagnosticPage = page as RasterDiagnosticPage
  const originalScreenshot = page.screenshot.bind(page)
  const originalEvaluate = page.evaluate.bind(page) as (
    pageFunction: unknown,
    arg?: unknown,
  ) => Promise<unknown>
  const evaluatePage = page as unknown as {
    evaluate: (...args: unknown[]) => Promise<unknown>
  }
  evaluatePage.evaluate = async (...args) => {
    const result = await Reflect.apply(originalEvaluate, page, args)
    if (typeof result === "string" && result.startsWith("iVBORw0KGgo")) {
      try {
        const metrics = await originalEvaluate(captureBaselineMetrics)
        if (
          metrics &&
          typeof metrics === "object" &&
          "rootFontSize" in metrics &&
          "probes" in metrics
        ) {
          const snapshots = baselineSnapshots.get(page)
          const snapshot = metrics as RasterBaselineSnapshot
          if (
            snapshots &&
            !snapshots.has(snapshot.rootFontSize) &&
            snapshots.size < 8
          ) {
            snapshots.set(snapshot.rootFontSize, snapshot)
          }
        }
      } catch {
        // The image has already been created; metrics remain best-effort.
      }
    }
    return result
  }
  diagnosticPage.screenshot = async (options) => {
    let layout: RasterLayout | null = null
    if (options?.clip) {
      try {
        layout = await page.evaluate(captureRasterLayout, {
          clip: options.clip,
        })
      } catch {
        // A screenshot remains authoritative if diagnostic geometry fails.
      }
    }
    const screenshot = await originalScreenshot(options)
    if (layout) screenshotCaptures.get(page)?.push({ layout, screenshot })
    return screenshot
  }
  await page.addInitScript(installRasterDiagnostic, mode)
})

test.afterEach(async ({ page }, testInfo) => {
  let state: RasterDiagnosticPayload | null = null
  try {
    state = await page.evaluate(() => {
      const diagnosticWindow = window as Window & {
        __cvcRasterDiagnostic?: RasterDiagnosticPayload
      }
      return diagnosticWindow.__cvcRasterDiagnostic ?? null
    })
  } catch {
    // Preserve the test's original result if the page closed before collection.
  }

  const captures = screenshotCaptures.get(page) ?? []
  const enlargedCapture = [...captures]
    .reverse()
    .find(
      ({ layout }) =>
        layout.viewportWidth === 320 &&
        Number.parseFloat(layout.rootFontSize) >= 32 &&
        Math.abs(layout.clip.width - 320) < 1,
    )
  const baselineMetrics = Array.from(
    baselineSnapshots.get(page)?.values() ?? [],
  )
  let regionComparison: Awaited<
    ReturnType<typeof compareRasterRegions>
  > | null = null
  let helperDifference: { mean: number; share: number; colour: number } | null =
    null
  let methodFidelity = "not-compared"
  let regionalResultsUsable = false
  let imagePairStatus = "not-captured"
  try {
    const reviewDirectory = process.env.CVC_REVIEW_DIR
    if (enlargedCapture && reviewDirectory) {
      const imagePath = path.resolve(
        process.cwd(),
        reviewDirectory,
        "f4-crew-summary-double-names-320-200pct.png",
      )
      const image = await readFile(imagePath)
      const metadata = await sharp(image).metadata()
      const cssWidth = Math.ceil(enlargedCapture.layout.clip.width)
      const ratio = metadata.width! / cssWidth
      regionComparison = await compareRasterRegions({
        image,
        screen: enlargedCapture.screenshot,
        excluded: enlargedCapture.layout.excluded,
        ratio,
        cssWidth,
        cssHeight: Math.round(enlargedCapture.layout.clip.height),
        regions: enlargedCapture.layout.regions,
      })
      imagePairStatus = "compared"
      const annotation = testInfo.annotations
        .filter((item) => item.type === "difference")
        .at(-1)
      if (annotation?.description) {
        try {
          helperDifference = JSON.parse(annotation.description) as {
            mean: number
            share: number
            colour: number
          }
          const fullFrame = regionComparison.find(
            ({ name }) => name === "full-frame-visible",
          )
          methodFidelity =
            fullFrame &&
            fullFrame.mean === helperDifference.mean &&
            fullFrame.share === helperDifference.share &&
            fullFrame.colour === helperDifference.colour
              ? "exact-match"
              : "mismatch"
          regionalResultsUsable = methodFidelity === "exact-match"
        } catch {
          methodFidelity = "invalid-original-difference-annotation"
        }
      } else {
        methodFidelity = "original-difference-annotation-missing"
      }
    } else if (!enlargedCapture) {
      imagePairStatus = "enlarged-screenshot-capture-not-found"
    } else {
      imagePairStatus = "CVC_REVIEW_DIR-unset"
    }
  } catch (error) {
    imagePairStatus = `comparison-unavailable: ${String(error)}`
  }

  const artifact = {
    mode,
    project: testInfo.project.name,
    styleSnapshots: state?.styleSnapshots ?? [],
    fontAssignments: state?.fontAssignments ?? [],
    events: state?.events ?? [],
    enlargedCapture: enlargedCapture
      ? {
          viewportWidth: enlargedCapture.layout.viewportWidth,
          rootFontSize: enlargedCapture.layout.rootFontSize,
          clip: enlargedCapture.layout.clip,
          excluded: enlargedCapture.layout.excluded,
          regions: enlargedCapture.layout.regions,
        }
      : null,
    regionComparison,
    helperDifference,
    methodFidelity,
    regionalResultsUsable,
    imagePairStatus,
    baselineMetrics,
    droppedStyleSnapshots: state?.droppedStyleSnapshots ?? 0,
    droppedFontAssignments: state?.droppedFontAssignments ?? 0,
    droppedEvents: state?.droppedEvents ?? 0,
  }
  try {
    await testInfo.attach("raster-diagnostic.json", {
      body: Buffer.from(JSON.stringify(artifact, null, 2)),
      contentType: "application/json",
    })
  } catch {
    // Artifact collection is best-effort and does not alter the source test.
  }
})
