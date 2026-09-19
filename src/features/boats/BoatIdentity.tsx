import { useState } from "react"

import type { BoatType } from "@/domain/config"

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
const BOAT_LOGOS: Record<BoatType, string | null> = {
  "RS Toura": "/brand/boats/rs-toura.png",
  "RS Quest": "/brand/boats/rs-quest.png",
  "Laser Vago": "/brand/boats/laser-vago.png",
  "RS 500": "/brand/boats/rs-500.png",
  "J/80": "/brand/boats/j80.png",
  "First 25.7": "/brand/boats/first-25-7.png",
  // The supplied First 27 artwork reads "27.7", which is the First 27.7 — a
  // different boat. Naming the wrong model on a card is worse than naming no
  // model, so this one falls back to the written mark until the right asset
  // arrives. `public/brand/boats/first-27.png` is kept for that comparison.
  "First 27": null,
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
  const logo = BOAT_LOGOS[type]
  // The slot is sized in pixels rather than rem: at 200% text the number and
  // the state label must grow, but the mark is decoration and would otherwise
  // double and crowd out the number the operator is looking for.
  return (
    <span
      aria-label={`Modello ${type}`}
      className={`grid h-[36px] w-[88px] shrink-0 content-center justify-items-start text-left text-[0.65rem] font-black leading-[1.05] tracking-wide text-foreground uppercase ${muted ? "opacity-55 grayscale" : ""}`}
    >
      {!logo || logoUnavailable ? (
        BOAT_MARKS[type]
          .split("\n")
          .map((line) => <span key={line}>{line}</span>)
      ) : (
        <img
          alt=""
          className="h-full w-full object-contain object-left"
          onError={() => setLogoUnavailable(true)}
          src={logo}
        />
      )}
    </span>
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
      className={`flex min-w-0 items-center gap-3.5 ${className}`}
    >
      <BoatModelMark muted={muted} type={type} />
      <span className="shrink-0 text-2xl font-black tabular-nums tracking-tight">
        {number}
      </span>
    </span>
  )
}
