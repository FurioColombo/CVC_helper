import { afterEach, describe, expect, it, vi } from "vitest"

import {
  IMAGE_LOAD_TIMEOUT_MS,
  MAX_CANVAS_PIXELS,
  NAME_FONT,
  WARNING_BADGE_RESERVE,
  estimateTextWidth,
  layoutMemberRow,
  loadImage,
  renderCardFrame,
  summaryPixelRatio,
  wrapText,
} from "./summaryImage"

const parseFragment = (markup: string): XMLDocument =>
  new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`,
    "image/svg+xml",
  )

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("estimateTextWidth", () => {
  it("measures capitals and wide letters wider than lowercase, and narrow letters narrower", () => {
    const font = 32
    const lower = estimateTextWidth("anna", font)
    expect(estimateTextWidth("ANNA", font)).toBeGreaterThan(lower)
    expect(estimateTextWidth("WWWW", font)).toBeGreaterThan(
      estimateTextWidth("ANNA", font),
    )
    expect(estimateTextWidth("illi", font)).toBeLessThan(lower)
    expect(estimateTextWidth("", font)).toBe(0)
  })

  it("scales linearly with the font size", () => {
    expect(estimateTextWidth("Giulia", 64)).toBeCloseTo(
      2 * estimateTextWidth("Giulia", 32),
      6,
    )
  })
})

describe("wrapText", () => {
  const NAMES = [
    "FRANCESCA BIANCHI",
    "GIANFRANCESCOANTONIO",
    "WWWWWWWWWWWW",
    "Maria Giovanna Della Valle Rossi",
  ]

  it.each(NAMES)(
    "never lets a line of %s pass the width, at any card width",
    (name) => {
      for (const maxWidth of [90, 140, 220, 300, 340, 432]) {
        const lines = wrapText(name, maxWidth, NAME_FONT)
        for (const line of lines) {
          // A single letter wider than the line is the one thing that may
          // pass it: there is nothing shorter to cut to.
          expect(
            Array.from(line).length === 1 ||
              estimateTextWidth(line, NAME_FONT) <= maxWidth,
            `${name} @ ${maxWidth}: "${line}"`,
          ).toBe(true)
        }
        // No letter is lost or invented.
        expect(lines.join("").replace(/\s/gu, "")).toBe(
          name.replace(/\s/gu, ""),
        )
      }
    },
  )

  it("breaks between words first and cuts inside a word only when the word itself is too wide", () => {
    expect(wrapText("FRANCESCA BIANCHI", 340, NAME_FONT)).toEqual([
      "FRANCESCA",
      "BIANCHI",
    ])
    const cut = wrapText("GIANFRANCESCOANTONIO", 340, NAME_FONT)
    expect(cut.length).toBeGreaterThan(1)
    expect(cut.join("")).toBe("GIANFRANCESCOANTONIO")
  })

  it("keeps a whole short name on one line", () => {
    expect(wrapText("Giulia", 340, NAME_FONT)).toEqual(["Giulia"])
  })

  it("narrows only the first line when asked", () => {
    const plain = wrapText("WWWWWWWWWWWW", 340, NAME_FONT)
    const reserved = wrapText("WWWWWWWWWWWW", 340, NAME_FONT, 340 - 48)
    expect(estimateTextWidth(reserved[0]!, NAME_FONT)).toBeLessThanOrEqual(
      340 - 48,
    )
    expect(Array.from(reserved[0]!).length).toBeLessThan(
      Array.from(plain[0]!).length,
    )
    for (const line of reserved.slice(1)) {
      expect(estimateTextWidth(line, NAME_FONT)).toBeLessThanOrEqual(340)
    }
  })

  it("still makes progress when even one letter is wider than the line", () => {
    expect(wrapText("WWW", 5, NAME_FONT)).toEqual(["W", "W", "W"])
  })

  it("returns a dash for empty text", () => {
    expect(wrapText("   ", 300, NAME_FONT)).toEqual(["—"])
  })
})

describe("layoutMemberRow warning reserve", () => {
  const firstNameLines = (svg: string) =>
    Array.from(
      parseFragment(svg).querySelectorAll("[data-member-label] > text"),
    )

  it("keeps the first line of a long all-capitals name clear of the corner badge, and leaves later lines their full width", () => {
    const width = 340
    const { svg } = layoutMemberRow(
      "GIANFRANCESCOANTONIO BIANCHI",
      [],
      100,
      0,
      width,
      WARNING_BADGE_RESERVE,
    )
    const lines = firstNameLines(svg)

    expect(lines.length).toBeGreaterThan(1)
    const right = (node: Element) =>
      100 +
      estimateTextWidth(node.textContent ?? "", NAME_FONT) +
      (node === lines[0] ? WARNING_BADGE_RESERVE : 0)
    for (const line of lines) {
      expect(right(line)).toBeLessThanOrEqual(100 + width)
    }
  })

  it("moves the badges of a one-line name left of the reserved corner", () => {
    const width = 340
    const { svg } = layoutMemberRow(
      "Massimiliano",
      [{ text: "M", fill: "#b42318", color: "#ffffff" }],
      0,
      0,
      width,
      WARNING_BADGE_RESERVE,
    )
    const badge = parseFragment(svg).querySelector("g g rect")
    const x = Number(badge?.getAttribute("x"))
    const badgeWidth = Number(badge?.getAttribute("width"))
    expect(x + badgeWidth).toBeLessThanOrEqual(width - WARNING_BADGE_RESERVE)
  })
})

describe("summaryPixelRatio", () => {
  it("keeps the requested 2× for an ordinary image, such as a 13-crew course", () => {
    expect(summaryPixelRatio(1080, 2400)).toBe(2)
    // 1080 × 3700 × 2² is just under the 16M-pixel budget.
    expect(summaryPixelRatio(1080, 3700)).toBe(2)
  })

  it("honours a lower request and never goes above 3×", () => {
    expect(summaryPixelRatio(1080, 2400, 1)).toBe(1)
    expect(summaryPixelRatio(1080, 400, 5)).toBe(3)
    expect(summaryPixelRatio(1080, 400, 0.2)).toBe(1)
  })

  it("lowers the ratio so the canvas stays within 16M pixels, and below 1× when it must", () => {
    const tall = summaryPixelRatio(1080, 7000)
    expect(tall).toBeGreaterThan(1)
    expect(tall).toBeLessThan(2)
    const extreme = summaryPixelRatio(1080, 20_000)
    expect(extreme).toBeLessThan(1)
    for (const height of [2400, 3900, 5000, 7000, 12_000, 20_000, 40_000]) {
      const ratio = summaryPixelRatio(1080, height)
      const canvasWidth = Math.floor(1080 * ratio)
      const canvasHeight = Math.floor(height * ratio)
      expect(
        canvasWidth * canvasHeight,
        `height ${height}`,
      ).toBeLessThanOrEqual(MAX_CANVAS_PIXELS)
    }
  })
})

describe("renderCardFrame", () => {
  it("clips the class-colour edge to the card's own rounded shape", () => {
    const parsed = parseFragment(renderCardFrame(40, 200, 488, 120, "#157a73"))
    const clip = parsed.querySelector("clipPath")
    const clipId = clip?.getAttribute("id")
    expect(clipId).toBeTruthy()
    // The clip is the card's own rounded rectangle…
    const clipRect = clip?.querySelector("rect")
    expect(clipRect?.getAttribute("rx")).toBe("24")
    expect(clipRect?.getAttribute("width")).toBe("488")
    expect(clipRect?.getAttribute("height")).toBe("120")
    // …and is applied to the edge, not to the card body.
    const edge = parsed.querySelector('rect[fill="#157a73"]')
    expect(edge?.getAttribute("clip-path")).toBe(`url(#${clipId})`)
    expect(edge?.getAttribute("width")).toBe("8")
    expect(
      parsed.querySelector('rect[fill="#ffffff"]')?.getAttribute("clip-path"),
    ).toBeNull()
  })

  it("gives two cards two different clip ids", () => {
    const first = parseFragment(renderCardFrame(40, 200, 488, 120, "#000"))
    const second = parseFragment(renderCardFrame(552, 200, 488, 120, "#000"))
    expect(first.querySelector("clipPath")?.getAttribute("id")).not.toBe(
      second.querySelector("clipPath")?.getAttribute("id"),
    )
  })
})

describe("loadImage", () => {
  class SilentImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    src = ""
  }

  it("rejects once the timeout passes without the image answering", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("Image", SilentImage)
    const outcome = loadImage("/brand/boats/rs-toura.png").then(
      () => "loaded",
      (error: Error) => error.message,
    )

    await vi.advanceTimersByTimeAsync(IMAGE_LOAD_TIMEOUT_MS - 1)
    let settled = false
    void outcome.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await expect(outcome).resolves.toBe("Impossibile preparare il riepilogo.")
  })

  it("resolves an image that answers in time and leaves no timer behind", async () => {
    vi.useFakeTimers()
    class QuickImage extends SilentImage {
      constructor() {
        super()
        Object.defineProperty(this, "src", {
          set: () => queueMicrotask(() => this.onload?.()),
        })
      }
    }
    vi.stubGlobal("Image", QuickImage)

    await expect(loadImage("/x.png")).resolves.toBeInstanceOf(QuickImage)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("rejects at once when the image errors", async () => {
    vi.useFakeTimers()
    class BrokenImage extends SilentImage {
      constructor() {
        super()
        Object.defineProperty(this, "src", {
          set: () => queueMicrotask(() => this.onerror?.()),
        })
      }
    }
    vi.stubGlobal("Image", BrokenImage)

    await expect(loadImage("/x.png")).rejects.toThrow(
      "Impossibile preparare il riepilogo.",
    )
    expect(vi.getTimerCount()).toBe(0)
  })
})
