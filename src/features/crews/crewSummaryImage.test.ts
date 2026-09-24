import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildCrewSummarySvg,
  downloadCrewSummarySvg,
  type CrewSummaryLine,
} from "./crewSummaryImage"

const parseSvg = (markup: string): XMLDocument =>
  new DOMParser().parseFromString(markup, "image/svg+xml")

const crew = (crewNumber: number): CrewSummaryLine => ({
  crewNumber,
  destination: "Deriva",
  members: [{ label: `Allievo ${crewNumber}`, isMinor: false, duty: null }],
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ""
})

describe("crew summary SVG", () => {
  it("builds a valid, self-contained white SVG with crew and member text", () => {
    const svg = buildCrewSummarySvg("Uscita del 24 settembre", [
      {
        crewNumber: 3,
        destination: "Deriva",
        members: [{ label: "Mario Rossi", isMinor: false, duty: null }],
      },
    ])
    const parsed = parseSvg(svg)

    expect(parsed.documentElement.localName).toBe("svg")
    expect(parsed.getElementsByTagName("parsererror")).toHaveLength(0)
    expect(parsed.documentElement.getAttribute("width")).toBe("1040")
    expect(parsed.querySelector("text")?.getAttribute("font-family")).toBe(
      "Arial, Helvetica, sans-serif",
    )
    expect(
      parsed.documentElement.querySelector("rect[fill='#ffffff']"),
    ).not.toBeNull()
    expect(parsed.documentElement.textContent).toContain(
      "Uscita del 24 settembre",
    )
    expect(parsed.documentElement.textContent).toContain("Equipaggio 3")
    expect(parsed.documentElement.textContent).toContain("Destinazione: Deriva")
    expect(parsed.documentElement.textContent).toContain("Mario Rossi")
    expect(svg).not.toContain("<image")
  })

  it("renders compact vector markers with accessible names beside each member", () => {
    const parsed = parseSvg(
      buildCrewSummarySvg("Riepilogo", [
        {
          crewNumber: 1,
          destination: "Mezzi",
          members: [
            { label: "Allieva Comandata", isMinor: true, duty: "current" },
            { label: "Allievo Smontante", isMinor: false, duty: "smontante" },
          ],
        },
      ]),
    )
    expect(
      parsed.querySelectorAll("g[aria-label='Comandata'] rect"),
    ).toHaveLength(1)
    expect(
      parsed.querySelectorAll("g[aria-label='Smontante'] rect"),
    ).toHaveLength(1)
    expect(
      parsed.querySelectorAll("g[aria-label='Minorenne'] rect"),
    ).toHaveLength(1)
    expect(
      parsed.querySelector("g[aria-label='Comandata'] > text")?.textContent,
    ).toBe("C")
    expect(
      parsed.querySelector("g[aria-label='Smontante'] > text")?.textContent,
    ).toBe("SM")
    expect(
      parsed.querySelector("g[aria-label='Minorenne'] > text")?.textContent,
    ).toBe("M")
    expect(
      parsed.querySelector("g[aria-label='Comandata'] title")?.textContent,
    ).toBe("Comandata")
    expect(
      parsed.querySelector("g[aria-label='Smontante'] title")?.textContent,
    ).toBe("Smontante")
    expect(
      parsed.querySelector("g[aria-label='Minorenne'] title")?.textContent,
    ).toBe("Minorenne")
  })

  it("escapes XML text and replaces invalid control characters", () => {
    const parsed = parseSvg(
      buildCrewSummarySvg("<Riepilogo & 'oggi'>", [
        {
          crewNumber: 1,
          destination: "A&B <porto>",
          members: [
            {
              label: "<script>alert('x')</script>\u0001",
              isMinor: false,
              duty: null,
            },
          ],
        },
      ]),
    )
    const text = parsed.documentElement.textContent ?? ""

    expect(parsed.getElementsByTagName("parsererror")).toHaveLength(0)
    expect(parsed.getElementsByTagName("script")).toHaveLength(0)
    expect(text).toContain("<Riepilogo & 'oggi'>")
    expect(text).toContain("A&B <porto>")
    expect(text).toContain("<script>alert('x')</script>")
    expect(text).toContain("\uFFFD")
  })

  it("uses one column through twelve crews and balanced columns above twelve", () => {
    const twelve = parseSvg(
      buildCrewSummarySvg(
        "12 equipaggi",
        Array.from({ length: 12 }, (_, index) => crew(index + 1)),
      ),
    )
    const thirteen = parseSvg(
      buildCrewSummarySvg(
        "13 equipaggi",
        Array.from({ length: 13 }, (_, index) => crew(index + 1)),
      ),
    )

    expect(twelve.documentElement.getAttribute("data-columns")).toBe("1")
    expect(twelve.documentElement.getAttribute("width")).toBe("1040")
    expect(twelve.querySelectorAll("g[data-crew-number]")).toHaveLength(12)
    expect(thirteen.documentElement.getAttribute("data-columns")).toBe("2")
    expect(thirteen.documentElement.getAttribute("width")).toBe("1200")
    expect(thirteen.querySelectorAll("g[data-crew-number]")).toHaveLength(13)

    const leftNumbers = Array.from(
      thirteen.querySelectorAll("g[data-crew-number]"),
    )
      .slice(0, 7)
      .map((card) => card.getAttribute("data-crew-number"))
    const rightNumbers = Array.from(
      thirteen.querySelectorAll("g[data-crew-number]"),
    )
      .slice(7)
      .map((card) => card.getAttribute("data-crew-number"))
    expect(leftNumbers).toEqual(["1", "2", "3", "4", "5", "6", "7"])
    expect(rightNumbers).toEqual(["8", "9", "10", "11", "12", "13"])
  })

  it("keeps empty lists and blank or very long values renderable", () => {
    const empty = parseSvg(buildCrewSummarySvg("", []))
    const long = parseSvg(
      buildCrewSummarySvg("Riepilogo", [
        {
          crewNumber: 0,
          destination: "Destinazione " + "molto lunga ".repeat(30),
          members: [
            { label: "NomeSenzaSpazi".repeat(20), isMinor: false, duty: null },
          ],
        },
      ]),
    )

    expect(empty.getElementsByTagName("parsererror")).toHaveLength(0)
    expect(empty.documentElement.textContent).toContain("Riepilogo equipaggi")
    expect(empty.querySelectorAll("g[data-crew-number]")).toHaveLength(0)
    expect(
      Number(empty.documentElement.getAttribute("height")),
    ).toBeGreaterThan(0)
    expect(long.getElementsByTagName("parsererror")).toHaveLength(0)
    expect(long.documentElement.textContent).toContain("Destinazione")
    expect(long.documentElement.textContent).toContain("NomeSenzaSpazi")
    expect(long.documentElement.textContent).toContain("Equipaggio 1")
    expect(Number(long.documentElement.getAttribute("height"))).toBeGreaterThan(
      200,
    )
  })

  it("downloads an SVG with a safe filename and revokes its temporary URL", () => {
    vi.useFakeTimers()
    const createObjectURL = vi.fn(() => "blob:crew-summary")
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined)

    downloadCrewSummarySvg("Uscita 24 settembre!", [crew(1)])

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(
      document.querySelector("a[download='uscita-24-settembre.svg']"),
    ).toBeNull()
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:crew-summary")
  })
})
