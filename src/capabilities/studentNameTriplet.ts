export type StudentNameTripletOrder = "given-surname" | "surname-given"

export interface StudentNamePartition {
  firstName: string
  surname: string
}

export type StudentNameTripletReason =
  | "surname-particle"
  | "two-given-names"
  | "conflicting-evidence"
  | "insufficient-evidence"

export interface StudentNameTripletResult {
  /** The complete OCR reading, retained even when the split needs review. */
  raw: string
  /** The original tokens, in OCR order and with their spelling unchanged. */
  words: readonly [string, string, string]
  order: StudentNameTripletOrder
  /** A suggested partition. Check `ambiguity` before treating it as settled. */
  candidate: StudentNamePartition
  /** The other possible one-boundary partition when the result is ambiguous. */
  alternatives: StudentNamePartition[]
  ambiguity: boolean
  reason: StudentNameTripletReason
}

function normalizeToken(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("it")
    .replace(/[’]/g, "'")
    .trim()
}

function isSurnameParticle(value: string, particles: Set<string>) {
  return particles.has(normalizeToken(value))
}

function hasGivenNameEvidence(
  value: string,
  knownGivenNames: Set<string>,
  particles: Set<string>,
) {
  const normalized = normalizeToken(value)
  return (
    normalized.length > 0 &&
    !particles.has(normalized) &&
    knownGivenNames.has(normalized)
  )
}

function partitionAt(
  words: readonly [string, string, string],
  order: StudentNameTripletOrder,
  boundary: 1 | 2,
): StudentNamePartition {
  const before = words.slice(0, boundary).join(" ")
  const after = words.slice(boundary).join(" ")

  return order === "given-surname"
    ? { firstName: before, surname: after }
    : { firstName: after, surname: before }
}

/**
 * Suggests a conservative split for exactly three OCR name tokens.
 *
 * A particle at the expected surname boundary is strong structural evidence.
 * Two given-name tokens are accepted only when both occur in the caller's
 * explicit given-name set. Every other case returns an ambiguous candidate
 * and the alternative boundary; no token is discarded from either split.
 */
export function proposeStudentNameTripletSplit(
  words: readonly [string, string, string],
  order: StudentNameTripletOrder,
  options: {
    /** Supply the scan parser's canonical set; this helper owns no copy. */
    surnameParticles: ReadonlySet<string>
    /** Only exact entries in this set count as strong given-name evidence. */
    knownGivenNames?: ReadonlySet<string>
  },
): StudentNameTripletResult {
  const [first, middle, last] = words
  const surnameParticles = new Set(
    [...options.surnameParticles].map(normalizeToken),
  )
  const knownGivenNames = new Set(
    [...(options.knownGivenNames ?? [])].map(normalizeToken),
  )
  const particleBoundary =
    order === "given-surname"
      ? isSurnameParticle(middle, surnameParticles) &&
        !isSurnameParticle(last, surnameParticles)
        ? 1
        : undefined
      : isSurnameParticle(first, surnameParticles) &&
          !isSurnameParticle(middle, surnameParticles)
        ? 2
        : undefined
  const twoGivenNameBoundary =
    order === "given-surname"
      ? hasGivenNameEvidence(first, knownGivenNames, surnameParticles) &&
        hasGivenNameEvidence(middle, knownGivenNames, surnameParticles)
        ? 2
        : undefined
      : hasGivenNameEvidence(middle, knownGivenNames, surnameParticles) &&
          hasGivenNameEvidence(last, knownGivenNames, surnameParticles)
        ? 1
        : undefined

  const hasConflictingEvidence =
    particleBoundary !== undefined &&
    twoGivenNameBoundary !== undefined &&
    particleBoundary !== twoGivenNameBoundary
  const resolvedBoundary = hasConflictingEvidence
    ? undefined
    : (particleBoundary ?? twoGivenNameBoundary)
  const fallbackBoundary = order === "given-surname" ? 1 : 2
  const candidateBoundary =
    resolvedBoundary ?? particleBoundary ?? fallbackBoundary
  const alternativeBoundary = candidateBoundary === 1 ? 2 : 1
  const ambiguity = resolvedBoundary === undefined

  return {
    raw: words.join(" "),
    words: [...words],
    order,
    candidate: partitionAt(words, order, candidateBoundary),
    alternatives: ambiguity
      ? [partitionAt(words, order, alternativeBoundary)]
      : [],
    ambiguity,
    reason: hasConflictingEvidence
      ? "conflicting-evidence"
      : particleBoundary !== undefined
        ? "surname-particle"
        : twoGivenNameBoundary !== undefined
          ? "two-given-names"
          : "insufficient-evidence",
  }
}
