import type { PowerSyncDatabase, Transaction } from "@powersync/web"

const GENERATION_ID = "local:course-generation"
type Reader = Pick<Transaction, "getAll">
const generations = new WeakMap<
  PowerSyncDatabase,
  { generation: number; courseId: string | null }
>()
const invalid = new WeakSet<PowerSyncDatabase>()
const listeners = new Set<(database: PowerSyncDatabase) => void>()

export class CourseReplacedError extends Error {
  constructor() {
    super("Il corso è cambiato in un'altra schermata. Riapri l’app.")
    this.name = "CourseReplacedError"
  }
}

async function readGeneration(context: Reader) {
  const rows = await context.getAll<{ value: number | null }>(
    "SELECT value FROM meta WHERE id = ?",
    [GENERATION_ID],
  )
  const value = rows[0]?.value ?? 0
  if (!Number.isSafeInteger(value) || value < 0) throw new CourseReplacedError()
  return value
}

/** Bind before the first screen, never at the first save of an old tab. */
export async function bindCourseSession(database: PowerSyncDatabase) {
  if (generations.has(database)) return
  const session = await database.readTransaction(async (context) => {
    const generation = await readGeneration(context)
    const courses = await context.getAll<{ id: string }>(
      "SELECT id FROM courses WHERE active = 1",
    )
    if (courses.length > 1) throw new CourseReplacedError()
    return { generation, courseId: courses[0]?.id ?? null }
  })
  if (!generations.has(database)) generations.set(database, session)
}

/** Only the successful first-course creation may adopt its newly created ID. */
export function adoptCreatedCourse(
  database: PowerSyncDatabase,
  courseId: string,
) {
  const bound = generations.get(database)
  if (bound && !invalid.has(database))
    generations.set(database, { ...bound, courseId })
}

export function invalidateCourseSession(database: PowerSyncDatabase) {
  if (invalid.has(database)) return
  invalid.add(database)
  for (const listener of listeners) listener(database)
}

export function onCourseReplaced(
  listener: (database: PowerSyncDatabase) => void,
) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** A closed worker cannot acquire a lock to run the second, in-lock check. */
export function assertCourseSessionOpen(database: PowerSyncDatabase) {
  if (invalid.has(database)) throw new CourseReplacedError()
}

/** Called inside the same lock as the write; a replacement never rebinds it. */
export async function assertCourseSession(
  database: PowerSyncDatabase,
  context: Reader,
) {
  assertCourseSessionOpen(database)
  const expected = generations.get(database)
  const courses = expected
    ? await context.getAll<{ id: string }>(
        "SELECT id FROM courses WHERE active = 1",
      )
    : []
  if (
    expected !== undefined &&
    (expected.generation !== (await readGeneration(context)) ||
      courses.length > 1 ||
      expected.courseId !== (courses[0]?.id ?? null))
  ) {
    invalidateCourseSession(database)
    throw new CourseReplacedError()
  }
}

/** Part of the atomic replacement, so rollback restores the old generation. */
export async function advanceCourseGeneration(
  transaction: Pick<Transaction, "getAll" | "execute">,
) {
  const next = (await readGeneration(transaction)) + 1
  if (!Number.isSafeInteger(next)) throw new CourseReplacedError()
  await transaction.execute(
    "INSERT OR REPLACE INTO meta(id, value) VALUES (?, ?)",
    [GENERATION_ID, next],
  )
}
