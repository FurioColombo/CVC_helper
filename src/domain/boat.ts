import {
  COURSE_CONFIG,
  type BoatAvailability,
  type BoatType,
  type CourseCode,
  type CourseFamily,
  type CourseLevel,
  type FaultState,
} from "./config"

export type BoatOperationalState = "clear" | "fault" | "unavailable"

export function normalizeBoatNumber(value: string) {
  const normalized = value.normalize("NFKC").trim()
  return /^\d+$/.test(normalized)
    ? normalized.replace(/^0+(?=\d)/, "")
    : normalized
}

export function getBoatIdentityKey(type: string, number: string) {
  return `${type}:${normalizeBoatNumber(number).toLocaleLowerCase("it-IT")}`
}

export function getDefaultBoatType(
  family: CourseFamily,
  level: CourseLevel,
): BoatType | null {
  const code = `${family === "Deriva" ? "D" : "C"}${level}`
  return code in COURSE_CONFIG
    ? COURSE_CONFIG[code as CourseCode].defaultBoatType
    : null
}

export function parseBoatNumbers(value: string) {
  const seen = new Set<string>()
  return value
    .split(/[,;\s]+/u)
    .map(normalizeBoatNumber)
    .filter((number) => {
      const key = number.toLocaleLowerCase("it-IT")
      if (!number || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function hasUnresolvedFaults(
  faults: ReadonlyArray<{ state: FaultState }>,
) {
  return faults.some(({ state }) => state !== "resolved")
}

export function getBoatOperationalState(
  availability: BoatAvailability,
  faults: ReadonlyArray<{ state: FaultState }>,
): BoatOperationalState {
  if (availability === "unavailable") return "unavailable"
  return hasUnresolvedFaults(faults) ? "fault" : "clear"
}
