import {
  BOAT_TYPES,
  BOAT_TYPE_CLASS_COLORS,
  MEZZI_CLASS_COLOR,
  type BoatType,
  type CrewDestination,
  type VolunteerRole,
} from "@/domain/config"
import { estimateTextWidth } from "@/lib/summaryImage"

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

/** Neutral grey for a crew that has no boat model to take a colour from. */
const NO_MODEL_COLOR = "#6b8790"

export type CrewSummaryCrewLine = {
  crewId: string
  crewNumber: number
  destination: CrewDestination
  /** Only the fields the model needs from a boat record — never the full
   *  persisted `BoatRecord`, so this module stays independent of persistence
   *  types and the exporter never has to import them. `type` is a plain
   *  string on purpose: a model outside `BOAT_TYPES` must still reach the
   *  summary (see `groupOccupiedCrewLines`). */
  boat: { type: string; number: string } | null
  /** The one model every boat selected for the session shares, for a crew
   *  that has no boat yet: the "modello senza numero" state of the spec
   *  (§7.5). The crew is then listed under that model, marked "Senza barca". */
  inferredBoatType?: string | null
  members: CrewSummaryMember[]
  warning: CrewSummaryWarning
}

/**
 * Occupied crews group by boat model under the class logo, in canonical
 * `BOAT_TYPES` order; a model outside that list is never dropped but gets its
 * own trailing group named by the model; a crew with people, no boat and no
 * single inferred model falls back to its own "Equipaggi senza barca" group
 * so it still reads as an occupied outing; Mezzi is always last. Empty crews
 * are never a group here — they join unused boats in the caller's own
 * "empty" list instead.
 */
export type CrewSummaryGroup =
  | { kind: "boat"; boatType: BoatType; lines: CrewSummaryCrewLine[] }
  | { kind: "other-model"; modelName: string; lines: CrewSummaryCrewLine[] }
  | { kind: "unassigned"; lines: CrewSummaryCrewLine[] }
  | { kind: "mezzi"; lines: CrewSummaryCrewLine[] }

/** The boat model a line belongs under: its own boat's, or the session's one
 *  inferred model when it has no boat yet; none for Mezzi or no model at all. */
function crewLineModel(line: CrewSummaryCrewLine): string | null {
  if (line.destination === "mezzi") return null
  const model =
    line.destination === "boat" && line.boat
      ? line.boat.type
      : line.inferredBoatType
  return model || null
}

/** The model name of a crew shown under its model with no boat chosen yet
 *  ("<model> · Senza barca"), or null for any other crew. */
export function modelOnlyName(line: CrewSummaryCrewLine): string | null {
  return line.destination !== "mezzi" &&
    !(line.destination === "boat" && line.boat)
    ? crewLineModel(line)
    : null
}

/** What a card says it is to a screen reader (and on the image's own `<g>`):
 *  "<model> <number>", "Mezzi", "<model> · Senza barca" or "senza barca". */
export function crewCardLabel(line: CrewSummaryCrewLine): string {
  if (line.boat) return `${line.boat.type} ${line.boat.number}`
  if (line.destination === "mezzi") return "Mezzi"
  const model = modelOnlyName(line)
  return model ? `${model} · Senza barca` : "senza barca"
}

/** The class colour a card's own group uses, straight from the line. */
export function crewLineClassColor(line: CrewSummaryCrewLine): string {
  if (line.destination === "mezzi") return MEZZI_CLASS_COLOR
  const model = crewLineModel(line)
  if (!model) return NO_MODEL_COLOR
  return (
    (BOAT_TYPE_CLASS_COLORS as Record<string, string | undefined>)[model] ??
    NO_MODEL_COLOR
  )
}

/**
 * The same column for the read view, in `ch` of the number's own font: with
 * tabular numerals every digit is exactly one `ch` wide in whatever font the
 * phone uses, so a 4-digit number needs 4ch on any system — an `em` estimate
 * held on Windows but wrapped "1234" under Linux's wider DejaVu Sans. Letters
 * vary by font and get a margin.
 */
export function groupNumberWidthCh(
  lines: readonly CrewSummaryCrewLine[],
): number {
  return Math.max(
    0,
    ...lines.map((line) =>
      line.boat
        ? Array.from(line.boat.number).reduce(
            (width, char) => width + (/\d/.test(char) ? 1 : 1.4),
            0,
          )
        : 0,
    ),
  )
}

/**
 * How wide the boat-number column of a group's cards must be, in em of the
 * number's own font size: the widest number in the group (a 3- or 4-character
 * number, or one with a letter, is wider than the two digits the column was
 * first drawn for). Every card of the group gets the same column, so the
 * names still line up within it. Used by the image, whose font size is fixed.
 */
export function groupNumberWidthEm(
  lines: readonly CrewSummaryCrewLine[],
): number {
  return Math.max(
    0,
    ...lines.map((line) =>
      line.boat ? estimateTextWidth(line.boat.number, 1) : 0,
    ),
  )
}

export function groupOccupiedCrewLines(
  lines: readonly CrewSummaryCrewLine[],
): CrewSummaryGroup[] {
  const occupied = lines.filter((line) => line.members.length > 0)
  const groups: CrewSummaryGroup[] = []
  const canonical = new Set<string>(BOAT_TYPES)
  for (const boatType of BOAT_TYPES) {
    const boatLines = occupied.filter(
      (line) => crewLineModel(line) === boatType,
    )
    if (boatLines.length > 0)
      groups.push({ kind: "boat", boatType, lines: boatLines })
  }
  // A model the canonical list does not know (a record from a newer or
  // damaged course) still sails: one trailing group per such model, in the
  // order first met, rather than silently losing its crews from the summary.
  const otherModels = new Set<string>()
  for (const line of occupied) {
    const model = crewLineModel(line)
    if (model && !canonical.has(model)) otherModels.add(model)
  }
  for (const modelName of otherModels) {
    groups.push({
      kind: "other-model",
      modelName,
      lines: occupied.filter((line) => crewLineModel(line) === modelName),
    })
  }
  const unassignedLines = occupied.filter(
    (line) => line.destination !== "mezzi" && crewLineModel(line) === null,
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
 * True when no student is left available — volunteers may still be, and
 * never count — so the summary closes with its small "Tutti gli allievi
 * assegnati" note instead of opening with a list of people to place. Only a
 * volunteer carries a `role`.
 */
export function allStudentsAssigned(model: CrewSummarySections): boolean {
  return !model.availableMembers.some((member) => !member.role)
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
