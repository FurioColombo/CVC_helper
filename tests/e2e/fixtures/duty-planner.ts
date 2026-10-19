import type { Page } from "@playwright/test"
import type { StudentInput } from "@/persistence/students"
import { bootstrapCourse } from "../seed"

const dutyStudents = Array.from({ length: 21 }, (_, offset) => {
  const index = offset + 1
  return {
    firstName: `Nome${index}`,
    surname: `Cognome${index}`,
    nickname: null,
    dateOfBirth: "",
    declaredAgeAtCourseStart: index === 1 || index === 5 ? 16 : 26,
    sex: index % 2 === 1 ? "female" : "male",
    phone: null,
    size: null,
    initialNote: null,
    courseNote: null,
  }
}) satisfies StudentInput[]

/** Builds the exact synthetic roster used by the duty-planning journey. */
export async function seedDutyPlannerCourse(page: Page) {
  await bootstrapCourse(page, "Deriva", 2)
  await page.evaluate(async (students) => {
    const seedModulePath = "/tests/e2e/seed.ts"
    const seedApi = (await import(
      /* @vite-ignore */ seedModulePath
    )) as typeof import("../seed")
    const courseApi = await seedApi.loadCourses()
    const studentApi = await seedApi.loadStudents()
    const course = await courseApi.getActiveCourse()
    if (!course) throw new Error("Duty planner seed requires an active course")
    await studentApi.createStudents(course.id, students)
  }, dutyStudents)
}
