import { describe, expect, it } from "vitest"

import {
  extractStudentCandidates,
  MIN_FIELD_CONFIDENCE,
} from "@/capabilities/studentScan"

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

  it("rejects an unsuitable low-confidence image instead of exposing rows", () => {
    expect(
      extractStudentCandidates({
        confidence: 53,
        text: "Maro Ree 12032008 333 123 4567",
        tsv: null,
      }),
    ).toEqual({
      aggregateConfidence: 53,
      candidates: [],
      unsuitable: true,
    })
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
        { text: "02/02/2002", confidence: 91, left: 650, width: 120 },
      ])

    const result = extractStudentCandidates({
      confidence: 90,
      text: "",
      tsv: [
        HEADER,
        row(1, "Cortese", "Massimo", "3775394585"),
        row(2, "Merluzzi", "Edoardo", "3489083367"),
        row(3, "Passerini", "Paolo", "3209389744"),
      ].join("\n"),
    })

    expect(result.candidates).toHaveLength(3)
    for (const candidate of result.candidates) {
      expect(candidate.surname).not.toMatch(/anni/i)
      expect(candidate.surname).not.toMatch(/\d/)
      expect(candidate.firstName).not.toMatch(/\d/)
    }
    expect(result.candidates[0]?.firstName).toBe("Cortese")
    expect(result.candidates[0]?.surname).toBe("Massimo")
    expect(result.candidates[0]?.dateOfBirth).toBe("2002-02-02")
  })

  it("drops the staff block, including a role code the table rule smudged", () => {
    const student = (line: number, surname: string, given: string) =>
      tsvPlacedLine(line, [
        { text: surname, confidence: 92, left: 100, width: 80 },
        { text: given, confidence: 92, left: 190, width: 70 },
        { text: "3775394585", confidence: 90, left: 400, width: 140 },
        { text: "anni", confidence: 88, left: 590, width: 40 },
        { text: "02/02/2002", confidence: 91, left: 650, width: 120 },
      ])
    const staff = (line: number, surname: string, given: string, role: string) =>
      tsvPlacedLine(line, [
        { text: surname, confidence: 92, left: 100, width: 80 },
        { text: given, confidence: 92, left: 190, width: 70 },
        { text: role, confidence: 86, left: 300, width: 40 },
        { text: "3479332075", confidence: 90, left: 400, width: 140 },
        { text: "anni", confidence: 88, left: 590, width: 40 },
        { text: "04/04/1997", confidence: 91, left: 650, width: 120 },
      ])

    const result = extractStudentCandidates({
      confidence: 90,
      text: "",
      tsv: [
        HEADER,
        student(1, "Cortese", "Massimo"),
        student(2, "Merluzzi", "Edoardo"),
        student(3, "Passerini", "Paolo"),
        staff(4, "Colombo", "Marco", "ADV"),
        staff(5, "Erba", "Rinaldo", "ICT"),
      ].join("\n"),
    })

    expect(result.candidates).toHaveLength(3)
    expect(
      result.candidates.map((candidate) => candidate.firstName),
    ).not.toContain("Colombo")
    expect(
      result.candidates.map((candidate) => candidate.firstName),
    ).not.toContain("Erba")
  })
})
