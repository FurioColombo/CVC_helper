import type { StudentSex } from "@/domain/config"
import { calculateAge } from "@/domain/student"
import { absoluteAssetUrl } from "@/lib/assetPath"
import { proposeStudentNameTripletSplit } from "./studentNameTriplet"
import { reconstructStudentScanTsvFragments } from "./studentScanRowGeometry"
import { eraseVerticalTableRulesFromImage } from "./studentScanRules"

export const MIN_FIELD_CONFIDENCE = 70

/** Candidate setting measured against the private five-photo capture set. */
export const TESSERACT_USER_DEFINED_DPI = 180

/**
 * Unanchored noise below this is omitted. Two recognizable name tokens or a
 * valid date are retained even below this row threshold: dropping a weak
 * person or readable date while keeping stronger neighbors would silently
 * omit a reviewable reading.
 */
const MIN_ROW_CONFIDENCE = 60

export type StudentScanField = "firstName" | "surname" | "dateOfBirth" | "phone"

export type StudentNameOrder = "given-surname" | "surname-given" | "unknown"

export interface StudentScanNameWord {
  text: string
  confidence: number
}

/**
 * A name reading is deliberately kept separate from the two persisted fields.
 * OCR cannot safely infer whether `Rossi Mario` means surname-first or a
 * malformed given name without column/header evidence or a human choice.
 */
export interface StudentScanNameReading {
  raw: string
  words: StudentScanNameWord[]
  order: StudentNameOrder
  compoundAmbiguity: boolean
  acknowledged: boolean
  /**
   * A short word read between two name words and left out of the fields (a
   * particle the parser does not know, or a stray mark). `raw` keeps it, and
   * the split stays marked for review whatever order is chosen.
   */
  droppedInteriorWord?: boolean
}

/**
 * Why a row read as a person still needs a look before it can be saved: a
 * staff role code the table layout could not place, two rows' dates or ages
 * read on one line, or a row written by an assistant rather than read by the
 * scan, which has no confidence of its own to trust.
 */
export type StudentScanRowWarning =
  | "possible-staff"
  | "possible-merged-rows"
  | "possible-heading"
  | "from-assistant"

export interface StudentScanCandidate {
  sourceId: string
  firstName: string
  surname: string
  dateOfBirth: string
  phone: string
  sex: StudentSex | null
  confidence: Record<StudentScanField, number>
  /** Present for OCR lines whose name order needs an explicit review. */
  nameReading?: StudentScanNameReading
  /** Independent printed age; transient OCR evidence, never persisted. */
  ageReading?: { value: number; confidence: number }
  rowWarning?: StudentScanRowWarning
}

export interface StudentScanResult {
  candidates: StudentScanCandidate[]
  aggregateConfidence: number
  unsuitable: boolean
}

export interface StudentScanProgress {
  phase: "loading" | "recognizing"
  value: number
}

/**
 * What the operator asked to be read.
 *
 * `readPhone: false` means the telephone is not reported: no candidate carries
 * one and the review never shows or counts one. It does **not** mean the
 * telephone pattern stops being looked for internally, and that distinction is
 * deliberate. The roster is a printed table whose telephone column is what
 * tells the parser where the name cell ends; the same match also decides that a
 * faint row is a row at all. Switching the detection off would make the names
 * worse, which is the opposite of why the option exists.
 */
export interface StudentScanOptions {
  readPhone: boolean
}

export const DEFAULT_STUDENT_SCAN_OPTIONS: StudentScanOptions = {
  readPhone: true,
}

export interface StudentScanProvider {
  scanStudents(
    image: Blob,
    onProgress?: (progress: StudentScanProgress) => void,
    options?: StudentScanOptions,
  ): Promise<StudentScanResult>
}

interface RecognizedWord {
  text: string
  confidence: number
  start: number
  end: number
  /** Page coordinates. Zero when the OCR output carries no geometry. */
  left: number
  right: number
}

interface RecognizedLine {
  id: string
  text: string
  confidence: number
  words: RecognizedWord[]
}

interface OcrPage {
  text: string
  tsv: string | null
  confidence: number
}

// Women whose names do not end in -a.
const FEMALE_NAMES = new Set([
  "agnes",
  "alice",
  "beatrice",
  "carmen",
  "catherine",
  "clio",
  "consuelo",
  "dafne",
  "ester",
  "irene",
  "ines",
  "isabel",
  "loredana",
  "margot",
  "miriam",
  "nives",
  "noemi",
  "rachele",
  "veronique",
])

// Men whose names end in -a, plus the common -e names a reader expects placed.
const MALE_NAMES = new Set([
  "andrea",
  "battista",
  "elia",
  "enea",
  "gioele",
  "gianluca",
  "luca",
  "mattia",
  "michele",
  "nicola",
  "daniele",
  "davide",
  "emanuele",
  "gabriele",
  "giuseppe",
  "lorenzo",
  "nicolo",
  "nicolò",
  "raffaele",
  "salvatore",
  "samuele",
  "simone",
  "tommaso",
])

// These exact irregular-name overrides are evidence for a possible second
// given name. Suffixes alone are not: Italian surnames also end in -a or -o.
const KNOWN_GIVEN_NAMES = new Set([...FEMALE_NAMES, ...MALE_NAMES])

const DATE_PATTERN = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/
const AGE_PATTERN = /\b(\d{1,3})\s+ann[oi]\b/iu
const PHONE_PATTERN = /(?:\+?39[ .-]*)?(?:\d[ .-]*){9,10}/
const NON_NAME_CHARACTERS = /[^\p{L}'’ -]/gu
const STUDENT_SECTION_PATTERN =
  /\b(?:alliev[ioea]|student(?:e|i|essa|esse)|partecipanti|iscritt[ie]|corsist[ie])\b/u
const PERSONNEL_SECTION_PATTERN =
  /\b(?:personale|staff|istrutt(?:ore|ori|rice|rici)|assistent[ei]|volontari[aeo]?|segreteria)\b/u
const NON_STUDENT_LINE_PATTERN =
  /\b(?:centro\s+velico|cvc|caprera|corso|settimana|elenco|foglio|pagina|pag\.?|stampa|stampat[oa]|generat[oa]|contatti?|informazioni|telefono|cellulare|nascita|cognome|nome|firma|note|totale|luned[ìi]|marted[ìi]|mercoled[ìi]|gioved[ìi]|venerd[ìi]|sabato|domenica)\b/u
const PERSONNEL_ROW_PREFIX_PATTERN =
  /^(?:adv|is|ct|istruttore|istruttrice|assistente|responsabile|coordinatore|coordinatrice|capocorso|direttore|direttrice|segreteria|staff)\b/u
const NON_NAME_TOKENS = new Set([
  // Column wording from the printed roster, which sits beside the names.
  "anni",
  "anno",
  "eta",
  "età",
  "tel",
  "telefono",
  "cell",
  "attivo",
  "attiva",
  "confermato",
  "confermata",
  "iscritto",
  "iscritta",
  "presente",
  "ok",
  "m",
  "f",
  "altro",
  "si",
  "sì",
])

// These are only used to make the OCR reading safe for review. They are not
// a surname dictionary and must never be used to claim that a name is valid.
const SURNAME_PARTICLES = new Set([
  "da",
  "dal",
  "dalla",
  "dall",
  "de",
  "dei",
  "degli",
  "del",
  "della",
  "delle",
  "di",
  "du",
  "la",
  "le",
  "li",
  "lo",
  "el",
  "al",
  "van",
  "von",
])

function normalizedNameToken(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("it")
    .replace(/[’']/g, "'")
    .replace(/[‐‑‒–—]/g, "-")
    .trim()
}

function isNameToken(value: string) {
  const normalized = normalizedNameToken(value)
  if (!normalized || NON_NAME_TOKENS.has(normalized)) return false
  if (!/\p{L}/u.test(normalized)) return false
  if (normalized.includes("-")) return true
  // Surname particles are the only short words that belong in a name.
  if (SURNAME_PARTICLES.has(normalized)) return true
  // Everything else short is a table rule or a stray mark that survived OCR:
  // the "Ì" in "Nurelia Ì", the "gi" in "Amedrio gi", a lone "s" or "-".
  return [...normalized].length >= 3
}

function nameWordsFromReading(reading: StudentScanNameReading) {
  const source =
    reading.words.length > 0
      ? reading.words
      : reading.raw
          .split(/\s+/)
          .filter(Boolean)
          .map((text) => ({ text, confidence: 0 }))
  return source.filter(({ text }) => isNameToken(text))
}

function joinNameWords(words: StudentScanNameWord[]) {
  return words
    .map(({ text }) => text)
    .join(" ")
    .trim()
}

interface NameSplit {
  firstName: string
  surname: string
  firstNameConfidence: number
  surnameConfidence: number
  compoundAmbiguity: boolean
  /** A zero is a real reading, not a missing one to fall back from. */
  exactConfidence?: boolean
}

function averageNameConfidence(words: StudentScanNameWord[]) {
  const confident = words
    .map(({ confidence }) => confidence)
    .filter((confidence) => Number.isFinite(confidence) && confidence > 0)
  if (confident.length === 0) return 0
  return (
    confident.reduce((sum, confidence) => sum + confidence, 0) /
    confident.length
  )
}

/**
 * Apply an explicitly selected name order to a raw OCR reading.
 *
 * Two words are unambiguous. A surname particle or two exact given-name cues
 * can resolve a triplet; other compounds stay marked for review. Choosing an
 * order must never erase the OCR reading.
 */
export function applyStudentNameOrder(
  candidate: StudentScanCandidate,
  order: StudentNameOrder,
): StudentScanCandidate {
  const existingReading = candidate.nameReading
  const reading: StudentScanNameReading = existingReading ?? {
    raw: [candidate.firstName, candidate.surname].filter(Boolean).join(" "),
    words: [candidate.firstName, ...candidate.surname.split(/\s+/)]
      .filter(Boolean)
      .map((text) => ({ text, confidence: 0 })),
    order: "given-surname",
    compoundAmbiguity: false,
    acknowledged: false,
  }
  const words = nameWordsFromReading(reading)
  const nextReading: StudentScanNameReading = {
    ...reading,
    order,
    acknowledged: false,
  }

  if (order === "unknown" || words.length < 2) {
    return {
      ...candidate,
      nameReading: {
        ...nextReading,
        compoundAmbiguity:
          (order === "unknown" ? words.length > 2 : true) ||
          Boolean(reading.droppedInteriorWord),
      },
    }
  }

  let split: NameSplit
  const triplet =
    words.length === 3
      ? proposeStudentNameTripletSplit(
          [words[0]!.text, words[1]!.text, words[2]!.text],
          order,
          {
            surnameParticles: SURNAME_PARTICLES,
            knownGivenNames: KNOWN_GIVEN_NAMES,
          },
        )
      : null
  if (order === "given-surname") {
    let surnameStart = words.length - 1
    const particleIndex = words.findIndex(
      ({ text }, index) =>
        index > 0 && SURNAME_PARTICLES.has(normalizedNameToken(text)),
    )
    if (particleIndex > 0) surnameStart = particleIndex
    const givenWords = words.slice(0, surnameStart)
    const surnameWords = words.slice(surnameStart)
    split = {
      firstName: joinNameWords(givenWords),
      surname: joinNameWords(surnameWords),
      firstNameConfidence: averageNameConfidence(givenWords),
      surnameConfidence: averageNameConfidence(surnameWords),
      compoundAmbiguity: triplet?.ambiguity ?? words.length > 2,
    }
  } else if (words.length === 2) {
    split = {
      firstName: words[1]?.text ?? "",
      surname: words[0]?.text ?? "",
      firstNameConfidence: words[1]?.confidence ?? 0,
      surnameConfidence: words[0]?.confidence ?? 0,
      compoundAmbiguity: false,
    }
  } else if (triplet && !triplet.ambiguity) {
    const surnameWordCount = triplet.candidate.surname.split(/\s+/).length
    const surnameWords = words.slice(0, surnameWordCount)
    const givenWords = words.slice(surnameWordCount)
    split = {
      firstName: joinNameWords(givenWords),
      surname: joinNameWords(surnameWords),
      firstNameConfidence: averageNameConfidence(givenWords),
      surnameConfidence: averageNameConfidence(surnameWords),
      compoundAmbiguity: false,
    }
  } else {
    // Surname first with an unproven boundary. The first word belongs to the
    // surname under either reading, so it is never offered as the given name:
    // a particle keeps the word after it, the rest is presented as given names
    // like the given-first default above, and the row stays marked for review.
    let surnameEnd = 1
    while (
      surnameEnd < words.length - 1 &&
      SURNAME_PARTICLES.has(normalizedNameToken(words[surnameEnd - 1]!.text))
    ) {
      surnameEnd += 1
    }
    const surnameWords = words.slice(0, surnameEnd)
    const givenWords = words.slice(surnameEnd)
    // The weakest word speaks for the field, so a confident particle can
    // never lift an uncertain surname over the threshold.
    const weakest = (group: StudentScanNameWord[]) =>
      Math.min(...group.map(({ confidence }) => confidence))
    split = {
      firstName: joinNameWords(givenWords),
      surname: joinNameWords(surnameWords),
      firstNameConfidence: weakest(givenWords),
      surnameConfidence: weakest(surnameWords),
      compoundAmbiguity: true,
      exactConfidence: words.some(({ confidence }) => confidence > 0),
    }
  }

  const firstNameConfidence = split.exactConfidence
    ? split.firstNameConfidence
    : split.firstNameConfidence || candidate.confidence.firstName
  const surnameConfidence = split.exactConfidence
    ? split.surnameConfidence
    : split.surnameConfidence || candidate.confidence.surname

  return {
    ...candidate,
    firstName: split.firstName,
    surname: split.surname,
    // A guess drawn from an unreliable given name is worse than no
    // suggestion, exactly as candidateFromLine already gates it.
    sex:
      split.firstName && firstNameConfidence >= MIN_FIELD_CONFIDENCE
        ? inferSex(split.firstName)
        : null,
    confidence: {
      ...candidate.confidence,
      firstName: firstNameConfidence,
      surname: surnameConfidence,
    },
    nameReading: {
      ...nextReading,
      compoundAmbiguity:
        split.compoundAmbiguity || Boolean(reading.droppedInteriorWord),
    },
  }
}

/**
 * Italian given names carry their gender in the ending far more reliably than
 * in any list: -a is female, -o is male. The two sets above are not a
 * dictionary of valid names; they exist to override the ending where it lies,
 * which is a short and well-known group (Andrea, Luca, Nicola, Mattia are men;
 * Nives and Ester are women). Anything else stays unknown rather than guessed.
 *
 * The result is only ever a suggestion and is always editable, so a wrong
 * ending costs one tap; refusing to suggest costs one on every row.
 */
export function inferSex(firstName: string): StudentSex | null {
  const normalized = normalizedNameToken(firstName.split(/\s+/)[0] ?? "")
  if (!normalized || [...normalized].length < 3) return null
  if (FEMALE_NAMES.has(normalized)) return "female"
  if (MALE_NAMES.has(normalized)) return "male"
  if (normalized.endsWith("a")) return "female"
  if (normalized.endsWith("o")) return "male"
  return null
}

export interface StudentNameOrderInference {
  order: StudentNameOrder
  firstWordVotes: number
  lastWordVotes: number
}

/** A sheet votes once per name cell, using exactly the sex suggestion rule.
 * Two supporting rows are the minimum; a tie or a single name still asks.
 * Endings can also recognise surnames, so both vote counts remain visible.
 */
export function inferStudentNameOrder(
  candidates: StudentScanCandidate[],
): StudentNameOrderInference {
  let firstWordVotes = 0
  let lastWordVotes = 0
  for (const { nameReading } of candidates) {
    if (!nameReading) continue
    const words = nameWordsFromReading(nameReading)
    if (words.length < 2) continue
    firstWordVotes += Number(inferSex(words[0]!.text) !== null)
    lastWordVotes += Number(inferSex(words.at(-1)!.text) !== null)
  }
  const order =
    Math.max(firstWordVotes, lastWordVotes) < 2 ||
    firstWordVotes === lastWordVotes
      ? "unknown"
      : firstWordVotes > lastWordVotes
        ? "given-surname"
        : "surname-given"
  return { order, firstWordVotes, lastWordVotes }
}

function normalizeDate(match: RegExpMatchArray | null) {
  if (!match) return ""
  const [, day, month, year] = match
  if (!day || !month || !year) return ""
  const paddedDay = day.padStart(2, "0")
  const paddedMonth = month.padStart(2, "0")
  const iso = `${year}-${paddedMonth}-${paddedDay}`
  const parsed = new Date(`${iso}T00:00:00Z`)
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() + 1 !== Number(month) ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return ""
  }
  return iso
}

/** Age is always evaluated at course start, never at the wall-clock scan date. */
export function studentScanAge(
  candidate: StudentScanCandidate,
  referenceDate: string,
) {
  // A printed age is the value the review presents. The stored birth date is
  // still the source for minor/adult rules and supplies a derived age only on
  // sheets that do not print one.
  if (candidate.ageReading) return candidate.ageReading.value
  if (candidate.dateOfBirth)
    return calculateAge(candidate.dateOfBirth, referenceDate)
  return null
}

export function studentScanAgeCorroborated(
  candidate: StudentScanCandidate,
  referenceDate: string,
) {
  const { ageReading, dateOfBirth } = candidate
  if (!ageReading || !dateOfBirth || dateOfBirth > referenceDate) return false
  // Only a reliable printed age can vouch for an uncertain date: two readings
  // below the threshold must not clear each other.
  if (ageReading.confidence < MIN_FIELD_CONFIDENCE) return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth)
  if (
    !match ||
    normalizeDate(["", match[3]!, match[2]!, match[1]!] as RegExpMatchArray) !==
      dateOfBirth
  )
    return false
  return (
    Math.abs(calculateAge(dateOfBirth, referenceDate) - ageReading.value) <= 1
  )
}

function average(values: number[], fallback: number) {
  if (values.length === 0) return fallback
  return values.reduce((total, value) => total + value, 0) / values.length
}

function confidenceForRange(line: RecognizedLine, start: number, end: number) {
  return average(
    line.words
      .filter((word) => word.end > start && word.start < end)
      .map((word) => word.confidence),
    line.confidence,
  )
}

function normalizeLineText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("it")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function parseTsv(
  tsv: string | null,
  fallbackText: string,
  fallbackConfidence: number,
) {
  if (!tsv) {
    return fallbackText
      .split(/\r?\n/)
      .map((text, index) => ({
        id: String(index),
        text: text.trim(),
        confidence: fallbackConfidence,
        words: [],
      }))
      .filter(({ text }) => text.length > 0)
  }

  const grouped = new Map<
    string,
    Array<{ text: string; confidence: number; left: number; right: number }>
  >()
  for (const row of tsv.split(/\r?\n/).slice(1)) {
    const columns = row.split("\t")
    if (columns[0] !== "5" || !columns[11]?.trim()) continue
    const key = columns.slice(1, 5).join(":")
    const words = grouped.get(key) ?? []
    const left = Number(columns[6]) || 0
    const width = Number(columns[8]) || 0
    words.push({
      text: columns[11].trim(),
      confidence: Number(columns[10]) || 0,
      left,
      right: left + width,
    })
    grouped.set(key, words)
  }

  return [...grouped.entries()].map(([id, rawWords]) => {
    let text = ""
    const words = rawWords.map((word) => {
      const start = text.length
      text += `${text ? " " : ""}${word.text}`
      const adjustedStart = text ? text.lastIndexOf(word.text) : start
      return {
        ...word,
        start: adjustedStart,
        end: adjustedStart + word.text.length,
      }
    })
    return {
      id,
      text,
      confidence: average(
        words.map(({ confidence }) => confidence),
        0,
      ),
      words,
    }
  })
}

interface TextRange {
  start: number
  end: number
}

function overlapsRange(word: RecognizedWord, range: TextRange) {
  return word.end > range.start && word.start < range.end
}

function nameTokensFromWords(words: RecognizedWord[]) {
  return words.flatMap((word) =>
    word.text
      .replace(NON_NAME_CHARACTERS, " ")
      .split(/\s+/)
      .map((text) => text.trim())
      .filter(isNameToken)
      .map((text) => ({ text, confidence: word.confidence })),
  )
}

function namePartsOutsideRanges(line: RecognizedLine, ranges: TextRange[]) {
  if (line.words.length > 0) {
    return nameTokensFromWords(
      line.words.filter(
        (word) => !ranges.some((range) => overlapsRange(word, range)),
      ),
    )
  }

  let unstructuredText = line.text
  for (const range of [...ranges].sort(
    (left, right) => right.start - left.start,
  )) {
    unstructuredText = `${unstructuredText.slice(0, range.start)} ${unstructuredText.slice(range.end)}`
  }
  return unstructuredText
    .replace(NON_NAME_CHARACTERS, " ")
    .split(/\s+/)
    .map((text) => text.trim())
    .filter(
      (text) =>
        text.length > 0 && !NON_NAME_TOKENS.has(text.toLocaleLowerCase("it")),
    )
    .map((text) => ({ text, confidence: line.confidence }))
}

/**
 * The roster is a printed table: name, then telephone, then age and date of
 * birth, and on the full sheet a role column for staff. Tesseract returns each
 * table row as a single line, so a text-only parse leaves the age column's
 * wording inside the surname and cannot separate a staff row from a student
 * row. When the OCR output carries word coordinates the columns are recovered
 * from geometry instead; without them the text-range parse stays in charge.
 */
interface PageLayout {
  /** Left edge of the telephone column. Name words sit entirely left of it. */
  structuredLeft: number
}

const ROLE_CODES = ["ADV", "CT", "AT", "IS"]

/**
 * Staff rows carry their role in a column of their own. The code is printed in
 * capitals, which separates it from the title-case names, and a table rule
 * frequently attaches one stray capital to it, so `ICT` still means `CT`.
 */
function roleCode(word: Pick<RecognizedWord, "text">) {
  const letters = word.text.replace(/[^A-Za-z]/g, "")
  if (letters.length === 0 || letters !== letters.toUpperCase()) return null
  return (
    ROLE_CODES.find((role) => letters === role || letters.slice(1) === role) ??
    null
  )
}

/**
 * A role code anywhere after the first word. Without a table layout (a tight
 * crop with too few rows) or with the role column right of the dates, the
 * code cannot prove a staff row, but the row must not pass as a ready student.
 */
function hasRoleCode(line: RecognizedLine) {
  const words =
    line.words.length > 0
      ? line.words
      : line.text.split(/\s+/).map((text) => ({ text }))
  return words.some((word, index) => index > 0 && roleCode(word) !== null)
}

function countMatches(text: string, pattern: RegExp) {
  return (text.match(new RegExp(pattern.source, `${pattern.flags}g`)) ?? [])
    .length
}

/**
 * The words between the first and last name word, as read. A short word
 * between two name words that is not a known particle is left out of the
 * fields, but it may be part of a surname the parser does not know, so the
 * reading keeps it and the split is marked for review.
 */
function interiorNameSpan(tokens: string[]) {
  const kept = tokens.map((token) => isNameToken(token))
  const first = kept.indexOf(true)
  const last = kept.lastIndexOf(true)
  if (first === -1 || first === last) return { dropped: false, raw: null }
  const span = tokens.slice(first, last + 1)
  const dropped = span.some(
    (token) =>
      !isNameToken(token) &&
      /^\p{L}+$/u.test(token) &&
      !NON_NAME_TOKENS.has(normalizedNameToken(token)),
  )
  return {
    dropped,
    raw: dropped
      ? span.filter((token) => /\p{L}/u.test(token)).join(" ")
      : null,
  }
}

function digitCount(value: string) {
  return (value.match(/\d/g) ?? []).length
}

function isStructuredWord(word: RecognizedWord) {
  const text = word.text.trim()
  if (normalizedNameToken(text) === "anni") return true
  if (DATE_PATTERN.test(text)) return true
  // A telephone survives OCR as one long digit run; a row index does not.
  return digitCount(text) >= 7
}

function median(values: number[]) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0)
}

function inferPageLayout(lines: RecognizedLine[]): PageLayout | null {
  const words = lines.flatMap((line) => line.words)
  if (words.length === 0) return null
  // Fixtures and geometry-free OCR report every word at the same position.
  if (new Set(words.map((word) => word.left)).size < 2) return null
  if (words.every((word) => word.right <= word.left)) return null

  const columnStarts = lines
    .map((line) => {
      const structured = line.words.filter(isStructuredWord)
      if (structured.length === 0) return null
      return Math.min(...structured.map((word) => word.left))
    })
    .filter((value): value is number => value !== null)
  // One or two agreeing rows could be a caption; a column needs a majority.
  if (columnStarts.length < 3) return null
  return { structuredLeft: median(columnStarts) }
}

function isLeftOfStructuredColumn(word: RecognizedWord, layout: PageLayout) {
  return (word.left + word.right) / 2 < layout.structuredLeft
}

function isPersonnelRow(line: RecognizedLine, layout: PageLayout | null) {
  if (!layout) return false
  // The first word of a row is the name itself and can never be the role.
  return line.words.some(
    (word, index) =>
      index > 0 && roleCode(word) && isLeftOfStructuredColumn(word, layout),
  )
}

/**
 * The words before a row's first date, age or telephone: its name cell, or the
 * whole line for a heading. Keyword tests look only here, because noise read
 * from the grid to the right (a `pag` or `note` after the date) would
 * otherwise silently drop a student, or turn every following row into staff.
 * Without a word of three or more letters that is not a particle before its
 * first date, a line has no name cell, so a heading or footer such as
 * `12/09/2026 Corso …` or `N. 3 del 12/09/2026 Elenco …` is judged whole.
 */
function leadingText(line: RecognizedLine) {
  const starts = [DATE_PATTERN, AGE_PATTERN, PHONE_PATTERN]
    .map((pattern) => line.text.match(pattern)?.index)
    .filter((index): index is number => index !== undefined)
  const leading =
    starts.length > 0 ? line.text.slice(0, Math.min(...starts)) : line.text
  const nameCell = (leading.match(/\p{L}+/gu) ?? []).some(
    (word) =>
      [...word].length >= 3 &&
      !SURNAME_PARTICLES.has(normalizedNameToken(word)),
  )
  return normalizeLineText(nameCell ? leading : line.text)
}

function hasStructuredField(line: RecognizedLine) {
  return [DATE_PATTERN, AGE_PATTERN, PHONE_PATTERN].some((pattern) =>
    pattern.test(line.text),
  )
}

// The youngest age the review accepts as read (PLAUSIBLE_SCAN_AGE in
// studentScanReview.ts): a more recent date is not a student's birth date.
const YOUNGEST_STUDENT_AGE = 4

function todayDateOnly() {
  const now = new Date()
  return [
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-")
}

function couldBeBirthDate(match: RegExpMatchArray) {
  const iso = normalizeDate(match)
  // An impossible date is a misreading, not proof of a heading.
  if (!iso) return true
  const today = todayDateOnly()
  return iso <= today && calculateAge(iso, today) >= YOUNGEST_STUDENT_AGE
}

type LineKind = "skip" | "row" | "possible-heading"

// "8-12 anni" describes a course, never one person.
const AGE_RANGE_PATTERN = /\b\d{1,2}\s*[-–]\s*\d{1,3}\s+ann[oi]\b/iu

function isHeadingWord(word: string) {
  return NON_STUDENT_LINE_PATTERN.test(normalizeLineText(word))
}

// A heading word, or a heading phrase across words ("Centro Velico").
function hasHeadingWords(words: string[]) {
  return (
    words.some(isHeadingWord) ||
    NON_STUDENT_LINE_PATTERN.test(normalizeLineText(words.join(" ")))
  )
}

function nameCellWords(line: RecognizedLine, layout: PageLayout) {
  return nameTokensFromWords(
    line.words.filter((word) => isLeftOfStructuredColumn(word, layout)),
  ).map(({ text }) => text)
}

function classifyLine(
  line: RecognizedLine,
  layout: PageLayout | null,
): LineKind {
  const normalized = normalizeLineText(line.text)
  if (normalized.length === 0) return "skip"
  if (PERSONNEL_ROW_PREFIX_PATTERN.test(normalized)) return "skip"
  // A printed age belongs to a person, not to a heading: a student whose name
  // holds a heading word (Domenica, Sabato, Corso) stays a row to review,
  // marked, because "Settimana Deriva 12 anni" reads the same way.
  if (AGE_PATTERN.test(line.text)) {
    const words =
      layout && line.words.length > 0
        ? nameCellWords(line, layout)
        : (leadingText(line).match(/\p{L}+/gu) ?? [])
    // An age range is a course's, never one person's: after a leading heading
    // word or with no name at all the line is a heading; otherwise ("Gruppo
    // Vela 8-12 anni") it is kept, marked.
    if (AGE_RANGE_PATTERN.test(line.text)) {
      return words.length === 0 || isHeadingWord(words[0]!)
        ? "skip"
        : "possible-heading"
    }
    return hasHeadingWords(words) ? "possible-heading" : "row"
  }
  // So does a table row: two name words in the name column beside a date or a
  // telephone, even when the age word itself was misread. With a heading word
  // in it the row may be a heading ("Corso Deriva …") or a student called
  // Corso or Sabato: it is kept and marked, and dropped only when its date
  // cannot be a student's birth date (the course or print date).
  const dateMatch = line.text.match(DATE_PATTERN)
  if (layout && (dateMatch || PHONE_PATTERN.test(line.text))) {
    const nameWords = nameCellWords(line, layout)
    if (nameWords.length >= 2) {
      if (!hasHeadingWords(nameWords)) return "row"
      if (dateMatch && !couldBeBirthDate(dateMatch)) return "skip"
      return "possible-heading"
    }
  }
  if (!NON_STUDENT_LINE_PATTERN.test(leadingText(line))) return "row"
  // Without a table layout, two name words before a date that could be a
  // birth date may still be a student ("Rossi Domenica 12/03/2014"): kept,
  // marked. A course or print date makes it a heading.
  if (dateMatch?.index !== undefined && couldBeBirthDate(dateMatch)) {
    const nameWords = (
      line.text.slice(0, dateMatch.index).match(/\p{L}{2,}/gu) ?? []
    ).filter((word) => {
      const token = normalizedNameToken(word)
      return !SURNAME_PARTICLES.has(token) && !STAFF_HEADING_FILLER.has(token)
    })
    if (nameWords.length >= 2) return "possible-heading"
  }
  return "skip"
}

// The collective heading of a staff block, as opposed to one person's role.
const COLLECTIVE_STAFF_PATTERN =
  /^(?:personale|staff|istruttori|istruttrici|assistenti|volontari|volontarie|segreteria)$/u
// A column or form label ("Cognome Nome Nascita Istruttore", "Firma
// istruttore"), which names a field rather than a person or a section.
const LABEL_WORD_PATTERN =
  /^(?:cognome|nome|nascita|telefono|cellulare|firma|note|data)$/u
// Short words that are not names (articles, prepositions, "turno").
const STAFF_HEADING_FILLER = new Set([
  "e",
  "ed",
  "di",
  "del",
  "della",
  "dei",
  "degli",
  "delle",
  "il",
  "la",
  "i",
  "gli",
  "le",
  "per",
  "turno",
  "turni",
])

/**
 * A staff line that is a column or form label ("Cognome Nome Nascita
 * Istruttore", "Nome assistente:") rather than the heading of a staff block:
 * a label word and no collective staff word.
 */
function isColumnLabel(leading: string) {
  const words = leading.match(/\p{L}+/gu) ?? []
  return (
    words.some((word) => LABEL_WORD_PATTERN.test(word)) &&
    !words.some((word) => COLLECTIVE_STAFF_PATTERN.test(word))
  )
}

/** A row that reads as a student: a birth date or a plausible age. */
function readsAsStudent({ dateOfBirth, ageReading }: StudentScanCandidate) {
  if (dateOfBirth) {
    const [year, month, day] = dateOfBirth.split("-")
    return couldBeBirthDate(["", day, month, year] as RegExpMatchArray)
  }
  return Boolean(ageReading && ageReading.value >= YOUNGEST_STUDENT_AGE)
}

function candidateFromLine(
  line: RecognizedLine,
  layout: PageLayout | null,
  options: StudentScanOptions,
) {
  const dateMatch = line.text.match(DATE_PATTERN)
  const ageMatch = line.text.match(AGE_PATTERN)
  const dateStart = dateMatch?.index ?? -1
  const phoneSearchText =
    dateMatch && dateStart >= 0
      ? `${line.text.slice(0, dateStart)}${"#".repeat(dateMatch[0].length)}${line.text.slice(dateStart + dateMatch[0].length)}`
      : line.text
  const phoneMatch = phoneSearchText.match(PHONE_PATTERN)
  const phoneStart = phoneMatch?.index ?? -1
  const structuredRanges = [
    dateMatch && dateStart >= 0
      ? { start: dateStart, end: dateStart + dateMatch[0].length }
      : null,
    phoneMatch && phoneStart >= 0
      ? { start: phoneStart, end: phoneStart + phoneMatch[0].length }
      : null,
  ].filter((range): range is TextRange => Boolean(range))
  // Geometry gives the name cell directly, which keeps the age column's
  // wording and the telephone out of the name regardless of how Tesseract
  // ordered the row's text.
  const nameCellWords =
    layout && line.words.length > 0
      ? line.words.filter((word) => isLeftOfStructuredColumn(word, layout))
      : null
  const nameParts = nameCellWords
    ? nameTokensFromWords(nameCellWords)
    : namePartsOutsideRanges(line, structuredRanges)
  // The interior-word check needs the words as read, before the short ones are
  // filtered out: from the name cell with a layout, or from every word outside
  // the date and telephone on a crop too small to have one.
  const rawNameWords =
    nameCellWords ??
    (line.words.length > 0
      ? line.words.filter(
          (word) =>
            !structuredRanges.some((range) => overlapsRange(word, range)),
        )
      : null)
  const interior = interiorNameSpan(
    rawNameWords
      ? rawNameWords.flatMap((word) =>
          word.text
            .replace(NON_NAME_CHARACTERS, " ")
            .split(/\s+/)
            .filter(Boolean),
        )
      : nameParts.map(({ text }) => text),
  )
  const firstName = nameParts[0]?.text ?? ""
  const surname = nameParts
    .slice(1)
    .map(({ text }) => text)
    .join(" ")
  const firstNameConfidence = nameParts[0]?.confidence ?? 0
  const surnameConfidence = surname
    ? average(
        nameParts.slice(1).map(({ confidence }) => confidence),
        line.confidence,
      )
    : 0
  const dateConfidence = dateMatch
    ? confidenceForRange(
        line,
        dateMatch.index ?? 0,
        (dateMatch.index ?? 0) + dateMatch[0].length,
      )
    : 0
  const phoneConfidence =
    phoneMatch && phoneStart >= 0
      ? confidenceForRange(line, phoneStart, phoneStart + phoneMatch[0].length)
      : 0
  const normalizedDate = normalizeDate(dateMatch)

  const confidence = {
    firstName: firstNameConfidence,
    surname: surnameConfidence,
    dateOfBirth: normalizedDate ? dateConfidence : 0,
    phone: phoneConfidence,
  }

  // A reading below the threshold is kept and reported as uncertain rather
  // than discarded. The review screen exists to be corrected, and it already
  // marks every low-confidence field "Da controllare"; blanking the text only
  // forced the operator to retype what the scan had in fact read. The sex
  // suggestion stays gated, because a guess drawn from an unreliable name is
  // worse than no suggestion.
  // A roster may print either order, and this one prints the surname first.
  // The words are preserved exactly as read and the order is left unknown, so
  // the review screen must ask rather than let the first token pass as a given
  // name. firstName and surname below are only a provisional presentation of
  // the same words; `raw` is the reading of record.
  const nameReading: StudentScanNameReading | undefined =
    nameParts.length >= 2
      ? {
          raw: interior.raw ?? nameParts.map(({ text }) => text).join(" "),
          words: nameParts.map(({ text, confidence: wordConfidence }) => ({
            text,
            confidence: wordConfidence,
          })),
          order: "unknown",
          compoundAmbiguity: nameParts.length > 2 || interior.dropped,
          acknowledged: false,
          ...(interior.dropped ? { droppedInteriorWord: true } : {}),
        }
      : undefined
  // Two dates or two ages on one line are two rows read as one: only the
  // first of each would be kept, and confirming the name would merge people.
  const rowWarning: StudentScanRowWarning | undefined =
    countMatches(line.text, DATE_PATTERN) > 1 ||
    countMatches(line.text, AGE_PATTERN) > 1
      ? "possible-merged-rows"
      : hasRoleCode(line)
        ? "possible-staff"
        : undefined

  const candidate = {
    sourceId: line.id,
    firstName,
    surname,
    dateOfBirth: normalizedDate,
    ...(ageMatch
      ? {
          ageReading: {
            value: Number(ageMatch[1]),
            confidence: confidenceForRange(
              line,
              ageMatch.index ?? 0,
              (ageMatch.index ?? 0) + ageMatch[1]!.length,
            ),
          },
        }
      : {}),
    // Detected either way — the column bounds the name — but only reported
    // when it was asked for.
    phone: options.readPhone
      ? (phoneMatch?.[0].replace(/\s+/g, " ").trim() ?? "")
      : "",
    sex:
      confidence.firstName >= MIN_FIELD_CONFIDENCE ? inferSex(firstName) : null,
    confidence,
    ...(nameReading ? { nameReading } : {}),
    ...(rowWarning ? { rowWarning } : {}),
  } satisfies StudentScanCandidate

  // Individual fields may be uncertain and still worth correcting, but a row
  // with nothing trustworthy anywhere in it is noise. Keeping that distinction
  // is what still lets an unreadable photograph be reported as unusable
  // instead of being filled with invented rows.
  const bestConfidence = Math.max(
    confidence.firstName,
    confidence.surname,
    confidence.dateOfBirth,
    confidence.phone,
  )
  // A separate structured fragment may be too far from every name for a safe
  // join. Keep its reading as an incomplete review row even when confidence is
  // low; the operator can attach or remove it without losing OCR text.
  const hasStructuredReading =
    Boolean(normalizedDate) ||
    Boolean(ageMatch) ||
    (options.readPhone && Boolean(phoneMatch))
  if (
    bestConfidence < MIN_ROW_CONFIDENCE &&
    nameParts.length === 0 &&
    !hasStructuredReading
  ) {
    return null
  }
  if (!candidate.firstName && !candidate.surname && !hasStructuredReading) {
    return null
  }
  return candidate
}

export function extractStudentCandidates(
  page: OcrPage,
  options: StudentScanOptions = DEFAULT_STUDENT_SCAN_OPTIONS,
): StudentScanResult {
  const candidates: StudentScanCandidate[] = []
  const tsv = page.tsv ? reconstructStudentScanTsvFragments(page.tsv).tsv : null
  const lines = parseTsv(tsv, page.text, page.confidence)
  const layout = inferPageLayout(lines)
  // No staff heading drops the rows after it: a heading that looks like one
  // may be a label, a blank form field or a line split from its names, and
  // the students after it would vanish unseen. The rows after a staff line
  // are marked as possible staff until a student heading instead, and staff
  // rows that carry a role code are still left out one by one
  // (isPersonnelRow). A staff line that carries a date marks them always
  // ("Personale al 29/08/2026"); one that carries only a telephone, or a
  // column label ("Cognome Nome Nascita Istruttore"), marks them when a row
  // that reads as a student came before it or, for the telephone, a student
  // heading comes after it. Otherwise it is the school's contact line or the
  // table header above the students, and marks nothing.
  let afterPersonnelMention = false
  // Whether a student heading follows a line: then the rows between a staff
  // contact line or label and that heading are not the students.
  const studentHeadingFollows = lines.map(() => false)
  for (let index = lines.length - 2; index >= 0; index -= 1) {
    studentHeadingFollows[index] =
      studentHeadingFollows[index + 1]! ||
      STUDENT_SECTION_PATTERN.test(leadingText(lines[index + 1]!))
  }
  for (const [index, line] of lines.entries()) {
    const leading = leadingText(line)
    // Any student heading ends the marking.
    if (STUDENT_SECTION_PATTERN.test(leading)) {
      afterPersonnelMention = false
      continue
    }
    const staffWord = PERSONNEL_SECTION_PATTERN.test(leading)
    if (staffWord) {
      if (!hasStructuredField(line)) {
        if (
          !isColumnLabel(leading) ||
          candidates.some(readsAsStudent) ||
          studentHeadingFollows[index]
        )
          afterPersonnelMention = true
        continue
      }
      if (
        DATE_PATTERN.test(line.text) ||
        candidates.some(readsAsStudent) ||
        studentHeadingFollows[index]
      )
        afterPersonnelMention = true
    }
    const kind = classifyLine(line, layout)
    if (kind === "skip") continue
    // The staff block at the foot of the sheet carries a role in its own
    // column. Those people are not students and must never be imported as one.
    if (isPersonnelRow(line, layout)) continue
    const candidate = candidateFromLine(line, layout, options)
    if (candidate) {
      // A row that carries a staff word itself ("Neri volontario 30 anni") is
      // marked too, wherever it is.
      const rowWarning: StudentScanRowWarning | undefined =
        candidate.rowWarning ??
        (afterPersonnelMention || staffWord
          ? "possible-staff"
          : kind === "possible-heading"
            ? "possible-heading"
            : undefined)
      candidates.push(rowWarning ? { ...candidate, rowWarning } : candidate)
    }
  }

  return {
    aggregateConfidence: page.confidence,
    candidates,
    unsuitable: candidates.length === 0,
  }
}

let progressListener: ((progress: StudentScanProgress) => void) | undefined
let workerPromise: Promise<import("tesseract.js").Worker> | undefined

// Tesseract needs absolute URLs, and they must respect the base path the app
// was built for: resolving against the origin drops it and 404s on a project
// host that serves the app at /<repo>/.
const assetUrl = absoluteAssetUrl

async function getWorker() {
  workerPromise ??= import("tesseract.js")
    .then(async ({ createWorker, OEM, PSM }) => {
      const worker = await createWorker("ita", OEM.LSTM_ONLY, {
        corePath: assetUrl("/ocr/core"),
        langPath: assetUrl("/ocr/lang"),
        logger: ({ progress, status }) => {
          progressListener?.({
            phase: status.includes("recognizing") ? "recognizing" : "loading",
            value: progress,
          })
        },
        workerPath: assetUrl("/ocr/worker.min.js"),
      })
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        user_defined_dpi: String(TESSERACT_USER_DEFINED_DPI),
      })
      return worker
    })
    .catch((error: unknown) => {
      workerPromise = undefined
      throw error
    })
  return workerPromise
}

class LocalTesseractStudentScanProvider implements StudentScanProvider {
  async scanStudents(
    image: Blob,
    onProgress?: (progress: StudentScanProgress) => void,
    options: StudentScanOptions = DEFAULT_STUDENT_SCAN_OPTIONS,
  ) {
    progressListener = onProgress
    try {
      const worker = await getWorker()
      const result = await worker.recognize(
        await eraseVerticalTableRulesFromImage(image),
        { rotateAuto: true },
        { text: true, tsv: true },
      )
      return extractStudentCandidates(result.data, options)
    } finally {
      progressListener = undefined
    }
  }
}

export const studentScanProvider = new LocalTesseractStudentScanProvider()

export function scanStudents(
  image: Blob,
  onProgress?: (progress: StudentScanProgress) => void,
  options: StudentScanOptions = DEFAULT_STUDENT_SCAN_OPTIONS,
) {
  return studentScanProvider.scanStudents(image, onProgress, options)
}
