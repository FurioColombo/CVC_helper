import { Buffer } from "node:buffer"

import { test } from "@playwright/test"

import "./f3-crew-summary.spec"

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
  }>
  events: Array<Record<string, string | number | boolean | null>>
  droppedStyleSnapshots: number
  droppedFontAssignments: number
  droppedEvents: number
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
          if (state.fontAssignments.length < 256) {
            state.fontAssignments.push({
              requested: typeof value === "string" ? value : "[non-string]",
              accepted: String(accepted),
              canvasConnected: this.canvas.isConnected,
            })
          } else {
            state.droppedFontAssignments += 1
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

  const artifact = {
    mode,
    project: testInfo.project.name,
    styleSnapshots: state?.styleSnapshots ?? [],
    fontAssignments: state?.fontAssignments ?? [],
    events: state?.events ?? [],
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
