import type { Page } from "@playwright/test"

/**
 * UG2's hostile fictitious roster: a D2 course of 40 students (plus five
 * volunteers) written to break layouts. Every name is invented; none belongs
 * to a real person. The shapes are on purpose: names of 18-25 letters,
 * double and triple first names, multi-word surnames with particles (De, Di,
 * Lo, Dalla, Della, Dal, Van der), straight and curly apostrophes, hyphens,
 * accents and other Latin diacritics, two same-first-name groups that trigger
 * every branch of the disambiguation rule (an initial, a surname prefix, and
 * two identical names that need an ordinal), nicknames, minors (age-only and
 * from a stored birth date), a 17-year-old who turns 18 on the fourth day,
 * and an 18-year-old on the first. Seeded through the app's own persistence
 * like `summary-helpers.ts`.
 */

export type HostileStudent = {
  firstName: string
  surname: string
  nickname?: string
  /** Completed years on the course's first day. */
  age: number
  /** `stored`: a real birth date (as 0.2.0 kept) instead of a declared age;
   *  `turns-18-on-day-4`: the 18th birthday falls on the course's fourth day. */
  birth?: "stored" | "turns-18-on-day-4"
  sex: "male" | "female" | "other"
  size: "XS" | "S" | "M" | "L" | "XL"
  tags: string[]
}

const t = (...tags: string[]) => tags

export const HOSTILE_STUDENTS: HostileStudent[] = [
  // 1-4: names that do not fit a column.
  {
    firstName: "Alessandromassimiliano",
    surname: "Montefeltrodellarovere",
    age: 31,
    sex: "male",
    size: "L",
    tags: t("long-first-name", "long-surname"),
  },
  {
    firstName: "Pierfrancescoalessandro",
    surname: "Bevilacquaterzi",
    age: 27,
    sex: "male",
    size: "XL",
    tags: t("long-first-name", "long-surname"),
  },
  {
    firstName: "Costantinoemanuele",
    surname: "Passalacquafontana",
    age: 45,
    sex: "male",
    size: "M",
    tags: t("long-first-name", "long-surname"),
  },
  {
    firstName: "Gianfrancescomaria",
    surname: "Vanderschoorenberghe",
    age: 29,
    sex: "male",
    size: "S",
    tags: t("long-first-name", "long-surname"),
  },
  // 5-10: double and triple first names with particles.
  {
    firstName: "Maria Concetta Immacolata",
    surname: "De Santis",
    age: 52,
    sex: "female",
    size: "S",
    tags: t("double-first-name", "particle-surname"),
  },
  {
    firstName: "Giovanni Battista",
    surname: "Della Rovere",
    age: 33,
    sex: "male",
    size: "M",
    tags: t("double-first-name", "particle-surname"),
  },
  {
    firstName: "Gian Marco",
    surname: "Dalla Valle",
    age: 24,
    sex: "male",
    size: "M",
    tags: t("double-first-name", "particle-surname"),
  },
  {
    firstName: "Pier Luigi",
    surname: "De Angelis",
    age: 35,
    sex: "male",
    size: "L",
    tags: t("double-first-name", "particle-surname"),
  },
  {
    firstName: "Anna Maria",
    surname: "De Santis",
    age: 40,
    sex: "female",
    size: "S",
    tags: t("double-first-name", "particle-surname", "same-first-and-initial"),
  },
  {
    firstName: "Anna Maria",
    surname: "De Luca",
    age: 38,
    sex: "female",
    size: "M",
    tags: t("double-first-name", "particle-surname", "same-first-and-initial"),
  },
  // 11-14: apostrophes and hyphens.
  {
    firstName: "Niccolò",
    surname: "D'Angelo",
    age: 19,
    sex: "male",
    size: "M",
    tags: t("apostrophe", "diacritic"),
  },
  {
    firstName: "Giulia",
    surname: "Dell'Orto",
    age: 16,
    sex: "female",
    size: "S",
    tags: t("apostrophe", "minor", "particle-surname"),
  },
  {
    firstName: "Anna-Lisa",
    surname: "Montefeltro-Della Rovere",
    age: 22,
    sex: "female",
    size: "XS",
    tags: t("hyphen", "long-surname", "particle-surname"),
  },
  {
    firstName: "Jean-Baptiste",
    surname: "Lo Russo",
    age: 28,
    sex: "male",
    size: "L",
    tags: t("hyphen", "particle-surname"),
  },
  // 15-23: accents and other Latin diacritics.
  {
    firstName: "Çağla",
    surname: "Özdemir",
    age: 21,
    sex: "female",
    size: "S",
    tags: t("diacritic"),
  },
  {
    firstName: "Ñuño",
    surname: "Peña Álvarez",
    age: 30,
    sex: "male",
    size: "M",
    tags: t("diacritic", "multi-word-surname"),
  },
  {
    firstName: "Øystein",
    surname: "Ångström",
    age: 26,
    sex: "male",
    size: "XL",
    tags: t("diacritic"),
  },
  {
    firstName: "Łucja",
    surname: "Wiśniewska",
    age: 17,
    birth: "turns-18-on-day-4",
    sex: "female",
    size: "S",
    tags: t(
      "diacritic",
      "minor",
      "stored-birth-date",
      "turns-18-during-course",
    ),
  },
  {
    firstName: "Zoë",
    surname: "Van der Berg",
    age: 20,
    sex: "female",
    size: "M",
    tags: t("diacritic", "particle-surname", "multi-word-surname"),
  },
  {
    firstName: "Renée",
    surname: "Dal Pozzo",
    age: 34,
    birth: "stored",
    sex: "female",
    size: "S",
    tags: t("diacritic", "particle-surname", "stored-birth-date"),
  },
  {
    firstName: "José",
    surname: "Müller",
    age: 15,
    sex: "male",
    size: "M",
    tags: t("diacritic", "minor"),
  },
  {
    firstName: "Šimon",
    surname: "Đurđević",
    age: 36,
    sex: "male",
    size: "L",
    tags: t("diacritic"),
  },
  {
    firstName: "Ștefan",
    surname: "Țepeș",
    age: 25,
    sex: "male",
    size: "M",
    tags: t("diacritic"),
  },
  // 24-28: same first name (an initial, a prefix, and identical names).
  {
    firstName: "Luca",
    surname: "Bianchi",
    age: 23,
    sex: "male",
    size: "M",
    tags: t("same-first-and-initial"),
  },
  {
    firstName: "Luca",
    surname: "Bellini",
    age: 14,
    sex: "male",
    size: "S",
    tags: t("same-first-and-initial", "minor"),
  },
  {
    firstName: "Luca",
    surname: "Greco",
    age: 41,
    sex: "male",
    size: "L",
    tags: t("same-first-name"),
  },
  {
    firstName: "Maria",
    surname: "Esposito",
    age: 32,
    sex: "female",
    size: "M",
    tags: t("identical-name"),
  },
  {
    firstName: "Maria",
    surname: "Esposito",
    age: 18,
    sex: "female",
    size: "S",
    tags: t("identical-name", "turns-18-before-course"),
  },
  // 29-31: nicknames.
  {
    firstName: "Luigi",
    surname: "Fontana",
    nickname: "Gigi",
    age: 47,
    sex: "male",
    size: "M",
    tags: t("nickname"),
  },
  {
    firstName: "Giacomo",
    surname: "Rinaldi",
    nickname: "Il Capitano",
    age: 39,
    birth: "stored",
    sex: "male",
    size: "L",
    tags: t("nickname", "stored-birth-date"),
  },
  {
    firstName: "Francesco",
    surname: "Lombardi",
    nickname: "Fra",
    age: 17,
    sex: "male",
    size: "M",
    tags: t("nickname", "minor"),
  },
  // 32-40: the rest of a plain week.
  {
    firstName: "Elisabetta Margherita",
    surname: "Dalla Chiesa",
    age: 37,
    sex: "female",
    size: "S",
    tags: t("double-first-name", "particle-surname"),
  },
  {
    firstName: "Sofia",
    surname: "Lo Presti",
    age: 16,
    sex: "female",
    size: "M",
    tags: t("minor", "particle-surname"),
  },
  {
    firstName: "Marco",
    surname: "Di Pietro",
    age: 29,
    sex: "male",
    size: "L",
    tags: t("particle-surname"),
  },
  {
    firstName: "Chiara",
    surname: "Della Valle",
    age: 26,
    sex: "female",
    size: "XS",
    tags: t("particle-surname"),
  },
  {
    firstName: "Tommaso",
    surname: "De Marchi",
    age: 15,
    sex: "male",
    size: "M",
    tags: t("minor", "particle-surname"),
  },
  {
    firstName: "Federica",
    surname: "Lo Giudice",
    age: 44,
    sex: "female",
    size: "M",
    tags: t("particle-surname"),
  },
  {
    firstName: "Matteo",
    surname: "D’Angelo",
    age: 18,
    sex: "male",
    size: "M",
    tags: t("apostrophe", "particle-surname"),
  },
  {
    firstName: "Beatrice",
    surname: "Ferrari",
    age: 16,
    sex: "female",
    size: "S",
    tags: t("minor"),
  },
  {
    firstName: "Raffaele",
    surname: "Caruso",
    age: 28,
    sex: "male",
    size: "XL",
    tags: t("plain"),
  },
]

/** 1-based indices into `HOSTILE_STUDENTS`, as the plan below refers to them. */
export const HOSTILE_VOLUNTEERS = [
  { name: "Gian Maria Dalla Valle", role: "CT" },
  { name: "Concetta De Marinis", role: "ADV" },
  { name: "Hendrik Van der Linden", role: "IS" },
  { name: "Alessandro Montefeltro-Della Rovere", role: "ADV" },
  { name: "Ottavia Bassi", role: "CT" },
] as const

/** The session whose crews are composed: Tuesday PM, where Monday's duty
 *  students are "smontanti" (SM) and Tuesday's are "in comandata" (C). */
export const HOSTILE_SESSION = "tue-pm"

type CrewSpec = {
  boat: string | "mezzi" | "none"
  /** 1-based student numbers; "V1".."V5" are the volunteers above. */
  members: Array<number | `V${number}`>
}

export const HOSTILE_BOATS = [
  ["RS Toura", "4"],
  ["RS Toura", "7"],
  ["RS Toura", "9"],
  ["RS Quest", "12"],
  ["RS Quest", "15"],
  ["RS Quest", "18"],
  ["RS Quest", "21"],
  ["Laser Vago", "3"],
  ["Laser Vago", "6"],
  ["Laser Vago", "8"],
  ["RS 500", "2"],
  ["RS 500", "5"],
] as const
export const HOSTILE_UNAVAILABLE_BOAT = "RS Toura 7"
export const HOSTILE_FAULT_BOAT = "RS Quest 12"

export const HOSTILE_CREWS: CrewSpec[] = [
  { boat: "RS Toura 4", members: [1, 2] },
  { boat: "RS Toura 7", members: [3, 4] },
  { boat: "RS Toura 9", members: [5, "V2"] },
  { boat: "RS Quest 12", members: [6, 7] },
  { boat: "RS Quest 15", members: [8, "V1"] },
  { boat: "RS Quest 18", members: [9, 10] },
  { boat: "RS Quest 21", members: [11, 12] },
  { boat: "Laser Vago 3", members: [13, 14] },
  { boat: "Laser Vago 6", members: [15, 16] },
  { boat: "Laser Vago 8", members: [17, "V3"] },
  { boat: "RS 500 2", members: [18, 19] },
  { boat: "RS 500 5", members: [20, 21] },
  { boat: "mezzi", members: [22, 23] },
  { boat: "mezzi", members: [24, 25] },
  { boat: "none", members: [26, "V4"] },
]
export const HOSTILE_LAND = [27, 28, 29, 30, 31, 32, 33, 34]
/** Students left available (not placed): 35-40; volunteer V5 too. */
export const HOSTILE_AVAILABLE = [35, 36, 37, 38, 39, 40]

/** Duty days: 38 students on duty, the two "Anna Maria" off. */
export const HOSTILE_DUTIES: Record<string, number[]> = {
  saturday: [1, 2, 3, 4, 5],
  sunday: [11, 12, 13, 14, 15, 16],
  monday: [17, 18, 19, 20, 21, 22, 23],
  tuesday: [24, 25, 26, 27, 28],
  wednesday: [29, 30, 31, 32, 33],
  thursday: [34, 35, 36, 37, 38],
  friday: [39, 40, 6, 7, 8],
}

export function summarizeHostileRoster() {
  const count = (tag: string) =>
    HOSTILE_STUDENTS.filter(({ tags }) => tags.includes(tag)).length
  const crewsWithMembers = HOSTILE_CREWS
  const members = crewsWithMembers.flatMap(({ members }) => members)
  return {
    students: HOSTILE_STUDENTS.length,
    volunteers: HOSTILE_VOLUNTEERS.length,
    minors: count("minor"),
    withNickname: count("nickname"),
    storedBirthDate: count("stored-birth-date"),
    ageOnly: HOSTILE_STUDENTS.filter(({ birth }) => !birth).length,
    longFirstName: count("long-first-name"),
    longestFirstName: Math.max(
      ...HOSTILE_STUDENTS.map(({ firstName }) => firstName.length),
    ),
    longestSurname: Math.max(
      ...HOSTILE_STUDENTS.map(({ surname }) => surname.length),
    ),
    doubleFirstName: count("double-first-name"),
    particleSurname: count("particle-surname"),
    apostrophe: count("apostrophe"),
    hyphen: count("hyphen"),
    diacritic: count("diacritic"),
    sameFirstNameGroups: 3,
    crews: crewsWithMembers.length,
    boatCrews: crewsWithMembers.filter(
      ({ boat }) => boat !== "mezzi" && boat !== "none",
    ).length,
    mezziCrews: crewsWithMembers.filter(({ boat }) => boat === "mezzi").length,
    crewsWithoutBoat: crewsWithMembers.filter(({ boat }) => boat === "none")
      .length,
    studentsInCrews: members.filter((member) => typeof member === "number")
      .length,
    volunteersInCrews: members.filter((member) => typeof member === "string")
      .length,
    land: HOSTILE_LAND.length,
    available: HOSTILE_AVAILABLE.length,
    onDuty: Object.values(HOSTILE_DUTIES).flat().length,
  }
}

/** The day `date` + `days`, as YYYY-MM-DD, in UTC calendar arithmetic. */
function plusDays(date: string, days: number) {
  const moment = new Date(`${date}T00:00:00Z`)
  moment.setUTCDate(moment.getUTCDate() + days)
  return moment.toISOString().slice(0, 10)
}

/**
 * The birth date that makes `ageAtStart` completed years on `courseStart`
 * when the birthday falls `birthdayOffsetDays` days from it: 0 or negative is
 * a birthday already passed, positive is one in the course (the student
 * turns `ageAtStart + 1` that day).
 */
export function birthDateFor(
  courseStart: string,
  ageAtStart: number,
  birthdayOffsetDays: number,
) {
  const anniversary = plusDays(courseStart, birthdayOffsetDays)
  const [year, month, day] = anniversary.split("-").map(Number) as [
    number,
    number,
    number,
  ]
  const turned = birthdayOffsetDays > 0 ? ageAtStart + 1 : ageAtStart
  // 29 February has no anniversary in most years: use the 28th.
  const safeDay = month === 2 && day === 29 ? 28 : day
  return `${String(year - turned).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`
}

/**
 * Seeds the hostile course into the active course through the app's own
 * persistence and returns the ids it made. The page must already have an
 * active D2 course.
 */
export async function seedHostileRoster(page: Page) {
  return page.evaluate(
    async ({
      students,
      volunteers,
      boats,
      unavailableBoat,
      faultBoat,
      crews,
      land,
      duties,
      sessionId,
      birthDates,
    }) => {
      const courseModulePath = "/src/persistence/courses.ts"
      const studentsModulePath = "/src/persistence/students.ts"
      const volunteersModulePath = "/src/persistence/volunteers.ts"
      const boatsModulePath = "/src/persistence/boats.ts"
      const crewsModulePath = "/src/persistence/crews.ts"
      const dutiesModulePath = "/src/persistence/duties.ts"
      const courseApi = (await import(/* @vite-ignore */ courseModulePath)) as {
        getActiveCourse: () => Promise<{
          id: string
          startDate: string
          family: string
          level: number
        } | null>
      }
      const studentApi = (await import(
        /* @vite-ignore */ studentsModulePath
      )) as {
        createStudents: (
          courseId: string,
          entries: Array<Record<string, unknown>>,
        ) => Promise<Array<{ id: string }>>
      }
      const volunteerApi = (await import(
        /* @vite-ignore */ volunteersModulePath
      )) as {
        createVolunteer: (
          courseId: string,
          input: { name: string; role: string },
        ) => Promise<{ id: string }>
      }
      const boatApi = (await import(/* @vite-ignore */ boatsModulePath)) as {
        createBoats: (
          courseId: string,
          inputs: Array<{ type: string; number: string }>,
        ) => Promise<Array<{ id: string; type: string; number: string }>>
        setBoatAvailability: (
          boatId: string,
          courseId: string,
          availability: string,
        ) => Promise<void>
        createFault: (boatId: string, description: string) => Promise<unknown>
      }
      const crewApi = (await import(/* @vite-ignore */ crewsModulePath)) as {
        saveCrewPlan: (
          courseId: string,
          sessionId: string,
          plan: Record<string, unknown>,
        ) => Promise<unknown>
      }
      const dutyApi = (await import(/* @vite-ignore */ dutiesModulePath)) as {
        saveDutyPlan: (
          courseId: string,
          assignments: Array<{ dayId: string; studentId: string }>,
          settings: Record<string, unknown>,
        ) => Promise<unknown>
      }

      const course = await courseApi.getActiveCourse()
      if (!course || course.family !== "Deriva" || course.level !== 2) {
        throw new Error("The hostile roster needs an active D2 course")
      }

      const created = await studentApi.createStudents(
        course.id,
        students.map((student, index) => {
          const birthDate = birthDates[index] ?? null
          return {
            firstName: student.firstName,
            surname: student.surname,
            nickname: student.nickname ?? null,
            dateOfBirth: birthDate ?? "",
            declaredAgeAtCourseStart: birthDate ? null : student.age,
            sex: student.sex,
            phone: null,
            size: student.size,
            initialNote: null,
            courseNote: null,
          }
        }),
      )
      const studentId = (number: number) => created[number - 1]!.id

      const createdVolunteers: Array<{ id: string }> = []
      for (const volunteer of volunteers) {
        createdVolunteers.push(
          await volunteerApi.createVolunteer(course.id, volunteer),
        )
      }
      const volunteerId = (reference: string) =>
        createdVolunteers[Number(reference.slice(1)) - 1]!.id

      const createdBoats = await boatApi.createBoats(
        course.id,
        boats.map(([type, number]) => ({ type, number })),
      )
      const boatNamed = (name: string) =>
        createdBoats.find((boat) => `${boat.type} ${boat.number}` === name)!
      await boatApi.setBoatAvailability(
        boatNamed(unavailableBoat).id,
        course.id,
        "unavailable",
      )
      await boatApi.createFault(
        boatNamed(faultBoat).id,
        "Cima della randa consumata",
      )

      const plan = {
        crews: crews.map((crew) => ({
          id: crypto.randomUUID(),
          sessionId,
          members: crew.members.map((member) =>
            typeof member === "number"
              ? { personId: studentId(member), personType: "student" }
              : { personId: volunteerId(member), personType: "volunteer" },
          ),
          capacity: 2,
          destination:
            crew.boat === "mezzi"
              ? "mezzi"
              : crew.boat === "none"
                ? "unassigned"
                : "boat",
          boatId:
            crew.boat === "mezzi" || crew.boat === "none"
              ? null
              : boatNamed(crew.boat).id,
        })),
        landStudentIds: land.map(studentId),
        selectedBoatIds: createdBoats.map((boat) => boat.id),
      }
      await crewApi.saveCrewPlan(course.id, sessionId, plan)

      await dutyApi.saveDutyPlan(
        course.id,
        Object.entries(duties).flatMap(([dayId, numbers]) =>
          numbers.map((number) => ({ dayId, studentId: studentId(number) })),
        ),
        {
          desiredPerDay: 5,
          fewerDayIds: [],
          extraDayIds: ["sunday", "monday"],
          balanceMinors: false,
          balanceSex: false,
          tieBreaker: "alphabetical",
          stayOverStudentIds: [],
          completedDayIds: [],
          acknowledgedWarningKeys: [],
        },
      )
      return {
        courseStart: course.startDate,
        studentIds: created.map(({ id }) => id),
      }
    },
    {
      students: HOSTILE_STUDENTS,
      volunteers: [...HOSTILE_VOLUNTEERS],
      boats: [...HOSTILE_BOATS],
      unavailableBoat: HOSTILE_UNAVAILABLE_BOAT,
      faultBoat: HOSTILE_FAULT_BOAT,
      crews: HOSTILE_CREWS,
      land: HOSTILE_LAND,
      duties: HOSTILE_DUTIES,
      sessionId: HOSTILE_SESSION,
      // Birth dates depend on the course's first day, which is the current
      // ISO week's Saturday: computed in the page from `getActiveCourse`.
      birthDates: await hostileBirthDates(page),
    },
  )
}

/** Stored birth dates for the students that have one, by index (else null). */
async function hostileBirthDates(page: Page): Promise<Array<string | null>> {
  const courseStart = await page.evaluate(async () => {
    const courseModulePath = "/src/persistence/courses.ts"
    const courseApi = (await import(/* @vite-ignore */ courseModulePath)) as {
      getActiveCourse: () => Promise<{ startDate: string } | null>
    }
    const course = await courseApi.getActiveCourse()
    if (!course) throw new Error("The hostile roster needs an active course")
    return course.startDate
  })
  return HOSTILE_STUDENTS.map((student) =>
    student.birth === "turns-18-on-day-4"
      ? birthDateFor(courseStart, student.age, 3)
      : student.birth === "stored"
        ? birthDateFor(courseStart, student.age, -20)
        : null,
  )
}
