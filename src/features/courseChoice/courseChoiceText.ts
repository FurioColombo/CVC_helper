import type { CourseChoice } from "@/persistence/courseChoice"

type Named = Pick<
  CourseChoice,
  "id" | "family" | "level" | "isoWeek" | "students" | "lastChange"
>

const codeOf = ({ family, level, isoWeek }: Named) =>
  `${family === "Deriva" ? "D" : "C"}${level} - ${isoWeek}`

const sameDay = (first: Date, second: Date) =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate()

/** "oggi, 14:20", "ieri, 18:42", else "3 nov 2026, 9:05". */
export function formatLastChange(
  iso: string | null,
  now: Date = new Date(),
): string {
  const when = iso ? new Date(iso) : null
  if (!when || Number.isNaN(when.getTime())) return "non disponibile"
  const time = `${when.getHours()}:${String(when.getMinutes()).padStart(2, "0")}`
  if (sameDay(when, now)) return `oggi, ${time}`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(when, yesterday)) return `ieri, ${time}`
  const date = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(when)
  return `${date}, ${time}`
}

/**
 * The course's code. Two courses can share one, and an irreversible question
 * must tell them apart, so among `all` a repeated code adds its students and
 * last change (mock, state 2).
 */
export function namesOf(course: Named, all: Named[] = []): string {
  const code = codeOf(course)
  const repeated = all.some(
    (other) => other.id !== course.id && codeOf(other) === code,
  )
  return repeated
    ? `${code} (${course.students} allievi, ${formatLastChange(course.lastChange)})`
    : code
}

export function joinNames(names: string[]) {
  if (names.length < 2) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`
}
