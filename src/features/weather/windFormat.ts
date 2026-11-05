import {
  compassPoint,
  type WindPeriod,
  type WindSlot,
  type WindSummary,
  windName,
} from "@/domain/wind"
import { WIND_SESSION_HOURS, WIND_TINTS } from "@/domain/windConfig"

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

/** Short enough for Home's small line. */
export function ageForStrip(fetchedAt: number, now: number) {
  const days = dayNumber(now) - dayNumber(fetchedAt)
  const when = clock.format(new Date(fetchedAt * 1000))
  return days === 0 ? `dati delle ${when}` : `dati di ieri ${when}`
}

/** The whole reading in words, for a name a screen reader says at once. */
export function summaryInWords(summary: WindSummary) {
  const tilde = summary.reach === "near" ? "" : "circa "
  const gust =
    summary.gust === null ? "" : `, raffiche ${formatKnots(summary.gust)}`
  return `${directionText(summary.direction)} ${tilde}${formatKnots(summary.mid)} nodi${gust}`
}

/** What the models are divided over and what to do with it; null when they agree. */
export function splitText(summary: WindSummary) {
  if (summary.split === "speed") {
    return `Modelli divisi sulla forza, tra ${formatKnots(summary.low)} e ${formatKnots(summary.high)}: preparati per ${formatKnots(summary.high)}`
  }
  if (summary.split === "direction") {
    return summary.directionOptions
      ? `Modelli divisi sulla direzione: ${compassPoint(summary.directionOptions[0])} o ${compassPoint(summary.directionOptions[1])}`
      : "Modelli divisi sulla direzione"
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

export function tintFor(knots: number) {
  let tint: (typeof WIND_TINTS)[number] = WIND_TINTS[0]
  for (const candidate of WIND_TINTS) {
    if (knots >= candidate.fromKnots) tint = candidate
  }
  return tint
}
