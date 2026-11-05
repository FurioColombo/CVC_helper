import { TriangleAlert } from "lucide-react"

import { compassPoint } from "@/domain/wind"

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
    <g
      fill="var(--foreground)"
      transform={`translate(${x} ${y}) rotate(${degrees + 180}) scale(${size / 24})`}
    >
      <title>{`Da ${compassPoint(degrees)}`}</title>
      <path d="M0 -12 L6 11 L0 6 L-6 11 Z" />
    </g>
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
  if (degrees === null) {
    return (
      <span
        aria-label="Direzione variabile"
        className={className}
        role="img"
        style={{ fontSize: size * 0.6, fontWeight: 800 }}
      >
        VAR
      </span>
    )
  }
  return (
    <svg
      aria-label={`Vento da ${compassPoint(degrees)}`}
      className={className}
      height={size}
      role="img"
      viewBox="-12 -12 24 24"
      width={size}
    >
      <path
        d="M0 -12 L6 11 L0 6 L-6 11 Z"
        fill="currentColor"
        transform={`rotate(${degrees + 180})`}
      />
    </svg>
  )
}

export function UncertainMark({ className }: { className?: string }) {
  return (
    <TriangleAlert
      aria-label="Modelli divisi"
      className={className}
      role="img"
    />
  )
}
