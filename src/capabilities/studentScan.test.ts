import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  applyStudentNameOrder,
  inferStudentNameOrder,
  extractStudentCandidates,
  MIN_FIELD_CONFIDENCE,
  studentScanAge,
  studentScanAgeCorroborated,
} from "@/capabilities/studentScan"

describe("independent printed age", () => {
  function readAgeRow(text: string) {
    return extractStudentCandidates({ text, tsv: null, confidence: 65 })
      .candidates[0]!
  }

  it.each([
    ["Mario Rossi 24 anni - 12/02/2002", true],
    ["Mario Rossi 23 anni - 12/02/2002", true],
    ["Mario Rossi 25 anni - 12/02/2002", true],
    ["Mario Rossi 22 anni - 12/02/2002", false],
    ["Mario Rossi 24 anni - 31/02/2002", false],
    ["Mario Rossi 0 anni - 02/02/2027", false],
    ["Mario Rossi 12/02/2002", false],
    ["Mario Rossi 24 anni", false],
  ])("corroborates only valid agreement: %s", (text, expected) => {
    const read = readAgeRow(text)
    // A reliable printed age, as it must be to vouch for the date.
    const candidate = read.ageReading
      ? { ...read, ageReading: { ...read.ageReading, confidence: 90 } }
      : read
    expect(studentScanAgeCorroborated(candidate, "2026-08-29")).toBe(expected)
    expect(candidate.confidence.dateOfBirth).toBe(
      candidate.dateOfBirth ? 65 : 0,
    )
    expect(MIN_FIELD_CONFIDENCE).toBe(70)
  })

  it("never lets an uncertain printed age vouch for an uncertain date", () => {
    const candidate = readAgeRow("Mario Rossi 24 anni - 12/02/2002")
    expect(candidate.ageReading!.confidence).toBeLessThan(MIN_FIELD_CONFIDENCE)
    expect(candidate.confidence.dateOfBirth).toBeLessThan(MIN_FIELD_CONFIDENCE)
    expect(studentScanAgeCorroborated(candidate, "2026-08-29")).toBe(false)
  })

  it("reports the independently read age while retaining the stored date", () => {
    const candidate = readAgeRow("Mario Rossi 23 anni - 12/02/2002")
    expect(candidate.ageReading).toEqual({ value: 23, confidence: 65 })
    expect(studentScanAge(candidate, "2026-08-29")).toBe(23)
    expect(candidate.dateOfBirth).toBe("2002-02-12")
  })

  it("keeps an age-only reading without inventing a birth date", () => {
    const candidate = readAgeRow("Mario Rossi 24 anni")
    expect(studentScanAge(candidate, "2026-08-29")).toBe(24)
    expect(candidate.dateOfBirth).toBe("")
    expect(candidate.surname).toBe("Rossi")
  })

  it("measures the age independently of a low-confidence date", () => {
    const candidate = extractStudentCandidates({
      text: "Mario Rossi 24 anni 12/02/2002",
      confidence: 80,
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "Mario", confidence: 95 },
          { text: "Rossi", confidence: 93 },
          { text: "24", confidence: 97 },
          { text: "anni", confidence: 95 },
          { text: "12/02/2002", confidence: 44 },
        ]),
      ].join("\n"),
    }).candidates[0]!
    expect(candidate.ageReading).toEqual({ value: 24, confidence: 97 })
    expect(candidate.confidence.dateOfBirth).toBe(44)
    expect(studentScanAgeCorroborated(candidate, "2026-08-29")).toBe(true)
  })
})

describe("sheet name-order vote", () => {
  it.each([
    ["Rossi Mario\nBianchi Gianluca\nDe Angelis Luca", "surname-given", 0, 3],
    ["Mario Rossi\nGianluca Bianchi\nLuca De Angelis", "given-surname", 3, 0],
    ["Andrea Luca\nNicola Mattia", "unknown", 2, 2],
    ["Smith Chris\nJones Alex", "unknown", 0, 0],
    ["Rossi Mario", "unknown", 0, 1],
    ["Liosca Caterina\nBianchi Giulia", "surname-given", 1, 2],
  ] as const)("votes on %s", (text, order, firstWordVotes, lastWordVotes) => {
    const { candidates } = extractStudentCandidates({
      text,
      tsv: null,
      confidence: 95,
    })
    expect(inferStudentNameOrder(candidates)).toEqual({
      order,
      firstWordVotes,
      lastWordVotes,
    })
  })

  it("suggests male for Gianluca and preserves a low-confidence name", () => {
    const { candidates } = extractStudentCandidates({
      text: "Rossi Gianluca",
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "Rossi", confidence: 50 },
          { text: "Gianluca", confidence: 95 },
        ]),
      ].join("\n"),
      confidence: 80,
    })
    const result = applyStudentNameOrder(candidates[0]!, "surname-given")
    expect(result.sex).toBe("male")
    expect(result.surname).toBe("Rossi")
    expect(result.confidence.surname).toBe(50)
  })

  it("suggests male for Gianluca and preserves a low-confidence name", () => {
    const { candidates } = extractStudentCandidates({
      text: "Rovelli Gianluca",
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "Rovelli", confidence: 50 },
          { text: "Gianluca", confidence: 95 },
        ]),
      ].join("\n"),
      confidence: 80,
    })
    const result = applyStudentNameOrder(candidates[0]!, "surname-given")
    expect(result.sex).toBe("male")
    expect(result.surname).toBe("Rovelli")
    expect(result.confidence.surname).toBe(50)
  })

  it("resolves two exact given-name cues in a surname-first triplet", () => {
    const { candidates } = extractStudentCandidates({
      text: "Mancini Andrea Luca",
      tsv: null,
      confidence: 95,
    })
    const result = applyStudentNameOrder(candidates[0]!, "surname-given")
    expect(result.firstName).toBe("Andrea Luca")
    expect(result.surname).toBe("Mancini")
    expect(result.nameReading?.raw).toBe("Mancini Andrea Luca")
    expect(result.nameReading?.compoundAmbiguity).toBe(false)
    expect(result.sex).toBe("male")
  })

  it("keeps a conflicting particle triplet visible for review", () => {
    const { candidates } = extractStudentCandidates({
      text: "De Andrea Luca",
      tsv: null,
      confidence: 95,
    })
    const result = applyStudentNameOrder(candidates[0]!, "surname-given")
    expect(result.nameReading?.raw).toBe("De Andrea Luca")
    expect(result.nameReading?.compoundAmbiguity).toBe(true)
    expect([result.firstName, result.surname].join(" ")).toContain("Andrea")
  })

  it("requires review for an unproven four-word given-first split", () => {
    const { candidates } = extractStudentCandidates({
      text: "Esempiocinque Esempiotrenta Esempioquarantasei Esempiootto",
      tsv: null,
      confidence: 95,
    })
    const result = applyStudentNameOrder(candidates[0]!, "given-surname")
    expect(result.nameReading?.raw).toBe(
      "Esempiocinque Esempiotrenta Esempioquarantasei Esempiootto",
    )
    expect(result.nameReading?.compoundAmbiguity).toBe(true)
    expect([result.firstName, result.surname].join(" ")).toBe(
      "Esempiocinque Esempiotrenta Esempioquarantasei Esempiootto",
    )
  })
})

function tsvLine(
  line: number,
  words: Array<{ text: string; confidence: number }>,
) {
  return words
    .map(
      ({ text, confidence }, word) =>
        `5\t1\t1\t1\t${line}\t${word + 1}\t0\t0\t10\t10\t${confidence}\t${text}`,
    )
    .join("\n")
}

/** A row whose words carry real page coordinates, as a photographed table does. */
function tsvPlacedLine(
  line: number,
  words: Array<{
    text: string
    confidence: number
    left: number
    width: number
  }>,
) {
  return words
    .map(
      ({ text, confidence, left, width }, word) =>
        `5\t1\t1\t1\t${line}\t${word + 1}\t${left}\t0\t${width}\t20\t${confidence}\t${text}`,
    )
    .join("\n")
}

const HEADER =
  "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext"

describe("student scan extraction", () => {
  it("extracts multi-word surnames, dates, phones and cautious sex suggestions", () => {
    const result = extractStudentCandidates({
      confidence: 94,
      text: "Mario Rossi 12/03/2008 333 123 4567\nLuca De Angelis 05/07/2004 320 555 0142",
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "Mario", confidence: 96 },
          { text: "Rossi", confidence: 95 },
          { text: "12/03/2008", confidence: 96 },
          { text: "333", confidence: 94 },
          { text: "123", confidence: 95 },
          { text: "4567", confidence: 96 },
        ]),
        tsvLine(2, [
          { text: "Luca", confidence: 97 },
          { text: "De", confidence: 96 },
          { text: "Angelis", confidence: 95 },
          { text: "05/07/2004", confidence: 97 },
          { text: "320", confidence: 96 },
          { text: "555", confidence: 96 },
          { text: "0142", confidence: 95 },
        ]),
      ].join("\n"),
    })

    expect(result).toEqual(
      expect.objectContaining({ unsuitable: false, aggregateConfidence: 94 }),
    )
    expect(result.candidates).toEqual([
      expect.objectContaining({
        firstName: "Mario",
        surname: "Rossi",
        dateOfBirth: "2008-03-12",
        phone: "333 123 4567",
        sex: "male",
      }),
      expect.objectContaining({
        firstName: "Luca",
        surname: "De Angelis",
        dateOfBirth: "2004-07-05",
        phone: "320 555 0142",
        sex: "male",
      }),
    ])
  })

  it("keeps an uncertain field's text and reports it as uncertain", () => {
    const result = extractStudentCandidates({
      confidence: 78,
      text: "Giulia Bianchl 24/11/1998 347 765 4321",
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "Giulia", confidence: 92 },
          { text: "Bianchl", confidence: MIN_FIELD_CONFIDENCE - 1 },
          { text: "24/11/1998", confidence: 55 },
          { text: "347", confidence: 90 },
          { text: "765", confidence: 91 },
          { text: "4321", confidence: 92 },
        ]),
      ].join("\n"),
    })

    expect(result.unsuitable).toBe(false)
    // The review screen corrects what the scan read, so an uncertain reading
    // is offered rather than blanked. Its confidence stays below the threshold
    // so the screen can mark it "Da controllare".
    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        firstName: "Giulia",
        surname: "Bianchl",
        dateOfBirth: "1998-11-24",
        phone: "347 765 4321",
        sex: "female",
      }),
    )
    expect(result.candidates[0]!.confidence.surname).toBeLessThan(
      MIN_FIELD_CONFIDENCE,
    )
    expect(result.candidates[0]!.confidence.dateOfBirth).toBeLessThan(
      MIN_FIELD_CONFIDENCE,
    )
  })

  it("keeps independently reliable partial rows without joining adjacent people data", () => {
    const result = extractStudentCandidates({
      confidence: 88,
      text: "Mario Rossi\n12/03/2008",
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "Mario", confidence: 95 },
          { text: "Rossi", confidence: 94 },
        ]),
        tsvLine(2, [{ text: "12/03/2008", confidence: 96 }]),
      ].join("\n"),
    })

    expect(result.unsuitable).toBe(false)
    expect(result.candidates).toEqual([
      expect.objectContaining({
        firstName: "Mario",
        surname: "Rossi",
        dateOfBirth: "",
        phone: "",
        sex: "male",
      }),
      expect.objectContaining({
        firstName: "",
        surname: "",
        dateOfBirth: "2008-03-12",
        phone: "",
        sex: null,
      }),
    ])
  })

  it("retains strong row fields even when aggregate page confidence is low", () => {
    const result = extractStudentCandidates({
      confidence: 52,
      text: "Giulia Bianchi 24/11/1998",
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "Giulia", confidence: 94 },
          { text: "Bianchi", confidence: 93 },
          { text: "24/11/1998", confidence: 95 },
        ]),
      ].join("\n"),
    })

    expect(result).toEqual(
      expect.objectContaining({
        aggregateConfidence: 52,
        unsuitable: false,
      }),
    )
    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        firstName: "Giulia",
        surname: "Bianchi",
        dateOfBirth: "1998-11-24",
      }),
    )
  })

  it("extracts structured fields before a name without crossing the OCR row", () => {
    const result = extractStudentCandidates({
      confidence: 93,
      text: "320 555 0142 05/07/2004 Luca De Angelis",
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "320", confidence: 94 },
          { text: "555", confidence: 95 },
          { text: "0142", confidence: 94 },
          { text: "05/07/2004", confidence: 96 },
          { text: "Luca", confidence: 97 },
          { text: "De", confidence: 96 },
          { text: "Angelis", confidence: 95 },
        ]),
      ].join("\n"),
    })

    expect(result.candidates).toEqual([
      expect.objectContaining({
        firstName: "Luca",
        surname: "De Angelis",
        dateOfBirth: "2004-07-05",
        phone: "320 555 0142",
      }),
    ])
  })

  it("normalizes short-form dates and ignores standalone status columns", () => {
    const result = extractStudentCandidates({
      confidence: 92,
      text: "7 M Anna Riva 5/7/2004 OK",
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "7", confidence: 95 },
          { text: "M", confidence: 95 },
          { text: "Anna", confidence: 96 },
          { text: "Riva", confidence: 96 },
          { text: "5/7/2004", confidence: 96 },
          { text: "OK", confidence: 96 },
        ]),
      ].join("\n"),
    })

    expect(result.candidates).toEqual([
      expect.objectContaining({
        firstName: "Anna",
        surname: "Riva",
        dateOfBirth: "2004-07-05",
      }),
    ])
  })

  it("rejects obvious headings, contacts, footers and personnel sections", () => {
    const result = extractStudentCandidates({
      confidence: 94,
      text: [
        "Corso D2 - Elenco allievi",
        "NOME COGNOME DATA DI NASCITA TELEFONO",
        "Mario Rossi 12/03/2008 333 123 4567",
        "Contatti Marco Bianchi 347 765 4321",
        "Data stampa 08/09/2026",
        "Centro Velico Caprera",
        "PERSONALE",
        "ADV Paolo Verdi 07/06/1980 320 555 0142",
        "ALLIEVI",
        "Giulia Neri 24/11/1998",
      ].join("\n"),
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "Corso", confidence: 98 },
          { text: "D2", confidence: 98 },
          { text: "Elenco", confidence: 98 },
          { text: "allievi", confidence: 98 },
        ]),
        tsvLine(2, [
          { text: "NOME", confidence: 98 },
          { text: "COGNOME", confidence: 98 },
          { text: "DATA", confidence: 98 },
          { text: "DI", confidence: 98 },
          { text: "NASCITA", confidence: 98 },
          { text: "TELEFONO", confidence: 98 },
        ]),
        tsvLine(3, [
          { text: "Mario", confidence: 96 },
          { text: "Rossi", confidence: 95 },
          { text: "12/03/2008", confidence: 96 },
          { text: "333", confidence: 94 },
          { text: "123", confidence: 95 },
          { text: "4567", confidence: 96 },
        ]),
        tsvLine(4, [
          { text: "Contatti", confidence: 96 },
          { text: "Marco", confidence: 96 },
          { text: "Bianchi", confidence: 96 },
          { text: "347", confidence: 96 },
          { text: "765", confidence: 96 },
          { text: "4321", confidence: 96 },
        ]),
        tsvLine(5, [
          { text: "Data", confidence: 96 },
          { text: "stampa", confidence: 96 },
          { text: "08/09/2026", confidence: 96 },
        ]),
        tsvLine(6, [
          { text: "Centro", confidence: 98 },
          { text: "Velico", confidence: 98 },
          { text: "Caprera", confidence: 98 },
        ]),
        tsvLine(7, [{ text: "PERSONALE", confidence: 98 }]),
        tsvLine(8, [
          { text: "ADV", confidence: 97 },
          { text: "Paolo", confidence: 97 },
          { text: "Verdi", confidence: 97 },
          { text: "07/06/1980", confidence: 97 },
          { text: "320", confidence: 97 },
          { text: "555", confidence: 97 },
          { text: "0142", confidence: 97 },
        ]),
        tsvLine(9, [{ text: "ALLIEVI", confidence: 98 }]),
        tsvLine(10, [
          { text: "Giulia", confidence: 97 },
          { text: "Neri", confidence: 97 },
          { text: "24/11/1998", confidence: 97 },
        ]),
      ].join("\n"),
    })

    expect(result.candidates).toHaveLength(2)
    expect(result.candidates).toEqual([
      expect.objectContaining({ firstName: "Mario", surname: "Rossi" }),
      expect.objectContaining({ firstName: "Giulia", surname: "Neri" }),
    ])
  })

  it("keeps low-confidence name text available for review", () => {
    const result = extractStudentCandidates({
      confidence: 53,
      text: "Maro Ree 12032008 333 123 4567",
      tsv: null,
    })
    expect(result.aggregateConfidence).toBe(53)
    expect(result.unsuitable).toBe(false)
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]?.nameReading?.raw).toBe("Maro Ree")
  })

  it("keeps the telephone and age columns out of the name when words carry coordinates", () => {
    const row = (line: number, surname: string, given: string, phone: string) =>
      tsvPlacedLine(line, [
        { text: surname, confidence: 92, left: 100, width: 80 },
        { text: given, confidence: 92, left: 190, width: 70 },
        { text: phone, confidence: 90, left: 400, width: 140 },
        { text: "24", confidence: 88, left: 560, width: 24 },
        { text: "anni", confidence: 88, left: 590, width: 40 },
        { text: "-", confidence: 80, left: 636, width: 8 },
        { text: "12/02/2002", confidence: 91, left: 650, width: 120 },
      ])

    const result = extractStudentCandidates({
      confidence: 90,
      text: "",
      tsv: [
        HEADER,
        row(1, "Feriani", "Massimo", "3990000006"),
        row(2, "Vernuzzi", "Edoardo", "3990000012"),
        row(3, "Rovellini", "Paolo", "3990000016"),
      ].join("\n"),
    })

    expect(result.candidates).toHaveLength(3)
    for (const candidate of result.candidates) {
      expect(candidate.surname).not.toMatch(/anni/i)
      expect(candidate.surname).not.toMatch(/\d/)
      expect(candidate.firstName).not.toMatch(/\d/)
    }
    expect(result.candidates[0]?.firstName).toBe("Feriani")
    expect(result.candidates[0]?.surname).toBe("Massimo")
    expect(result.candidates[0]?.dateOfBirth).toBe("2002-02-12")
  })

  it("drops the staff block, including a role code the table rule smudged", () => {
    const student = (line: number, surname: string, given: string) =>
      tsvPlacedLine(line, [
        { text: surname, confidence: 92, left: 100, width: 80 },
        { text: given, confidence: 92, left: 190, width: 70 },
        { text: "3990000006", confidence: 90, left: 400, width: 140 },
        { text: "anni", confidence: 88, left: 590, width: 40 },
        { text: "12/02/2002", confidence: 91, left: 650, width: 120 },
      ])
    const staff = (
      line: number,
      surname: string,
      given: string,
      role: string,
    ) =>
      tsvPlacedLine(line, [
        { text: surname, confidence: 92, left: 100, width: 80 },
        { text: given, confidence: 92, left: 190, width: 70 },
        { text: role, confidence: 86, left: 300, width: 40 },
        { text: "3990000021", confidence: 90, left: 400, width: 140 },
        { text: "anni", confidence: 88, left: 590, width: 40 },
        { text: "14/04/1997", confidence: 91, left: 650, width: 120 },
      ])

    const result = extractStudentCandidates({
      confidence: 90,
      text: "",
      tsv: [
        HEADER,
        student(1, "Feriani", "Massimo"),
        student(2, "Vernuzzi", "Edoardo"),
        student(3, "Rovellini", "Paolo"),
        staff(4, "Ferombo", "Marco", "ADV"),
        staff(5, "Erba", "Prinaldo", "ICT"),
      ].join("\n"),
    })

    expect(result.candidates).toHaveLength(3)
    expect(
      result.candidates.map((candidate) => candidate.firstName),
    ).not.toContain("Ferombo")
    expect(
      result.candidates.map((candidate) => candidate.firstName),
    ).not.toContain("Erba")
  })

  it("reads a name without deciding whether the surname came first", () => {
    const result = extractStudentCandidates({
      confidence: 92,
      text: "Veldor Valeria",
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "Veldor", confidence: 93 },
          { text: "Valeria", confidence: 94 },
          { text: "11/07/1986", confidence: 92 },
        ]),
      ].join("\n"),
    })

    const [candidate] = result.candidates
    expect(candidate?.nameReading).toEqual({
      raw: "Veldor Valeria",
      words: [
        { text: "Veldor", confidence: 93 },
        { text: "Valeria", confidence: 94 },
      ],
      order: "unknown",
      compoundAmbiguity: false,
      acknowledged: false,
    })
  })

  it("splits a two-word reading both ways from the words as read", () => {
    const result = extractStudentCandidates({
      confidence: 92,
      text: "Veldor Valeria",
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "Veldor", confidence: 93 },
          { text: "Valeria", confidence: 94 },
        ]),
      ].join("\n"),
    })
    const candidate = result.candidates[0]!

    const surnameFirst = applyStudentNameOrder(candidate, "surname-given")
    expect(surnameFirst).toEqual(
      expect.objectContaining({ firstName: "Valeria", surname: "Veldor" }),
    )

    // Re-deriving from the same reading, so applying an order is idempotent
    // and reversible rather than a blind exchange of the two fields.
    expect(applyStudentNameOrder(surnameFirst, "surname-given")).toEqual(
      expect.objectContaining({ firstName: "Valeria", surname: "Veldor" }),
    )
    expect(applyStudentNameOrder(surnameFirst, "given-surname")).toEqual(
      expect.objectContaining({ firstName: "Veldor", surname: "Valeria" }),
    )
  })

  it("keeps a surname particle attached when the sheet is surname first", () => {
    const result = extractStudentCandidates({
      confidence: 92,
      text: "De veltri Gregorio",
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "De", confidence: 91 },
          { text: "veltri", confidence: 92 },
          { text: "Gregorio", confidence: 93 },
        ]),
      ].join("\n"),
    })

    expect(
      applyStudentNameOrder(result.candidates[0]!, "surname-given"),
    ).toEqual(
      expect.objectContaining({ firstName: "Gregorio", surname: "De veltri" }),
    )
  })

  it("offers a possible split of an ambiguous compound and marks it for review", () => {
    const result = extractStudentCandidates({
      confidence: 92,
      text: "Rumeria Clovera gelsina",
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "Rumeria", confidence: 92 },
          { text: "Clovera", confidence: 93 },
          { text: "gelsina", confidence: 91 },
        ]),
      ].join("\n"),
    })

    const applied = applyStudentNameOrder(
      result.candidates[0]!,
      "surname-given",
    )
    // The first word is surname under either reading of a surname-first
    // sheet, so it is never offered as the given name.
    expect(applied.firstName).toBe("Clovera gelsina")
    expect(applied.surname).toBe("Rumeria")
    expect(applied.nameReading?.compoundAmbiguity).toBe(true)
    // The words as read survive, so the operator can retype the boundary.
    expect(applied.nameReading?.raw).toBe("Rumeria Clovera gelsina")
  })

  it("keeps a leading particle with its surname in an unproven longer name", () => {
    const result = extractStudentCandidates({
      confidence: 92,
      text: "De Varni Elsa Mirta",
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "De", confidence: 91 },
          { text: "Varni", confidence: 92 },
          { text: "Elsa", confidence: 93 },
          { text: "Mirta", confidence: 90 },
        ]),
      ].join("\n"),
    })

    const applied = applyStudentNameOrder(
      result.candidates[0]!,
      "surname-given",
    )
    expect(applied.surname).toBe("De Varni")
    expect(applied.firstName).toBe("Elsa Mirta")
    expect(applied.nameReading?.compoundAmbiguity).toBe(true)
    expect(applied.nameReading?.raw).toBe("De Varni Elsa Mirta")
    expect(applied.confidence).toMatchObject({ surname: 91, firstName: 90 })
  })

  it("keeps a student row whose grid noise reads as a heading keyword", () => {
    const { candidates } = extractStudentCandidates({
      confidence: 92,
      tsv: null,
      text: [
        "COGNOME E NOME",
        // Noise from the attendance grid, after the row's own columns.
        "Varni Lodovica 16 anni - 03/04/2010 pag",
        "Selmi Arduino 17 anni - 05/06/2009 staff",
        "Orvesi Talia 15 anni - 07/08/2011 note",
        "Data stampa 08/09/2026",
        "Pag. 1 di 2",
        "ADV Brenti Orsola 01/02/1980",
      ].join("\n"),
    })

    // No student is dropped, and noise does not turn later rows into staff;
    // the print-date footer and the staff row stay out.
    expect(candidates.map(({ dateOfBirth }) => dateOfBirth)).toEqual([
      "2010-04-03",
      "2009-06-05",
      "2011-08-07",
    ])
  })

  it.each([
    "12/09/2026 Corso Deriva Livello 2",
    "08/09/2026 Stampato alle ore 10",
    "15/06/2026 Pagina Iscritti 1",
    "Del 12/09/2026 Corso Deriva Livello 2",
    "N. 3 del 12/09/2026 Elenco Iscritti",
  ])(
    "never reads a heading that starts with its date as a student: %s",
    (line) => {
      const { candidates } = extractStudentCandidates({
        confidence: 92,
        tsv: null,
        text: [
          "COGNOME E NOME",
          line,
          "Varni Lodovica 16 anni - 03/04/2010",
        ].join("\n"),
      })

      // No name word precedes the date, so the whole line is the heading.
      expect(candidates.map(({ dateOfBirth }) => dateOfBirth)).toEqual([
        "2010-04-03",
      ])
    },
  )

  it("never lets a confident particle lift an uncertain surname word", () => {
    const result = extractStudentCandidates({
      confidence: 92,
      text: "De Varni Elsa Mirta",
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "De", confidence: 97 },
          { text: "Varni", confidence: 41 },
          { text: "Elsa", confidence: 0 },
          { text: "Mirta", confidence: 95 },
        ]),
      ].join("\n"),
    })

    const applied = applyStudentNameOrder(
      result.candidates[0]!,
      "surname-given",
    )
    expect(applied.confidence.surname).toBe(41)
    // A word read with no confidence stays uncertain, not replaced.
    expect(applied.confidence.firstName).toBe(0)
    expect(applied.confidence.surname).toBeLessThan(MIN_FIELD_CONFIDENCE)
  })

  it("does not report a telephone that was not asked for, and reads the same names", () => {
    const row = (line: number, surname: string, given: string, phone: string) =>
      tsvPlacedLine(line, [
        { text: surname, confidence: 92, left: 100, width: 80 },
        { text: given, confidence: 92, left: 190, width: 70 },
        { text: phone, confidence: 90, left: 400, width: 140 },
        { text: "12/02/2002", confidence: 91, left: 650, width: 120 },
      ])
    const page = {
      confidence: 90,
      text: "",
      tsv: [
        HEADER,
        row(1, "Feriani", "Massimo", "3990000006"),
        row(2, "Vernuzzi", "Edoardo", "3990000012"),
        row(3, "Rovellini", "Paolo", "3990000016"),
      ].join("\n"),
    }

    const asked = extractStudentCandidates(page, { readPhone: true })
    const notAsked = extractStudentCandidates(page, { readPhone: false })

    expect(asked.candidates.map((candidate) => candidate.phone)).toEqual([
      "3990000006",
      "3990000012",
      "3990000016",
    ])
    // Nothing to review, nothing to confirm, nothing to store.
    expect(notAsked.candidates.map((candidate) => candidate.phone)).toEqual([
      "",
      "",
      "",
    ])
    // And the reason the option is safe: the telephone column still bounds the
    // name cell, so the two fields the course needs are read identically.
    expect(
      notAsked.candidates.map(({ firstName, surname, dateOfBirth }) => ({
        firstName,
        surname,
        dateOfBirth,
      })),
    ).toEqual(
      asked.candidates.map(({ firstName, surname, dateOfBirth }) => ({
        firstName,
        surname,
        dateOfBirth,
      })),
    )
  })

  it("still recognises a row carried by its telephone when the telephone is not reported", () => {
    // A row whose given name smudged below the field threshold. What makes it a
    // row at all is the telephone plus the date; drop the detection and the row
    // disappears, taking a student with it.
    const page = {
      confidence: 88,
      text: "",
      tsv: [
        HEADER,
        tsvPlacedLine(1, [
          { text: "Rossi", confidence: 91, left: 100, width: 80 },
          { text: "3331234567", confidence: 90, left: 400, width: 140 },
          { text: "12/03/2008", confidence: 92, left: 650, width: 120 },
        ]),
      ].join("\n"),
    }

    const result = extractStudentCandidates(page, { readPhone: false })
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]?.dateOfBirth).toBe("2008-03-12")
    expect(result.candidates[0]?.phone).toBe("")
  })

  it("keeps a weak two-word reading visible for review", () => {
    const result = extractStudentCandidates({
      confidence: 53,
      text: "Esempiotrentadue Esempioquaranta 0000000000",
      tsv: null,
    })
    expect(result.unsuitable).toBe(false)
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]?.nameReading?.raw).toBe(
      "Esempiotrentadue Esempioquaranta",
    )
    expect(result.candidates[0]?.confidence.firstName).toBe(53)
    expect(result.candidates[0]?.confidence.surname).toBe(53)
  })

  it("keeps single name tokens as incomplete rows even when confidence is low", () => {
    const result = extractStudentCandidates({
      confidence: 95,
      text: "Esempiotrentatre\nEsempioquarantacinque\nEsempiotrentuno Esempioquarantasei",
      tsv: [
        HEADER,
        tsvLine(1, [{ text: "Esempiotrentatre", confidence: 88 }]),
        tsvLine(2, [{ text: "Esempioquarantacinque", confidence: 55 }]),
        tsvLine(3, [
          { text: "Esempiotrentuno", confidence: 95 },
          { text: "Esempioquarantasei", confidence: 95 },
        ]),
      ].join("\n"),
    })
    expect(result.unsuitable).toBe(false)
    expect(result.candidates).toHaveLength(3)
    expect(result.candidates[0]).toEqual(
      expect.objectContaining({ firstName: "Esempiotrentatre", surname: "" }),
    )
    expect(result.candidates[0]?.confidence.firstName).toBe(88)
    expect(result.candidates[1]).toEqual(
      expect.objectContaining({
        firstName: "Esempioquarantacinque",
        surname: "",
      }),
    )
    expect(result.candidates[1]?.confidence.firstName).toBe(55)
  })

  it("keeps a weak date fragment visible when it cannot be joined safely", () => {
    const result = extractStudentCandidates({
      confidence: 95,
      text: "Esempiotrentuno Esempioquarantasei\n04/04/2002",
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "Esempiotrentuno", confidence: 95 },
          { text: "Esempioquarantasei", confidence: 95 },
        ]),
        tsvLine(2, [{ text: "04/04/2002", confidence: 55 }]),
      ].join("\n"),
    })
    expect(result.candidates).toHaveLength(2)
    expect(result.candidates[1]?.dateOfBirth).toBe("2002-04-04")
    expect(result.candidates[1]?.confidence.dateOfBirth).toBe(55)
    expect(result.candidates[1]?.firstName).toBe("")
  })

  it("keeps weak unresolved age and opted-in telephone readings visible", () => {
    const page = {
      confidence: 95,
      text: "Esempiotrentuno Esempioquarantasei\n17 anni\n0000000000",
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "Esempiotrentuno", confidence: 95 },
          { text: "Esempioquarantasei", confidence: 95 },
        ]),
        tsvLine(2, [
          { text: "17", confidence: 55 },
          { text: "anni", confidence: 55 },
        ]),
        tsvLine(3, [{ text: "0000000000", confidence: 55 }]),
      ].join("\n"),
    }
    const optedIn = extractStudentCandidates(page, { readPhone: true })
    expect(optedIn.candidates).toHaveLength(3)
    expect(optedIn.candidates[1]?.ageReading?.value).toBe(17)
    expect(optedIn.candidates[1]?.ageReading?.confidence).toBe(55)
    expect(optedIn.candidates[2]?.phone).toBe("0000000000")
    expect(optedIn.candidates[2]?.confidence.phone).toBe(55)

    const optedOut = extractStudentCandidates(page, { readPhone: false })
    expect(optedOut.candidates).toHaveLength(2)
    expect(optedOut.candidates.every(({ phone }) => phone === "")).toBe(true)
  })
})

describe("readings the parser used to drop silently", () => {
  function read(text: string) {
    return extractStudentCandidates({ text, tsv: null, confidence: 92 })
  }

  it.each(["Lo", "Li", "El", "Al", "De", "Di"])(
    "keeps the surname particle %s with its surname",
    (particle) => {
      const [candidate] = read(
        `${particle} Bardino Marco 12/03/2010 16 anni`,
      ).candidates
      const applied = applyStudentNameOrder(candidate!, "surname-given")
      expect(applied.surname).toBe(`${particle} Bardino`)
      expect(applied.firstName).toBe("Marco")
    },
  )

  it("keeps a particle read from a placed table cell", () => {
    const row = (line: number, words: string[]) =>
      tsvPlacedLine(line, [
        ...words.map((text, index) => ({
          text,
          confidence: 93,
          left: 20 + index * 90,
          width: 80,
        })),
        { text: "3331234567", confidence: 93, left: 400, width: 110 },
        { text: "16", confidence: 93, left: 520, width: 20 },
        { text: "anni", confidence: 93, left: 545, width: 40 },
        { text: "12/03/2010", confidence: 93, left: 600, width: 100 },
      ])
    const result = extractStudentCandidates({
      confidence: 93,
      text: "",
      tsv: [
        HEADER,
        row(1, ["Lo", "Bardino", "Marco"]),
        row(2, ["Verdi", "Anna"]),
        row(3, ["Neri", "Paolo"]),
      ].join("\n"),
    })
    const applied = applyStudentNameOrder(
      result.candidates[0]!,
      "surname-given",
    )
    expect(applied.surname).toBe("Lo Bardino")
    expect(applied.nameReading?.raw).toBe("Lo Bardino Marco")
  })

  it("keeps an unknown short word inside a name in the reading and marks the split", () => {
    const [candidate] = read("Bardino Xq Marco 12/03/2010 16 anni").candidates
    expect(candidate!.nameReading?.raw).toBe("Bardino Xq Marco")
    expect(candidate!.nameReading?.droppedInteriorWord).toBe(true)
    const applied = applyStudentNameOrder(candidate!, "surname-given")
    expect(applied.nameReading?.compoundAmbiguity).toBe(true)
  })

  it("does not drop the rows below a contact line with a keyword", () => {
    const result = read(
      [
        "Segreteria didattica: 0212345678",
        "Bardino Marco 12/03/2010 16 anni",
        "Verdi Anna 01/02/2011 15 anni",
        "Neri Paolo 05/06/2012 14 anni",
      ].join("\n"),
    )
    expect(result.unsuitable).toBe(false)
    expect(
      result.candidates.map(({ firstName, rowWarning }) => [
        firstName,
        rowWarning ?? null,
      ]),
    ).toEqual([
      ["Bardino", null],
      ["Verdi", null],
      ["Neri", null],
    ])
  })

  it.each(["Istruttori", "Istruttrici", "Personale", "Volontaria"])(
    "marks, never drops, the staff below a %s heading",
    (heading) => {
      const result = read(
        [
          "Bardino Marco 12/03/2010 16 anni",
          heading,
          "Verdani Luca 03/04/1990 36 anni",
        ].join("\n"),
      )
      expect(
        result.candidates.map(({ firstName, rowWarning }) => [
          firstName,
          rowWarning ?? null,
        ]),
      ).toEqual([
        ["Bardino", null],
        ["Verdani", "possible-staff"],
      ])
    },
  )

  it("marks, never drops, the rows below a singular Istruttore line", () => {
    const result = read(
      [
        "Bardino Marco 12/03/2010 16 anni",
        "Istruttore",
        "Verdani Luca 03/04/1990 36 anni",
      ].join("\n"),
    )
    expect(
      result.candidates.map(({ firstName, rowWarning }) => [
        firstName,
        rowWarning ?? null,
      ]),
    ).toEqual([
      ["Bardino", null],
      ["Verdani", "possible-staff"],
    ])
  })

  it("keeps a staff row under a Personale heading for review, never ready", () => {
    const result = read(
      [
        "Bardino Marco 12/03/2010 16 anni",
        "Personale",
        "Verdi Anna 01/02/1990 36 anni",
      ].join("\n"),
    )
    // Under a staff heading the row is kept for review, never ready.
    expect(
      result.candidates.map(({ firstName, rowWarning }) => [
        firstName,
        rowWarning ?? null,
      ]),
    ).toEqual([
      ["Bardino", null],
      ["Verdi", "possible-staff"],
    ])
  })

  it("keeps a student whose name is also a heading word when an age is printed", () => {
    const result = read(
      [
        "Bardino Domenica 12/03/2010 16 anni",
        "Sabato Marco 01/02/2011 15 anni",
      ].join("\n"),
    )
    // Kept, and marked wherever the heading word is: "Settimana Deriva 12
    // anni" and "Turno Domenica 12 anni" read the same way.
    expect(
      result.candidates.map(({ rowWarning }) => rowWarning ?? null),
    ).toEqual(["possible-heading", "possible-heading"])
  })

  it("marks a row with a staff role code the layout cannot place", () => {
    const [candidate] = read(
      "Bardino Luca IS 3331234567 34 anni 03/04/1992",
    ).candidates
    expect(candidate!.rowWarning).toBe("possible-staff")
  })

  it("marks a line carrying two rows' dates and ages", () => {
    const [candidate] = read(
      "Fornace Sara 12/03/2010 16 anni Pellandi Paolo 01/02/2011 15 anni",
    ).candidates
    expect(candidate!.rowWarning).toBe("possible-merged-rows")
  })
})

describe("readings kept on crops and headings (F1 re-review)", () => {
  it.each([
    ["Lo", "Re", "Marco"],
    ["Li", "Wu", "Anna"],
    ["Del", "Re", "Marco"],
  ])(
    "marks %s %s %s on a crop too small for a table layout",
    (particle, short, given) => {
      const result = extractStudentCandidates({
        confidence: 92,
        text: "",
        tsv: [
          HEADER,
          tsvLine(1, [
            { text: particle, confidence: 92 },
            { text: short, confidence: 92 },
            { text: given, confidence: 92 },
            { text: "12/03/2010", confidence: 92 },
          ]),
          tsvLine(2, [
            { text: "Verdani", confidence: 92 },
            { text: "Giulia", confidence: 92 },
            { text: "01/02/2011", confidence: 92 },
          ]),
        ].join("\n"),
      })
      const reading = result.candidates[0]!.nameReading!
      expect(reading.droppedInteriorWord).toBe(true)
      expect(reading.raw).toContain(short)
      const applied = applyStudentNameOrder(
        result.candidates[0]!,
        "surname-given",
      )
      expect(applied.nameReading?.compoundAmbiguity).toBe(true)
    },
  )

  it("ends the staff marking at a student heading that carries an age", () => {
    const result = extractStudentCandidates({
      text: [
        "Personale",
        "Neri Paolo IS 3331234567 34 anni 03/04/1992",
        "Allievi (8-12 anni)",
        "Bardino Marco 12/03/2014 12 anni",
        "Verdi Anna 01/02/2015 11 anni",
        "Rossa Ada 05/06/2016 10 anni",
      ].join("\n"),
      tsv: null,
      confidence: 92,
    })
    expect(
      result.candidates.map(({ firstName, rowWarning }) => [
        firstName,
        rowWarning ?? null,
      ]),
    ).toEqual([
      ["Neri", "possible-staff"],
      ["Bardino", null],
      ["Verdi", null],
      ["Rossa", null],
    ])
  })

  it("keeps a table row whose given name is a heading word when the age word is misread", () => {
    const row = (line: number, words: string[], age: string) =>
      tsvPlacedLine(line, [
        ...words.map((text, index) => ({
          text,
          confidence: 93,
          left: 20 + index * 90,
          width: 80,
        })),
        { text: "3331234567", confidence: 93, left: 400, width: 110 },
        { text: "12", confidence: 93, left: 520, width: 20 },
        { text: age, confidence: 93, left: 545, width: 40 },
        { text: "01/02/2014", confidence: 93, left: 600, width: 100 },
      ])
    const result = extractStudentCandidates({
      confidence: 93,
      text: "",
      tsv: [
        HEADER,
        row(1, ["Bardino", "Domenica"], "annl"),
        row(2, ["Verdi", "Anna"], "anni"),
        row(3, ["Neri", "Paolo"], "anni"),
        row(4, ["Rossa", "Ada"], "anni"),
      ].join("\n"),
    })
    expect(result.candidates).toHaveLength(4)
  })
})

describe("section and heading rules (F1 round 3)", () => {
  // Whether a date can be a birth date depends on today's date.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-09-27T12:00:00"))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function headingWordRow(
    line: number,
    words: string[],
    fields: { phone?: boolean; ageWord?: string; date?: string },
  ) {
    return tsvPlacedLine(line, [
      ...words.map((text, index) => ({
        text,
        confidence: 93,
        left: 20 + index * 90,
        width: 80,
      })),
      ...(fields.phone
        ? [{ text: "3331234567", confidence: 93, left: 400, width: 110 }]
        : []),
      ...(fields.ageWord
        ? [
            { text: "12", confidence: 93, left: 520, width: 20 },
            { text: fields.ageWord, confidence: 93, left: 545, width: 40 },
          ]
        : []),
      ...(fields.date
        ? [{ text: fields.date, confidence: 93, left: 600, width: 100 }]
        : []),
    ])
  }

  it.each([
    [["Sabato", "Marco"]],
    [["Corso", "Marta"]],
    [["Domenica", "Rossi"]],
  ])(
    "keeps and marks a table row led by a heading word %j when the age word is misread",
    (words) => {
      const result = extractStudentCandidates({
        confidence: 93,
        text: "",
        tsv: [
          HEADER,
          headingWordRow(1, words, {
            phone: true,
            ageWord: "annl",
            date: "01/02/2014",
          }),
          headingWordRow(2, ["Verdi", "Anna"], {
            phone: true,
            ageWord: "anni",
            date: "01/02/2014",
          }),
          headingWordRow(3, ["Neri", "Paolo"], {
            phone: true,
            ageWord: "anni",
            date: "05/06/2014",
          }),
          headingWordRow(4, ["Rossa", "Ada"], {
            phone: true,
            ageWord: "anni",
            date: "07/08/2014",
          }),
        ].join("\n"),
      })
      expect(
        result.candidates.map(({ rowWarning }) => rowWarning ?? null),
      ).toEqual(["possible-heading", null, null, null])
      const kept = result.candidates[0]!
      expect(`${kept.firstName} ${kept.surname}`).toContain(words[1]!)
    },
  )

  it("keeps and marks a table row led by a heading word with only a telephone", () => {
    const result = extractStudentCandidates({
      confidence: 93,
      text: "",
      tsv: [
        HEADER,
        headingWordRow(1, ["Sabato", "Marco"], { phone: true }),
        headingWordRow(2, ["Verdi", "Anna"], { phone: true }),
        headingWordRow(3, ["Neri", "Paolo"], { phone: true }),
        headingWordRow(4, ["Rossa", "Ada"], { phone: true }),
      ].join("\n"),
    })
    expect(
      result.candidates.map(({ rowWarning }) => rowWarning ?? null),
    ).toEqual(["possible-heading", null, null, null])
  })

  it("marks the rows after a staff heading that carries a date as possible staff", () => {
    const result = extractStudentCandidates({
      text: [
        "Bardino Marco 12/03/2014 12 anni",
        "Personale al 29/08/2026",
        "Bianchi Luca 03/04/1990 36 anni",
      ].join("\n"),
      tsv: null,
      confidence: 92,
    })
    expect(
      result.candidates.map(({ firstName, rowWarning }) => [
        firstName,
        rowWarning ?? null,
      ]),
    ).toEqual([
      ["Bardino", null],
      // The heading itself is kept as a visible row to remove: a staff word in
      // a line with a date is not proof it holds no student.
      ["Personale", "possible-staff"],
      ["Bianchi", "possible-staff"],
    ])
  })

  it("still drops a laid-out heading that starts with its keyword", () => {
    const row = (line: number, words: string[], date: string) =>
      tsvPlacedLine(line, [
        ...words.map((text, index) => ({
          text,
          confidence: 93,
          left: 20 + index * 90,
          width: 80,
        })),
        { text: "3331234567", confidence: 93, left: 400, width: 110 },
        { text: date, confidence: 93, left: 600, width: 100 },
      ])
    const result = extractStudentCandidates({
      confidence: 93,
      text: "",
      tsv: [
        HEADER,
        row(1, ["Corso", "Deriva", "Livello"], "29/08/2026"),
        row(2, ["Verdi", "Anna"], "01/02/2014"),
        row(3, ["Neri", "Paolo"], "05/06/2013"),
        row(4, ["Rossa", "Ada"], "07/08/2012"),
      ].join("\n"),
    })
    expect(result.candidates.map(({ firstName }) => firstName)).toEqual([
      "Verdi",
      "Neri",
      "Rossa",
    ])
  })
})

describe("section and heading rules (F1 round 5)", () => {
  function read(text: string) {
    return extractStudentCandidates({ text, tsv: null, confidence: 92 })
  }
  const students = [
    "Bardino Marco 12/03/2014 12 anni",
    "Verdi Anna 01/02/2015 11 anni",
    "Rossa Ada 05/06/2016 10 anni",
  ]
  const warnings = (text: string) =>
    read(text).candidates.map(({ firstName, rowWarning }) => [
      firstName,
      rowWarning ?? null,
    ])

  it.each(["Corso Deriva 8-12 anni", "CORSO VELA 10-14 ANNI"])(
    "drops the course heading %s with an age range",
    (heading) => {
      expect(warnings([heading, ...students].join("\n"))).toEqual([
        ["Bardino", null],
        ["Verdi", null],
        ["Rossa", null],
      ])
    },
  )

  it("drops a laid-out course heading with an age range", () => {
    const result = extractStudentCandidates({
      confidence: 93,
      text: "",
      tsv: [
        HEADER,
        tsvPlacedLine(1, [
          { text: "Corso", confidence: 93, left: 20, width: 80 },
          { text: "Deriva", confidence: 93, left: 110, width: 80 },
          { text: "8-12", confidence: 93, left: 520, width: 20 },
          { text: "anni", confidence: 93, left: 545, width: 40 },
        ]),
        ...[
          ["Bardino", "Marco", "01/02/2014"],
          ["Verdi", "Anna", "05/06/2014"],
          ["Rossa", "Ada", "07/08/2014"],
        ].map(([surname, given, date], index) =>
          tsvPlacedLine(index + 2, [
            { text: surname!, confidence: 93, left: 20, width: 80 },
            { text: given!, confidence: 93, left: 110, width: 80 },
            { text: "3331234567", confidence: 93, left: 400, width: 110 },
            { text: "12", confidence: 93, left: 520, width: 20 },
            { text: "anni", confidence: 93, left: 545, width: 40 },
            { text: date!, confidence: 93, left: 600, width: 100 },
          ]),
        ),
      ].join("\n"),
    })
    expect(result.candidates.map(({ firstName }) => firstName)).toEqual([
      "Bardino",
      "Verdi",
      "Rossa",
    ])
  })

  it("keeps and marks a heading word before a single printed age", () => {
    expect(
      warnings(["Settimana Deriva 12 anni", ...students].join("\n"))[0],
    ).toEqual(["Settimana", "possible-heading"])
  })

  it("skips one named staff line and marks, never drops, the students after it", () => {
    expect(
      warnings(
        ["Elenco partecipanti", "Istruttore: Verdani Luca", ...students].join(
          "\n",
        ),
      ),
    ).toEqual([
      ["Bardino", "possible-staff"],
      ["Verdi", "possible-staff"],
      ["Rossa", "possible-staff"],
    ])
    expect(
      warnings(
        [students[0], "Istruttore Verdani Luca", ...students.slice(1)].join(
          "\n",
        ),
      ).map(([firstName]) => firstName),
    ).toEqual(["Bardino", "Verdi", "Rossa"])
  })

  it("marks the staff after a heading with filler words", () => {
    expect(
      warnings(
        [
          ...students,
          "Istruttori di turno",
          "Verdani Luca 03/04/1990 36 anni",
        ].join("\n"),
      ),
    ).toEqual([
      ["Bardino", null],
      ["Verdi", null],
      ["Rossa", null],
      ["Verdani", "possible-staff"],
    ])
  })

  it("marks the rows below a dated staff heading even at the top", () => {
    expect(
      warnings(
        [
          "Personale al 29/08/2026",
          "Verdani Luca 03/04/1990 36 anni",
          "Allievi",
          ...students,
        ].join("\n"),
      ).filter(([firstName]) => firstName !== "Personale"),
    ).toEqual([
      ["Verdani", "possible-staff"],
      ["Bardino", null],
      ["Verdi", null],
      ["Rossa", null],
    ])
  })

  it("does not let a stray title row turn a contact line into a staff mark", () => {
    expect(
      warnings(
        [
          "Registro di prova dati inventati",
          "Segreteria didattica: 0212345678",
          ...students,
        ].join("\n"),
      ).filter(([firstName]) =>
        ["Bardino", "Verdi", "Rossa"].includes(firstName as string),
      ),
    ).toEqual([
      ["Bardino", null],
      ["Verdi", null],
      ["Rossa", null],
    ])
  })
})

describe("staff lines and headings (F1 round 6)", () => {
  // Whether a date can be a birth date depends on today's date.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-09-27T12:00:00"))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const students = [
    "Bardino Marco 12/03/2014 12 anni",
    "Verdi Anna 01/02/2015 11 anni",
    "Rossa Ada 05/06/2016 10 anni",
  ]
  const warnings = (lines: string[]) =>
    extractStudentCandidates({
      text: lines.join("\n"),
      tsv: null,
      confidence: 92,
    }).candidates.map(({ firstName, rowWarning }) => [
      firstName,
      rowWarning ?? null,
    ])
  const unmarkedStudents = [
    ["Bardino", null],
    ["Verdi", null],
    ["Rossa", null],
  ]

  it.each([
    "Istruttore: Verdani",
    "Istruttore: L. Verdani",
    "Istruttore: Wu Li",
    "Istruttore Verdani",
    "Istruttrice: Anna",
    "Assistente: Neri",
    "Istruttore:",
    "Istruttore: ______",
    "Istruttore di turno",
    "Istruttore: Sabato",
    "Istruttrice Deriva",
  ])(
    "skips the staff line %s and marks, never drops, the rows after it",
    (staff) => {
      const marked = [
        ["Bardino", "possible-staff"],
        ["Verdi", "possible-staff"],
        ["Rossa", "possible-staff"],
      ]
      expect(warnings([staff, ...students])).toEqual(marked)
      expect(warnings(["Elenco partecipanti", staff, ...students])).toEqual(
        marked,
      )
      expect(warnings([students[0]!, staff, ...students.slice(1)])).toEqual([
        ["Bardino", null],
        ["Verdi", "possible-staff"],
        ["Rossa", "possible-staff"],
      ])
      // A student heading ends the marking.
      expect(
        warnings([
          staff,
          "Verdani Luca 03/04/1990 36 anni",
          "Allievi",
          ...students,
        ]),
      ).toEqual([["Verdani", "possible-staff"], ...unmarkedStudents])
    },
  )

  it.each([
    "Cognome Nome Nascita Istruttore",
    "Nome istruttore:",
    "Firma istruttore",
    "Nome assistente:",
  ])("skips the label %s alone above the students", (label) => {
    expect(warnings([label, ...students])).toEqual(unmarkedStudents)
    // Below a student it may head a staff table: the rows after it are marked.
    expect(warnings([students[0]!, label, ...students.slice(1)])).toEqual([
      ["Bardino", null],
      ["Verdi", "possible-staff"],
      ["Rossa", "possible-staff"],
    ])
  })

  it("marks the rows between a staff contact line and the student heading", () => {
    expect(
      warnings([
        "Personale tel. 3331234567",
        "Verdani Luca 03/04/1990 36 anni",
        "Allievi",
        ...students,
      ]).filter(([firstName]) => firstName !== "Personale"),
    ).toEqual([["Verdani", "possible-staff"], ...unmarkedStudents])
    // With no student heading after it, it is the school's contact line.
    expect(
      warnings(["Segreteria 0212345678", ...students]).filter(([firstName]) =>
        ["Bardino", "Verdi", "Rossa"].includes(firstName as string),
      ),
    ).toEqual(unmarkedStudents)
  })

  it("marks an aged row with a heading word anywhere in the name", () => {
    expect(
      warnings([
        "Turno Domenica 12 anni",
        "N. 3 Corso Vela 12 anni",
        ...students,
      ]),
    ).toEqual([
      ["Turno", "possible-heading"],
      [expect.any(String), "possible-heading"],
      ...unmarkedStudents,
    ])
  })

  it.each([
    "Personale del turno",
    "Assistenti del turno",
    "Staff",
    "Istruttori:",
    "Istruttori: ________",
    "Istruttori: Sabato e Corso",
    "Corso Istruttori",
  ])("marks, never drops, the rows after the heading %s", (heading) => {
    expect(
      warnings([...students, heading, "Verdani Luca 03/04/1990 36 anni"]),
    ).toEqual([...unmarkedStudents, ["Verdani", "possible-staff"]])
    expect(warnings([heading, ...students])).toEqual([
      ["Bardino", "possible-staff"],
      ["Verdi", "possible-staff"],
      ["Rossa", "possible-staff"],
    ])
  })

  it.each(["Iscritti", "Corsisti"])(
    "ends the staff marking at the student heading %s",
    (heading) => {
      expect(
        warnings([
          "Personale tel. 3331234567",
          "Verdani Luca 03/04/1990 36 anni",
          heading,
          ...students,
        ]).filter(([firstName]) => firstName !== "Personale"),
      ).toEqual([["Verdani", "possible-staff"], ...unmarkedStudents])
    },
  )

  it("marks an aged heading phrase such as Centro Velico", () => {
    expect(warnings(["Centro Velico 12 anni", ...students])).toEqual([
      ["Centro", "possible-heading"],
      ...unmarkedStudents,
    ])
  })

  it("marks the rows after a staff line it cannot place, until the students", () => {
    expect(
      warnings([
        "Staff del Centro Velico",
        "Verdani Luca 03/04/1990 36 anni",
        "Allievi",
        ...students,
      ]),
    ).toEqual([["Verdani", "possible-staff"], ...unmarkedStudents])
  })

  it("keeps and marks an age-range line that starts with no heading word", () => {
    expect(warnings(["Gruppo Vela 8-12 anni", ...students])).toEqual([
      ["Gruppo", "possible-heading"],
      ...unmarkedStudents,
    ])
  })

  it("keeps and marks a student called Domenica on a crop with no age", () => {
    expect(
      warnings([
        "Rossi Domenica 12/03/2014",
        "Verdi Anna 01/02/2015",
        "Stampato il 20/08/2026",
      ]),
    ).toEqual([
      ["Rossi", "possible-heading"],
      ["Verdi", null],
    ])
  })

  it("does not let a dated title turn a contact line into a staff mark", () => {
    expect(
      warnings([
        "Registro aggiornato al 20/08/2026",
        "Segreteria didattica: 0212345678",
        ...students,
      ]).filter(([firstName]) =>
        ["Bardino", "Verdi", "Rossa"].includes(firstName as string),
      ),
    ).toEqual(unmarkedStudents)
  })
})

describe("student headings and staff words (F1 rounds 9 and 10)", () => {
  // Whether a date can be a birth date depends on today's date.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-09-27T12:00:00"))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const students = [
    "Bardino Marco 12/03/2014 12 anni",
    "Verdi Anna 01/02/2015 11 anni",
    "Rossa Ada 05/06/2016 10 anni",
  ]
  const unmarkedStudents = [
    ["Bardino", null],
    ["Verdi", null],
    ["Rossa", null],
  ]
  const warnings = (lines: string[]) =>
    extractStudentCandidates({
      text: lines.join("\n"),
      tsv: null,
      confidence: 92,
    }).candidates.map(({ firstName, rowWarning }) => [
      firstName,
      rowWarning ?? null,
    ])

  it("marks the staff between a label at the top and the student heading", () => {
    expect(
      warnings([
        "Nome assistente:",
        "Verdani Luca 03/04/1990 36 anni",
        "Allievi",
        ...students,
      ]),
    ).toEqual([["Verdani", "possible-staff"], ...unmarkedStudents])
  })

  it("marks a row that carries a staff word itself", () => {
    expect(warnings(["Neri volontario 30 anni", ...students])).toEqual([
      ["Neri", "possible-staff"],
      ...unmarkedStudents,
    ])
  })

  it.each([
    "Allievi Deriva 12/14 anni",
    "Allievi Deriva 12 anni",
    "Partecipanti Vela 10—12 anni",
  ])("drops the student heading %s, never reads it as a student", (heading) => {
    expect(warnings([heading, ...students])).toEqual(unmarkedStudents)
    expect(warnings([students[0]!, heading, ...students.slice(1)])).toEqual(
      unmarkedStudents,
    )
  })

  it.each(["Allievi turno 2", "ELENCO PARTECIPANTI 2026", "Iscritti: 12"])(
    "marks the staff between a label at the top and the heading %s",
    (heading) => {
      expect(
        warnings([
          "Nome assistente:",
          "Verdani Luca 03/04/1990 36 anni",
          heading,
          ...students,
        ]),
      ).toEqual([["Verdani", "possible-staff"], ...unmarkedStudents])
    },
  )
})
