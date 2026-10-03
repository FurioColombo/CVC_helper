import { DUTY_DAYS, type DutyDayId } from "@/domain/config"

/**
 * The Comandate-summary data model behind the F3 read view
 * (`DutySummaryView` in `DutyManagement.tsx`) — the Comandate counterpart of
 * `crewSummaryModel.ts`; the saved image (F4) is a screenshot of that view.
 * `buildDutySummarySections` is the single place that turns the seven
 * (possibly unordered, possibly partial) day lines into the canonical,
 * member-sorted shape the view reads.
 */

export type DutySummaryMember = {
  label: string
  isMinor: boolean
}

export type DutySummaryWarning = {
  severity: "red" | "yellow"
  count: number
} | null

/** What the caller (`DutyManagement.tsx`) knows about one duty day before it
 *  is placed into canonical order. */
export type DutySummaryDayLine = {
  dayId: DutyDayId
  members: DutySummaryMember[]
  completed: boolean
  warning: DutySummaryWarning
}

export type DutySummaryDay = {
  dayId: DutyDayId
  /** Full day name ("Sabato"), for accessible names. */
  label: string
  /** The card's own short label ("Sab"), the same abbreviation
   *  `01_PRODUCT_SPEC.md` §6.4 already uses on the P13 day editor. */
  shortLabel: string
  members: DutySummaryMember[]
  completed: boolean
  warning: DutySummaryWarning
}

export type DutySummarySections = {
  title: string
  days: DutySummaryDay[]
}

function compareMemberLabels(left: string, right: string) {
  return left.localeCompare(right, "it-IT", { sensitivity: "base" })
}

/**
 * `DutyWarning`'s own "major"/"advisory" severity, aggregated to the read
 * view's red/yellow corner badge: a major warning anywhere on the day wins
 * over an advisory one, matching the worst-severity rule
 * `crewWarnings.ts`'s `getWorstCrewWarningSeverity` already uses for a crew
 * card. `null` when the day has nothing to show. Exported so
 * `DutyManagement.tsx` builds each day's `warning` field with the exact same
 * rule the read view and the image agree on.
 */
export function dutySummaryWarning(
  warnings: readonly { severity: "major" | "advisory" }[],
): DutySummaryWarning {
  if (warnings.length === 0) return null
  const severity = warnings.some((warning) => warning.severity === "major")
    ? "red"
    : "yellow"
  return { severity, count: warnings.length }
}

/**
 * The single entry point both renderers call: the read view builds its DOM
 * from the same `DutySummarySections` the exporter rasterises. A day the
 * caller did not supply a line for (should not normally happen — the caller
 * always has all seven) still appears, empty and not completed, so the
 * summary always shows the whole week per `01_PRODUCT_SPEC.md` §6.1 ("main
 * view shows all seven groups").
 */
export function buildDutySummarySections(input: {
  title: string
  lines: readonly DutySummaryDayLine[]
}): DutySummarySections {
  const byDay = new Map(input.lines.map((line) => [line.dayId, line]))
  const days = DUTY_DAYS.map(({ id, label, short }) => {
    const line = byDay.get(id)
    return {
      dayId: id,
      label,
      shortLabel: short,
      members: [...(line?.members ?? [])].sort((left, right) =>
        compareMemberLabels(left.label, right.label),
      ),
      completed: line?.completed ?? false,
      warning: line?.warning ?? null,
    }
  })
  return { title: input.title, days }
}
