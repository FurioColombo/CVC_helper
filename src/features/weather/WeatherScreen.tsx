import {
  ChevronLeft,
  ChevronRight,
  CloudLightning,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
  WifiOff,
} from "lucide-react"
import { useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  beaufort,
  blendForecast,
  defaultHorizon,
  hoursInSlot,
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
  LAMMA_MAP,
  WEATHER_LINKS,
  WIND_MODELS,
  WIND_SESSION_HOURS,
  WIND_ZONES,
  zoneForCourse,
  type WindZoneId,
} from "@/domain/windConfig"
import {
  estimatedLammaRun,
  LAMMA_LAST_STEP,
  lammaHoursFromStep,
  lammaMapUrl,
  lammaStepFromHours,
  type LammaField,
} from "@/features/weather/lammaMap"
import { useWindForecast } from "@/features/weather/useWindForecast"
import { WindChart } from "@/features/weather/WindChart"
import {
  agreementText,
  dayRowLabel,
  directionText,
  directionWithName,
  formatKnots,
  formatRange,
  periodHours,
  slotLabel,
  slotShortLabel,
  summaryInWords,
  updatedText,
} from "@/features/weather/windFormat"
import { UncertainMark, WindArrow } from "@/features/weather/WindArrow"
import type { CourseRecord } from "@/persistence/courses"

const STALE_AFTER_SECONDS = 6 * 3600
const VERY_STALE_AFTER_SECONDS = 24 * 3600

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-muted p-1"
      role="group"
    >
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          className="min-h-10 rounded-lg px-2 text-sm font-bold text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm"
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function StatusLine({
  forecast,
  state,
  now,
  onRefresh,
}: {
  forecast: WindForecast | null
  state: "idle" | "loading" | "failed"
  now: number
  onRefresh: () => void
}) {
  const age = forecast ? now - forecast.fetchedAt : 0
  const stale = forecast !== null && age >= STALE_AFTER_SECONDS
  const veryStale = forecast !== null && age >= VERY_STALE_AFTER_SECONDS
  return (
    <div
      className={
        stale || state === "failed"
          ? "flex items-center justify-between gap-2 rounded-xl bg-[#fff4ee] px-3 py-1.5 text-sm text-[#7f2f17]"
          : "flex items-center justify-between gap-2 px-1 text-sm text-muted-foreground"
      }
      role="status"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {state === "failed" && (
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
        )}
        <span className="min-w-0">
          {state === "loading" && !forecast && "Scarico le previsioni…"}
          {state === "failed" &&
            (forecast ? "Senza rete. " : "Previsioni non scaricate.")}
          {forecast && updatedText(forecast.fetchedAt, now)}
          {veryStale && ": potrebbero essere superati"}
        </span>
      </span>
      <button
        aria-label="Aggiorna le previsioni"
        className="grid size-11 shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-60"
        disabled={state === "loading"}
        onClick={onRefresh}
        type="button"
      >
        {state === "loading" ? (
          <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
        ) : (
          <RefreshCw aria-hidden="true" className="size-5" />
        )}
      </button>
    </div>
  )
}

function HourCell({ hour }: { hour: BlendedHour }) {
  return (
    <li className="grid justify-items-center gap-0.5 py-1 text-center">
      <span className="text-xs font-bold text-muted-foreground">
        {romeClock(hour.time).hour}
      </span>
      <WindArrow degrees={hour.direction} size={18} />
      <span className="text-base leading-none font-black tabular-nums">
        {formatKnots(hour.mid)}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {hour.gust === null ? "–" : formatKnots(hour.gust)}
      </span>
    </li>
  )
}

function changeText(summary: WindSummary) {
  const parts: string[] = []
  if (summary.trend === "rinforzo") parts.push("In rinforzo")
  if (summary.trend === "calo") parts.push("In calo")
  if (summary.turning) {
    parts.push(
      `gira da ${directionText(summary.firstDirection)} a ${directionText(summary.lastDirection)}`,
    )
  }
  if (parts.length === 0) return null
  const text = parts.join(", ")
  return text.charAt(0).toUpperCase() + text.slice(1)
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
  return (
    <ul className="m-0 grid list-none gap-0 p-0">
      {rows.map(({ point, summary }) => (
        <li
          className="flex min-h-9 items-center justify-between gap-2 border-t py-1 text-sm first:border-t-0"
          key={point.id}
        >
          <span className="min-w-0 font-semibold">{point.label}</span>
          {summary ? (
            <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
              <WindArrow degrees={summary.direction} size={16} />
              <span className="font-bold">
                {formatRange(summary.low, summary.high)} kn
              </span>
              <span className="w-10 text-right text-muted-foreground">
                {summary.gust === null ? "" : `r ${formatKnots(summary.gust)}`}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Nessun dato</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function SlotHero({
  forecast,
  zone,
  slot,
  hours,
  now,
  picked,
  onBackToNext,
}: {
  forecast: WindForecast
  zone: WindZoneId
  slot: WindSlot
  hours: readonly BlendedHour[]
  now: number
  picked: boolean
  onBackToNext: () => void
}) {
  const inSlot = hoursInSlot(hours, slot)
  const summary = summariseHours(inSlot)
  const heading = slotInProgress(slot, now)
    ? "In corso"
    : picked
      ? "Uscita scelta"
      : slot.sessionId
        ? "Prossima uscita"
        : "Prossima mezza giornata"
  const change = summary && changeText(summary)
  const showPlaces = zone === "cabinati"

  return (
    <section
      aria-labelledby="wind-hero"
      className="rounded-2xl bg-card p-4 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="m-0 text-base font-black" id="wind-hero">
          {heading} · {slotLabel(slot)}
        </h2>
        <span className="shrink-0 text-sm text-muted-foreground">
          {periodHours(slot.period)}
        </span>
      </div>

      {!summary ? (
        <p className="mt-3 mb-0 text-base">
          I modelli non arrivano ancora a questa uscita.
        </p>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-3">
            <WindArrow
              className="shrink-0 text-primary"
              degrees={summary.direction}
              size={48}
            />
            <div className="min-w-0">
              <p className="m-0 text-[2.5rem] leading-none font-black tracking-tight tabular-nums">
                {formatRange(summary.low, summary.high)}
                <span className="ml-1 text-lg font-bold">kn</span>
              </p>
              <p className="m-0 mt-1 text-base font-semibold">
                {directionWithName(summary.direction)}
              </p>
              <p className="m-0 text-sm text-muted-foreground">
                Attesi {formatKnots(summary.mid)} kn
              </p>
            </div>
          </div>

          <dl className="mt-3 mb-0 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Raffiche</dt>
              <dd className="m-0 text-base font-bold tabular-nums">
                {summary.gust === null
                  ? "–"
                  : `${formatKnots(summary.gust)} kn`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Forza</dt>
              <dd className="m-0 text-base font-bold tabular-nums">
                F{beaufort(summary.low)}
                {beaufort(summary.high) !== beaufort(summary.low) &&
                  `–${beaufort(summary.high)}`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Onda al largo</dt>
              <dd className="m-0 text-base font-bold tabular-nums">
                {summary.waveHeight === null
                  ? "–"
                  : `${summary.waveHeight.toFixed(1)} m`}
              </dd>
            </div>
          </dl>

          <div className="mt-2 grid gap-1 text-sm">
            {change && <p className="m-0 font-bold">{change}</p>}
            <p
              className={
                summary.agreement === "bassa"
                  ? "m-0 flex items-start gap-1.5 font-bold text-[#7f2f17]"
                  : "m-0 text-muted-foreground"
              }
            >
              {summary.agreement === "bassa" && (
                <TriangleAlert
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
              )}
              {agreementText(summary.agreement)}
            </p>
            {summary.thunder && (
              <p className="m-0 flex items-start gap-1.5 font-bold text-[#7f2f17]">
                <CloudLightning
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                Temporali possibili
              </p>
            )}
            {summary.strongWesterly && (
              <p className="m-0 text-muted-foreground">
                Con Ponente e Maestrale forti i modelli hanno spesso stimato
                meno vento di quello misurato: guarda il valore alto.
              </p>
            )}
          </div>

          <ul
            aria-label={`Ora per ora, ${slotLabel(slot)}: vento e raffica in nodi`}
            className="m-0 mt-3 grid list-none gap-1 border-t p-0 pt-2"
            style={{
              gridTemplateColumns: `repeat(${inSlot.length}, minmax(0, 1fr))`,
            }}
          >
            {inSlot.map((hour) => (
              <HourCell hour={hour} key={hour.time} />
            ))}
          </ul>

          {showPlaces && (
            <div className="mt-2 border-t pt-2">
              <h3 className="m-0 mb-1 text-sm font-bold text-muted-foreground">
                Nell&apos;area
              </h3>
              <PlaceRows
                forecast={forecast}
                now={now}
                slot={slot}
                zone={zone}
              />
            </div>
          )}
        </>
      )}

      {picked && (
        <Button
          className="mt-3 min-h-11 w-full"
          onClick={onBackToNext}
          variant="secondary"
        >
          Torna alla prossima uscita
        </Button>
      )}
    </section>
  )
}

function Next24Hours({
  hours,
  slots,
}: {
  hours: readonly BlendedHour[]
  slots: readonly WindSlot[]
}) {
  const next = hours.slice(0, 25)
  if (next.length < 2) return null
  return (
    <section
      aria-labelledby="wind-24"
      className="rounded-2xl bg-card p-4 shadow-sm"
    >
      <h2 className="m-0 text-base font-black" id="wind-24">
        Prossime 24 ore
      </h2>
      <div className="mt-2">
        <WindChart hours={next} slots={slots} />
      </div>
      <p className="m-0 mt-1 text-xs text-muted-foreground">
        Linea: vento atteso. Fascia: dove cadono i modelli. Punti: raffiche.
        Frecce: dove va il vento.
      </p>
      <details className="mt-2">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold">
          Ora per ora
        </summary>
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 font-semibold">Ora</th>
              <th className="py-1 font-semibold">Da</th>
              <th className="py-1 text-right font-semibold">Vento</th>
              <th className="py-1 text-right font-semibold">Fascia</th>
              <th className="py-1 text-right font-semibold">Raffica</th>
            </tr>
          </thead>
          <tbody>
            {next.map((hour) => (
              <tr className="border-t" key={hour.time}>
                <td className="py-1">{romeClock(hour.time).hour}:00</td>
                <td className="py-1">{directionText(hour.direction)}</td>
                <td className="py-1 text-right font-bold">
                  {formatKnots(hour.mid)}
                </td>
                <td className="py-1 text-right">
                  {formatRange(hour.low, hour.high)}
                </td>
                <td className="py-1 text-right">
                  {hour.gust === null ? "–" : formatKnots(hour.gust)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}

function SlotCell({
  slot,
  hours,
  selected,
  onSelect,
}: {
  slot: WindSlot | undefined
  hours: readonly BlendedHour[]
  selected: boolean
  onSelect: (slot: WindSlot) => void
}) {
  if (!slot) {
    return (
      <div aria-hidden="true" className="min-h-12 rounded-lg bg-muted/40" />
    )
  }
  const summary = summariseHours(hoursInSlot(hours, slot))
  const label = `${slotLabel(slot)}: ${summary ? `${summaryInWords(summary)}. ${agreementText(summary.agreement)}` : "nessun dato"}`
  return (
    <button
      aria-label={label}
      aria-pressed={selected}
      className="flex min-h-12 min-w-0 items-center gap-1.5 rounded-lg border border-transparent bg-muted/50 px-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring aria-pressed:border-primary aria-pressed:bg-card"
      onClick={() => onSelect(slot)}
      type="button"
    >
      {summary ? (
        <>
          <WindArrow
            className="shrink-0"
            degrees={summary.direction}
            size={18}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm leading-tight font-black whitespace-nowrap tabular-nums">
              {formatRange(summary.low, summary.high)}
            </span>
            <span className="block text-xs leading-tight text-muted-foreground tabular-nums">
              {summary.gust === null ? "–" : `r ${formatKnots(summary.gust)}`}
            </span>
          </span>
          {summary.thunder && (
            <CloudLightning
              aria-hidden="true"
              className="size-3.5 shrink-0 text-[#b42318]"
            />
          )}
          {summary.agreement === "bassa" && (
            <UncertainMark className="size-3.5 shrink-0 text-[#b42318]" />
          )}
        </>
      ) : (
        <span className="text-xs text-muted-foreground">Non ancora</span>
      )}
    </button>
  )
}

function DaysOverview({
  title,
  slots,
  hours,
  selectedKey,
  onSelect,
}: {
  title: string
  slots: readonly WindSlot[]
  hours: readonly BlendedHour[]
  selectedKey: string | null
  onSelect: (slot: WindSlot) => void
}) {
  const dates = [...new Set(slots.map((slot) => slot.date))]
  return (
    <section
      aria-labelledby="wind-days"
      className="rounded-2xl bg-card p-4 shadow-sm"
    >
      <h2 className="m-0 text-base font-black" id="wind-days">
        {title}
      </h2>
      <p className="m-0 mt-1 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
        Nodi, r = raffica.
        <UncertainMark className="size-3.5 text-[#b42318]" />
        modelli divisi. Tocca per i dettagli.
      </p>
      <div className="mt-2 grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5">
        <span />
        <span className="text-center text-xs font-bold text-muted-foreground">
          AM
        </span>
        <span className="text-center text-xs font-bold text-muted-foreground">
          PM
        </span>
        {dates.map((date) => {
          const label = dayRowLabel(date)
          const find = (period: "AM" | "PM") =>
            slots.find((slot) => slot.date === date && slot.period === period)
          return (
            <div className="contents" key={date}>
              <span className="text-sm leading-tight font-bold">
                {label.day}
                <span className="block text-xs font-normal text-muted-foreground">
                  {label.number}
                </span>
              </span>
              <SlotCell
                hours={hours}
                onSelect={onSelect}
                selected={find("AM")?.key === selectedKey}
                slot={find("AM")}
              />
              <SlotCell
                hours={hours}
                onSelect={onSelect}
                selected={find("PM")?.key === selectedKey}
                slot={find("PM")}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}

const lammaLabel = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
})

function LammaMap({ slot, now }: { slot: WindSlot | null; now: number }) {
  const run = estimatedLammaRun(now)
  const target = useMemo(() => {
    if (!slot) return now
    const { start, end } = WIND_SESSION_HOURS[slot.period]
    const middle = Math.round((start + end) / 2)
    // Noon UTC on the slot's date, moved to the session's middle hour in Rome.
    const noon = Date.parse(`${slot.date}T12:00:00Z`) / 1000
    return noon + (middle - romeClock(noon).hour) * 3600
  }, [now, slot])
  const [step, setStep] = useState(() =>
    lammaStepFromHours((target - run) / 3600),
  )
  const [field, setField] = useState<LammaField>("wind10")
  const [failed, setFailed] = useState(false)

  const valid = run + lammaHoursFromStep(step) * 3600

  return (
    <section
      aria-labelledby="wind-lamma"
      className="rounded-2xl bg-card p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-base font-black" id="wind-lamma">
          Mappa LaMMA
        </h2>
        <a
          className="flex min-h-11 items-center gap-1 text-sm font-bold text-primary"
          href={LAMMA_MAP.pageUrl}
          rel="noreferrer"
          target="_blank"
        >
          Apri
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      </div>
      <Segmented
        label="Campo della mappa"
        onChange={(value) => {
          setField(value)
          setFailed(false)
        }}
        options={[
          { value: "wind10", label: "Vento" },
          { value: "swh", label: "Onda" },
        ]}
        value={field}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          aria-label="Mappa precedente"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-40"
          disabled={step <= 1}
          onClick={() => {
            setStep((value) => Math.max(1, value - 1))
            setFailed(false)
          }}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <span className="text-center text-sm font-bold" aria-live="polite">
          circa {lammaLabel.format(new Date(valid * 1000))}
        </span>
        <button
          aria-label="Mappa successiva"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-40"
          disabled={step >= LAMMA_LAST_STEP}
          onClick={() => {
            setStep((value) => Math.min(LAMMA_LAST_STEP, value + 1))
            setFailed(false)
          }}
          type="button"
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
      </div>
      {failed ? (
        <p className="mt-2 mb-0 rounded-xl bg-muted p-3 text-sm">
          Mappa non caricata: serve la rete, o LaMMA non l&apos;ha pubblicata.
          Prova un&apos;altra ora.
        </p>
      ) : (
        <a
          aria-label="Ingrandisci la mappa LaMMA"
          className="mt-2 block rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring"
          href={lammaMapUrl(field, step)}
          rel="noreferrer"
          target="_blank"
        >
          <img
            alt={`Mappa LaMMA di ${field === "wind10" ? "vento" : "onda"} sulle Bocche di Bonifacio, circa ${lammaLabel.format(new Date(valid * 1000))}`}
            className="block h-auto w-full rounded-lg"
            decoding="async"
            loading="lazy"
            onError={() => setFailed(true)}
            referrerPolicy="no-referrer"
            src={lammaMapUrl(field, step)}
          />
        </a>
      )}
      <p className="m-0 mt-1 text-xs text-muted-foreground">
        Tocca per ingrandire. L&apos;ora giusta è quella stampata sulla mappa,
        in UTC. Modello MOLOCH 1,5 km. © Consorzio LaMMA, lamma.toscana.it, CC
        BY-ND.
      </p>
    </section>
  )
}

function ModelDetails({
  hours,
  slot,
}: {
  hours: readonly BlendedHour[]
  slot: WindSlot | null
}) {
  const inSlot = slot ? hoursInSlot(hours, slot) : []
  const hour = inSlot[Math.floor(inSlot.length / 2)] ?? hours[0]
  if (!hour) return null
  const rows = hour.models.map((entry) => {
    const model = WIND_MODELS.find((item) => item.id === entry.model)
    return { ...entry, label: model?.label ?? entry.model, km: model?.gridKm }
  })
  return (
    <details className="rounded-2xl bg-card p-4 shadow-sm">
      <summary className="flex min-h-11 cursor-pointer items-center text-base font-black">
        Modelli e pesi
      </summary>
      <p className="m-0 mb-2 text-sm text-muted-foreground">
        Alle {romeClock(hour.time).hour}:00. Conta di più chi ha sbagliato meno
        vicino a Caprera a questa distanza di tempo. Il vento atteso è la
        mediana pesata, non la media.
      </p>
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1 font-semibold">Modello</th>
            <th className="py-1 text-right font-semibold">km</th>
            <th className="py-1 text-right font-semibold">kn</th>
            <th className="py-1 text-right font-semibold">Da</th>
            <th className="py-1 text-right font-semibold">Peso</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t" key={row.model}>
              <td className="py-1 font-semibold">{row.label}</td>
              <td className="py-1 text-right">{row.km}</td>
              <td className="py-1 text-right font-bold">
                {formatKnots(row.speed)}
              </td>
              <td className="py-1 text-right">
                {directionText(row.direction)}
              </td>
              <td className="py-1 text-right">
                {Math.round(row.weight * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="m-0 mt-2 text-xs text-muted-foreground">
        Dati: Open-Meteo, CC BY 4.0, dai modelli indicati.
      </p>
    </details>
  )
}

export function WeatherScreen({
  course,
  onHome,
}: {
  course: CourseRecord
  onHome: () => void
}) {
  const [zone, setZone] = useState<WindZoneId>(() =>
    zoneForCourse(course.family),
  )
  const { forecast, state, now, refresh } = useWindForecast(zone, "always")
  const [horizon, setHorizon] = useState<WindHorizon>(() =>
    defaultHorizon(course, Math.floor(Date.now() / 1000)),
  )
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const heroAnchor = useRef<HTMLDivElement>(null)

  const hours = useMemo(
    () => (forecast ? blendForecast(forecast, now) : []),
    [forecast, now],
  )
  const slots = useMemo(
    () => slotsForHorizon(horizon, course, now),
    [course, horizon, now],
  )
  // The hero's choice survives a change of horizon by looking in both.
  const allSlots = useMemo(
    () => [
      ...slotsForHorizon("week", course, now),
      ...slotsForHorizon("seven", course, now),
    ],
    [course, now],
  )
  const picked = allSlots.find((slot) => slot.key === pickedKey) ?? null
  const nextSlot = slots[0] ?? slotsForHorizon("seven", course, now)[0] ?? null
  const heroSlot = picked ?? nextSlot

  function pick(slot: WindSlot) {
    setPickedKey(slot.key === nextSlot?.key ? null : slot.key)
    heroAnchor.current?.scrollIntoView({ block: "start", behavior: "smooth" })
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-1">
        <button
          aria-label="Indietro da Vento"
          className="grid size-11 shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring"
          onClick={onHome}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <h1 className="m-0 min-w-0 truncate text-2xl font-black tracking-tight">
          Vento
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Segmented
          label="Area"
          onChange={(value) => {
            setZone(value)
          }}
          options={(["derive", "cabinati"] as const).map((value) => ({
            value,
            label: WIND_ZONES[value].label,
          }))}
          value={zone}
        />
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
      <p className="m-0 px-1 text-sm text-muted-foreground">
        {WIND_ZONES[zone].description}
      </p>

      <StatusLine
        forecast={forecast}
        now={now}
        onRefresh={() => void refresh()}
        state={state}
      />

      <div className="scroll-mt-3" ref={heroAnchor} />

      {!forecast && state === "failed" && (
        <section className="rounded-2xl bg-card p-4 shadow-sm">
          <p className="m-0 text-base">
            Serve la rete per la prima previsione. Dopo, l&apos;ultima scaricata
            resta qui anche senza segnale.
          </p>
          <Button
            className="mt-3 min-h-11 w-full"
            onClick={() => void refresh()}
          >
            Riprova
          </Button>
        </section>
      )}

      {forecast && heroSlot && (
        <SlotHero
          forecast={forecast}
          hours={hours}
          now={now}
          onBackToNext={() => setPickedKey(null)}
          picked={picked !== null}
          slot={heroSlot}
          zone={zone}
        />
      )}

      {forecast && <Next24Hours hours={hours} slots={allSlots} />}

      {forecast && (
        <DaysOverview
          hours={hours}
          onSelect={pick}
          selectedKey={heroSlot?.key ?? null}
          slots={slots}
          title={
            horizon === "week"
              ? "Questa settimana di corso"
              : "Prossimi 7 giorni"
          }
        />
      )}

      {horizon === "week" && slots.length === 0 && (
        <p className="m-0 px-1 text-sm text-muted-foreground">
          Le uscite di questo corso sono finite.
        </p>
      )}

      <LammaMap key={heroSlot?.key ?? "now"} now={now} slot={heroSlot} />

      {forecast && <ModelDetails hours={hours} slot={heroSlot} />}

      <section aria-labelledby="wind-links">
        <h2 className="m-0 mb-2 px-1 text-base font-black" id="wind-links">
          Altre fonti
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {WEATHER_LINKS.map((link) => (
            <a
              className="flex min-h-14 flex-col justify-center rounded-xl bg-card px-3 py-1.5 shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring"
              href={link.url}
              key={link.label}
              rel="noreferrer"
              target="_blank"
            >
              <span className="flex items-center gap-1 text-sm font-black">
                {link.label}
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </span>
              <span className="text-xs text-muted-foreground">
                {link.detail}
              </span>
            </a>
          ))}
        </div>
      </section>

      <p className="m-0 px-1 text-xs text-muted-foreground">
        È una previsione, non una misura: la decisione di uscire resta
        dell&apos;istruttore, sul posto e con il bollettino ufficiale.
      </p>
    </div>
  )
}

export function WeatherHomeCard({
  course,
  onOpen,
}: {
  course: CourseRecord
  onOpen: () => void
}) {
  const zone = zoneForCourse(course.family)
  const { forecast, now } = useWindForecast(zone, "whenCached")
  const usable =
    forecast !== null && now - forecast.fetchedAt < VERY_STALE_AFTER_SECONDS
  const line = useMemo(() => {
    if (!usable || !forecast) return null
    const hours = blendForecast(forecast, now)
    const slot =
      slotsForHorizon(defaultHorizon(course, now), course, now)[0] ?? null
    const summary = slot ? summariseHours(hoursInSlot(hours, slot)) : null
    return slot && summary ? { slot, summary } : null
  }, [course, forecast, now, usable])

  return (
    <button className="home-wind" onClick={onOpen} type="button">
      {line ? (
        <>
          <WindArrow
            className="shrink-0 text-primary"
            degrees={line.summary.direction}
            size={32}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-muted-foreground">
              Vento · {slotShortLabel(line.slot)}
            </span>
            <span className="block text-lg leading-tight font-black tabular-nums">
              {directionText(line.summary.direction)}{" "}
              {formatRange(line.summary.low, line.summary.high)} kn
              {line.summary.gust !== null && (
                <span className="ml-1.5 text-sm font-bold text-muted-foreground">
                  raffiche {formatKnots(line.summary.gust)}
                </span>
              )}
            </span>
          </span>
          {line.summary.agreement === "bassa" && (
            <UncertainMark className="size-4 shrink-0 text-[#b42318]" />
          )}
        </>
      ) : (
        <>
          <WindArrow
            className="shrink-0 text-primary"
            degrees={315}
            size={28}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-lg leading-tight font-black">
              Vento
            </span>
            <span className="block text-sm text-muted-foreground">
              Prossima uscita e settimana
            </span>
          </span>
        </>
      )}
      <ChevronRight
        aria-hidden="true"
        className="size-5 shrink-0 text-muted-foreground"
      />
    </button>
  )
}
