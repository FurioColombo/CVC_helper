import { describe, expect, it } from "vitest"

import {
  parseRosterPaste,
  ROSTER_PASTE_BEGIN,
  ROSTER_PASTE_END,
  ROSTER_PASTE_HEADER,
  ROSTER_PASTE_MAX_ROWS,
  rosterPastePrompt,
} from "@/capabilities/rosterPaste"
import { ROSTER_PASTE_CORPUS } from "@/capabilities/rosterPaste.corpus"

const OPTIONS = { courseStartDate: "2026-08-29", readPhone: false }

describe("roster paste parser", () => {
  it.each(ROSTER_PASTE_CORPUS.map((entry) => [entry.name, entry] as const))(
    "%s",
    (_name, entry) => {
      const result = parseRosterPaste(entry.answer, OPTIONS)
      expect(
        result.candidates.map((candidate) => [
          candidate.surname,
          candidate.firstName,
          candidate.dateOfBirth,
          candidate.ageReading?.value ?? null,
        ]),
      ).toEqual(entry.students)
      expect(result.unparsed).toHaveLength(entry.unparsed)
      expect(result.complete).toBe(entry.complete)
      expect(result.formatMissing).toBe(entry.formatMissing ?? false)
      // Every reported line has a reason.
      for (const line of result.unparsed) {
        expect(line.reason).not.toBe("")
      }
      // A case with a real `\r`/`\n` line break is reported against exactly
      // that naive split; a case whose lines were rebuilt from a phone's own
      // separator (U+2028) or from a fully joined line has no such 1:1
      // mapping to check here, since the parser found its own line breaks or
      // none at all.
      if (/\r|\n/.test(entry.answer)) {
        const lines = entry.answer.split(/\r\n|\r|\n/)
        for (const line of result.unparsed) {
          expect(lines[line.line - 1]?.trim()).toBe(line.text)
        }
      }
      // The paste is trusted (owner decision 2026-09-28): no row carries a
      // warning of its own, and none needs its own check.
      for (const candidate of result.candidates) {
        expect(candidate.rowWarning).toBeUndefined()
      }
    },
  )

  it.each([true, false])(
    "states the exact format it reads in the prompt it copies (telephone %s)",
    (readPhone) => {
      const prompt = rosterPastePrompt({ readPhone })
      expect(prompt).toContain(ROSTER_PASTE_BEGIN)
      expect(prompt).toContain(ROSTER_PASTE_HEADER)
      expect(prompt).toContain(`\n${ROSTER_PASTE_END}\n`)
      expect(prompt.includes("Telefono: lascialo sempre vuoto")).toBe(
        !readPhone,
      )
    },
  )

  it("ignores a telephone it was not asked to read, even a malformed one", () => {
    const answer = [
      ROSTER_PASTE_BEGIN,
      ROSTER_PASTE_HEADER,
      "Veldor;Marta;;16;333-12",
      ROSTER_PASTE_END,
    ].join("\n")
    const result = parseRosterPaste(answer, OPTIONS)
    expect(result.unparsed).toEqual([])
    expect(result.candidates[0]!.phone).toBe("")
    expect(
      parseRosterPaste(answer, { ...OPTIONS, readPhone: true }).unparsed,
    ).toHaveLength(1)
  })

  it("keeps the telephone only when it was asked for", () => {
    const answer = [
      ROSTER_PASTE_BEGIN,
      ROSTER_PASTE_HEADER,
      "Veldor;Marta;12/03/2010;16;+39 333 1234567",
      ROSTER_PASTE_END,
    ].join("\n")
    expect(parseRosterPaste(answer, OPTIONS).candidates[0]!.phone).toBe("")
    expect(
      parseRosterPaste(answer, { ...OPTIONS, readPhone: true }).candidates[0]!
        .phone,
    ).toBe("+39 333 1234567")
  })

  it("suggests the sex from the given name only", () => {
    const answer = [
      ROSTER_PASTE_BEGIN,
      ROSTER_PASTE_HEADER,
      "Veldor;Marta;;16;",
      ROSTER_PASTE_END,
    ].join("\n")
    expect(parseRosterPaste(answer, OPTIONS).candidates[0]!.sex).toBe("female")
  })

  it("refuses a runaway answer whole instead of listing hundreds of rows", () => {
    const rows = Array.from(
      { length: ROSTER_PASTE_MAX_ROWS + 1 },
      (_, index) => `Veldor;Marta${"a".repeat(index % 5)};;16;`,
    )
    const result = parseRosterPaste(
      [ROSTER_PASTE_BEGIN, ROSTER_PASTE_HEADER, ...rows, ROSTER_PASTE_END].join(
        "\n",
      ),
      OPTIONS,
    )
    expect(result.tooLong).toBe(true)
    expect(result.candidates).toEqual([])
  })

  // F2: the answer copied with the ChatGPT app's copy button on a phone was
  // refused as out of format while the same answer pasted on a PC was read.
  it("asks for one code block instead of forbidding Markdown fences", () => {
    const prompt = rosterPastePrompt({ readPhone: false })
    expect(prompt).toContain("```")
    expect(prompt).not.toContain("niente ```")
    expect(prompt.toLowerCase()).toContain("blocco di codice")
  })

  // Review fix: the copy-button advice is for the operator, not the
  // assistant, so it no longer belongs in the text the assistant reads.
  it("never asks the assistant to relay the phone copy-button advice", () => {
    const prompt = rosterPastePrompt({ readPhone: false })
    expect(prompt).not.toContain("Per incollare la risposta da telefono")
  })

  // Every Unicode line terminator, not only CRLF/CR/LF: a phone or chat app's
  // copy path can produce any of these, and a textarea renders each as a
  // line break, so the pasted text looks unchanged either way.
  it.each([
    ["vertical tab", String.fromCharCode(0x0b)],
    ["form feed", String.fromCharCode(0x0c)],
    ["NEL (U+0085)", String.fromCharCode(0x85)],
    ["paragraph separator (U+2029)", String.fromCharCode(0x2029)],
  ])("splits lines on a %s separator", (_name, separator) => {
    const answer = [
      ROSTER_PASTE_BEGIN,
      ROSTER_PASTE_HEADER,
      "Veldor;Marta;12/03/2010;16;",
      ROSTER_PASTE_END,
    ].join(separator)
    const result = parseRosterPaste(answer, OPTIONS)
    expect(result.formatMissing).toBe(false)
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]!.surname).toBe("Veldor")
  })

  describe("out-of-format diagnostics (F2)", () => {
    it("reports lines read and no header found, without the pasted text", () => {
      const answer = "Mario Rossi 12/03/2010\nAnna Bianchi 14/05/2011"
      const result = parseRosterPaste(answer, OPTIONS)
      expect(result.formatMissing).toBe(true)
      expect(result.diagnostics).toEqual({
        lineCount: 2,
        headerFoundInline: false,
        unicodeSeparatorCount: 0,
      })
    })

    it("reports the header found inline and counts the phone's own separators", () => {
      const separator = String.fromCharCode(0x2028)
      const answer = [
        `${ROSTER_PASTE_BEGIN} ${ROSTER_PASTE_HEADER} Veldor;Marta;12/03/2010;16 999;Paolo;01/02/2011;15;777 FINE`,
        "grazie!",
      ].join(separator)
      const result = parseRosterPaste(answer, OPTIONS)
      expect(result.formatMissing).toBe(true)
      expect(result.diagnostics).toEqual({
        lineCount: 2,
        headerFoundInline: true,
        unicodeSeparatorCount: 1,
      })
      // The specific reason names the actual problem, not the generic
      // "missing header" message this case would otherwise get.
      expect(result.unparsed[0]?.reason).toContain("a capo")
    })
  })

  // Review fix: the joined-lines recovery (every line break turned into a
  // space) must treat text outside the rebuilt rows exactly like the normal
  // path already does, instead of silently discarding it.
  describe("joined-lines recovery treats text outside the rebuilt rows like the normal path", () => {
    const joinedIntoOneLine = (...rows: string[]) =>
      [ROSTER_PASTE_BEGIN, ROSTER_PASTE_HEADER, ...rows, ROSTER_PASTE_END].join(
        " ",
      )

    it("does not trust the last rebuilt row when no FINE line was found", () => {
      const answer = [
        ROSTER_PASTE_BEGIN,
        ROSTER_PASTE_HEADER,
        "Veldor;Marta;12/03/2010;16;",
        "Neri;Paolo;01/02/2011;15;",
      ].join(" ")
      const result = parseRosterPaste(answer, OPTIONS)
      expect(result.complete).toBe(false)
      expect(result.candidates).toHaveLength(1)
      expect(result.candidates[0]!.surname).toBe("Veldor")
      expect(result.unparsed).toHaveLength(1)
      expect(result.unparsed[0]!.reason).toBe(
        "forse troncata: manca la riga FINE",
      )
      expect(result.unparsed[0]!.text).toBe("Neri;Paolo;01/02/2011;15;")
    })

    it("reports text before the block, on its own line, as testo prima del blocco", () => {
      const answer = [
        "Ecco l’elenco:",
        joinedIntoOneLine("Veldor;Marta;12/03/2010;16;"),
      ].join("\n")
      const result = parseRosterPaste(answer, OPTIONS)
      expect(result.candidates).toHaveLength(1)
      expect(result.candidates[0]!.surname).toBe("Veldor")
      expect(result.unparsed).toHaveLength(1)
      expect(result.unparsed[0]).toMatchObject({
        text: "Ecco l’elenco:",
        reason: "testo prima del blocco",
      })
    })

    it("reports text after FINE, on its own line, as testo dopo la riga FINE", () => {
      const answer = [
        joinedIntoOneLine("Veldor;Marta;12/03/2010;16;"),
        "grazie mille!",
      ].join("\n")
      const result = parseRosterPaste(answer, OPTIONS)
      expect(result.complete).toBe(true)
      expect(result.candidates).toHaveLength(1)
      expect(result.candidates[0]!.surname).toBe("Veldor")
      expect(result.unparsed).toHaveLength(1)
      expect(result.unparsed[0]).toMatchObject({
        text: "grazie mille!",
        reason: "testo dopo la riga FINE",
      })
    })

    it("reports text left over on the same line after FINE, still joined", () => {
      const answer = `${joinedIntoOneLine("Veldor;Marta;12/03/2010;16;")} grazie!`
      const result = parseRosterPaste(answer, OPTIONS)
      expect(result.complete).toBe(true)
      expect(result.candidates).toHaveLength(1)
      expect(result.candidates[0]!.surname).toBe("Veldor")
      expect(result.unparsed).toHaveLength(1)
      expect(result.unparsed[0]).toMatchObject({
        text: "grazie!",
        reason: "testo dopo la riga FINE",
      })
    })

    it("reports text merged onto the same line before the header, still joined", () => {
      const answer = `Ecco l’elenco: ${joinedIntoOneLine("Veldor;Marta;12/03/2010;16;")}`
      const result = parseRosterPaste(answer, OPTIONS)
      expect(result.candidates).toHaveLength(1)
      expect(result.candidates[0]!.surname).toBe("Veldor")
      expect(result.unparsed).toHaveLength(1)
      expect(result.unparsed[0]!.reason).toBe("testo prima del blocco")
      // The marker itself is not a separate physical line here, so the
      // reported text still carries it alongside the real preface; only an
      // exact, lone marker line is recognized and left out (as it is in the
      // normal path).
      expect(result.unparsed[0]!.text).toContain("Ecco l’elenco:")
    })
  })

  // Age only, in every mode (owner decision 2026-09-28): the paste is
  // trusted, so a printed age always wins, even against a date it disagrees
  // with, and the date itself never survives on the candidate to raise a
  // conflict later in the review.
  it("takes the printed age over a disagreeing date, and keeps no date at all", () => {
    const answer = [
      ROSTER_PASTE_BEGIN,
      ROSTER_PASTE_HEADER,
      "Veldor;Marta;12/03/2010;40;",
      ROSTER_PASTE_END,
    ].join("\n")
    const candidate = parseRosterPaste(answer, OPTIONS).candidates[0]!
    expect(candidate.dateOfBirth).toBe("")
    expect(candidate.ageReading).toEqual({ value: 40, confidence: 100 })
    expect(candidate.confidence.dateOfBirth).toBe(0)
  })
})
