import {
  compassPoint,
  type WindPeriod,
  type WindSlot,
  type WindSummary,
  windName,
} from "@/domain/wind"
import {
  WEATHER_KINDS,
  WIND_SESSION_HOURS,
  WIND_TINTS,
  type WeatherKindId,
} from "@/domain/windConfig"

export function formatKnots(knots: number) {
  return String(Math.round(knots))
}

export function formatRange(low: number, high: number) {
  const from = Math.round(low)
  const to = Math.round(high)
  return from === to ? `${from}` : `${from}–${to}`
}

const decimal = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 })

export function formatDecimal(value: number) {
  return decimal.format(value)
}

export function directionText(degrees: number | null) {
  return degrees === null ? "Variabile" : compassPoint(degrees)
}

export function directionWithName(degrees: number | null) {
  return degrees === null
    ? "Direzione variabile"
    : `${compassPoint(degrees)} · ${windName(degrees)}`
}

export function periodHours(period: WindPeriod) {
  const { start, end } = WIND_SESSION_HOURS[period]
  return `${start}–${end}`
}

const dayLong = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  timeZone: "UTC",
})
const dayShort = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  timeZone: "UTC",
})

function atNoon(date: string) {
  return new Date(`${date}T12:00:00Z`)
}

function capitalised(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function slotLabel(slot: WindSlot) {
  return `${capitalised(dayLong.format(atNoon(slot.date)))} ${slot.period}`
}

export function slotShortLabel(slot: WindSlot) {
  return `${capitalised(dayShort.format(atNoon(slot.date)))} ${slot.period}`
}

export function dayRowLabel(date: string) {
  return {
    day: capitalised(dayShort.format(atNoon(date))),
    number: String(Number(date.slice(8, 10))),
  }
}

const clock = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
})
const weekdayClock = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
})
const romeDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" })

function dayNumber(seconds: number) {
  return Date.parse(`${romeDate.format(seconds * 1000)}T00:00:00Z`) / 86_400_000
}

/** A forecast's age in words: colour and icon only reinforce what this says. */
export function updatedText(fetchedAt: number, now: number) {
  const age = now - fetchedAt
  const when = new Date(fetchedAt * 1000)
  if (age < 6 * 3600) return `Aggiornato alle ${clock.format(when)}`
  const days = dayNumber(now) - dayNumber(fetchedAt)
  if (days === 0) {
    return `Dati di ${Math.floor(age / 3600)} ore fa, delle ${clock.format(when)}`
  }
  if (days === 1) return `Dati di ieri alle ${clock.format(when)}`
  const [weekday, time] = weekdayClock.format(when).split(/,?\s+/)
  return `Dati di ${weekday} alle ${time}`
}

/** The age beside a refresh running or failed, where "Aggiornato" would be false. */
export function dataAgeText(fetchedAt: number, now: number) {
  return now - fetchedAt < 6 * 3600
    ? `Dati delle ${clock.format(new Date(fetchedAt * 1000))}`
    : updatedText(fetchedAt, now)
}

/** One line even at 360 px, so the screen below does not move when it ends. */
export function refreshingText(fetchedAt: number, now: number) {
  const when = new Date(fetchedAt * 1000)
  const days = dayNumber(now) - dayNumber(fetchedAt)
  if (days === 0) return `Aggiorno… dati delle ${clock.format(when)}`
  if (days === 1) return `Aggiorno… dati di ieri ${clock.format(when)}`
  const [weekday, time] = weekdayClock.format(when).split(/,?\s+/)
  return `Aggiorno… dati di ${weekday?.slice(0, 3)} ${time}`
}

/** Short enough for Home's small line. */
export function ageForStrip(fetchedAt: number, now: number) {
  const days = dayNumber(now) - dayNumber(fetchedAt)
  const when = clock.format(new Date(fetchedAt * 1000))
  return days === 0 ? `dati delle ${when}` : `dati di ieri ${when}`
}

export function weatherLabel(kind: WeatherKindId) {
  return WEATHER_KINDS.find((item) => item.id === kind)?.label ?? ""
}

export function formatTemperature(celsius: number) {
  return `${Math.round(celsius)}°`
}

type Sky = Pick<WindSummary, "weather" | "temperature">

/** The sky in a line; thunder has its own, red, so it is not said twice. */
export function skyText({ weather, temperature }: Sky) {
  const parts: string[] = []
  if (weather && weather !== "storm") parts.push(weatherLabel(weather))
  if (temperature) {
    parts.push(`${formatRange(temperature.low, temperature.high)} °C`)
  }
  return parts.length === 0 ? null : parts.join(" · ")
}

function skySpoken({ weather, temperature }: Sky) {
  const parts: string[] = []
  if (weather && weather !== "storm") parts.push(weatherLabel(weather))
  if (temperature) {
    const low = Math.round(temperature.low)
    const high = Math.round(temperature.high)
    parts.push(low === high ? `${low} gradi` : `da ${low} a ${high} gradi`)
  }
  return parts.length === 0 ? "" : ` ${capitalised(parts.join(", "))}.`
}

/** One hour's sky for a screen reader, after its wind. */
export function hourSkyInWords(hour: {
  weather: WeatherKindId | null
  temperature: number | null
}) {
  return (
    (hour.weather ? `, ${weatherLabel(hour.weather).toLowerCase()}` : "") +
    (hour.temperature === null ? "" : `, ${Math.round(hour.temperature)} gradi`)
  )
}

/** The whole reading in words, for a name a screen reader says at once. */
export function summaryInWords(summary: WindSummary) {
  const tilde = summary.reach === "near" ? "" : "circa "
  const gust =
    summary.gust === null ? "" : `, raffiche ${formatKnots(summary.gust)}`
  return `${directionText(summary.direction)} ${tilde}${formatKnots(summary.mid)} nodi${gust}`
}

/** One whole reading for a name or an announcement: nothing the eye gets is left out. */
export function spokenSummary(summary: WindSummary) {
  return (
    `${summaryInWords(summary)}.` +
    (summary.thunder ? " Temporali possibili." : "") +
    skySpoken(summary) +
    (summary.split ? " Modelli divisi." : "") +
    (summary.reach === "near" ? "" : " Solo una tendenza.")
  )
}

/** What the models are divided over, in the numbers each camp says; null when they agree. */
export function splitText(summary: WindSummary) {
  if (summary.split === "speed") {
    return `Modelli divisi sulla forza: tra ${formatKnots(summary.low)} e ${formatKnots(summary.high)}, e può superare ${formatKnots(summary.high)}`
  }
  if (summary.split === "direction") {
    if (!summary.directionOptions) return "Modelli divisi sulla direzione"
    const [first, second] = summary.directionOptions
    return `Modelli divisi: ${compassPoint(first.direction)} ${formatKnots(first.speed)} o ${compassPoint(second.direction)} ${formatKnots(second.speed)}`
  }
  return null
}

export function changeText(summary: WindSummary) {
  const parts: string[] = []
  const span = `da ${formatKnots(summary.firstMid)} a ${formatKnots(summary.lastMid)}`
  if (summary.trend === "rinforzo") parts.push(`In rinforzo, ${span}`)
  if (summary.trend === "calo") parts.push(`In calo, ${span}`)
  if (summary.turning) {
    parts.push(
      `gira da ${directionText(summary.firstDirection)} a ${directionText(summary.lastDirection)}`,
    )
  }
  return parts.length === 0 ? null : capitalised(parts.join("; "))
}

/** Red only for thunder, except where red cannot be seen: white on the darkest tint. */
export function thunderColor(tint: (typeof WIND_TINTS)[number]) {
  return tint.color === "#ffffff" ? tint.color : "#b42318"
}

export function tintFor(knots: number) {
  let tint: (typeof WIND_TINTS)[number] = WIND_TINTS[0]
  for (const candidate of WIND_TINTS) {
    if (knots >= candidate.fromKnots) tint = candidate
  }
  return tint
}
