import { afterEach, describe, expect, it, vi } from "vitest"
import sharp from "sharp"
import {
  buildCrewSummaryPng,
  buildCrewSummarySvg,
  downloadCrewSummaryPng,
  type CrewSummaryLine,
  type CrewSummaryMember,
} from "./crewSummaryImage"

const parseSvg = (markup: string): XMLDocument =>
  new DOMParser().parseFromString(markup, "image/svg+xml")

const student = (
  label: string,
  overrides: Partial<CrewSummaryMember> = {},
) => ({
  label,
  isMinor: false,
  duty: null,
  ...overrides,
})

const sailingCrew = (crewNumber: number): CrewSummaryLine => ({
  category: "sailing",
  crewNumber,
  destination: `Deriva ${crewNumber}`,
  members: [student(`Allievo ${crewNumber}`)],
})

const objectUrls = new Map<string, Blob>()
let nextObjectUrl = 0
let canvasInstances: Array<{
  width: number
  height: number
  imageUrl?: string
}> = []

class TestImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  src = ""

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
  const canvases: HTMLCanvasElement[] = []
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
    canvases.push(canvas)
    return canvas
  }) as typeof document.createElement)
  canvasInstances = canvases
  return canvases
}

function stubObjectUrls() {
  nextObjectUrl = 0
  objectUrls.clear()
  const create = vi.fn((blob: Blob | MediaSource) => {
    const url = `blob:crew-summary-${nextObjectUrl++}`
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
  canvasInstances = []
  document.body.innerHTML = ""
})

describe("crew summary image layout", () => {
  it("renders one app-styled image with available, occupied, Mezzi, A terra and empty groups in order", () => {
    const markup = buildCrewSummarySvg("Sabato PM · 24 settembre", [
      {
        category: "empty",
        crewNumber: 9,
        destination: "Laser 10",
        members: [],
      },
      { category: "empty", destination: "Quest 7", members: [] },
      {
        category: "a-terra",
        members: [student("Carlo Neri", { isMinor: true, role: "CT" })],
      },
      {
        category: "mezzi",
        crewNumber: 8,
        members: [student("Daria Verdi", { role: "ADV" })],
      },
      sailingCrew(1),
      {
        category: "available",
        members: [student("Elena Bianchi", { role: "IS" })],
      },
    ])
    const parsed = parseSvg(markup)
    const sections = Array.from(
      parsed.querySelectorAll("[data-summary-section]"),
      (node) => node.getAttribute("data-summary-section"),
    )

    expect(parsed.getElementsByTagName("parsererror")).toHaveLength(0)
    expect(parsed.documentElement.getAttribute("width")).toBe("1040")
    expect(parsed.querySelector("text")?.getAttribute("font-family")).toContain(
      "system-ui",
    )
    expect(sections).toEqual([
      "available",
      "sailing",
      "mezzi",
      "a-terra",
      "empty",
    ])
    expect(parsed.documentElement.textContent).toContain("Elena Bianchi")
    expect(parsed.documentElement.textContent).toContain("Persone disponibili")
    expect(parsed.documentElement.textContent).toContain("IS")
    expect(parsed.documentElement.textContent).toContain("Equipaggio 1")
    expect(parsed.documentElement.textContent).toContain("ADV")
    expect(parsed.documentElement.textContent).toContain("CT")
    expect(parsed.documentElement.textContent).toContain("Carlo Neri")
    expect(parsed.documentElement.textContent).toContain("M")
    expect(parsed.documentElement.textContent).toContain("Barca: Laser 10")
    expect(
      parsed.querySelectorAll("g[data-summary-category='empty']"),
    ).toHaveLength(2)
    expect(
      parsed.querySelector(
        "[data-summary-section='a-terra'] g[aria-label='A terra'] path",
      ),
    ).not.toBeNull()
    const mezzo = parsed.querySelector("g[data-summary-category='mezzi']")
    expect(mezzo?.textContent).toContain("Destinazione: Mezzi")
    expect(mezzo?.textContent).not.toContain("Barca: Mezzi")
    const freeBoat = parsed.querySelector(
      "g[data-summary-category='empty'][aria-label='Barca libera']",
    )
    expect(freeBoat?.textContent).toContain("Barca: Quest 7")
    expect(freeBoat?.hasAttribute("data-crew-number")).toBe(false)
    expect(markup).not.toContain("<image")
    expect(markup).not.toContain("<foreignObject")
  })

  it("uses two balanced card columns only after twelve crew-like groups", () => {
    const twelve = parseSvg(
      buildCrewSummarySvg("12 equipaggi", [
        {
          category: "available",
          members: [student("Libero")],
        },
        ...Array.from({ length: 12 }, (_, index) => sailingCrew(index + 1)),
      ]),
    )
    const thirteen = parseSvg(
      buildCrewSummarySvg("13 equipaggi", [
        ...Array.from({ length: 13 }, (_, index) => sailingCrew(index + 1)),
      ]),
    )

    expect(twelve.documentElement.getAttribute("data-columns")).toBe("1")
    expect(twelve.documentElement.getAttribute("width")).toBe("1040")
    expect(
      twelve.querySelectorAll("g[data-summary-category='sailing']"),
    ).toHaveLength(12)
    expect(thirteen.documentElement.getAttribute("data-columns")).toBe("2")
    expect(thirteen.documentElement.getAttribute("width")).toBe("1200")
    expect(
      thirteen.querySelectorAll("g[data-summary-category='sailing']"),
    ).toHaveLength(13)
    expect(thirteen.documentElement.textContent).toContain("Allievo 13")
  })

  it("places the centered no-available note at the end and keeps long names wrapped", () => {
    const longName =
      "Alessandro Maria Della Valle " + "NomeMoltoLungo".repeat(8)
    const markup = buildCrewSummarySvg("Riepilogo", [
      sailingCrew(1),
      { category: "available", members: [] },
      {
        category: "a-terra",
        members: [student(longName, { duty: "current", isMinor: true })],
      },
    ])
    const parsed = parseSvg(markup)
    const note = parsed.querySelector("[data-all-assigned-note='true']")
    const noteY = Number(note?.getAttribute("y"))
    const imageHeight = Number(parsed.documentElement.getAttribute("height"))

    expect(parsed.getElementsByTagName("parsererror")).toHaveLength(0)
    expect(
      Array.from(parsed.querySelectorAll("[data-member-label]")).map((node) =>
        node.getAttribute("data-member-label"),
      ),
    ).toContain(longName)
    expect(note).not.toBeNull()
    expect(note?.getAttribute("fill")).toBe("#2f5fa0")
    expect(note?.getAttribute("text-anchor")).toBe("middle")
    expect(noteY).toBeGreaterThan(0)
    expect(imageHeight).toBeGreaterThan(noteY)
    expect(
      parsed.querySelector("[data-summary-section='a-terra'] svg"),
    ).toBeNull()
    expect(parsed.documentElement.textContent).toContain("C")
    expect(parsed.documentElement.textContent).toContain("M")
  })

  it("escapes XML text and replaces invalid control characters", () => {
    const markup = buildCrewSummarySvg("<Riepilogo & 'oggi'>", [
      {
        category: "available",
        members: [student("<script>alert('x')</script>\u0001")],
      },
    ])
    const parsed = parseSvg(markup)

    expect(parsed.getElementsByTagName("parsererror")).toHaveLength(0)
    expect(parsed.getElementsByTagName("script")).toHaveLength(0)
    expect(parsed.documentElement.textContent).toContain("<Riepilogo & 'oggi'>")
    expect(
      parsed
        .querySelector("[data-member-label]")
        ?.getAttribute("data-member-label"),
    ).toBe("<script>alert('x')</script>\uFFFD")
  })
})

describe("crew summary PNG export", () => {
  it("decodes as a complete 2× PNG with rendered text and the full two-column roster", async () => {
    stubObjectUrls()
    stubPngCanvas()
    const lines: CrewSummaryLine[] = [
      {
        category: "available",
        members: [student("Allievo libero", { isMinor: true })],
      },
      ...Array.from({ length: 13 }, (_, index) => ({
        ...sailingCrew(index + 1),
        members: [
          student(`Allievo ${index + 1}`, {
            role: index === 0 ? "CT" : null,
            duty: index === 1 ? "current" : null,
            isMinor: index === 2,
          }),
        ],
      })),
      {
        category: "a-terra",
        members: [student("Allieva a terra", { duty: "smontante" })],
      },
      {
        category: "empty",
        crewNumber: 15,
        destination: "Quest 4",
        members: [],
      },
    ]

    const png = await buildCrewSummaryPng("Sabato PM", lines)
    const bytes = Buffer.from(await png.arrayBuffer())
    const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    })

    expect(png.type).toBe("image/png")
    expect(bytes.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
    expect(decoded.info.width).toBe(2400)
    expect(decoded.info.height).toBeGreaterThan(1000)
    expect(canvasInstances[0]).toMatchObject({ width: 2400 })
    expect(objectUrls.size).toBe(0)

    const image = sharp(bytes)
    const titlePixels = await image
      .clone()
      .extract({ left: 40, top: 80, width: 700, height: 70 })
      .raw()
      .toBuffer()
    let titleInkPixels = 0
    for (let index = 0; index < titlePixels.length; index += 4) {
      if (
        (titlePixels[index] ?? 255) < 80 &&
        (titlePixels[index + 1] ?? 255) < 130 &&
        (titlePixels[index + 2] ?? 255) < 180
      ) {
        titleInkPixels += 1
      }
    }
    expect(titleInkPixels).toBeGreaterThan(20)
    expect(lines.length).toBe(16)
  })

  it("downloads a real PNG with a safe filename and releases both temporary URLs", async () => {
    vi.useFakeTimers()
    const { create, revoke } = stubObjectUrls()
    stubPngCanvas()
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined)

    await downloadCrewSummaryPng("Uscita 24 settembre!", [sailingCrew(1)], {
      pixelRatio: 1,
    })

    expect(create).toHaveBeenCalledTimes(2)
    expect(click).toHaveBeenCalledOnce()
    expect(
      document.querySelector("a[download='uscita-24-settembre.png']"),
    ).toBeNull()
    expect(revoke).toHaveBeenCalledWith("blob:crew-summary-0")
    expect(revoke).not.toHaveBeenCalledWith("blob:crew-summary-1")
    vi.advanceTimersByTime(1000)
    expect(revoke).toHaveBeenCalledWith("blob:crew-summary-1")
  })
})
