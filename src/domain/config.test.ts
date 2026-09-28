import { describe, expect, it } from "vitest"

import {
  BOAT_TYPE_CLASS_COLORS,
  BOAT_TYPES,
  COURSE_CONFIG,
  DUTY_DAYS,
  SESSION_DUTY_DAY,
  SESSION_SMONTANTE_DUTY_DAY,
  SESSION_SEQUENCE,
  SIZE_WARNING_MATRIX,
  STUDENT_SEXES,
  STUDENT_SIZES,
  VOLUNTEER_ROLES,
} from "@/domain/config"

/**
 * A from-scratch, dependency-free WCAG 2.x contrast computation (relative
 * luminance in https://www.w3.org/TR/WCAG21/#dfn-relative-luminance, ratio in
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio), kept independent of any
 * application code so this test cannot pass merely by agreeing with a shared
 * implementation bug.
 */
function hexToRgb(hex: string) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!match) throw new Error(`Not a #rrggbb colour: ${hex}`)
  return {
    r: parseInt(match[1]!, 16),
    g: parseInt(match[2]!, 16),
    b: parseInt(match[3]!, 16),
  }
}

function srgbChannelToLinear(channel8Bit: number) {
  const channel = channel8Bit / 255
  return channel <= 0.03928
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  )
}

function contrastRatio(hexA: string, hexB: string) {
  const lighter = Math.max(relativeLuminance(hexA), relativeLuminance(hexB))
  const darker = Math.min(relativeLuminance(hexA), relativeLuminance(hexB))
  return (lighter + 0.05) / (darker + 0.05)
}

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
    expect(SESSION_SEQUENCE.map(({ id }) => SESSION_DUTY_DAY[id])).toEqual([
      "saturday",
      "saturday",
      "sunday",
      "sunday",
      "monday",
      "monday",
      "tuesday",
      "tuesday",
      "wednesday",
      "wednesday",
      "thursday",
      "thursday",
      "friday",
    ])
    expect(SESSION_SMONTANTE_DUTY_DAY).toEqual({
      "sun-pm": "saturday",
      "mon-pm": "sunday",
      "tue-pm": "monday",
      "wed-pm": "tuesday",
      "thu-pm": "wednesday",
      "fri-pm": "thursday",
    })
  })

  it("defines the directly editable student sex choices", () => {
    expect(STUDENT_SEXES.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "male", label: "M" },
      { id: "female", label: "F" },
      { id: "other", label: "Altro" },
    ])
  })

  it("defines every canonical volunteer role without widening student enums", () => {
    expect(VOLUNTEER_ROLES).toEqual(["ADV", "IS", "CT"])
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

  it("gives every boat type a class colour that reads on white (F3 C6)", () => {
    // R06 (docs/post-mvp/06_DESIGN_RULEBOOK.md): "large text" (the bold
    // ≥20px boat number the crew-summary card puts in this colour) needs at
    // least 3:1 against its background — here the card's white (#ffffff).
    for (const type of BOAT_TYPES) {
      const color = BOAT_TYPE_CLASS_COLORS[type]
      expect(color, `${type} has no class colour`).toMatch(/^#[0-9a-f]{6}$/i)
      expect(
        contrastRatio(color, "#ffffff"),
        `${type} (${color}) on white`,
      ).toBeGreaterThanOrEqual(3)
    }
  })
})
