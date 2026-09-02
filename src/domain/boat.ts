import {
  COURSE_CONFIG,
  type BoatAvailability,
  type BoatType,
  type CourseFamily,
  type CourseLevel,
  type FaultState,
} from "@/domain/config"

export type BoatOperationalState = "clear" | "fault" | "unavailable"

export function getDefaultBoatType(
  family: CourseFamily,
  level: CourseLevel,
): BoatType | null {
  const code = `${family === "Deriva" ? "D" : "C"}${level}`
  return code in COURSE_CONFIG
    ? COURSE_CONFIG[code as keyof typeof COURSE_CONFIG].defaultBoatType
    : null
}

export function parseBoatNumbers(value: string) {
  const seen = new Set<string>()
  return value
    .split(/[,;\n]/)
    .map((number) => number.trim())
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
