import type { Page } from "@playwright/test"
import type { BoatInput } from "@/persistence/boats"
import type { StudentInput } from "@/persistence/students"
import { bootstrapCourse } from "../seed"

const assignmentBoats = Array.from({ length: 10 }, (_, index) => ({
  type: "RS Quest",
  number: String(index + 1),
})) satisfies BoatInput[]

const assignmentStudents = [
  {
    firstName: "Aldo",
    surname: "Rossi",
    nickname: null,
    dateOfBirth: "",
    declaredAgeAtCourseStart: 26,
    sex: "male",
    phone: null,
    size: null,
    initialNote: null,
    courseNote: null,
  },
  {
    firstName: "Bea",
    surname: "Verdi",
    nickname: null,
    dateOfBirth: "",
    declaredAgeAtCourseStart: 26,
    sex: "male",
    phone: null,
    size: null,
    initialNote: null,
    courseNote: null,
  },
] satisfies StudentInput[]

/** Seeds the exact roster and boat inventory for the crew assignment journey. */
export async function seedBoatAssignmentCourse(page: Page) {
  await bootstrapCourse(page, "Deriva", 2)
  await page.evaluate(
    async ({ boats, students }) => {
      const seedModulePath = "/tests/e2e/seed.ts"
      const seedApi = (await import(
        /* @vite-ignore */ seedModulePath
      )) as typeof import("../seed")
      const courseApi = await seedApi.loadCourses()
      const boatApi = await seedApi.loadBoats()
      const studentApi = await seedApi.loadStudents()
      const course = await courseApi.getActiveCourse()
      if (!course) {
        throw new Error("Boat assignment seed requires an active course")
      }
      await boatApi.createBoats(course.id, boats)
      await studentApi.createStudents(course.id, students)
    },
    { boats: assignmentBoats, students: assignmentStudents },
  )
}
