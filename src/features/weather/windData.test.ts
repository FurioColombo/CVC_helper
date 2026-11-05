import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { WIND_ZONES } from "@/domain/windConfig"
import {
  downloadWindForecast,
  forecastUrl,
  parseEnsemble,
  parseForecast,
  readCachedForecast,
  writeCachedForecast,
} from "@/features/weather/windData"
import {
  estimatedLammaRun,
  LAMMA_LAST_STEP,
  lammaHoursFromStep,
  lammaMapUrl,
  lammaStepFromHours,
} from "@/features/weather/lammaMap"
import { appChannelConfig } from "@/runtimeConfig"

const TIMES = [1_000, 4_600, 8_200]

function location() {
  return {
    hourly: {
      time: TIMES,
      wind_speed_10m_ecmwf_ifs: [10, 11, 12],
      wind_direction_10m_ecmwf_ifs: [300, 310, 320],
      wind_gusts_10m_ecmwf_ifs: [15, 16, 17],
      // AIFS sends no gusts; a model the region does not reach sends nulls.
      wind_speed_10m_ecmwf_aifs025_single: [9, 9, 9],
      wind_direction_10m_ecmwf_aifs025_single: [290, 290, 290],
      wind_speed_10m_meteofrance_arome_france_hd: [null, null, null],
    },
  }
}

describe("forecastUrl", () => {
  it("sends the zone's fixed sea points and asks for sea cells in knots", () => {
    const url = new URL(forecastUrl("derive"))
    const { points } = WIND_ZONES.derive
    expect(url.searchParams.get("latitude")).toBe(
      points.map((point) => point.latitude).join(","),
    )
    expect(url.searchParams.get("cell_selection")).toBe("sea")
    expect(url.searchParams.get("wind_speed_unit")).toBe("kn")
    expect(url.searchParams.get("timeformat")).toBe("unixtime")
  })

  it("sends nothing but the forecast's parameters", () => {
    const names = [
      ...new URL(forecastUrl("cabinati")).searchParams.keys(),
    ].sort()
    expect(names).toEqual(
      [
        "cell_selection",
        "forecast_days",
        "hourly",
        "latitude",
        "longitude",
        "models",
        "timeformat",
        "timezone",
        "wind_speed_unit",
      ].sort(),
    )
  })
})

describe("parseForecast", () => {
  it("reads one column set per point and model", () => {
    const payload = WIND_ZONES.derive.points.map(() => location())
    const forecast = parseForecast("derive", payload, 500)
    expect(forecast.times).toEqual(TIMES)
    expect(forecast.fetchedAt).toBe(500)
    const first = WIND_ZONES.derive.points[0]!.id
    expect(forecast.points[first]?.ecmwf_ifs?.speed).toEqual([10, 11, 12])
  })

  it("fills a missing gust with nulls and skips a model with no speed", () => {
    const forecast = parseForecast(
      "derive",
      WIND_ZONES.derive.points.map(() => location()),
      500,
    )
    const models = forecast.points[WIND_ZONES.derive.points[0]!.id]!
    expect(models.ecmwf_aifs025_single?.gust).toEqual([null, null, null])
    expect(models.meteofrance_arome_france_hd).toBeUndefined()
  })

  it("accepts the single object one location returns", () => {
    const forecast = parseForecast("derive", location(), 500)
    expect(Object.keys(forecast.points)).toEqual([
      WIND_ZONES.derive.points[0]!.id,
    ])
  })

  it.each([
    ["an error body", { error: true, reason: "x" }],
    ["no hours", { hourly: { time: [] } }],
    ["no models", { hourly: { time: TIMES } }],
    [
      "text where numbers belong",
      { hourly: { time: TIMES, wind_speed_10m_ecmwf_ifs: ["a", "b", "c"] } },
    ],
    ["nothing", null],
  ])("refuses %s", (_, payload) => {
    expect(() => parseForecast("derive", payload, 500)).toThrow()
  })
})

describe("parseEnsemble", () => {
  it("reduces the members to quantiles, aligned to the forecast's hours", () => {
    const hourly: Record<string, unknown> = { time: [4_600, 8_200] }
    for (let member = 0; member <= 10; member += 1) {
      hourly[
        member === 0 ? "wind_speed_10m" : `wind_speed_10m_member${member}`
      ] = [member, null]
    }
    const result = parseEnsemble({ hourly }, TIMES)
    expect(result?.mid).toEqual([null, 5, null])
    expect(result?.low).toEqual([null, 2, null])
    expect(result?.high).toEqual([null, 8, null])
  })

  it("is absent when the answer holds no members", () => {
    expect(parseEnsemble({ hourly: { time: TIMES } }, TIMES)).toBeUndefined()
    expect(parseEnsemble({}, TIMES)).toBeUndefined()
  })
})

describe("downloadWindForecast", () => {
  const forecastPayload = WIND_ZONES.derive.points.map(() => location())

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.includes("api.open-meteo.com") && input.includes("models=")) {
          if (input.includes("ensemble-api")) throw new Error("no ensemble")
          return new Response(JSON.stringify(forecastPayload))
        }
        if (input.includes("marine-api")) {
          return new Response("{}", { status: 500 })
        }
        return new Response(
          JSON.stringify({
            hourly: {
              time: TIMES,
              weather_code: [95, 1, 1],
              temperature_2m: [20, 21, 22],
            },
          }),
        )
      }),
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it("keeps the wind when waves or the ensemble fail", async () => {
    const forecast = await downloadWindForecast("derive", () => 500)
    expect(forecast.ensemble).toBeUndefined()
    expect(forecast.waves).toBeUndefined()
    expect(forecast.sky?.code).toEqual([95, 1, 1])
  })

  it("fails when the wind itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 429 })),
    )
    await expect(downloadWindForecast("derive")).rejects.toThrow()
  })

  it("sends no credentials and no referrer on any request", async () => {
    await downloadWindForecast("derive", () => 500)
    const calls = vi.mocked(fetch).mock.calls
    expect(calls.length).toBe(4)
    for (const [, init] of calls) {
      expect(init).toMatchObject({
        credentials: "omit",
        referrerPolicy: "no-referrer",
      })
    }
  })
})

describe("the offline copy", () => {
  const key = `${appChannelConfig.weatherCachePrefix}derive`
  const forecast = {
    fetchedAt: 1_000_000,
    times: TIMES,
    points: { only: {} },
  }

  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it("gives back what it stored, per zone", () => {
    writeCachedForecast("derive", forecast)
    expect(readCachedForecast("derive", 1_000_100)).toEqual(forecast)
    expect(readCachedForecast("cabinati", 1_000_100)).toBeNull()
  })

  it("forgets a forecast too old to mean anything", () => {
    writeCachedForecast("derive", forecast)
    expect(readCachedForecast("derive", 1_000_000 + 4 * 24 * 3600)).toBeNull()
  })

  it.each([
    ["broken JSON", "{nope"],
    ["the wrong shape", JSON.stringify({ fetchedAt: "x" })],
  ])("ignores %s", (_, stored) => {
    localStorage.setItem(key, stored)
    expect(readCachedForecast("derive", 1_000_100)).toBeNull()
  })

  it("survives full storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError")
    })
    expect(() => writeCachedForecast("derive", forecast)).not.toThrow()
  })
})

describe("LaMMA's maps", () => {
  it("finds the run the clock says is out", () => {
    // Observed on 5 Nov 2026 at 07:52 UTC: the 12 UTC run of the 4th was the last.
    expect(estimatedLammaRun(Date.UTC(2026, 10, 5, 7, 52) / 1000)).toBe(
      Date.UTC(2026, 10, 4, 12) / 1000,
    )
    expect(estimatedLammaRun(Date.UTC(2026, 10, 5, 9, 30) / 1000)).toBe(
      Date.UTC(2026, 10, 5, 0) / 1000,
    )
  })

  it.each([
    // LaMMA's own numbering, from its page's script.
    [1, 0],
    [6, 5],
    [61, 60],
    [62, 63],
    [69, 84],
    [70, 90],
    [75, 120],
  ])("reads image %d as %d hours after the run, both ways", (step, hours) => {
    expect(lammaHoursFromStep(step)).toBe(hours)
    expect(lammaStepFromHours(hours)).toBe(step)
  })

  it("never asks for an image before the run or after the last", () => {
    expect(lammaStepFromHours(-5)).toBe(1)
    expect(lammaStepFromHours(500)).toBe(LAMMA_LAST_STEP)
  })

  it("builds the coastal Bonifacio map's address", () => {
    expect(lammaMapUrl("wind10", 6)).toBe(
      "https://www.lamma.toscana.it/models/ww3gnshrecm/last/wind10.AQ.6.png",
    )
  })
})
