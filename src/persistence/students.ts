import type { StudentSex } from "@/domain/config"
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
  active: 0 | 1
}

export interface StudentInput {
  firstName: string
  surname: string
  nickname: string | null
  dateOfBirth: string
  sex: StudentSex | null
  phone: string | null
}

const STUDENT_COLUMNS =
  "id, courseId, firstName, surname, nickname, dateOfBirth, sex, phone, active"

export async function listStudents(courseId: string) {
  await db.init()
  return db.getAll<StudentRecord>(
    `SELECT ${STUDENT_COLUMNS}
     FROM students
     WHERE courseId = ?
     ORDER BY active DESC, surname COLLATE NOCASE, firstName COLLATE NOCASE`,
    [courseId],
  )
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
    active: 1,
  }
  await db.execute(
    `INSERT INTO students(
      id, courseId, firstName, surname, nickname, dateOfBirth, sex, phone, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      student.id,
      student.courseId,
      student.firstName,
      student.surname,
      student.nickname,
      student.dateOfBirth,
      student.sex,
      student.phone,
      student.active,
    ],
  )
  return student
}

export async function updateStudent(
  studentId: string,
  courseId: string,
  input: StudentInput,
) {
  await db.init()
  await db.execute(
    `UPDATE students
     SET firstName = ?, surname = ?, nickname = ?, dateOfBirth = ?, sex = ?, phone = ?
     WHERE id = ? AND courseId = ?`,
    [
      input.firstName,
      input.surname,
      input.nickname,
      input.dateOfBirth,
      input.sex,
      input.phone,
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
