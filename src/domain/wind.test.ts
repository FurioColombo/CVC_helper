import { describe, expect, it } from "vitest"

import {
  angleBetween,
  beaufort,
  blendForecast,
  circularMean,
  compassPoint,
  compassPoint8,
  defaultHorizon,
  hoursAroundSlot,
  hoursInSlot,
  nextDecisionSlot,
  outsideOuting,
  romeClock,
  slotInProgress,
  slotsForHorizon,
  splitOf,
  summariseHours,
  weatherKindOf,
  weatherOfHours,
  weightAtLead,
  weightedQuantile,
  windName,
  type BlendedHour,
  type ModelSeries,
  type WindForecast,
} from "@/domain/wind"
import {
  ENSEMBLE_WEIGHTS,
  FAMILY_CAP_UNTIL_HOURS,
  FAMILY_MAX_SHARE,
  GUST_RULE,
  LEAD_ANCHOR_HOURS,
  RANGE_HALF_WIDTH,
  WEATHER_KINDS,
  WIND_MODELS,
  WIND_SESSION_HOURS,
  WIND_TREND_HOURS,
  WIND_ZONES,
  zoneForCourse,
  type WindModelId,
} from "@/domain/windConfig"

const HOUR = 3600
// Thursday 5 November 2026, 09:00 in Italy (CET, UTC+1).
const THURSDAY_9 = Date.UTC(2026, 10, 5, 8) / 1000
// The course of ISO week 45: Saturday 7 to Saturday 14 November.
const COURSE = { startDate: "2026-11-07" }

function series(
  length: number,
  speed: number | null,
  direction: number | null = 315,
  gust: number | null = speed === null ? null : speed + 5,
): ModelSeries {
  return {
    speed: Array.from({ length }, () => speed),
    direction: Array.from({ length }, () => direction),
    gust: Array.from({ length }, () => gust),
  }
}

function forecastOf(
  models: Partial<Record<WindModelId, ModelSeries>>,
  length = 48,
  start = THURSDAY_9,
): WindForecast {
  return {
    fetchedAt: start,
    times: Array.from({ length }, (_, index) => start + index * HOUR),
    points: { only: models },
  }
}

function hour(partial: Partial<BlendedHour>): BlendedHour {
  return {
    time: THURSDAY_9,
    lead: 0,
    low: 8,
    mid: 10,
    high: 12,
    modelSpread: 2,
    gust: 15,
    direction: 315,
    directionSpread: 10,
    models: [],
    waveHeight: null,
    thunder: false,
    weather: null,
    temperature: null,
    ...partial,
  }
}

describe("canonical tables", () => {
  it("gives every model one weight per lead anchor", () => {
    const anchors = LEAD_ANCHOR_HOURS.length
    for (const model of WIND_MODELS) {
      expect(model.weights, model.id).toHaveLength(anchors)
    }
    expect(ENSEMBLE_WEIGHTS).toHaveLength(anchors)
  })

  it("lets no family decide alone while the islands can be seen, ensemble included", () => {
    for (let lead = 0; lead <= FAMILY_CAP_UNTIL_HOURS; lead += 6) {
      const ensemble = weightAtLead(ENSEMBLE_WEIGHTS, lead)
      const families = new Map<string, number>([["ecmwf", ensemble]])
      let total = ensemble
      for (const model of WIND_MODELS) {
        const weight = weightAtLead(model.weights, lead)
        total += weight
        families.set(model.family, (families.get(model.family) ?? 0) + weight)
      }
      for (const [family, weight] of families) {
        expect(weight / total, `${family} at ${lead} h`).toBeLessThanOrEqual(
          FAMILY_MAX_SHARE,
        )
      }
    }
  })

  it("keeps something forecasting at every anchor", () => {
    for (let anchor = 0; anchor < LEAD_ANCHOR_HOURS.length; anchor += 1) {
      expect(
        WIND_MODELS.filter((m) => m.weights[anchor]! > 0).length,
      ).toBeGreaterThanOrEqual(3)
    }
  })

  it("gives IFS at least GFS's weight at long range, as it scored on sea cells", () => {
    const weightOf = (id: WindModelId) =>
      WIND_MODELS.find((model) => model.id === id)!.weights[4]
    expect(weightOf("ecmwf_ifs")).toBeGreaterThanOrEqual(weightOf("gfs_global"))
  })

  it("keeps every point inside the box around Caprera, and unique", () => {
    for (const zone of Object.values(WIND_ZONES)) {
      expect(new Set(zone.points.map((point) => point.id)).size).toBe(
        zone.points.length,
      )
      for (const point of zone.points) {
        expect(point.latitude).toBeGreaterThan(41.1)
        expect(point.latitude).toBeLessThan(41.3)
        expect(point.longitude).toBeGreaterThan(9.3)
        expect(point.longitude).toBeLessThan(9.55)
      }
    }
  })

  it("sends a course to the area its boats sail", () => {
    expect(zoneForCourse("Deriva")).toBe("derive")
    expect(zoneForCourse("Cabinato")).toBe("cabinati")
  })
})

describe("outing hours", () => {
  it("shows every outing inside its trend window, an hour each side", () => {
    for (const period of ["AM", "PM"] as const) {
      const outing = WIND_SESSION_HOURS[period]
      const shown = WIND_TREND_HOURS[period]
      expect(shown.start).toBe(outing.start - 1)
      expect(shown.end).toBe(outing.end + 1)
    }
    expect(WIND_TREND_HOURS.AM.end).toBe(WIND_TREND_HOURS.PM.start)
  })
})

describe("the sky", () => {
  it("gives every WMO code Open-Meteo sends exactly one kind", () => {
    const sent = [
      0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75,
      77, 80, 81, 82, 85, 86, 95, 96, 99,
    ]
    const listed = WEATHER_KINDS.flatMap((kind) => [...kind.codes])
    expect([...listed].sort((a, b) => a - b)).toEqual(sent)
    for (const code of sent) expect(weatherKindOf(code)).not.toBeNull()
    expect(weatherKindOf(4)).toBeNull()
    expect(weatherKindOf(null)).toBeNull()
  })

  it("calls thunder storm, as the thunder line does", () => {
    for (const code of [95, 96, 99]) expect(weatherKindOf(code)).toBe("storm")
  })

  const sky = (...kinds: (string | null)[]) =>
    kinds.map(
      (weather) =>
        ({ weather }) as Parameters<typeof weatherOfHours>[0][number],
    )

  it.each([
    ["one hour of rain is the half-day's", ["clear", "clear", "rain"], "rain"],
    ["the worst wet hour wins", ["drizzle", "storm", "rain"], "storm"],
    ["fog counts as wet", ["clear", "fog", "clear"], "fog"],
    [
      "otherwise the most frequent cloud",
      ["clear", "partly", "partly"],
      "partly",
    ],
    ["the cloudier on a tie", ["clear", "overcast"], "overcast"],
    ["hours without a sky do not count", [null, "clear", null], "clear"],
    ["no sky at all", [null, null], null],
  ] as const)("%s", (_, kinds, expected) => {
    expect(weatherOfHours(sky(...kinds))).toBe(expected)
  })

  it("puts the sky and the temperature range in the summary", () => {
    const summary = summariseHours([
      hour({ weather: "partly", temperature: 16.2 }),
      hour({ time: THURSDAY_9 + HOUR, weather: "rain", temperature: 18.9 }),
      hour({ time: THURSDAY_9 + 2 * HOUR, weather: null, temperature: null }),
    ])
    expect(summary?.weather).toBe("rain")
    expect(summary?.temperature).toEqual({ low: 16.2, high: 18.9 })
    expect(summariseHours([hour({})])?.temperature).toBeNull()
  })

  it("blends the zone's sky into each hour", () => {
    const forecast = {
      ...forecastOf({ ecmwf_ifs: series(3, 10) }, 3),
      sky: { code: [0, 61, null], temperature: [14, null, 15] },
    }
    const hours = blendForecast(forecast, THURSDAY_9)
    expect(hours.map((item) => item.weather)).toEqual(["clear", "rain", null])
    expect(hours.map((item) => item.temperature)).toEqual([14, null, 15])
  })
})

describe("weightedQuantile", () => {
  it("has nothing to say about nothing", () => {
    expect(weightedQuantile([], 0.5)).toBeNull()
    expect(weightedQuantile([{ value: 3, weight: 0 }], 0.5)).toBeNull()
  })

  it("returns the only value at every quantile", () => {
    for (const q of [0, 0.2, 0.5, 0.8, 1]) {
      expect(weightedQuantile([{ value: 12, weight: 3 }], q)).toBe(12)
    }
  })

  it("is the plain median when the weights are equal", () => {
    const samples = [1, 2, 9].map((value) => ({ value, weight: 1 }))
    expect(weightedQuantile(samples, 0.5)).toBe(2)
  })

  it("leans to the heavier sample", () => {
    const median = weightedQuantile(
      [
        { value: 10, weight: 9 },
        { value: 30, weight: 1 },
      ],
      0.5,
    )
    expect(median).toBeLessThan(15)
  })

  it("barely moves for one model far from the others", () => {
    const steady = [10, 11, 12, 11].map((value) => ({ value, weight: 1 }))
    const withOutlier = [...steady, { value: 40, weight: 1 }]
    expect(weightedQuantile(withOutlier, 0.5)!).toBeLessThanOrEqual(12)
  })
})

describe("circularMean", () => {
  it("averages across north", () => {
    const result = circularMean([
      { value: 350, weight: 1 },
      { value: 10, weight: 1 },
    ])
    expect(angleBetween(result!.mean, 0)).toBeLessThan(0.001)
  })

  it("reports opposed directions as fully spread", () => {
    const result = circularMean([
      { value: 90, weight: 1 },
      { value: 270, weight: 1 },
    ])
    expect(result!.spread).toBeGreaterThan(100)
  })

  it("has no spread when all agree", () => {
    const result = circularMean([
      { value: 315, weight: 2 },
      { value: 315, weight: 5 },
    ])
    expect(result!.mean).toBeCloseTo(315, 5)
    expect(result!.spread).toBeLessThan(1)
  })

  it("has no mean without samples", () => {
    expect(circularMean([])).toBeNull()
  })
})

describe("weightAtLead", () => {
  const weights = [30, 25, 0, 0, 0]
  it.each([
    [0, 30],
    [12, 30],
    [24, 27.5],
    [36, 25],
    [48, 12.5],
    [60, 0],
    [500, 0],
  ])("at %d hours is %d", (lead, weight) => {
    expect(weightAtLead(weights, lead)).toBeCloseTo(weight, 5)
  })
})

describe("splitOf", () => {
  it.each([
    // model spread, mid, direction spread, expected
    [2, 10, 10, null],
    [7, 10, 10, null],
    [7.5, 10, 10, "speed"],
    [2, 10, 60, "direction"],
    // Light air: a wandering direction is normal, not a disagreement.
    [2, 3, 120, null],
    // Strong wind may spread further in knots before it is a disagreement.
    [9, 25, 10, null],
    [13, 25, 10, "speed"],
    // Direction first: it is the one that changes the plan most.
    [13, 25, 60, "direction"],
  ] as const)(
    "spread %d, mid %d, direction spread %d: %s",
    (spread, mid, direction, expected) => {
      expect(splitOf(spread, mid, direction)).toBe(expected)
    },
  )
})

describe("blendForecast", () => {
  it("returns the shared value when all models agree", () => {
    const [first] = blendForecast(
      forecastOf({
        meteofrance_arome_france_hd: series(48, 15),
        italia_meteo_arpae_icon_2i: series(48, 15),
        ecmwf_ifs: series(48, 15),
      }),
      THURSDAY_9,
    )
    expect(first).toMatchObject({ mid: 15, modelSpread: 0 })
    expect(first!.direction).toBeCloseTo(315, 5)
  })

  it("follows the high-resolution models in the short range", () => {
    const [first] = blendForecast(
      forecastOf({
        meteofrance_arome_france_hd: series(48, 20),
        italia_meteo_arpae_icon_2i: series(48, 20),
        ecmwf_aifs025_single: series(48, 5),
        gfs_global: series(48, 5),
      }),
      THURSDAY_9,
    )
    expect(first!.mid).toBeGreaterThan(15)
  })

  it("shows disagreement in the band instead of averaging it away", () => {
    const [first] = blendForecast(
      forecastOf({
        meteofrance_arome_france_hd: series(48, 8),
        italia_meteo_arpae_icon_2i: series(48, 22),
        ecmwf_ifs: series(48, 8),
        gfs_global: series(48, 22),
      }),
      THURSDAY_9,
    )
    expect(first!.high - first!.low).toBeGreaterThan(7)
    expect(first!.modelSpread).toBeGreaterThan(7)
  })

  it("keeps speed intact when models disagree on the direction", () => {
    // Vector averaging would report almost no wind here.
    const [first] = blendForecast(
      forecastOf({
        meteofrance_arome_france_hd: series(48, 15, 90),
        ecmwf_ifs: series(48, 15, 270),
      }),
      THURSDAY_9,
    )
    expect(first!.mid).toBe(15)
    expect(first!.direction).toBeNull()
  })

  it("calls light wind variable, whatever the models say", () => {
    const [first] = blendForecast(
      forecastOf({ ecmwf_ifs: series(48, 2, 315) }),
      THURSDAY_9,
    )
    expect(first!.direction).toBeNull()
  })

  it("ignores models without a value and hours without any model", () => {
    const hours = blendForecast(
      forecastOf(
        {
          ecmwf_ifs: {
            speed: [10, null, 12],
            direction: [315, null, 315],
            gust: [15, null, null],
          },
        },
        3,
      ),
      THURSDAY_9,
    )
    expect(hours.map((item) => item.mid)).toEqual([10, 12])
    expect(hours[1]!.gust).toBeNull()
  })

  it("leaves a model with no gust out of the gust, not out of the speed", () => {
    const [first] = blendForecast(
      forecastOf({
        ecmwf_ifs: series(48, 10, 315, 26),
        ecmwf_aifs025_single: series(48, 10, 315, null),
      }),
      THURSDAY_9,
    )
    expect(first!.gust).toBe(26)
    expect(first!.models).toHaveLength(2)
  })

  it("never shows a range narrower than the wind's real scatter", () => {
    const [first] = blendForecast(
      forecastOf({
        meteofrance_arome_france_hd: series(48, 15),
        ecmwf_ifs: series(48, 15),
      }),
      THURSDAY_9,
    )
    expect(first).toMatchObject({
      low: 15 - 15 * RANGE_HALF_WIDTH.ofExpected,
      high: 15 + 15 * RANGE_HALF_WIDTH.ofExpected,
    })
  })

  it("keeps a floor under the range in light wind", () => {
    const [first] = blendForecast(
      forecastOf({ ecmwf_ifs: series(48, 5) }),
      THURSDAY_9,
    )
    expect(first).toMatchObject({
      low: 5 - RANGE_HALF_WIDTH.minKnots,
      high: 5 + RANGE_HALF_WIDTH.minKnots,
    })
  })

  it("never shows a range below calm", () => {
    const [first] = blendForecast(
      forecastOf({ ecmwf_ifs: series(48, 1) }),
      THURSDAY_9,
    )
    expect(first!.low).toBe(0)
  })

  it("takes the highest model gust, not a quartile of them", () => {
    const [first] = blendForecast(
      forecastOf({
        meteofrance_arome_france_hd: series(60, 10, 315, 12),
        ecmwf_ifs: series(60, 10, 315, 14),
        gfs_global: series(60, 10, 315, 26),
      }),
      THURSDAY_9,
    )
    expect(first!.gust).toBe(26)
  })

  it("lifts a gust below what the expected wind implies", () => {
    const [first] = blendForecast(
      forecastOf({ ecmwf_ifs: series(48, 20, 315, 22) }),
      THURSDAY_9,
    )
    expect(first!.gust).toBe(20 * GUST_RULE.ofExpected)
  })

  it("fades a run's gust out with the run, so the number does not jump when it ends", () => {
    const length = 40
    const ending: ModelSeries = {
      speed: Array.from({ length }, (_, index) => (index < 30 ? 10 : null)),
      direction: Array.from({ length }, (_, index) =>
        index < 30 ? 315 : null,
      ),
      gust: Array.from({ length }, (_, index) => (index < 30 ? 50 : null)),
    }
    const hours = blendForecast(
      forecastOf(
        {
          meteofrance_arome_france_hd: ending,
          ecmwf_ifs: series(length, 10, 315, 22),
          gfs_global: series(length, 10, 315, 22),
        },
        length,
      ),
      THURSDAY_9,
    )
    expect(hours[20]!.gust).toBe(50)
    expect(hours[30]!.gust).toBe(22)
    // The last hour has no stamp after it, so no gust covers it.
    expect(hours[length - 1]!.gust).toBeNull()
    for (let index = 1; index < length - 1; index += 1) {
      const step = Math.abs(hours[index]!.gust! - hours[index - 1]!.gust!)
      expect(step, `hour ${index}`).toBeLessThanOrEqual(6)
    }
  })

  it("reads two places apart as one model when it comes to direction", () => {
    const forecast: WindForecast = {
      fetchedAt: THURSDAY_9,
      times: [THURSDAY_9],
      points: {
        a: {
          ecmwf_ifs: series(1, 15, 230),
          gfs_global: series(1, 15, 230),
        },
        b: {
          ecmwf_ifs: series(1, 15, 340),
          gfs_global: series(1, 15, 340),
        },
      },
    }
    const [first] = blendForecast(forecast, THURSDAY_9)
    expect(first!.directionSpread).toBeLessThan(5)
  })

  it("shows no gust number where too few runs are left to make one", () => {
    const length = 150
    const hours = blendForecast(
      forecastOf({ ecmwf_ifs: series(length, 10) }, length),
      THURSDAY_9,
    )
    expect(hours[GUST_RULE.lastLeadHours]!.gust).not.toBeNull()
    expect(hours[GUST_RULE.lastLeadHours + 1]!.gust).toBeNull()
  })

  it("counts each model once, so places apart are not models apart", () => {
    const forecast: WindForecast = {
      fetchedAt: THURSDAY_9,
      times: [THURSDAY_9],
      points: {
        spargi: { ecmwf_ifs: series(1, 25), gfs_global: series(1, 25) },
        caprera: { ecmwf_ifs: series(1, 25), gfs_global: series(1, 25) },
        cannigione: { ecmwf_ifs: series(1, 12), gfs_global: series(1, 12) },
        liscia: { ecmwf_ifs: series(1, 12), gfs_global: series(1, 12) },
      },
    }
    expect(blendForecast(forecast, THURSDAY_9)[0]!.modelSpread).toBe(0)
  })

  it("drops hours that have passed", () => {
    const hours = blendForecast(
      forecastOf({ ecmwf_ifs: series(48, 10) }),
      THURSDAY_9 + 5 * HOUR,
    )
    expect(hours[0]!.time).toBe(THURSDAY_9 + 5 * HOUR)
    // Part way through an hour, that hour is still the first one.
    expect(
      blendForecast(
        forecastOf({ ecmwf_ifs: series(48, 10) }),
        THURSDAY_9 + 5.5 * HOUR,
      )[0]!.time,
    ).toBe(THURSDAY_9 + 5 * HOUR)
  })

  it("does not jump when a high-resolution run ends", () => {
    const length = 40
    const ending: ModelSeries = {
      speed: Array.from({ length }, (_, index) => (index < 30 ? 25 : null)),
      direction: Array.from({ length }, (_, index) =>
        index < 30 ? 315 : null,
      ),
      gust: Array.from({ length }, (_, index) => (index < 30 ? 30 : null)),
    }
    const hours = blendForecast(
      forecastOf(
        {
          meteofrance_arome_france_hd: ending,
          italia_meteo_arpae_icon_2i: series(length, 10),
          ecmwf_ifs: series(length, 10),
          gfs_global: series(length, 10),
        },
        length,
      ),
      THURSDAY_9,
    )
    for (let index = 1; index < length; index += 1) {
      const step = Math.abs(hours[index]!.mid - hours[index - 1]!.mid)
      expect(step, `hour ${index}`).toBeLessThanOrEqual(6)
    }
    const weightOf = (index: number) =>
      hours[index]!.models.find(
        (m) => m.model === "meteofrance_arome_france_hd",
      )?.weight ?? 0
    expect(weightOf(29)).toBeLessThan(weightOf(20))
    expect(weightOf(29)).toBeGreaterThan(0)
    expect(weightOf(31)).toBe(0)
  })

  it.each([36, 48, 60, 72, 96, 120, 144])(
    "does not step at %d hours when only the lead moves",
    (edge) => {
      const length = 200
      const models = Object.fromEntries(
        WIND_MODELS.map((model, index) => [
          model.id,
          series(length, 8 + 2 * index),
        ]),
      )
      const forecast: WindForecast = {
        ...forecastOf(models, length),
        ensemble: {
          low: Array.from({ length }, () => 5),
          mid: Array.from({ length }, () => 12),
          high: Array.from({ length }, () => 24),
        },
      }
      const hours = blendForecast(forecast, THURSDAY_9)
      const before = hours[edge - 1]!
      const after = hours[edge + 1]!
      expect(Math.abs(after.mid - before.mid)).toBeLessThan(1.5)
      expect(Math.abs(after.high - before.high)).toBeLessThan(2)
      expect(Math.abs(after.modelSpread - before.modelSpread)).toBeLessThan(2.5)
    },
  )

  it("widens with the ensemble gradually, and only at long range", () => {
    const length = 200
    const base = forecastOf({ ecmwf_ifs: series(length, 10) }, length)
    const withEnsemble: WindForecast = {
      ...base,
      ensemble: {
        low: Array.from({ length }, () => 4),
        mid: Array.from({ length }, () => 8),
        high: Array.from({ length }, () => 20),
      },
    }
    const hours = blendForecast(withEnsemble, THURSDAY_9)
    expect(hours[1]!.modelSpread).toBe(0)
    expect(hours[60]!.modelSpread).toBeGreaterThan(0)
    expect(hours[60]!.modelSpread).toBeLessThan(hours[80]!.modelSpread)
    expect(hours[150]).toMatchObject({ low: 4, high: 20 })
    expect(hours[150]!.mid).toBeLessThan(10)
  })

  it("counts the ensemble in the shares it reports", () => {
    const length = 200
    const hours = blendForecast(
      {
        ...forecastOf({ ecmwf_ifs: series(length, 10) }, length),
        ensemble: {
          low: Array.from({ length }, () => 8),
          mid: Array.from({ length }, () => 8),
          high: Array.from({ length }, () => 8),
        },
      },
      THURSDAY_9,
    )
    const shares = hours[150]!.models
    expect(shares.map((entry) => entry.model).sort()).toEqual([
      "ecmwf_ifs",
      "ensemble",
    ])
    expect(shares.reduce((sum, entry) => sum + entry.weight, 0)).toBeCloseTo(1)
  })

  it("measures lead from the download, so an old copy keeps its long-range caution", () => {
    const length = 100
    const forecast: WindForecast = {
      ...forecastOf({ ecmwf_ifs: series(length, 10) }, length),
      ensemble: {
        low: Array.from({ length }, () => 2),
        mid: Array.from({ length }, () => 10),
        high: Array.from({ length }, () => 22),
      },
    }
    const threeDaysLater = THURSDAY_9 + 72 * HOUR
    const [first] = blendForecast(forecast, threeDaysLater)
    expect(first!.lead).toBeGreaterThanOrEqual(71)
    expect(first!.modelSpread).toBeGreaterThan(15)
  })

  it("can blend one point of a zone apart from the others", () => {
    const forecast: WindForecast = {
      fetchedAt: THURSDAY_9,
      times: [THURSDAY_9],
      points: {
        spargi: { ecmwf_ifs: series(1, 25) },
        cannigione: { ecmwf_ifs: series(1, 9) },
      },
    }
    expect(blendForecast(forecast, THURSDAY_9, ["spargi"])[0]!.mid).toBe(25)
    expect(blendForecast(forecast, THURSDAY_9, ["cannigione"])[0]!.mid).toBe(9)
    expect(blendForecast(forecast, THURSDAY_9)[0]!.mid).toBe(17)
  })

  it("marks thunder from the sky codes and carries the waves", () => {
    const [first, second] = blendForecast(
      {
        ...forecastOf({ ecmwf_ifs: series(2, 10) }, 2),
        sky: { code: [95, 3] },
        waves: { height: [0.8, 0.9] },
      },
      THURSDAY_9,
    )
    expect(first).toMatchObject({ thunder: true, waveHeight: 0.8 })
    expect(second!.thunder).toBe(false)
  })

  it("does not read a missing sky as a clear one", () => {
    const [first] = blendForecast(
      forecastOf({ ecmwf_ifs: series(2, 10) }, 2),
      THURSDAY_9,
    )
    expect(first!.thunder).toBeNull()
  })
})

describe("summariseHours", () => {
  it("has no summary without hours", () => {
    expect(summariseHours([])).toBeNull()
  })

  it("encloses a building wind instead of flattening it", () => {
    const summary = summariseHours([
      hour({ low: 7, mid: 8, high: 9 }),
      hour({ low: 11, mid: 12, high: 13 }),
      hour({ low: 15, mid: 16, high: 17 }),
      hour({ low: 19, mid: 20, high: 21 }),
    ])
    expect(summary!.low).toBeLessThanOrEqual(8)
    expect(summary!.high).toBeGreaterThanOrEqual(20)
    expect(summary!.trend).toBe("rinforzo")
  })

  it.each([
    [[10, 10, 10, 10], "stabile"],
    [[10, 11, 12, 12], "stabile"],
    [[16, 14, 10, 8], "calo"],
  ] as const)("reads %j as %s", (mids, trend) => {
    const summary = summariseHours(mids.map((mid) => hour({ mid })))
    expect(summary!.trend).toBe(trend)
  })

  it("takes the highest gust of the stretch", () => {
    const summary = summariseHours([
      hour({ gust: 12 }),
      hour({ gust: 25 }),
      hour({ gust: null }),
    ])
    expect(summary!.gust).toBe(25)
  })

  it("says the wind turns from 40 degrees on", () => {
    expect(
      summariseHours([hour({ direction: 270 }), hour({ direction: 310 })])!
        .turning,
    ).toBe(true)
    expect(
      summariseHours([hour({ direction: 270 }), hour({ direction: 300 })])!
        .turning,
    ).toBe(false)
  })

  it("has no one direction when most hours have none", () => {
    const summary = summariseHours([
      hour({ direction: null }),
      hour({ direction: null }),
      hour({ direction: null }),
      hour({ direction: 315 }),
    ])
    expect(summary!.direction).toBeNull()
  })

  it("reports the highest wave of the stretch", () => {
    const summary = summariseHours([
      hour({ waveHeight: 0.5 }),
      hour({ waveHeight: 1.2 }),
    ])
    expect(summary!.waveHeight).toBe(1.2)
  })

  it.each([
    [[false, false], false],
    [[false, true], true],
    [[false, null], null],
    [[null, true], true],
  ] as const)("reads thunder %j as %s", (values, expected) => {
    const summary = summariseHours(values.map((thunder) => hour({ thunder })))
    expect(summary!.thunder).toBe(expected)
  })

  it("says what the models are divided over, and which directions", () => {
    expect(summariseHours([hour({ modelSpread: 12, mid: 10 })])!.split).toBe(
      "speed",
    )
    const summary = summariseHours([
      hour({
        directionSpread: 60,
        models: [
          { model: "ecmwf_ifs", weight: 0.6, speed: 10, direction: 315 },
          { model: "gfs_global", weight: 0.4, speed: 10, direction: 180 },
        ],
      }),
    ])!
    expect(summary.split).toBe("direction")
    expect(summary.directionOptions).toEqual([
      { direction: 315, speed: 10 },
      { direction: 180, speed: 10 },
    ])
  })

  it.each([
    [0, "near", "speed"],
    [71, "near", "speed"],
    [72, "tendency", null],
    [119, "tendency", null],
    [120, "seasonal", null],
  ] as const)("%d hours ahead is %s", (lead, reach, split) => {
    const summary = summariseHours([hour({ lead, modelSpread: 12 })])!
    expect(summary.reach).toBe(reach)
    expect(summary.split).toBe(split)
  })

  it("keeps the first and last expected wind for the words", () => {
    const summary = summariseHours([
      hour({ mid: 8 }),
      hour({ mid: 14 }),
      hour({ mid: 20 }),
    ])!
    expect(summary).toMatchObject({ firstMid: 8, lastMid: 20 })
  })
})

describe("names and scales", () => {
  it.each([
    [0, "N"],
    [44, "NE"],
    [292.5, "NW"],
    [359, "N"],
  ])("%d° fits a narrow cell as %s", (degrees, point) => {
    expect(compassPoint8(degrees)).toBe(point)
  })

  it.each([
    [0, "N", "Tramontana"],
    [359, "N", "Tramontana"],
    [45, "NE", "Grecale"],
    [90, "E", "Levante"],
    [135, "SE", "Scirocco"],
    [180, "S", "Ostro"],
    [225, "SW", "Libeccio"],
    [270, "W", "Ponente"],
    [315, "NW", "Maestrale"],
    [292.5, "WNW", "Maestrale"],
  ])("%d° is %s, %s", (degrees, point, name) => {
    expect(compassPoint(degrees)).toBe(point)
    expect(windName(degrees)).toBe(name)
  })

  it.each([
    [0, 0],
    [3.9, 1],
    [4, 2],
    [10.9, 3],
    [11, 4],
    [16.9, 4],
    [17, 5],
    [22, 6],
    [28, 7],
    [34, 8],
    [64, 12],
    [90, 12],
  ])("%d kn is force %d", (knots, force) => {
    expect(beaufort(knots)).toBe(force)
  })
})

describe("time in Caprera", () => {
  it("reads the Italian clock, summer and winter", () => {
    expect(romeClock(THURSDAY_9)).toEqual({
      date: "2026-11-05",
      hour: 9,
      minute: 0,
    })
    expect(romeClock(Date.UTC(2026, 6, 15, 8) / 1000)).toEqual({
      date: "2026-07-15",
      hour: 10,
      minute: 0,
    })
  })

  it("crosses midnight on the Italian date, not the UTC one", () => {
    expect(romeClock(Date.UTC(2026, 10, 5, 23, 30) / 1000)).toEqual({
      date: "2026-11-06",
      hour: 0,
      minute: 30,
    })
  })

  it("keeps a session whole across the change of clock", () => {
    // Sunday 25 October 2026: clocks go back at 03:00; 09-13 is still 4 hours.
    const start = Date.UTC(2026, 9, 25, 0) / 1000
    const forecast = forecastOf({ ecmwf_ifs: series(24, 10) }, 24, start)
    const inSlot = hoursInSlot(blendForecast(forecast, start), {
      key: "2026-10-25-AM",
      date: "2026-10-25",
      period: "AM",
      sessionId: null,
    })
    expect(inSlot.map((item) => romeClock(item.time).hour)).toEqual([
      9, 10, 11, 12,
    ])
  })

  it("shows an hour each side of the outing, and counts only the outing", () => {
    const start = Date.UTC(2026, 10, 7, 0) / 1000 // Saturday, CET
    const hours = blendForecast(
      forecastOf({ ecmwf_ifs: series(24, 10) }, 24, start),
      start,
    )
    const slot = {
      key: "2026-11-07-PM",
      date: "2026-11-07",
      period: "PM",
      sessionId: "sat-pm",
    } as const
    const around = hoursAroundSlot(hours, slot)
    expect(around.map((item) => romeClock(item.time).hour)).toEqual([
      14, 15, 16, 17, 18,
    ])
    expect(
      around
        .filter((item) => outsideOuting(item, slot))
        .map((item) => romeClock(item.time).hour),
    ).toEqual([14, 18])
    expect(
      hoursInSlot(hours, slot).map((item) => romeClock(item.time).hour),
    ).toEqual([15, 16, 17])
  })

  it("gives an hour the gust stamped at its end, so an outing's gust is its own hours'", () => {
    // Open-Meteo stamps a gust at the end of the hour it covers. Thursday
    // 9:00 is index 0: the stamp 15:00 holds the lunch hour 14–15, the stamp
    // 18:00 the last sailed hour 17–18.
    const slot = {
      key: "2026-11-05-PM",
      date: "2026-11-05",
      period: "PM",
      sessionId: null,
    } as const
    const gustOf = (stamp: number) => {
      const quiet: ModelSeries = {
        ...series(24, 10, 300, 14),
        gust: Array.from({ length: 24 }, (_, index) =>
          index === stamp ? 35 : 14,
        ),
      }
      const hours = blendForecast(
        forecastOf({ ecmwf_ifs: quiet }, 24),
        THURSDAY_9,
      )
      return summariseHours(hoursInSlot(hours, slot))!.gust
    }
    expect(gustOf(6)).toBe(20)
    expect(gustOf(9)).toBe(35)
  })
})

describe("slotsForHorizon", () => {
  it("is the thirteen sessions of the week, before it starts", () => {
    const slots = slotsForHorizon("week", COURSE, THURSDAY_9)
    expect(slots).toHaveLength(13)
    expect(slots[0]).toMatchObject({
      date: "2026-11-07",
      period: "PM",
      sessionId: "sat-pm",
    })
    expect(slots[12]).toMatchObject({
      date: "2026-11-13",
      period: "PM",
      sessionId: "fri-pm",
    })
  })

  it("drops a session once it ends, and keeps it while it runs", () => {
    const during = Date.UTC(2026, 10, 8, 10) / 1000 // Sunday 11:00
    expect(slotsForHorizon("week", COURSE, during)[0]!.sessionId).toBe("sun-am")
    const after = Date.UTC(2026, 10, 8, 12) / 1000 // Sunday 13:00
    expect(slotsForHorizon("week", COURSE, after)[0]!.sessionId).toBe("sun-pm")
  })

  it("has nothing left after Friday PM", () => {
    const friday = Date.UTC(2026, 10, 13, 17) / 1000 // Friday 18:00
    expect(slotsForHorizon("week", COURSE, friday)).toEqual([])
  })

  it("is every half day of seven days, today's first", () => {
    const slots = slotsForHorizon("seven", COURSE, THURSDAY_9)
    expect(slots).toHaveLength(14)
    expect(slots[0]).toMatchObject({
      date: "2026-11-05",
      period: "AM",
      sessionId: null,
    })
  })

  it("names the sessions it meets in seven days and no others", () => {
    const slots = slotsForHorizon("seven", COURSE, THURSDAY_9)
    expect(slots.find((s) => s.key === "2026-11-07-AM")!.sessionId).toBeNull()
    expect(slots.find((s) => s.key === "2026-11-07-PM")!.sessionId).toBe(
      "sat-pm",
    )
  })

  it("knows a slot is running only during its hours", () => {
    const slot = {
      key: "2026-11-05-AM",
      date: "2026-11-05",
      period: "AM",
      sessionId: null,
    } as const
    // The outing, not the hours shown around it: 8:00 is not under way.
    expect(slotInProgress(slot, THURSDAY_9)).toBe(true)
    expect(slotInProgress(slot, THURSDAY_9 + 3 * HOUR)).toBe(true) // 12:00
    // The boats are back at 12:30 (FUX-56).
    expect(slotInProgress(slot, THURSDAY_9 + 3.5 * HOUR - 60)).toBe(true) // 12:29
    expect(slotInProgress(slot, THURSDAY_9 + 3.5 * HOUR)).toBe(false) // 12:30
    expect(slotInProgress(slot, THURSDAY_9 + 4 * HOUR)).toBe(false) // 13:00
    expect(slotInProgress(slot, THURSDAY_9 - HOUR)).toBe(false) // 8:00
  })
})

describe("nextDecisionSlot", () => {
  it.each([
    ["before the course: its first session", THURSDAY_9, "2026-11-07-PM"],
    [
      "during a morning session",
      Date.UTC(2026, 10, 8, 10) / 1000,
      "2026-11-08-AM",
    ],
    [
      "at 11:20, an hour and more before the boats are back: the morning",
      Date.UTC(2026, 10, 8, 10, 20) / 1000,
      "2026-11-08-AM",
    ],
    [
      "from 11:30, its last hour: the afternoon",
      Date.UTC(2026, 10, 8, 10, 30) / 1000,
      "2026-11-08-PM",
    ],
    [
      "in its last hour: the afternoon",
      Date.UTC(2026, 10, 8, 11, 10) / 1000, // 12:10, back by 12:30
      "2026-11-08-PM",
    ],
    [
      "at lunch: the afternoon",
      Date.UTC(2026, 10, 8, 11, 40) / 1000, // 12:40
      "2026-11-08-PM",
    ],
    [
      "in the hour shown after the morning: the afternoon",
      Date.UTC(2026, 10, 8, 12, 30) / 1000, // 13:30
      "2026-11-08-PM",
    ],
    [
      "in the last session's last hour: still that session",
      Date.UTC(2026, 10, 13, 16, 30) / 1000, // 17:30
      "2026-11-13-PM",
    ],
    [
      "after the last session: plain half-days",
      Date.UTC(2026, 10, 13, 17) / 1000, // 18:00
      "2026-11-14-AM",
    ],
    ["weeks before: today", Date.UTC(2026, 9, 1, 8) / 1000, "2026-10-01-AM"],
  ])("%s", (_, now, key) => {
    expect(nextDecisionSlot(COURSE, now).key).toBe(key)
  })
})

describe("defaultHorizon", () => {
  it.each([
    ["within seven days of the start", THURSDAY_9, "week"],
    ["during the week", Date.UTC(2026, 10, 10, 10) / 1000, "week"],
    ["weeks before the start", Date.UTC(2026, 9, 1, 10) / 1000, "seven"],
    ["after the last session", Date.UTC(2026, 10, 13, 17) / 1000, "seven"],
  ])("%s", (_, now, horizon) => {
    expect(defaultHorizon(COURSE, now)).toBe(horizon)
  })
})
