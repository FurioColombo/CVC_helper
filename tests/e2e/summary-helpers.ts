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
