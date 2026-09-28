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
import { isValidDateOnly, MAX_DECLARED_STUDENT_AGE } from "@/domain/student"

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
    "Rispondi SOLO con il blocco qui sotto, dentro un unico blocco di codice (```), senza nessun testo prima o dopo e senza altra formattazione Markdown.",
    "",
    "```",
    ROSTER_PASTE_BEGIN,
    ROSTER_PASTE_HEADER,
    "(una riga per ogni allievo)",
    ROSTER_PASTE_END,
    "```",
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
  /**
   * Aggregate, content-free facts about the answer, set whenever it is
   * refused as out of format. A phone paste can still fail in ways the owner
   * cannot see from here (a chat app's own quirks), so this is what the
   * operator can read back to us without ever pasting the roster itself.
   */
  diagnostics?: RosterPasteDiagnostics
}

export interface RosterPasteDiagnostics {
  /** Non-empty lines the parser found once it split the answer. */
  lineCount: number
  /** The header was not on a line of its own, but was found merged inside one. */
  headerFoundInline: boolean
  /** U+2028, U+2029 or NEL (U+0085) characters removed while splitting lines:
   * a phone copy path's own line terminators, invisible in a textarea. */
  unicodeSeparatorCount: number
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

// Every Unicode line terminator a phone or chat app's copy path can produce:
// CRLF/CR/LF, vertical tab, form feed, NEL (U+0085) and the Unicode line/
// paragraph separators (U+2028/U+2029). A textarea renders all of these as a
// line break, so the pasted text looks unchanged even though `\r\n|\r|\n`
// alone would read it as one long line.
const LINE_SEPARATOR = String.fromCharCode(8232) // U+2028
const PARAGRAPH_SEPARATOR = String.fromCharCode(8233) // U+2029
const LINE_SPLIT = new RegExp(
  `\\r\\n|[\\r\\n\\v\\f\\u0085${LINE_SEPARATOR}${PARAGRAPH_SEPARATOR}]`,
)
const UNICODE_LINE_SEPARATORS = new RegExp(
  `[\\u0085${LINE_SEPARATOR}${PARAGRAPH_SEPARATOR}]`,
  "gu",
)

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

/**
 * A chat app's own typography around an otherwise plain line: a trailing
 * backslash hard break, or the whole line wrapped in `**bold**`/`__bold__`.
 * Stripped before every other check, so a header, a row or FINE still
 * matches when a phone's copy path added it, exactly as case, accents and a
 * trailing separator already are for the header.
 */
function stripLineDecoration(line: string) {
  let value = line
  if (value.endsWith("\\")) value = value.slice(0, -1).trimEnd()
  const bold = /^(\*\*|__)(.+)\1$/.exec(value)
  if (bold) value = bold[2]!.trim()
  return value
}

function isFence(line: string) {
  // A fence may carry an info string in any case (```text, ```CSV, …); a
  // line such as ```Neri is a row, not a fence, and is left alone.
  return /^`{3,}[A-Za-z0-9-]*$/.test(line) || /^~{3,}[A-Za-z0-9-]*$/.test(line)
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

  // A printed age wins outright (owner decision 2026-09-28): the date is
  // only scaffolding for a missing age, so it is validated, and can reject
  // the row, only when there is no age to fall back on. A malformed or
  // impossible date next to a valid age is not even looked at.
  let dateOfBirth = ""
  if (age === null && rawDate) {
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
  // The paste is trusted (owner decision 2026-09-28): a printed age is always
  // taken as it stands, never compared against the date for a conflict, and
  // `dateOfBirth` above is already empty whenever one was read. The age is
  // what age-only mode stores; without a printed age, the date is what is
  // left to compute one from downstream (`studentScanAge`), so it stays on
  // the candidate.
  return {
    ok: true,
    candidate: {
      sourceId: `paste-${line}`,
      firstName,
      surname,
      dateOfBirth,
      phone: options.readPhone ? rawPhone : "",
      sex: inferSex(firstName),
      // The assistant reports no confidence, but the paste is trusted: every
      // field reads as fully confident, and no row needs its own check.
      confidence: {
        firstName: 100,
        surname: 100,
        dateOfBirth: dateOfBirth ? 100 : 0,
        phone: options.readPhone && rawPhone ? 100 : 0,
      },
      ...(age !== null ? { ageReading: { value: age, confidence: 100 } } : {}),
    },
  }
}

// Built from the stated columns so an accent, case or apostrophe difference
// in "Età" (already tolerated by `headerKey`) is tolerated here too, without
// needing to normalize the whole surrounding line just to search it.
const HEADER_INLINE_REGEX = new RegExp(
  ROSTER_PASTE_COLUMNS.map((column) =>
    column === "Età"
      ? "Et[aà]['’]?"
      : column.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"),
  ).join("\\s*;\\s*"),
  "iu",
)

/**
 * The header found merged inside a line instead of on one of its own: a
 * phone's copy path can turn every line break into a plain space, joining
 * the header, every row and FINE into one paragraph that still looks
 * unchanged in a textarea. Returns where the match starts and ends, so text
 * before it on the same line can be reported and the rows can be rebuilt
 * from what follows it.
 */
function findInlineHeaderEnd(
  lines: string[],
): { lineIndex: number; start: number; end: number } | null {
  for (let index = 0; index < lines.length; index += 1) {
    const match = HEADER_INLINE_REGEX.exec(lines[index]!)
    if (match) {
      return {
        lineIndex: index,
        start: match.index,
        end: match.index + match[0].length,
      }
    }
  }
  return null
}

type JoinedRowsResult =
  | { ok: true; rowTexts: string[]; complete: boolean; afterFineText: string }
  | { ok: false }

/**
 * Rebuilds a row's worth of `;`-separated fields from text whose line breaks
 * were all turned into spaces. `;` still separates the five fields of a row,
 * but the boundary between one row's telephone and the next row's surname is
 * only a space (the lost line break), so splitting the whole text on `;`
 * merges those two fields into one token every four tokens: exactly 4k+1
 * tokens for k rows. A single letter marks where the next surname starts
 * inside that merged token: before it must be a telephone number or nothing,
 * after it a valid name, or nothing here can be trusted apart.
 */
function reconstructJoinedRows(afterHeader: string): JoinedRowsResult {
  let body = afterHeader
  let complete = false
  let afterFineText = ""
  const fineMatches = [...body.matchAll(/\bFINE\b/gu)]
  const lastFine = fineMatches.at(-1)
  if (lastFine) {
    afterFineText = body.slice(lastFine.index + lastFine[0].length).trim()
    body = body.slice(0, lastFine.index)
    complete = true
  }

  const tokens = body.split(";")
  if ((tokens.length - 1) % 4 !== 0) return { ok: false }
  const rowCount = (tokens.length - 1) / 4
  if (rowCount < 1) return { ok: false }

  const rowTexts: string[] = []
  let surname = tokens[0]!.trim()
  for (let row = 0; row < rowCount; row += 1) {
    const base = 4 * row
    const firstName = tokens[base + 1]!.trim()
    const dateOfBirth = tokens[base + 2]!.trim()
    const age = tokens[base + 3]!.trim()
    const tail = tokens[base + 4]!
    if (row === rowCount - 1) {
      rowTexts.push(
        [surname, firstName, dateOfBirth, age, tail.trim()].join(";"),
      )
      break
    }
    const letter = /\p{L}/u.exec(tail)
    if (!letter) return { ok: false }
    const phone = tail.slice(0, letter.index).trim()
    const nextSurname = tail.slice(letter.index).trim()
    if (phone !== "" && !/^[\d\s+]+$/u.test(phone)) return { ok: false }
    if (!isPersonName(nextSurname)) return { ok: false }
    rowTexts.push([surname, firstName, dateOfBirth, age, phone].join(";"))
    surname = nextSurname
  }
  return { ok: true, rowTexts, complete, afterFineText }
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
  const lines = answer
    .split(LINE_SPLIT)
    .map(normalizeLine)
    .map(stripLineDecoration)
  const unicodeSeparatorCount = (answer.match(UNICODE_LINE_SEPARATORS) ?? [])
    .length
  const lineCount = lines.filter((text) => text !== "").length
  let headerIndex = lines.findIndex(isHeader)
  const candidates: StudentScanCandidate[] = []
  const unparsed: UnparsedPasteLine[] = []
  let complete = false

  if (headerIndex === -1) {
    const inline = findInlineHeaderEnd(lines)
    if (inline) {
      const headerLine = lines[inline.lineIndex]!
      const beforeOnHeaderLine = headerLine.slice(0, inline.start).trim()
      const afterHeaderLine = headerLine.slice(inline.end)

      // The recovery below only applies when row data was actually joined
      // onto the header's own line (a phone's line breaks turned to spaces,
      // still visible as row fields after the header). Otherwise the header
      // really is alone on its line, with ordinary preface text in front of
      // it on that same line, handled after this branch.
      if (afterHeaderLine.includes(";")) {
        // Text before the header, the way the normal path treats a line
        // before its own header line: reported unless it is the begin marker
        // or a fence. A phone's join can leave this on an earlier physical
        // line (a paragraph break that survived) or merged onto the header's
        // own line ahead of the match.
        const before: UnparsedPasteLine[] = []
        for (let index = 0; index < inline.lineIndex; index += 1) {
          const text = lines[index]!
          if (text && !isFence(text) && text !== ROSTER_PASTE_BEGIN) {
            before.push({
              line: index + 1,
              text,
              reason: "testo prima del blocco",
            })
          }
        }
        if (beforeOnHeaderLine && beforeOnHeaderLine !== ROSTER_PASTE_BEGIN) {
          before.push({
            line: inline.lineIndex + 1,
            text: beforeOnHeaderLine,
            reason: "testo prima del blocco",
          })
        }

        const rebuilt = reconstructJoinedRows(afterHeaderLine)
        if (rebuilt.ok) {
          const rows: UnparsedPasteLine[] = []
          let line = inline.lineIndex + 2
          for (const text of rebuilt.rowTexts) {
            const row = parseRosterPasteRow(text, line, options)
            if (row.ok) candidates.push(row.candidate)
            else rows.push({ line, text, reason: row.reason })
            line += 1
          }

          // Without the closing line the last rebuilt row may be a fragment
          // that never finished arriving: not trusted as read, exactly like
          // the normal path's own truncation check below.
          if (!rebuilt.complete && candidates.length > 0) {
            const last = candidates.at(-1)!
            const lineNumber = Number(last.sourceId.slice("paste-".length))
            if (!rows.some((entry) => entry.line > lineNumber)) {
              candidates.pop()
              rows.push({
                line: lineNumber,
                text: rebuilt.rowTexts.at(-1)!,
                reason: "forse troncata: manca la riga FINE",
              })
            }
          }

          // Text after FINE, the way the normal path treats a line after its
          // own closing line: leftover text still on the same joined line, or
          // a later physical line entirely (another paragraph break that
          // survived). Both continue this branch's own synthetic line count
          // rather than the real physical index, which would otherwise repeat
          // a number a rebuilt row already used.
          const after: UnparsedPasteLine[] = []
          if (rebuilt.complete) {
            if (rebuilt.afterFineText) {
              after.push({
                line,
                text: rebuilt.afterFineText,
                reason: "testo dopo la riga FINE",
              })
              line += 1
            }
            for (
              let index = inline.lineIndex + 1;
              index < lines.length;
              index += 1
            ) {
              const text = lines[index]!
              if (text && !isFence(text)) {
                after.push({ line, text, reason: "testo dopo la riga FINE" })
                line += 1
              }
            }
          }

          const allUnparsed = [...before, ...rows, ...after]
          if (candidates.length + allUnparsed.length > ROSTER_PASTE_MAX_ROWS) {
            return {
              candidates: [],
              unparsed: [],
              complete: rebuilt.complete,
              formatMissing: false,
              tooLong: true,
            }
          }
          return {
            candidates,
            unparsed: allUnparsed,
            complete: rebuilt.complete,
            formatMissing: false,
            diagnostics: {
              lineCount,
              headerFoundInline: true,
              unicodeSeparatorCount,
            },
          }
        }
        // The header is there, but its rows cannot be told apart safely: read
        // nothing, with the one reason that actually explains it.
        return {
          candidates: [],
          unparsed: [
            {
              line: inline.lineIndex + 1,
              text: lines[inline.lineIndex]!,
              reason:
                "gli a capo della risposta sono andati persi: copiala di nuovo con il tasto copia del blocco di codice, oppure incollala da un computer",
            },
          ],
          complete: false,
          formatMissing: true,
          diagnostics: {
            lineCount,
            headerFoundInline: true,
            unicodeSeparatorCount,
          },
        }
      }

      // The header is on a line of its own; the text in front of it on that
      // same line is an assistant's ordinary preface (unless it is only the
      // begin marker), reported like any other line before the block. Lines
      // before it, FINE, truncation and text after FINE all read through the
      // normal per-line path just below, exactly as when the header line
      // carries nothing else.
      if (beforeOnHeaderLine && beforeOnHeaderLine !== ROSTER_PASTE_BEGIN) {
        unparsed.push({
          line: inline.lineIndex + 1,
          text: beforeOnHeaderLine,
          reason: "testo prima del blocco",
        })
      }
      headerIndex = inline.lineIndex
    } else {
      lines.forEach((text, index) => {
        if (text && !isFence(text)) {
          unparsed.push({
            line: index + 1,
            text,
            reason: "fuori dal formato: manca la riga di intestazione",
          })
        }
      })
      return {
        candidates,
        unparsed,
        complete,
        formatMissing: true,
        diagnostics: {
          lineCount,
          headerFoundInline: false,
          unicodeSeparatorCount,
        },
      }
    }
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
