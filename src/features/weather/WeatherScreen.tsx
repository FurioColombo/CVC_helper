import {
  ArrowDown,
  ChevronDown,
  CircleHelp,
  CloudLightning,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
  WifiOff,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState, type RefObject } from "react"

import { Button } from "@/components/ui/button"
import {
  beaufort,
  blendForecast,
  compassPoint8,
  defaultHorizon,
  hoursInSlot,
  nextDecisionSlot,
  romeClock,
  slotInProgress,
  slotsForHorizon,
  summariseHours,
  type BlendedHour,
  type WindForecast,
  type WindHorizon,
  type WindSlot,
  type WindSummary,
} from "@/domain/wind"
import {
  DATA_CREDIT,
  WEATHER_LINKS,
  WIND_MODELS,
  WIND_ZONES,
  zoneForCourse,
  type WindZoneId,
} from "@/domain/windConfig"
import type { LammaField } from "@/features/weather/lammaMap"
import { WindLammaMap } from "@/features/weather/WindLammaMap"
import { Segmented } from "@/features/weather/Segmented"
import {
  useWindForecast,
  type WindDownloadState,
} from "@/features/weather/useWindForecast"
import { WindArrow, WindDial } from "@/features/weather/WindArrow"
import { WindChart } from "@/features/weather/WindChart"
import {
  changeText,
  dataAgeText,
  dayRowLabel,
  refreshingText,
  directionText,
  directionWithName,
  formatDecimal,
  formatKnots,
  formatRange,
  periodHours,
  slotLabel,
  slotShortLabel,
  spokenSummary,
  splitText,
  summaryInWords,
  thunderColor,
  tintFor,
  updatedText,
} from "@/features/weather/windFormat"
import type { CourseRecord } from "@/persistence/courses"

const STALE_AFTER_SECONDS = 6 * 3600
const VERY_STALE_AFTER_SECONDS = 24 * 3600

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false
}

function StatusLine({
  forecast,
  state,
  now,
  description,
  onRefresh,
}: {
  forecast: WindForecast | null
  state: WindDownloadState
  now: number
  description: string
  onRefresh: () => void
}) {
  const age = forecast ? now - forecast.fetchedAt : 0
  const stale = forecast !== null && age >= STALE_AFTER_SECONDS
  const veryStale = forecast !== null && age >= VERY_STALE_AFTER_SECONDS
  const failed = state === "failed"
  const loading = state === "loading"
  const marked = stale || failed
  const offline = isOffline()
  const failure = offline
    ? "Senza rete."
    : "Aggiornamento non riuscito, riprova tra poco."
  return (
    <div
      className={
        marked
          ? "flex items-center justify-between gap-2 rounded-xl bg-[#fff4ee] px-3 py-1 text-sm text-[#7f2f17]"
          : "flex items-center justify-between gap-2 px-1 py-1 text-sm text-muted-foreground"
      }
    >
      <div className="min-w-0">
        <p className="m-0">{description}</p>
        <p className="m-0 flex items-start gap-1.5 font-semibold" role="status">
          {failed && offline && (
            <WifiOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          )}
          {((failed && !offline) || (!failed && stale)) && (
            <TriangleAlert
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
          )}
          <span className="min-w-0">
            {loading && !forecast && "Aggiorno le previsioni…"}
            {failed && `${failure} `}
            {!forecast && failed && "Previsioni non scaricate."}
            {forecast && loading && refreshingText(forecast.fetchedAt, now)}
            {forecast &&
              !loading &&
              (failed
                ? dataAgeText(forecast.fetchedAt, now)
                : updatedText(forecast.fetchedAt, now))}
            {veryStale && !loading && ": potrebbero essere superati"}
          </span>
        </p>
      </div>
      <button
        aria-disabled={loading}
        aria-label="Aggiorna le previsioni"
        className="grid size-11 shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring aria-disabled:opacity-60"
        onClick={() => {
          if (!loading) onRefresh()
        }}
        type="button"
      >
        {loading ? (
          <LoaderCircle
            aria-hidden="true"
            className="size-5 animate-spin motion-reduce:animate-none"
          />
        ) : (
          <RefreshCw aria-hidden="true" className="size-5" />
        )}
      </button>
    </div>
  )
}

function HourCell({ hour }: { hour: BlendedHour }) {
  const clock = romeClock(hour.time).hour
  const direction = directionText(hour.direction)
  const gust = hour.gust === null ? "" : `, raffica ${formatKnots(hour.gust)}`
  return (
    <li className="grid justify-items-center gap-0.5 py-1 text-center">
      <span className="sr-only">
        Ore {clock}: da {direction}, {formatKnots(hour.mid)} nodi{gust}
      </span>
      <span
        aria-hidden="true"
        className="text-sm font-bold text-muted-foreground"
      >
        {clock}
      </span>
      <span aria-hidden="true">
        <WindArrow degrees={hour.direction} size={18} />
      </span>
      <span
        aria-hidden="true"
        className="text-base leading-none font-black tabular-nums"
      >
        {formatKnots(hour.mid)}
      </span>
      <span aria-hidden="true" className="text-sm tabular-nums">
        {hour.gust === null ? "–" : `r ${formatKnots(hour.gust)}`}
      </span>
    </li>
  )
}

function PlaceRows({
  forecast,
  zone,
  slot,
  now,
}: {
  forecast: WindForecast
  zone: WindZoneId
  slot: WindSlot
  now: number
}) {
  const rows = useMemo(
    () =>
      WIND_ZONES[zone].points.map((point) => ({
        point,
        summary: summariseHours(
          hoursInSlot(blendForecast(forecast, now, [point.id]), slot),
        ),
      })),
    [forecast, now, slot, zone],
  )
  const mids = rows.flatMap(({ summary }) => (summary ? [summary.mid] : []))
  if (mids.length === 0) return null
  const low = Math.min(...mids)
  const high = Math.max(...mids)
  const typical =
    [...mids].sort((a, b) => a - b)[Math.floor(mids.length / 2)] ?? low
  return (
    <details className="group mt-2 border-t pt-1" open={high - low >= 3}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-bold [&::-webkit-details-marker]:hidden">
        <span>Nell&apos;area: {formatRange(low, high)} kn</span>
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <ul className="m-0 grid list-none p-0">
        {rows.map(({ point, summary }) => {
          const differs = summary && Math.abs(summary.mid - typical) >= 2
          return (
            <li
              className="flex min-h-9 flex-wrap items-center justify-between gap-x-2 border-t py-1 text-sm"
              key={point.id}
            >
              <span className={differs ? "font-bold" : ""}>{point.label}</span>
              {summary && (
                <span className="sr-only">{summaryInWords(summary)}</span>
              )}
              {summary ? (
                <span
                  aria-hidden="true"
                  className="flex items-center gap-1.5 tabular-nums"
                >
                  <WindArrow degrees={summary.direction} size={16} />
                  <span className={differs ? "font-black" : "font-semibold"}>
                    {formatKnots(summary.mid)} kn
                  </span>
                  {summary.gust !== null && (
                    <span>r {formatKnots(summary.gust)}</span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">Nessun dato</span>
              )}
            </li>
          )
        })}
      </ul>
    </details>
  )
}

function jumpToMap() {
  document.getElementById("mappa-lamma")?.scrollIntoView({
    block: "start",
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  })
  // Keyboard, switch and screen-reader users must arrive too.
  document.getElementById("wind-lamma")?.focus({ preventScroll: true })
}

function HeroLines({ summary }: { summary: WindSummary }) {
  const split = splitText(summary)
  const change = changeText(summary)
  return (
    <div className="mt-2 grid gap-1 text-sm">
      {summary.thunder === true && (
        <p className="m-0 flex items-start gap-1.5 font-bold text-[#7f2f17]">
          <CloudLightning
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-[#b42318]"
          />
          Temporali possibili
        </p>
      )}
      {summary.thunder === null && (
        <p className="m-0 flex items-start gap-1.5 font-semibold">
          <CircleHelp aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Temporali: dato non scaricato
        </p>
      )}
      {split && (
        <p className="m-0 flex items-start gap-1.5 font-bold">
          <CircleHelp aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{split}</span>
        </p>
      )}
      {change && <p className="m-0 font-semibold">{change}</p>}
      {summary.reach === "tendency" && (
        <p className="m-0 text-muted-foreground">
          Oltre 3 giorni: solo una tendenza.
        </p>
      )}
      {summary.reach === "seasonal" && (
        <p className="m-0 text-muted-foreground">
          Così lontano la previsione vale poco più della media di stagione.
        </p>
      )}
    </div>
  )
}

function SlotHero({
  forecast,
  zone,
  slot,
  hours,
  now,
  picked,
  following,
  onFollow,
  onBackToNext,
  headingRef,
}: {
  forecast: WindForecast
  zone: WindZoneId
  slot: WindSlot
  hours: readonly BlendedHour[]
  now: number
  picked: boolean
  following: WindSlot | null
  onFollow: (slot: WindSlot) => void
  onBackToNext: () => void
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  const inSlot = hoursInSlot(hours, slot)
  const summary = summariseHours(inSlot)
  const heading = slotInProgress(slot, now)
    ? "In corso"
    : picked
      ? "Scelta"
      : slot.sessionId
        ? "Prossima uscita"
        : "Prossimo"
  const after =
    following && slotInProgress(slot, now)
      ? summariseHours(hoursInSlot(hours, following))
      : null

  return (
    <section
      aria-labelledby="wind-hero"
      className="rounded-2xl border bg-card p-4"
    >
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-2">
        <h2
          className="m-0 text-base font-black outline-none"
          id="wind-hero"
          ref={headingRef}
          tabIndex={-1}
        >
          {heading} · {slotLabel(slot)}
        </h2>
        <span className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
          {periodHours(slot.period)}
          {picked && (
            <button
              aria-label="Torna alla prossima uscita"
              className="min-h-11 min-w-11 font-bold text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring"
              onClick={onBackToNext}
              type="button"
            >
              Torna
            </button>
          )}
        </span>
      </div>

      {!summary ? (
        <p className="mt-3 mb-0 text-base">
          Troppo lontano: i modelli scaricati non arrivano a questa mezza
          giornata.
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <WindDial degrees={summary.direction} />
            <div className="min-w-0">
              <p className="m-0 text-[2.5rem] leading-none font-black tracking-tight tabular-nums">
                {summary.reach !== "near" && "~"}
                {formatKnots(summary.mid)}
                <span className="ml-1 text-lg font-bold">kn</span>
              </p>
              <p className="m-0 mt-1 text-xl leading-tight font-black tabular-nums">
                {summary.gust === null
                  ? "Raffiche: troppo presto"
                  : `Raffiche ${summary.reach === "near" ? "" : "~"}${formatKnots(summary.gust)}`}
              </p>
            </div>
          </div>
          <p className="m-0 mt-2 text-base font-semibold">
            {directionWithName(summary.direction)} · Forza{" "}
            {beaufort(summary.mid)}
          </p>
          <p className="m-0 text-sm text-muted-foreground">
            Probabile {formatRange(summary.low, summary.high)} kn
            {zone === "cabinati" &&
              summary.waveHeight !== null &&
              ` · Onda al largo ${formatDecimal(summary.waveHeight)} m`}
          </p>

          <HeroLines summary={summary} />

          <ul
            aria-label={`Ora per ora, ${slotLabel(slot)}`}
            className="m-0 mt-3 grid list-none gap-1 border-t p-0 pt-2"
            style={{
              gridTemplateColumns: `repeat(${Math.max(inSlot.length, 1)}, minmax(0, 1fr))`,
            }}
          >
            {inSlot.map((hour) => (
              <HourCell hour={hour} key={hour.time} />
            ))}
          </ul>

          {zone === "cabinati" && (
            <PlaceRows forecast={forecast} now={now} slot={slot} zone={zone} />
          )}
        </>
      )}

      {after && following && (
        <button
          className="mt-1 flex min-h-11 w-full flex-wrap items-center gap-x-1.5 border-t pt-1 text-left text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring"
          onClick={() => onFollow(following)}
          type="button"
        >
          Dopo · {slotShortLabel(following)}: {summaryInWords(after)}
        </button>
      )}
      <button
        className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-bold text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring"
        onClick={jumpToMap}
        type="button"
      >
        Mappa LaMMA
        <ArrowDown aria-hidden="true" className="size-4" />
      </button>
    </section>
  )
}

function hoursListRow(hour: BlendedHour) {
  return (
    <li
      className="flex flex-wrap items-baseline justify-between gap-x-3 border-t py-1 tabular-nums"
      key={hour.time}
    >
      <span className="w-[3.25rem]">{romeClock(hour.time).hour}:00</span>
      <span className="w-[5rem]">{directionText(hour.direction)}</span>
      <span className="font-bold">{formatKnots(hour.mid)} kn</span>
      <span className="text-muted-foreground">
        {formatRange(hour.low, hour.high)}
      </span>
      <span>{hour.gust === null ? "–" : `r ${formatKnots(hour.gust)}`}</span>
      {hour.thunder && (
        <span className="font-bold text-[#7f2f17]">temporali</span>
      )}
    </li>
  )
}

function Disclosure({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <details className="group mt-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-bold [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      {children}
    </details>
  )
}

const chartStart = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Europe/Rome",
})

function Next24Hours({
  hours,
  slots,
  heroSlot,
}: {
  hours: readonly BlendedHour[]
  slots: readonly WindSlot[]
  heroSlot: WindSlot
}) {
  const next = hours.slice(0, 25)
  const first = next[0]
  if (!first || next.length < 2) return null
  const heroInside = hoursInSlot(next, heroSlot).length > 0
  return (
    <section aria-labelledby="wind-24" className="border-t pt-3">
      <h2 className="m-0 text-base font-black" id="wind-24">
        Prossime 24 ore, da {chartStart.format(new Date(first.time * 1000))}
      </h2>
      {!heroInside && (
        <p className="m-0 mt-0.5 text-sm text-muted-foreground">
          {slotLabel(heroSlot)} è oltre queste 24 ore.
        </p>
      )}
      <div className="mt-2">
        <WindChart hours={next} heroKey={heroSlot.key} slots={slots} />
      </div>
      <p className="m-0 mt-1 text-sm text-muted-foreground">
        Linea spessa: vento atteso. Fascia: probabile. Linea sottile: raffiche.
        Le frecce indicano dove va il vento.
        {next.some((hour) => hour.thunder) && (
          <span className="whitespace-nowrap">
            {" "}
            <CloudLightning
              aria-hidden="true"
              className="inline size-3.5 text-[#b42318]"
            />{" "}
            temporali.
          </span>
        )}
      </p>
      <Disclosure title="Ora per ora">
        <ul className="m-0 list-none p-0 text-sm">{next.map(hoursListRow)}</ul>
      </Disclosure>
    </section>
  )
}

function SlotCell({
  slot,
  date,
  period,
  hours,
  selected,
  onSelect,
}: {
  slot: WindSlot | undefined
  date: string
  period: "AM" | "PM"
  hours: readonly BlendedHour[]
  selected: boolean
  onSelect: (slot: WindSlot) => void
}) {
  // A half-day already over, in a week under way.
  if (!slot) return <div aria-hidden="true" className="wind-cell" />
  const summary = summariseHours(hoursInSlot(hours, slot))
  const { day, number } = dayRowLabel(date)
  if (!summary) {
    return (
      <div className="wind-cell wind-cell-empty">
        <span className="wind-cell-period">{period}</span>
        <span aria-hidden="true">–</span>
        <span className="sr-only">
          {day} {number} {period}: troppo lontano
        </span>
      </div>
    )
  }
  const tint = tintFor(summary.mid)
  const label = `${slotLabel(slot).replace(` ${period}`, "")} ${number} ${period}: ${spokenSummary(summary)}`
  return (
    <button
      aria-label={label}
      aria-pressed={selected}
      className="wind-cell outline-none focus-visible:ring-3 focus-visible:ring-ring"
      onClick={() => onSelect(slot)}
      style={{ background: tint.background, color: tint.color }}
      type="button"
    >
      <span className="wind-cell-period">{period}</span>
      <span className="text-sm leading-tight font-semibold">
        {summary.direction === null ? "var" : compassPoint8(summary.direction)}
      </span>
      <span className="text-base leading-tight font-black whitespace-nowrap tabular-nums">
        {summary.reach !== "near" && "~"}
        {formatKnots(summary.mid)}
      </span>
      {summary.gust !== null && (
        <span className="text-sm leading-tight whitespace-nowrap tabular-nums">
          r{formatKnots(summary.gust)}
        </span>
      )}
      {(summary.thunder || summary.split) && (
        <span className="wind-cell-marks" aria-hidden="true">
          {summary.thunder && (
            <CloudLightning
              className="size-4"
              style={{ color: thunderColor(tint) }}
            />
          )}
          {summary.split && <CircleHelp className="size-3.5" />}
        </span>
      )}
    </button>
  )
}

function WeekOverview({
  course,
  now,
  hours,
  selectedKey,
  onSelect,
}: {
  course: CourseRecord
  now: number
  hours: readonly BlendedHour[]
  selectedKey: string
  onSelect: (slot: WindSlot) => void
}) {
  const [horizon, setHorizon] = useState<WindHorizon>(() =>
    defaultHorizon(course, now),
  )
  const slots = slotsForHorizon(horizon, course, now)
  const dates = [...new Set(slots.map((slot) => slot.date))]
  return (
    <section aria-labelledby="wind-days" className="border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-base font-black" id="wind-days">
          {horizon === "week" ? "La settimana" : "Prossimi 7 giorni"}
        </h2>
        <Segmented
          label="Orizzonte"
          onChange={setHorizon}
          options={[
            { value: "week", label: "Settimana" },
            { value: "seven", label: "7 giorni" },
          ]}
          value={horizon}
        />
      </div>
      {slots.length === 0 ? (
        <p className="m-0 mt-2 text-sm text-muted-foreground">
          Le uscite di questo corso sono finite.
        </p>
      ) : (
        <div className="wind-week-box mt-2">
          <div
            className="wind-week"
            style={{ "--days": dates.length } as React.CSSProperties}
          >
            <div aria-hidden="true" className="wind-week-periods">
              <span />
              <span>AM</span>
              <span>PM</span>
            </div>
            {dates.map((date) => {
              const { day, number } = dayRowLabel(date)
              const find = (period: "AM" | "PM") =>
                slots.find(
                  (slot) => slot.date === date && slot.period === period,
                )
              return (
                <div className="wind-day" key={date}>
                  <span aria-hidden="true" className="wind-day-head">
                    <span className="block font-bold">{day}</span>
                    <span className="block text-muted-foreground">
                      {number}
                    </span>
                  </span>
                  {(["AM", "PM"] as const).map((period) => (
                    <SlotCell
                      date={date}
                      hours={hours}
                      key={period}
                      onSelect={onSelect}
                      period={period}
                      selected={find(period)?.key === selectedKey}
                      slot={find(period)}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
      <p className="m-0 mt-2 text-sm text-muted-foreground">
        Nodi attesi, r = raffica. Più scuro, più vento.{" "}
        <span className="whitespace-nowrap">
          <CloudLightning
            aria-hidden="true"
            className="inline size-3.5 text-[#b42318]"
          />{" "}
          temporali,
        </span>{" "}
        <span className="whitespace-nowrap">
          <CircleHelp aria-hidden="true" className="inline size-3.5" /> modelli
          divisi.
        </span>{" "}
        ~ oltre 3 giorni: solo tendenza.
      </p>
    </section>
  )
}

function ModelDetails({
  hours,
  slot,
}: {
  hours: readonly BlendedHour[]
  slot: WindSlot
}) {
  const inSlot = hoursInSlot(hours, slot)
  const hour = inSlot[Math.floor(inSlot.length / 2)] ?? hours[0]
  if (!hour) return null
  return (
    <section className="border-t">
      <Disclosure title="Modelli e pesi">
        <p className="m-0 mb-2 text-sm text-muted-foreground">
          Alle {romeClock(hour.time).hour}:00. Pesi scelti guardando gli errori
          su due capi esposti della Corsica del sud; l&apos;ensemble è una
          scelta a priori. Il vento atteso è la mediana pesata, non la media.
        </p>
        <ul className="m-0 list-none p-0 text-sm tabular-nums">
          {hour.models.map((entry) => {
            const model = WIND_MODELS.find((item) => item.id === entry.model)
            return (
              <li
                className="flex flex-wrap items-baseline justify-between gap-x-3 border-t py-1"
                key={entry.model}
              >
                <span className="font-semibold">
                  {model
                    ? `${model.label}, ${formatDecimal(model.gridKm)} km`
                    : "Ensemble ECMWF, 51 membri"}
                </span>
                <span className="flex flex-wrap gap-x-3">
                  <span className="font-bold">
                    {formatKnots(entry.speed)} kn
                  </span>
                  <span>
                    {entry.direction === null
                      ? "–"
                      : directionText(entry.direction)}
                  </span>
                  <span>{Math.round(entry.weight * 100)}%</span>
                </span>
              </li>
            )
          })}
        </ul>
        <p className="m-0 mt-2 text-sm text-muted-foreground">
          Nella prova su quei capi, estate e autunno 2026, fino a un giorno
          prima: il vento vero è rimasto nel Probabile 7-8 ore su 10, ma su un
          capo solo 5-6 da 12 nodi in su, con il vento sopra il Probabile. Le
          raffiche mostrate sono di solito il doppio del vento atteso, o la più
          alta dei modelli se maggiore: tarate su picchi di capi, in acqua
          possono essere meno. Quelle vere le hanno superate in 3-5 uscite su
          10: non sono un tetto. Oltre un giorno valgono meno, tutti e due i
          numeri.
        </p>
      </Disclosure>
    </section>
  )
}

function SourceNote() {
  return (
    <div className="grid gap-1 px-1 text-sm text-muted-foreground">
      <p className="m-0">
        Dati:{" "}
        <a
          aria-label={`${DATA_CREDIT.provider}: nuova scheda`}
          className="underline"
          href={DATA_CREDIT.providerUrl}
          rel="noreferrer"
          target="_blank"
        >
          {DATA_CREDIT.provider}
        </a>
        ,{" "}
        <a
          aria-label={`${DATA_CREDIT.licence}: nuova scheda`}
          className="underline"
          href={DATA_CREDIT.licenceUrl}
          rel="noreferrer"
          target="_blank"
        >
          {DATA_CREDIT.licence}
        </a>
        , elaborati.
      </p>
      <p className="m-0">
        Con Vento aperto il telefono contatta Open-Meteo e LaMMA, anche da solo
        per aggiornare: ricevono il suo indirizzo e i punti dell&apos;area,
        nessun nome e nessun dato degli allievi.
      </p>
      <p className="m-0 font-semibold text-foreground">
        È una previsione, non una misura: il vento vero può superare i valori
        mostrati. La decisione di uscire resta dell&apos;istruttore, sul posto e
        con il bollettino ufficiale.
      </p>
    </div>
  )
}

export function WeatherScreen({
  course,
  onHome,
}: {
  course: CourseRecord
  onHome: () => void
}) {
  const courseZone = zoneForCourse(course.family)
  const [zone, setZone] = useState<WindZoneId>(courseZone)
  const { forecast, state, now, refresh } = useWindForecast(zone, "network")
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const [mapField, setMapField] = useState<LammaField>("wind10")
  const [announcement, setAnnouncement] = useState("")
  const heading = useRef<HTMLHeadingElement>(null)
  const hero = useRef<HTMLDivElement>(null)
  // A control that removes itself hands focus to the section's heading.
  const focusHero = useRef(false)
  const [scrollRequest, setScrollRequest] = useState(0)

  const hours = useMemo(
    () => (forecast ? blendForecast(forecast, now) : []),
    [forecast, now],
  )
  const sevenDays = useMemo(
    () => slotsForHorizon("seven", course, now),
    [course, now],
  )
  // A chosen half-day outlives a change of horizon, wherever it came from.
  const knownSlots = useMemo(() => {
    const byKey = new Map(
      [...slotsForHorizon("week", course, now), ...sevenDays].map((slot) => [
        slot.key,
        slot,
      ]),
    )
    return [...byKey.values()]
  }, [course, now, sevenDays])
  const nextSlot = useMemo(() => nextDecisionSlot(course, now), [course, now])
  const picked = knownSlots.find((slot) => slot.key === pickedKey) ?? null
  const heroSlot = picked ?? nextSlot
  const following = useMemo(() => {
    const ordered = [...knownSlots].sort((a, b) => a.key.localeCompare(b.key))
    const at = ordered.findIndex((slot) => slot.key === heroSlot.key)
    return at < 0 ? null : (ordered[at + 1] ?? null)
  }, [heroSlot, knownSlots])

  useEffect(() => {
    if (state === "failed") focusHero.current = false
    if (focusHero.current && heading.current) {
      focusHero.current = false
      heading.current.focus()
    }
  }, [forecast, heroSlot.key, state, zone])

  // After the taller section has been drawn, or the scroll aims at the old layout.
  useEffect(() => {
    if (scrollRequest === 0) return
    const box = hero.current?.getBoundingClientRect()
    if (box && (box.top < 0 || box.top > window.innerHeight * 0.5)) {
      hero.current?.scrollIntoView({
        block: "start",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      })
    }
  }, [scrollRequest])

  function pick(slot: WindSlot) {
    setPickedKey(slot.key === nextSlot.key ? null : slot.key)
    const summary = summariseHours(hoursInSlot(hours, slot))
    setAnnouncement(
      summary
        ? `${slotLabel(slot)}: ${spokenSummary(summary)}`
        : `${slotLabel(slot)}: troppo lontano`,
    )
    setScrollRequest((request) => request + 1)
  }

  const otherZone = zone === courseZone ? null : courseZone

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex min-w-0 items-center gap-1">
            <button
              aria-label="Indietro da Vento"
              className="grid size-11 shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring"
              onClick={onHome}
              type="button"
            >
              <ChevronDown aria-hidden="true" className="size-5 rotate-90" />
            </button>
            <h1 className="m-0 text-2xl font-black tracking-tight">Vento</h1>
          </div>
          <Segmented
            label="Area"
            onChange={setZone}
            options={(["derive", "cabinati"] as const).map((value) => ({
              value,
              label: WIND_ZONES[value].label,
            }))}
            value={zone}
          />
        </div>
        <StatusLine
          description={WIND_ZONES[zone].description}
          forecast={forecast}
          now={now}
          onRefresh={() => void refresh()}
          state={state}
        />
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {!forecast && state !== "idle" && (
        <section className="rounded-2xl border bg-card p-4">
          <p className="m-0 text-base">
            {state === "loading"
              ? `Scarico le previsioni per ${WIND_ZONES[zone].label}…`
              : otherZone
                ? `${WIND_ZONES[zone].label} non ancora scaricato.`
                : isOffline()
                  ? "Serve la rete per la prima previsione. Dopo, l'ultima scaricata resta qui anche senza segnale."
                  : "Il servizio meteo non ha risposto: riprova tra poco."}
          </p>
          <Button
            aria-disabled={state === "loading"}
            className="mt-3 min-h-11 w-full aria-disabled:opacity-60"
            onClick={() => {
              if (state === "loading") return
              focusHero.current = true
              void refresh()
            }}
          >
            Riprova
          </Button>
          {otherZone && (
            <Button
              className="mt-2 min-h-11 w-full"
              onClick={() => {
                focusHero.current = true
                setZone(otherZone)
              }}
              variant="secondary"
            >
              Torna a {WIND_ZONES[otherZone].label}
            </Button>
          )}
        </section>
      )}

      {forecast && (
        <>
          <div className="scroll-mt-3" ref={hero}>
            <SlotHero
              following={following}
              forecast={forecast}
              headingRef={heading}
              hours={hours}
              now={now}
              onBackToNext={() => {
                setPickedKey(null)
                heading.current?.focus()
              }}
              onFollow={(slot) => {
                focusHero.current = true
                pick(slot)
              }}
              picked={picked !== null}
              slot={heroSlot}
              zone={zone}
            />
          </div>
          <WeekOverview
            course={course}
            hours={hours}
            now={now}
            onSelect={pick}
            selectedKey={heroSlot.key}
          />
          <Next24Hours heroSlot={heroSlot} hours={hours} slots={sevenDays} />
        </>
      )}

      {/* Not while the first download runs: the empty page would pull it into view. */}
      {(forecast || state === "failed") && (
        <div className="border-t pt-3">
          <WindLammaMap
            field={mapField}
            key={heroSlot.key}
            now={now}
            onField={setMapField}
            slot={heroSlot}
          />
        </div>
      )}

      {forecast && <ModelDetails hours={hours} slot={heroSlot} />}

      <section aria-labelledby="wind-links" className="border-t pt-3">
        <h2 className="m-0 mb-1 text-base font-black" id="wind-links">
          Altre fonti
        </h2>
        <ul className="m-0 list-none p-0">
          {WEATHER_LINKS.map((link) => (
            <li className="border-t first:border-t-0" key={link.label}>
              <a
                aria-label={`${link.label}, ${link.detail}: nuova scheda`}
                className="flex min-h-12 items-center justify-between gap-2 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring"
                href={link.url}
                rel="noreferrer"
                target="_blank"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-black">{link.label}</span>
                  <span className="block text-sm text-muted-foreground">
                    {link.detail}
                  </span>
                </span>
                <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <SourceNote />
    </div>
  )
}
