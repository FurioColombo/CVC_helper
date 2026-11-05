import {
  compassPoint,
  type Agreement,
  type WindPeriod,
  type WindSlot,
  type WindSummary,
  windName,
} from "@/domain/wind"
import { WIND_SESSION_HOURS } from "@/domain/windConfig"

export function formatKnots(knots: number) {
  return String(Math.round(knots))
}

export function formatRange(low: number, high: number) {
  const from = Math.round(low)
  const to = Math.round(high)
  return from === to ? `${from}` : `${from}–${to}`
}

export function directionText(degrees: number | null) {
  return degrees === null ? "Variabile" : compassPoint(degrees)
}

export function directionWithName(degrees: number | null) {
  return degrees === null
    ? "Direzione variabile"
    : `${compassPoint(degrees)} · ${windName(degrees)}`
}

const AGREEMENT_TEXT: Record<Agreement, string> = {
  alta: "Modelli concordi",
  media: "Modelli abbastanza concordi",
  bassa: "Modelli divisi: previsione incerta",
}

export function agreementText(agreement: Agreement) {
  return AGREEMENT_TEXT[agreement]
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

const updatedClock = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
})
const updatedDay = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
})

export function updatedText(fetchedAt: number, now: number) {
  const age = now - fetchedAt
  const when = new Date(fetchedAt * 1000)
  if (age < 18 * 3600) return `Aggiornato alle ${updatedClock.format(when)}`
  return `Dati di ${updatedDay.format(when)}`
}

/** One line for anywhere the wind is read out in words. */
export function summaryInWords(summary: WindSummary) {
  const gust =
    summary.gust === null ? "" : `, raffiche ${formatKnots(summary.gust)}`
  return `${directionText(summary.direction)} ${formatRange(summary.low, summary.high)} nodi${gust}`
}
