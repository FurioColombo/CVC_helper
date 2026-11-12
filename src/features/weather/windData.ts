import type { ModelSeries, WindForecast } from "@/domain/wind"
import { weightedQuantile } from "@/domain/wind"
import {
  WIND_FORECAST_DAYS,
  WIND_MODELS,
  WIND_ZONES,
  type WindModelId,
  type WindZoneId,
} from "@/domain/windConfig"
import { appChannelConfig } from "@/runtimeConfig"

/**
 * The data calls of the weather section; LaMMA's map image is the only other
 * request, and nothing is asked until the instructor opens Vento. The query holds
 * the zone's fixed sea coordinates, which do reveal the course's family, and
 * model names: no names, no account, no identifier. The provider also sees what
 * any site does: the phone's address, Origin, User-Agent, language and the hour.
 * cell_selection=sea asks each model for its nearest water cell, because the
 * default cell can be inland terrain kilometres away and read several knots low.
 */
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
const ENSEMBLE_URL = "https://ensemble-api.open-meteo.com/v1/ensemble"
const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
const PRIMARY_TIMEOUT_MS = 20_000
/** Each extra has its own clock, so a slow forecast cannot starve the thunder. */
const SECONDARY_TIMEOUT_MS = 15_000
const MAX_AGE_TO_KEEP_SECONDS = 3 * 24 * 3600
/** A phone clock a little behind is fine; a forecast from the future is not. */
const MAX_FUTURE_SECONDS = 5 * 60
const MAX_HOURS = 16 * 24
const SANE_TIME_WINDOW_SECONDS = 30 * 24 * 3600
/** Bump when WindForecast changes: an old shape must never reach the screen. */
const CACHE_VERSION = "v3"

const RANGES = {
  speed: [0, 150],
  direction: [0, 360],
  height: [0, 30],
  code: [0, 99],
  temperature: [-40, 55],
} as const
type Range = (typeof RANGES)[keyof typeof RANGES]

type Column = readonly (number | null)[]
type OpenMeteoResponse = {
  hourly?: { time?: unknown } & Record<string, unknown>
}

function isFiniteInRange(value: unknown, [low, high]: Range) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= low &&
    value <= high
  )
}

/** A value outside the possible is no value; too many and the column is gone. */
function cleanColumn(
  value: unknown,
  length: number,
  range: Range,
): Column | null {
  if (!Array.isArray(value) || value.length !== length) return null
  let refused = 0
  const cleaned = value.map((item: unknown) => {
    if (item === null) return null
    if (isFiniteInRange(item, range)) return item as number
    refused += 1
    return null
  })
  return refused > length / 10 ? null : cleaned
}

function emptyColumn(length: number): Column {
  return Array.from({ length }, () => null)
}

function saneTimes(value: unknown, now: number): value is readonly number[] {
  if (!Array.isArray(value) || value.length === 0) return false
  if (value.length > MAX_HOURS) return false
  return value.every(
    (time: unknown, index) =>
      typeof time === "number" &&
      Number.isInteger(time) &&
      Math.abs(time - now) <= SANE_TIME_WINDOW_SECONDS &&
      (index === 0 || time === (value[index - 1] as number) + 3600),
  )
}

async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
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

export function secondaryUrls(zoneId: WindZoneId) {
  const { latitude, longitude } = WIND_ZONES[zoneId].centre
  const query = commonQuery(String(latitude), String(longitude))
  return {
    ensemble: `${ENSEMBLE_URL}?${query}&hourly=wind_speed_10m&models=ecmwf_ifs025`,
    waves: WIND_ZONES[zoneId].waves
      ? `${MARINE_URL}?${query}&hourly=wave_height`
      : null,
    sky: `${FORECAST_URL}?${query}&hourly=weather_code,temperature_2m`,
  }
}

/** One model's three columns; null when the model sent no speed at all. */
function parseModelSeries(
  hourly: Record<string, unknown>,
  model: WindModelId,
  length: number,
): ModelSeries | null {
  const speed = cleanColumn(
    hourly[`wind_speed_10m_${model}`],
    length,
    RANGES.speed,
  )
  if (!speed || speed.every((value) => value === null)) return null
  return {
    speed,
    direction:
      cleanColumn(
        hourly[`wind_direction_10m_${model}`],
        length,
        RANGES.direction,
      ) ?? emptyColumn(length),
    gust:
      cleanColumn(hourly[`wind_gusts_10m_${model}`], length, RANGES.speed) ??
      emptyColumn(length),
  }
}

export function parseForecast(
  zoneId: WindZoneId,
  payload: unknown,
  fetchedAt: number,
): WindForecast {
  const locations = (
    Array.isArray(payload) ? payload : [payload]
  ) as (OpenMeteoResponse | null)[]
  const { points } = WIND_ZONES[zoneId]
  const times = locations[0]?.hourly?.time
  if (!saneTimes(times, fetchedAt)) throw new Error("risposta senza ore valide")
  // A well-formed answer about the past would replace a good copy with nothing.
  if ((times.at(-1) ?? 0) < fetchedAt) throw new Error("risposta senza futuro")
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
  if (!usable) throw new Error("nessun modello nella risposta")
  return { fetchedAt, times, points: parsed }
}

function round(value: number) {
  return Math.round(value * 10) / 10
}

export function parseEnsemble(
  payload: unknown,
  times: readonly number[],
): WindForecast["ensemble"] {
  const hourly = (payload as OpenMeteoResponse | null)?.hourly
  const ensembleTimes = hourly?.time
  if (!hourly || !Array.isArray(ensembleTimes)) return undefined
  const members = Object.keys(hourly)
    .filter((key) => key.startsWith("wind_speed_10m"))
    .map((key) => cleanColumn(hourly[key], ensembleTimes.length, RANGES.speed))
    .filter((member): member is Column => member !== null)
  if (members.length === 0) return undefined
  const positions = new Map(
    (ensembleTimes as unknown[]).map((time, index) => [time, index]),
  )
  const low: (number | null)[] = []
  const mid: (number | null)[] = []
  const high: (number | null)[] = []
  for (const time of times) {
    const index = positions.get(time)
    const samples =
      index === undefined
        ? []
        : members.flatMap((member) => {
            const value = member[index]
            return value === null || value === undefined
              ? []
              : [{ value, weight: 1 }]
          })
    const at = (q: number) => {
      const value = weightedQuantile(samples, q)
      return value === null ? null : round(value)
    }
    low.push(at(0.2))
    mid.push(at(0.5))
    high.push(at(0.8))
  }
  return { low, mid, high }
}

/** A secondary column aligned to the forecast's hours, by time. */
function aligned(
  hourly: Record<string, unknown>,
  name: string,
  times: readonly number[],
  range: Range,
): Column | null {
  const sourceTimes = hourly.time
  if (!Array.isArray(sourceTimes)) return null
  const source = cleanColumn(hourly[name], sourceTimes.length, range)
  if (!source) return null
  const positions = new Map(
    (sourceTimes as unknown[]).map((time, index) => [time, index]),
  )
  return times.map((time) => {
    const index = positions.get(time)
    return index === undefined ? null : (source[index] ?? null)
  })
}

function hourlyOf(payload: unknown) {
  return (payload as OpenMeteoResponse | null)?.hourly ?? null
}

const CARRY_EXTRAS_FOR_SECONDS = 6 * 3600

async function secondary<T>(
  run: (signal: AbortSignal) => Promise<T | undefined>,
  outer: AbortSignal,
): Promise<T | undefined> {
  // Waves, sky and the ensemble enrich the wind; none is worth failing it for.
  const signal = AbortSignal.any([
    outer,
    AbortSignal.timeout(SECONDARY_TIMEOUT_MS),
  ])
  try {
    return await run(signal)
  } catch {
    return undefined
  }
}

/** By the extra's own age: carrying it must not make it young again. */
function stillRecent<T extends { fetchedAt?: number }>(
  extra: T | undefined,
  moment: number,
) {
  const age = extra?.fetchedAt === undefined ? null : moment - extra.fetchedAt
  return age !== null && age >= 0 && age < CARRY_EXTRAS_FOR_SECONDS
    ? extra
    : undefined
}

/** What an extra said last time, for the hours both downloads cover. */
function carriedOver(
  times: readonly number[],
  previous: WindForecast | null,
  column: Column | undefined,
): Column | null {
  if (!previous || !column) return null
  const positions = new Map(previous.times.map((time, index) => [time, index]))
  const carried = times.map((time) => {
    const index = positions.get(time)
    return index === undefined ? null : (column[index] ?? null)
  })
  return carried.some((value) => value !== null) ? carried : null
}

export type WindDownloadOptions = {
  signal?: AbortSignal
  now?: () => number
  /** The last forecast: its sky and waves stand in if this time they fail. */
  previous?: WindForecast | null
  /** The wind alone, as soon as it arrives, while the extras are on their way. */
  onWind?: (forecast: WindForecast) => void
}

export async function downloadWindForecast(
  zoneId: WindZoneId,
  {
    signal: outer,
    now = () => Math.floor(Date.now() / 1000),
    previous = null,
    onWind,
  }: WindDownloadOptions = {},
): Promise<WindForecast> {
  const abort = outer ?? new AbortController().signal
  const payload = await getJson(
    forecastUrl(zoneId),
    AbortSignal.any([abort, AbortSignal.timeout(PRIMARY_TIMEOUT_MS)]),
  )
  const wind = parseForecast(zoneId, payload, now())
  // A sky older than this must not pass for today's: better to say it is unknown.
  const pastSky = stillRecent(previous?.sky, now())
  const pastWaves = stillRecent(previous?.waves, now())
  const carriedSky = carriedOver(wind.times, previous, pastSky?.code)
  const carriedTemperature = carriedOver(
    wind.times,
    previous,
    pastSky?.temperature,
  )
  const carriedWaves = carriedOver(wind.times, previous, pastWaves?.height)
  const withCarried: WindForecast = {
    ...wind,
    ...(carriedSky
      ? {
          sky: {
            code: carriedSky,
            ...(carriedTemperature ? { temperature: carriedTemperature } : {}),
            fetchedAt: pastSky?.fetchedAt,
          },
        }
      : {}),
    ...(carriedWaves
      ? { waves: { height: carriedWaves, fetchedAt: pastWaves?.fetchedAt } }
      : {}),
  }
  onWind?.(withCarried)

  const urls = secondaryUrls(zoneId)
  const [ensemble, waves, sky] = await Promise.all([
    secondary(
      async (signal) =>
        parseEnsemble(await getJson(urls.ensemble, signal), wind.times),
      abort,
    ),
    secondary(async (signal) => {
      if (!urls.waves) return undefined
      const hourly = hourlyOf(await getJson(urls.waves, signal))
      const height =
        hourly && aligned(hourly, "wave_height", wind.times, RANGES.height)
      return height ? { height, fetchedAt: now() } : undefined
    }, abort),
    secondary(async (signal) => {
      const hourly = hourlyOf(await getJson(urls.sky, signal))
      const code =
        hourly && aligned(hourly, "weather_code", wind.times, RANGES.code)
      const temperature =
        hourly &&
        aligned(hourly, "temperature_2m", wind.times, RANGES.temperature)
      return code
        ? { code, ...(temperature ? { temperature } : {}), fetchedAt: now() }
        : undefined
    }, abort),
  ])
  abort.throwIfAborted()
  return {
    ...withCarried,
    ...(ensemble ? { ensemble } : {}),
    ...(waves ? { waves } : {}),
    ...(sky ? { sky } : {}),
  }
}

// --- The last forecast, for the dock without signal ---
// Kept in localStorage, not in the course database: a forecast is nobody's
// data, it needs no backup, and it must not touch the synced schema. What comes
// back is checked as strictly as what came from the provider: another page on
// the origin, a wrong clock or an older version may have written it.

export function cacheKey(zoneId: WindZoneId) {
  return `${appChannelConfig.weatherCachePrefix}${CACHE_VERSION}.${zoneId}`
}

function strictColumn(value: unknown, length: number, range: Range) {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((item) => item === null || isFiniteInRange(item, range))
  )
}

function isOptional(value: unknown, check: (value: object) => boolean) {
  return (
    value === undefined ||
    (typeof value === "object" && value !== null && check(value))
  )
}

export function isStoredForecast(
  value: unknown,
  zoneId: WindZoneId,
  now: number,
): value is WindForecast {
  if (typeof value !== "object" || value === null) return false
  const { fetchedAt, times, points, ensemble, waves, sky } = value as Partial<
    Record<keyof WindForecast, unknown>
  >
  if (typeof fetchedAt !== "number" || !Number.isFinite(fetchedAt)) return false
  if (fetchedAt > now + MAX_FUTURE_SECONDS) return false
  if (!saneTimes(times, fetchedAt)) return false
  if (typeof points !== "object" || points === null) return false
  const length = times.length
  const knownPoints = new Set(WIND_ZONES[zoneId].points.map(({ id }) => id))
  const knownModels = new Set<string>(WIND_MODELS.map(({ id }) => id))
  const pointsAreSound = Object.entries(points).every(
    ([point, models]) =>
      knownPoints.has(point) &&
      typeof models === "object" &&
      models !== null &&
      Object.entries(
        models as Record<string, Partial<ModelSeries> | null>,
      ).every(
        ([model, series]) =>
          knownModels.has(model) &&
          typeof series === "object" &&
          series !== null &&
          strictColumn(series.speed, length, RANGES.speed) &&
          strictColumn(series.direction, length, RANGES.direction) &&
          strictColumn(series.gust, length, RANGES.speed),
      ),
  )
  if (!pointsAreSound) return false
  return (
    isOptional(ensemble, (column) => {
      const { low, mid, high } = column as NonNullable<WindForecast["ensemble"]>
      return [low, mid, high].every((part) =>
        strictColumn(part, length, RANGES.speed),
      )
    }) &&
    isOptional(
      waves,
      (column) =>
        strictColumn(
          (column as NonNullable<WindForecast["waves"]>).height,
          length,
          RANGES.height,
        ) && extraTimeIsSane(column),
    ) &&
    isOptional(sky, (column) => {
      const { code, temperature } = column as NonNullable<WindForecast["sky"]>
      return (
        strictColumn(code, length, RANGES.code) &&
        (temperature === undefined ||
          strictColumn(temperature, length, RANGES.temperature)) &&
        extraTimeIsSane(column)
      )
    })
  )
}

function extraTimeIsSane(extra: unknown) {
  const { fetchedAt } = extra as { fetchedAt?: unknown }
  return fetchedAt === undefined || Number.isInteger(fetchedAt)
}

export function readCachedForecast(
  zoneId: WindZoneId,
  now: number = Math.floor(Date.now() / 1000),
): WindForecast | null {
  try {
    const key = cacheKey(zoneId)
    const stored = localStorage.getItem(key)
    if (!stored) return null
    const parsed: unknown = JSON.parse(stored)
    if (
      isStoredForecast(parsed, zoneId, now) &&
      now - parsed.fetchedAt <= MAX_AGE_TO_KEEP_SECONDS
    ) {
      return parsed
    }
    localStorage.removeItem(key)
    return null
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

/** The one way back from a stored forecast the screen could not draw. */
export function clearCachedForecasts() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(appChannelConfig.weatherCachePrefix)) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // Storage unavailable: nothing was stored either.
  }
}
