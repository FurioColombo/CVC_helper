import { useState } from "react"

import type { BoatType } from "@/domain/config"
import {
  BOAT_LOGOS,
  GOMMONE_HULL_PATHS,
  GOMMONE_PROPELLER_PATH,
  GOMMONE_PROPELLER_STROKE_WIDTH,
  GOMMONE_STROKE_WIDTH,
  GOMMONE_VIEW_BOX,
  gommoneTransform,
} from "@/features/boats/boatMarks"

// The manufacturer marks and the gommone path data live in `boatMarks.ts`
// (used with the owner's authorisation of 2026-09-18 for the marks, and the
// owner's final gommone mark of 2026-09-28 for the icon), not in this
// component file: this project's Fast Refresh lint rule only allows a
// component file to export components.

const BOAT_MARKS: Record<BoatType, string> = {
  "RS Toura": "RS\nTOURA",
  "RS Quest": "RS\nQUEST",
  "Laser Vago": "LASER\nVAGO",
  "RS 500": "RS\n500",
  "J/80": "J/80",
  "First 25.7": "FIRST\n25.7",
  "First 27": "FIRST\n27",
}

export function BoatModelMark({
  type,
  muted = false,
}: {
  type: BoatType
  muted?: boolean
}) {
  const [logoUnavailable, setLogoUnavailable] = useState(false)
  // The slot is sized in pixels rather than rem: at 200% text the number and
  // the state label must grow, but the mark is decoration and would otherwise
  // double and crowd out the number the operator is looking for.
  return (
    <span
      aria-label={`Modello ${type}`}
      className={`grid h-[36px] w-[88px] shrink-0 content-center justify-items-start text-left text-[0.65rem] font-black leading-[1.05] tracking-wide text-foreground uppercase ${muted ? "opacity-55 grayscale" : ""}`}
    >
      {logoUnavailable ? (
        BOAT_MARKS[type]
          .split("\n")
          .map((line) => <span key={line}>{line}</span>)
      ) : (
        // The size is repeated on the image rather than left to `h-full`:
        // `content-center` makes the grid row content-sized, so a percentage
        // height had nothing definite to resolve against and every mark fell
        // back to its intrinsic 60px. A wide mark was still capped by the
        // column's 88px and looked right, which is why RS Quest hid this,
        // while J/80, RS 500 and First 27 stood 60px tall in a 36px row.
        <img
          alt=""
          className="h-[36px] w-[88px] object-contain object-left"
          onError={() => setLogoUnavailable(true)}
          src={BOAT_LOGOS[type]}
        />
      )}
    </span>
  )
}

/**
 * Per-model heights for the F3 C6 crew-summary group header, tuned by eye so
 * every wordmark reads as equally prominent next to the others: Vago and RS
 * 500 sit tighter inside their own artwork than Toura or Quest, so sharing
 * one height would leave them looking smaller. Not derived from the asset
 * files, and independent of `BoatModelMark`'s fixed composition-view slot.
 */
const GROUP_HEADER_LOGO_HEIGHT: Record<BoatType, number> = {
  "RS Toura": 16,
  "RS Quest": 16,
  "Laser Vago": 20,
  "RS 500": 22,
  "J/80": 16,
  "First 25.7": 16,
  "First 27": 16,
}

/**
 * The boat-model logo alone, at its own aspect ratio, for a crew-summary
 * group heading (one logo per group rather than repeated per card). Falls
 * back to the written model name, same as `BoatModelMark`.
 */
export function BoatModelHeaderMark({
  type,
  className = "",
}: {
  type: BoatType
  className?: string
}) {
  const [logoUnavailable, setLogoUnavailable] = useState(false)
  if (logoUnavailable) {
    return (
      <span
        className={`text-xs font-black tracking-wide text-foreground uppercase ${className}`}
      >
        {type}
      </span>
    )
  }
  return (
    <img
      alt={type}
      className={className}
      onError={() => setLogoUnavailable(true)}
      src={BOAT_LOGOS[type]}
      style={{ height: GROUP_HEADER_LOGO_HEIGHT[type], width: "auto" }}
    />
  )
}

/**
 * The owner's gommone mark for Mezzi (2026-09-28, commit 629e09d): a RIB seen
 * from above, tubes as a double line whose tails run past the transom, a
 * softly pointed bow, and the propeller as an 8 between the tails, no shaft.
 * Drawn bow right; the owner wants it horizontal in a heading and vertical
 * (bow up) in a card. The path data lives in `boatMarks.ts`.
 */
export function GommoneIcon({
  className = "",
  orientation = "horizontal",
}: {
  className?: string
  orientation?: "horizontal" | "vertical"
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={GOMMONE_STROKE_WIDTH}
      viewBox={GOMMONE_VIEW_BOX}
    >
      <g transform={gommoneTransform(orientation)}>
        {GOMMONE_HULL_PATHS.map((d) => (
          <path d={d} key={d} />
        ))}
        <path
          d={GOMMONE_PROPELLER_PATH}
          strokeWidth={GOMMONE_PROPELLER_STROKE_WIDTH}
        />
      </g>
    </svg>
  )
}

export function BoatIdentity({
  type,
  number,
  muted = false,
  className = "",
}: {
  type: BoatType
  number: string
  muted?: boolean
  className?: string
}) {
  return (
    <span
      aria-label={`${type} ${number}`}
      className={`flex min-w-0 items-center gap-3 ${className}`}
    >
      {/* The number opens the row and holds its own column, so the marks stay
          aligned under one another whether the boat is 7 or 115. */}
      <span className="min-w-[3.25rem] shrink-0 text-2xl font-black tabular-nums tracking-tight">
        {number}
      </span>
      <BoatModelMark muted={muted} type={type} />
    </span>
  )
}
