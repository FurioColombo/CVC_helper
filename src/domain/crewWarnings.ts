import {
  SESSION_SEQUENCE,
  SIZE_WARNING_MATRIX,
  type CrewWarningSeverity,
  type SessionId,
  type StudentSize,
} from "@/domain/config"

export interface CrewHistoryEntry {
  crewId: string
  sessionId: SessionId
  studentIds: string[]
}

export type CrewWarning =
  | {
      key: string
      kind: "size"
      severity: Exclude<CrewWarningSeverity, "none">
      studentIds: [string, string]
      sizes: [StudentSize, StudentSize]
    }
  | {
      key: string
      kind: "pair-recent" | "pair-older"
      severity: "red" | "yellow"
      studentIds: [string, string]
      previousCount: number
      lastSessionId: SessionId
    }
  | {
      key: string
      kind: "group-repeat"
      severity: "red"
      studentIds: string[]
      previousCount: number
      lastSessionId: SessionId
    }

const sessionIndex = new Map(
  SESSION_SEQUENCE.map(({ id }, index) => [id, index]),
)

function sortedIds(ids: string[]) {
  return [...ids].sort((left, right) => left.localeCompare(right))
}

function pairKey(left: string, right: string) {
  return sortedIds([left, right]).join(":")
}

function pairs(studentIds: string[]) {
  const result: Array<[string, string]> = []
  for (let left = 0; left < studentIds.length; left += 1) {
    for (let right = left + 1; right < studentIds.length; right += 1) {
      result.push([studentIds[left]!, studentIds[right]!])
    }
  }
  return result
}

function matchingHistory(
  currentSessionId: SessionId,
  history: CrewHistoryEntry[],
  predicate: (entry: CrewHistoryEntry) => boolean,
) {
  const currentIndex = sessionIndex.get(currentSessionId)!
  return history
    .filter((entry) => {
      const index = sessionIndex.get(entry.sessionId)
      return index !== undefined && index < currentIndex && predicate(entry)
    })
    .sort(
      (left, right) =>
        sessionIndex.get(right.sessionId)! - sessionIndex.get(left.sessionId)!,
    )
}

export function getTwoPersonSizeWarning(
  studentIds: [string, string],
  sizesByStudentId: ReadonlyMap<string, StudentSize | null>,
): CrewWarning | null {
  const left = sizesByStudentId.get(studentIds[0])
  const right = sizesByStudentId.get(studentIds[1])
  if (!left || !right) return null
  const severity = SIZE_WARNING_MATRIX[left][right]
  if (severity === "none") return null
  return {
    key: `size:${pairKey(...studentIds)}`,
    kind: "size",
    severity,
    studentIds,
    sizes: [left, right],
  }
}

export function getCrewWarnings(
  currentCrew: CrewHistoryEntry,
  history: CrewHistoryEntry[],
  sizesByStudentId: ReadonlyMap<string, StudentSize | null>,
) {
  const warnings: CrewWarning[] = []
  const studentIds = sortedIds(currentCrew.studentIds)

  if (studentIds.length === 2) {
    const sizeWarning = getTwoPersonSizeWarning(
      [studentIds[0]!, studentIds[1]!],
      sizesByStudentId,
    )
    if (sizeWarning) warnings.push(sizeWarning)
  }

  if (studentIds.length >= 3) {
    const exactMatches = matchingHistory(
      currentCrew.sessionId,
      history,
      (entry) => {
        const previous = sortedIds(entry.studentIds)
        return (
          previous.length === studentIds.length &&
          previous.every((id, index) => id === studentIds[index])
        )
      },
    )
    if (exactMatches.length > 0) {
      warnings.push({
        key: `group:${studentIds.join(":")}`,
        kind: "group-repeat",
        severity: "red",
        studentIds,
        previousCount: exactMatches.length,
        lastSessionId: exactMatches[0]!.sessionId,
      })
    }
  }

  for (const pair of pairs(studentIds)) {
    const previous = matchingHistory(currentCrew.sessionId, history, (entry) =>
      pair.every((studentId) => entry.studentIds.includes(studentId)),
    )
    if (previous.length === 0) continue
    const currentIndex = sessionIndex.get(currentCrew.sessionId)!
    const lastIndex = sessionIndex.get(previous[0]!.sessionId)!
    const recent = currentIndex - lastIndex <= 3
    warnings.push({
      key: `pair:${pairKey(...pair)}`,
      kind: recent ? "pair-recent" : "pair-older",
      severity: recent ? "red" : "yellow",
      studentIds: pair,
      previousCount: previous.length,
      lastSessionId: previous[0]!.sessionId,
    })
  }

  return warnings
}

export function getWorstCrewWarningSeverity(warnings: CrewWarning[]) {
  if (warnings.some(({ severity }) => severity === "red")) return "red"
  if (warnings.some(({ severity }) => severity === "yellow")) return "yellow"
  return null
}
