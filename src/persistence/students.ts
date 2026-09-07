import type { StudentSex, StudentSize } from "@/domain/config"
import { normalizeStudentCourseNote } from "@/domain/studentMigration"
import { db } from "@/persistence/db"

export interface StudentRecord {
  id: string
  courseId: string
  firstName: string
  surname: string
  nickname: string | null
  dateOfBirth: string
  sex: StudentSex | null
  phone: string | null
  size: StudentSize | null
  initialNote: string | null
  courseNote: string | null
  active: 0 | 1
}

export interface StudentInput {
  firstName: string
  surname: string
  nickname: string | null
  dateOfBirth: string
  sex: StudentSex | null
  phone: string | null
  size?: StudentSize | null
  initialNote?: string | null
  courseNote?: string | null
}

export interface StudentEditInput extends StudentInput {
  size: StudentSize | null
  initialNote: string | null
  courseNote: string | null
}

export interface StudentKnowledgeInput {
  size: StudentSize | null
  initialNote: string | null
}

const STUDENT_COLUMNS =
  "id, courseId, firstName, surname, nickname, dateOfBirth, sex, phone, size, initialNote, courseNote, active"

export type StudentReferenceKind =
  "duty" | "stay-over" | "crew" | "land" | "evaluation"

export interface StudentDeletionReference {
  kind: StudentReferenceKind
  referenceId: string
}

export interface StudentDeletionAssessment {
  canDelete: boolean
  references: StudentDeletionReference[]
}

export class StudentDeletionBlockedError extends Error {
  constructor(public readonly assessment: StudentDeletionAssessment) {
    super("Student has historical or operational references")
    this.name = "StudentDeletionBlockedError"
  }
}

type StudentQueryContext = Pick<typeof db, "getAll" | "getOptional">

async function readDeletionReferences(
  context: StudentQueryContext,
  studentId: string,
): Promise<StudentDeletionReference[]> {
  const duties = await context.getAll<{ referenceId: string }>(
    "SELECT dayId AS referenceId FROM dutyAssignments WHERE studentId = ? ORDER BY dayId",
    [studentId],
  )
  const stayOver = await context.getAll<{ referenceId: string }>(
    `SELECT 'stay-over' AS referenceId
     FROM dutySettings
     WHERE EXISTS (
       SELECT 1 FROM json_each(dutySettings.stayOverStudentIds)
       WHERE json_each.value = ?
     )
     LIMIT 1`,
    [studentId],
  )
  const crews = await context.getAll<{ referenceId: string }>(
    `SELECT COALESCE(c.sessionId, 'orphan:' || cm.crewId) AS referenceId
     FROM crewMembers cm
     LEFT JOIN crews c ON c.id = cm.crewId
     WHERE cm.personType = 'student' AND cm.personId = ?
     ORDER BY referenceId`,
    [studentId],
  )
  const land = await context.getAll<{ referenceId: string }>(
    "SELECT sessionId AS referenceId FROM landAssignments WHERE studentId = ? ORDER BY sessionId",
    [studentId],
  )
  const evaluations = await context.getAll<{ referenceId: string }>(
    "SELECT sessionId AS referenceId FROM evaluations WHERE studentId = ? ORDER BY sessionId",
    [studentId],
  )

  return [
    ...duties.map(({ referenceId }) => ({
      kind: "duty" as const,
      referenceId,
    })),
    ...stayOver.map(({ referenceId }) => ({
      kind: "stay-over" as const,
      referenceId,
    })),
    ...crews.map(({ referenceId }) => ({ kind: "crew" as const, referenceId })),
    ...land.map(({ referenceId }) => ({ kind: "land" as const, referenceId })),
    ...evaluations.map(({ referenceId }) => ({
      kind: "evaluation" as const,
      referenceId,
    })),
  ]
}

export async function listStudents(courseId: string) {
  await db.init()
  const records = await db.getAll<StudentRecord>(
    `SELECT ${STUDENT_COLUMNS}
     FROM students
     WHERE courseId = ?
     ORDER BY active DESC, surname COLLATE NOCASE,
              COALESCE(NULLIF(nickname, ''), firstName) COLLATE NOCASE,
              firstName COLLATE NOCASE`,
    [courseId],
  )
  return records.map(normalizeStudentCourseNote)
}

export async function createStudent(
  courseId: string,
  input: StudentInput,
): Promise<StudentRecord> {
  await db.init()
  const student: StudentRecord = {
    id: crypto.randomUUID(),
    courseId,
    ...input,
    size: input.size ?? null,
    initialNote: input.initialNote?.trim() || null,
    courseNote: input.courseNote?.trim() || null,
    active: 1,
  }
  await db.execute(
    `INSERT INTO students(
      id, courseId, firstName, surname, nickname, dateOfBirth, sex, phone, size, initialNote, courseNote, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      student.id,
      student.courseId,
      student.firstName,
      student.surname,
      student.nickname,
      student.dateOfBirth,
      student.sex,
      student.phone,
      student.size,
      student.initialNote,
      student.courseNote,
      student.active,
    ],
  )
  return student
}

export async function createStudents(
  courseId: string,
  inputs: StudentInput[],
): Promise<StudentRecord[]> {
  await db.init()
  const students = inputs.map<StudentRecord>((input) => ({
    id: crypto.randomUUID(),
    courseId,
    ...input,
    size: input.size ?? null,
    initialNote: input.initialNote?.trim() || null,
    courseNote: input.courseNote?.trim() || null,
    active: 1,
  }))
  if (students.length === 0) return []

  await db.executeBatch(
    `INSERT INTO students(
      id, courseId, firstName, surname, nickname, dateOfBirth, sex, phone, size, initialNote, courseNote, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    students.map((student) => [
      student.id,
      student.courseId,
      student.firstName,
      student.surname,
      student.nickname,
      student.dateOfBirth,
      student.sex,
      student.phone,
      student.size,
      student.initialNote,
      student.courseNote,
      student.active,
    ]),
  )
  return students
}

export async function updateStudent(
  studentId: string,
  courseId: string,
  input: StudentEditInput,
) {
  await db.init()
  await db.execute(
    `UPDATE students
     SET firstName = ?, surname = ?, nickname = ?, dateOfBirth = ?, sex = ?, phone = ?,
         size = ?, initialNote = ?, courseNote = ?
     WHERE id = ? AND courseId = ?`,
    [
      input.firstName,
      input.surname,
      input.nickname,
      input.dateOfBirth,
      input.sex,
      input.phone,
      input.size,
      input.initialNote?.trim() || null,
      input.courseNote?.trim() || null,
      studentId,
      courseId,
    ],
  )
}

export async function setStudentActive(
  studentId: string,
  courseId: string,
  active: boolean,
) {
  await db.init()
  await db.execute(
    "UPDATE students SET active = ? WHERE id = ? AND courseId = ?",
    [active ? 1 : 0, studentId, courseId],
  )
}

export async function updateStudentKnowledge(
  studentId: string,
  courseId: string,
  input: StudentKnowledgeInput,
) {
  await db.init()
  await db.execute(
    `UPDATE students
     SET size = ?, initialNote = ?
     WHERE id = ? AND courseId = ?`,
    [input.size, input.initialNote, studentId, courseId],
  )
}

export async function assessStudentDeletion(
  studentId: string,
  courseId: string,
): Promise<StudentDeletionAssessment> {
  await db.init()
  const ownedStudent = await db.getOptional<{ id: string }>(
    "SELECT id FROM students WHERE id = ? AND courseId = ? LIMIT 1",
    [studentId, courseId],
  )
  if (!ownedStudent) throw new Error("Student does not belong to course")
  const references = await readDeletionReferences(db, studentId)
  return { canDelete: references.length === 0, references }
}

export async function deleteUnusedStudent(studentId: string, courseId: string) {
  await db.init()
  await db.writeTransaction(async (transaction) => {
    const ownedStudent = await transaction.getOptional<{ id: string }>(
      "SELECT id FROM students WHERE id = ? AND courseId = ? LIMIT 1",
      [studentId, courseId],
    )
    if (!ownedStudent) throw new Error("Student does not belong to course")

    const references = await readDeletionReferences(transaction, studentId)
    if (references.length > 0) {
      throw new StudentDeletionBlockedError({ canDelete: false, references })
    }

    const result = await transaction.execute<{ id: string }>(
      "DELETE FROM students WHERE id = ? AND courseId = ? RETURNING id",
      [studentId, courseId],
    )
    if (Array.from(result).length !== 1) {
      throw new Error("Student deletion did not remove exactly one row")
    }
  })
}
