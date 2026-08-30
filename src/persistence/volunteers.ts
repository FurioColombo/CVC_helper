import type { VolunteerRole } from "@/domain/config"
import { db } from "@/persistence/db"

export interface VolunteerRecord {
  id: string
  courseId: string
  name: string
  role: VolunteerRole
}

export interface VolunteerInput {
  name: string
  role: VolunteerRole
}

const VOLUNTEER_COLUMNS = "id, courseId, name, role"

export async function listVolunteers(courseId: string) {
  await db.init()
  return db.getAll<VolunteerRecord>(
    `SELECT ${VOLUNTEER_COLUMNS}
     FROM volunteers
     WHERE courseId = ?
     ORDER BY name COLLATE NOCASE`,
    [courseId],
  )
}

export async function createVolunteer(
  courseId: string,
  input: VolunteerInput,
): Promise<VolunteerRecord> {
  await db.init()
  const volunteer = {
    id: crypto.randomUUID(),
    courseId,
    ...input,
  }
  await db.execute(
    "INSERT INTO volunteers(id, courseId, name, role) VALUES (?, ?, ?, ?)",
    [volunteer.id, volunteer.courseId, volunteer.name, volunteer.role],
  )
  return volunteer
}

export async function updateVolunteer(
  volunteerId: string,
  courseId: string,
  input: VolunteerInput,
) {
  await db.init()
  await db.execute(
    `UPDATE volunteers
     SET name = ?, role = ?
     WHERE id = ? AND courseId = ?`,
    [input.name, input.role, volunteerId, courseId],
  )
}
