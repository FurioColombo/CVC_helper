import type { Page } from "@playwright/test"
import type { DutyDayId, EvaluationSymbol, SessionId } from "@/domain/config"

/** Fictitious ordinary course: the names the review saw cut to initials. */
export const REVIEW_NAMES = [
  ["Marta", "Bruno", "female", 24],
  ["Federico", "Conti", "male", 31],
  ["Chiara", "De Luca", "female", 17],
  ["Matteo Maria", "Ferrari", "male", 29],
  ["Anna Lisa", "Gallo", "female", 45],
  ["Edoardo", "Greco", "male", 22],
  ["Giorgia", "Lombardi", "female", 27],
  ["Alessandro", "Marino", "male", 35],
  ["Valentina", "Barbieri", "female", 26],
  ["Davide", "Rinaldi", "male", 19],
  ["Elena", "Sala", "female", 33],
  ["Giulia", "Bianchi", "female", 16],
] as const

/** Seeds the names above through the app's persistence, one duty day each. */
export async function seedReviewNames(page: Page) {
  await page.evaluate(async (people) => {
    const seedModulePath = "/tests/e2e/seed.ts"
    const seedApi = (await import(
      /* @vite-ignore */ seedModulePath
    )) as typeof import("../seed")
    const courseApi = await seedApi.loadCourses()
    const studentApi = await seedApi.loadStudents()
    const dutyApi = await seedApi.loadDuties()
    const course = await courseApi.getActiveCourse()
    if (!course) throw new Error("Review names seed requires an active course")

    const created = await studentApi.createStudents(
      course.id,
      people.map(([firstName, surname, sex, age]) => ({
        firstName,
        surname,
        nickname: null,
        dateOfBirth: "",
        declaredAgeAtCourseStart: age,
        sex,
        phone: null,
        size: "M",
        initialNote: null,
        courseNote: null,
      })),
    )
    const days = [
      "saturday",
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
    ] as const satisfies readonly DutyDayId[]
    await dutyApi.saveDutyPlan(
      course.id,
      created.map((student, index) => {
        const dayId = days[index % days.length]
        if (!dayId) throw new Error(`Missing duty day for student ${index}`)
        return { dayId, studentId: student.id }
      }),
      {
        desiredPerDay: 2,
        fewerDayIds: [],
        extraDayIds: ["sunday", "monday", "tuesday", "wednesday", "thursday"],
        balanceMinors: false,
        balanceSex: false,
        tieBreaker: "alphabetical",
        stayOverStudentIds: [],
        completedDayIds: [],
        acknowledgedWarningKeys: [],
      },
    )
  }, REVIEW_NAMES)
  await page.reload()
}

/** Adds the details the profile and evaluation views need to display. */
export async function seedProfilesAndEvaluations(page: Page) {
  await page.evaluate(async () => {
    const seedModulePath = "/tests/e2e/seed.ts"
    const seedApi = (await import(
      /* @vite-ignore */ seedModulePath
    )) as typeof import("../seed")
    const courseApi = await seedApi.loadCourses()
    const studentApi = await seedApi.loadStudents()
    const evaluationApi = await seedApi.loadEvaluations()
    const course = await courseApi.getActiveCourse()
    if (!course) {
      throw new Error("Profile and evaluation seed requires an active course")
    }

    const students = await studentApi.listStudents(course.id)
    const sessions = [
      "sat-pm",
      "sun-am",
      "sun-pm",
      "mon-am",
      "tue-pm",
    ] as const satisfies readonly SessionId[]
    const values = [
      "++",
      "+",
      "=",
      "-",
      "--",
    ] as const satisfies readonly EvaluationSymbol[]
    for (let i = 0; i < students.length; i += 1) {
      const student = students[i]
      if (!student) throw new Error(`Missing student at index ${i}`)
      await studentApi.updateStudent(student.id, course.id, {
        firstName: student.firstName,
        surname: student.surname,
        nickname: student.nickname,
        dateOfBirth: student.dateOfBirth,
        declaredAgeAtCourseStart: student.declaredAgeAtCourseStart,
        sex: student.sex,
        phone: "+39 333 123 4567",
        size: student.size,
        initialNote: "Esperienza di derive su laser in lago e vela leggera",
        courseNote: "Migliora nelle virate ma deve tenere la randa più chiusa",
      })
      for (let s = 0; s < sessions.length; s += 1) {
        if ((i + s) % 3 === 2) continue
        const session = sessions[s]
        const value = values[(i * 2 + s) % values.length]
        if (!session || !value) {
          throw new Error(`Missing evaluation fixture value at ${i}:${s}`)
        }
        await evaluationApi.saveEvaluation(course.id, student.id, session, {
          value,
          note: (i + s) % 4 === 0 ? "Buona partenza e virata pulita" : null,
        })
      }
    }
  })
  await page.reload()
}
