import { describe, expect, it } from "vitest"

import {
  agreementOf,
  angleBetween,
  beaufort,
  blendForecast,
  circularMean,
  compassPoint,
  defaultHorizon,
  hoursInSlot,
  leadBucket,
  romeClock,
  slotInProgress,
  slotsForHorizon,
  summariseHours,
  weightedQuantile,
  windName,
  type BlendedHour,
  type ModelSeries,
  type WindForecast,
} from "@/domain/wind"
import {
  ENSEMBLE_WEIGHTS,
  FAMILY_MAX_SHARE,
  LEAD_BUCKET_HOURS,
  WIND_MODELS,
  WIND_ZONES,
  zoneForCourse,
  type WindModelId,
} from "@/domain/windConfig"

const HOUR = 3600
// Thursday 5 November 2026, 09:00 in Italy (CET, UTC+1).
const THURSDAY_9 = Date.UTC(2026, 10, 5, 8) / 1000
// The course of ISO week 45: Saturday 7 to Saturday 14 November.
const COURSE = { startDate: "2026-11-07", endDate: "2026-11-14" }

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
    low: 8,
    mid: 10,
    high: 12,
    gust: 15,
    direction: 315,
    directionSpread: 10,
    agreement: "alta",
    models: [],
    waveHeight: null,
    wavePeriod: null,
    thunder: false,
    temperature: null,
    ...partial,
  }
}

describe("canonical tables", () => {
  it("gives every model one weight per lead bucket", () => {
    const buckets = LEAD_BUCKET_HOURS.length + 1
    for (const model of WIND_MODELS) {
      expect(model.weights, model.id).toHaveLength(buckets)
    }
    expect(ENSEMBLE_WEIGHTS).toHaveLength(buckets)
  })

  it("lets no family of related runs decide alone at any lead", () => {
    for (let bucket = 0; bucket <= LEAD_BUCKET_HOURS.length; bucket += 1) {
      const total = WIND_MODELS.reduce((sum, m) => sum + m.weights[bucket]!, 0)
      const families = new Map<string, number>()
      for (const model of WIND_MODELS) {
        families.set(
          model.family,
          (families.get(model.family) ?? 0) + model.weights[bucket]!,
        )
      }
      for (const [family, weight] of families) {
        expect(
          weight / total,
          `${family} at bucket ${bucket}`,
        ).toBeLessThanOrEqual(FAMILY_MAX_SHARE)
      }
    }
  })

  it("keeps something forecasting at every lead", () => {
    for (let bucket = 0; bucket <= LEAD_BUCKET_HOURS.length; bucket += 1) {
      expect(
        WIND_MODELS.filter((m) => m.weights[bucket]! > 0).length,
      ).toBeGreaterThanOrEqual(3)
    }
  })

  it("keeps every point inside the waters of Caprera and of its zone", () => {
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

describe("leadBucket", () => {
  it.each([
    [0, 0],
    [23.9, 0],
    [24, 1],
    [47, 1],
    [48, 2],
    [72, 3],
    [119, 3],
    [120, 4],
    [400, 4],
  ])("puts %d hours in bucket %d", (lead, bucket) => {
    expect(leadBucket(lead)).toBe(bucket)
  })
})

describe("agreementOf", () => {
  it.each([
    // band, mid, direction spread, expected
    [2, 10, 10, "alta"],
    [3.5, 10, 25, "alta"],
    [6, 10, 10, "media"],
    [10, 10, 10, "bassa"],
    [2, 10, 60, "bassa"],
    // Light air: a wandering direction is normal, not a disagreement.
    [2, 3, 120, "alta"],
    // Strong wind may spread further in knots before it is a disagreement.
    [9, 25, 10, "media"],
  ] as const)(
    "band %d, mid %d, spread %d: %s",
    (band, mid, spread, expected) => {
      expect(agreementOf(band, mid, spread)).toBe(expected)
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
    expect(first).toMatchObject({ low: 15, mid: 15, high: 15, gust: 20 })
    expect(first!.direction).toBeCloseTo(315, 5)
    expect(first!.agreement).toBe("alta")
  })

  it("follows the high-resolution models in the short range", () => {
    const [first] = blendForecast(
      forecastOf({
        meteofrance_arome_france_hd: series(48, 20),
        meteofrance_arome_france: series(48, 20),
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
    expect(first!.agreement).toBe("bassa")
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
        ecmwf_ifs: series(48, 10, 315, 18),
        ecmwf_aifs025_single: series(48, 10, 315, null),
      }),
      THURSDAY_9,
    )
    expect(first!.gust).toBe(18)
    expect(first!.models).toHaveLength(2)
  })

  it("drops hours that have passed", () => {
    const hours = blendForecast(
      forecastOf({ ecmwf_ifs: series(48, 10) }),
      THURSDAY_9 + 5 * HOUR,
    )
    expect(hours[0]!.time).toBe(THURSDAY_9 + 4 * HOUR)
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
          ecmwf_ifs: series(length, 10),
          gfs_global: series(length, 10),
          ukmo_global_deterministic_10km: series(length, 10),
        },
        length,
      ),
      THURSDAY_9,
    )
    const weightOf = (index: number) =>
      hours[index]!.models.find(
        (m) => m.model === "meteofrance_arome_france_hd",
      )?.weight ?? 0
    expect(weightOf(29)).toBeLessThan(weightOf(20))
    expect(weightOf(29)).toBeGreaterThan(0)
    expect(weightOf(31)).toBe(0)
  })

  it("lets the ensemble steer and widen the long range only", () => {
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
    expect(hours[1]).toMatchObject({ low: 10, high: 10 })
    const late = hours[150]!
    expect(late.low).toBe(4)
    expect(late.high).toBe(20)
    expect(late.mid).toBeLessThan(10)
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
        sky: { code: [95, 3], temperature: [18, 19] },
        waves: { height: [0.8, 0.9], period: [4, 5] },
      },
      THURSDAY_9,
    )
    expect(first).toMatchObject({
      thunder: true,
      waveHeight: 0.8,
      wavePeriod: 4,
    })
    expect(second!.thunder).toBe(false)
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

  it("warns about westerlies only when they are strong", () => {
    expect(
      summariseHours([hour({ direction: 300, low: 14, mid: 16, high: 19 })])!
        .strongWesterly,
    ).toBe(true)
    expect(
      summariseHours([hour({ direction: 300, low: 6, mid: 8, high: 10 })])!
        .strongWesterly,
    ).toBe(false)
    expect(
      summariseHours([hour({ direction: 120, low: 14, mid: 16, high: 19 })])!
        .strongWesterly,
    ).toBe(false)
  })

  it("reports the highest wave and any thunder of the stretch", () => {
    const summary = summariseHours([
      hour({ waveHeight: 0.5, wavePeriod: 3 }),
      hour({ waveHeight: 1.2, wavePeriod: 6, thunder: true }),
    ])
    expect(summary).toMatchObject({
      waveHeight: 1.2,
      wavePeriod: 6,
      thunder: true,
    })
  })
})

describe("names and scales", () => {
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
    expect(romeClock(THURSDAY_9)).toEqual({ date: "2026-11-05", hour: 9 })
    expect(romeClock(Date.UTC(2026, 6, 15, 8) / 1000)).toEqual({
      date: "2026-07-15",
      hour: 10,
    })
  })

  it("crosses midnight on the Italian date, not the UTC one", () => {
    expect(romeClock(Date.UTC(2026, 10, 5, 23, 30) / 1000)).toEqual({
      date: "2026-11-06",
      hour: 0,
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
    expect(slotInProgress(slot, THURSDAY_9)).toBe(true)
    expect(slotInProgress(slot, THURSDAY_9 + 4 * HOUR)).toBe(false)
    expect(slotInProgress(slot, THURSDAY_9 - HOUR)).toBe(false)
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
