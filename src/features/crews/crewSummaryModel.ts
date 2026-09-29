import {
  BOAT_TYPES,
  BOAT_TYPE_CLASS_COLORS,
  MEZZI_CLASS_COLOR,
  type BoatType,
  type CrewDestination,
  type VolunteerRole,
} from "@/domain/config"

/**
 * The one crew-summary data model, shared by the on-screen F3 C6 read view
 * (`AnnouncementView` in `CrewManagement.tsx`) and the exported PNG
 * (`crewSummaryImage.ts`). Both used to compute their own grouping from
 * scratch; a mismatch there would show the operator one order on screen and a
 * different one in the image they hand out. `buildCrewSummarySections` is the
 * single place that turns a flat crew-plan-derived line list into the grouped
 * shape both renderers read.
 */

export type CrewSummaryMember = {
  label: string
  isMinor: boolean
  duty: "current" | "smontante" | null
  role?: VolunteerRole | null
}

export type CrewSummaryWarning = {
  severity: "red" | "yellow"
  count: number
} | null

export type CrewSummaryCrewLine = {
  crewId: string
  crewNumber: number
  destination: CrewDestination
  /** Only the fields the model needs from a boat record — never the full
   *  persisted `BoatRecord`, so this module stays independent of persistence
   *  types and the exporter never has to import them. */
  boat: { type: BoatType; number: string } | null
  members: CrewSummaryMember[]
  warning: CrewSummaryWarning
}

/**
 * Occupied crews group by boat model under the class logo, in canonical
 * `BOAT_TYPES` order; a crew with people but no boat yet falls back to its
 * own "Equipaggi senza barca" group so it still reads as an occupied outing;
 * Mezzi is always last. Empty crews are never a group here — they join
 * unused boats in the caller's own "empty" list instead.
 */
export type CrewSummaryGroup =
  | { kind: "boat"; boatType: BoatType; lines: CrewSummaryCrewLine[] }
  | { kind: "unassigned"; lines: CrewSummaryCrewLine[] }
  | { kind: "mezzi"; lines: CrewSummaryCrewLine[] }

/** The class colour a card's own group uses, straight from the line. */
export function crewLineClassColor(line: CrewSummaryCrewLine): string {
  if (line.destination === "mezzi") return MEZZI_CLASS_COLOR
  if (line.boat) return BOAT_TYPE_CLASS_COLORS[line.boat.type]
  return "#6b8790"
}

export function groupOccupiedCrewLines(
  lines: readonly CrewSummaryCrewLine[],
): CrewSummaryGroup[] {
  const occupied = lines.filter((line) => line.members.length > 0)
  const groups: CrewSummaryGroup[] = []
  for (const boatType of BOAT_TYPES) {
    const boatLines = occupied.filter(
      (line) => line.destination === "boat" && line.boat?.type === boatType,
    )
    if (boatLines.length > 0)
      groups.push({ kind: "boat", boatType, lines: boatLines })
  }
  const unassignedLines = occupied.filter(
    (line) =>
      line.destination !== "mezzi" &&
      !(line.destination === "boat" && line.boat),
  )
  if (unassignedLines.length > 0) {
    groups.push({ kind: "unassigned", lines: unassignedLines })
  }
  const mezziLines = occupied.filter((line) => line.destination === "mezzi")
  if (mezziLines.length > 0) groups.push({ kind: "mezzi", lines: mezziLines })
  return groups
}

export type CrewSummarySections = {
  title: string
  groups: CrewSummaryGroup[]
  availableMembers: CrewSummaryMember[]
  landMembers: CrewSummaryMember[]
  emptyLabels: string[]
}

/**
 * The single entry point both renderers call: the read view builds its DOM
 * from the same `CrewSummarySections` the exporter rasterises, so a group
 * order or membership fix here reaches both at once.
 */
export function buildCrewSummarySections(input: {
  title: string
  lines: readonly CrewSummaryCrewLine[]
  availableMembers: CrewSummaryMember[]
  landMembers: CrewSummaryMember[]
  emptyLabels: string[]
}): CrewSummarySections {
  return {
    title: input.title,
    groups: groupOccupiedCrewLines(input.lines),
    availableMembers: input.availableMembers,
    landMembers: input.landMembers,
    emptyLabels: input.emptyLabels,
  }
}
