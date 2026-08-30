import { describe, expect, it } from "vitest"

import {
  getBoatOperationalState,
  getDefaultBoatType,
  hasUnresolvedFaults,
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

  it("parses one-time typed boat numbers without duplicates", () => {
    expect(parseBoatNumbers("2, 7\n11; 7 ; Quest A")).toEqual([
      "2",
      "7",
      "11",
      "Quest A",
    ])
  })

  it("derives warning state from unresolved faults independently of availability", () => {
    const faults = [{ state: "resolved" as const }, { state: "open" as const }]
    expect(hasUnresolvedFaults(faults)).toBe(true)
    expect(getBoatOperationalState("available", faults)).toBe("fault")
    expect(getBoatOperationalState("unavailable", faults)).toBe("unavailable")
    expect(getBoatOperationalState("available", [{ state: "resolved" }])).toBe(
      "clear",
    )
  })
})
