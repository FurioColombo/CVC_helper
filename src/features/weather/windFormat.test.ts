import { describe, expect, it } from "vitest"

import type { WindSummary } from "@/domain/wind"
import {
  refreshingText,
  periodHours,
  readingInWords,
  skyText,
  spokenSummary,
  splitText,
  isWetWeather,
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
  weather: null,
  temperature: null,
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

describe("refreshingText", () => {
  const NOW = Date.parse("2026-11-07T17:00:00+01:00") / 1000

  it.each([
    [7 * 3600, "Aggiorno… dati delle 10:00"],
    [17 * 3600, "Aggiorno… dati delle 00:00"],
    [24 * 3600, "Aggiorno… dati di ieri 17:00"],
    [48 * 3600, "Aggiorno… dati di gio 17:00"],
  ])("keeps the age, in one short line, %i s on", (age, text) => {
    expect(refreshingText(NOW - age, NOW)).toBe(text)
    expect(text.length).toBeLessThanOrEqual(28)
  })
})

describe("the week's thunder mark", () => {
  it("is red on its own white chip, visible on every tint", () => {
    // The chip, not the tint, is the bolt's background: one red mark everywhere.
    expect(contrast("#b42318", "#ffffff")).toBeGreaterThanOrEqual(4.5)
  })
})

describe("isWetWeather", () => {
  it("marks only the skies worth an icon among many cells", () => {
    expect(
      (["clear", "partly", "overcast"] as const).map(isWetWeather),
    ).toEqual([false, false, false])
    expect(
      (["fog", "drizzle", "rain", "snow", "storm"] as const).map(isWetWeather),
    ).toEqual([true, true, true, true, true])
    expect(isWetWeather(null)).toBe(false)
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
      "NW circa 14 nodi, raffiche circa 28. Temporali possibili. Modelli divisi. Solo una tendenza.",
    )
  })

  it("says the sky and the temperature, and thunder once", () => {
    expect(
      spokenSummary({
        ...SUMMARY,
        weather: "partly",
        temperature: { low: 15.6, high: 19.2 },
      }),
    ).toBe("NW 14 nodi, raffiche 28. Poco nuvoloso, da 16 a 19 gradi.")
    expect(
      spokenSummary({
        ...SUMMARY,
        thunder: true,
        weather: "storm",
        temperature: { low: 17, high: 17.4 },
      }),
    ).toBe("NW 14 nodi, raffiche 28. Temporali possibili. 17 gradi.")
  })
})

describe("outing words", () => {
  it("states the outing's real times", () => {
    expect(periodHours("AM")).toBe("9–12:30")
    expect(periodHours("PM")).toBe("15–18")
  })

  it("says one reading the same way everywhere", () => {
    expect(readingInWords({ direction: 315, mid: 14.6, gust: 31.5 })).toBe(
      "da NW, 15 nodi, raffica 32",
    )
    expect(readingInWords({ direction: null, mid: 4, gust: null })).toBe(
      "direzione variabile, 4 nodi",
    )
  })
})

describe("skyText", () => {
  it.each([
    ["sky and range", "rain", { low: 15.6, high: 19.2 }, "Pioggia · 16–19 °C"],
    ["one temperature", "clear", { low: 17, high: 17.4 }, "Sereno · 17 °C"],
    ["thunder has its own line", "storm", { low: 17, high: 17 }, "17 °C"],
    ["no temperature", "overcast", null, "Coperto"],
    ["nothing", null, null, null],
  ] as const)("%s", (_, weather, temperature, text) => {
    expect(skyText({ weather, temperature })).toBe(text)
  })
})
