import type { StudentSex } from "@/domain/config"

export const MIN_SCAN_CONFIDENCE = 60
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

const DATE_PATTERN = /\b(\d{2})[./-](\d{2})[./-](\d{4})\b/
const PHONE_PATTERN = /(?:\+?39[ .-]*)?(?:\d[ .-]*){9,10}/
const NON_NAME_CHARACTERS = /[^\p{L}'’ -]/gu

function inferSex(firstName: string): StudentSex | null {
  const normalized = firstName.trim().toLocaleLowerCase("it")
  if (FEMALE_NAMES.has(normalized)) return "female"
  if (MALE_NAMES.has(normalized)) return "male"
  return null
}

function normalizeDate(match: RegExpMatchArray | null) {
  if (!match) return ""
  const [, day, month, year] = match
  const iso = `${year}-${month}-${day}`
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

function parseTsv(tsv: string | null, fallbackText: string) {
  if (!tsv) {
    return fallbackText
      .split(/\r?\n/)
      .map((text, index) => ({
        id: String(index),
        text: text.trim(),
        confidence: 0,
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

function candidateFromLine(line: RecognizedLine) {
  const dateMatch = line.text.match(DATE_PATTERN)
  const phoneSearchText = dateMatch
    ? `${line.text.slice(0, dateMatch.index)} ${line.text.slice(
        (dateMatch.index ?? 0) + dateMatch[0].length,
      )}`
    : line.text
  const phoneMatch = phoneSearchText.match(PHONE_PATTERN)
  const phoneInOriginal = phoneMatch
    ? line.text.indexOf(phoneMatch[0], (dateMatch?.index ?? -1) + 1)
    : -1

  if (!dateMatch && !phoneMatch) return null

  const fieldStart = Math.min(
    dateMatch?.index ?? Number.POSITIVE_INFINITY,
    phoneInOriginal >= 0 ? phoneInOriginal : Number.POSITIVE_INFINITY,
  )
  const rawName = line.text
    .slice(0, Number.isFinite(fieldStart) ? fieldStart : undefined)
    .replace(NON_NAME_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .trim()
  const nameParts = rawName.split(" ").filter(Boolean)
  const firstName = nameParts[0] ?? ""
  const surname = nameParts.slice(1).join(" ")
  const firstNameEnd = firstName.length
  const firstNameConfidence = firstName
    ? confidenceForRange(line, 0, firstNameEnd)
    : 0
  const surnameStart = rawName.indexOf(surname)
  const surnameConfidence = surname
    ? confidenceForRange(line, surnameStart, surnameStart + surname.length)
    : 0
  const dateConfidence = dateMatch
    ? confidenceForRange(
        line,
        dateMatch.index ?? 0,
        (dateMatch.index ?? 0) + dateMatch[0].length,
      )
    : 0
  const phoneConfidence =
    phoneMatch && phoneInOriginal >= 0
      ? confidenceForRange(
          line,
          phoneInOriginal,
          phoneInOriginal + phoneMatch[0].length,
        )
      : 0
  const normalizedDate = normalizeDate(dateMatch)

  const confidence = {
    firstName: firstNameConfidence,
    surname: surnameConfidence,
    dateOfBirth: normalizedDate ? dateConfidence : 0,
    phone: phoneConfidence,
  }

  return {
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
}

export function extractStudentCandidates(page: OcrPage): StudentScanResult {
  if (page.confidence < MIN_SCAN_CONFIDENCE) {
    return {
      aggregateConfidence: page.confidence,
      candidates: [],
      unsuitable: true,
    }
  }

  const candidates = parseTsv(page.tsv, page.text)
    .map(candidateFromLine)
    .filter((candidate): candidate is StudentScanCandidate =>
      Boolean(candidate),
    )

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
