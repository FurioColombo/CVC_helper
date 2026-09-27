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
      const lines = entry.answer.split(/\r\n|\r|\n/)
      // Every reported line is shown with its own text and a reason.
      for (const line of result.unparsed) {
        expect(lines[line.line - 1]?.trim()).toBe(line.text)
        expect(line.reason).not.toBe("")
      }
      // Nothing read from an assistant is ready without the operator's check.
      for (const candidate of result.candidates) {
        expect(candidate.rowWarning).toBe("from-assistant")
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
})
