import { STUDENT_SIZES, type StudentSize } from "@/domain/config"
import { cn } from "@/lib/utils"

export function StudentSizeSelector({
  value,
  onChange,
  label = "Taglia",
  ariaLabel,
  hideLabel = false,
  className,
}: {
  value: StudentSize | ""
  onChange: (value: StudentSize | "") => void
  label?: string
  ariaLabel?: string
  hideLabel?: boolean
  className?: string
}) {
  const controlLabel = ariaLabel ?? label

  return (
    <fieldset className={cn("grid gap-2 text-sm font-bold", className)}>
      <legend className={hideLabel ? "sr-only" : undefined}>{label}</legend>
      <div
        aria-label={controlLabel}
        className="grid grid-cols-5 gap-1.5"
        role="group"
      >
        {STUDENT_SIZES.map((option) => (
          <button
            aria-label={option}
            aria-pressed={value === option}
            className="grid h-10 min-w-0 place-items-center rounded-xl border bg-card px-0 text-sm font-bold outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            key={option}
            onClick={() => onChange(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
