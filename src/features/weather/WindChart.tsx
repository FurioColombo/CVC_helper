import { useEffect, useRef, useState } from "react"

import type { BlendedHour, WindSlot } from "@/domain/wind"
import { compassPoint, hoursInSlot, romeClock } from "@/domain/wind"
import { WindArrowPath } from "@/features/weather/WindArrow"
import { formatKnots, slotShortLabel } from "@/features/weather/windFormat"

const BASE_FONT_PX = 12

const dayShort = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  timeZone: "Europe/Rome",
})

/** The drawn width in real pixels, and the text size the root font asks for. */
function useMeasure() {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 340, font: BASE_FONT_PX })
  useEffect(() => {
    const element = box.current
    if (!element) return undefined
    const measure = () => {
      const root = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      )
      setSize({
        width: element.clientWidth || 340,
        font: (BASE_FONT_PX * (root || 16)) / 16,
      })
    }
    measure()
    if (typeof ResizeObserver === "undefined") return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { box, ...size }
}

function niceTicks(yMax: number) {
  const step = yMax > 45 ? 20 : 10
  const ticks: number[] = []
  for (let knots = step; knots < yMax; knots += step) ticks.push(knots)
  return ticks
}

/**
 * Twenty-four hours in one view, without scrolling (rulebook R18): the band is
 * where the wind is likely to be, the thick line the expected wind, the thin
 * stepped one the gusts. Every session is named with its day, so a PM here can
 * never be read as the PM of the session above. Text is drawn in real pixels and
 * follows the phone's text size; the list below holds the same data exactly.
 */
export function WindChart({
  hours,
  slots,
  heroKey,
}: {
  hours: readonly BlendedHour[]
  slots: readonly WindSlot[]
  heroKey: string | null
}) {
  const { box, width, font } = useMeasure()
  const axis = font * 2.2
  const plot = {
    left: axis,
    right: width - 4,
    top: font * 1.6,
    bottom: font * 12,
  }
  const barY = plot.bottom + 4
  const sessionY = barY + 8 + font
  const arrowY = sessionY + font * 0.6 + 10
  const hourY = arrowY + 12 + font
  const height = hourY + 4

  const top = Math.max(
    20,
    ...hours.map((hour) => Math.max(hour.high, hour.gust ?? 0)),
  )
  const yMax = Math.ceil((top + 2) / 10) * 10
  const x = (index: number) =>
    plot.left + (index / (hours.length - 1)) * (plot.right - plot.left)
  const y = (knots: number) =>
    plot.bottom - (knots / yMax) * (plot.bottom - plot.top)

  const band = [
    ...hours.map((hour, index) => `${x(index)},${y(hour.high)}`),
    ...hours.map((hour, index) => `${x(index)},${y(hour.low)}`).reverse(),
  ].join(" ")
  const line = hours
    .map((hour, index) => `${x(index)},${y(hour.mid)}`)
    .join(" ")
  const gustSteps = hours.flatMap((hour, index) =>
    hour.gust === null
      ? []
      : [
          `${x(index)},${y(hour.gust)}`,
          `${x(Math.min(index + 1, hours.length - 1))},${y(hour.gust)}`,
        ],
  )
  const peakGust = hours.reduce<{ index: number; gust: number } | null>(
    (best, hour, index) =>
      hour.gust !== null && (!best || hour.gust > best.gust)
        ? { index, gust: hour.gust }
        : best,
    null,
  )

  const sessions = slots.flatMap((slot) => {
    const inSlot = hoursInSlot(hours, slot)
    const firstHour = inSlot[0]
    const lastHour = inSlot[inSlot.length - 1]
    if (!firstHour || !lastHour) return []
    const first = hours.indexOf(firstHour)
    // The session runs to the end of its last hour, not to its start.
    const last = Math.min(hours.indexOf(lastHour) + 1, hours.length - 1)
    if (last <= first) return []
    return [{ slot, first, last }]
  })

  // On the clock's own multiples, so midnight is always labelled with its day.
  const labelEvery = width / font < 26 ? 6 : 3
  const gustLabel = peakGust ? `raffiche ${formatKnots(peakGust.gust)}` : ""
  const gustLabelWidth = gustLabel.length * font * 0.62
  const first = hours[0] as BlendedHour
  const peak = hours.reduce(
    (best, hour) => (hour.mid > best.mid ? hour : best),
    first,
  )
  const low = hours.reduce(
    (best, hour) => (hour.mid < best.mid ? hour : best),
    first,
  )
  const firstThunder = hours.find((hour) => hour.thunder)
  const description =
    `Vento nelle prossime ${hours.length - 1} ore: da ${formatKnots(low.mid)} ` +
    `a ${formatKnots(peak.mid)} nodi, massimo alle ${romeClock(peak.time).hour}.` +
    (peakGust ? ` Raffica massima ${formatKnots(peakGust.gust)}.` : "") +
    (peak.direction === null
      ? ""
      : ` Direzione ${compassPoint(peak.direction)}.`) +
    (firstThunder
      ? ` Temporali possibili dalle ${romeClock(firstThunder.time).hour}.`
      : "")

  return (
    <div ref={box}>
      <svg
        aria-label={description}
        className="block w-full"
        height={height}
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        <text fill="var(--muted-foreground)" fontSize={font} x="0" y={font}>
          kn
        </text>
        <line
          stroke="var(--muted-foreground)"
          x1={plot.left}
          x2={plot.right}
          y1={plot.bottom}
          y2={plot.bottom}
        />
        <text
          fill="var(--muted-foreground)"
          fontSize={font}
          textAnchor="end"
          x={plot.left - 4}
          y={plot.bottom + font * 0.35}
        >
          0
        </text>
        {niceTicks(yMax).map((knots) => (
          <g key={knots}>
            <line
              stroke="var(--border)"
              x1={plot.left}
              x2={plot.right}
              y1={y(knots)}
              y2={y(knots)}
            />
            <text
              fill="var(--muted-foreground)"
              fontSize={font}
              textAnchor="end"
              x={plot.left - 4}
              y={y(knots) + font * 0.35}
            >
              {knots}
            </text>
          </g>
        ))}

        <polygon
          fill="var(--accent-blue)"
          fillOpacity="0.28"
          points={band}
          stroke="var(--accent-blue)"
          strokeOpacity="0.6"
        />
        <polyline
          fill="none"
          points={line}
          stroke="var(--accent-blue)"
          strokeLinejoin="round"
          strokeWidth="3.5"
        />
        {gustSteps.length > 0 && (
          <polyline
            fill="none"
            points={gustSteps.join(" ")}
            stroke="var(--foreground)"
            strokeWidth="1.5"
          />
        )}
        {peakGust && (
          <text
            fill="var(--foreground)"
            fontSize={font}
            fontWeight="700"
            x={Math.max(
              plot.left,
              Math.min(x(peakGust.index), plot.right - gustLabelWidth),
            )}
            y={Math.max(font, y(peakGust.gust) - 4)}
          >
            {gustLabel}
          </text>
        )}

        {hours.map((hour, index) =>
          hour.thunder ? (
            <path
              d={`M${x(index) + 1} ${plot.top - 8} l-5 8 h4 l-2 7 l6 -9 h-4 l2 -6 z`}
              fill="#b42318"
              key={`thunder-${hour.time}`}
            />
          ) : null,
        )}

        {sessions.map(({ slot, first: start, last }) => {
          const hero = slot.key === heroKey
          const span = x(last) - x(start)
          // The day where it fits; at large text at least which half of it.
          const label =
            span >= slotShortLabel(slot).length * font * 0.5
              ? slotShortLabel(slot)
              : slot.period
          return (
            <g key={slot.key}>
              <rect
                fill={hero ? "var(--primary)" : "var(--muted-foreground)"}
                height={hero ? 6 : 4}
                width={span}
                x={x(start)}
                y={barY}
              />
              {span >= label.length * font * 0.5 && (
                <text
                  fill={hero ? "var(--primary)" : "var(--muted-foreground)"}
                  fontSize={font}
                  fontWeight="700"
                  textAnchor="middle"
                  x={(x(start) + x(last)) / 2}
                  y={sessionY}
                >
                  {label}
                </text>
              )}
            </g>
          )
        })}

        {hours.map((hour, index) =>
          romeClock(hour.time).hour % 3 === 0 && hour.direction !== null ? (
            <WindArrowPath
              degrees={hour.direction}
              key={`arrow-${hour.time}`}
              size={16}
              x={Math.min(x(index), plot.right - 8)}
              y={arrowY}
            />
          ) : null,
        )}

        {hours.map((hour, index) => {
          const clock = romeClock(hour.time).hour
          if (clock % labelEvery !== 0) return null
          const midnight = clock === 0
          const atEnd = x(index) > width - font * 2
          return (
            <text
              fill={midnight ? "var(--foreground)" : "var(--muted-foreground)"}
              fontSize={font}
              fontWeight={midnight ? 700 : 400}
              key={`hour-${hour.time}`}
              textAnchor={atEnd ? "end" : "middle"}
              x={x(index)}
              y={hourY}
            >
              {midnight ? dayShort.format(new Date(hour.time * 1000)) : clock}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
