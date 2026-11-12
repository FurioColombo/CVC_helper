import { useLayoutEffect, useMemo, useRef, useState } from "react"

import { CENTRE_PLACE, type WindZoneId } from "@/domain/windConfig"
import { COASTLINES } from "@/features/weather/coastline"
import { WindArrow } from "@/features/weather/WindArrow"
import { formatKnots, tintFor } from "@/features/weather/windFormat"
import {
  placeMarks,
  placeNames,
  type Box,
  type Spot,
} from "@/features/weather/mapNames"
import type { PlaceHours } from "@/features/weather/zonePlaces"

const SEA = "#a9c9e3"
const LAND = "#f7f3ea"
const COAST = "#3f5163"
const INK = "#1f2a37"

/**
 * The map is a picture of the list under it, which says the same at the
 * reader's text size; so its text follows the map's width, between floors
 * that stay readable outdoors.
 */
const MAP_TEXT = { fontSize: "clamp(16px, 4.8cqw, 20px)" }
const NAME_TEXT = { fontSize: "max(13px, 0.75em)" }

function projector(zone: WindZoneId) {
  const { box, width, height } = COASTLINES[zone]
  const scaleX = Math.cos(((box.south + box.north) / 2) * (Math.PI / 180))
  const k = width / ((box.east - box.west) * scaleX)
  return (latitude: number, longitude: number) => ({
    left: (((longitude - box.west) * scaleX * k) / width) * 100,
    top: (((box.north - latitude) * k) / height) * 100,
  })
}

/**
 * The zone drawn from OpenStreetMap's coastline, with the blended wind at each
 * forecast point for one hour, and nothing downloaded to draw it. A picture
 * only: the list under it carries the same values for every reader.
 */
export function WindZoneMap({
  zone,
  places,
  time,
}: {
  zone: WindZoneId
  places: readonly PlaceHours[]
  /** The hour shown, as the blend's Unix seconds. */
  time: number
}) {
  const coast = COASTLINES[zone]
  const place = useMemo(() => projector(zone), [zone])
  const markers = places.map(({ point, hours }) => ({
    point,
    hour: hours.find((item) => item.time === time),
    position: place(point.latitude, point.longitude),
  }))
  const centre = place(CENTRE_PLACE.latitude, CENTRE_PLACE.longitude)
  const frame = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<{
    marks: Record<string, Spot>
    names: Record<string, Spot>
  } | null>(null)

  // Markers first, each over its own point, then the names around them.
  useLayoutEffect(() => {
    const root = frame.current
    if (!root) return
    const measure = () => {
      const outer = root.getBoundingClientRect()
      if (outer.width === 0) return
      const boxes = new Map<string, Box>()
      for (const element of root.querySelectorAll<HTMLElement>(
        "[data-map-mark]:not([data-map-pill])",
      )) {
        const box = element.getBoundingClientRect()
        boxes.set(element.dataset.mapMark ?? "", {
          left: box.left - outer.left,
          top: box.top - outer.top,
          right: box.right - outer.left,
          bottom: box.bottom - outer.top,
        })
      }
      const pills = [
        ...root.querySelectorAll<HTMLElement>("[data-map-pill]"),
      ].map((element) => {
        const arrow = element.querySelector<HTMLElement>("[data-map-arrow]")
        return {
          key: element.dataset.mapPill ?? "",
          x: (Number(element.dataset.x) / 100) * outer.width,
          y: (Number(element.dataset.y) / 100) * outer.height,
          width: element.offsetWidth,
          height: element.offsetHeight,
          arrow: arrow ? arrow.offsetLeft + arrow.offsetWidth / 2 : 0,
        }
      })
      const marks = placeMarks(outer, pills, [...boxes.values()])
      for (const pill of pills) {
        const spot = marks[pill.key]
        if (!spot) continue
        boxes.set(pill.key, {
          left: spot.left,
          top: spot.top,
          right: spot.left + pill.width,
          bottom: spot.top + pill.height,
        })
      }
      const names = placeNames(
        outer,
        boxes,
        [...root.querySelectorAll<HTMLElement>("[data-map-name]")].map(
          (element) => ({
            key: element.dataset.mapName ?? "",
            width: element.offsetWidth,
            height: element.offsetHeight,
          }),
        ),
      )
      const next = { marks, names }
      setLayout((current) =>
        JSON.stringify(current) === JSON.stringify(next) ? current : next,
      )
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [places, time, zone])

  const names = [
    ...markers.map(({ point }) => ({ key: point.id, text: point.label })),
    { key: "centre", text: CENTRE_PLACE.label },
  ]

  return (
    <div>
      <div
        aria-hidden="true"
        className="relative overflow-hidden rounded-xl border"
        data-zone-map={zone}
        style={{
          aspectRatio: `${coast.width} / ${coast.height}`,
          containerType: "inline-size",
        }}
      >
        <svg
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
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="absolute inset-0" ref={frame} style={MAP_TEXT}>
          <span
            className="absolute size-[0.6em] rounded-full border-2 bg-white"
            data-map-mark="centre"
            style={{
              left: `${centre.left}%`,
              top: `${centre.top}%`,
              transform: "translate(-50%, -50%)",
              borderColor: INK,
            }}
          />

          {markers.map(({ point, hour, position }) => {
            const tint = hour ? tintFor(hour.mid) : null
            const clear = !tint || tint.background === "transparent"
            const spot = layout?.marks[point.id]
            return (
              <span
                className="absolute flex items-center gap-[0.2em] rounded-full border py-[0.1em] pr-[0.45em] pl-[0.1em] whitespace-nowrap shadow-sm"
                data-map-mark={point.id}
                data-map-pill={point.id}
                data-x={position.left}
                data-y={position.top}
                key={point.id}
                style={{
                  ...(spot
                    ? { left: `${spot.left}px`, top: `${spot.top}px` }
                    : {
                        left: `${position.left}%`,
                        top: `${position.top}%`,
                        transform: "translate(-0.85em, -50%)",
                      }),
                  background: clear ? "#ffffff" : tint.background,
                  borderColor: `${INK}66`,
                  color: clear ? INK : tint.color,
                }}
              >
                <span
                  className="grid size-[1.5em] place-items-center rounded-full bg-white"
                  data-map-arrow
                  style={{ color: INK }}
                >
                  <WindArrow
                    className="size-[1.2em]"
                    degrees={hour ? hour.direction : null}
                  />
                </span>
                <span className="leading-none font-black tabular-nums">
                  {hour ? formatKnots(hour.mid) : "–"}
                </span>
              </span>
            )
          })}

          {names.map((name) => {
            const spot = layout?.names[name.key]
            return (
              <span
                className="absolute block rounded bg-white/90 px-[0.3em] leading-tight font-bold whitespace-nowrap"
                data-map-name={name.key}
                key={name.key}
                style={{
                  ...NAME_TEXT,
                  color: INK,
                  left: spot ? `${spot.left}px` : 0,
                  top: spot ? `${spot.top}px` : 0,
                  visibility: spot ? "visible" : "hidden",
                }}
              >
                {name.text}
              </span>
            )
          })}

          <span
            className="absolute top-[0.4em] right-[0.4em] grid justify-items-center rounded-lg bg-white/90 px-[0.35em] leading-tight font-black"
            data-map-mark="north"
            style={{ ...NAME_TEXT, color: INK }}
          >
            <span>N</span>
            <svg className="size-[0.9em]" viewBox="-6 -6 12 12">
              <path d="M0 -6 L4 5 L0 2 L-4 5 Z" fill="currentColor" />
            </svg>
          </span>
        </div>
      </div>
      <p aria-hidden="true" className="m-0 mt-1 text-sm text-muted-foreground">
        Frecce: dove va il vento, con i nodi attesi. Costa © OpenStreetMap.
      </p>
    </div>
  )
}
