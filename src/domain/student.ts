export interface StudentIdentity {
  firstName: string
  surname: string
  nickname?: string | null
}

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
  return value.trim().toLocaleLowerCase("it-IT")
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

export function getStudentDisplayName<T extends StudentIdentity>(
  student: T,
  students: readonly T[],
) {
  const nickname = student.nickname?.trim()
  if (nickname) return nickname

  const firstName = student.firstName.trim()
  const collisions = students.filter(
    (candidate) =>
      normalizedName(candidate.firstName) === normalizedName(student.firstName),
  )
  if (collisions.length < 2) return firstName

  const surnameInitial = Array.from(
    student.surname.trim(),
  )[0]?.toLocaleUpperCase("it-IT")
  return surnameInitial ? `${firstName} ${surnameInitial}.` : firstName
}
