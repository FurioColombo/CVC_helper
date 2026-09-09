import { describe, expect, it } from "vitest"

import {
  getBoatIdentityKey,
  getBoatOperationalState,
  getDefaultBoatType,
  hasUnresolvedFaults,
  normalizeBoatNumber,
  parseBoatNumbers,
} from "@/domain/boat"

describe("boat domain rules", () => {
  it.each([
    ["Deriva", 1, "RS Toura"],
    ["Deriva", 2, "RS Quest"],
    ["Deriva", 3, "RS Quest"],
    ["Deriva", 4, "Laser Vago"],
    ["Deriva", 5, "RS 500"],
    ["Cabinato", 1, "J/80"],
    ["Cabinato", 2, "First 25.7"],
    ["Cabinato", 3, "First 27"],
  ] as const)("maps %s level %s to %s", (family, level, expected) => {
    expect(getDefaultBoatType(family, level)).toBe(expected)
  })

  it("does not invent defaults for out-of-scope cabin levels", () => {
    expect(getDefaultBoatType("Cabinato", 4)).toBeNull()
    expect(getDefaultBoatType("Cabinato", 5)).toBeNull()
  })

  it.each([
    ["2, 7\n11; 7", ["2", "7", "11"]],
    ["2  7\t11\r\n14", ["2", "7", "11", "14"]],
    [",, 2;;;\n\t  7 , ; 11 ;;", ["2", "7", "11"]],
    ["07 7 ００７ A1 a1", ["7", "A1"]],
  ])("parses and collapses boat-number input %j", (input, expected) => {
    expect(parseBoatNumbers(input)).toEqual(expected)
  })

  it("normalizes numeric and textual boat identities deterministically", () => {
    expect(normalizeBoatNumber(" ００７ ")).toBe("7")
    expect(normalizeBoatNumber(" A1 ")).toBe("A1")
    expect(getBoatIdentityKey("RS Quest", "07")).toBe("RS Quest:7")
    expect(getBoatIdentityKey("RS Quest", " A1 ")).toBe("RS Quest:a1")
  })

  it.each([
    ["available", [], false, "clear"],
    ["available", [{ state: "resolved" }], false, "clear"],
    ["available", [{ state: "open" }], true, "fault"],
    ["available", [{ state: "reported" }], true, "fault"],
    ["unavailable", [], false, "unavailable"],
    ["unavailable", [{ state: "open" }], true, "unavailable"],
  ] as const)(
    "keeps %s availability independent with faults %j",
    (availability, faults, unresolved, expected) => {
      expect(hasUnresolvedFaults(faults)).toBe(unresolved)
      expect(getBoatOperationalState(availability, faults)).toBe(expected)
    },
  )
})
