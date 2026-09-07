import { db } from "@/persistence/db"
import {
  deleteUnusedStudent,
  StudentDeletionBlockedError,
  type StudentReferenceKind,
} from "@/persistence/students"

async function addCourse(id: string) {
  await db.execute(
    `INSERT INTO courses(id, active, family, level, isoWeek, year, startDate, endDate, label)
     VALUES (?, 1, 'Deriva', 2, 35, 2026, '2026-08-29', '2026-09-05', 'D2 35 2026')`,
    [id],
  )
}

async function addStudent(id: string, courseId: string) {
  await db.execute(
    `INSERT INTO students(
       id, courseId, firstName, surname, nickname, dateOfBirth, sex, phone,
       size, initialNote, courseNote, active
     ) VALUES (?, ?, 'Test', 'Delete', NULL, '2000-01-01', 'other', NULL,
               NULL, NULL, NULL, 1)`,
    [id, courseId],
  )
}

async function blockedKind(studentId: string, courseId: string) {
  try {
    await deleteUnusedStudent(studentId, courseId)
    return null
  } catch (reason) {
    if (!(reason instanceof StudentDeletionBlockedError)) throw reason
    return reason.assessment.references[0]?.kind ?? null
  }
}

/** Exercises the production deletion gate against the real browser SQLite engine. */
export async function runU02DeletionHarness() {
  await db.init()
  const token = crypto.randomUUID()
  const ownerCourse = `u02-owner-${token}`
  const otherCourse = `u02-other-${token}`
  await addCourse(ownerCourse)
  await addCourse(otherCourse)

  const results: Array<{
    expected: StudentReferenceKind
    actual: string | null
  }> = []

  const dutyStudent = `u02-duty-${token}`
  await addStudent(dutyStudent, ownerCourse)
  await db.execute(
    "INSERT INTO dutyAssignments(id, courseId, dayId, studentId) VALUES (?, ?, 'saturday', ?)",
    [`u02-duty-ref-${token}`, otherCourse, dutyStudent],
  )
  results.push({
    expected: "duty",
    actual: await blockedKind(dutyStudent, ownerCourse),
  })

  const stayStudent = `u02-stay-${token}`
  await addStudent(stayStudent, ownerCourse)
  await db.execute(
    `INSERT INTO dutySettings(
       id, courseId, desiredPerDay, fewerDayIds, balanceMinors, balanceSex,
       tieBreaker, stayOverStudentIds, completedDayIds, acknowledgedWarningKeys
     ) VALUES (?, ?, 1, '[]', 0, 0, 'alphabetical', ?, '[]', '[]')`,
    [`u02-settings-${token}`, otherCourse, JSON.stringify([stayStudent])],
  )
  results.push({
    expected: "stay-over",
    actual: await blockedKind(stayStudent, ownerCourse),
  })

  const crewStudent = `u02-crew-${token}`
  await addStudent(crewStudent, ownerCourse)
  await db.execute(
    "INSERT INTO crewMembers(id, crewId, personId, personType, position) VALUES (?, ?, ?, 'student', 0)",
    [`u02-member-${token}`, `missing-crew-${token}`, crewStudent],
  )
  results.push({
    expected: "crew",
    actual: await blockedKind(crewStudent, ownerCourse),
  })

  const landStudent = `u02-land-${token}`
  await addStudent(landStudent, ownerCourse)
  await db.execute(
    "INSERT INTO landAssignments(id, courseId, sessionId, studentId) VALUES (?, ?, 'mon-am', ?)",
    [`u02-land-ref-${token}`, otherCourse, landStudent],
  )
  results.push({
    expected: "land",
    actual: await blockedKind(landStudent, ownerCourse),
  })

  const evaluationStudent = `u02-eval-${token}`
  await addStudent(evaluationStudent, ownerCourse)
  await db.execute(
    "INSERT INTO evaluations(id, studentId, sessionId, value, note) VALUES (?, ?, 'tue-pm', NULL, 'Solo nota')",
    [`u02-eval-ref-${token}`, evaluationStudent],
  )
  results.push({
    expected: "evaluation",
    actual: await blockedKind(evaluationStudent, ownerCourse),
  })

  const unusedStudent = `u02-unused-${token}`
  await addStudent(unusedStudent, ownerCourse)
  await deleteUnusedStudent(unusedStudent, ownerCourse)
  const deleted =
    (await db.getOptional<{ id: string }>(
      "SELECT id FROM students WHERE id = ?",
      [unusedStudent],
    )) === null

  return { results, deleted }
}
