import type { Page } from "@playwright/test"

/**
 * Synthetic courses for the summary specs (F3, F4), seeded through the app's
 * own persistence rather than 26 manual student forms. Every name and number
 * is invented.
 */

export const BOATS_BY_TYPE: Record<string, string[]> = {
  "RS Toura": ["4", "7", "9"],
  "RS Quest": ["12", "15", "18", "21"],
  "Laser Vago": ["3", "6"],
  "RS 500": ["2", "5"],
}
export const TOTAL_BOATS = Object.values(BOATS_BY_TYPE).flat().length // 11
export const MEZZI_CREW_COUNT = 2
export const TOTAL_CREWS = TOTAL_BOATS + MEZZI_CREW_COUNT // 13
export const MEMBERS_PER_CREW = 2
export const TOTAL_STUDENTS = TOTAL_CREWS * MEMBERS_PER_CREW

export async function seedThirteenCrewCourse(page: Page) {
  const seededStudents = Array.from({ length: TOTAL_STUDENTS }, (_, index) => ({
    firstName: `Allievo${String(index + 1).padStart(2, "0")}`,
    surname: "Prova",
    nickname: null,
    dateOfBirth: "2000-01-01",
    declaredAgeAtCourseStart: null,
    sex: "male",
    phone: null,
    size: null,
    initialNote: null,
    courseNote: null,
  }))

  await page.evaluate(
    async ({ students, boatsByType, membersPerCrew, mezziCrewCount }) => {
      // Each path goes through a variable rather than an inline string
      // literal: `import(<literal>)` is statically resolved by `tsc -b`
      // (which does not see the Vite-only ignore comment) and fails to find
      // these absolute dev-server paths, exactly as the 40-student stress
      // seed in c1-crew-management.spec.ts already works around.
      const courseModulePath = "/src/persistence/courses.ts"
      const studentsModulePath = "/src/persistence/students.ts"
      const boatsModulePath = "/src/persistence/boats.ts"
      const crewsModulePath = "/src/persistence/crews.ts"
      const courseApi = (await import(/* @vite-ignore */ courseModulePath)) as {
        getActiveCourse: () => Promise<{ id: string } | null>
      }
      const studentApi = (await import(
        /* @vite-ignore */ studentsModulePath
      )) as {
        createStudents: (
          courseId: string,
          entries: Array<Record<string, unknown>>,
        ) => Promise<Array<{ id: string }>>
      }
      const boatApi = (await import(/* @vite-ignore */ boatsModulePath)) as {
        createBoats: (
          courseId: string,
          inputs: Array<{ type: string; number: string }>,
        ) => Promise<Array<{ id: string; type: string; number: string }>>
      }
      const crewApi = (await import(/* @vite-ignore */ crewsModulePath)) as {
        saveCrewPlan: (
          courseId: string,
          sessionId: string,
          plan: {
            crews: Array<{
              id: string
              sessionId: string
              members: Array<{ personId: string; personType: string }>
              capacity: number
              destination: string
              boatId: string | null
            }>
            landStudentIds: string[]
            selectedBoatIds: string[]
          },
        ) => Promise<unknown>
      }
      const course = await courseApi.getActiveCourse()
      if (!course) {
        throw new Error("Synthetic 13-crew course requires an active course")
      }
      const createdStudents = await studentApi.createStudents(
        course.id,
        students,
      )
      const createdBoats: Array<{ id: string }> = []
      for (const [type, numbers] of Object.entries(boatsByType)) {
        const boats = await boatApi.createBoats(
          course.id,
          numbers.map((number) => ({ type, number })),
        )
        createdBoats.push(...boats)
      }

      let studentIndex = 0
      function nextMembers() {
        const members = Array.from({ length: membersPerCrew }, () => ({
          personId: createdStudents[studentIndex++]!.id,
          personType: "student",
        }))
        return members
      }

      const crews = [
        ...createdBoats.map((boat) => ({
          id: crypto.randomUUID(),
          sessionId: "sat-pm",
          members: nextMembers(),
          capacity: membersPerCrew,
          destination: "boat",
          boatId: boat.id,
        })),
        ...Array.from({ length: mezziCrewCount }, () => ({
          id: crypto.randomUUID(),
          sessionId: "sat-pm",
          members: nextMembers(),
          capacity: membersPerCrew,
          destination: "mezzi",
          boatId: null,
        })),
      ]

      await crewApi.saveCrewPlan(course.id, "sat-pm", {
        crews,
        landStudentIds: [],
        selectedBoatIds: createdBoats.map((boat) => boat.id),
      })
    },
    {
      students: seededStudents,
      boatsByType: BOATS_BY_TYPE,
      membersPerCrew: MEMBERS_PER_CREW,
      mezziCrewCount: MEZZI_CREW_COUNT,
    },
  )
}

export const D1_BOAT_TYPE = "RS Toura"
export const D1_BOAT_COUNT = 10
export const D1_MEMBERS_PER_CREW = 4

/**
 * D1's own default (`COURSE_CONFIG.D1.defaultBoatType`, no fixed standard
 * crew size so the app's own `getInitialCrewCapacity` falls back to 4): a
 * single-model, denser roster than the mixed 13-crew course above, seeded
 * the same way (through the app's own persistence, same pattern as the
 * 40-student stress case in c1-crew-management.spec.ts) so this exercises
 * the read view itself rather than 40 manual student forms. By default ten
 * boats numbered 1–10 with four students each; `numbers` and
 * `membersPerCrew` choose other boats (and so crews) and crew sizes.
 */
export async function seedTenCrewCourseD1(
  page: Page,
  options: { numbers?: string[]; membersPerCrew?: number } = {},
) {
  const boatNumbers =
    options.numbers ??
    Array.from({ length: D1_BOAT_COUNT }, (_, index) => String(index + 1))
  const crewSize = options.membersPerCrew ?? D1_MEMBERS_PER_CREW
  const seededStudents = Array.from(
    { length: boatNumbers.length * crewSize },
    (_, index) => ({
      firstName: `Allievo${String(index + 1).padStart(2, "0")}`,
      surname: "Prova",
      nickname: null,
      dateOfBirth: "2000-01-01",
      declaredAgeAtCourseStart: null,
      sex: "male",
      phone: null,
      size: null,
      initialNote: null,
      courseNote: null,
    }),
  )

  await page.evaluate(
    async ({ students, boatType, numbers, membersPerCrew }) => {
      // Same absolute-path-via-variable workaround as the 13-crew seed above:
      // `import(<literal>)` is statically resolved by `tsc -b`, which does
      // not see the Vite-only ignore comment, and fails to find these
      // dev-server-only paths.
      const studentsModulePath = "/src/persistence/students.ts"
      const boatsModulePath = "/src/persistence/boats.ts"
      const crewsModulePath = "/src/persistence/crews.ts"
      const courseModulePath = "/src/persistence/courses.ts"
      const courseApi = (await import(/* @vite-ignore */ courseModulePath)) as {
        getActiveCourse: () => Promise<{ id: string } | null>
      }
      const studentApi = (await import(
        /* @vite-ignore */ studentsModulePath
      )) as {
        createStudents: (
          courseId: string,
          entries: Array<Record<string, unknown>>,
        ) => Promise<Array<{ id: string }>>
      }
      const boatApi = (await import(/* @vite-ignore */ boatsModulePath)) as {
        createBoats: (
          courseId: string,
          inputs: Array<{ type: string; number: string }>,
        ) => Promise<Array<{ id: string; type: string; number: string }>>
      }
      const crewApi = (await import(/* @vite-ignore */ crewsModulePath)) as {
        saveCrewPlan: (
          courseId: string,
          sessionId: string,
          plan: {
            crews: Array<{
              id: string
              sessionId: string
              members: Array<{ personId: string; personType: string }>
              capacity: number
              destination: string
              boatId: string | null
            }>
            landStudentIds: string[]
            selectedBoatIds: string[]
          },
        ) => Promise<unknown>
      }
      const course = await courseApi.getActiveCourse()
      if (!course) {
        throw new Error("Synthetic 10-crew D1 course requires an active course")
      }
      const createdStudents = await studentApi.createStudents(
        course.id,
        students,
      )
      const createdBoats = await boatApi.createBoats(
        course.id,
        numbers.map((number) => ({ type: boatType, number })),
      )

      let studentIndex = 0
      const crews = createdBoats.map((boat) => ({
        id: crypto.randomUUID(),
        sessionId: "sat-pm",
        members: Array.from({ length: membersPerCrew }, () => ({
          personId: createdStudents[studentIndex++]!.id,
          personType: "student",
        })),
        capacity: membersPerCrew,
        destination: "boat",
        boatId: boat.id,
      }))

      await crewApi.saveCrewPlan(course.id, "sat-pm", {
        crews,
        landStudentIds: [],
        selectedBoatIds: createdBoats.map((boat) => boat.id),
      })
    },
    {
      students: seededStudents,
      boatType: D1_BOAT_TYPE,
      numbers: boatNumbers,
      membersPerCrew: crewSize,
    },
  )
}

/** Every name below is invented. These are shown as the people's own labels
 *  (a student's nickname is what the crew summary writes). */
export const DOUBLE_NAME_CREWS = {
  "RS Toura 4": [
    "Maria Chiara De Santis",
    "Anna Maria Lo Russo",
    "Gian Marco Dalla Valle",
  ],
  // The boat is unavailable: the card carries the red warning badge.
  "RS Toura 7": [
    "Francesca Romana Di Pietro",
    "Giovanni Battista Della Rovere",
    "Pier Luigi De Angelis",
  ],
  // Four names; the first is also a minor.
  "RS Quest 12": [
    "Alessandro Maria Giuseppe Rossi Bianchi",
    "Niccolò D’Angelo",
    "Çağla Özdemir",
    "Bartolomeo Montefeltro-Della Rovere",
  ],
  // Four names, one on duty today (C) and one who came off yesterday (SM).
  "RS Quest 15": [
    "Maria Grazia Lo Presti",
    "Luca",
    "Elisabetta De Luca",
    "Gian Carlo Dalla Chiesa",
  ],
  // Two students and a volunteer.
  "Laser Vago 3": ["Rosa Maria Dal Pozzo", "Ugo Bassani"],
  // A crew with people and no boat yet (and a minor).
  "Senza barca": [
    "Maria Teresa Di Stefano",
    "Anna Chiara Lo Giudice",
    "Giovanni Maria Della Valle",
  ],
  Mezzi: [
    "Carla Maria De Marchi",
    "Tommaso Lo Bianco",
    "Giuseppina Dalla Costa",
  ],
} as const
export const DOUBLE_NAME_LAND = ["Rosa Maria De Rosa"] as const
export const DOUBLE_NAME_AVAILABLE = [
  "Carlo Alberto Dalla Torre",
  "Ugo",
] as const
export const DOUBLE_NAME_SESSION = "sun-pm"

/**
 * A "Domenica PM" with the shapes that stress the summary: double first names
 * and surnames and a very long one, accents, three and four names a card, a
 * volunteer, minors, a card with no boat ("Equipaggi senza barca"), a card
 * with the red warning badge, a duty and a smontante badge, someone A terra,
 * students still available and an empty boat (the dashed list). Seeded through
 * the app's own persistence like the courses above.
 */
export async function seedDoubleNameCourse(page: Page) {
  await page.evaluate(
    async ({ crews, land, available, sessionId }) => {
      const courseModulePath = "/src/persistence/courses.ts"
      const studentsModulePath = "/src/persistence/students.ts"
      const volunteersModulePath = "/src/persistence/volunteers.ts"
      const boatsModulePath = "/src/persistence/boats.ts"
      const crewsModulePath = "/src/persistence/crews.ts"
      const dutiesModulePath = "/src/persistence/duties.ts"
      const courseApi = (await import(/* @vite-ignore */ courseModulePath)) as {
        getActiveCourse: () => Promise<{ id: string } | null>
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
      if (!course) throw new Error("The double-name course needs a course")

      const minors = new Set([
        "Alessandro Maria Giuseppe Rossi Bianchi",
        "Maria Teresa Di Stefano",
      ])
      const everyone = [
        ...Object.values(crews).flat(),
        ...land,
        ...available,
      ] as string[]
      const students = await studentApi.createStudents(
        course.id,
        everyone.map((label) => ({
          firstName: "Prova",
          surname: "Fittizio",
          nickname: label,
          dateOfBirth: minors.has(label) ? "2015-05-05" : "2000-01-01",
          declaredAgeAtCourseStart: null,
          sex: "male",
          phone: null,
          size: null,
          initialNote: null,
          courseNote: null,
        })),
      )
      const idOf = (label: string) => students[everyone.indexOf(label)]!.id

      const boats = await boatApi.createBoats(course.id, [
        { type: "RS Toura", number: "4" },
        { type: "RS Toura", number: "7" },
        { type: "RS Quest", number: "12" },
        { type: "RS Quest", number: "15" },
        { type: "Laser Vago", number: "3" },
        { type: "RS 500", number: "8" },
      ])
      const boatOf = (name: string) => {
        const split = name.lastIndexOf(" ")
        const type = name.slice(0, split)
        const number = name.slice(split + 1)
        return boats.find(
          (boat) => boat.type === type && boat.number === number,
        )
      }
      await boatApi.setBoatAvailability(
        boatOf("RS Toura 7")!.id,
        course.id,
        "unavailable",
      )
      const volunteers: Record<string, { id: string }> = {
        "Laser Vago 3": await volunteerApi.createVolunteer(course.id, {
          name: "Paolo",
          role: "CT",
        }),
        Mezzi: await volunteerApi.createVolunteer(course.id, {
          name: "Sofia Maria",
          role: "ADV",
        }),
      }

      const planCrews = Object.entries(crews).map(([name, labels]) => {
        const volunteer = volunteers[name]
        const members = [
          ...labels.map((label) => ({
            personId: idOf(label),
            personType: "student",
          })),
          ...(volunteer
            ? [{ personId: volunteer.id, personType: "volunteer" }]
            : []),
        ]
        return {
          id: crypto.randomUUID(),
          sessionId,
          members,
          capacity: members.length,
          destination:
            name === "Mezzi"
              ? "mezzi"
              : name === "Senza barca"
                ? "unassigned"
                : "boat",
          boatId: boatOf(name)?.id ?? null,
        }
      })
      await crewApi.saveCrewPlan(course.id, sessionId, {
        crews: planCrews,
        landStudentIds: land.map(idOf),
        selectedBoatIds: boats.map((boat) => boat.id),
      })

      // Sunday PM: Sunday's duty is "in comandata" (C), Saturday's came off
      // the day before ("smontante", SM).
      await dutyApi.saveDutyPlan(
        course.id,
        [
          { dayId: "sunday", studentId: idOf("Luca") },
          { dayId: "saturday", studentId: idOf("Gian Carlo Dalla Chiesa") },
        ],
        {
          desiredPerDay: 1,
          fewerDayIds: [],
          balanceMinors: false,
          balanceSex: false,
          tieBreaker: "alphabetical",
          stayOverStudentIds: [],
          completedDayIds: [],
          acknowledgedWarningKeys: [],
        },
      )
    },
    {
      crews: DOUBLE_NAME_CREWS,
      land: DOUBLE_NAME_LAND,
      available: DOUBLE_NAME_AVAILABLE,
      sessionId: DOUBLE_NAME_SESSION,
    },
  )
}
