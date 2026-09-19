import { useState } from "react"

import type { BoatType } from "@/domain/config"

/**
 * Manufacturer marks, used with the owner's authorisation of 2026-09-18. The
 * written model stays as the fallback: if an asset is missing or fails to
 * decode, the card still says which boat it is rather than showing a gap.
 */
const BOAT_LOGOS: Record<BoatType, string> = {
  "RS Toura": "/brand/boats/rs-toura.png",
  "RS Quest": "/brand/boats/rs-quest.png",
  "Laser Vago": "/brand/boats/laser-vago.png",
  "RS 500": "/brand/boats/rs-500.png",
  "J/80": "/brand/boats/j80.png",
  "First 25.7": "/brand/boats/first-25-7.png",
  "First 27": "/brand/boats/first-27.png",
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

export function BoatModelMark({ type }: { type: BoatType }) {
  const [logoUnavailable, setLogoUnavailable] = useState(false)
  return (
    <span
      aria-label={`Modello ${type}`}
      className="grid h-11 w-[4.25rem] shrink-0 place-items-center rounded-xl border border-border/80 bg-muted/60 px-1 text-center text-[0.65rem] font-black leading-[1.05] tracking-wide text-foreground uppercase"
    >
      {logoUnavailable ? (
        BOAT_MARKS[type]
          .split("\n")
          .map((line) => <span key={line}>{line}</span>)
      ) : (
        <img
          alt=""
          className="max-h-8 max-w-full object-contain"
          onError={() => setLogoUnavailable(true)}
          src={BOAT_LOGOS[type]}
        />
      )}
    </span>
  )
}

export function BoatIdentity({
  type,
  number,
  className = "",
}: {
  type: BoatType
  number: string
  className?: string
}) {
  return (
    <span
      aria-label={`${type} ${number}`}
      className={`flex min-w-0 items-center gap-2 ${className}`}
    >
      <BoatModelMark type={type} />
      <span className="shrink-0 text-xl font-black tabular-nums tracking-tight">
        {number}
      </span>
    </span>
  )
}
