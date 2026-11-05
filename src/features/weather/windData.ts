import { appChannelConfig } from "@/runtimeConfig"
import type { ModelSeries, WindForecast } from "@/domain/wind"
import {
  WIND_FORECAST_DAYS,
  WIND_MODELS,
  WIND_ZONES,
  type WindModelId,
  type WindZoneId,
} from "@/domain/windConfig"

/**
 * The only requests the weather section makes. They carry the zone's fixed sea
 * coordinates and nothing of the course: no names, no account, no identifier.
 * cell_selection=sea asks each model for its nearest water cell, because a land
 * cell's friction reads several knots low for a boat a few hundred metres off.
 */
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
const ENSEMBLE_URL = "https://ensemble-api.open-meteo.com/v1/ensemble"
const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
const REQUEST_TIMEOUT_MS = 20_000
const MAX_AGE_TO_KEEP_SECONDS = 3 * 24 * 3600

type Column = readonly (number | null)[]
type OpenMeteoResponse = {
  hourly?: { time?: readonly number[] } & Record<string, unknown>
}

export class WindDownloadError extends Error {}

function isColumn(value: unknown): value is Column {
  return (
    Array.isArray(value) &&
    value.every((item) => item === null || typeof item === "number")
  )
}

function column(hourly: Record<string, unknown>, name: string): Column | null {
  const value = hourly[name]
  return isColumn(value) ? value : null
}

function emptyColumn(length: number): Column {
  return Array.from({ length }, () => null)
}

async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
  })
  if (!response.ok) throw new WindDownloadError(`HTTP ${response.status}`)
  return response.json()
}

function commonQuery(latitudes: string, longitudes: string) {
  return (
    `latitude=${latitudes}&longitude=${longitudes}&wind_speed_unit=kn` +
    `&forecast_days=${WIND_FORECAST_DAYS}&timeformat=unixtime` +
    "&timezone=Europe%2FRome&cell_selection=sea"
  )
}

export function forecastUrl(zoneId: WindZoneId) {
  const { points } = WIND_ZONES[zoneId]
  const latitudes = points.map((point) => point.latitude).join(",")
  const longitudes = points.map((point) => point.longitude).join(",")
  const models = WIND_MODELS.map((model) => model.id).join(",")
  return (
    `${FORECAST_URL}?${commonQuery(latitudes, longitudes)}` +
    `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&models=${models}`
  )
}

function centre(zoneId: WindZoneId) {
  const { latitude, longitude } = WIND_ZONES[zoneId].centre
  return commonQuery(String(latitude), String(longitude))
}

/** One model's three columns; null when the model sent no speed at all. */
function parseModelSeries(
  hourly: Record<string, unknown>,
  model: WindModelId,
  length: number,
): ModelSeries | null {
  const speed = column(hourly, `wind_speed_10m_${model}`)
  if (!speed || speed.every((value) => value === null)) return null
  return {
    speed,
    direction:
      column(hourly, `wind_direction_10m_${model}`) ?? emptyColumn(length),
    gust: column(hourly, `wind_gusts_10m_${model}`) ?? emptyColumn(length),
  }
}

export function parseForecast(
  zoneId: WindZoneId,
  payload: unknown,
  fetchedAt: number,
): WindForecast {
  const locations = (
    Array.isArray(payload) ? payload : [payload]
  ) as OpenMeteoResponse[]
  const { points } = WIND_ZONES[zoneId]
  const times = locations[0]?.hourly?.time
  if (!Array.isArray(times) || times.length === 0) {
    throw new WindDownloadError("risposta senza ore")
  }
  const parsed: Record<string, Partial<Record<WindModelId, ModelSeries>>> = {}
  points.forEach((point, index) => {
    const hourly = locations[index]?.hourly
    if (!hourly) return
    const models: Partial<Record<WindModelId, ModelSeries>> = {}
    for (const { id } of WIND_MODELS) {
      const series = parseModelSeries(hourly, id, times.length)
      if (series) models[id] = series
    }
    parsed[point.id] = models
  })
  const usable = Object.values(parsed).some(
    (models) => Object.keys(models).length > 0,
  )
  if (!usable) throw new WindDownloadError("nessun modello nella risposta")
  return { fetchedAt, times, points: parsed }
}

/** The quantile of a sorted list; the ensemble's 51 members weigh the same. */
function quantile(sorted: readonly number[], q: number) {
  const position = (sorted.length - 1) * q
  const below = Math.floor(position)
  const lower = sorted[below] ?? 0
  const upper = sorted[Math.min(sorted.length - 1, below + 1)] ?? lower
  return lower + (position - below) * (upper - lower)
}

export function parseEnsemble(
  payload: unknown,
  times: readonly number[],
): WindForecast["ensemble"] {
  const hourly = (payload as OpenMeteoResponse)?.hourly
  const ensembleTimes = hourly?.time
  if (!hourly || !Array.isArray(ensembleTimes)) return undefined
  const members = Object.keys(hourly)
    .filter((key) => key.startsWith("wind_speed_10m"))
    .map((key) => column(hourly, key))
    .filter((member): member is Column => member !== null)
  if (members.length === 0) return undefined
  const positions = new Map(ensembleTimes.map((time, index) => [time, index]))
  const low: (number | null)[] = []
  const mid: (number | null)[] = []
  const high: (number | null)[] = []
  for (const time of times) {
    const index = positions.get(time)
    const values =
      index === undefined
        ? []
        : members
            .flatMap((member) => {
              const value = member[index]
              return value === null || value === undefined ? [] : [value]
            })
            .sort((a, b) => a - b)
    low.push(values.length ? round(quantile(values, 0.2)) : null)
    mid.push(values.length ? round(quantile(values, 0.5)) : null)
    high.push(values.length ? round(quantile(values, 0.8)) : null)
  }
  return { low, mid, high }
}

function round(value: number) {
  return Math.round(value * 10) / 10
}

/** A secondary column aligned to the forecast's hours, by time. */
function aligned(
  hourly: Record<string, unknown>,
  name: string,
  times: readonly number[],
): Column {
  const source = column(hourly, name)
  const sourceTimes = hourly.time
  if (!source || !Array.isArray(sourceTimes)) return emptyColumn(times.length)
  const positions = new Map(sourceTimes.map((time, index) => [time, index]))
  return times.map((time) => {
    const index = positions.get(time)
    return index === undefined ? null : (source[index] ?? null)
  })
}

async function secondary<T>(run: () => Promise<T>): Promise<T | undefined> {
  // Waves, sky and the ensemble enrich the wind; none is worth failing it for.
  try {
    return await run()
  } catch {
    return undefined
  }
}

export async function downloadWindForecast(
  zoneId: WindZoneId,
  now: () => number = () => Math.floor(Date.now() / 1000),
): Promise<WindForecast> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const { signal } = controller
    const forecast = parseForecast(
      zoneId,
      await getJson(forecastUrl(zoneId), signal),
      now(),
    )
    const query = centre(zoneId)
    const [ensemble, waves, sky] = await Promise.all([
      secondary(async () =>
        parseEnsemble(
          await getJson(
            `${ENSEMBLE_URL}?${query}&hourly=wind_speed_10m&models=ecmwf_ifs025`,
            signal,
          ),
          forecast.times,
        ),
      ),
      secondary(async () => {
        const payload = (await getJson(
          `${MARINE_URL}?${query}&hourly=wave_height,wave_period`,
          signal,
        )) as OpenMeteoResponse
        if (!payload.hourly) return undefined
        return {
          height: aligned(payload.hourly, "wave_height", forecast.times),
          period: aligned(payload.hourly, "wave_period", forecast.times),
        }
      }),
      secondary(async () => {
        const payload = (await getJson(
          `${FORECAST_URL}?${query}&hourly=weather_code,temperature_2m`,
          signal,
        )) as OpenMeteoResponse
        if (!payload.hourly) return undefined
        return {
          code: aligned(payload.hourly, "weather_code", forecast.times),
          temperature: aligned(
            payload.hourly,
            "temperature_2m",
            forecast.times,
          ),
        }
      }),
    ])
    return {
      ...forecast,
      ...(ensemble ? { ensemble } : {}),
      ...(waves ? { waves } : {}),
      ...(sky ? { sky } : {}),
    }
  } finally {
    clearTimeout(timer)
  }
}

// --- The last forecast, for the dock without signal ---
// Kept in localStorage, not in the course database: a forecast is nobody's
// data, it needs no backup, and it must not touch the synced schema.

function cacheKey(zoneId: WindZoneId) {
  return `${appChannelConfig.weatherCachePrefix}${zoneId}`
}

export function readCachedForecast(
  zoneId: WindZoneId,
  now: number = Math.floor(Date.now() / 1000),
): WindForecast | null {
  try {
    const stored = localStorage.getItem(cacheKey(zoneId))
    if (!stored) return null
    const parsed = JSON.parse(stored) as WindForecast
    if (
      typeof parsed.fetchedAt !== "number" ||
      !Array.isArray(parsed.times) ||
      typeof parsed.points !== "object" ||
      now - parsed.fetchedAt > MAX_AGE_TO_KEEP_SECONDS
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeCachedForecast(
  zoneId: WindZoneId,
  forecast: WindForecast,
) {
  try {
    localStorage.setItem(cacheKey(zoneId), JSON.stringify(forecast))
  } catch {
    // Full or blocked storage costs the offline copy, not today's forecast.
  }
}
