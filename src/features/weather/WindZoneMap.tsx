import { useMemo, type CSSProperties } from "react"

import {
  blendForecast,
  compassPoint,
  romeClock,
  type BlendedHour,
  type WindForecast,
} from "@/domain/wind"
import { CENTRE_PLACE, WIND_ZONES, type WindZoneId } from "@/domain/windConfig"
import { COASTLINES } from "@/features/weather/coastline"
import { WeatherIcon } from "@/features/weather/WeatherIcon"
import { WindArrow } from "@/features/weather/WindArrow"
import {
  formatKnots,
  formatTemperature,
  hourSkyInWords,
  tintFor,
} from "@/features/weather/windFormat"

const SEA = "#d6e6f2"
const LAND = "#f3eee2"
const COAST = "#6f8193"
const INK = "#1f2a37"

/**
 * The map's text follows the map's width, not the reader's text size: larger
 * text would only pile the places on one another. The same numbers are in
 * words for screen readers and, larger, in the Numeri view.
 */
const MAP_TEXT: CSSProperties = { fontSize: "clamp(12px, 4.8cqw, 19px)" }
const SMALL_TEXT: CSSProperties = { fontSize: "max(11px, 0.75em)" }

function projector(zone: WindZoneId) {
  const { box, width, height } = COASTLINES[zone]
  const scaleX = Math.cos(((box.south + box.north) / 2) * (Math.PI / 180))
  const k = width / ((box.east - box.west) * scaleX)
  return (latitude: number, longitude: number) => ({
    left: (((longitude - box.west) * scaleX * k) / width) * 100,
    top: (((box.north - latitude) * k) / height) * 100,
  })
}

/** Where a marker sits against its point: away from the edge it is near. */
function anchor(left: number) {
  if (left < 18) return "-0.9em"
  if (left > 82) return "calc(-100% + 0.9em)"
  return "-50%"
}

function at(position: { left: number; top: number }, transform: string) {
  return {
    left: `${position.left}%`,
    top: `${position.top}%`,
    transform,
  }
}

/**
 * The zone drawn from OpenStreetMap's coastline, with the blended wind at each
 * forecast point for one hour: the same numbers as the rest of the screen,
 * placed where they are, and nothing downloaded to draw it.
 */
export function WindZoneMap({
  forecast,
  now,
  zone,
  time,
  sky,
}: {
  forecast: WindForecast
  now: number
  zone: WindZoneId
  /** The hour shown, as the blend's Unix seconds. */
  time: number
  /** The whole zone's hour, for its sky. */
  sky: BlendedHour | undefined
}) {
  const coast = COASTLINES[zone]
  const place = useMemo(() => projector(zone), [zone])
  const byPoint = useMemo(
    () =>
      WIND_ZONES[zone].points.map((point) => ({
        point,
        hours: blendForecast(forecast, now, [point.id]),
      })),
    [forecast, now, zone],
  )
  const markers = byPoint.map(({ point, hours }) => ({
    point,
    hour: hours.find((item) => item.time === time),
    position: place(point.latitude, point.longitude),
  }))
  const centre = place(CENTRE_PLACE.latitude, CENTRE_PLACE.longitude)
  const clock = romeClock(time).hour

  return (
    <figure className="m-0">
      <div
        aria-label={`Mappa ${WIND_ZONES[zone].label} alle ${clock}`}
        className="relative overflow-hidden rounded-xl border"
        role="group"
        style={{
          aspectRatio: `${coast.width} / ${coast.height}`,
          containerType: "inline-size",
        }}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 size-full"
          preserveAspectRatio="none"
          viewBox={`0 0 ${coast.width} ${coast.height}`}
        >
          <rect fill={SEA} height={coast.height} width={coast.width} />
          <path
            d={coast.path}
            fill={LAND}
            stroke={COAST}
            strokeLinejoin="round"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="absolute inset-0" style={MAP_TEXT}>
          <span
            aria-hidden="true"
            className="absolute size-[0.6em] rounded-full border-2 bg-white"
            style={{
              ...at(centre, "translate(-50%, -50%)"),
              borderColor: INK,
            }}
          />

          {markers.map(({ point, hour, position }) => {
            const tint = hour ? tintFor(hour.mid) : null
            return (
              <div
                className="absolute"
                key={point.id}
                style={at(
                  position,
                  `translate(${anchor(position.left)}, -0.9em)`,
                )}
              >
                <span className="sr-only">
                  {point.label}:{" "}
                  {hour
                    ? `${hour.direction === null ? "direzione variabile" : `da ${compassPoint(hour.direction)}`}, ${formatKnots(hour.mid)} nodi${hour.gust === null ? "" : `, raffiche ${formatKnots(hour.gust)}`}`
                    : "nessun dato"}
                </span>
                <span
                  aria-hidden="true"
                  className="flex items-center gap-[0.25em] rounded-full border py-[0.1em] pr-[0.5em] pl-[0.1em] whitespace-nowrap shadow-sm"
                  style={{
                    background: tint?.background ?? "#ffffff",
                    borderColor: `${INK}66`,
                    color: tint?.color ?? INK,
                  }}
                >
                  <span
                    className="grid size-[1.6em] place-items-center rounded-full bg-white"
                    style={{ color: INK }}
                  >
                    <WindArrow
                      className="size-[1.25em]"
                      degrees={hour ? hour.direction : null}
                    />
                  </span>
                  <span className="leading-none font-black tabular-nums">
                    {hour ? formatKnots(hour.mid) : "–"}
                  </span>
                  {hour && hour.gust !== null && (
                    <span
                      className="leading-none font-bold tabular-nums"
                      style={SMALL_TEXT}
                    >
                      r{formatKnots(hour.gust)}
                    </span>
                  )}
                </span>
              </div>
            )
          })}

          {/* Names last, so a neighbour's marker never hides one. */}
          {[
            ...markers.map(({ point, position }) => ({
              key: point.id,
              text: point.label,
              style: at(position, `translate(${anchor(position.left)}, 1em)`),
            })),
            {
              key: "centre",
              text: CENTRE_PLACE.label,
              style: at(centre, "translate(calc(-100% - 0.45em), -50%)"),
            },
          ].map((name) => (
            <div
              aria-hidden="true"
              className="absolute"
              key={name.key}
              style={name.style}
            >
              <span
                className="block rounded bg-white/85 px-[0.3em] leading-tight font-bold whitespace-nowrap"
                style={{ ...SMALL_TEXT, color: INK }}
              >
                {name.text}
              </span>
            </div>
          ))}

          <div
            aria-hidden="true"
            className="absolute top-[0.4em] left-[0.4em] flex items-center gap-[0.25em] rounded-lg bg-white/90 px-[0.45em] py-[0.1em] font-black"
            style={{ color: INK, fontSize: "0.85em" }}
          >
            {clock}:00
            {sky?.weather && (
              <WeatherIcon className="size-[1.1em]" kind={sky.weather} />
            )}
            {sky && sky.temperature !== null && (
              <span className="tabular-nums">
                {formatTemperature(sky.temperature)}
              </span>
            )}
          </div>
          <div
            aria-hidden="true"
            className="absolute top-[0.4em] right-[0.4em] grid justify-items-center rounded-lg bg-white/90 px-[0.35em] leading-tight font-black"
            style={{ ...SMALL_TEXT, color: INK }}
          >
            <span>N</span>
            <svg className="size-[0.9em]" viewBox="-6 -6 12 12">
              <path d="M0 -6 L4 5 L0 2 L-4 5 Z" fill="currentColor" />
            </svg>
          </div>
        </div>
      </div>
      <figcaption className="mt-1 text-sm text-muted-foreground">
        {sky && (
          <span className="sr-only">
            Alle {clock}
            {hourSkyInWords(sky)}.{" "}
          </span>
        )}
        Frecce: dove va il vento, nodi attesi, r = raffica. Costa ©{" "}
        <a
          aria-label="OpenStreetMap, i suoi collaboratori: nuova scheda"
          className="underline"
          href="https://www.openstreetmap.org/copyright"
          rel="noreferrer"
          target="_blank"
        >
          OpenStreetMap
        </a>
        .
      </figcaption>
    </figure>
  )
}
