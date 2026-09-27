/**
 * The assistant path of the roster scan (V05). The operator sends the roster
 * photograph to an assistant of their own choice together with the prompt
 * below, then pastes the answer back. The app never contacts the assistant.
 *
 * The owner's warning is the design constraint: moving the difficulty from
 * reading an image to reading a non-deterministic answer would be an own goal.
 * So the format is small and stated by the app, and the parser is strict:
 * a line either matches the format exactly or it is reported as unparsed with
 * its text and the reason, never guessed into a student. Every parsed row
 * still needs the operator's check in the ordinary review.
 */
import { inferSex, type StudentScanCandidate } from "@/capabilities/studentScan"
import {
  calculateAge,
  isValidDateOnly,
  MAX_DECLARED_STUDENT_AGE,
} from "@/domain/student"

export const ROSTER_PASTE_BEGIN = "CVC-ALLIEVI v1"
export const ROSTER_PASTE_END = "FINE"
export const ROSTER_PASTE_COLUMNS = [
  "Cognome",
  "Nome",
  "Data di nascita",
  "Età",
  "Telefono",
] as const
export const ROSTER_PASTE_HEADER = ROSTER_PASTE_COLUMNS.join(";")

/**
 * The instructions the operator copies. The telephone column stays in the
 * format either way, so a row always has five fields; when the telephone was
 * not asked for, the assistant is told to leave it empty instead of copying
 * minors' numbers into its chat.
 */
export function rosterPastePrompt(options: { readPhone: boolean }) {
  return [
    "Leggi la foto allegata: è l'elenco degli allievi di un corso di vela.",
    "Rispondi SOLO con il blocco qui sotto, senza nessun testo prima o dopo e senza formattazione (niente Markdown, niente tabelle, niente ```).",
    "",
    ROSTER_PASTE_BEGIN,
    ROSTER_PASTE_HEADER,
    "(una riga per ogni allievo)",
    ROSTER_PASTE_END,
    "",
    "Regole:",
    `- Copia esattamente le righe ${ROSTER_PASTE_BEGIN}, ${ROSTER_PASTE_HEADER} e ${ROSTER_PASTE_END}.`,
    "- Una riga per ogni allievo, nell'ordine del foglio, con 5 campi separati da punto e virgola (;).",
    "- Ogni riga ha sempre 4 punti e virgola, anche quando gli ultimi campi sono vuoti. Esempio di riga senza età e senza telefono: Rossi;Anna;12/03/2010;;",
    "- Cognome e Nome come scritti sul foglio; un nome o cognome composto resta nel suo campo.",
    "- Data di nascita nel formato GG/MM/AAAA, con il giorno prima del mese.",
    "- Età: solo il numero degli anni, e solo se è scritta sul foglio. Non calcolarla.",
    options.readPhone
      ? "- Telefono: solo cifre, eventualmente con + iniziale."
      : "- Telefono: lascialo sempre vuoto.",
    "- Se un dato manca o non si legge con certezza, lascia il campo vuoto: non indovinare e non inventare.",
    "- Non includere istruttori, assistenti, volontari o altro personale.",
    "- Non aggiungere colonne, commenti, numeri di riga o righe vuote.",
  ].join("\n")
}

export interface UnparsedPasteLine {
  /** 1-based line number in the pasted answer. */
  line: number
  text: string
  reason: string
}

export interface RosterPasteResult {
  candidates: StudentScanCandidate[]
  unparsed: UnparsedPasteLine[]
  /** The block's closing line was found: the answer was not cut short. */
  complete: boolean
  /** No header line was found, so nothing was read as a student. */
  formatMissing: boolean
  /** More rows than ROSTER_PASTE_MAX_ROWS: nothing was read as a student. */
  tooLong?: boolean
}

const NAME_PATTERN = /^[\p{L}][\p{L}'’ .-]*$/u
// Words an assistant writes into a name field when it copies the header, a
// placeholder or a note. They are never a student's name.
const PLACEHOLDER_NAMES = new Set([
  "cognome",
  "nome",
  "nota",
  "note",
  "illeggibile",
  "sconosciuto",
  "sconosciuta",
  "nd",
  "nn",
  "non leggibile",
  "vuoto",
])

/** Rows read from one answer at most: a runaway answer is refused whole. */
export const ROSTER_PASTE_MAX_ROWS = 150
const DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/
const PHONE_PATTERN = /^\+?\d[\d ]{5,18}\d$/
// The whole value is a day, a month and a year: with dots, slashes or dashes
// (12.3.10, 12/03/2010), perhaps followed by an age, or with spaces only (01
// 02 10) and nothing after it, since "02 12 34 56" is a telephone in pairs.
// A telephone in more groups (02-12-34-56) and a four-digit last group that
// is no year are not dates.
const DATE_SHAPE =
  /^\d{1,2}\s*[./-]\s*\d{1,2}\s*[./-]\s*(?:\d{2}|(?:19|20)\d{2})(?:\s+\d{1,3})?$|^\d{1,2}\s+\d{1,2}\s+(?:\d{2}|(?:19|20)\d{2})$/u

/**
 * A number, however badly written, rather than an age, a date or a word:
 * telephone characters only, not a date's shape, at least four digits, and
 * either the length of a telephone number or no year in it (a date such as
 * 2010-03-12 or 12032010 has one).
 */
function looksLikePhone(value: string) {
  if (!/^[\d\s+\-./()]+$/u.test(value)) return false
  if (DATE_SHAPE.test(value)) return false
  const digits = value.replace(/\D/g, "")
  return (
    digits.length >= 4 && (digits.length >= 9 || !/(?:19|20)\d\d/.test(digits))
  )
}
// An assistant's way of writing an empty field.
const EMPTY_FIELD = /^(?:[-–—]|n\.?\s*d\.?|n\/d)$/iu

function normalizeLine(value: string) {
  return (
    value
      .normalize("NFC")
      // Zero-width marks and non-breaking or tab spaces copied from a chat.
      .replace(/\p{Cf}/gu, "")
      .replace(/\s/g, " ")
      .trim()
  )
}

function isFence(line: string) {
  // A fence may carry a lower-case language tag; a line such as ```Neri is a row.
  return /^`{3,}[a-z0-9-]*$/.test(line) || /^~{3,}[a-z0-9-]*$/.test(line)
}

function headerKey(line: string) {
  // A trailing separator and an apostrophe for the accent (Eta', Eta’) are
  // the assistant's or the keyboard's typography, not another format.
  return line
    .replace(/;\s*$/u, "")
    .replace(/['’]/gu, "")
    .split(";")
    .map((field) =>
      field
        .trim()
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLocaleLowerCase("it"),
    )
    .join(";")
}

// Case and accents are an assistant's typography, not a different format.
function isHeader(line: string) {
  return headerKey(line) === headerKey(ROSTER_PASTE_HEADER)
}

// Punctuation is ignored, so "N.N." and "Illeggibile." match too.
function nameKey(value: string) {
  return value
    .toLocaleLowerCase("it")
    .replace(/[^\p{L} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

function isPersonName(value: string) {
  return (
    NAME_PATTERN.test(value) &&
    !PLACEHOLDER_NAMES.has(nameKey(value)) &&
    (value.match(/\p{L}/gu) ?? []).length >= 2
  )
}

type RowResult =
  { ok: true; candidate: StudentScanCandidate } | { ok: false; reason: string }

/** One data line of the stated format, or the reason it is not one. */
export function parseRosterPasteRow(
  text: string,
  line: number,
  options: { courseStartDate: string; readPhone: boolean },
): RowResult {
  const fields = text
    .split(";")
    .map((field) => field.trim().replace(/\s+/g, " "))
  // A trailing separator adds an empty sixth field and nothing else.
  if (fields.length === 6 && fields[5] === "") fields.pop()
  // Assistants often drop empty trailing fields. Each column is checked for its
  // own kind below, so a shifted row still fails rather than being misread.
  if (fields.length < 3 || fields.length > ROSTER_PASTE_COLUMNS.length) {
    return {
      ok: false,
      reason: `${fields.length} campi invece di ${ROSTER_PASTE_COLUMNS.length}`,
    }
  }
  const [surname, firstName, ...optional] = fields as [
    string,
    string,
    ...string[],
  ]
  const [rawDate = "", rawAge = "", rawPhone = ""] = optional.map((field) =>
    EMPTY_FIELD.test(field) ? "" : field,
  )
  if (!isPersonName(surname)) return { ok: false, reason: "cognome non valido" }
  if (!isPersonName(firstName)) return { ok: false, reason: "nome non valido" }

  let dateOfBirth = ""
  if (rawDate) {
    const match = DATE_PATTERN.exec(rawDate)
    const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : ""
    if (!iso || !isValidDateOnly(iso)) {
      return { ok: false, reason: "data di nascita non valida (GG/MM/AAAA)" }
    }
    if (iso > options.courseStartDate) {
      return { ok: false, reason: "data di nascita dopo l'inizio del corso" }
    }
    dateOfBirth = iso
  }

  let age: number | null = null
  if (rawAge) {
    if (
      !/^\d{1,3}$/.test(rawAge) ||
      Number(rawAge) > MAX_DECLARED_STUDENT_AGE
    ) {
      return { ok: false, reason: "età non valida" }
    }
    age = Number(rawAge)
  }
  if (options.readPhone && rawPhone && !PHONE_PATTERN.test(rawPhone)) {
    return { ok: false, reason: "telefono non valido" }
  }
  // A telephone that was not asked for is ignored, even a malformed one, and
  // never a reason to refuse. Something that is no telephone at all (an age
  // one column too far, a word) is shown, so the value is not lost unseen.
  if (!options.readPhone && rawPhone && !looksLikePhone(rawPhone)) {
    return {
      ok: false,
      reason: `nella colonna Telefono c’è «${rawPhone}», che non è un telefono`,
    }
  }
  // With a date the age follows from it, and the date is what is stored. A
  // printed age is kept only when it disagrees, so the review shows the
  // conflict (a day and month swapped, a year misread) instead of hiding it.
  const keepAge =
    age !== null &&
    (!dateOfBirth || calculateAge(dateOfBirth, options.courseStartDate) !== age)

  return {
    ok: true,
    candidate: {
      sourceId: `paste-${line}`,
      firstName,
      surname,
      dateOfBirth,
      phone: options.readPhone ? rawPhone : "",
      sex: inferSex(firstName),
      // The assistant reports no confidence. The row warning makes every row
      // wait for the operator's check against the sheet, and the review shows
      // every value read, the birth date included.
      confidence: {
        firstName: 100,
        surname: 100,
        dateOfBirth: dateOfBirth ? 100 : 0,
        phone: options.readPhone && rawPhone ? 100 : 0,
      },
      ...(keepAge && age !== null
        ? { ageReading: { value: age, confidence: 100 } }
        : {}),
      rowWarning: "from-assistant",
    },
  }
}

/**
 * Reads a pasted answer. Text before the header and after the closing line
 * (an assistant's preface or apology) is reported, not read; code fences
 * around the block are ignored; a repeated header is skipped.
 */
export function parseRosterPaste(
  answer: string,
  options: { courseStartDate: string; readPhone: boolean },
): RosterPasteResult {
  const lines = answer.split(/\r\n|\r|\n/).map(normalizeLine)
  const headerIndex = lines.findIndex(isHeader)
  const candidates: StudentScanCandidate[] = []
  const unparsed: UnparsedPasteLine[] = []
  let complete = false

  if (headerIndex === -1) {
    lines.forEach((text, index) => {
      if (text && !isFence(text)) {
        unparsed.push({
          line: index + 1,
          text,
          reason: "fuori dal formato: manca la riga di intestazione",
        })
      }
    })
    return { candidates, unparsed, complete, formatMissing: true }
  }

  lines.forEach((text, index) => {
    const line = index + 1
    if (!text || isFence(text)) return
    if (index < headerIndex) {
      if (text !== ROSTER_PASTE_BEGIN) {
        unparsed.push({ line, text, reason: "testo prima del blocco" })
      }
      return
    }
    if (index === headerIndex || (!complete && isHeader(text))) return
    if (complete) {
      unparsed.push({ line, text, reason: "testo dopo la riga FINE" })
      return
    }
    if (text === ROSTER_PASTE_END) {
      complete = true
      return
    }
    const row = parseRosterPasteRow(text, line, options)
    if (row.ok) candidates.push(row.candidate)
    else unparsed.push({ line, text, reason: row.reason })
  })

  // Without the closing line the answer may have been cut mid-row: its last
  // row is not trusted as read, even when it happens to parse.
  if (!complete && candidates.length > 0) {
    const last = candidates.at(-1)!
    const lineNumber = Number(last.sourceId.slice("paste-".length))
    if (!unparsed.some(({ line }) => line > lineNumber)) {
      candidates.pop()
      unparsed.push({
        line: lineNumber,
        text: lines[lineNumber - 1] ?? "",
        reason: "forse troncata: manca la riga FINE",
      })
    }
  }

  if (candidates.length + unparsed.length > ROSTER_PASTE_MAX_ROWS) {
    return {
      candidates: [],
      unparsed: [],
      complete,
      formatMissing: false,
      tooLong: true,
    }
  }

  return { candidates, unparsed, complete, formatMissing: false }
}
