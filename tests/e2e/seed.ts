import type { Page } from "@playwright/test"
import { buildCourseDetails } from "../../src/domain/course"
import type { CourseFamily, CourseLevel } from "../../src/domain/config"

/** Browser-only persistence imports shared by the e2e seed helpers. */
export async function loadCourses() {
  const modulePath = "/src/persistence/courses.ts"
  return (await import(
    /* @vite-ignore */ modulePath
  )) as typeof import("../../src/persistence/courses")
}

export async function loadBrowserStorage() {
  const modulePath = "/src/persistence/browserStorage.ts"
  return (await import(
    /* @vite-ignore */ modulePath
  )) as typeof import("../../src/persistence/browserStorage")
}

export async function loadStudents() {
  const modulePath = "/src/persistence/students.ts"
  return (await import(
    /* @vite-ignore */ modulePath
  )) as typeof import("../../src/persistence/students")
}

export async function loadBoats() {
  const modulePath = "/src/persistence/boats.ts"
  return (await import(
    /* @vite-ignore */ modulePath
  )) as typeof import("../../src/persistence/boats")
}

export async function loadCrews() {
  const modulePath = "/src/persistence/crews.ts"
  return (await import(
    /* @vite-ignore */ modulePath
  )) as typeof import("../../src/persistence/crews")
}

export async function loadVolunteers() {
  const modulePath = "/src/persistence/volunteers.ts"
  return (await import(
    /* @vite-ignore */ modulePath
  )) as typeof import("../../src/persistence/volunteers")
}

export async function loadDuties() {
  const modulePath = "/src/persistence/duties.ts"
  return (await import(
    /* @vite-ignore */ modulePath
  )) as typeof import("../../src/persistence/duties")
}

export async function loadEvaluations() {
  const modulePath = "/src/persistence/evaluations.ts"
  return (await import(
    /* @vite-ignore */ modulePath
  )) as typeof import("../../src/persistence/evaluations")
}

export async function createActiveCourse(
  family: CourseFamily,
  level: CourseLevel,
) {
  const courses = await loadCourses()
  if (await courses.getActiveCourse()) {
    throw new Error("Course bootstrap requires no active course")
  }

  const course = await courses.saveActiveCourse(
    buildCourseDetails(family, level, new Date()),
  )
  const { requestPersistentStorage } = await loadBrowserStorage()
  void requestPersistentStorage()
  return course
}

/** Creates a course without mounting the app; the caller reloads after seeding. */
export async function bootstrapCourse(
  page: Page,
  family: CourseFamily,
  level: CourseLevel,
) {
  const rootDocument = (url: URL) => url.pathname === "/"
  const blankDocument = async (route: import("@playwright/test").Route) => {
    if (route.request().isNavigationRequest()) {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><head></head><body></body></html>",
      })
      return
    }
    await route.continue()
  }

  await page.route(rootDocument, blankDocument)
  try {
    await page.goto("/")
    await page.evaluate(
      async ({ family, level }) => {
        const seedModulePath = "/tests/e2e/seed.ts"
        const seedApi = (await import(
          /* @vite-ignore */ seedModulePath
        )) as typeof import("./seed")
        await seedApi.createActiveCourse(family, level)
      },
      { family, level },
    )
  } finally {
    await page.unroute(rootDocument, blankDocument)
  }
}
