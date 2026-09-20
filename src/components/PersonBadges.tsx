import { Mars, UserRound, Venus, type LucideProps } from "lucide-react"

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

const SEX_ICONS = { male: Mars, female: Venus, other: UserRound } as const

/**
 * Sex as a symbol rather than a letter: a text `M` beside the red minor `M`
 * and the size `M` was three different meanings for one glyph. A missing value
 * reads as `Altro`, the neutral figure.
 */
export function SexIcon({
  sex,
  ...props
}: { sex: StudentSex | null } & LucideProps) {
  const Icon = SEX_ICONS[sex ?? "other"]
  return <Icon aria-hidden="true" {...props} />
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
