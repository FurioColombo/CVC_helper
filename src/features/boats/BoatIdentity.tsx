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
