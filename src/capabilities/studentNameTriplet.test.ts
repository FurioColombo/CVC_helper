import { describe, expect, it } from "vitest"
import { proposeStudentNameTripletSplit } from "./studentNameTriplet"

const GIVEN_NAMES = new Set(["Givena", "Giveno"])
// Test fixture mirrors the parser's canonical table. Production integration
// passes that table into the helper instead of keeping another copy.
const SURNAME_PARTICLES = new Set([
  "da",
  "dal",
  "dalla",
  "dall",
  "de",
  "dei",
  "degli",
  "del",
  "della",
  "delle",
  "di",
  "du",
  "la",
  "le",
  "van",
  "von",
])

function wordsInSourceOrder(
  split: { firstName: string; surname: string },
  order: "given-surname" | "surname-given",
) {
  const grouped =
    order === "given-surname"
      ? [split.firstName, split.surname]
      : [split.surname, split.firstName]
  return grouped.flatMap((name) => name.split(/\s+/).filter(Boolean))
}

describe("proposeStudentNameTripletSplit", () => {
  it.each([
    {
      label: "a leading surname particle in surname-first order",
      words: ["De", "Albor", "Giveno"] as const,
      order: "surname-given" as const,
      expected: { firstName: "Giveno", surname: "De Albor" },
      reason: "surname-particle",
    },
    {
      label: "a surname particle after the given name",
      words: ["Giveno", "Di", "Albor"] as const,
      order: "given-surname" as const,
      expected: { firstName: "Giveno", surname: "Di Albor" },
      reason: "surname-particle",
    },
    {
      label: "two explicitly recognized given names in given-first order",
      words: ["Givena", "Giveno", "Surnameq"] as const,
      order: "given-surname" as const,
      expected: { firstName: "Givena Giveno", surname: "Surnameq" },
      reason: "two-given-names",
    },
    {
      label: "two explicitly recognized given names in surname-first order",
      words: ["Surnameq", "Givena", "Giveno"] as const,
      order: "surname-given" as const,
      expected: { firstName: "Givena Giveno", surname: "Surnameq" },
      reason: "two-given-names",
    },
  ])(
    "resolves $label and preserves every token",
    ({ words, order, expected, reason }) => {
      const result = proposeStudentNameTripletSplit(words, order, {
        surnameParticles: SURNAME_PARTICLES,
        knownGivenNames: GIVEN_NAMES,
      })

      expect(result.candidate).toEqual(expected)
      expect(result.ambiguity).toBe(false)
      expect(result.reason).toBe(reason)
      expect(result.alternatives).toEqual([])
      expect(result.raw).toBe(words.join(" "))
      expect(result.words).toEqual(words)
      expect(wordsInSourceOrder(result.candidate, order)).toEqual([...words])
    },
  )

  it.each([
    {
      label: "a triplet with no particle or two-name evidence",
      words: ["Arvella", "Beluno", "Cendaro"] as const,
      order: "given-surname" as const,
      knownGivenNames: new Set<string>(),
      expected: { firstName: "Arvella", surname: "Beluno Cendaro" },
      alternative: { firstName: "Arvella Beluno", surname: "Cendaro" },
    },
    {
      label: "only one given-name cue in surname-first order",
      words: ["Surnameq", "Givena", "Cendaro"] as const,
      order: "surname-given" as const,
      knownGivenNames: GIVEN_NAMES,
      expected: { firstName: "Cendaro", surname: "Surnameq Givena" },
      alternative: { firstName: "Givena Cendaro", surname: "Surnameq" },
    },
    {
      label: "two adjacent particles that do not establish a boundary",
      words: ["De", "La", "Giveno"] as const,
      order: "surname-given" as const,
      knownGivenNames: GIVEN_NAMES,
      expected: { firstName: "Giveno", surname: "De La" },
      alternative: { firstName: "La Giveno", surname: "De" },
    },
    {
      label: "a surname-first particle that conflicts with two given names",
      words: ["De", "Givena", "Giveno"] as const,
      order: "surname-given" as const,
      knownGivenNames: GIVEN_NAMES,
      expected: { firstName: "Giveno", surname: "De Givena" },
      alternative: { firstName: "Givena Giveno", surname: "De" },
    },
    {
      label: "a surname-first triplet that could contain a middle given name",
      words: ["Surnameq", "Givena", "Beluno"] as const,
      order: "surname-given" as const,
      knownGivenNames: new Set<string>(),
      expected: { firstName: "Beluno", surname: "Surnameq Givena" },
      alternative: { firstName: "Givena Beluno", surname: "Surnameq" },
    },
  ])(
    "keeps $label visible and ambiguous",
    ({ words, order, knownGivenNames, expected, alternative }) => {
      const result = proposeStudentNameTripletSplit(words, order, {
        surnameParticles: SURNAME_PARTICLES,
        knownGivenNames,
      })

      expect(result.ambiguity).toBe(true)
      expect(result.candidate).toEqual(expected)
      expect(result.alternatives).toEqual([alternative])
      expect(result.raw).toBe(words.join(" "))
      expect(result.words).toEqual(words)
      for (const split of [result.candidate, ...result.alternatives]) {
        expect(wordsInSourceOrder(split, order)).toEqual([...words])
      }
    },
  )

  it("marks the particle-versus-two-given-name counterexample as conflicting", () => {
    const result = proposeStudentNameTripletSplit(
      ["De", "Givena", "Giveno"],
      "surname-given",
      {
        surnameParticles: SURNAME_PARTICLES,
        knownGivenNames: GIVEN_NAMES,
      },
    )

    expect(result.reason).toBe("conflicting-evidence")
    expect(result.candidate).toEqual({
      firstName: "Giveno",
      surname: "De Givena",
    })
    expect(result.alternatives).toEqual([
      { firstName: "Givena Giveno", surname: "De" },
    ])
  })
})
