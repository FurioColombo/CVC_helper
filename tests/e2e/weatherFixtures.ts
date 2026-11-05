import { crc32, deflateSync } from "node:zlib"

import type { Page, Route } from "@playwright/test"

/**
 * Synthetic Open-Meteo and LaMMA answers for the Vento journeys. Nothing here
 * is a real forecast. The scenario is small enough to check by hand:
 *
 * - Every model, at every sea point, sends 10 kn from 315 with gusts of 22,
 *   except in the windows below.
 * - Saturday 7 Nov, 14-18 (Sat PM, the course's first session): all models
 *   send 15 kn from 315 (NW, Maestrale) with gusts of 32. At Spargi, a
 *   Cabinati place, the wind is 18 kn with gusts of 38.
 * - Sunday 8 Nov, 9-13 (Sun AM): the models disagree. Four of them send 6 kn
 *   from 135, the other three 20 kn from 315, so the screen must say so.
 * - Sunday 8 Nov, 14-18 (Sun PM): the sky codes say thunder.
 * - Wednesday 11 Nov, 9-18: 24 kn with gusts of 50, for the widest cell values.
 * - The 51 ensemble members agree with the models (15 kn; 13 kn on Sun AM).
 * - Waves are 0.5 m and the rest of the sky is clear (code 1).
 */

export const WEATHER_NOW = new Date("2026-11-07T09:00:00+01:00")

/** 2026-11-05 00:00 in Rome (CET, UTC+1), as Unix seconds. */
const FIRST_HOUR = Date.UTC(2026, 10, 4, 23) / 1000
const HOURS = 8 * 24

const SPARGI_LATITUDE = 41.24

const DISAGREEING_LOW = new Set([
  "icon_eu",
  "ecmwf_aifs025_single",
  "gfs_global",
  "meteofrance_arpege_europe",
])

type Reading = { speed: number; direction: number; gust: number }

function reading(model: string, latitude: number, index: number): Reading {
  const day = Math.floor(index / 24)
  const hour = index % 24
  // Day 2 is Saturday 7 Nov, day 3 Sunday 8 Nov (day 0 is Thursday 5 Nov).
  if (day === 2 && hour >= 14 && hour < 18) {
    return latitude === SPARGI_LATITUDE
      ? { speed: 18, direction: 315, gust: 38 }
      : { speed: 15, direction: 315, gust: 32 }
  }
  if (day === 3 && hour >= 9 && hour < 13) {
    return DISAGREEING_LOW.has(model)
      ? { speed: 6, direction: 135, gust: 13 }
      : { speed: 20, direction: 315, gust: 42 }
  }
  if (day === 6 && hour >= 9 && hour < 18) {
    return { speed: 24, direction: 315, gust: 50 }
  }
  return { speed: 10, direction: 315, gust: 22 }
}

function ensembleSpeed(index: number) {
  const day = Math.floor(index / 24)
  const hour = index % 24
  return day === 3 && hour >= 9 && hour < 13 ? 13 : 15
}

function skyCode(index: number) {
  const day = Math.floor(index / 24)
  const hour = index % 24
  return day === 3 && hour >= 14 && hour < 18 ? 95 : 1
}

const times = Array.from({ length: HOURS }, (_, i) => FIRST_HOUR + i * 3600)

function forecastLocation(
  models: readonly string[],
  latitude: number,
): { hourly: Record<string, unknown> } {
  const hourly: Record<string, unknown> = { time: times }
  for (const model of models) {
    const readings = times.map((_, i) => reading(model, latitude, i))
    hourly[`wind_speed_10m_${model}`] = readings.map((r) => r.speed)
    hourly[`wind_direction_10m_${model}`] = readings.map((r) => r.direction)
    hourly[`wind_gusts_10m_${model}`] = readings.map((r) => r.gust)
  }
  return { hourly }
}

export type WeatherHost = {
  /** Every request that reached a weather host, aborted ones included. */
  requests: string[]
  /** Anything else that left the app: there must never be any. */
  otherOffOrigin: string[]
  /** false: every weather API call fails, as without signal. */
  online: boolean
  /** false: LaMMA's image fails to load. */
  lamma: boolean
  /** true: the API answers with hours that are not hours. */
  malformed: boolean
  /** Set: the API holds every answer until this settles. */
  hold: Promise<void> | null
}

function pngChunk(type: string, data: Buffer) {
  const body = Buffer.concat([Buffer.from(type, "latin1"), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const check = Buffer.alloc(4)
  check.writeUInt32BE(crc32(body) >>> 0)
  return Buffer.concat([length, body, check])
}

/** A plain grey image in LaMMA's own proportions, 1168 by 820 cut by four. */
function greyMap(width: number, height: number) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // eight bits, grey
  const rows = Buffer.alloc((width + 1) * height, 0xc8)
  for (let row = 0; row < height; row += 1) rows[row * (width + 1)] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0)),
  ])
}

const MAP_PNG = greyMap(292, 205)
/** LaMMA's wave map is a little wider than its wind map: 1181 by 820. */
const WAVE_MAP_PNG = greyMap(295, 205)

const CORS = { "access-control-allow-origin": "*" }
export const WEATHER_HOSTS = [
  "api.open-meteo.com",
  "ensemble-api.open-meteo.com",
  "marine-api.open-meteo.com",
  "www.lamma.toscana.it",
]

function numbers(value: string | null) {
  return (value ?? "").split(",").map(Number)
}

function apiAnswer(url: URL): unknown {
  const latitudes = numbers(url.searchParams.get("latitude"))
  const hourly = url.searchParams.get("hourly") ?? ""
  const respond = (build: (latitude: number) => object) => {
    const locations = latitudes.map(build)
    return locations.length === 1 ? locations[0] : locations
  }
  if (url.hostname === "ensemble-api.open-meteo.com") {
    return respond(() => {
      const members: Record<string, unknown> = { time: times }
      for (let member = 0; member < 51; member += 1) {
        members[`wind_speed_10m_member${String(member).padStart(2, "0")}`] =
          times.map((_, i) => ensembleSpeed(i))
      }
      return { hourly: members }
    })
  }
  if (url.hostname === "marine-api.open-meteo.com") {
    return respond(() => ({
      hourly: { time: times, wave_height: times.map(() => 0.5) },
    }))
  }
  if (hourly.includes("weather_code")) {
    return respond(() => ({
      hourly: { time: times, weather_code: times.map((_, i) => skyCode(i)) },
    }))
  }
  const models = (url.searchParams.get("models") ?? "").split(",")
  return respond((latitude) => forecastLocation(models, latitude))
}

/** Routes all four weather hosts; the returned object steers and records. */
export async function routeWeather(page: Page): Promise<WeatherHost> {
  const host: WeatherHost = {
    requests: [],
    otherOffOrigin: [],
    online: true,
    lamma: true,
    malformed: false,
    hold: null,
  }
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (WEATHER_HOSTS.includes(url.hostname)) {
      host.requests.push(request.url())
    } else if (
      url.protocol.startsWith("http") &&
      !["127.0.0.1", "localhost"].includes(url.hostname)
    ) {
      host.otherOffOrigin.push(request.url())
    }
  })
  const handler = async (route: Route) => {
    const url = new URL(route.request().url())
    if (url.hostname === "www.lamma.toscana.it") {
      if (!host.lamma || !host.online) return route.abort("failed")
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: url.pathname.includes("swh") ? WAVE_MAP_PNG : MAP_PNG,
      })
    }
    if (!host.online) return route.abort("internetdisconnected")
    if (host.hold) await host.hold
    const answer = host.malformed
      ? { hourly: { time: ["x", 1e300], wind_speed_10m_ecmwf_ifs: [1, 2] } }
      : apiAnswer(url)
    // The page may have aborted a held request while it waited.
    return route
      .fulfill({
        status: 200,
        contentType: "application/json",
        headers: CORS,
        body: JSON.stringify(answer),
      })
      .catch(() => undefined)
  }
  for (const hostname of WEATHER_HOSTS) {
    await page.route(`https://${hostname}/**`, handler)
  }
  return host
}

/** The main multi-point wind request, among a download's three or four. */
export function windRequests(host: WeatherHost) {
  return host.requests.filter(
    (url) =>
      url.startsWith("https://api.open-meteo.com/") &&
      url.includes("wind_speed_10m"),
  )
}

export function pointsOf(url: string) {
  const query = new URL(url).searchParams
  return {
    latitudes: (query.get("latitude") ?? "").split(",").map(Number),
    longitudes: (query.get("longitude") ?? "").split(",").map(Number),
  }
}
