import type { BlendedHour, WindSlot } from "@/domain/wind"
import { compassPoint, hoursInSlot, romeClock } from "@/domain/wind"
import { WindArrowPath } from "@/features/weather/WindArrow"
import { formatKnots } from "@/features/weather/windFormat"

const WIDTH = 360
const HEIGHT = 196
const PLOT = { left: 26, right: 354, top: 12, bottom: 146 }
const ARROW_ROW_Y = 164
const HOUR_LABEL_Y = 190

/** Where Beaufort forces begin, F4 to F9, labelled in knots like the rest. */
const FORCE_LINES = [11, 17, 22, 28, 34, 41]

/**
 * Twenty-four hours in one view, without scrolling (rulebook R18): the shaded
 * band is what the models disagree over, the line their blend, the dots the
 * gusts. The arrows under it show where the wind blows. The hour-by-hour table
 * beside it is the same data for exact reading and for screen readers.
 */
export function WindChart({
  hours,
  slots,
}: {
  hours: readonly BlendedHour[]
  slots: readonly WindSlot[]
}) {
  if (hours.length < 2) return null
  const top = Math.max(
    20,
    ...hours.map((hour) => Math.max(hour.high, hour.gust ?? 0)),
  )
  const yMax = Math.ceil((top + 2) / 5) * 5
  const x = (index: number) =>
    PLOT.left + (index / (hours.length - 1)) * (PLOT.right - PLOT.left)
  const y = (knots: number) =>
    PLOT.bottom - (knots / yMax) * (PLOT.bottom - PLOT.top)

  const band = [
    ...hours.map((hour, index) => `${x(index)},${y(hour.high)}`),
    ...hours.map((hour, index) => `${x(index)},${y(hour.low)}`).reverse(),
  ].join(" ")
  const line = hours
    .map((hour, index) => `${x(index)},${y(hour.mid)}`)
    .join(" ")

  const shaded = slots.flatMap((slot) => {
    const inSlot = hoursInSlot(hours, slot)
    if (inSlot.length === 0) return []
    const firstHour = inSlot[0]
    const lastHour = inSlot[inSlot.length - 1]
    if (!firstHour || !lastHour) return []
    const first = hours.indexOf(firstHour)
    const last = hours.indexOf(lastHour)
    return [{ key: slot.key, period: slot.period, first, last }]
  })

  const first = hours[0] as BlendedHour
  const peak = hours.reduce(
    (best, hour) => (hour.mid > best.mid ? hour : best),
    first,
  )
  const low = hours.reduce(
    (best, hour) => (hour.mid < best.mid ? hour : best),
    first,
  )
  const description =
    `Vento nelle prossime ${hours.length} ore: da ${formatKnots(low.mid)} ` +
    `a ${formatKnots(peak.mid)} nodi, massimo alle ${romeClock(peak.time).hour}.` +
    (peak.direction === null
      ? ""
      : ` Direzione ${compassPoint(peak.direction)}.`)

  return (
    <svg
      aria-label={description}
      className="block h-auto w-full"
      role="img"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      {shaded.map(({ key, period, first, last }) => (
        <g key={key}>
          <rect
            fill="var(--muted)"
            height={PLOT.bottom - PLOT.top}
            width={Math.max(4, x(last) - x(first))}
            x={x(first)}
            y={PLOT.top}
          />
          {x(last) - x(first) >= 24 && (
            <text
              fill="var(--muted-foreground)"
              fontSize="11"
              fontWeight="700"
              textAnchor="middle"
              x={(x(first) + x(last)) / 2}
              y={PLOT.top + 11}
            >
              {period}
            </text>
          )}
        </g>
      ))}

      {FORCE_LINES.filter((knots) => knots < yMax).map((knots) => (
        <g key={knots}>
          <line
            stroke="var(--border)"
            strokeDasharray="2 3"
            x1={PLOT.left}
            x2={PLOT.right}
            y1={y(knots)}
            y2={y(knots)}
          />
          <text
            fill="var(--muted-foreground)"
            fontSize="10.5"
            textAnchor="end"
            x={PLOT.left - 4}
            y={y(knots) + 3.5}
          >
            {knots}
          </text>
        </g>
      ))}

      <polygon fill="var(--accent-blue)" fillOpacity="0.22" points={band} />
      <polyline
        fill="none"
        points={line}
        stroke="var(--accent-blue)"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      {hours.map((hour, index) =>
        hour.gust === null ? null : (
          <circle
            cx={x(index)}
            cy={y(Math.min(hour.gust, yMax))}
            fill="var(--foreground)"
            key={hour.time}
            r="1.8"
          />
        ),
      )}

      {hours.map((hour, index) =>
        index % 2 === 0 && hour.direction !== null ? (
          <WindArrowPath
            degrees={hour.direction}
            key={hour.time}
            size={15}
            x={x(index)}
            y={ARROW_ROW_Y}
          />
        ) : null,
      )}

      {hours.map((hour, index) =>
        index % 3 === 0 ? (
          <text
            fill="var(--muted-foreground)"
            fontSize="11"
            key={hour.time}
            textAnchor="middle"
            x={Math.min(x(index), WIDTH - 12)}
            y={HOUR_LABEL_Y}
          >
            {romeClock(hour.time).hour}
          </text>
        ) : null,
      )}
    </svg>
  )
}
