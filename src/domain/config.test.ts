import { describe, expect, it } from "vitest"

import {
  BOAT_TYPES,
  COURSE_CONFIG,
  DUTY_DAYS,
  SESSION_SEQUENCE,
  SIZE_WARNING_MATRIX,
  STUDENT_SEXES,
  STUDENT_SIZES,
} from "@/domain/config"

describe("canonical domain configuration", () => {
  it("contains the normative course boat defaults", () => {
    expect(
      Object.fromEntries(
        Object.entries(COURSE_CONFIG).map(([code, config]) => [
          code,
          config.defaultBoatType,
        ]),
      ),
    ).toEqual({
      D1: "RS Toura",
      D2: "RS Quest",
      D3: "RS Quest",
      D4: "Laser Vago",
      D5: "RS 500",
      C1: "J/80",
      C2: "First 25.7",
      C3: "First 27",
    })
    for (const config of Object.values(COURSE_CONFIG)) {
      expect(BOAT_TYPES).toContain(config.defaultBoatType)
    }
  })

  it("uses the thirteen sailing sessions and seven duty rotations", () => {
    expect(SESSION_SEQUENCE).toHaveLength(13)
    expect(SESSION_SEQUENCE.at(0)?.id).toBe("sat-pm")
    expect(SESSION_SEQUENCE.at(-1)?.id).toBe("fri-pm")
    expect(DUTY_DAYS).toHaveLength(7)
    expect(DUTY_DAYS.map(({ id }) => id)).toEqual([
      "saturday",
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
    ])
  })

  it("defines the directly editable student sex choices", () => {
    expect(STUDENT_SEXES.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "male", label: "M" },
      { id: "female", label: "F" },
      { id: "other", label: "Altro" },
    ])
  })

  it("defines a complete symmetric size warning matrix", () => {
    for (const left of STUDENT_SIZES) {
      for (const right of STUDENT_SIZES) {
        expect(SIZE_WARNING_MATRIX[left][right]).toBe(
          SIZE_WARNING_MATRIX[right][left],
        )
      }
    }
    expect(SIZE_WARNING_MATRIX.XS.XS).toBe("red")
    expect(SIZE_WARNING_MATRIX.XS.M).toBe("yellow")
    expect(SIZE_WARNING_MATRIX.S.M).toBe("none")
    expect(SIZE_WARNING_MATRIX.L.L).toBe("yellow")
    expect(SIZE_WARNING_MATRIX.XL.XL).toBe("red")
  })
})
