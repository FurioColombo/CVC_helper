import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { romeClock, type WindSlot } from "@/domain/wind"
import { WIND_SESSION_HOURS } from "@/domain/windConfig"
import {
  estimatedLammaRun,
  LAMMA_LAST_STEP,
  lammaHoursFromStep,
  lammaMapUrl,
  lammaStepFromHours,
  type LammaField,
} from "@/features/weather/lammaMap"
import { Segmented } from "@/features/weather/Segmented"
import { slotLabel } from "@/features/weather/windFormat"

const lammaLabel = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
})

/** The middle of a session: noon UTC on its date, moved to that hour in Rome. */
function slotMiddle(slot: WindSlot) {
  const { start, end } = WIND_SESSION_HOURS[slot.period]
  const noon = Date.parse(`${slot.date}T12:00:00Z`) / 1000
  return noon + (Math.round((start + end) / 2) - romeClock(noon).hour) * 3600
}

/** True once the box nears the screen: a tap above must not spend the phone's data. */
function useNearScreen() {
  const box = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(
    () => typeof IntersectionObserver === "undefined",
  )
  useEffect(() => {
    const element = box.current
    if (near || !element) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true)
      },
      { rootMargin: "200px" },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [near])
  return { box, near }
}

/**
 * Keyed by session by its parent, so a new session starts at that session's hour.
 * The run is fixed for the map's life: recomputing it on the clock would move the
 * label twelve hours under a picture that had not changed.
 */
export function WindLammaMap({
  slot,
  now,
  field,
  onField,
}: {
  slot: WindSlot
  now: number
  field: LammaField
  onField: (field: LammaField) => void
}) {
  const [run] = useState(() => estimatedLammaRun(now))
  const [target] = useState(() => (slotMiddle(slot) - run) / 3600)
  const [step, setStep] = useState(() => lammaStepFromHours(target))
  const [failed, setFailed] = useState(false)
  const { box, near } = useNearScreen()

  const valid = run + lammaHoursFromStep(step) * 3600
  const time = `circa ${lammaLabel.format(new Date(valid * 1000))}`
  const url = lammaMapUrl(field, step, run)
  const fieldName = field === "wind10" ? "vento" : "onda"
  const beyondReach = target > lammaHoursFromStep(LAMMA_LAST_STEP)

  function move(by: number) {
    const next = step + by
    if (next < 1 || next > LAMMA_LAST_STEP) return
    setStep(next)
    setFailed(false)
  }

  return (
    <section
      aria-labelledby="wind-lamma"
      className="scroll-mt-3"
      id="mappa-lamma"
    >
      <h2
        className="m-0 mb-2 text-base font-black outline-none"
        id="wind-lamma"
        tabIndex={-1}
      >
        Mappa LaMMA
      </h2>
      {beyondReach && (
        <p className="m-0 mb-2 text-sm font-semibold">
          LaMMA arriva fino a{" "}
          {lammaLabel.format(
            new Date((run + lammaHoursFromStep(LAMMA_LAST_STEP) * 3600) * 1000),
          )}
          : {slotLabel(slot)} è oltre.
        </p>
      )}
      <div
        aria-live="polite"
        className="-mx-5 max-[350px]:-mx-[12px]"
        ref={box}
      >
        {failed && (
          <p className="m-0 bg-muted p-4 text-sm">
            Mappa non caricata: serve la rete, o LaMMA non l&apos;ha pubblicata.
            Prova un&apos;altra ora.
          </p>
        )}
        {!failed && !near && (
          <div className="aspect-[1168/820] w-full bg-muted" />
        )}
        {!failed && near && (
          <a
            aria-label={`Mappa LaMMA di ${fieldName} sulle Bocche di Bonifacio, ${time}: apri l'immagine, nuova scheda`}
            className="block outline-none focus-visible:ring-3 focus-visible:ring-ring"
            href={url}
            rel="noreferrer"
            target="_blank"
          >
            <img
              alt=""
              className="block h-auto w-full bg-muted [aspect-ratio:auto_1168/820]"
              decoding="async"
              loading="lazy"
              onError={() => setFailed(true)}
              referrerPolicy="no-referrer"
              src={url}
            />
          </a>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          aria-disabled={step <= 1}
          aria-label="Mappa precedente"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring aria-disabled:opacity-40"
          onClick={() => move(-1)}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <span
          aria-live="polite"
          className="min-w-[min(7rem,100%)] flex-1 text-center text-sm font-bold"
        >
          {time}
        </span>
        <button
          aria-disabled={step >= LAMMA_LAST_STEP}
          aria-label="Mappa successiva"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring aria-disabled:opacity-40"
          onClick={() => move(1)}
          type="button"
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
        <div className="min-w-[min(10rem,100%)] flex-1">
          <Segmented
            label="Campo della mappa"
            onChange={(value) => {
              onField(value)
              setFailed(false)
            }}
            options={[
              { value: "wind10", label: "Vento" },
              { value: "swh", label: "Onda" },
            ]}
            value={field}
          />
        </div>
      </div>
      <p className="m-0 mt-1 text-sm text-muted-foreground">
        L&apos;ora esatta è stampata sulla mappa, in UTC. MOLOCH (LaMMA), da
        ECMWF. © Consorzio LaMMA, lamma.toscana.it, CC BY-ND.
      </p>
    </section>
  )
}
