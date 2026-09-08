import type { StudentSex } from "@/domain/config"

export const MIN_FIELD_CONFIDENCE = 70

export type StudentScanField = "firstName" | "surname" | "dateOfBirth" | "phone"

export interface StudentScanCandidate {
  sourceId: string
  firstName: string
  surname: string
  dateOfBirth: string
  phone: string
  sex: StudentSex | null
  confidence: Record<StudentScanField, number>
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

export interface StudentScanProvider {
  scanStudents(
    image: Blob,
    onProgress?: (progress: StudentScanProgress) => void,
  ): Promise<StudentScanResult>
}

interface RecognizedWord {
  text: string
  confidence: number
  start: number
  end: number
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

const FEMALE_NAMES = new Set([
  "alessandra",
  "anna",
  "chiara",
  "elena",
  "elisa",
  "francesca",
  "giulia",
  "laura",
  "lucia",
  "maria",
  "martina",
  "sara",
  "sofia",
  "valentina",
])

const MALE_NAMES = new Set([
  "alessandro",
  "andrea",
  "davide",
  "francesco",
  "giacomo",
  "giovanni",
  "luca",
  "marco",
  "mario",
  "matteo",
  "nicola",
  "paolo",
  "simone",
  "stefano",
])

const DATE_PATTERN = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/
const PHONE_PATTERN = /(?:\+?39[ .-]*)?(?:\d[ .-]*){9,10}/
const NON_NAME_CHARACTERS = /[^\p{L}'’ -]/gu
const STUDENT_SECTION_PATTERN =
  /\b(?:alliev[ioea]|student(?:e|i|essa|esse)|partecipanti)\b/u
const PERSONNEL_SECTION_PATTERN =
  /\b(?:personale|staff|istruttr(?:ore|ori|ice|ici)|assistent[ei]|volontari[eo]?|segreteria)\b/u
const NON_STUDENT_LINE_PATTERN =
  /\b(?:centro\s+velico|cvc|caprera|corso|settimana|elenco|foglio|pagina|pag\.?|stampa|stampat[oa]|generat[oa]|contatti?|informazioni|telefono|cellulare|nascita|cognome|nome|firma|note|totale)\b/u
const PERSONNEL_ROW_PREFIX_PATTERN =
  /^(?:adv|is|ct|istruttore|istruttrice|assistente|responsabile|coordinatore|coordinatrice|capocorso|direttore|direttrice|segreteria|staff)\b/u
const NON_NAME_TOKENS = new Set([
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

function inferSex(firstName: string): StudentSex | null {
  const normalized = firstName.trim().toLocaleLowerCase("it")
  if (FEMALE_NAMES.has(normalized)) return "female"
  if (MALE_NAMES.has(normalized)) return "male"
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

  const grouped = new Map<string, Array<{ text: string; confidence: number }>>()
  for (const row of tsv.split(/\r?\n/).slice(1)) {
    const columns = row.split("\t")
    if (columns[0] !== "5" || !columns[11]?.trim()) continue
    const key = columns.slice(1, 5).join(":")
    const words = grouped.get(key) ?? []
    words.push({
      text: columns[11].trim(),
      confidence: Number(columns[10]) || 0,
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

function namePartsOutsideRanges(line: RecognizedLine, ranges: TextRange[]) {
  if (line.words.length > 0) {
    return line.words.flatMap((word) => {
      if (ranges.some((range) => overlapsRange(word, range))) return []
      return word.text
        .replace(NON_NAME_CHARACTERS, " ")
        .split(/\s+/)
        .map((text) => text.trim())
        .filter(
          (text) =>
            text.length > 0 &&
            !NON_NAME_TOKENS.has(text.toLocaleLowerCase("it")),
        )
        .map((text) => ({ text, confidence: word.confidence }))
    })
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

function isObviousNonStudentLine(line: RecognizedLine) {
  const normalized = normalizeLineText(line.text)
  return (
    normalized.length === 0 ||
    NON_STUDENT_LINE_PATTERN.test(normalized) ||
    PERSONNEL_ROW_PREFIX_PATTERN.test(normalized)
  )
}

function candidateFromLine(line: RecognizedLine) {
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
  const nameParts = namePartsOutsideRanges(line, structuredRanges)
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

  const candidate = {
    sourceId: line.id,
    firstName: confidence.firstName >= MIN_FIELD_CONFIDENCE ? firstName : "",
    surname: confidence.surname >= MIN_FIELD_CONFIDENCE ? surname : "",
    dateOfBirth:
      confidence.dateOfBirth >= MIN_FIELD_CONFIDENCE ? normalizedDate : "",
    phone:
      confidence.phone >= MIN_FIELD_CONFIDENCE
        ? (phoneMatch?.[0].replace(/\s+/g, " ").trim() ?? "")
        : "",
    sex:
      confidence.firstName >= MIN_FIELD_CONFIDENCE ? inferSex(firstName) : null,
    confidence,
  } satisfies StudentScanCandidate

  const hasReliableName = Boolean(candidate.firstName || candidate.surname)
  const hasReliableDate = Boolean(candidate.dateOfBirth)
  if (!hasReliableName && !hasReliableDate) return null
  if (!dateMatch && !phoneMatch && nameParts.length < 2) return null
  return candidate
}

export function extractStudentCandidates(page: OcrPage): StudentScanResult {
  const candidates: StudentScanCandidate[] = []
  let inPersonnelSection = false
  for (const line of parseTsv(page.tsv, page.text, page.confidence)) {
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
    const candidate = candidateFromLine(line)
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

function assetUrl(path: string) {
  return new URL(path, window.location.origin).href
}

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
  ) {
    progressListener = onProgress
    try {
      const worker = await getWorker()
      const result = await worker.recognize(
        image,
        { rotateAuto: true },
        { text: true, tsv: true },
      )
      return extractStudentCandidates(result.data)
    } finally {
      progressListener = undefined
    }
  }
}

export const studentScanProvider = new LocalTesseractStudentScanProvider()

export function scanStudents(
  image: Blob,
  onProgress?: (progress: StudentScanProgress) => void,
) {
  return studentScanProvider.scanStudents(image, onProgress)
}
