import { describe, expect, it } from "vitest"

import { calculateAge, getStudentDisplayName, isMinor } from "@/domain/student"

describe("student domain rules", () => {
  it.each([
    ["2008-08-29", "2026-08-29", 18],
    ["2008-08-30", "2026-08-29", 17],
    ["2000-12-31", "2026-01-01", 25],
  ])(
    "calculates age at the course start date",
    (birth, reference, expected) => {
      expect(calculateAge(birth, reference)).toBe(expected)
    },
  )

  it("derives minor status at the course boundary", () => {
    expect(isMinor("2008-08-30", "2026-08-29")).toBe(true)
    expect(isMinor("2008-08-29", "2026-08-29")).toBe(false)
  })

  it("uses first name when it is unique", () => {
    const students = [{ firstName: "Mario", surname: "Rossi" }]
    expect(getStudentDisplayName(students[0]!, students)).toBe("Mario")
  })

  it("adds surname initials when first names collide", () => {
    const students = [
      { firstName: "Mario", surname: "Rossi" },
      { firstName: " mario ", surname: "bianchi" },
    ]

    expect(getStudentDisplayName(students[0]!, students)).toBe("Mario R.")
    expect(getStudentDisplayName(students[1]!, students)).toBe("mario B.")
  })

  it("lets an explicit nickname override collision handling", () => {
    const students = [
      { firstName: "Mario", surname: "Rossi", nickname: "Marty" },
      { firstName: "Mario", surname: "Bianchi", nickname: null },
    ]

    expect(getStudentDisplayName(students[0]!, students)).toBe("Marty")
    expect(getStudentDisplayName(students[1]!, students)).toBe("Mario B.")
  })
})
