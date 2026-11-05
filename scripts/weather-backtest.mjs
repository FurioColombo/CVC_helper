#!/usr/bin/env node
// Scores archived model forecasts against the METAR reports of the two airports
// nearest Caprera, at short range and at longer lead times. Its output is the
// evidence behind the blend weights in src/domain/wind.ts. Network required.
//   node scripts/weather-backtest.mjs [output.json]
import { writeFileSync } from "node:fs"

const START = "2026-06-01"
const END = "2026-10-31"
const STATIONS = [
  { id: "LFKF", name: "Figari", lat: 41.5, lon: 9.1 },
  { id: "LIEO", name: "Olbia", lat: 40.9, lon: 9.52 },
]
const MODELS = [
  "meteofrance_arome_france_hd",
  "meteofrance_arome_france",
  "italia_meteo_arpae_icon_2i",
  "dmi_harmonie_arome_europe",
  "knmi_harmonie_arome_europe",
  "meteofrance_arpege_europe",
  "icon_eu",
  "icon_global",
  "ecmwf_ifs",
  "ecmwf_ifs025",
  "ecmwf_aifs025_single",
  "gfs_global",
  "ukmo_global_deterministic_10km",
]
const LEADS = [1, 2, 3, 5, 7]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function getJson(url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url)
    if (response.status === 429) {
      await sleep(65_000)
      continue
    }
    return response.json()
  }
  throw new Error(`rate limited: ${url}`)
}

async function observations(station) {
  const url =
    `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=${station.id}` +
    "&data=sknt&data=drct&year1=2026&month1=6&day1=1&year2=2026&month2=11&day2=1" +
    "&tz=UTC&format=onlycomma&latlon=no&missing=empty&trace=empty&direct=yes&report_type=3&report_type=4"
  const text = await (await fetch(url)).text()
  const hours = new Map()
  for (const line of text.trim().split("\n").slice(1)) {
    const [, valid, knots, direction] = line.split(",")
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
    })
  }
  return hours
}

function angleBetween(a, b) {
  const difference = Math.abs(a - b) % 360
  return difference > 180 ? 360 - difference : difference
}

function summarise(records) {
  if (records.length === 0) return null
  const round = (value) => Math.round(value * 100) / 100
  const directions = records.flatMap((r) => (r.angle === null ? [] : [r.angle]))
  return {
    n: records.length,
    mae: round(
      records.reduce((sum, r) => sum + Math.abs(r.error), 0) / records.length,
    ),
    bias: round(records.reduce((sum, r) => sum + r.error, 0) / records.length),
    directionMae: directions.length
      ? Math.round(
          directions.reduce((sum, a) => sum + a, 0) / directions.length,
        )
      : null,
  }
}

function score(times, speeds, directions, hours) {
  const buckets = { day: [], strong: [], maestrale: [], scirocco: [] }
  times.forEach((time, index) => {
    const speed = speeds[index]
    const observed = hours.get(time.replace("T", " ").slice(0, 13))
    if (speed === null || speed === undefined || !observed) return
    // Sailing hours only: 07-16 UTC is 09-18 in Caprera's summer.
    const hour = Number(time.slice(11, 13))
    if (hour < 7 || hour > 16) return
    const hasDirection = observed.direction !== null && observed.speed >= 5
    const record = {
      error: speed - observed.speed,
      angle:
        hasDirection && directions?.[index] != null
          ? angleBetween(directions[index], observed.direction)
          : null,
    }
    buckets.day.push(record)
    if (observed.speed >= 15) buckets.strong.push(record)
    if (
      hasDirection &&
      (observed.direction >= 240 || observed.direction <= 20)
    ) {
      buckets.maestrale.push(record)
    }
    if (hasDirection && observed.direction >= 60 && observed.direction <= 170) {
      buckets.scirocco.push(record)
    }
  })
  return Object.fromEntries(
    Object.entries(buckets).map(([name, records]) => [
      name,
      summarise(records),
    ]),
  )
}

const rows = []
for (const station of STATIONS) {
  const hours = await observations(station)
  const place = `latitude=${station.lat}&longitude=${station.lon}&start_date=${START}&end_date=${END}&wind_speed_unit=kn&timezone=GMT`
  for (const model of MODELS) {
    const shortRange = await getJson(
      `https://historical-forecast-api.open-meteo.com/v1/forecast?${place}&hourly=wind_speed_10m,wind_direction_10m&models=${model}`,
    )
    await sleep(1_500)
    if (!shortRange.hourly) continue
    const leadVariables = LEADS.map(
      (d) => `wind_speed_10m_previous_day${d}`,
    ).join(",")
    const previous = await getJson(
      `https://previous-runs-api.open-meteo.com/v1/forecast?${place}&hourly=${leadVariables}&models=${model}`,
    )
    await sleep(1_500)
    const leads = {}
    for (const lead of LEADS) {
      const series = previous.hourly?.[`wind_speed_10m_previous_day${lead}`]
      if (series)
        leads[`d${lead}`] = score(previous.hourly.time, series, null, hours).day
    }
    const row = {
      station: station.id,
      model,
      grid: [shortRange.latitude, shortRange.longitude],
      ...score(
        shortRange.hourly.time,
        shortRange.hourly.wind_speed_10m,
        shortRange.hourly.wind_direction_10m,
        hours,
      ),
      leads,
    }
    rows.push(row)
    console.log(JSON.stringify(row))
  }
}

const output = process.argv[2] ?? "docs/working/weather-backtest.json"
writeFileSync(
  output,
  `${JSON.stringify({ start: START, end: END, stations: STATIONS, rows }, null, 1)}\n`,
)
