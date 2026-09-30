import { afterEach, describe, expect, it, vi } from "vitest"
import sharp from "sharp"
import {
  BOAT_TYPE_CLASS_COLORS,
  MEZZI_CLASS_COLOR,
  type BoatType,
} from "@/domain/config"
import { GOMMONE_HULL_PATHS } from "@/features/boats/boatMarks"
import {
  ACCENT,
  IMAGE_LOAD_TIMEOUT_MS,
  MAX_CANVAS_PIXELS,
  MUTED,
  NAME_FONT,
  estimateTextWidth,
} from "@/lib/summaryImage"
import {
  buildCrewSummaryPng,
  buildCrewSummarySvg,
  crewNumberColumn,
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

/** The card's own geometry and text, read back from the markup. */
function readCard(parsed: XMLDocument, crewNumber: number) {
  const card = parsed.querySelector(
    `[data-summary-crew-number="${crewNumber}"]`,
  )
  if (!card) throw new Error(`No card for crew ${crewNumber}`)
  const frame = card.querySelector('rect[fill="#ffffff"]')!
  const x = Number(frame.getAttribute("x"))
  const width = Number(frame.getAttribute("width"))
  const directText = Array.from(card.querySelectorAll(":scope > text"))
  const lines = Array.from(
    card.querySelectorAll("[data-member-label] > text"),
    (node) => ({
      text: node.textContent ?? "",
      x: Number(node.getAttribute("x")),
      y: Number(node.getAttribute("y")),
    }),
  )
  const badge = card.querySelector('[aria-label^="Avviso"] rect')
  return {
    card,
    x,
    width,
    /** Where the text area ends: the card's right edge less its padding. */
    textRight: x + width - 24,
    number: directText[0]!,
    lines,
    badgeX: badge ? Number(badge.getAttribute("x")) : null,
  }
}

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
    // The available people come first (spec §7.5), then the crews, A terra
    // and the empty boats last.
    expect(blocks).toEqual([
      "Persone disponibili",
      "boat",
      "mezzi",
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

  it("closes on a small centred accent-blue note when no student is left available, and opens with the available people when one is", () => {
    const groups = [
      boatGroup("RS Quest", [
        crewLine({
          crewId: "c1",
          crewNumber: 1,
          destination: "boat",
          boat: { type: "RS Quest", number: "2" },
          members: [member("Aldo")],
        }),
      ]),
    ]

    // No student available: nobody, or only volunteers.
    for (const availableMembers of [
      [],
      [member("Vera ADV", { role: "ADV" })],
    ]) {
      const parsed = parseSvg(
        buildCrewSummarySvg(
          sections({ groups, availableMembers, landMembers: [member("Bea")] }),
        ),
      )
      const note = parsed.querySelector("[data-all-assigned-note]")
      expect(note?.textContent).toBe("Tutti gli allievi assegnati")
      expect(note?.getAttribute("text-anchor")).toBe("middle")
      expect(note?.getAttribute("x")).toBe("540")
      expect(note?.getAttribute("fill")).toBe(ACCENT)
      // It closes the summary: the last drawn element, below every block.
      expect(parsed.documentElement.lastElementChild).toBe(note)
      const noteY = Number(note?.getAttribute("y"))
      for (const other of Array.from(
        parsed.querySelectorAll("g[data-summary-crew-number] text"),
      )) {
        expect(Number(other.getAttribute("y"))).toBeLessThan(noteY)
      }
      expect(noteY).toBeLessThan(
        Number(parsed.documentElement.getAttribute("height")),
      )
    }

    // A student still available: the list leads and there is no note.
    const open = parseSvg(
      buildCrewSummarySvg(
        sections({ groups, availableMembers: [member("Libero")] }),
      ),
    )
    expect(open.querySelector("[data-all-assigned-note]")).toBeNull()
    const firstBlock = open.querySelector(
      "[data-summary-group],[data-summary-section]",
    )
    expect(firstBlock?.getAttribute("data-summary-section")).toBe(
      "Persone disponibili",
    )
  })

  it("lists a boat-less crew in its session's one model as '<model> · Senza barca', with a muted dash and the model's own colours", () => {
    const model = sections({
      groups: [
        boatGroup("RS Quest", [
          crewLine({
            crewId: "c1",
            crewNumber: 1,
            destination: "boat",
            boat: { type: "RS Quest", number: "2" },
            inferredBoatType: "RS Quest",
            members: [member("Aldo")],
          }),
          crewLine({
            crewId: "c2",
            crewNumber: 2,
            destination: "unassigned",
            inferredBoatType: "RS Quest",
            warning: { severity: "yellow", count: 1 },
            members: [member("Bea"), member("Carlo")],
          }),
        ]),
      ],
    })

    const parsed = parseSvg(buildCrewSummarySvg(model))
    const withBoat = readCard(parsed, 1)
    const modelOnly = readCard(parsed, 2)

    // Under the RS Quest heading, not a group of its own.
    expect(
      Array.from(parsed.querySelectorAll("[data-summary-group]"), (node) =>
        node.getAttribute("data-summary-group"),
      ),
    ).toEqual(["boat"])
    expect(modelOnly.card.getAttribute("aria-label")).toBe(
      "Equipaggio 2, RS Quest · Senza barca",
    )
    // The caption may wrap; its lines together are the words.
    const captionLines = Array.from(
      modelOnly.card.querySelectorAll("[data-summary-caption]"),
    )
    expect(captionLines.map((node) => node.textContent).join(" ")).toBe(
      "RS Quest · Senza barca",
    )
    for (const node of captionLines) {
      expect(node.getAttribute("fill")).toBe(MUTED)
    }
    expect(withBoat.card.querySelector("[data-summary-caption]")).toBeNull()
    // The muted mark, not the model's colour a real number wears.
    expect(modelOnly.number.textContent).toBe("–")
    expect(modelOnly.number.getAttribute("fill")).toBe(MUTED)
    expect(withBoat.number.getAttribute("fill")).toBe(
      BOAT_TYPE_CLASS_COLORS["RS Quest"],
    )
    // The card still carries its model's colour on the edge.
    expect(
      modelOnly.card.querySelector("rect[clip-path]")?.getAttribute("fill"),
    ).toBe(BOAT_TYPE_CLASS_COLORS["RS Quest"])
    // The names start below the caption, and the warning badge (beside the
    // caption) leaves them room.
    expect(modelOnly.lines[0]!.y).toBeGreaterThan(
      Number(captionLines.at(-1)?.getAttribute("y")),
    )
    expect(modelOnly.badgeX).not.toBeNull()
    for (const node of captionLines) {
      expect(
        Number(node.getAttribute("x")) +
          estimateTextWidth(node.textContent ?? "", 22),
      ).toBeLessThanOrEqual(modelOnly.badgeX!)
    }
  })

  it("names a boat model outside the known list in a trailing group, never dropping its crews", () => {
    const model = sections({
      groups: [
        {
          kind: "other-model",
          modelName: "Hobie 16",
          lines: [
            crewLine({
              crewId: "c1",
              crewNumber: 1,
              destination: "boat",
              boat: { type: "Hobie 16", number: "3" },
              members: [member("Aldo")],
            }),
          ],
        },
      ],
    })

    const parsed = parseSvg(buildCrewSummarySvg(model))
    expect(
      parsed.querySelector('[data-summary-group="other-model"]')?.textContent,
    ).toContain("Hobie 16")
    const card = readCard(parsed, 1)
    expect(card.number.textContent).toBe("3")
    expect(card.card.getAttribute("aria-label")).toBe(
      "Equipaggio 1, Hobie 16 3",
    )
  })

  describe("boat-number column", () => {
    const groupOf = (numbers: string[]) =>
      boatGroup(
        "RS Toura",
        numbers.map((number, index) =>
          crewLine({
            crewId: `c${index + 1}`,
            crewNumber: index + 1,
            destination: "boat",
            boat: { type: "RS Toura", number },
            members: [member("Elena"), member("Marco")],
          }),
        ),
      )
    const nameOffset = (parsed: XMLDocument, crewNumber: number) => {
      const card = readCard(parsed, crewNumber)
      return card.lines[0]!.x - Number(card.number.getAttribute("x"))
    }

    it("keeps today's 92px column for one- and two-digit numbers", () => {
      const parsed = parseSvg(
        buildCrewSummarySvg(sections({ groups: [groupOf(["4", "7", "12"])] })),
      )

      for (const crewNumber of [1, 2, 3]) {
        expect(nameOffset(parsed, crewNumber)).toBe(92)
      }
      expect(crewNumberColumn(groupOf(["4", "12"]).lines, 432)).toEqual({
        width: 92,
        fontSize: 54,
      })
    })

    it.each([["115"], ["1234"], ["A12"]])(
      "widens it for %s so the number stays clear of the first name, for every card of the group",
      (longNumber) => {
        const group = groupOf(["4", longNumber, "12"])
        const parsed = parseSvg(
          buildCrewSummarySvg(sections({ groups: [group] })),
        )

        const offsets = [1, 2, 3].map((crewNumber) =>
          nameOffset(parsed, crewNumber),
        )
        // Wider than today, and identical on every card so names line up.
        expect(offsets[0]).toBeGreaterThan(92)
        expect(new Set(offsets).size).toBe(1)
        for (const crewNumber of [1, 2, 3]) {
          const card = readCard(parsed, crewNumber)
          const numberX = Number(card.number.getAttribute("x"))
          const numberSize = Number(card.number.getAttribute("font-size"))
          expect(numberSize).toBe(54)
          expect(
            numberX +
              estimateTextWidth(card.number.textContent ?? "", numberSize),
          ).toBeLessThanOrEqual(card.lines[0]!.x)
          // The names still fit the card.
          for (const line of card.lines) {
            expect(
              line.x + estimateTextWidth(line.text, NAME_FONT),
            ).toBeLessThanOrEqual(card.textRight)
          }
        }
      },
    )

    it("does not widen the column of another group", () => {
      const parsed = parseSvg(
        buildCrewSummarySvg(
          sections({
            groups: [
              groupOf(["1234"]),
              boatGroup("RS Quest", [
                crewLine({
                  crewId: "q",
                  crewNumber: 9,
                  destination: "boat",
                  boat: { type: "RS Quest", number: "2" },
                  members: [member("Elena")],
                }),
              ]),
            ],
          }),
        ),
      )
      expect(nameOffset(parsed, 9)).toBe(92)
    })

    it("shrinks a number too long for even the capped column instead of running it into the names", () => {
      const column = crewNumberColumn(groupOf(["A1234567890"]).lines, 432)
      expect(column.width).toBeLessThanOrEqual(432 * 0.45)
      expect(column.fontSize).toBeLessThan(54)
      expect(column.fontSize).toBeGreaterThanOrEqual(20)
      expect(
        estimateTextWidth("A1234567890", column.fontSize),
      ).toBeLessThanOrEqual(column.width)
    })
  })

  describe("long names on a card with a warning badge", () => {
    it.each([
      ["FRANCESCA BIANCHI"],
      ["GIANFRANCESCOANTONIO"],
      ["WWWWWWWWWWWW"],
    ])(
      "keeps %s inside the card and its first line clear of the badge",
      (name) => {
        const model = sections({
          groups: [
            boatGroup("RS Toura", [
              crewLine({
                crewId: "c1",
                crewNumber: 1,
                destination: "boat",
                boat: { type: "RS Toura", number: "4" },
                warning: { severity: "yellow", count: 1 },
                members: [member(name), member("Elena")],
              }),
              crewLine({
                crewId: "c2",
                crewNumber: 2,
                destination: "boat",
                boat: { type: "RS Toura", number: "5" },
                warning: { severity: "red", count: 2 },
                members: [member(name, { isMinor: true, duty: "current" })],
              }),
            ]),
          ],
        })

        const parsed = parseSvg(buildCrewSummarySvg(model))
        for (const crewNumber of [1, 2]) {
          const card = readCard(parsed, crewNumber)
          expect(card.badgeX, `crew ${crewNumber}`).not.toBeNull()
          const firstLine = card.lines[0]!
          // The first name line stops before the badge…
          expect(
            firstLine.x + estimateTextWidth(firstLine.text, NAME_FONT),
          ).toBeLessThanOrEqual(card.badgeX!)
          // …and no line, of any name, runs past the card's text area.
          for (const line of card.lines) {
            expect(
              line.x + estimateTextWidth(line.text, NAME_FONT),
              line.text,
            ).toBeLessThanOrEqual(card.textRight)
          }
        }
        // Every letter of the name is still drawn, in order, ahead of the
        // second member's own line.
        const crewLines = readCard(parsed, 1).lines.map((line) => line.text)
        expect(crewLines.at(-1)).toBe("Elena")
        expect(crewLines.slice(0, -1).join("").replace(/\s/gu, "")).toBe(
          name.replace(/\s/gu, ""),
        )
      },
    )

    it("leaves a card without a warning its full first-line width", () => {
      const build = (warning: CrewSummaryCrewLine["warning"]) =>
        parseSvg(
          buildCrewSummarySvg(
            sections({
              groups: [
                boatGroup("RS Toura", [
                  crewLine({
                    crewId: "c1",
                    crewNumber: 1,
                    destination: "boat",
                    boat: { type: "RS Toura", number: "4" },
                    warning,
                    members: [member("WWWWWWWWWW")],
                  }),
                ]),
              ],
            }),
          ),
        )
      const plain = readCard(build(null), 1).lines
      const warned = readCard(build({ severity: "red", count: 1 }), 1).lines
      expect(warned.length).toBeGreaterThan(plain.length)
    })
  })

  it("clips every card's class-colour edge to the card's rounded corners", () => {
    const model = sections({
      groups: [
        boatGroup("RS Toura", [
          crewLine({
            crewId: "c1",
            crewNumber: 1,
            destination: "boat",
            boat: { type: "RS Toura", number: "4" },
            members: [member("Elena")],
          }),
          crewLine({
            crewId: "c2",
            crewNumber: 2,
            destination: "boat",
            boat: { type: "RS Toura", number: "5" },
            members: [member("Marco")],
          }),
        ]),
        {
          kind: "mezzi",
          lines: [
            crewLine({
              crewId: "c3",
              crewNumber: 3,
              destination: "mezzi",
              members: [member("Noemi")],
            }),
          ],
        },
      ],
    })

    const parsed = parseSvg(buildCrewSummarySvg(model))
    const ids = new Set<string>()
    for (const crewNumber of [1, 2, 3]) {
      const { card } = readCard(parsed, crewNumber)
      const clip = card.querySelector("clipPath")
      const id = clip?.getAttribute("id")
      expect(id).toBeTruthy()
      ids.add(id!)
      expect(clip?.querySelector("rect")?.getAttribute("rx")).toBe("24")
      expect(
        card.querySelector("rect[clip-path]")?.getAttribute("clip-path"),
      ).toBe(`url(#${id})`)
    }
    // One clip per card: ids never collide within the image.
    expect(ids.size).toBe(3)
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

  describe("pixel budget", () => {
    const crews = (count: number, membersPerCrew: number) =>
      boatGroup(
        "RS Toura",
        Array.from({ length: count }, (_, index) =>
          crewLine({
            crewId: `c${index + 1}`,
            crewNumber: index + 1,
            destination: "boat",
            boat: { type: "RS Toura", number: String(index + 1) },
            members: Array.from({ length: membersPerCrew }, (_, person) =>
              member(`Allievo ${index + 1}.${person + 1}`),
            ),
          }),
        ),
      )

    it("keeps the 2× density for a 13-crew course", async () => {
      stubObjectUrls()
      const canvases = stubPngCanvas()

      await buildCrewSummaryPng(sections({ groups: [crews(13, 2)] }))

      const output = canvases.at(-1)!
      expect(output.width).toBe(2160)
      expect(output.width * output.height).toBeLessThanOrEqual(
        MAX_CANVAS_PIXELS,
      )
    })

    it("lowers the density for 45 four-person crews so the canvas stays under iOS Safari's limit, and still draws every pixel of the image", async () => {
      stubObjectUrls()
      const canvases = stubPngCanvas()
      const model = sections({ groups: [crews(45, 4)] })
      const logicalHeight = Number(
        parseSvg(buildCrewSummarySvg(model)).documentElement.getAttribute(
          "height",
        ),
      )
      // At a flat 2× this course would be well past the budget.
      expect(2160 * logicalHeight * 2).toBeGreaterThan(MAX_CANVAS_PIXELS)

      const png = await buildCrewSummaryPng(model)
      const bytes = Buffer.from(await png.arrayBuffer())
      const decoded = await sharp(bytes).metadata()

      const output = canvases.at(-1)!
      expect(output.width).toBeLessThan(2160)
      expect(output.width).toBeGreaterThan(1080)
      expect(output.width * output.height).toBeLessThanOrEqual(
        MAX_CANVAS_PIXELS,
      )
      // The whole image is drawn at the lower density, not cropped.
      expect(output.height / output.width).toBeCloseTo(logicalHeight / 1080, 2)
      expect(decoded.width).toBe(output.width)
      expect(decoded.height).toBe(output.height)
    }, 60_000)
  })

  it("falls back to the model name when a logo does not answer within the timeout, and still produces the PNG", async () => {
    vi.useFakeTimers()
    const { create } = stubObjectUrls()
    stubPngCanvas()
    // Logos never load; the SVG blob (the only `blob:` URL) loads at once.
    class StalledLogoImage extends TestImage {
      private shown = ""
      constructor() {
        super()
        Object.defineProperty(this, "src", {
          configurable: true,
          get: () => this.shown,
          set: (value: string) => {
            this.shown = value
            if (value.startsWith("blob:")) queueMicrotask(() => this.onload?.())
          },
        })
      }
    }
    vi.stubGlobal("Image", StalledLogoImage)
    const model = sections({
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

    let finished = false
    const pending = buildCrewSummaryPng(model).then((png) => {
      finished = true
      return png
    })
    await vi.advanceTimersByTimeAsync(IMAGE_LOAD_TIMEOUT_MS - 1)
    expect(finished).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    const png = await pending

    expect(png.type).toBe("image/png")
    const svgBlob = create.mock.calls[0]![0] as Blob
    const markup = Buffer.from(await svgBlob.arrayBuffer()).toString("utf8")
    expect(markup).not.toContain("<image")
    expect(markup).toContain(">RS Toura</text>")
  })
})
