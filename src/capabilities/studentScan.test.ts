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
