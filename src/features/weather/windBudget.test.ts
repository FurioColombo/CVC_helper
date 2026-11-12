import { describe, expect, it } from "vitest"

import type { WindZoneId } from "@/domain/windConfig"
import { REFRESH_AFTER_SECONDS } from "@/features/weather/useWindForecast"
import { forecastUrl, secondaryUrls } from "@/features/weather/windData"

/**
 * Open-Meteo's free tier counts weighted calls per address: 600 a minute,
 * 5,000 an hour, 10,000 a day, 300,000 a month. A request weighs, for each
 * location, one call per 10 variables (a variable asked of several models or
 * ensemble members counts once each) and per 14 days, never less than one.
 * Measured on 2026-11-12 through its X-RateLimit-Cost header: Derive's
 * forecast 6.3, Cabinati's 12.6, the ensemble 5.1, the sky 1.0; the marine
 * answer sent no cost and is counted here as 1. The owner asked (2026-11-11)
 * for about a tenth of the daily limit for the whole centre (03, "Vento").
 */
const ENSEMBLE_MEMBERS: Record<string, number> = { ecmwf_ifs025: 51 }

function weight(url: string) {
  const query = new URL(url).searchParams
  const locations = query.get("latitude")!.split(",").length
  const variables = query.get("hourly")!.split(",").length
  const models = query.get("models")?.split(",") ?? ["best_match"]
  const series = models.reduce(
    (sum, model) => sum + variables * (ENSEMBLE_MEMBERS[model] ?? 1),
    0,
  )
  const days = Number(query.get("forecast_days"))
  return locations * Math.max(1, series / 10) * Math.max(1, days / 14)
}

function refreshCost(zone: WindZoneId) {
  const { ensemble, waves, sky } = secondaryUrls(zone)
  return [forecastUrl(zone), ensemble, waves, sky]
    .filter((url): url is string => url !== null)
    .reduce((sum, url) => sum + weight(url), 0)
}

const round = (value: number) => Math.round(value * 10) / 10

describe("Open-Meteo budget", () => {
  it("weighs each request as the provider measured it", () => {
    expect(round(weight(forecastUrl("derive")))).toBe(6.3)
    expect(round(weight(forecastUrl("cabinati")))).toBe(12.6)
    expect(round(weight(secondaryUrls("derive").ensemble))).toBe(5.1)
    expect(weight(secondaryUrls("derive").sky)).toBe(1)
  })

  it("pins one refresh: 12.4 calls for Derive, 19.7 for Cabinati", () => {
    expect(round(refreshCost("derive"))).toBe(12.4)
    expect(round(refreshCost("cabinati"))).toBe(19.7)
  })

  it("keeps a phone left open on Vento all day under a tenth of the daily limit", () => {
    expect(REFRESH_AFTER_SECONDS).toBe(45 * 60)
    const refreshesADay = Math.ceil((24 * 3600) / REFRESH_AFTER_SECONDS)
    const worstZone = Math.max(refreshCost("derive"), refreshCost("cabinati"))
    expect(refreshesADay * worstZone).toBeLessThan(1_000)
  })
})
