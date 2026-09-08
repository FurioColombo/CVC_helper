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

  it("keeps reliable fields and blanks each uncertain field independently", () => {
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
    expect(result.candidates[0]).toEqual(
      expect.objectContaining({
        firstName: "Giulia",
        surname: "",
        dateOfBirth: "",
        phone: "347 765 4321",
        sex: "female",
      }),
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
})
