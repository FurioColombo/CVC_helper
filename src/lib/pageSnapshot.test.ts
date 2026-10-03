import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  MAX_CANVAS_PIXELS,
  cleanText,
  renderElementToPng,
  snapshotPixelRatio,
  waitForImages,
} from "./pageSnapshot"

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ""
})

describe("snapshotPixelRatio", () => {
  it("follows the screen between 2× and 3×", () => {
    expect(snapshotPixelRatio(390, 1500, 2.625)).toBe(2.625)
    expect(snapshotPixelRatio(390, 1500, 3)).toBe(3)
    expect(snapshotPixelRatio(390, 1500, 2)).toBe(2)
  })

  it("gives a 1× screen the crisp 2× a gallery image wants, and never more than 3×", () => {
    expect(snapshotPixelRatio(390, 1500, 1)).toBe(2)
    expect(snapshotPixelRatio(390, 1500, 0.5)).toBe(2)
    expect(snapshotPixelRatio(390, 1500, 5)).toBe(3)
  })

  it("falls back to 2× when the screen's density is not a number", () => {
    expect(snapshotPixelRatio(390, 1500, Number.NaN)).toBe(2)
    expect(snapshotPixelRatio(390, 1500, Number.POSITIVE_INFINITY)).toBe(2)
  })

  it("lowers the ratio, below 2× if it must, so the canvas stays within 16M pixels", () => {
    // 390 × 5000 CSS px at 3× would be 17.5M pixels.
    const tall = snapshotPixelRatio(390, 5000, 3)
    expect(tall).toBeLessThan(3)
    expect(tall).toBeGreaterThan(2)
    expect(snapshotPixelRatio(390, 20_000, 3)).toBeLessThan(2)
    for (const height of [1500, 3900, 5000, 7000, 12_000, 20_000, 40_000]) {
      const ratio = snapshotPixelRatio(390, height, 3)
      const canvasWidth = Math.floor(390 * ratio)
      const canvasHeight = Math.floor(height * ratio)
      expect(
        canvasWidth * canvasHeight,
        `height ${height}`,
      ).toBeLessThanOrEqual(MAX_CANVAS_PIXELS)
    }
  })
})

describe("cleanText", () => {
  it("replaces what XML cannot hold and keeps the rest, accents and emoji included", () => {
    expect(cleanText("Giulia\u0000 Rossi\u0008")).toBe("Giulia� Rossi�")
    expect(cleanText("Niccolò 🌊 D’Angelo\n")).toBe("Niccolò 🌊 D’Angelo\n")
    expect(cleanText(null)).toBe("")
  })
})

describe("waitForImages", () => {
  it("returns at once when every image is already there", async () => {
    const root = document.createElement("div")
    root.innerHTML = "<p>nessuna immagine</p>"
    await expect(waitForImages(root)).resolves.toBeUndefined()
  })

  it("waits for the images that are loading, loaded or failed", async () => {
    const root = document.createElement("div")
    const first = document.createElement("img")
    const second = document.createElement("img")
    for (const image of [first, second]) {
      Object.defineProperty(image, "complete", { value: false })
      root.append(image)
    }
    let done = false
    const waiting = waitForImages(root).then(() => {
      done = true
    })
    first.dispatchEvent(new Event("load"))
    await Promise.resolve()
    expect(done).toBe(false)
    second.dispatchEvent(new Event("error"))
    await waiting
    expect(done).toBe(true)
  })

  it("gives up after the timeout when an image never answers", async () => {
    vi.useFakeTimers()
    const root = document.createElement("div")
    const image = document.createElement("img")
    Object.defineProperty(image, "complete", { value: false })
    root.append(image)
    const waiting = waitForImages(root, 3000)
    await vi.advanceTimersByTimeAsync(3000)
    await expect(waiting).resolves.toBeUndefined()
  })
})

/**
 * jsdom lays nothing out and paints nothing, so what is checked here is the
 * copy the browser is handed: which parts of the page it holds, how they are
 * styled, and that the page itself is left as it was. How it looks is the
 * browser journeys' job (`tests/e2e/f3-*-summary.spec.ts`).
 */
describe("renderElementToPng", () => {
  let svgText: string
  let canvasSize: { width: number; height: number }
  let drawn: number

  beforeEach(() => {
    svgText = ""
    drawn = 0
    canvasSize = { width: 0, height: 0 }

    // An image that "loads" whatever it is given and remembers the SVG.
    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      decode = () => Promise.resolve()
      set src(value: string) {
        if (value.startsWith("data:image/svg+xml")) {
          svgText = decodeURIComponent(value.split(",").slice(1).join(","))
        }
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal("Image", FakeImage)
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement) {
        canvasSize = { width: this.width, height: this.height }
        return {
          fillRect: vi.fn(),
          drawImage: vi.fn(() => {
            drawn += 1
          }),
        } as unknown as CanvasRenderingContext2D
      },
    )
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (callback) {
        callback(new Blob(["png"], { type: "image/png" }))
      },
    )
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(["logo"], { type: "image/png" })),
      }),
    )
  })

  function buildSummary() {
    document.body.innerHTML = `
      <section id="root" style="padding: 1rem 2rem" class="mx-auto">
        <header>
          <h1 style="color: rgb(16, 47, 59)" aria-label="Sabato PM">Sabato PM</h1>
          <button id="close" data-snapshot-exclude="true" aria-label="Chiudi">X</button>
          <button id="kept" data-snapshot-exclude="">Resta</button>
        </header>
        <ul>
          <li aria-label="Equipaggio 1, Mario Rossi" style="border: 1px solid red">
            <img id="logo" src="/brand/boats/rs-toura.png" alt="RS Toura" />
            <span style="display: none">nascosto</span>
            <svg viewBox="0 0 24 24" class="size-5" aria-hidden="true" stroke="currentColor"><path d="M1 1h22" /></svg>
          </li>
        </ul>
        <script>window.leaked = true</script>
      </section>`
    const root = document.getElementById("root")!
    // The HTML parser drops a NUL; the DOM can still hold one (a pasted name).
    root.querySelector("h1")!.textContent = "Sabato\u0000 PM"
    root.getBoundingClientRect = () =>
      ({ width: 390, height: 600, x: 0, y: 0 }) as DOMRect
    Object.defineProperty(root, "scrollHeight", { value: 600 })
    return root
  }

  it("hands the browser a copy of the element at its width and full height, drawn at the screen's density", async () => {
    vi.stubGlobal("devicePixelRatio", 2.625)
    const root = buildSummary()
    const png = await renderElementToPng(root, { background: "#fffdf8" })

    expect(png.type).toBe("image/png")
    expect(canvasSize).toEqual({
      width: Math.floor(390 * 2.625),
      height: Math.floor(600 * 2.625),
    })
    const svg = new DOMParser().parseFromString(svgText, "image/svg+xml")
    expect(svg.querySelector("parsererror")).toBeNull()
    const outer = svg.documentElement
    // Exactly canvas-sized, scaled by a CSS transform rather than a viewBox.
    expect(outer.getAttribute("width")).toBe(String(Math.floor(390 * 2.625)))
    expect(outer.getAttribute("height")).toBe(String(Math.floor(600 * 2.625)))
    expect(outer.hasAttribute("viewBox")).toBe(false)
    const frame = svg.querySelector("foreignObject > div")!
    expect(frame.getAttribute("style")).toMatch(/width:390px;height:600px/)
    expect(frame.getAttribute("style")).toMatch(/transform:scale\(2\.6/)
  })

  it("leaves out what is marked, hidden or not content, and keeps what is marked without a value", async () => {
    const root = buildSummary()
    await renderElementToPng(root)

    const svg = new DOMParser().parseFromString(svgText, "image/svg+xml")
    const text = svg.documentElement.textContent ?? ""
    expect(text).not.toContain("X")
    expect(text).toContain("Resta")
    expect(text).not.toContain("nascosto")
    expect(svgText).not.toContain("leaked")
    expect(svg.querySelectorAll("script")).toHaveLength(0)
  })

  it("keeps people's names to the text: no accessible names, classes or ids go into the image, and invalid XML characters are replaced", async () => {
    const root = buildSummary()
    await renderElementToPng(root)

    expect(svgText).not.toContain("Mario Rossi")
    expect(svgText).not.toContain("aria-")
    expect(svgText).not.toContain("class=")
    expect(svgText).not.toContain("size-5")
    expect(svgText).toContain("Sabato� PM")
  })

  it("writes each element's style inline, only what differs from the browser's own for that tag, and never for a tag it need not", async () => {
    const root = buildSummary()
    await renderElementToPng(root)

    const svg = new DOMParser().parseFromString(svgText, "image/svg+xml")
    const heading = svg.querySelector("h1")!
    expect(heading.getAttribute("style")).toContain("color:rgb(16, 47, 59)")
    // Left to the browser's own default for an `<h1>`: not repeated.
    expect(heading.getAttribute("style")).not.toContain("display:block")
    // The page's own padding on the root, written for it.
    const rootCopy = svg.querySelector("foreignObject > div > section")!
    expect(rootCopy.getAttribute("style")).toContain("2rem")
    expect(svg.querySelector("path")?.getAttribute("d")).toBe("M1 1h22")
  })

  it("puts the image's own padding on the root for the measure and the copy, then gives the page its own back", async () => {
    const root = buildSummary()
    const before = root.getAttribute("style")
    await renderElementToPng(root, {
      rootStyle: { paddingTop: "16px", paddingBottom: "16px", margin: "0px" },
    })

    expect(root.getAttribute("style")).toBe(before)
    const svg = new DOMParser().parseFromString(svgText, "image/svg+xml")
    const rootCopy = svg.querySelector("foreignObject > div > section")!
    expect(rootCopy.getAttribute("style")).toContain("16px")
    expect(rootCopy.getAttribute("style")).not.toContain("1rem")
    expect(rootCopy.getAttribute("style")).toMatch(/width: ?390px/)
  })

  it("lets the caller decide what is left out", async () => {
    const root = buildSummary()
    await renderElementToPng(root, {
      exclude: (element) => element.localName === "ul",
    })

    const svg = new DOMParser().parseFromString(svgText, "image/svg+xml")
    expect(svg.querySelector("li")).toBeNull()
    // Nothing excluded by the default rule now either way round.
    expect(svg.documentElement.textContent).toContain("X")
  })

  it("embeds every image as a data URL, from its own bytes", async () => {
    const root = buildSummary()
    await renderElementToPng(root)

    const svg = new DOMParser().parseFromString(svgText, "image/svg+xml")
    const logo = svg.querySelector("img")!
    expect(logo.getAttribute("src")).toMatch(/^data:image\/png;base64,/)
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/brand/boats/rs-toura.png"),
      expect.objectContaining({ cache: "force-cache" }),
    )
  })

  it("keeps the layout and leaves a slot empty when a logo cannot be fetched, instead of failing the whole image", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")))
    const root = buildSummary()
    const png = await renderElementToPng(root)

    expect(png.type).toBe("image/png")
    const svg = new DOMParser().parseFromString(svgText, "image/svg+xml")
    expect(svg.querySelector("img")!.getAttribute("src")).toMatch(
      /^data:image\/gif;base64,/,
    )
  })

  it("draws a second time in WebKit, once only elsewhere", async () => {
    const root = buildSummary()
    const agent = vi.spyOn(navigator, "userAgent", "get")

    agent.mockReturnValue(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    )
    await renderElementToPng(root)
    expect(drawn).toBe(1)

    drawn = 0
    agent.mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    )
    await renderElementToPng(root)
    expect(drawn).toBe(2)
  })

  it("refuses an element with no size, and an image the browser cannot load", async () => {
    document.body.innerHTML = `<div id="empty"></div>`
    await expect(
      renderElementToPng(document.getElementById("empty")!),
    ).rejects.toThrow()

    const root = buildSummary()
    vi.stubGlobal(
      "Image",
      class {
        onerror: (() => void) | null = null
        set src(_value: string) {
          queueMicrotask(() => this.onerror?.())
        }
      },
    )
    await expect(renderElementToPng(root)).rejects.toThrow()
  })
})
