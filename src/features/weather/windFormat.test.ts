import { describe, expect, it } from "vitest"

import type { WindSummary } from "@/domain/wind"
import { WIND_TINTS } from "@/domain/windConfig"
import {
  spokenSummary,
  splitText,
  thunderColor,
} from "@/features/weather/windFormat"

const SUMMARY: WindSummary = {
  low: 8,
  high: 20,
  mid: 14,
  firstMid: 14,
  lastMid: 14,
  gust: 28,
  direction: 315,
  firstDirection: 315,
  lastDirection: 315,
  split: null,
  directionOptions: null,
  trend: "stabile",
  turning: false,
  waveHeight: null,
  thunder: false,
  reach: "near",
}

function luminance(hex: string) {
  const channel = (at: number) => {
    const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function contrast(a: string, b: string) {
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y)
  return (high! + 0.05) / (low! + 0.05)
}

describe("thunderColor", () => {
  it("stays visible on every tint of the week", () => {
    for (const tint of WIND_TINTS) {
      if (!tint.background.startsWith("#")) continue
      expect(
        contrast(thunderColor(tint), tint.background),
        tint.background,
      ).toBeGreaterThanOrEqual(3)
    }
  })
})

describe("splitText", () => {
  it("is silent when the models agree", () => {
    expect(splitText(SUMMARY)).toBeNull()
  })

  it("names both camps with their wind when they split over direction", () => {
    expect(
      splitText({
        ...SUMMARY,
        split: "direction",
        directionOptions: [
          { direction: 315, speed: 20 },
          { direction: 135, speed: 6 },
        ],
      }),
    ).toBe("Modelli divisi: NW 20 o SE 6")
  })

  it("does not call the top of the range a limit", () => {
    expect(splitText({ ...SUMMARY, split: "speed" })).toBe(
      "Modelli divisi sulla forza: tra 8 e 20, e può superare 20",
    )
  })
})

describe("spokenSummary", () => {
  it("leaves nothing out that the eye gets", () => {
    expect(
      spokenSummary({
        ...SUMMARY,
        thunder: true,
        split: "speed",
        reach: "tendency",
      }),
    ).toBe(
      "NW circa 14 nodi, raffiche 28. Temporali possibili. Modelli divisi. Solo una tendenza.",
    )
  })
})
