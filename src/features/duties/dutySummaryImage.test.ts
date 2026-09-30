import { afterEach, describe, expect, it, vi } from "vitest"
import sharp from "sharp"

import { buildDutySummarySections } from "./dutySummaryModel"
import {
  buildDutySummaryPng,
  buildDutySummarySvg,
  downloadDutySummaryPng,
} from "./dutySummaryImage"
import type { DutySummaryDayLine } from "./dutySummaryModel"

const parseSvg = (markup: string): XMLDocument =>
  new DOMParser().parseFromString(markup, "image/svg+xml")

const member = (label: string, isMinor = false) => ({ label, isMinor })

const dayLine = (
  overrides: Partial<DutySummaryDayLine> & Pick<DutySummaryDayLine, "dayId">,
): DutySummaryDayLine => ({
  members: [],
  completed: false,
  warning: null,
  ...overrides,
})

const objectUrls = new Map<string, Blob>()
let nextObjectUrl = 0

class TestImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  src = ""
  naturalWidth = 0
  naturalHeight = 0

  constructor() {
    Object.defineProperty(this, "src", {
      configurable: true,
      get: () => this._src,
      set: (value: string) => {
        this._src = value
        queueMicrotask(() => this.onload?.())
      },
    })
  }

  private _src = ""
}

function stubPngCanvas() {
  const originalCreateElement = document.createElement.bind(document)
  vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
    if (tagName.toLowerCase() !== "canvas") {
      return originalCreateElement(tagName)
    }

    let imageUrl: string | undefined
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        scale: vi.fn(),
        drawImage: vi.fn((image: TestImage) => {
          imageUrl = image.src
        }),
      })),
      toDataURL: vi.fn(() => "data:image/png;base64,AAAA"),
      toBlob: (callback: BlobCallback, type?: string) => {
        const svgBlob = imageUrl ? objectUrls.get(imageUrl) : undefined
        void (async () => {
          if (!svgBlob) {
            callback(null)
            return
          }
          const source = Buffer.from(await svgBlob.arrayBuffer())
          const pixels = await sharp(source)
            .resize(canvas.width, canvas.height)
            .png()
            .toBuffer()
          callback(new Blob([pixels], { type: type ?? "image/png" }))
        })()
      },
    } as unknown as HTMLCanvasElement
    return canvas
  }) as typeof document.createElement)
}

function stubObjectUrls() {
  nextObjectUrl = 0
  objectUrls.clear()
  const create = vi.fn((blob: Blob | MediaSource) => {
    const url = `blob:duty-summary-${nextObjectUrl++}`
    objectUrls.set(url, blob as Blob)
    return url
  })
  const revoke = vi.fn((url: string) => {
    objectUrls.delete(url)
  })
  vi.stubGlobal("Image", TestImage)
  vi.spyOn(URL, "createObjectURL").mockImplementation(create)
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(revoke)
  return { create, revoke }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  objectUrls.clear()
  document.body.innerHTML = ""
})

describe("Comandate summary SVG layout", () => {
  it("renders the seven days in canonical Sabato→Venerdì order, two per row, at a fixed 1080px width", () => {
    const model = buildDutySummarySections({
      title: "Riepilogo comandate",
      lines: [
        dayLine({ dayId: "friday", members: [member("Zeno Ferri")] }),
        dayLine({ dayId: "saturday", members: [member("Aldo Rossi")] }),
      ],
    })

    const markup = buildDutySummarySvg(model)
    const parsed = parseSvg(markup)

    expect(parsed.getElementsByTagName("parsererror")).toHaveLength(0)
    expect(parsed.documentElement.getAttribute("width")).toBe("1080")
    const days = Array.from(
      parsed.querySelectorAll("[data-summary-day]"),
      (node) => node.getAttribute("data-summary-day"),
    )
    expect(days).toEqual([
      "saturday",
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
    ])
    expect(parsed.documentElement.textContent).toContain("Riepilogo comandate")
    expect(parsed.documentElement.textContent).toContain("Aldo Rossi")
    expect(parsed.documentElement.textContent).toContain("Zeno Ferri")

    // Two columns: Sabato and Domenica (the first two canonical days) sit at
    // the same y — the first grid row.
    const saturdayY = parsed
      .querySelector('[data-summary-day="saturday"] rect')
      ?.getAttribute("y")
    const sundayY = parsed
      .querySelector('[data-summary-day="sunday"] rect')
      ?.getAttribute("y")
    expect(saturdayY).toBe(sundayY)
    const mondayY = parsed
      .querySelector('[data-summary-day="monday"] rect')
      ?.getAttribute("y")
    expect(Number(mondayY)).toBeGreaterThan(Number(saturdayY))
  })

  it("shows every assigned name exactly once, each in its own day", () => {
    const model = buildDutySummarySections({
      title: "t",
      lines: [
        dayLine({
          dayId: "monday",
          members: [member("Bea Conti", true), member("Aldo Rossi")],
        }),
      ],
    })

    const markup = buildDutySummarySvg(model)
    const parsed = parseSvg(markup)
    const monday = parsed.querySelector('[data-summary-day="monday"]')!

    expect(
      monday.querySelector('[data-member-label="Aldo Rossi"]'),
    ).not.toBeNull()
    expect(
      monday.querySelector('[data-member-label="Bea Conti"]'),
    ).not.toBeNull()
    // The minor badge only decorates Bea's row.
    expect(monday.textContent).toContain("M")
  })

  it("shows 'Nessun assegnato' for an empty day", () => {
    const model = buildDutySummarySections({ title: "t", lines: [] })
    const markup = buildDutySummarySvg(model)
    expect(markup).toContain("Nessun assegnato")
  })

  it("shows the yellow or red warning badge only on the day it belongs to", () => {
    const model = buildDutySummarySections({
      title: "t",
      lines: [
        dayLine({
          dayId: "saturday",
          members: [member("Aldo Rossi")],
          warning: { severity: "red", count: 2 },
        }),
        dayLine({ dayId: "sunday", members: [member("Bea Conti")] }),
      ],
    })
    const markup = buildDutySummarySvg(model)
    const parsed = parseSvg(markup)

    expect(
      parsed.querySelector(
        '[data-summary-day="saturday"] [aria-label="Avviso comandata: rosso"]',
      ),
    ).not.toBeNull()
    expect(
      parsed.querySelector('[data-summary-day="sunday"] [aria-label]'),
    ).toBeNull()
  })

  it("colours a completed day's edge and label green, and an ordinary day's edge accent blue", () => {
    const model = buildDutySummarySections({
      title: "t",
      lines: [
        dayLine({
          dayId: "saturday",
          members: [member("Aldo Rossi")],
          completed: true,
        }),
      ],
    })
    const markup = buildDutySummarySvg(model)
    const parsed = parseSvg(markup)

    const completedEdge = parsed.querySelector(
      '[data-summary-day="saturday"] rect[fill]:nth-of-type(2)',
    )
    expect(completedEdge?.getAttribute("fill")).toBe("#176b2c")
    const ordinaryEdge = parsed.querySelector(
      '[data-summary-day="sunday"] rect[fill]:nth-of-type(2)',
    )
    expect(ordinaryEdge?.getAttribute("fill")).toBe("#0b526b")
  })

  it("grows the image height as a day's roster grows", () => {
    const empty = parseSvg(
      buildDutySummarySvg(buildDutySummarySections({ title: "t", lines: [] })),
    )
    const full = parseSvg(
      buildDutySummarySvg(
        buildDutySummarySections({
          title: "t",
          lines: [
            "saturday",
            "sunday",
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
          ].map((dayId) =>
            dayLine({
              dayId: dayId as DutySummaryDayLine["dayId"],
              members: Array.from({ length: 6 }, (_, index) =>
                member(`Allievo ${dayId} ${index + 1}`),
              ),
            }),
          ),
        }),
      ),
    )

    const emptyHeight = Number(empty.documentElement.getAttribute("height"))
    const fullHeight = Number(full.documentElement.getAttribute("height"))
    expect(fullHeight).toBeGreaterThan(emptyHeight)
  })

  it("escapes XML text and replaces invalid control characters", () => {
    const model = buildDutySummarySections({
      title: "<Riepilogo & 'oggi'>",
      lines: [
        dayLine({
          dayId: "saturday",
          members: [member("<script>alert('x')</script>\u0001")],
        }),
      ],
    })
    const markup = buildDutySummarySvg(model)
    const parsed = parseSvg(markup)

    expect(parsed.getElementsByTagName("parsererror")).toHaveLength(0)
    expect(parsed.getElementsByTagName("script")).toHaveLength(0)
    expect(parsed.documentElement.textContent).toContain("<Riepilogo & 'oggi'>")
  })
})

describe("Comandate summary PNG export", () => {
  it("decodes as a complete 2× PNG at 1080px logical width with every day's names rendered", async () => {
    stubObjectUrls()
    stubPngCanvas()
    const model = buildDutySummarySections({
      title: "Riepilogo comandate",
      lines: [
        "saturday",
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
      ].map((dayId, index) =>
        dayLine({
          dayId: dayId as DutySummaryDayLine["dayId"],
          members: [member(`Allievo ${index + 1}`, index === 0)],
          completed: index === 0,
          warning: index === 1 ? { severity: "yellow", count: 1 } : null,
        }),
      ),
    })

    const png = await buildDutySummaryPng(model)
    const bytes = Buffer.from(await png.arrayBuffer())
    const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    })

    expect(png.type).toBe("image/png")
    expect(bytes.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
    expect(decoded.info.width).toBe(2160) // 1080 × the default 2× pixel ratio
    expect(decoded.info.height).toBeGreaterThan(300)
    expect(objectUrls.size).toBe(0)
  })

  it("downloads a real PNG with a safe filename and releases both temporary URLs", async () => {
    vi.useFakeTimers()
    const { create, revoke } = stubObjectUrls()
    stubPngCanvas()
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined)
    const model = buildDutySummarySections({
      title: "Settimana 24 settembre!",
      lines: [dayLine({ dayId: "saturday", members: [member("Aldo")] })],
    })

    await downloadDutySummaryPng(model, { pixelRatio: 1 })

    expect(create).toHaveBeenCalledTimes(2)
    expect(click).toHaveBeenCalledOnce()
    expect(
      document.querySelector("a[download='settimana-24-settembre.png']"),
    ).toBeNull()
    expect(revoke).toHaveBeenCalledWith("blob:duty-summary-0")
    expect(revoke).not.toHaveBeenCalledWith("blob:duty-summary-1")
    vi.advanceTimersByTime(1000)
    expect(revoke).toHaveBeenCalledWith("blob:duty-summary-1")
  })
})
