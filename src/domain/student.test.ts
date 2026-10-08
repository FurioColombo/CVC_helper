import { describe, expect, it } from "vitest"

import { PLAUSIBLE_SCAN_AGE } from "@/capabilities/studentScanReview"
import {
  calculateAge,
  calculateStudentAge,
  compareItalianNames,
  compareStudentsForList,
  getStudentDisplayName,
  isMinor,
  isPlausibleStudentAge,
  isStudentMinor,
  isValidDateOnly,
  PLAUSIBLE_STUDENT_AGE,
  resolveStudentAge,
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

describe("date-only validity", () => {
  it.each([
    ["2010-02-28", true],
    ["2012-02-29", true],
    ["2011-02-29", false],
    ["2010-13-01", false],
    ["20140-02-16", false],
    ["2010-2-16", false],
    ["", false],
  ])("treats %s as valid: %s", (value, expected) => {
    expect(isValidDateOnly(value)).toBe(expected)
  })
})

// UG2-FUN-4: the distinguishing length can end on a particle's own space
// ("De Rossi" against "Del Rossi"); the abbreviation dot must not float.
describe("surname prefixes that end on a particle", () => {
  function names(surnames: string[]) {
    const students = surnames.map((surname) => ({
      firstName: "Gino",
      surname,
    }))
    return students.map((student) => getStudentDisplayName(student, students))
  }

  it.each([
    [
      ["De Rossi", "Del Rossi", "Della Rossi"],
      ["Gino De.", "Gino Del.", "Gino Dell."],
    ],
    [
      ["De Rossi", "Del Rossi"],
      ["Gino De.", "Gino Del."],
    ],
    [
      ["Lo Presti", "Loi"],
      ["Gino Lo.", "Gino Loi"],
    ],
    // The spec's own examples keep the particle and the next letter.
    [
      ["De Rossi", "De Luca"],
      ["Gino De R.", "Gino De L."],
    ],
    [
      ["Lo Presti", "Lo Prete"],
      ["Gino Lo Pres.", "Gino Lo Pret."],
    ],
  ])("shows %j as %j", (surnames, expected) => {
    const shown = names(surnames)
    expect(shown).toEqual(expected)
    shown.forEach((name) => expect(name).not.toMatch(/\s\./))
  })
})

// UG2-DAT-1: an age a screen can show, or none, and never an exception.
describe("resolving a student's age", () => {
  const START = "2026-08-29"

  it.each([
    [{ dateOfBirth: "2008-08-29" }, 18],
    [{ dateOfBirth: "2008-08-30" }, 17],
    // Surrounding spaces were accepted by the invariant checker but threw in
    // the age calculation.
    [{ dateOfBirth: " 2008-08-29 " }, 18],
    [{ dateOfBirth: "", declaredAgeAtCourseStart: 17 }, 17],
    [{ dateOfBirth: null, declaredAgeAtCourseStart: 0 }, 0],
    // A real birth date still wins over a declared age.
    [{ dateOfBirth: "2008-08-29", declaredAgeAtCourseStart: 12 }, 18],
  ])("reads %j as %s", (student, expected) => {
    expect(resolveStudentAge(student, START)).toBe(expected)
  })

  it.each(["2000-02-30", "0002-03-12", "20000-03-12", "12/03/2000", "abc"])(
    "knows no age for the stored birth date %s, and is not a minor",
    (dateOfBirth) => {
      expect(resolveStudentAge({ dateOfBirth }, START)).toBeNull()
      expect(isStudentMinor({ dateOfBirth }, START)).toBe(false)
    },
  )

  it("ignores an unusable birth date in favour of a valid declared age", () => {
    const student = { dateOfBirth: "2000-02-30", declaredAgeAtCourseStart: 16 }
    expect(resolveStudentAge(student, START)).toBe(16)
    expect(isStudentMinor(student, START)).toBe(true)
  })

  it.each([-1, 16.5, 121, Number.NaN])(
    "knows no age for the declared age %s",
    (declaredAgeAtCourseStart) => {
      expect(
        resolveStudentAge({ dateOfBirth: "", declaredAgeAtCourseStart }, START),
      ).toBeNull()
    },
  )

  it("still treats a missing age as an error where one is required", () => {
    expect(() => calculateStudentAge({ dateOfBirth: "" }, START)).toThrow(
      "Student requires a birth date or declared course-start age",
    )
    expect(calculateStudentAge({ dateOfBirth: " 2008-08-29 " }, START)).toBe(18)
  })
})

// UG2-FUN-6: one plausible range for every way of entering an age.
describe("plausible ages", () => {
  it.each([
    [0, false],
    [3, false],
    [4, true],
    [18, true],
    [99, true],
    [100, false],
    [120, false],
    [17.5, false],
  ])("age %s is plausible: %s", (age, expected) => {
    expect(isPlausibleStudentAge(age)).toBe(expected)
  })

  it("is the range the scan review already calls plausible", () => {
    expect(PLAUSIBLE_SCAN_AGE).toBe(PLAUSIBLE_STUDENT_AGE)
    expect(PLAUSIBLE_STUDENT_AGE).toEqual({ min: 4, max: 99 })
  })
})

// UG2-FUN-2: SQLite's NOCASE sorts every accented initial after the Z.
describe("ordering the student list", () => {
  const row = (
    surname: string,
    firstName = "Anna",
    extra: Partial<{ nickname: string | null; active: number }> = {},
  ) => ({ surname, firstName, nickname: null, active: 1, ...extra })

  it("sorts accented and non-ASCII surnames with their base letter", () => {
    const sorted = [
      row("Zanetti"),
      row("Šimunić"),
      row("Evola"),
      row("Álvarez"),
      row("Sala"),
      row("de Luca"),
      row("Abate"),
      row("Östergaard"),
      row("De Rosa"),
      row("Éva"),
    ]
      .sort(compareStudentsForList)
      .map(({ surname }) => surname)

    expect(sorted).toEqual([
      "Abate",
      "Álvarez",
      "de Luca",
      "De Rosa",
      "Éva",
      "Evola",
      "Östergaard",
      "Sala",
      "Šimunić",
      "Zanetti",
    ])
  })

  it("keeps active students first, then orders equal surnames by shown name", () => {
    const sorted = [
      row("Rossi", "Zeno", { active: 0 }),
      row("Rossi", "Mario", { nickname: "Zio" }),
      row("Bianchi", "Zoe"),
      row("Rossi", "Anna"),
      row("Rossi", "Mario"),
    ]
      .sort(compareStudentsForList)
      .map(({ surname, firstName, nickname }) => [
        surname,
        nickname ?? firstName,
      ])

    expect(sorted).toEqual([
      ["Bianchi", "Zoe"],
      ["Rossi", "Anna"],
      ["Rossi", "Mario"],
      ["Rossi", "Zio"],
      ["Rossi", "Zeno"],
    ])
  })

  it("compares names regardless of case and accents", () => {
    expect(compareItalianNames("élodie", "ELODIE")).toBe(0)
    expect(compareItalianNames("Édith", "Fabio")).toBeLessThan(0)
  })
})
