import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  MAX_CANVAS_PIXELS,
  renderElementToPng,
  snapshotPixelRatio,
  waitForImages,
} from "./pageSnapshot"

afterEach(() => {
  delete (Range.prototype as unknown as Record<string, unknown>).getClientRects
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
      const canvasWidth = Math.round(390 * ratio)
      const canvasHeight = Math.round(height * ratio)
      expect(
        canvasWidth * canvasHeight,
        `height ${height}`,
      ).toBeLessThanOrEqual(MAX_CANVAS_PIXELS * 1.001)
    }
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
 * jsdom lays nothing out and paints nothing. So the layout is told to it, in
 * `data-rect` attributes (x, y, width, height, in viewport px) and, for text,
 * `data-words` (which rectangles each word or character is at), and the canvas
 * is a recorder. What is checked is the replay: what is painted, where, in
 * which order, and that nothing is laid out again. How it looks is the browser
 * journeys' job (`tests/e2e/f3-*-summary.spec.ts`).
 */
type Call = { op: string; args: unknown[]; state: Record<string, unknown> }

describe("renderElementToPng", () => {
  let calls: Call[]
  let canvasSize: { width: number; height: number }
  let iconSources: string[]
  /** How wide the fake canvas measures a character, in em. */
  let advance: number

  beforeEach(() => {
    calls = []
    canvasSize = { width: 0, height: 0 }
    iconSources = []
    advance = 0.5

    vi.stubGlobal("devicePixelRatio", 2)
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return toRect(this.getAttribute("data-rect"))
      },
    )
    vi.spyOn(SVGElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: SVGElement) {
        return toRect(this.getAttribute("data-rect"))
      },
    )
    // A word's rectangles are the ones the page said it has (jsdom has no
    // `Range.getClientRects` of its own).
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      writable: true,
      value(this: Range) {
        const owner = this.startContainer.parentElement!
        const table = JSON.parse(
          owner.getAttribute("data-words") ?? "{}",
        ) as Record<string, number[][]>
        return (table[this.toString()] ?? []).map(([x, y, width, height]) =>
          toRect(`${x},${y},${width},${height}`),
        )
      },
    })

    // An image that "loads" whatever it is given and remembers the SVG.
    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      decode = () => Promise.resolve()
      set src(value: string) {
        iconSources.push(
          decodeURIComponent(value.split(",").slice(1).join(",")),
        )
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal("Image", FakeImage)

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement) {
        canvasSize = { width: this.width, height: this.height }
        return fakeContext(this)
      } as never,
    )
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (callback) {
        callback(new Blob(["png"], { type: "image/png" }))
      },
    )
  })

  function toRect(value: string | null) {
    const [x = 0, y = 0, width = 0, height = 0] = (value ?? "")
      .split(",")
      .map(Number)
    return {
      x,
      y,
      left: x,
      top: y,
      width,
      height,
      right: x + width,
      bottom: y + height,
    } as DOMRect
  }

  /** A 2D context that records what is drawn, with the state in force at the
   *  time, and measures text as `advance` em per character. */
  function fakeContext(canvas: HTMLCanvasElement) {
    const state: Record<string, unknown> = {
      font: "",
      globalAlpha: 1,
      fillStyle: "#000",
      letterSpacing: "0px",
    }
    const stack: Array<Record<string, unknown>> = []
    const size = () =>
      Number.parseFloat(
        /(\d+(?:\.\d+)?)px/u.exec(String(state.font))?.[1] ?? "10",
      )
    const record =
      (op: string) =>
      (...args: unknown[]) => {
        calls.push({ op, args, state: { ...state } })
      }
    const context: Record<string, unknown> = {
      canvas,
      save: () => {
        stack.push({ ...state })
        calls.push({ op: "save", args: [], state: { ...state } })
      },
      restore: () => {
        Object.assign(state, stack.pop())
        calls.push({ op: "restore", args: [], state: { ...state } })
      },
      getTransform: () => ({ a: 2 }),
      measureText: (text: string) => ({
        width: Array.from(text).length * size() * advance,
        fontBoundingBoxAscent: size() * 0.8,
        fontBoundingBoxDescent: size() * 0.2,
      }),
    }
    for (const op of [
      "fillRect",
      "fill",
      "stroke",
      "clip",
      "rect",
      "beginPath",
      "closePath",
      "moveTo",
      "lineTo",
      "ellipse",
      "drawImage",
      "fillText",
      "setLineDash",
      "scale",
    ]) {
      context[op] = record(op)
    }
    // The drawing state is plain properties on the recorder's own state.
    for (const name of [
      "font",
      "globalAlpha",
      "fillStyle",
      "strokeStyle",
      "lineWidth",
      "letterSpacing",
      "textRendering",
      "textAlign",
      "textBaseline",
      "shadowColor",
      "shadowBlur",
      "shadowOffsetX",
      "shadowOffsetY",
      "imageSmoothingEnabled",
      "imageSmoothingQuality",
    ]) {
      Object.defineProperty(context, name, {
        get: () => state[name],
        set: (value: unknown) => {
          // A canvas ignores a font it cannot parse and keeps the last one.
          if (name === "font" && /REJECTED/u.test(String(value))) return
          state[name] = value
        },
      })
    }
    return context as unknown as CanvasRenderingContext2D
  }

  const ops = (name: string) => calls.filter((call) => call.op === name)
  const texts = () =>
    ops("fillText").map((call) => ({
      text: call.args[0] as string,
      x: call.args[1] as number,
      y: call.args[2] as number,
      font: String(call.state.font),
    }))

  /** A summary root at (50, 100), 390 wide, with 20px of padding above its
   *  content, so the image starts 4px below the root's own top. */
  function build(inner: string, rootStyle = "padding-top: 20px") {
    document.body.innerHTML = `<section id="root" data-rect="50,100,390,600" style="${rootStyle}">${inner}</section>`
    return document.getElementById("root")!
  }

  it("is the element's width and runs from 16px above its content to 16px below the lowest thing painted, at the screen's density", async () => {
    // The content starts at 120; the image at 104. The card ends at 300.
    const root = build(`
      <div data-rect="66,120,358,180" style="background-color: rgb(255, 255, 255); border: 0 none">
        <span data-rect="80,130,100,20" data-words='{"Mario":[[80,130,50,20]]}' style="font-size: 14px">Mario</span>
      </div>
      <p data-rect="66,400,358,40" data-snapshot-exclude="true" style="background-color: rgb(1, 2, 3)">Resta fuori</p>`)
    const png = await renderElementToPng(root, { background: "#fffdf8" })

    expect(png.type).toBe("image/png")
    // The image is the root's 390 wide, scaled by 2.
    expect(canvasSize).toEqual({
      width: 390 * 2,
      height: (300 - 104 + 16) * 2,
    })
    expect(ops("fillRect")[0]).toMatchObject({
      args: [0, 0, 390 * 2, (300 - 104 + 16) * 2],
      state: { fillStyle: "#fffdf8" },
    })
    expect(ops("scale")[0]!.args).toEqual([2, 2])
  })

  it("lowers the density to keep a very long summary within 16M pixels", async () => {
    const root = build(
      `<div data-rect="66,120,358,6000" style="background-color: rgb(255, 255, 255)"></div>`,
    )
    vi.stubGlobal("devicePixelRatio", 3)
    await renderElementToPng(root)
    expect(canvasSize.width * canvasSize.height).toBeLessThanOrEqual(
      MAX_CANVAS_PIXELS * 1.001,
    )
    expect(ops("scale")[0]!.args[0]).toBeLessThan(3)
  })

  it("leaves out what is marked, what is not displayed, and what is hidden, and paints what is marked without a value and a hidden parent's visible child", async () => {
    const root = build(`
      <button data-rect="66,120,40,40" data-snapshot-exclude="true" data-words='{"X":[[66,120,10,10]]}'>X</button>
      <p data-rect="66,160,60,20" data-words='{"Resta":[[66,160,50,20]]}' data-snapshot-exclude="">Resta</p>
      <p data-rect="66,180,60,20" data-words='{"nascosto":[[66,180,50,20]]}' style="display: none">nascosto</p>
      <div data-rect="66,200,100,20" style="visibility: hidden; background-color: rgb(9, 9, 9)">
        <span data-rect="66,200,60,20" data-words='{"invisibile":[[66,200,50,20]],"visibile":[[100,200,50,20]]}'>invisibile</span>
        <span data-rect="100,200,60,20" data-words='{"visibile":[[100,200,50,20]]}' style="visibility: visible">visibile</span>
      </div>
      <script data-rect="0,0,10,10">window.leaked = true</script>`)
    await renderElementToPng(root)

    const written = texts().map((entry) => entry.text)
    expect(written).toContain("Resta")
    expect(written).toContain("visibile")
    expect(written).not.toContain("X")
    expect(written).not.toContain("nascosto")
    expect(written).not.toContain("invisibile")
    // The hidden parent's own background is not painted either.
    expect(
      ops("fill").some((call) => call.state.fillStyle === "rgb(9, 9, 9)"),
    ).toBe(false)
  })

  it("lets the caller decide what is left out", async () => {
    const root = build(`
      <ul data-rect="66,120,100,40"><li data-rect="66,120,100,20" data-words='{"Mario":[[66,120,40,20]]}'>Mario</li></ul>
      <p data-rect="66,160,60,20" data-words='{"Resta":[[66,160,40,20]]}'>Resta</p>`)
    await renderElementToPng(root, {
      exclude: (element) => element.localName === "ul",
    })
    expect(texts().map((entry) => entry.text)).toEqual(["Resta"])
  })

  it("carries opacity down the tree", async () => {
    const root = build(`
      <div data-rect="66,120,100,20" style="opacity: 0.5">
        <p data-rect="66,120,100,20" data-words='{"Sbiadito":[[66,120,40,20]]}' style="opacity: 0.5">Sbiadito</p>
      </div>
      <p data-rect="66,160,100,20" data-words='{"Pieno":[[66,160,40,20]]}'>Pieno</p>`)
    await renderElementToPng(root)

    const [faded, full] = ops("fillText")
    expect(faded!.state.globalAlpha).toBe(0.25)
    expect(full!.state.globalAlpha).toBe(1)
  })

  it("paints a box's background with its rounded corners and a border as the ring between two rounded rectangles", async () => {
    const root = build(`
      <div data-rect="66,120,100,40" style="background-color: rgb(255, 255, 255); border: 1px solid rgb(200, 215, 219); border-top-left-radius: 10px; border-top-right-radius: 10px; border-bottom-right-radius: 10px; border-bottom-left-radius: 10px"></div>`)
    await renderElementToPng(root)

    const fills = ops("fill")
    expect(fills[0]).toMatchObject({
      state: { fillStyle: "rgb(255, 255, 255)" },
    })
    // The ring is filled even-odd, in the border colour.
    const ring = fills.find((call) => call.args[0] === "evenodd")
    expect(ring?.state.fillStyle).toBe("rgb(200, 215, 219)")
    // Four corners for the outer rounded rectangle, four for the inner, and
    // again for the background.
    expect(ops("ellipse").length).toBe(12)
  })

  it("clips a side of its own colour to the ring and paints it as a band, so the rounded corners stay right", async () => {
    const root = build(`
      <div data-rect="66,120,100,40" style="border-style: solid; border-top-width: 1px; border-right-width: 1px; border-bottom-width: 1px; border-left-width: 4px; border-top-color: rgb(1, 1, 1); border-right-color: rgb(1, 1, 1); border-bottom-color: rgb(1, 1, 1); border-left-color: rgb(0, 128, 0); border-top-left-radius: 10px; border-top-right-radius: 10px; border-bottom-right-radius: 10px; border-bottom-left-radius: 10px"></div>`)
    await renderElementToPng(root)

    expect(ops("clip").some((call) => call.args[0] === "evenodd")).toBe(true)
    const colours = ops("fill").map((call) => call.state.fillStyle)
    expect(colours).toContain("rgb(0, 128, 0)")
    expect(colours.filter((colour) => colour === "rgb(1, 1, 1)")).toHaveLength(
      3,
    )
  })

  it("strokes a dashed border along its middle", async () => {
    const root = build(`
      <div data-rect="66,120,100,40" style="border: 1px dashed rgb(200, 215, 219)"></div>`)
    await renderElementToPng(root)

    expect(ops("setLineDash")[0]!.args[0]).toEqual([3, 2])
    expect(ops("stroke")).toHaveLength(1)
  })

  it("cuts what is inside an overflow: hidden box to it, and puts the cut back afterwards", async () => {
    const root = build(`
      <div data-rect="66,120,100,40" style="overflow-x: hidden; overflow-y: hidden; border-top-left-radius: 10px">
        <span data-rect="66,120,200,20" data-words='{"Lungo":[[66,120,200,20]]}'>Lungo</span>
      </div>
      <p data-rect="66,200,100,20" data-words='{"Fuori":[[66,200,40,20]]}'>Fuori</p>`)
    await renderElementToPng(root)

    const order = calls
      .map((call) =>
        call.op === "fillText" ? `text:${call.args[0]}` : call.op,
      )
      .filter(
        (op) => ["clip", "restore"].includes(op) || op.startsWith("text:"),
      )
    const clipAt = order.indexOf("clip")
    const lungoAt = order.indexOf("text:Lungo")
    const restoreAt = order.indexOf("restore", lungoAt)
    const fuoriAt = order.indexOf("text:Fuori")
    expect(clipAt).toBeGreaterThanOrEqual(0)
    expect(clipAt).toBeLessThan(lungoAt)
    expect(restoreAt).toBeLessThan(fuoriAt)
  })

  it("paints an inset shadow inside the box, cut to it, as the frame round the hole the spread leaves", async () => {
    const root = build(`
      <span data-rect="66,120,20,16" style="background-color: rgb(255, 255, 255); box-shadow: rgb(47, 95, 160) 0px 0px 0px 1.5px inset; border-top-left-radius: 4px; border-top-right-radius: 4px; border-bottom-right-radius: 4px; border-bottom-left-radius: 4px"></span>`)
    await renderElementToPng(root)

    const frame = ops("fill").find((call) => call.args[0] === "evenodd")
    expect(frame?.state.fillStyle).toBe("rgb(47, 95, 160)")
    expect(ops("clip").length).toBeGreaterThan(0)
  })

  describe("text", () => {
    it("draws each word where the screen has it, on the baseline that splits the line's box as the font's ascent and descent do, in the element's colour", async () => {
      // 20px at 0.5em a character: "Sabato" measures 60px, as on screen.
      await renderElementToPng(
        build(
          `<h1 data-rect="66,120,358,24" style="font-size: 20px; color: rgb(16, 47, 59)" data-words='{"Sabato":[[66,120,60,24]],"PM":[[136,120,20,24]]}'>Sabato PM</h1>`,
        ),
      )

      const [sabato, pm] = texts()
      // The canvas starts at (50, 104): the word at screen (66, 120) is at
      // (16, 16). The line's box is 24 tall and the ascent is 4/5 of it, so
      // the baseline is 19.2 down.
      expect(sabato).toMatchObject({ text: "Sabato", x: 16, y: 16 + 19.2 })
      expect(pm).toMatchObject({ text: "PM", x: 86 })
      expect(sabato!.font).toContain("20px")
      expect(ops("fillText")[0]!.state.fillStyle).toBe("rgb(16, 47, 59)")
    })

    it("keeps the computed size when the words measure within 3% of their width on screen", async () => {
      // 6 × 10 = 60 against 61: 1.7% off.
      await renderElementToPng(
        build(
          `<h1 data-rect="66,120,358,24" style="font-size: 20px" data-words='{"Sabato":[[66,120,61,24]]}'>Sabato</h1>`,
        ),
      )
      expect(texts()[0]!.font).toContain("20px")
    })

    it("scales the font so a word is as wide as on screen when the canvas measures it wider or narrower (the phone's own font or text scale)", async () => {
      // The canvas says 70 for "Sabato" at 20px (advance 0.5833); the screen
      // has it at 60.
      advance = 70 / 120
      await renderElementToPng(
        build(
          `<h1 data-rect="66,120,358,24" style="font-size: 20px" data-words='{"Sabato":[[66,120,60,24]]}'>Sabato</h1>`,
        ),
      )
      const wide = Number.parseFloat(
        /(\d+(?:\.\d+)?)px/u.exec(texts()[0]!.font)![1]!,
      )
      expect(wide).toBeCloseTo(20 * (60 / 70), 1)

      calls.length = 0
      advance = 50 / 120
      await renderElementToPng(
        build(
          `<h1 data-rect="66,120,358,24" style="font-size: 20px" data-words='{"Sabato":[[66,120,60,24]]}'>Sabato</h1>`,
        ),
      )
      const narrow = Number.parseFloat(
        /(\d+(?:\.\d+)?)px/u.exec(texts()[0]!.font)![1]!,
      )
      expect(narrow).toBeCloseTo(20 * (60 / 50), 1)
    })

    it("never re-wraps: a word that the screen has on the second line is drawn on the second line, whatever the canvas thinks of the first", async () => {
      advance = 0.9
      await renderElementToPng(
        build(
          `<p data-rect="66,120,60,40" style="font-size: 10px" data-words='{"Maria":[[66,120,30,16]],"Chiara":[[66,136,36,16]]}'>Maria Chiara</p>`,
        ),
      )
      const [first, second] = texts()
      expect(first).toMatchObject({ text: "Maria", x: 16 })
      expect(second).toMatchObject({ text: "Chiara", x: 16 })
      expect(second!.y - first!.y).toBeCloseTo(16, 5)
    })

    it("draws a word the screen breaks over two lines character by character, each where the screen has it", async () => {
      await renderElementToPng(
        build(
          `<p data-rect="66,120,60,40" style="font-size: 10px" data-words='{"Giovanni":[[66,120,40,16],[66,136,5,16]],"G":[[66,120,6,16]],"i":[[72,120,3,16]],"o":[[75,120,6,16]],"v":[[81,120,6,16]],"a":[[87,120,6,16]],"n":[[93,120,6,16]]}'>Giovanni</p>`,
        ),
      )
      const written = texts()
      expect(written.map((entry) => entry.text).join("")).toBe("Giovanni")
      expect(written[0]).toMatchObject({ text: "G", x: 16 })
      expect(written[1]).toMatchObject({ text: "i", x: 22 })
    })

    it("judges a text with no whole word to measure (digits) by the height of its line box, loosely", async () => {
      // A 16px box for a font whose ascent and descent add up to 10: 1.6×.
      await renderElementToPng(
        build(
          `<span data-rect="66,120,30,16" style="font-size: 10px; font-variant-numeric: tabular-nums" data-words='{"7":[[66,120,6,16]]}'>7</span>`,
        ),
      )
      expect(texts()[0]!.font).toContain("16px")

      // One within 10% is rounding, and left alone.
      calls.length = 0
      await renderElementToPng(
        build(
          `<span data-rect="66,120,30,10.5" style="font-size: 10px; font-variant-numeric: tabular-nums" data-words='{"7":[[66,120,6,10.5]]}'>7</span>`,
        ),
      )
      expect(texts()[0]!.font).toContain("10px")
    })

    it("falls back to a plain family when the canvas will not take the page's font shorthand", async () => {
      await renderElementToPng(
        build(
          `<span data-rect="66,120,30,10" style="font-size: 10px; font-family: REJECTED" data-words='{"Resta":[[66,120,25,10]]}'>Resta</span>`,
        ),
      )
      expect(texts()[0]!.font).toMatch(/10px sans-serif$/u)
    })

    it("applies text-transform, which the DOM text does not have", async () => {
      await renderElementToPng(
        build(
          `<span data-rect="66,120,60,16" style="font-size: 10px; text-transform: uppercase" data-words='{"equipaggi":[[66,120,45,16]]}'>equipaggi</span>`,
        ),
      )
      expect(texts()[0]!.text).toBe("EQUIPAGGI")
    })

    it("sets tabular digits one by one, each centred in its own column", async () => {
      await renderElementToPng(
        build(
          `<span data-rect="66,120,30,16" style="font-size: 10px; font-variant-numeric: tabular-nums" data-words='{"115":[[66,120,18,10]],"1":[[66,120,6,10]],"5":[[78,120,6,10]]}'>115</span>`,
        ),
      )
      const written = texts()
      expect(written.map((entry) => entry.text)).toEqual(["1", "1", "5"])
      // The column is 6 wide and the digit measures 5: centred, 0.5 in.
      expect(written[0]!.x).toBeCloseTo(16.5, 5)
    })

    it("spaces the letters when the text has letter spacing", async () => {
      await renderElementToPng(
        build(
          `<span data-rect="66,120,60,16" style="font-size: 10px; letter-spacing: 1.5px" data-words='{"EQUIPAGGI":[[66,120,45,16]]}'>EQUIPAGGI</span>`,
        ),
      )
      expect(ops("fillText")[0]!.state.letterSpacing).toBe("1.5px")
    })
  })

  describe("images", () => {
    function image(
      naturalWidth: number,
      naturalHeight: number,
      complete = true,
    ) {
      const element = document.querySelector("img")!
      Object.defineProperty(element, "naturalWidth", { value: naturalWidth })
      Object.defineProperty(element, "naturalHeight", { value: naturalHeight })
      Object.defineProperty(element, "complete", { value: complete })
      return element
    }

    it("draws the live image in its box honouring object-fit and object-position", async () => {
      const root = build(
        `<img data-rect="66,120,88,36" style="object-fit: contain; object-position: 0% 50%" />`,
      )
      const logo = image(200, 100)
      await renderElementToPng(root)

      const [draw] = ops("drawImage")
      // 88 × 36 holds a 2:1 picture at 72 × 36, at the left.
      expect(draw!.args).toEqual([logo, 16, 16, 72, 36])
    })

    it("stretches by default and covers or keeps its size when asked", async () => {
      for (const [fit, expected] of [
        ["fill", [16, 16, 88, 36]],
        ["cover", [16 - 2, 16, 88 + 4, 36 + 0]],
        ["none", [16 - 56, 16 - 32, 200, 100]],
      ] as const) {
        calls.length = 0
        const root = build(
          `<img data-rect="66,120,88,36" style="object-fit: ${fit}; object-position: 50% 50%" />`,
        )
        image(200, 100)
        await renderElementToPng(root)
        const [draw] = ops("drawImage")
        if (fit === "cover") {
          // Scaled to fill 88 × 36: the larger of 0.44 and 0.36.
          expect(draw!.args.slice(3)).toEqual([88, 44])
        } else {
          expect(draw!.args.slice(1)).toEqual(expected)
        }
      }
    })

    it("leaves an image that has not loaded as an empty slot", async () => {
      const root = build(
        `<img data-rect="66,120,88,36" /><p data-rect="66,170,60,16" data-words='{"Resta":[[66,170,50,16]]}' style="font-size: 10px">Resta</p>`,
      )
      image(0, 0, false)
      await renderElementToPng(root)
      expect(ops("drawImage")).toHaveLength(0)
    })
  })

  describe("icons", () => {
    const icon = `<svg data-rect="66,120,20,20" viewBox="0 0 24 24" class="size-5" aria-hidden="true" stroke="currentColor" fill="none" stroke-width="2" style="color: rgb(11, 82, 107)"><path d="M1 1h22" /><g transform="rotate(90)"><circle cx="5" cy="5" r="2" /></g></svg>`

    it("draws an inline icon as a standalone SVG, sized to the pixels it is drawn in, with the page's colour written into it and nothing the page's CSS meant", async () => {
      const root = build(icon)
      await renderElementToPng(root)

      expect(iconSources).toHaveLength(1)
      const svg = new DOMParser().parseFromString(
        iconSources[0]!,
        "image/svg+xml",
      )
      expect(svg.querySelector("parsererror")).toBeNull()
      const outer = svg.documentElement
      expect(outer.getAttribute("width")).toBe("40")
      expect(outer.getAttribute("height")).toBe("40")
      expect(outer.getAttribute("viewBox")).toBe("0 0 24 24")
      expect(outer.getAttribute("xmlns")).toBe("http://www.w3.org/2000/svg")
      expect(outer.getAttribute("style")).toContain("color:rgb(11, 82, 107)")
      expect(outer.hasAttribute("class")).toBe(false)
      expect(outer.hasAttribute("aria-hidden")).toBe(false)
      // Geometry and transforms are kept.
      expect(svg.querySelector("path")?.getAttribute("d")).toBe("M1 1h22")
      expect(svg.querySelector("g")?.getAttribute("transform")).toBe(
        "rotate(90)",
      )
      expect(iconSources[0]).not.toContain("foreignObject")
      expect(ops("drawImage")[0]!.args.slice(1)).toEqual([16, 16, 20, 20])
    })

    it("leaves an icon out, and still makes the image, when it will not load", async () => {
      vi.stubGlobal(
        "Image",
        class {
          onerror: (() => void) | null = null
          set src(_value: string) {
            queueMicrotask(() => this.onerror?.())
          }
        },
      )
      const root = build(
        `${icon}<p data-rect="66,160,60,16" data-words='{"Resta":[[66,160,50,16]]}' style="font-size: 10px">Resta</p>`,
      )
      const png = await renderElementToPng(root)
      expect(png.type).toBe("image/png")
      expect(ops("drawImage")).toHaveLength(0)
      expect(texts().map((entry) => entry.text)).toEqual(["Resta"])
    })
  })

  it("hands the browser no copy of the page: it paints from what it read and leaves the page as it was", async () => {
    const root = build(`
      <div data-rect="66,120,358,20" style="background-color: rgb(1, 2, 3)">
        <span data-rect="66,120,50,20" data-words='{"Resta":[[66,120,50,20]]}'>Resta</span>
      </div>`)
    const before = document.body.innerHTML
    await renderElementToPng(root)
    expect(document.body.innerHTML).toBe(before)
    expect(root.getAttribute("style")).toBe("padding-top: 20px")
    expect(iconSources.join("")).not.toContain("foreignObject")
  })

  it("reads the page first and paints later: what it recorded is what it paints, whatever happens to the page meanwhile", async () => {
    const root = build(`
      <svg data-rect="66,120,20,20" viewBox="0 0 24 24"><path d="M1 1h22" /></svg>
      <p data-rect="66,160,60,16" data-words='{"Resta":[[66,160,50,16]]}' style="font-size: 10px">Resta</p>`)
    const rendering = renderElementToPng(root)
    // The icon decodes asynchronously; the page changes in the meantime.
    root.querySelector("p")!.textContent = "Cambiato"
    root.innerHTML = ""
    await rendering
    expect(texts().map((entry) => entry.text)).toEqual(["Resta"])
  })

  it("refuses an element with nothing to paint", async () => {
    document.body.innerHTML = `<div id="empty" data-rect="0,0,100,100"></div>`
    await expect(
      renderElementToPng(document.getElementById("empty")!),
    ).rejects.toThrow()
  })

  it("fails, rather than returning a wrong format, when the browser makes no PNG", async () => {
    const root = build(
      `<div data-rect="66,120,358,20" style="background-color: rgb(1, 2, 3)"></div>`,
    )
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (callback) {
        callback(null)
      },
    )
    await expect(renderElementToPng(root)).rejects.toThrow()
  })
})
