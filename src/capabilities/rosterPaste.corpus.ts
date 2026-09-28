/**
 * Malformed and well-formed assistant answers for the roster paste parser.
 * Every name is fictitious. Each case states the students that must be read
 * (surname, given name, birth date, age kept for review) and how many lines must be reported
 * as unparsed; no other student may appear.
 */
export interface RosterPasteCase {
  name: string
  answer: string
  students: Array<[string, string, string, number | null]>
  unparsed: number
  complete: boolean
  formatMissing?: boolean
}

const HEADER = "Cognome;Nome;Data di nascita;Età;Telefono"
const FENCE = "`".repeat(3)
const block = (...rows: string[]) =>
  ["CVC-ALLIEVI v1", HEADER, ...rows, "FINE"].join("\n")
// A phone's own line separator (F2): built from its code point, not a \u
// escape, since some tooling silently turns that escape back into the
// character itself.
const PHONE_LINE_SEPARATOR = String.fromCharCode(8232) // U+2028
const joinedIntoOneLine = (...rows: string[]) =>
  ["CVC-ALLIEVI v1", HEADER, ...rows, "FINE"].join(" ")

export const ROSTER_PASTE_CORPUS: RosterPasteCase[] = [
  {
    name: "the stated format",
    answer: block(
      "Veldor;Marta;12/03/2010;16;3331234567",
      "De Varni;Elsa Mirta;01/02/2011;15;",
      "Lo Bardino;Luca;;14;",
    ),
    students: [
      ["Veldor", "Marta", "", 16],
      ["De Varni", "Elsa Mirta", "", 15],
      ["Lo Bardino", "Luca", "", 14],
    ],
    unparsed: 0,
    complete: true,
  },
  {
    name: "prose before and a trailing apology after the block",
    answer: [
      "Ecco l'elenco richiesto:",
      block("Veldor;Marta;12/03/2010;16;"),
      "Spero sia utile! Scusa se qualche dato manca.",
    ].join("\n"),
    students: [["Veldor", "Marta", "", 16]],
    unparsed: 2,
    complete: true,
  },
  {
    name: "a code fence around the block",
    answer: [`${FENCE}text`, block("Veldor;Marta;12/03/2010;16;"), FENCE].join(
      "\n",
    ),
    students: [["Veldor", "Marta", "", 16]],
    unparsed: 0,
    complete: true,
  },
  {
    name: "smart quotes and an apostrophe in a surname",
    answer: block("D’Arvelo;Nives;05/06/2012;14;"),
    students: [["D’Arvelo", "Nives", "", 14]],
    unparsed: 0,
    complete: true,
  },
  {
    name: "a missing column",
    answer: block("Veldor;Marta;12/03/2010;3331234567", "Neri;Paolo;;15;"),
    students: [["Neri", "Paolo", "", 15]],
    unparsed: 1,
    complete: true,
  },
  {
    name: "an invented column",
    answer: block("Veldor;Marta;12/03/2010;16;;Deriva 2"),
    students: [],
    unparsed: 1,
    complete: true,
  },
  {
    name: "a repeated header inside the block",
    answer: block("Veldor;Marta;12/03/2010;16;", HEADER, "Neri;Paolo;;15;"),
    students: [
      ["Veldor", "Marta", "", 16],
      ["Neri", "Paolo", "", 15],
    ],
    unparsed: 0,
    complete: true,
  },
  {
    name: "an empty answer",
    answer: "",
    students: [],
    unparsed: 0,
    complete: false,
    formatMissing: true,
  },
  {
    name: "prose only, without the format",
    answer: "Non riesco a leggere bene la foto, puoi inviarne una più nitida?",
    students: [],
    unparsed: 1,
    complete: false,
    formatMissing: true,
  },
  {
    name: "a Markdown table instead of the format",
    answer: [
      "| Cognome | Nome | Data di nascita |",
      "|---|---|---|",
      "| Veldor | Marta | 12/03/2010 |",
    ].join("\n"),
    students: [],
    unparsed: 3,
    complete: false,
    formatMissing: true,
  },
  {
    name: "numbered rows",
    answer: block("1. Veldor;Marta;12/03/2010;16;", "2) Neri;Paolo;;15;"),
    students: [],
    unparsed: 2,
    complete: true,
  },
  {
    // F2R-2: a printed age wins outright, so a malformed or impossible date
    // next to one is not even looked at; only the row with no age at all
    // still needs a valid date, and a future date still fails it.
    name: "a malformed or impossible date next to a printed age is ignored; a future date with no age still fails",
    answer: block(
      "Veldor;Marta;2010-03-12;16;",
      "Neri;Paolo;31/02/2011;15;",
      "Rossa;Ada;01/01/2030;;",
    ),
    students: [
      ["Veldor", "Marta", "", 16],
      ["Neri", "Paolo", "", 15],
    ],
    unparsed: 1,
    complete: true,
  },
  {
    name: "an age written in words or out of range",
    answer: block("Veldor;Marta;;sedici;", "Neri;Paolo;;150;"),
    students: [],
    unparsed: 2,
    complete: true,
  },
  {
    name: "an answer cut short before FINE",
    answer: [
      "CVC-ALLIEVI v1",
      HEADER,
      "Veldor;Marta;12/03/2010;16;",
      "Neri;Pao",
    ].join("\n"),
    students: [["Veldor", "Marta", "", 16]],
    unparsed: 1,
    complete: false,
  },
  {
    name: "a note echoed from the prompt and a comment row",
    answer: block(
      "(una riga per ogni allievo)",
      "Veldor;Marta;;16;",
      "Nota: il foglio era sfocato",
    ),
    students: [["Veldor", "Marta", "", 16]],
    unparsed: 2,
    complete: true,
  },
  {
    name: "a header without accents and a trailing separator",
    answer: [
      "CVC-ALLIEVI v1",
      "cognome;nome;data di nascita;eta;telefono",
      "Veldor;Marta;12/03/2010;16;;",
      "FINE",
    ].join("\n"),
    students: [["Veldor", "Marta", "", 16]],
    unparsed: 0,
    complete: true,
  },
  {
    name: "an empty surname or a digit in a name",
    answer: block(";Marta;;16;", "Veld0r;Marta;;16;"),
    students: [],
    unparsed: 2,
    complete: true,
  },
  {
    name: "text after FINE that looks like a row",
    answer: [block("Veldor;Marta;;16;"), "Neri;Paolo;;15;"].join("\n"),
    students: [["Veldor", "Marta", "", 16]],
    unparsed: 1,
    complete: true,
  },
  {
    name: "Windows line endings and non-breaking spaces",
    answer: block("Veldor; Marta;12/03/2010;16;").replace(/\n/g, "\r\n"),
    students: [["Veldor", "Marta", "", 16]],
    unparsed: 0,
    complete: true,
  },
  {
    name: "day and month swapped against a printed age",
    answer: block("Veldor;Marta;03/12/2010;16;"),
    // The paste is trusted (owner decision 2026-09-28): the printed age wins
    // regardless of what the date would have given, and the date itself is
    // never carried on the candidate, so a swapped day and month never shows
    // up as a conflict to resolve.
    students: [["Veldor", "Marta", "", 16]],
    unparsed: 0,
    complete: true,
  },
  {
    name: "empty trailing fields dropped by the assistant",
    answer: block("Veldor;Marta;12/03/2010", "Neri;Paolo;;15"),
    students: [
      ["Veldor", "Marta", "2010-03-12", null],
      ["Neri", "Paolo", "", 15],
    ],
    unparsed: 0,
    complete: true,
  },
  {
    name: "header words and a note written as names",
    answer: block("Cognome;Nome;;;", "Nota;riga illeggibile;;;"),
    students: [],
    unparsed: 2,
    complete: true,
  },
  {
    name: "the last row of an answer cut short",
    answer: [
      "CVC-ALLIEVI v1",
      HEADER,
      "Veldor;Marta;12/03/2010;16;",
      "Neri;Paolo;01/02/2011;15;",
    ].join("\n"),
    students: [["Veldor", "Marta", "", 16]],
    unparsed: 1,
    complete: false,
  },
  {
    name: "a row that starts like a code fence",
    answer: block(`${FENCE}Neri;Paolo;;15;`),
    students: [],
    unparsed: 1,
    complete: true,
  },
  {
    name: "placeholders written with punctuation or a single letter",
    answer: block(
      "N.N.;Marta;;12;",
      "X;Y;;16;",
      "Non leggibile;Marta;;16;",
      "Veldor;Illeggibile.;;16;",
    ),
    students: [],
    unparsed: 4,
    complete: true,
  },
  {
    name: "a header with a trailing separator and an apostrophe accent",
    answer: [
      "CVC-ALLIEVI v1",
      "Cognome;Nome;Data di nascita;Eta';Telefono;",
      "Neri;Paolo;;15;",
      "FINE",
    ].join("\n"),
    students: [["Neri", "Paolo", "", 15]],
    unparsed: 0,
    complete: true,
  },
  {
    name: "a header typed with a typographic apostrophe",
    answer: [
      "CVC-ALLIEVI v1",
      "Cognome;Nome;Data di nascita;Eta’;Telefono",
      "Neri;Paolo;;15;",
      "FINE",
    ].join("\n"),
    students: [["Neri", "Paolo", "", 15]],
    unparsed: 0,
    complete: true,
  },
  {
    name: "an age written one column too far with the telephone off",
    answer: block("Veldor;Marta;;;16"),
    students: [],
    unparsed: 1,
    complete: true,
  },
  {
    name: "a dash or N/D written for an empty field",
    answer: block("Veldor;Marta;12/03/2010;-;N/D", "Neri;Paolo;—;15;-"),
    students: [
      ["Veldor", "Marta", "2010-03-12", null],
      ["Neri", "Paolo", "", 15],
    ],
    unparsed: 0,
    complete: true,
  },
  {
    name: "a birth date one column too far with the telephone off",
    answer: block("Veldor;Marta;;16;12/03/2010"),
    students: [],
    unparsed: 1,
    complete: true,
  },
  {
    name: "a birth date in another format one column too far, telephone off",
    answer: block(
      "Veldor;Marta;;16;2010-03-12",
      "Neri;Paolo;;15;12 / 03 / 2011",
      "Verdani;Sara;;14;12032012",
      "Galli;Ada;;13;12.3.13",
      "Bardino;Luca;;12;01 02 14",
    ),
    students: [],
    unparsed: 5,
    complete: true,
  },
  {
    name: "a telephone in groups with the telephone off is ignored",
    answer: block(
      "Veldor;Marta;;16;0789.12.34.56",
      "Neri;Paolo;;15;02-12-34-56",
      "Galli;Ada;;13;06 12 34 56",
    ),
    students: [
      ["Veldor", "Marta", "", 16],
      ["Neri", "Paolo", "", 15],
      ["Galli", "Ada", "", 13],
    ],
    unparsed: 0,
    complete: true,
  },
  {
    // F2: the ChatGPT app's copy button on Android can deliver U+2028 line
    // separators; a textarea still renders each as a line break, so the
    // pasted text looks unchanged.
    name: "U+2028 line separators from a phone's copy path",
    answer: [
      "CVC-ALLIEVI v1",
      HEADER,
      "Veldor;Marta;12/03/2010;16;",
      "Neri;Paolo;01/02/2011;15;",
      "FINE",
    ].join(PHONE_LINE_SEPARATOR),
    students: [
      ["Veldor", "Marta", "", 16],
      ["Neri", "Paolo", "", 15],
    ],
    unparsed: 0,
    complete: true,
  },
  {
    name: "bold-wrapped lines and a trailing backslash hard break",
    answer: [
      "**CVC-ALLIEVI v1**",
      "__Cognome;Nome;Data di nascita;Età;Telefono__",
      "Veldor;Marta;12/03/2010;16;\\",
      "**FINE**",
    ].join("\n"),
    students: [["Veldor", "Marta", "", 16]],
    unparsed: 0,
    complete: true,
  },
  {
    name: "a fence with an uppercase info string",
    answer: ["```TEXT", block("Veldor;Marta;12/03/2010;16;"), "```"].join("\n"),
    students: [["Veldor", "Marta", "", 16]],
    unparsed: 0,
    complete: true,
  },
  {
    // F2: a phone or chat app can turn every line break into a plain space,
    // joining the header, every row and FINE into one paragraph that still
    // looks unchanged in a textarea. The parser rebuilds the rows from the
    // fixed five-field structure.
    name: "every line break turned into a space, with a telephone in each row",
    answer: joinedIntoOneLine(
      "Veldor;Marta;12/03/2010;16;3331234567",
      "Neri;Paolo;01/02/2011;15;3339876543",
    ),
    students: [
      ["Veldor", "Marta", "", 16],
      ["Neri", "Paolo", "", 15],
    ],
    unparsed: 0,
    complete: true,
  },
  {
    name: "every line break turned into a space, with empty telephones",
    answer: joinedIntoOneLine(
      "Veldor;Marta;12/03/2010;16;",
      "Neri;Paolo;01/02/2011;15;",
    ),
    students: [
      ["Veldor", "Marta", "", 16],
      ["Neri", "Paolo", "", 15],
    ],
    unparsed: 0,
    complete: true,
  },
  {
    name: "every line break turned into a space, with a surname containing a space",
    answer: joinedIntoOneLine(
      "Veldor;Marta;12/03/2010;16;",
      "De Luca;Elsa;01/02/2011;15;",
    ),
    students: [
      ["Veldor", "Marta", "", 16],
      ["De Luca", "Elsa", "", 15],
    ],
    unparsed: 0,
    complete: true,
  },
  {
    // The boundary token has no letter at all to split on (nothing readable
    // as the next row's surname), so nothing here can be trusted apart.
    name: "joined line breaks where a boundary has no next surname to find",
    answer: joinedIntoOneLine(
      "Veldor;Marta;12/03/2010;16;999",
      "888;Paolo;01/02/2011;15;777",
    ),
    students: [],
    unparsed: 1,
    complete: false,
    formatMissing: true,
  },
  {
    // A missing separator shifts every field after it, so the total token
    // count no longer divides into whole rows: nothing is read from it.
    name: "joined line breaks where the field count no longer divides into rows",
    answer: joinedIntoOneLine(
      "Veldor;Marta;12/03/2010;16 Neri;Paolo;01/02/2011;15;",
    ),
    students: [],
    unparsed: 1,
    complete: false,
    formatMissing: true,
  },
]
