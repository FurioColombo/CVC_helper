import { VOLUNTEER_ROLES, type VolunteerRole } from "@/domain/config"
import { validateVolunteerRecords } from "@/domain/invariants"
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

function assertVolunteerInput(input: VolunteerInput) {
  if (!input.name.trim()) throw new Error("Volunteer name is required")
  if (!VOLUNTEER_ROLES.includes(input.role)) {
    throw new Error("Invalid volunteer role")
  }
}

function assertVolunteerRecords(records: VolunteerRecord[]) {
  const issues = validateVolunteerRecords(records)
  if (issues.length > 0) {
    throw new Error(
      `Invalid persisted volunteer: ${issues
        .map(({ code, path }) => `${code} at ${path}`)
        .join(", ")}`,
    )
  }
}

export async function listVolunteers(courseId: string) {
  await db.init()
  const records = await db.getAll<VolunteerRecord>(
    `SELECT ${VOLUNTEER_COLUMNS}
     FROM volunteers
     WHERE courseId = ?
     ORDER BY name COLLATE NOCASE`,
    [courseId],
  )
  assertVolunteerRecords(records)
  return records
}

export async function createVolunteer(
  courseId: string,
  input: VolunteerInput,
): Promise<VolunteerRecord> {
  await db.init()
  assertVolunteerInput(input)
  const volunteer = {
    id: crypto.randomUUID(),
    courseId,
    name: input.name.trim(),
    role: input.role,
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
  assertVolunteerInput(input)
  const result = await db.execute<{ id: string }>(
    `UPDATE volunteers
     SET name = ?, role = ?
     WHERE id = ? AND courseId = ?
     RETURNING id`,
    [input.name.trim(), input.role, volunteerId, courseId],
  )
  if (Array.from(result).length !== 1) {
    throw new Error("Volunteer does not belong to course")
  }
}
