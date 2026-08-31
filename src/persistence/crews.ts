import {
  CREW_DESTINATIONS,
  SESSION_SEQUENCE,
  type CrewDestination,
  type SessionId,
} from "@/domain/config"
import type {
  CrewDraft,
  CrewPersonRef,
  CrewPersonType,
  CrewPlan,
} from "@/domain/crews"
import { db } from "@/persistence/db"

interface PersistedCrew {
  id: string
  sessionId: string
  destination: string
  boatId: string | null
  position: number
}

interface PersistedMember {
  crewId: string
  personId: string
  personType: string
  position: number
}

interface PersistedLandAssignment {
  id: string
  sessionId: string
  studentId: string
}

export interface CrewPlanRecord extends CrewPlan {
  landAssignments: PersistedLandAssignment[]
}

const SESSION_IDS = SESSION_SEQUENCE.map(({ id }) => id)

function isPersonType(value: string): value is CrewPersonType {
  return value === "student" || value === "volunteer"
}

export async function readCrewPlan(
  courseId: string,
  sessionId: SessionId,
): Promise<CrewPlanRecord> {
  await db.init()
  const [crewRows, memberRows, landAssignments] = await Promise.all([
    db.getAll<PersistedCrew>(
      `SELECT id, sessionId, destination, boatId, position
       FROM crews
       WHERE courseId = ? AND sessionId = ?
       ORDER BY position`,
      [courseId, sessionId],
    ),
    db.getAll<PersistedMember>(
      `SELECT cm.crewId, cm.personId, cm.personType, cm.position
       FROM crewMembers cm
       JOIN crews c ON c.id = cm.crewId
       WHERE c.courseId = ? AND c.sessionId = ?
       ORDER BY cm.crewId, cm.position`,
      [courseId, sessionId],
    ),
    db.getAll<PersistedLandAssignment>(
      `SELECT id, sessionId, studentId
       FROM landAssignments
       WHERE courseId = ? AND sessionId = ?
       ORDER BY id`,
      [courseId, sessionId],
    ),
  ])
  if (
    crewRows.some(
      ({ sessionId: value, destination, boatId, position }, index) =>
        !SESSION_IDS.includes(value as SessionId) ||
        !CREW_DESTINATIONS.includes(destination as CrewDestination) ||
        destination !== "unassigned" ||
        boatId !== null ||
        position !== index,
    ) ||
    memberRows.some(
      ({ personType, position }) =>
        !isPersonType(personType) ||
        !Number.isInteger(position) ||
        position < 0,
    )
  ) {
    throw new Error("Invalid persisted crew plan")
  }
  const nextMemberPosition = new Map<string, number>()
  if (
    memberRows.some(({ crewId, position }) => {
      const expected = nextMemberPosition.get(crewId) ?? 0
      nextMemberPosition.set(crewId, expected + 1)
      return position !== expected
    })
  ) {
    throw new Error("Invalid persisted crew member order")
  }
  const membersByCrew = new Map<string, CrewPersonRef[]>()
  memberRows.forEach(({ crewId, personId, personType }) => {
    membersByCrew.set(crewId, [
      ...(membersByCrew.get(crewId) ?? []),
      { personId, personType: personType as CrewPersonType },
    ])
  })
  return {
    crews: crewRows.map<CrewDraft>(({ id, sessionId }) => ({
      id,
      sessionId: sessionId as SessionId,
      members: membersByCrew.get(id) ?? [],
    })),
    landStudentIds: landAssignments.map(({ studentId }) => studentId),
    landAssignments,
  }
}

export async function saveCrewPlan(
  courseId: string,
  sessionId: SessionId,
  plan: CrewPlan,
) {
  await db.init()
  if (!SESSION_IDS.includes(sessionId)) throw new Error("Invalid crew session")
  const crewIds = new Set<string>()
  const personKeys = new Set<string>()
  for (const crew of plan.crews) {
    if (crewIds.has(crew.id) || crew.sessionId !== sessionId) {
      throw new Error("Invalid crew identity")
    }
    crewIds.add(crew.id)
    for (const member of crew.members) {
      const key = `${member.personType}:${member.personId}`
      if (personKeys.has(key)) throw new Error("Duplicate crew person")
      personKeys.add(key)
    }
  }
  const landIds = new Set<string>()
  for (const studentId of plan.landStudentIds) {
    if (landIds.has(studentId) || personKeys.has(`student:${studentId}`)) {
      throw new Error("Duplicate session student")
    }
    landIds.add(studentId)
  }

  await db.writeTransaction(async (transaction) => {
    await transaction.execute(
      `DELETE FROM crewMembers
       WHERE crewId IN (
         SELECT id FROM crews WHERE courseId = ? AND sessionId = ?
       )`,
      [courseId, sessionId],
    )
    await transaction.execute(
      "DELETE FROM crews WHERE courseId = ? AND sessionId = ?",
      [courseId, sessionId],
    )
    await transaction.execute(
      "DELETE FROM landAssignments WHERE courseId = ? AND sessionId = ?",
      [courseId, sessionId],
    )
    if (plan.crews.length > 0) {
      await transaction.executeBatch(
        `INSERT INTO crews(id, courseId, sessionId, destination, boatId, position)
         VALUES (?, ?, ?, ?, ?, ?)`,
        plan.crews.map(({ id }, position) => [
          id,
          courseId,
          sessionId,
          "unassigned",
          null,
          position,
        ]),
      )
    }
    const members = plan.crews.flatMap((crew) =>
      crew.members.map((member, position) => ({
        id: crypto.randomUUID(),
        crewId: crew.id,
        ...member,
        position,
      })),
    )
    if (members.length > 0) {
      await transaction.executeBatch(
        `INSERT INTO crewMembers(id, crewId, personId, personType, position)
         VALUES (?, ?, ?, ?, ?)`,
        members.map(({ id, crewId, personId, personType, position }) => [
          id,
          crewId,
          personId,
          personType,
          position,
        ]),
      )
    }
    if (plan.landStudentIds.length > 0) {
      await transaction.executeBatch(
        `INSERT INTO landAssignments(id, courseId, sessionId, studentId)
         VALUES (?, ?, ?, ?)`,
        plan.landStudentIds.map((studentId) => [
          crypto.randomUUID(),
          courseId,
          sessionId,
          studentId,
        ]),
      )
    }
  })
}
