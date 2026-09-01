import {
  SESSION_SEQUENCE,
  type EvaluationSymbol,
  type SessionId,
} from "@/domain/config"
import { isEvaluationSymbol } from "@/domain/evaluations"
import { db } from "@/persistence/db"

export interface EvaluationRecord {
  id: string
  studentId: string
  sessionId: SessionId
  value: EvaluationSymbol | null
  note: string | null
}

export interface EvaluationInput {
  value: EvaluationSymbol | null
  note: string | null
}

const SESSION_IDS = new Set<SessionId>(SESSION_SEQUENCE.map(({ id }) => id))

interface PersistedEvaluation {
  id: string
  studentId: string
  sessionId: string
  value: string | null
  note: string | null
}

function normalizeNote(note: string | null) {
  const normalized = note?.trim() ?? ""
  return normalized || null
}

function assertInput(sessionId: SessionId, input: EvaluationInput) {
  if (!SESSION_IDS.has(sessionId)) throw new Error("Invalid evaluation session")
  if (input.value !== null && !isEvaluationSymbol(input.value)) {
    throw new Error("Invalid evaluation value")
  }
}

function validateRows(
  rows: PersistedEvaluation[],
  expected?: { sessionId?: SessionId; studentId?: string },
): EvaluationRecord[] {
  const keys = new Set<string>()
  return rows.map((row) => {
    const key = `${row.studentId}:${row.sessionId}`
    if (
      !SESSION_IDS.has(row.sessionId as SessionId) ||
      (expected?.sessionId && row.sessionId !== expected.sessionId) ||
      (expected?.studentId && row.studentId !== expected.studentId) ||
      (row.value !== null && !isEvaluationSymbol(row.value)) ||
      keys.has(key)
    ) {
      throw new Error("Invalid persisted evaluation")
    }
    keys.add(key)
    return {
      id: row.id,
      studentId: row.studentId,
      sessionId: row.sessionId as SessionId,
      value: row.value as EvaluationSymbol | null,
      note: normalizeNote(row.note),
    }
  })
}

export async function listEvaluations(
  courseId: string,
  sessionId: SessionId,
): Promise<EvaluationRecord[]> {
  await db.init()
  if (!SESSION_IDS.has(sessionId)) throw new Error("Invalid evaluation session")
  const rows = await db.getAll<PersistedEvaluation>(
    `SELECT e.id, e.studentId, e.sessionId, e.value, e.note
     FROM evaluations e
     JOIN students s ON s.id = e.studentId
     WHERE s.courseId = ? AND e.sessionId = ?
     ORDER BY s.surname COLLATE NOCASE, s.firstName COLLATE NOCASE`,
    [courseId, sessionId],
  )
  return validateRows(rows, { sessionId })
}

export async function listCourseEvaluations(
  courseId: string,
): Promise<EvaluationRecord[]> {
  await db.init()
  const rows = await db.getAll<PersistedEvaluation>(
    `SELECT e.id, e.studentId, e.sessionId, e.value, e.note
     FROM evaluations e
     JOIN students s ON s.id = e.studentId
     WHERE s.courseId = ?
     ORDER BY e.sessionId, s.surname COLLATE NOCASE, s.firstName COLLATE NOCASE`,
    [courseId],
  )
  return validateRows(rows)
}

export async function listStudentEvaluations(
  courseId: string,
  studentId: string,
): Promise<EvaluationRecord[]> {
  await db.init()
  const rows = await db.getAll<PersistedEvaluation>(
    `SELECT e.id, e.studentId, e.sessionId, e.value, e.note
     FROM evaluations e
     JOIN students s ON s.id = e.studentId
     WHERE s.courseId = ? AND s.id = ?
     ORDER BY e.sessionId`,
    [courseId, studentId],
  )
  return validateRows(rows, { studentId }).sort(
    (left, right) =>
      SESSION_SEQUENCE.findIndex(({ id }) => id === left.sessionId) -
      SESSION_SEQUENCE.findIndex(({ id }) => id === right.sessionId),
  )
}

export async function saveEvaluation(
  courseId: string,
  studentId: string,
  sessionId: SessionId,
  input: EvaluationInput,
): Promise<EvaluationRecord | null> {
  await db.init()
  assertInput(sessionId, input)
  const students = await db.getAll<{ id: string }>(
    "SELECT id FROM students WHERE id = ? AND courseId = ?",
    [studentId, courseId],
  )
  if (students.length !== 1) {
    throw new Error("Evaluation student does not belong to course")
  }
  const existing = await db.getAll<{ id: string }>(
    "SELECT id FROM evaluations WHERE studentId = ? AND sessionId = ?",
    [studentId, sessionId],
  )
  if (existing.length > 1) throw new Error("Duplicate persisted evaluation")
  const normalized: EvaluationInput = {
    value: input.value,
    note: normalizeNote(input.note),
  }
  if (normalized.value === null && normalized.note === null) {
    if (existing[0]) {
      await db.execute("DELETE FROM evaluations WHERE id = ?", [existing[0].id])
    }
    return null
  }
  if (existing[0]) {
    await db.execute(
      "UPDATE evaluations SET value = ?, note = ? WHERE id = ?",
      [normalized.value, normalized.note, existing[0].id],
    )
    return { id: existing[0].id, studentId, sessionId, ...normalized }
  }
  const record: EvaluationRecord = {
    id: crypto.randomUUID(),
    studentId,
    sessionId,
    ...normalized,
  }
  await db.execute(
    "INSERT INTO evaluations(id, studentId, sessionId, value, note) VALUES (?, ?, ?, ?, ?)",
    [record.id, studentId, sessionId, record.value, record.note],
  )
  return record
}
