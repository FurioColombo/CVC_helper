/** The Evaluations tab's control: labels wrap inside their pill at large text. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      aria-label={label}
      className="flex min-w-0 flex-wrap gap-1 rounded-xl bg-muted p-1"
      role="group"
    >
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          className="min-h-11 min-w-0 flex-[1_1_auto] rounded-lg px-2 text-sm font-black break-words outline-none focus-visible:ring-3 focus-visible:ring-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
