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
 * Three faces, drawn rather than borrowed: the icon set has no gendered heads,
 * and the Mars and Venus symbols that stood here first read as symbols rather
 * than as people. Uomo and Donna are filled, because at 18px a 2px outline
 * loses the hair that tells them apart; Altro keeps the outline figure, so the
 * three differ in silhouette and in weight and not only in a hairstyle.
 *
 * The same 24px grid, head and shoulders as the set's own figures, so they sit
 * beside them without looking imported.
 */
const SHOULDERS = "M4.8 22.4a7.2 7.2 0 0 1 14.4 0z"

function FaceMan(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="8.8" r="4.2" />
      <path d={SHOULDERS} />
    </svg>
  )
}

function FaceWoman(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
      {/* The hair is half again as wide as the head and ends below the jaw.
          At 18px that width is the whole difference between the two faces:
          anything drawn inside the head is lost at this size. */}
      <path d="M5.2 9.4C5.2 4.8 8.2 1.8 12 1.8s6.8 3 6.8 7.6v5.2h-3.1V9.2a3.7 3.7 0 0 0-7.4 0v5.4H5.2z" />
      <circle cx="12" cy="9.2" r="3.8" />
      <path d={SHOULDERS} />
    </svg>
  )
}

function FaceNeutral(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" {...props}>
      {/* Altro keeps the outline figure the set already used: a third weight
          reads at a glance where a third hairstyle would not. */}
      <circle cx="12" cy="8.6" r="4.4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M4.8 20.6a7.2 7.2 0 0 1 14.4 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
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
  return <Icon aria-hidden="true" className={className} />
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
