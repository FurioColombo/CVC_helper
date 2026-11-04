import type { CourseChoice } from "@/persistence/courseChoice"

type Named = Pick<
  CourseChoice,
  | "id"
  | "family"
  | "level"
  | "isoWeek"
  | "year"
  | "students"
  | "crews"
  | "evaluations"
  | "lastChange"
>

const codeOf = ({
  family,
  level,
  isoWeek,
}: Pick<Named, "family" | "level" | "isoWeek">) =>
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

const studentsOf = ({ students }: Named) =>
  students === 1 ? "1 allievo" : `${students} allievi`
const crewsOf = ({ crews }: Named) =>
  crews === 1 ? "1 equipaggio" : `${crews} equipaggi`
const evaluationsOf = ({ evaluations }: Named) =>
  evaluations === 1 ? "1 valutazione" : `${evaluations} valutazioni`

/** What a course holds, said before it is given up (rulebook R11). */
export const contentsOf = (course: Named) =>
  `${studentsOf(course)}, ${crewsOf(course)}, ${evaluationsOf(course)}`

const twinsOf = (course: Named, all: Named[]) =>
  all.filter((other) => codeOf(other) === codeOf(course))

const differs = (twins: Named[], detail: (course: Named) => string) =>
  new Set(twins.map(detail)).size > 1

const yearOf = ({ year }: Named) => `${year}`
const lastChangeOf = ({ lastChange }: Named) => formatLastChange(lastChange)

/**
 * The last resort when a course reads like another in everything shown: the
 * same roster on two phones, saved in the same minute. Any one twin is enough,
 * whatever a third course holds (review FU-B7-2). Ids still differ, so the card
 * and the question can name the same one.
 */
export function twinTag(course: Named, all: Named[]) {
  const detail = (other: Named) =>
    [yearOf, studentsOf, crewsOf, evaluationsOf, lastChangeOf]
      .map((read) => read(other))
      .join()
  const alike = twinsOf(course, all).filter(
    (other) => other.id !== course.id && detail(other) === detail(course),
  )
  return alike.length > 0 ? `codice ${course.id.slice(0, 6)}` : null
}

/**
 * The course's code. Two courses can share one, and an irreversible question
 * must tell them apart, so among `all` a repeated code adds its students and
 * last change (mock, state 2), and whatever else differs between them.
 */
export function namesOf(course: Named, all: Named[] = []): string {
  const code = codeOf(course)
  const twins = twinsOf(course, all)
  if (twins.length < 2) return code
  const parts = [
    differs(twins, yearOf) && yearOf(course),
    studentsOf(course),
    differs(twins, crewsOf) && crewsOf(course),
    differs(twins, evaluationsOf) && evaluationsOf(course),
    lastChangeOf(course),
    twinTag(course, all),
  ].filter(Boolean)
  return `${code} (${parts.join(", ")})`
}

export function joinNames(names: string[]) {
  if (names.length < 2) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`
}
