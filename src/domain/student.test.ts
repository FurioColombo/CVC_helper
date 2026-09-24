import { describe, expect, it } from "vitest"

import {
  calculateAge,
  calculateStudentAge,
  getStudentDisplayName,
  isMinor,
  isStudentMinor,
} from "@/domain/student"

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

  it("uses the declared course-start age without birthday progression", () => {
    const student = {
      dateOfBirth: "",
      declaredAgeAtCourseStart: 17,
    }

    expect(calculateStudentAge(student, "2026-08-29")).toBe(17)
    expect(calculateStudentAge(student, "2027-08-30")).toBe(17)
    expect(isStudentMinor(student, "2027-08-30")).toBe(true)
  })

  it("keeps a real date of birth authoritative over any declared age", () => {
    const student = {
      dateOfBirth: "2008-08-29",
      declaredAgeAtCourseStart: 12,
    }

    expect(calculateStudentAge(student, "2026-08-29")).toBe(18)
    expect(isStudentMinor(student, "2026-08-29")).toBe(false)
  })

  it("rejects a student with neither a birth date nor a valid declared age", () => {
    expect(() => calculateStudentAge({}, "2026-08-29")).toThrow(
      "Student requires a birth date or declared course-start age",
    )
    expect(() =>
      calculateStudentAge({ declaredAgeAtCourseStart: 16.5 }, "2026-08-29"),
    ).toThrow("Invalid declared age at course start")
    expect(() =>
      calculateStudentAge({ declaredAgeAtCourseStart: 121 }, "2026-08-29"),
    ).toThrow("Invalid declared age at course start")
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
