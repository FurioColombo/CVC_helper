import type { StudentSex } from "@/domain/config"
import { absoluteAssetUrl } from "@/lib/assetPath"

export const MIN_FIELD_CONFIDENCE = 70

/**
 * Below this, a whole row is treated as noise rather than as a student whose
 * fields need checking. It is deliberately lower than the field threshold: a
 * faint but real row is worth correcting, while an unreadable photograph must
 * still be reported as unusable instead of filled with invented rows.
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
}

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

const DATE_PATTERN = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/
const PHONE_PATTERN = /(?:\+?39[ .-]*)?(?:\d[ .-]*){9,10}/
const NON_NAME_CHARACTERS = /[^\p{L}'’ -]/gu
const STUDENT_SECTION_PATTERN =
  /\b(?:alliev[ioea]|student(?:e|i|essa|esse)|partecipanti)\b/u
const PERSONNEL_SECTION_PATTERN =
  /\b(?:personale|staff|istruttr(?:ore|ori|ice|ici)|assistent[ei]|volontari[eo]?|segreteria)\b/u
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
  // the "Ì" in "Massimo Ì", the "gi" in "Simone gi", a lone "s" or "-".
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
 * The helper intentionally refuses arbitrary surname/given splits. Two words
 * are unambiguous. A leading Italian surname particle permits the common
 * `De Angelis Luca` shape. Any other compound shape remains blank and marked
 * for review so the UI can ask the operator to edit the boundary.
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
        compoundAmbiguity: order === "unknown" ? words.length > 2 : true,
      },
    }
  }

  let split: NameSplit
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
      compoundAmbiguity: false,
    }
  } else if (words.length === 2) {
    split = {
      firstName: words[1]?.text ?? "",
      surname: words[0]?.text ?? "",
      firstNameConfidence: words[1]?.confidence ?? 0,
      surnameConfidence: words[0]?.confidence ?? 0,
      compoundAmbiguity: false,
    }
  } else if (
    words.length === 3 &&
    SURNAME_PARTICLES.has(normalizedNameToken(words[0]?.text ?? ""))
  ) {
    split = {
      firstName: words[2]?.text ?? "",
      surname: joinNameWords(words.slice(0, 2)),
      firstNameConfidence: words[2]?.confidence ?? 0,
      surnameConfidence: averageNameConfidence(words.slice(0, 2)),
      compoundAmbiguity: false,
    }
  } else {
    split = {
      firstName: "",
      surname: "",
      firstNameConfidence: 0,
      surnameConfidence: 0,
      compoundAmbiguity: true,
    }
  }

  return {
    ...candidate,
    firstName: split.firstName,
    surname: split.surname,
    sex: split.firstName ? inferSex(split.firstName) : null,
    confidence: {
      ...candidate.confidence,
      firstName: split.firstNameConfidence || candidate.confidence.firstName,
      surname: split.surnameConfidence || candidate.confidence.surname,
    },
    nameReading: {
      ...nextReading,
      compoundAmbiguity: split.compoundAmbiguity,
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
function inferSex(firstName: string): StudentSex | null {
  const normalized = normalizedNameToken(firstName.split(/\s+/)[0] ?? "")
  if (!normalized || [...normalized].length < 3) return null
  if (FEMALE_NAMES.has(normalized)) return "female"
  if (MALE_NAMES.has(normalized)) return "male"
  if (normalized.endsWith("a")) return "female"
  if (normalized.endsWith("o")) return "male"
  return null
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
function roleCode(word: RecognizedWord) {
  const letters = word.text.replace(/[^A-Za-z]/g, "")
  if (letters.length === 0 || letters !== letters.toUpperCase()) return null
  return (
    ROLE_CODES.find((role) => letters === role || letters.slice(1) === role) ??
    null
  )
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

function isObviousNonStudentLine(line: RecognizedLine) {
  const normalized = normalizeLineText(line.text)
  return (
    normalized.length === 0 ||
    NON_STUDENT_LINE_PATTERN.test(normalized) ||
    PERSONNEL_ROW_PREFIX_PATTERN.test(normalized)
  )
}

function candidateFromLine(
  line: RecognizedLine,
  layout: PageLayout | null,
  options: StudentScanOptions,
) {
  const dateMatch = line.text.match(DATE_PATTERN)
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
  const nameParts =
    layout && line.words.length > 0
      ? nameTokensFromWords(
          line.words.filter((word) => isLeftOfStructuredColumn(word, layout)),
        )
      : namePartsOutsideRanges(line, structuredRanges)
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
          raw: nameParts.map(({ text }) => text).join(" "),
          words: nameParts.map(({ text, confidence: wordConfidence }) => ({
            text,
            confidence: wordConfidence,
          })),
          order: "unknown",
          compoundAmbiguity: nameParts.length > 2,
          acknowledged: false,
        }
      : undefined

  const candidate = {
    sourceId: line.id,
    firstName,
    surname,
    dateOfBirth: normalizedDate,
    // Detected either way — the column bounds the name — but only reported
    // when it was asked for.
    phone: options.readPhone
      ? (phoneMatch?.[0].replace(/\s+/g, " ").trim() ?? "")
      : "",
    sex:
      confidence.firstName >= MIN_FIELD_CONFIDENCE ? inferSex(firstName) : null,
    confidence,
    ...(nameReading ? { nameReading } : {}),
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
  if (bestConfidence < MIN_ROW_CONFIDENCE) return null
  if (!candidate.firstName && !candidate.surname && !candidate.dateOfBirth) {
    return null
  }
  if (!dateMatch && !phoneMatch && nameParts.length < 2) return null
  return candidate
}

export function extractStudentCandidates(
  page: OcrPage,
  options: StudentScanOptions = DEFAULT_STUDENT_SCAN_OPTIONS,
): StudentScanResult {
  const candidates: StudentScanCandidate[] = []
  const lines = parseTsv(page.tsv, page.text, page.confidence)
  const layout = inferPageLayout(lines)
  let inPersonnelSection = false
  for (const line of lines) {
    const normalized = normalizeLineText(line.text)
    if (STUDENT_SECTION_PATTERN.test(normalized)) {
      inPersonnelSection = false
      continue
    }
    if (PERSONNEL_SECTION_PATTERN.test(normalized)) {
      inPersonnelSection = true
      continue
    }
    if (inPersonnelSection || isObviousNonStudentLine(line)) continue
    // The staff block at the foot of the sheet carries a role in its own
    // column. Those people are not students and must never be imported as one.
    if (isPersonnelRow(line, layout)) continue
    const candidate = candidateFromLine(line, layout, options)
    if (candidate) candidates.push(candidate)
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
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO })
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
        image,
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
