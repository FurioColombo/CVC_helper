import { useState } from "react"

import type { BoatType } from "@/domain/config"
import { assetPath } from "@/lib/assetPath"

/**
 * Manufacturer marks, used with the owner's authorisation of 2026-09-18. The
 * written model stays as the fallback: if an asset is missing or fails to
 * decode, the card still says which boat it is rather than showing a gap.
 *
 * Each file is trimmed to its own artwork rather than sharing one plate, so
 * `object-fit: contain` normalises the marks against each other instead of
 * against empty margins. A narrow mark such as J/80 would otherwise render at
 * a fraction of the size of a wide one such as RS Quest.
 */
const BOAT_LOGOS: Record<BoatType, string> = {
  "RS Toura": assetPath("/brand/boats/rs-toura.png"),
  "RS Quest": assetPath("/brand/boats/rs-quest.png"),
  "Laser Vago": assetPath("/brand/boats/laser-vago.png"),
  "RS 500": assetPath("/brand/boats/rs-500.png"),
  "J/80": assetPath("/brand/boats/j80.png"),
  "First 25.7": assetPath("/brand/boats/first-25-7.png"),
  "First 27": assetPath("/brand/boats/first-27.png"),
}

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
 * The owner's gommone mark for Mezzi (2026-09-28): a horizontal RIB, bow
 * right, with its console. Replaces the placeholder house-shaped icon
 * wherever the live app shows a Mezzi icon; `crewSummaryImage.ts` keeps its
 * own icon until the exported image is redone in the second half of F3.
 */
export function GommoneIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M7 6.5H15c3.7 0 6.3 2.3 7.5 5.5-1.2 3.2-3.8 5.5-7.5 5.5H7" />
      <path d="M7 9.5H15c2.2 0 3.7 1 4.5 2.5-.8 1.5-2.3 2.5-4.5 2.5H7" />
      <path d="M7 6.5a1.5 1.5 0 0 0 0 3" />
      <path d="M7 14.5a1.5 1.5 0 0 0 0 3" />
      <path d="M9.5 9.5v5" />
      <path d="M9.5 12H3.9" />
      <path
        d="M2.6 12c-.7-.45-1-.9-1-1.4a1 1 0 0 1 2 0c0 .5-.3.95-1 1.4s-1 .9-1 1.4a1 1 0 0 0 2 0c0-.5-.3-.95-1-1.4z"
        strokeWidth={1.75}
      />
      <rect height="2.4" rx=".6" width="2.6" x="12" y="10.8" />
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
