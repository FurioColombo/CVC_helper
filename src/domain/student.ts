export interface StudentIdentity {
  id?: string
  firstName: string
  surname: string
  nickname?: string | null
}

export interface StudentAgeSource {
  dateOfBirth?: string | null
  declaredAgeAtCourseStart?: number | null
}

export const MAX_DECLARED_STUDENT_AGE = 120

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error(`Invalid date-only value: ${value}`)
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

function normalizedName(value: string) {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("it-IT")
}

function normalizedGraphemes(value: string) {
  return Array.from(value.normalize("NFC"), (grapheme) =>
    normalizedName(grapheme),
  )
}

function getNickname(student: StudentIdentity) {
  return student.nickname?.trim() ?? ""
}

function getSurnameInitialKey(surname: string) {
  const initial = Array.from(surname.trim().normalize("NFC"))[0] ?? ""
  return normalizedName(initial)
}

function formatSurnamePrefix(surname: string, length: number) {
  const prefix = Array.from(surname.trim().normalize("NFC"))
    .slice(0, length)
    .join("")
  const firstGrapheme = Array.from(prefix)[0]
  if (!firstGrapheme) return ""
  return `${firstGrapheme.toLocaleUpperCase("it-IT")}${prefix.slice(firstGrapheme.length)}`
}

function shortestDistinguishingSurnameLengths(surnames: readonly string[]) {
  const lengths = surnames.map(() => 1)
  const normalized = surnames.map(normalizedGraphemes)

  for (let left = 0; left < surnames.length; left += 1) {
    for (let right = left + 1; right < surnames.length; right += 1) {
      const leftName = normalized[left]!
      const rightName = normalized[right]!
      let commonLength = 0
      while (
        commonLength < leftName.length &&
        commonLength < rightName.length &&
        leftName[commonLength] === rightName[commonLength]
      ) {
        commonLength += 1
      }

      if (commonLength < Math.min(leftName.length, rightName.length)) {
        const distinguishingLength = commonLength + 1
        lengths[left] = Math.max(lengths[left]!, distinguishingLength)
        lengths[right] = Math.max(lengths[right]!, distinguishingLength)
      } else if (leftName.length !== rightName.length) {
        const shorterIndex = leftName.length < rightName.length ? left : right
        const longerIndex = shorterIndex === left ? right : left
        lengths[shorterIndex] = Math.max(
          lengths[shorterIndex]!,
          normalized[shorterIndex]!.length,
        )
        lengths[longerIndex] = Math.max(
          lengths[longerIndex]!,
          normalized[shorterIndex]!.length + 1,
        )
      } else {
        // Exact or accent-only duplicates need the full surname. A stable
        // ordinal below resolves the remaining collision.
        lengths[left] = Math.max(lengths[left]!, leftName.length)
        lengths[right] = Math.max(lengths[right]!, rightName.length)
      }
    }
  }

  return lengths
}

function compareStableIdentity(
  left: { student: StudentIdentity; index: number },
  right: { student: StudentIdentity; index: number },
) {
  const leftId = left.student.id?.trim() ?? ""
  const rightId = right.student.id?.trim() ?? ""
  if (leftId !== rightId) {
    if (!leftId) return 1
    if (!rightId) return -1
    return leftId < rightId ? -1 : 1
  }

  const leftIdentity = [
    left.student.firstName,
    left.student.surname,
    getNickname(left.student),
  ]
    .map(normalizedName)
    .join("\u0000")
  const rightIdentity = [
    right.student.firstName,
    right.student.surname,
    getNickname(right.student),
  ]
    .map(normalizedName)
    .join("\u0000")
  if (leftIdentity !== rightIdentity)
    return leftIdentity < rightIdentity ? -1 : 1
  return left.index - right.index
}

function getDisplayNames(students: readonly StudentIdentity[]) {
  const displayNames = students.map((student) => {
    const nickname = getNickname(student)
    return nickname || student.firstName.trim()
  })

  const givenNameGroups = new Map<string, number[]>()
  students.forEach((student, index) => {
    const key = normalizedName(student.firstName)
    const group = givenNameGroups.get(key) ?? []
    group.push(index)
    givenNameGroups.set(key, group)
  })

  for (const group of givenNameGroups.values()) {
    if (group.length < 2) continue

    const withoutNickname = group.filter(
      (index) => !getNickname(students[index]!),
    )
    for (const index of withoutNickname) {
      const student = students[index]!
      const sameInitial = withoutNickname.filter(
        (candidateIndex) =>
          getSurnameInitialKey(students[candidateIndex]!.surname) ===
          getSurnameInitialKey(student.surname),
      )

      if (sameInitial.length < 2) {
        const initial = Array.from(student.surname.trim().normalize("NFC"))[0]
        displayNames[index] = initial
          ? `${student.firstName.trim()} ${initial.toLocaleUpperCase("it-IT")}.`
          : student.firstName.trim()
        continue
      }

      const surnames = sameInitial.map(
        (candidateIndex) => students[candidateIndex]!.surname,
      )
      const lengths = shortestDistinguishingSurnameLengths(surnames)
      const position = sameInitial.indexOf(index)
      const prefix = formatSurnamePrefix(student.surname, lengths[position]!)
      const surnameLength = Array.from(
        student.surname.trim().normalize("NFC"),
      ).length
      const abbreviation = lengths[position]! < surnameLength ? "." : ""
      displayNames[index] = prefix
        ? `${student.firstName.trim()} ${prefix}${abbreviation}`
        : student.firstName.trim()
    }
  }

  const displayNameGroups = new Map<string, number[]>()
  displayNames.forEach((name, index) => {
    const key = normalizedName(name)
    const group = displayNameGroups.get(key) ?? []
    group.push(index)
    displayNameGroups.set(key, group)
  })

  for (const group of displayNameGroups.values()) {
    if (group.length < 2) continue
    const ordered = group
      .map((index) => ({ student: students[index]!, index }))
      .sort(compareStableIdentity)
    ordered.forEach(({ index }, position) => {
      displayNames[index] = `${displayNames[index]} (${position + 1})`
    })
  }

  return displayNames
}

export function calculateAge(dateOfBirth: string, referenceDate: string) {
  const birth = parseDateOnly(dateOfBirth)
  const reference = parseDateOnly(referenceDate)
  let age = reference.year - birth.year
  const birthdayHasPassed =
    reference.month > birth.month ||
    (reference.month === birth.month && reference.day >= birth.day)

  if (!birthdayHasPassed) age -= 1
  return age
}

export function isMinor(dateOfBirth: string, referenceDate: string) {
  return calculateAge(dateOfBirth, referenceDate) < 18
}

/**
 * Resolves age for a course-scoped student. A real birth date always wins and
 * continues to progress at the supplied course boundary. Without one, the
 * declared completed age is fixed to the course's first day and does not
 * progress when a downstream session uses another reference date.
 */
export function calculateStudentAge(
  student: StudentAgeSource,
  courseStartDate: string,
) {
  if (student.dateOfBirth?.trim()) {
    return calculateAge(student.dateOfBirth, courseStartDate)
  }
  const age = student.declaredAgeAtCourseStart
  if (age === null || age === undefined) {
    throw new Error(
      "Student requires a birth date or declared course-start age",
    )
  }
  if (!Number.isInteger(age) || age < 0 || age > MAX_DECLARED_STUDENT_AGE) {
    throw new Error("Invalid declared age at course start")
  }
  return age
}

export function isStudentMinor(
  student: StudentAgeSource,
  courseStartDate: string,
) {
  return calculateStudentAge(student, courseStartDate) < 18
}

export function getStudentDisplayName<T extends StudentIdentity>(
  student: T,
  students: readonly T[],
) {
  const currentIndex = student.id
    ? students.findIndex((candidate) => candidate.id === student.id)
    : students.indexOf(student)
  const index = currentIndex >= 0 ? currentIndex : students.length
  const pool = currentIndex >= 0 ? students : [...students, student]
  return getDisplayNames(pool)[index] ?? student.firstName.trim()
}
