import type { StudentSex, VolunteerRole } from "@/domain/config"
import { cn } from "@/lib/utils"

// One rendering per person marker, so a minor or a duty reads the same in
// Allievi, Comandate and Equipaggi (rulebook section 3). Each marker carries
// its meaning as an accessible name; the colour only reinforces the letter.

const MARKER =
  "inline-grid h-4 min-w-4 shrink-0 place-items-center rounded-[4px] px-[3px] text-[9px] leading-none font-black"

export function MinorBadge({ className }: { className?: string }) {
  return (
    <span
      aria-label="Minorenne"
      className={cn(MARKER, "bg-[#b42318] text-white", className)}
      role="img"
      title="Minorenne"
    >
      M
    </span>
  )
}

export type DutyMarker = "current" | "smontante"

export function DutyBadge({
  kind,
  className,
}: {
  kind: DutyMarker
  className?: string
}) {
  const label = kind === "current" ? "In comandata" : "Smontante"
  return (
    <span
      aria-label={label}
      className={cn(
        MARKER,
        kind === "current"
          ? "bg-primary text-primary-foreground"
          : "bg-card text-primary shadow-[inset_0_0_0_1.5px_var(--primary)]",
        className,
      )}
      role="img"
      title={label}
    >
      {kind === "current" ? "C" : "SM"}
    </span>
  )
}

/**
 * Three faces from Material Symbols — `face_6`, `face_3` and `face` —
 * © Google, Apache License 2.0 (https://github.com/google/material-design-icons).
 * The outlines are theirs; nothing is redrawn, and no dependency is added.
 *
 * The one change is ours: the two eyes are replaced by the same pair of
 * sunglasses on all three, so the only thing that differs between them is the
 * hair. Hand-drawn attempts at this failed twice — the Mars and Venus symbols
 * read as symbols rather than people, and silhouettes built from a circle and a
 * pair of shoulders could not carry a hairstyle at 18px without falling apart
 * when enlarged. A designed set solves both at once.
 *
 * Material's grid is `0 -960 960 960`, not the 24px one, and is kept as drawn.
 */
function Sunglasses({ eyeY }: { eyeY: number }) {
  return (
    <>
      <rect height="96" rx="44" width="172" x="286" y={eyeY - 48} />
      <rect height="96" rx="44" width="172" x="502" y={eyeY - 48} />
      <rect height="28" rx="14" width="84" x="438" y={eyeY - 20} />
    </>
  )
}

function MaterialFace({
  d,
  eyeY,
  className,
}: {
  d: string
  eyeY: number
  className?: string
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 -960 960 960"
    >
      <path d={d} />
      <Sunglasses eyeY={eyeY} />
    </svg>
  )
}

/** `face_6`: short hair with a fringe. */
function FaceMan({ className }: { className?: string }) {
  return (
    <MaterialFace
      className={className}
      d="M480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-156t86-127Q252-817 325-848.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 82-31.5 155T763-197.5q-54 54.5-127 86T480-80Zm0-80q134 0 227.5-94T800-482q-71-7-109-44.5T626-618q-5-11-14.5-16.5T591-640H370q-12 0-21.5 5.5T334-618q-27 55-66 92.5T160-481q0 134 93.5 227.5T480-160Z"
      eyeY={-440}
    />
  )
}

/** `face_3`: long hair falling either side of the face. */
function FaceWoman({ className }: { className?: string }) {
  return (
    <MaterialFace
      className={className}
      d="M480-240q134 0 227-93.5T800-560q0-31-5-59.5T779-675q-27 17-57 26t-62 9q-54 0-101.5-24.5T480-734q-31 45-78.5 69.5T300-640q-32 0-62-9t-57-26q-11 27-16 55.5t-5 59.5q0 133 93.5 226.5T480-240ZM88-80q-35 0-59-26T8-167l36-395q8-84 45.5-157t96-126.5q58.5-53.5 134-84T480-960q85 0 160.5 30.5t134 84Q833-792 870.5-719T916-562l36 395q3 35-21 61t-59 26H88Z"
      eyeY={-520}
    />
  )
}

/** `face`: no hair at all, which is what makes Altro the neutral one. */
function FaceNeutral({ className }: { className?: string }) {
  return (
    <MaterialFace
      className={className}
      d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"
      eyeY={-440}
    />
  )
}

const SEX_ICONS = {
  male: FaceMan,
  female: FaceWoman,
  other: FaceNeutral,
} as const

/**
 * Sex as a face rather than a letter: a text `M` beside the red minor `M` and
 * the size `M` was three different meanings for one glyph. A missing value
 * reads as `Altro`, the face with no hair.
 */
export function SexIcon({
  sex,
  className,
}: {
  sex: StudentSex | null
  className?: string
}) {
  const Icon = SEX_ICONS[sex ?? "other"]
  return <Icon className={className} />
}

export function VolunteerRoleBadge({
  role,
  className,
}: {
  role: VolunteerRole
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-xl bg-[#fff1d6] font-black tracking-wide text-[#8a5200]",
        className,
      )}
    >
      {role}
    </span>
  )
}
