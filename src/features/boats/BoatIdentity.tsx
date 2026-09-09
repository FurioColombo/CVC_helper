import type { BoatType } from "@/domain/config"

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
  return (
    <span
      aria-label={`Modello ${type}`}
      className="grid h-11 w-[4.25rem] shrink-0 place-items-center rounded-xl border border-border/80 bg-muted/60 px-1 text-center text-[0.65rem] font-black leading-[1.05] tracking-wide text-foreground uppercase"
    >
      {BOAT_MARKS[type].split("\n").map((line) => (
        <span key={line}>{line}</span>
      ))}
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
