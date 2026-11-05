import { ChevronRight, CloudLightning, Wind } from "lucide-react"
import { useMemo } from "react"

import {
  blendForecast,
  hoursInSlot,
  nextDecisionSlot,
  summariseHours,
} from "@/domain/wind"
import { zoneForCourse } from "@/domain/windConfig"
import { useWindForecast } from "@/features/weather/useWindForecast"
import { WindArrow } from "@/features/weather/WindArrow"
import {
  ageForStrip,
  directionText,
  formatKnots,
  slotShortLabel,
  spokenSummary,
} from "@/features/weather/windFormat"
import type { CourseRecord } from "@/persistence/courses"

const STALE_AFTER_SECONDS = 6 * 3600
const TOO_OLD_AFTER_SECONDS = 24 * 3600

/** Home's line: the forecast last downloaded, its age, and never a network call. */
export function WeatherHomeCard({
  course,
  onOpen,
}: {
  course: CourseRecord
  onOpen: () => void
}) {
  const { forecast, now } = useWindForecast(
    zoneForCourse(course.family),
    "cacheOnly",
  )
  const age = forecast ? now - forecast.fetchedAt : 0
  const tooOld = forecast !== null && age >= TOO_OLD_AFTER_SECONDS
  const line = useMemo(() => {
    if (!forecast || tooOld) return null
    const slot = nextDecisionSlot(course, now)
    const summary = summariseHours(
      hoursInSlot(blendForecast(forecast, now), slot),
    )
    return summary ? { slot, summary } : null
  }, [course, forecast, now, tooOld])

  if (!line || !forecast) {
    const text = tooOld
      ? "Dati vecchi: tocca per aggiornare"
      : "Tocca per scaricare, serve la rete"
    return (
      <button
        aria-label={`Vento. ${text}`}
        className="home-wind"
        onClick={onOpen}
        type="button"
      >
        <Wind aria-hidden="true" className="size-6 shrink-0 text-[#71849b]" />
        <span className="min-w-0 flex-1">
          <span className="block text-base leading-tight font-black">
            Vento
          </span>
          <span className="block text-sm text-muted-foreground">{text}</span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground"
        />
      </button>
    )
  }

  const { slot, summary } = line
  const stale = age >= STALE_AFTER_SECONDS
  const ageText = stale ? ageForStrip(forecast.fetchedAt, now) : null
  const far = summary.reach !== "near"
  const name =
    `Vento, ${slotShortLabel(slot)}: ${spokenSummary(summary)}` +
    (summary.thunder === null ? " Temporali: dato non scaricato." : "") +
    (ageText ? ` ${ageText}.` : "")

  return (
    <button
      aria-label={name}
      className="home-wind"
      onClick={onOpen}
      type="button"
    >
      <WindArrow
        className="shrink-0 text-primary"
        degrees={summary.direction}
        size={32}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-muted-foreground">
          Vento · {slotShortLabel(slot)}
          {far && " · solo tendenza"}
          {summary.split && " · incerto"}
          {ageText && ` · ${ageText}`}
        </span>
        <span className="block text-lg leading-tight font-black tabular-nums">
          {directionText(summary.direction)} {far && "~"}
          {formatKnots(summary.mid)} kn{" "}
          {summary.gust !== null && (
            <span className="text-sm font-bold whitespace-nowrap">
              raffiche {formatKnots(summary.gust)}
            </span>
          )}
        </span>
        {summary.thunder && (
          <span className="flex items-center gap-1 text-sm font-bold text-[#7f2f17]">
            <CloudLightning
              aria-hidden="true"
              className="size-4 shrink-0 text-[#b42318]"
            />
            Temporali possibili
          </span>
        )}
        {summary.thunder === null && (
          <span className="block text-sm text-muted-foreground">
            Temporali: dato non scaricato
          </span>
        )}
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-5 shrink-0 text-muted-foreground"
      />
    </button>
  )
}
