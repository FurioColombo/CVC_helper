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

  it("shows the shortest surname prefixes that distinguish matching initials", () => {
    const students = [
      { firstName: "Mario", surname: "Rossi" },
      { firstName: "Mario", surname: "Rocchi" },
      { firstName: "Mario", surname: "Rota" },
    ]

    expect(
      students.map((student) => getStudentDisplayName(student, students)),
    ).toEqual(["Mario Ros.", "Mario Roc.", "Mario Rot."])
  })

  it("uses the full shorter surname when one surname prefixes another", () => {
    const students = [
      { firstName: "Mario", surname: "Ro" },
      { firstName: "Mario", surname: "Rossi" },
    ]

    expect(
      students.map((student) => getStudentDisplayName(student, students)),
    ).toEqual(["Mario Ro", "Mario Ros."])
  })

  it("gives exact duplicate names stable ordinals based on student IDs", () => {
    const duplicateWithLaterId = {
      id: "student-z",
      firstName: "Mario",
      surname: "Rossi",
    }
    const duplicateWithEarlierId = {
      id: "student-a",
      firstName: "Mario",
      surname: "Rossi",
    }
    const students = [duplicateWithLaterId, duplicateWithEarlierId]

    expect(getStudentDisplayName(duplicateWithLaterId, students)).toBe(
      "Mario Rossi (2)",
    )
    expect(getStudentDisplayName(duplicateWithEarlierId, students)).toBe(
      "Mario Rossi (1)",
    )
    expect(
      getStudentDisplayName(duplicateWithEarlierId, [...students].reverse()),
    ).toBe("Mario Rossi (1)")
  })

  it("normalizes accents for collision detection and keeps suffix order stable", () => {
    const withoutAccent = {
      id: "student-a",
      firstName: "Jose",
      surname: "Alvarez",
    }
    const withAccent = {
      id: "student-b",
      firstName: "José",
      surname: "Álvarez",
    }
    const students = [withAccent, withoutAccent]

    expect(getStudentDisplayName(withAccent, students)).toBe("José Álvarez (2)")
    expect(getStudentDisplayName(withoutAccent, students)).toBe(
      "Jose Alvarez (1)",
    )
  })

  it("lets an explicit nickname override collision handling", () => {
    const students = [
      { firstName: "Mario", surname: "Rossi", nickname: "Marty" },
      { firstName: "Mario", surname: "Bianchi", nickname: null },
    ]

    expect(getStudentDisplayName(students[0]!, students)).toBe("Marty")
    expect(getStudentDisplayName(students[1]!, students)).toBe("Mario B.")
  })

  it("keeps duplicate nicknames and distinguishes them with stable ordinals", () => {
    const first = {
      id: "student-a",
      firstName: "Mario",
      surname: "Rossi",
      nickname: "Marty",
    }
    const second = {
      id: "student-b",
      firstName: "Marco",
      surname: "Bianchi",
      nickname: "Marty",
    }
    const students = [second, first]

    expect(getStudentDisplayName(first, students)).toBe("Marty (1)")
    expect(getStudentDisplayName(second, students)).toBe("Marty (2)")
  })
})
