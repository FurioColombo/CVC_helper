import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { WIND_ZONES } from "@/domain/windConfig"
import {
  clearCachedForecasts,
  downloadWindForecast,
  forecastUrl,
  isStoredForecast,
  parseEnsemble,
  parseForecast,
  readCachedForecast,
  secondaryUrls,
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

const NOW = Date.UTC(2026, 10, 5, 8) / 1000
const TIMES = [NOW, NOW + 3600, NOW + 7200]

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

  it("asks for the extras at the zone's centre, and waves only where they matter", () => {
    expect(secondaryUrls("derive").waves).toBeNull()
    expect(secondaryUrls("cabinati").waves).toContain("hourly=wave_height")
    expect(secondaryUrls("derive").sky).toContain("hourly=weather_code")
    expect(secondaryUrls("derive").ensemble).toContain("models=ecmwf_ifs025")
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
    const forecast = parseForecast("derive", payload, NOW)
    expect(forecast.times).toEqual(TIMES)
    expect(forecast.fetchedAt).toBe(NOW)
    const first = WIND_ZONES.derive.points[0]!.id
    expect(forecast.points[first]?.ecmwf_ifs?.speed).toEqual([10, 11, 12])
  })

  it("fills a missing gust with nulls and skips a model with no speed", () => {
    const forecast = parseForecast(
      "derive",
      WIND_ZONES.derive.points.map(() => location()),
      NOW,
    )
    const models = forecast.points[WIND_ZONES.derive.points[0]!.id]!
    expect(models.ecmwf_aifs025_single?.gust).toEqual([null, null, null])
    expect(models.meteofrance_arome_france_hd).toBeUndefined()
  })

  it("accepts the single object one location returns", () => {
    const forecast = parseForecast("derive", location(), NOW)
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
    [
      "an hour that is not a number",
      {
        hourly: {
          time: [NOW, "x", NOW + 7200],
          wind_speed_10m_ecmwf_ifs: [1, 2, 3],
        },
      },
    ],
    [
      "an impossible hour",
      {
        hourly: {
          time: [NOW, 1e300, NOW + 7200],
          wind_speed_10m_ecmwf_ifs: [1, 2, 3],
        },
      },
    ],
    [
      "hours out of order",
      {
        hourly: {
          time: [NOW + 3600, NOW, NOW + 7200],
          wind_speed_10m_ecmwf_ifs: [1, 2, 3],
        },
      },
    ],
    [
      "hours from another decade",
      {
        hourly: {
          time: [1000, 4600, 8200],
          wind_speed_10m_ecmwf_ifs: [1, 2, 3],
        },
      },
    ],
    [
      "more hours than any forecast has",
      {
        hourly: {
          time: Array.from({ length: 500 }, (_, index) => NOW + index),
          wind_speed_10m_ecmwf_ifs: Array.from({ length: 500 }, () => 1),
        },
      },
    ],
    [
      "a column of the wrong length",
      { hourly: { time: TIMES, wind_speed_10m_ecmwf_ifs: [1, 2] } },
    ],
    [
      "too many impossible speeds",
      { hourly: { time: TIMES, wind_speed_10m_ecmwf_ifs: [1e308, -5, 1e30] } },
    ],
  ])("refuses %s", (_, payload) => {
    expect(() => parseForecast("derive", payload, NOW)).toThrow()
  })

  it("drops a lone impossible value and keeps the rest", () => {
    const length = 20
    const time = Array.from({ length }, (_, index) => NOW + index * 3600)
    const speed: (number | null)[] = Array.from({ length }, () => 10)
    speed[3] = 1e308
    const direction: (number | null)[] = Array.from({ length }, () => 300)
    direction[4] = 720
    const forecast = parseForecast(
      "derive",
      {
        hourly: {
          time,
          wind_speed_10m_ecmwf_ifs: speed,
          wind_direction_10m_ecmwf_ifs: direction,
        },
      },
      NOW,
    )
    const series = forecast.points[WIND_ZONES.derive.points[0]!.id]!.ecmwf_ifs!
    expect(series.speed[3]).toBeNull()
    expect(series.speed[2]).toBe(10)
    expect(series.direction[4]).toBeNull()
  })
})

describe("parseEnsemble", () => {
  it("reduces the members to quantiles, aligned to the forecast's hours", () => {
    const hourly: Record<string, unknown> = { time: [TIMES[1], TIMES[2]] }
    for (let member = 0; member <= 10; member += 1) {
      hourly[
        member === 0 ? "wind_speed_10m" : `wind_speed_10m_member${member}`
      ] = [member, null]
    }
    const result = parseEnsemble({ hourly }, TIMES)
    expect(result?.mid).toEqual([null, 5, null])
    expect(result?.low).toEqual([null, 1.7, null])
    expect(result?.high).toEqual([null, 8.3, null])
  })

  it("is absent when the answer holds no members", () => {
    expect(parseEnsemble({ hourly: { time: TIMES } }, TIMES)).toBeUndefined()
    expect(parseEnsemble({}, TIMES)).toBeUndefined()
  })
})

describe("downloadWindForecast", () => {
  const forecastPayload = WIND_ZONES.cabinati.points.map(() => location())
  const skyPayload = {
    hourly: { time: TIMES, weather_code: [95, 1, 1] },
  }

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.includes("ensemble-api")) throw new Error("no ensemble")
        if (input.includes("marine-api")) {
          return new Response("{}", { status: 500 })
        }
        return new Response(
          JSON.stringify(
            input.includes("models=") ? forecastPayload : skyPayload,
          ),
        )
      }),
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  const options = { now: () => NOW }

  it("keeps the wind when waves or the ensemble fail", async () => {
    const forecast = await downloadWindForecast("cabinati", options)
    expect(forecast.ensemble).toBeUndefined()
    expect(forecast.waves).toBeUndefined()
    expect(forecast.sky?.code).toEqual([95, 1, 1])
  })

  it("hands over the wind before the extras arrive", async () => {
    const seen: unknown[] = []
    const forecast = await downloadWindForecast("cabinati", {
      ...options,
      onWind: (wind) => seen.push(wind.sky),
    })
    expect(seen).toEqual([undefined])
    expect(forecast.sky).toBeDefined()
  })

  it("keeps the last sky for the hours it covers when this one fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.includes("models=") && !input.includes("ensemble-api")) {
          return new Response(JSON.stringify(forecastPayload))
        }
        throw new Error("no signal")
      }),
    )
    const previous = {
      fetchedAt: NOW - 3600,
      times: [NOW - 3600, NOW, NOW + 3600],
      points: {},
      sky: { code: [1, 95, 2] },
    }
    const forecast = await downloadWindForecast("cabinati", {
      ...options,
      previous,
    })
    expect(forecast.sky?.code).toEqual([95, 2, null])
  })

  it("fails when the wind itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 429 })),
    )
    await expect(downloadWindForecast("cabinati", options)).rejects.toThrow()
  })

  it("stops when the screen leaves, even if the extras answered", async () => {
    const controller = new AbortController()
    const download = downloadWindForecast("cabinati", {
      ...options,
      signal: controller.signal,
      onWind: () => controller.abort(),
    })
    await expect(download).rejects.toThrow()
  })

  it("sends no credentials, no referrer and only known parameters on every request", async () => {
    await downloadWindForecast("cabinati", options)
    const calls = vi.mocked(fetch).mock.calls
    expect(calls.length).toBe(4)
    const allowed = new Set([
      "latitude",
      "longitude",
      "wind_speed_unit",
      "forecast_days",
      "timeformat",
      "timezone",
      "cell_selection",
      "hourly",
      "models",
    ])
    for (const [url, init] of calls) {
      expect(init).toMatchObject({
        credentials: "omit",
        referrerPolicy: "no-referrer",
      })
      for (const name of new URL(url as string).searchParams.keys()) {
        expect(allowed).toContain(name)
      }
    }
  })

  it("makes three requests for Derive, which asks for no waves", async () => {
    await downloadWindForecast("derive", options)
    expect(vi.mocked(fetch).mock.calls.length).toBe(3)
  })
})

describe("the offline copy", () => {
  const key = `${appChannelConfig.weatherCachePrefix}v2.derive`
  const point = WIND_ZONES.derive.points[0]!.id
  const column = (value: number | null) => TIMES.map(() => value)
  const forecast = {
    fetchedAt: NOW,
    times: TIMES,
    points: {
      [point]: {
        ecmwf_ifs: {
          speed: column(10),
          direction: column(300),
          gust: column(15),
        },
      },
    },
  }

  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it("gives back what it stored, per zone", () => {
    writeCachedForecast("derive", forecast)
    expect(readCachedForecast("derive", NOW + 100)).toEqual(forecast)
    expect(readCachedForecast("cabinati", NOW + 100)).toBeNull()
  })

  it("forgets and deletes a forecast too old to mean anything", () => {
    writeCachedForecast("derive", forecast)
    expect(readCachedForecast("derive", NOW + 4 * 24 * 3600)).toBeNull()
    expect(localStorage.getItem(key)).toBeNull()
  })

  it("refuses a forecast from the future, and deletes it", () => {
    writeCachedForecast("derive", {
      ...forecast,
      fetchedAt: NOW + 300 * 86_400,
    })
    expect(readCachedForecast("derive", NOW)).toBeNull()
    expect(localStorage.getItem(key)).toBeNull()
  })

  const seriesOf = (patch: object) => ({
    ...forecast,
    points: {
      [point]: {
        ecmwf_ifs: { ...forecast.points[point]!.ecmwf_ifs, ...patch },
      },
    },
  })

  it.each([
    ["broken JSON", "{nope"],
    ["the wrong shape", JSON.stringify({ fetchedAt: "x" })],
    ["no points", JSON.stringify({ ...forecast, points: null })],
    [
      "a point it does not know",
      JSON.stringify({ ...forecast, points: { x: {} } }),
    ],
    [
      "a model it does not know",
      JSON.stringify({ ...forecast, points: { [point]: { nope: {} } } }),
    ],
    [
      "a model with no columns",
      JSON.stringify({ ...forecast, points: { [point]: { ecmwf_ifs: {} } } }),
    ],
    ["text in a column", JSON.stringify(seriesOf({ speed: ["a", "b", "c"] }))],
    ["an impossible speed", JSON.stringify(seriesOf({ speed: [1e30, 1, 1] }))],
    ["a short column", JSON.stringify(seriesOf({ gust: [1] }))],
    ["a bad hour", JSON.stringify({ ...forecast, times: [NOW, "x", NOW] })],
    [
      "a bad wave column",
      JSON.stringify({ ...forecast, waves: { height: ["x", 1, 1] } }),
    ],
    ["a bad sky column", JSON.stringify({ ...forecast, sky: { code: [1] } })],
    ["a bad ensemble", JSON.stringify({ ...forecast, ensemble: { low: [1] } })],
  ])("ignores %s", (_, stored) => {
    localStorage.setItem(key, stored)
    expect(readCachedForecast("derive", NOW + 100)).toBeNull()
  })

  it("accepts every column a real download stores", () => {
    expect(
      isStoredForecast(
        {
          ...forecast,
          ensemble: { low: column(1), mid: column(2), high: column(3) },
          waves: { height: column(0.5) },
          sky: { code: column(95) },
        },
        "derive",
        NOW,
      ),
    ).toBe(true)
  })

  it("survives full storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError")
    })
    expect(() => writeCachedForecast("derive", forecast)).not.toThrow()
  })

  it("can drop every stored forecast of this channel and nothing else", () => {
    writeCachedForecast("derive", forecast)
    localStorage.setItem("other", "kept")
    clearCachedForecasts()
    expect(localStorage.getItem(key)).toBeNull()
    expect(localStorage.getItem("other")).toBe("kept")
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

  it("builds the coastal Bonifacio map's address, new at every run", () => {
    expect(lammaMapUrl("wind10", 6, 1000)).toBe(
      "https://www.lamma.toscana.it/models/ww3gnshrecm/last/wind10.AQ.6.png?run=1000",
    )
  })
})
