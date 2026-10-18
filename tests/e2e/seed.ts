/** Browser-only persistence imports shared by the e2e seed helpers. */
export async function loadCourses() {
  const modulePath = "/src/persistence/courses.ts"
  return (await import(
    /* @vite-ignore */ modulePath
  )) as typeof import("../../src/persistence/courses")
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
