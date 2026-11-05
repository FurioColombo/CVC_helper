import { compassPoint } from "@/domain/wind"

/** Slim enough to read its direction at 18 px. */
const DART = "M0 -12 L5 11 L0 6 L-5 11 Z"

/** Points where the wind goes; a wind from NW points to SE. */
export function WindArrowPath({
  degrees,
  x,
  y,
  size,
}: {
  degrees: number
  x: number
  y: number
  size: number
}) {
  return (
    <path
      d={DART}
      fill="var(--foreground)"
      transform={`translate(${x} ${y}) rotate(${degrees + 180}) scale(${size / 24})`}
    />
  )
}

export function WindArrow({
  degrees,
  size = 24,
  className,
}: {
  degrees: number | null
  size?: number
  className?: string
}) {
  return (
    <svg
      aria-label={
        degrees === null
          ? "Direzione variabile"
          : `Vento da ${compassPoint(degrees)}`
      }
      className={className}
      height={size}
      role="img"
      viewBox="-12 -12 24 24"
      width={size}
    >
      {degrees === null ? (
        <circle
          cx="0"
          cy="0"
          fill="none"
          r="9"
          stroke="currentColor"
          strokeDasharray="3 3"
          strokeWidth="2"
        />
      ) : (
        <path
          d={DART}
          fill="currentColor"
          transform={`rotate(${degrees + 180})`}
        />
      )}
    </svg>
  )
}

/** The hero's compass: north at the top, the arrow where the wind goes. */
export function WindDial({
  degrees,
  size = 72,
}: {
  degrees: number | null
  size?: number
}) {
  return (
    <svg
      aria-label={
        degrees === null
          ? "Direzione variabile"
          : `Vento da ${compassPoint(degrees)}`
      }
      className="shrink-0 text-primary"
      height={size}
      role="img"
      viewBox="-36 -36 72 72"
      width={size}
    >
      <circle
        cx="0"
        cy="0"
        fill="none"
        r="33"
        stroke="var(--border)"
        strokeWidth="2"
      />
      <text
        aria-hidden="true"
        fill="var(--muted-foreground)"
        fontSize="11"
        fontWeight="700"
        textAnchor="middle"
        x="0"
        y="-20"
      >
        N
      </text>
      {degrees === null ? (
        <circle
          cx="0"
          cy="0"
          fill="none"
          r="13"
          stroke="currentColor"
          strokeDasharray="4 4"
          strokeWidth="3"
        />
      ) : (
        <path
          d="M0 -30 L7 26 L0 17 L-7 26 Z"
          fill="currentColor"
          transform={`rotate(${degrees + 180})`}
        />
      )}
    </svg>
  )
}
