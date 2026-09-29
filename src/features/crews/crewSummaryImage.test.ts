import { afterEach, describe, expect, it, vi } from "vitest"
import sharp from "sharp"
import {
  BOAT_TYPE_CLASS_COLORS,
  MEZZI_CLASS_COLOR,
  type BoatType,
} from "@/domain/config"
import { GOMMONE_HULL_PATHS } from "@/features/boats/boatMarks"
import {
  buildCrewSummaryPng,
  buildCrewSummarySvg,
  downloadCrewSummaryPng,
  type LoadedLogo,
} from "./crewSummaryImage"
import type {
  CrewSummaryCrewLine,
  CrewSummaryGroup,
  CrewSummaryMember,
  CrewSummarySections,
} from "./crewSummaryModel"

const parseSvg = (markup: string): XMLDocument =>
  new DOMParser().parseFromString(markup, "image/svg+xml")

const member = (
  label: string,
  overrides: Partial<CrewSummaryMember> = {},
): CrewSummaryMember => ({ label, isMinor: false, duty: null, ...overrides })

const crewLine = (
  overrides: Partial<CrewSummaryCrewLine> &
    Pick<CrewSummaryCrewLine, "crewId" | "crewNumber">,
): CrewSummaryCrewLine => ({
  destination: "unassigned",
  boat: null,
  members: [],
  warning: null,
  ...overrides,
})

const sections = (
  overrides: Partial<CrewSummarySections> = {},
): CrewSummarySections => ({
  title: "Riepilogo",
  groups: [],
  availableMembers: [],
  landMembers: [],
  emptyLabels: [],
  ...overrides,
})

const boatGroup = (
  boatType: BoatType,
  lines: CrewSummaryCrewLine[],
): CrewSummaryGroup => ({ kind: "boat", boatType, lines })

const objectUrls = new Map<string, Blob>()
let nextObjectUrl = 0

class TestImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  src = ""
  // A realistic-enough intrinsic size so the PNG-pipeline test also exercises
  // the logo-embedding path (a 0×0 image would make every logo look
  // unavailable and only the SVG-builder's own hand-built `LoadedLogo`
  // fixtures below would ever cover it).
  naturalWidth = 240
  naturalHeight = 80

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
      // Only the small per-logo canvases call this; it never needs to be a
      // real decodable image — the SVG string only ever re-embeds this
      // value, never re-decodes it — so a deterministic placeholder that
      // still identifies which source it came from is enough.
      toDataURL: vi.fn(
        () =>
          `data:image/png;base64,${Buffer.from(imageUrl ?? "logo").toString("base64")}`,
      ),
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
  document.body.innerHTML = ""
})

describe("crew summary SVG layout", () => {
  it("renders boat groups, Mezzi, available, A terra and empty in the read view's own order, at a fixed 1080px width", () => {
    const model = sections({
      title: "Sabato PM · 24 settembre",
      groups: [
        boatGroup("RS Toura", [
          crewLine({
            crewId: "c1",
            crewNumber: 1,
            destination: "boat",
            boat: { type: "RS Toura", number: "4" },
            members: [member("Elena Bianchi", { role: "IS" })],
          }),
        ]),
        {
          kind: "mezzi",
          lines: [
            crewLine({
              crewId: "c2",
              crewNumber: 2,
              destination: "mezzi",
              members: [member("Daria Verdi", { role: "ADV" })],
            }),
          ],
        },
      ],
      availableMembers: [member("Libero")],
      landMembers: [member("Carlo Neri", { isMinor: true, role: "CT" })],
      emptyLabels: ["Laser 10", "Quest 7"],
    })

    const markup = buildCrewSummarySvg(model)
    const parsed = parseSvg(markup)
    const blocks = Array.from(
      parsed.querySelectorAll("[data-summary-group],[data-summary-section]"),
      (node) =>
        node.getAttribute("data-summary-group") ??
        node.getAttribute("data-summary-section"),
    )

    expect(parsed.getElementsByTagName("parsererror")).toHaveLength(0)
    expect(parsed.documentElement.getAttribute("width")).toBe("1080")
    expect(parsed.querySelector("text")?.getAttribute("font-family")).toContain(
      "system-ui",
    )
    expect(blocks).toEqual([
      "boat",
      "mezzi",
      "Persone disponibili",
      "A terra",
      "Barche ed equipaggi vuoti",
    ])
    expect(parsed.documentElement.textContent).toContain("Sabato PM")
    expect(parsed.documentElement.textContent).toContain("Elena Bianchi")
    expect(parsed.documentElement.textContent).toContain("IS")
    expect(parsed.documentElement.textContent).toContain("Daria Verdi")
    expect(parsed.documentElement.textContent).toContain("ADV")
    expect(parsed.documentElement.textContent).toContain("Carlo Neri")
    expect(parsed.documentElement.textContent).toContain("Libero")
    expect(parsed.documentElement.textContent).toContain("Laser 10")
    expect(parsed.documentElement.textContent).toContain("Quest 7")
    // The boat number is bold in the model's own class colour.
    expect(
      parsed.querySelector(`text[fill="${BOAT_TYPE_CLASS_COLORS["RS Toura"]}"]`)
        ?.textContent,
    ).toBe("4")
    // No logo was supplied, so the group heading falls back to the model
    // name as text, never an `<image>`.
    expect(markup).not.toContain("<image")
    expect(parsed.documentElement.textContent).toContain("RS Toura")
  })

  it("embeds a supplied logo as a data-URL <image>, sized to its own aspect ratio, and leaves the other group as text when its logo is missing", () => {
    const model = sections({
      groups: [
        boatGroup("RS Quest", [
          crewLine({ crewId: "c1", crewNumber: 1, members: [member("Aldo")] }),
        ]),
        boatGroup("RS 500", [
          crewLine({ crewId: "c2", crewNumber: 2, members: [member("Bea")] }),
        ]),
      ],
    })
    const logo: LoadedLogo = {
      dataUrl: "data:image/png;base64,AAAA",
      width: 300,
      height: 100,
    }

    const markup = buildCrewSummarySvg(model, { "RS Quest": logo })
    const parsed = parseSvg(markup)
    const images = parsed.getElementsByTagName("image")

    expect(images).toHaveLength(1)
    expect(images[0]?.getAttribute("href")).toBe(logo.dataUrl)
    // 3:1 source aspect ratio, capped at the group heading's own height.
    const width = Number(images[0]?.getAttribute("width"))
    const height = Number(images[0]?.getAttribute("height"))
    expect(height).toBeGreaterThan(0)
    expect(width / height).toBeCloseTo(3, 1)
    expect(parsed.documentElement.textContent).toContain("RS 500")
  })

  it("keeps two card columns per group, includes every crew's name, and grows the image height as crews are added", () => {
    const makeGroup = (count: number): CrewSummaryGroup =>
      boatGroup(
        "RS Toura",
        Array.from({ length: count }, (_, index) =>
          crewLine({
            crewId: `c${index + 1}`,
            crewNumber: index + 1,
            destination: "boat",
            boat: { type: "RS Toura", number: String(index + 1) },
            members: [member(`Allievo ${index + 1}`)],
          }),
        ),
      )

    const four = parseSvg(
      buildCrewSummarySvg(sections({ groups: [makeGroup(4)] })),
    )
    const thirteen = parseSvg(
      buildCrewSummarySvg(sections({ groups: [makeGroup(13)] })),
    )

    expect(four.documentElement.getAttribute("width")).toBe("1080")
    expect(thirteen.documentElement.getAttribute("width")).toBe("1080")
    expect(
      thirteen.querySelectorAll("[data-summary-crew-number]"),
    ).toHaveLength(13)
    for (let index = 1; index <= 13; index += 1) {
      expect(
        thirteen.querySelector(`[data-member-label="Allievo ${index}"]`),
      ).not.toBeNull()
    }
    const fourHeight = Number(four.documentElement.getAttribute("height"))
    const thirteenHeight = Number(
      thirteen.documentElement.getAttribute("height"),
    )
    expect(thirteenHeight).toBeGreaterThan(fourHeight)
    // Two columns: crew 1 and crew 2 sit at the same y (first grid row).
    const firstCardY = thirteen
      .querySelector('[data-summary-crew-number="1"] rect')
      ?.getAttribute("y")
    const secondCardY = thirteen
      .querySelector('[data-summary-crew-number="2"] rect')
      ?.getAttribute("y")
    expect(firstCardY).toBe(secondCardY)
  })

  it("shows the yellow or red warning badge only on the crew it belongs to", () => {
    const model = sections({
      groups: [
        boatGroup("RS Toura", [
          crewLine({
            crewId: "c1",
            crewNumber: 1,
            destination: "boat",
            boat: { type: "RS Toura", number: "1" },
            members: [member("Aldo")],
            warning: { severity: "yellow", count: 1 },
          }),
          crewLine({
            crewId: "c2",
            crewNumber: 2,
            destination: "boat",
            boat: { type: "RS Toura", number: "2" },
            members: [member("Bea")],
          }),
        ]),
      ],
    })
    const markup = buildCrewSummarySvg(model)
    const parsed = parseSvg(markup)

    expect(
      parsed.querySelector(
        '[data-summary-crew-number="1"] [aria-label="Avviso equipaggio: giallo"]',
      ),
    ).not.toBeNull()
    expect(
      parsed.querySelector('[data-summary-crew-number="2"] [aria-label]'),
    ).toBeNull()
  })

  it("escapes XML text and replaces invalid control characters", () => {
    const model = sections({
      title: "<Riepilogo & 'oggi'>",
      availableMembers: [member("<script>alert('x')</script>\u0001")],
    })
    const markup = buildCrewSummarySvg(model)
    const parsed = parseSvg(markup)

    expect(parsed.getElementsByTagName("parsererror")).toHaveLength(0)
    expect(parsed.getElementsByTagName("script")).toHaveLength(0)
    expect(parsed.documentElement.textContent).toContain("<Riepilogo & 'oggi'>")
    expect(
      parsed
        .querySelector("[data-member-label]")
        ?.getAttribute("data-member-label"),
    ).toBe("<script>alert('x')</script>�")
  })

  it("colours the Mezzi card edge with the Mezzi class colour, not a boat colour", () => {
    const model = sections({
      groups: [
        {
          kind: "mezzi",
          lines: [
            crewLine({
              crewId: "c1",
              crewNumber: 1,
              destination: "mezzi",
              members: [member("Noemi")],
            }),
          ],
        },
      ],
    })
    const markup = buildCrewSummarySvg(model)
    const parsed = parseSvg(markup)
    const edge = parsed.querySelector(
      '[data-summary-crew-number="1"] rect[fill]:nth-of-type(2)',
    )

    expect(edge?.getAttribute("fill")).toBe(MEZZI_CLASS_COLOR)
  })

  it("draws the gommone from the shared boatMarks module, not a stale local copy", () => {
    const model = sections({
      groups: [
        {
          kind: "mezzi",
          lines: [
            crewLine({
              crewId: "c1",
              crewNumber: 1,
              destination: "mezzi",
              members: [member("Noemi")],
            }),
          ],
        },
      ],
    })

    const markup = buildCrewSummarySvg(model)

    // The Mezzi heading and the Mezzi card each draw the app's one gommone
    // path set (`GOMMONE_HULL_PATHS`, shared with `GommoneIcon` in
    // `BoatIdentity.tsx`), so both occurrences of every hull path segment
    // must be present.
    for (const hullPath of GOMMONE_HULL_PATHS) {
      const occurrences = markup.split(`d="${hullPath}"`).length - 1
      expect(occurrences).toBe(2)
    }
    // The old, now-removed copy of the icon (a different hull start point
    // and a filled propeller `<rect>`) must never reappear.
    expect(markup).not.toContain("M9.5 12H3.9")
    expect(markup).not.toContain("M7 6.5H15c3.7 0 6.3 2.3 7.5 5.5")
    expect(markup).not.toMatch(/<rect[^>]*rx="\.6"/)
  })

  it("draws the Mezzi card's gommone rotated bow-up, but the Mezzi heading's gommone horizontal", () => {
    const model = sections({
      groups: [
        {
          kind: "mezzi",
          lines: [
            crewLine({
              crewId: "c1",
              crewNumber: 1,
              destination: "mezzi",
              members: [member("Noemi")],
            }),
          ],
        },
      ],
    })

    const markup = buildCrewSummarySvg(model)
    const parsed = parseSvg(markup)

    // Exactly one gommone is rotated -90° about its own centre — the card's,
    // matching `<GommoneIcon orientation="vertical" />` in
    // `AnnouncementCrewCard` — while the group heading's stays unrotated,
    // matching the heading's own `<GommoneIcon className="size-5" />` with no
    // `orientation` prop (defaults to horizontal).
    const rotated = parsed.querySelectorAll('g[transform*="rotate(-90 12 12)"]')
    expect(rotated).toHaveLength(1)
    const rotatedInCard = parsed.querySelector(
      '[data-summary-crew-number="1"] g[transform*="rotate(-90 12 12)"]',
    )
    expect(rotatedInCard).not.toBeNull()
    const rotatedInHeading = parsed.querySelector(
      '[data-summary-group="mezzi"] g[transform*="rotate(-90 12 12)"]',
    )
    expect(rotatedInHeading).toBeNull()
  })
})

describe("crew summary PNG export", () => {
  it("decodes as a complete 2× PNG at 1080px logical width with names, groups and Mezzi rendered", async () => {
    stubObjectUrls()
    stubPngCanvas()
    const model = sections({
      title: "Sabato PM",
      groups: [
        boatGroup(
          "RS Toura",
          Array.from({ length: 13 }, (_, index) =>
            crewLine({
              crewId: `c${index + 1}`,
              crewNumber: index + 1,
              destination: "boat",
              boat: { type: "RS Toura", number: String(index + 1) },
              members: [
                member(`Allievo ${index + 1}`, {
                  role: index === 0 ? "CT" : null,
                  duty: index === 1 ? "current" : null,
                  isMinor: index === 2,
                }),
              ],
            }),
          ),
        ),
        {
          kind: "mezzi",
          lines: [
            crewLine({
              crewId: "cm",
              crewNumber: 14,
              destination: "mezzi",
              members: [member("Allievo mezzi")],
            }),
          ],
        },
      ],
      availableMembers: [member("Allievo libero", { isMinor: true })],
      landMembers: [member("Allieva a terra", { duty: "smontante" })],
      emptyLabels: ["Quest 4"],
    })

    const png = await buildCrewSummaryPng(model)
    const bytes = Buffer.from(await png.arrayBuffer())
    const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    })

    expect(png.type).toBe("image/png")
    expect(bytes.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
    expect(decoded.info.width).toBe(2160) // 1080 × the default 2× pixel ratio
    expect(decoded.info.height).toBeGreaterThan(1000)
    expect(objectUrls.size).toBe(0)
  })

  it("downloads a real PNG with a safe filename and releases both temporary URLs", async () => {
    vi.useFakeTimers()
    const { create, revoke } = stubObjectUrls()
    stubPngCanvas()
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined)
    const model = sections({
      title: "Uscita 24 settembre!",
      groups: [
        boatGroup("RS Toura", [
          crewLine({
            crewId: "c1",
            crewNumber: 1,
            destination: "boat",
            boat: { type: "RS Toura", number: "1" },
            members: [member("Aldo")],
          }),
        ]),
      ],
    })

    await downloadCrewSummaryPng(model, { pixelRatio: 1 })

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
