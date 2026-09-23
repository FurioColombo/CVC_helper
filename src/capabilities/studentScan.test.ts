import { describe, expect, it } from "vitest"

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
    const candidate = readAgeRow(text)
    expect(studentScanAgeCorroborated(candidate, "2026-08-29")).toBe(expected)
    expect(candidate.confidence.dateOfBirth).toBe(
      candidate.dateOfBirth ? 65 : 0,
    )
    expect(MIN_FIELD_CONFIDENCE).toBe(70)
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

  it("refuses to guess an ambiguous compound and marks it for review", () => {
    const result = extractStudentCandidates({
      confidence: 92,
      text: "Rumeria Claudia georgia",
      tsv: [
        HEADER,
        tsvLine(1, [
          { text: "Rumeria", confidence: 92 },
          { text: "Claudia", confidence: 93 },
          { text: "georgia", confidence: 91 },
        ]),
      ].join("\n"),
    })

    const applied = applyStudentNameOrder(
      result.candidates[0]!,
      "surname-given",
    )
    expect(applied.firstName).toBe("Rumeria")
    expect(applied.surname).toBe("Claudia georgia")
    expect(applied.nameReading?.compoundAmbiguity).toBe(true)
    // The words as read survive, so the operator can retype the boundary.
    expect(applied.nameReading?.raw).toBe("Rumeria Claudia georgia")
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
