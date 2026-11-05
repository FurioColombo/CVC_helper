#!/usr/bin/env node
// The evidence behind the wind blend (src/domain/windConfig.ts).
//
// Scores archived forecasts where the app reads them, on sea cells, against the
// two exposed coastal stations on the Strait of Bonifacio. The airports stay as a
// control, on the land cell, because they say something else: bias and local
// breezes. Then it runs the real blend over the same archive and measures what
// the instructor reads: how often the range holds the wind and the gust number
// is passed. June to October 2026 only. Network required on the first run.
//
//   node scripts/weather-backtest.mjs [--cache dir] [--models-only] [output.json]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { gunzipSync } from "node:zlib"

import { build } from "esbuild"

const START = "2026-06-01"
const END = "2026-10-31"
const KNOTS_PER_MS = 1.94384

/** Cap Pertusato stands at 107 m, La Chiappa at 57 m: proxies for the water. */
const SITES = {
  PERT: {
    name: "Cap Pertusato",
    latitude: 41.374833,
    longitude: 9.178333,
    cell: "sea",
    source: "CAP PERTUSATO",
  },
  CHIA: {
    name: "La Chiappa",
    latitude: 41.594833,
    longitude: 9.363167,
    cell: "sea",
    source: "LA CHIAPPA",
  },
  LFKF: {
    name: "Figari (control)",
    latitude: 41.5,
    longitude: 9.1,
    cell: "land",
    source: "metar",
  },
  LIEO: {
    name: "Olbia (control)",
    latitude: 40.9,
    longitude: 9.52,
    cell: "land",
    source: "metar",
  },
}
const COASTAL = ["PERT", "CHIA"]
const MODELS = [
  "meteofrance_arome_france_hd",
  "meteofrance_arome_france",
  "italia_meteo_arpae_icon_2i",
  "meteofrance_arpege_europe",
  "icon_eu",
  "ecmwf_ifs",
  "ecmwf_aifs025_single",
  "gfs_global",
  "ukmo_global_deterministic_10km",
]
const LEADS = [1, 2, 3, 5, 7]
const STATIONS_FILE =
  "https://object.files.data.gouv.fr/meteofrance/data/synchro_ftp/BASE/HOR/H_20_latest-2025-2026.csv.gz"

const argv = process.argv.slice(2)
const flag = (name) => {
  const index = argv.indexOf(name)
  if (index === -1) return null
  const [value] = argv.splice(index, 2).slice(1)
  return value
}
const modelsOnly = argv.includes("--models-only")
if (modelsOnly) argv.splice(argv.indexOf("--models-only"), 1)
const CACHE = flag("--cache") ?? "test-results/weather-backtest-cache"
const OUTPUT = argv[0] ?? "docs/working/weather-backtest.json"
mkdirSync(CACHE, { recursive: true })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const round = (value, digits = 2) =>
  Math.round(value * 10 ** digits) / 10 ** digits

async function cached(key, url) {
  const file = path.join(CACHE, key)
  if (existsSync(file)) return readFileSync(file)
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(url)
    if (response.status === 429) {
      await sleep(65_000)
      continue
    }
    const body = Buffer.from(await response.arrayBuffer())
    writeFileSync(file, body)
    await sleep(1_500)
    return body
  }
  throw new Error(`rate limited: ${url}`)
}

function hourKey(seconds) {
  return new Date(seconds * 1000).toISOString().slice(0, 13).replace("T", " ")
}

async function metar(station) {
  const url =
    `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=${station}` +
    "&data=sknt&data=drct&data=gust&year1=2026&month1=6&day1=1&year2=2026&month2=11&day2=1" +
    "&tz=UTC&format=onlycomma&latlon=no&missing=empty&trace=empty&direct=yes&report_type=3&report_type=4"
  const text = (await cached(`metar_${station}.csv`, url)).toString()
  const hours = new Map()
  for (const line of text.trim().split("\n").slice(1)) {
    const [, valid, knots, direction, gust] = line.split(",")
    if (!knots) continue
    // Figari reports on the hour, Olbia at :20 and :50: :50 stands for the next
    // hour, and a report on the hour wins where both exist.
    const minute = valid.slice(14, 16)
    if (minute !== "00" && minute !== "50") continue
    const hour = new Date(`${valid.slice(0, 13).replace(" ", "T")}:00:00Z`)
    if (minute === "50") hour.setUTCHours(hour.getUTCHours() + 1)
    const key = hour.toISOString().slice(0, 13).replace("T", " ")
    if (minute === "50" && hours.has(key)) continue
    hours.set(key, {
      speed: Number(knots),
      direction: direction ? Number(direction) : null,
      gust: gust ? Number(gust) : null,
    })
  }
  return hours
}

/** Météo-France hourly open data, Licence Ouverte; FF and FXI are in m/s. */
async function stations(names) {
  const file = await cached("H_20.csv.gz", STATIONS_FILE)
  const lines = gunzipSync(file).toString("latin1").split("\n")
  const header = lines[0].split(";").map((name) => name.trim())
  const at = (name) => header.indexOf(name)
  const result = Object.fromEntries(names.map((name) => [name, new Map()]))
  for (const line of lines.slice(1)) {
    const parts = line.split(";")
    const station = result[parts[at("NOM_USUEL")]?.trim()]
    const time = parts[at("AAAAMMJJHH")]
    if (!station || !time || time < "2026060100" || time > "2026110100") {
      continue
    }
    const speed = parts[at("FF")]?.trim()
    if (!speed) continue
    const direction = parts[at("DD")]?.trim()
    const gust = parts[at("FXI")]?.trim()
    station.set(
      `${time.slice(0, 4)}-${time.slice(4, 6)}-${time.slice(6, 8)} ${time.slice(8, 10)}`,
      {
        speed: Number(speed) * KNOTS_PER_MS,
        direction: direction ? Number(direction) : null,
        gust: gust ? Number(gust) * KNOTS_PER_MS : null,
      },
    )
  }
  return result
}

async function archive(kind, site, model) {
  const { latitude, longitude, cell } = SITES[site]
  const place =
    `latitude=${latitude}&longitude=${longitude}&start_date=${START}&end_date=${END}` +
    `&wind_speed_unit=kn&timezone=GMT&cell_selection=${cell}&models=${model}`
  const url =
    kind === "hist"
      ? `https://historical-forecast-api.open-meteo.com/v1/forecast?${place}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m`
      : `https://previous-runs-api.open-meteo.com/v1/forecast?${place}&hourly=${LEADS.map(
          (lead) => `wind_speed_10m_previous_day${lead}`,
        )
          .concat([
            "wind_direction_10m_previous_day1",
            "wind_gusts_10m_previous_day1",
          ])
          .join(",")}`
  const body = await cached(`${kind}_${site}_${cell}_${model}.json`, url)
  const json = JSON.parse(body.toString())
  if (!json.hourly) return null
  return {
    times: json.hourly.time.map((time) => Date.parse(`${time}:00Z`) / 1000),
    hourly: json.hourly,
  }
}

const mean = (values) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null

/** Sailing hours only: 07-16 UTC is 09-18 in Caprera's summer. */
function sailingHour(seconds) {
  const hour = new Date(seconds * 1000).getUTCHours()
  return hour >= 7 && hour <= 16
}

/**
 * Scores on a common sample: only the hours every model reaching this lead has,
 * so a model that started in August is not compared with one scored since June.
 */
function scoreLead(columns, observed) {
  const reaching = Object.entries(columns).filter(
    ([, column]) =>
      column.values.filter((value) => value !== null).length > 500,
  )
  const errors = Object.fromEntries(reaching.map(([model]) => [model, []]))
  const times = reaching[0]?.[1].times ?? []
  times.forEach((time, index) => {
    if (!sailingHour(time)) return
    const seen = observed.get(hourKey(time))
    if (!seen) return
    const values = reaching.map(([, column]) => column.values[index])
    if (values.some((value) => value === null || value === undefined)) return
    reaching.forEach(([model], position) => {
      errors[model].push(values[position] - seen.speed)
    })
  })
  return Object.fromEntries(
    Object.entries(errors).map(([model, list]) => [
      model,
      {
        n: list.length,
        mae: round(mean(list.map(Math.abs))),
        bias: round(mean(list)),
      },
    ]),
  )
}

const observations = {
  LFKF: await metar("LFKF"),
  LIEO: await metar("LIEO"),
}
const coastal = await stations(COASTAL.map((site) => SITES[site].source))
for (const site of COASTAL) observations[site] = coastal[SITES[site].source]

const forecasts = {}
const scores = {}
for (const site of Object.keys(SITES)) {
  forecasts[site] = { hist: {}, prev: {} }
  for (const model of MODELS) {
    forecasts[site].hist[model] = await archive("hist", site, model)
    forecasts[site].prev[model] = await archive("prev", site, model)
  }
  scores[site] = { short: {}, leads: {} }
  const shortColumns = {}
  for (const model of MODELS) {
    const data = forecasts[site].hist[model]
    if (data) {
      shortColumns[model] = {
        times: data.times,
        values: data.hourly.wind_speed_10m,
      }
    }
  }
  scores[site].short = scoreLead(shortColumns, observations[site])
  for (const lead of LEADS) {
    const columns = {}
    for (const model of MODELS) {
      const data = forecasts[site].prev[model]
      const values = data?.hourly[`wind_speed_10m_previous_day${lead}`]
      if (values) columns[model] = { times: data.times, values }
    }
    scores[site].leads[`d${lead}`] = scoreLead(columns, observations[site])
  }
}

/** Each model's share of 1/MAE² at a lead, over the coastal stations. */
function shares(pick) {
  const totals = {}
  for (const site of COASTAL) {
    for (const [model, score] of Object.entries(pick(scores[site]) ?? {})) {
      totals[model] ??= []
      totals[model].push(score.mae)
    }
  }
  const inverse = Object.entries(totals)
    .filter(([, list]) => list.length === COASTAL.length)
    .map(([model, list]) => [model, 1 / mean(list) ** 2])
  const sum = inverse.reduce((total, [, value]) => total + value, 0)
  return Object.fromEntries(
    inverse.map(([model, value]) => [model, round((100 * value) / sum, 1)]),
  )
}
const modelShares = {
  short: shares((site) => site.short),
  ...Object.fromEntries(
    LEADS.map((lead) => [`d${lead}`, shares((site) => site.leads[`d${lead}`])]),
  ),
}

async function bundledDomain() {
  const outfile = path.resolve(CACHE, "wind.bundle.mjs")
  await build({
    stdin: {
      contents:
        'export * from "@/domain/wind"\nexport { WIND_SESSION_HOURS } from "@/domain/windConfig"',
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
    alias: { "@": path.resolve("src") },
  })
  return import(`file://${outfile}?${Date.now()}`)
}

/** What the screen says for one session, against what the station measured. */
function evaluateBlend(domain, site, kind, leadHours) {
  const suffix = kind === "prev" ? "_previous_day1" : ""
  const source = forecasts[site][kind]
  const usable = Object.entries(source).filter(([, data]) => data)
  const times = usable[0][1].times
  const positions = new Map(times.map((time, index) => [time, index]))
  const series = Object.fromEntries(
    usable.map(([model, { hourly }]) => [
      model,
      {
        speed: hourly[`wind_speed_10m${suffix}`] ?? times.map(() => null),
        direction:
          hourly[`wind_direction_10m${suffix}`] ?? times.map(() => null),
        gust: hourly[`wind_gusts_10m${suffix}`] ?? times.map(() => null),
      },
    ]),
  )
  const observed = observations[site]
  const tally = {
    sessions: 0,
    hours: 0,
    insideRange: 0,
    aboveRange: 0,
    width: 0,
    midError: 0,
    gustSessions: 0,
    gustBias: 0,
    gustPassed: 0,
    split: 0,
    splitError: 0,
    calmError: 0,
    directionError: 0,
    directionHours: 0,
  }
  const first = Date.parse(`${START}T00:00:00Z`) / 1000
  const last = Date.parse(`${END}T00:00:00Z`) / 1000
  for (let day = first; day <= last; day += 86_400) {
    for (const period of ["AM", "PM"]) {
      const { start, end } = domain.WIND_SESSION_HOURS[period]
      const date = new Date(day * 1000).toISOString().slice(0, 10)
      const inSession = times.filter((time) => {
        if (time < day - 7_200 || time > day + 93_600) return false
        const clock = domain.romeClock(time)
        return clock.date === date && clock.hour >= start && clock.hour < end
      })
      if (inSession.length === 0) continue
      const from = positions.get(inSession[0])
      const to = positions.get(inSession[inSession.length - 1]) + 8
      const forecast = {
        fetchedAt: inSession[0] - leadHours * 3600,
        times: times.slice(from, to),
        points: {
          p: Object.fromEntries(
            Object.entries(series).map(([model, column]) => [
              model,
              {
                speed: column.speed.slice(from, to),
                direction: column.direction.slice(from, to),
                gust: column.gust.slice(from, to),
              },
            ]),
          ),
        },
      }
      const hours = domain
        .blendForecast(forecast, inSession[0], ["p"])
        .filter((hour) => inSession.includes(hour.time))
      if (hours.length !== inSession.length) continue
      // Like with like: only sessions the high-resolution models reach.
      if (hours.some((hour) => hour.models.length < 5)) continue
      const seen = inSession
        .map((time) => observed.get(hourKey(time)))
        .filter(Boolean)
      if (seen.length < 3) continue
      const summary = domain.summariseHours(hours)
      tally.sessions += 1
      tally.width += summary.high - summary.low
      const speeds = seen.map((reading) => reading.speed)
      for (const speed of speeds) {
        tally.hours += 1
        if (speed >= summary.low && speed <= summary.high)
          tally.insideRange += 1
        if (speed > summary.high) tally.aboveRange += 1
      }
      const sessionError = Math.abs(summary.mid - mean(speeds))
      tally.midError += sessionError
      if (summary.split) {
        tally.split += 1
        tally.splitError += sessionError
      } else {
        tally.calmError += sessionError
      }
      if (summary.direction !== null) {
        for (const reading of seen) {
          if (reading.direction === null || reading.speed < 5) continue
          tally.directionError += domain.angleBetween(
            summary.direction,
            reading.direction,
          )
          tally.directionHours += 1
        }
      }
      const gusts = seen.flatMap((reading) =>
        reading.gust === null ? [] : [reading.gust],
      )
      if (gusts.length && summary.gust !== null) {
        const peak = Math.max(...gusts)
        tally.gustSessions += 1
        tally.gustBias += summary.gust - peak
        if (peak > summary.gust) tally.gustPassed += 1
      }
    }
  }
  const share = (part, whole) => (whole ? round((100 * part) / whole, 0) : null)
  return {
    sessions: tally.sessions,
    hoursInsideRangePercent: share(tally.insideRange, tally.hours),
    hoursAboveRangePercent: share(tally.aboveRange, tally.hours),
    rangeWidth: round(tally.width / tally.sessions, 1),
    sessionMeanMae: round(tally.midError / tally.sessions),
    gustBias: round(tally.gustBias / tally.gustSessions, 1),
    gustPassedPercent: share(tally.gustPassed, tally.gustSessions),
    splitSessionsPercent: share(tally.split, tally.sessions),
    maeWhenSplit: tally.split ? round(tally.splitError / tally.split) : null,
    maeWhenNot:
      tally.sessions > tally.split
        ? round(tally.calmError / (tally.sessions - tally.split))
        : null,
    directionMae: tally.directionHours
      ? round(tally.directionError / tally.directionHours, 0)
      : null,
  }
}

const blend = {}
if (!modelsOnly) {
  const domain = await bundledDomain()
  for (const site of Object.keys(SITES)) {
    blend[site] = {
      short: evaluateBlend(domain, site, "hist", 6),
      plusOneDay: evaluateBlend(domain, site, "prev", 30),
    }
  }
}

writeFileSync(
  OUTPUT,
  `${JSON.stringify(
    { start: START, end: END, sites: SITES, scores, modelShares, blend },
    null,
    1,
  )}\n`,
)
console.log(JSON.stringify({ modelShares, blend }, null, 1))
for (const lead of ["short", "leads"]) {
  if (lead === "short") {
    for (const site of Object.keys(SITES)) {
      console.log(
        site,
        "short",
        Object.entries(scores[site].short)
          .map(([model, score]) => `${model.slice(0, 18)} ${score.mae}`)
          .join(" | "),
      )
    }
  } else {
    for (const site of Object.keys(SITES)) {
      for (const [name, row] of Object.entries(scores[site].leads)) {
        console.log(
          site,
          name,
          Object.entries(row)
            .map(([model, score]) => `${model.slice(0, 14)} ${score.mae}`)
            .join(" | "),
        )
      }
    }
  }
}
