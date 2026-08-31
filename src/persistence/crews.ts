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
import type { CrewHistoryEntry } from "@/domain/crewWarnings"
import { db } from "@/persistence/db"

interface PersistedCrew {
  id: string
  sessionId: string
  destination: string
  boatId: string | null
  position: number | null
}

interface PersistedMember {
  crewId: string
  personId: string
  personType: string
  position: number | null
}

interface PersistedLandAssignment {
  id: string
  sessionId: string
  studentId: string
}

interface PersistedSessionBoat {
  id: string
  sessionId: string
  boatId: string
  position: number | null
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
  const [crewRows, memberRows, landAssignments, sessionBoats] =
    await Promise.all([
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
      db.getAll<PersistedSessionBoat>(
        `SELECT id, sessionId, boatId, position
       FROM sessionBoats
       WHERE courseId = ? AND sessionId = ?
       ORDER BY position`,
        [courseId, sessionId],
      ),
    ])
  const selectedBoatIds = new Set(sessionBoats.map(({ boatId }) => boatId))
  const assignedBoatIds = new Set<string>()
  if (
    sessionBoats.some(
      ({ sessionId: value, boatId, position }, index) =>
        value !== sessionId ||
        !boatId ||
        selectedBoatIds.size !== sessionBoats.length ||
        (position !== null && position !== index),
    ) ||
    memberRows.some(
      ({ personType, position }) =>
        !isPersonType(personType) ||
        (position !== null && (!Number.isInteger(position) || position < 0)),
    )
  ) {
    throw new Error("Invalid persisted crew plan")
  }
  crewRows.forEach(
    ({ sessionId: value, destination, boatId, position }, index) => {
      if (
        !SESSION_IDS.includes(value as SessionId) ||
        !CREW_DESTINATIONS.includes(destination as CrewDestination) ||
        (position !== null && position !== index) ||
        (destination === "boat"
          ? !boatId ||
            !selectedBoatIds.has(boatId) ||
            assignedBoatIds.has(boatId)
          : boatId !== null)
      ) {
        throw new Error(
          `Invalid persisted crew plan: ${value}/${destination}/${boatId ?? "none"}/${position}/${index}`,
        )
      }
      if (destination === "boat" && boatId) assignedBoatIds.add(boatId)
    },
  )
  const nextMemberPosition = new Map<string, number>()
  if (
    memberRows.some(({ crewId, position }) => {
      const expected = nextMemberPosition.get(crewId) ?? 0
      nextMemberPosition.set(crewId, expected + 1)
      return position !== null && position !== expected
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
    crews: crewRows.map<CrewDraft>(
      ({ id, sessionId, destination, boatId }) => ({
        id,
        sessionId: sessionId as SessionId,
        members: membersByCrew.get(id) ?? [],
        destination: destination as CrewDestination,
        boatId,
      }),
    ),
    landStudentIds: landAssignments.map(({ studentId }) => studentId),
    selectedBoatIds: sessionBoats.map(({ boatId }) => boatId),
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
  const assignedBoatIds = new Set<string>()
  const selectedBoatIds = new Set(plan.selectedBoatIds)
  if (selectedBoatIds.size !== plan.selectedBoatIds.length) {
    throw new Error("Duplicate session boat")
  }
  for (const crew of plan.crews) {
    if (crewIds.has(crew.id) || crew.sessionId !== sessionId) {
      throw new Error("Invalid crew identity")
    }
    crewIds.add(crew.id)
    if (!CREW_DESTINATIONS.includes(crew.destination)) {
      throw new Error("Invalid crew destination")
    }
    if (crew.destination === "boat") {
      if (!crew.boatId || !selectedBoatIds.has(crew.boatId)) {
        throw new Error("Crew boat is not selected for the session")
      }
      if (assignedBoatIds.has(crew.boatId)) {
        throw new Error("Boat is assigned twice in the session")
      }
      assignedBoatIds.add(crew.boatId)
    } else if (crew.boatId !== null) {
      throw new Error("Non-boat destination cannot retain a boat")
    }
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
  if (plan.selectedBoatIds.length > 0) {
    const courseBoats = await db.getAll<{ id: string }>(
      "SELECT id FROM boats WHERE courseId = ?",
      [courseId],
    )
    const courseBoatIds = new Set(courseBoats.map(({ id }) => id))
    if (plan.selectedBoatIds.some((boatId) => !courseBoatIds.has(boatId))) {
      throw new Error("Session boat does not belong to course")
    }
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
    await transaction.execute(
      "DELETE FROM sessionBoats WHERE courseId = ? AND sessionId = ?",
      [courseId, sessionId],
    )
    if (plan.crews.length > 0) {
      await transaction.executeBatch(
        `INSERT INTO crews(id, courseId, sessionId, destination, boatId, position)
         VALUES (?, ?, ?, ?, ?, ?)`,
        plan.crews.map(({ id, destination, boatId }, position) => [
          id,
          courseId,
          sessionId,
          destination,
          boatId,
          position,
        ]),
      )
    }
    if (plan.selectedBoatIds.length > 0) {
      await transaction.executeBatch(
        `INSERT INTO sessionBoats(id, courseId, sessionId, boatId, position)
         VALUES (?, ?, ?, ?, ?)`,
        plan.selectedBoatIds.map((boatId, position) => [
          crypto.randomUUID(),
          courseId,
          sessionId,
          boatId,
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

export async function readCrewHistory(
  courseId: string,
): Promise<CrewHistoryEntry[]> {
  await db.init()
  const [crewRows, memberRows] = await Promise.all([
    db.getAll<PersistedCrew>(
      `SELECT id, sessionId, destination, boatId, position
       FROM crews
       WHERE courseId = ?
       ORDER BY sessionId, position`,
      [courseId],
    ),
    db.getAll<PersistedMember>(
      `SELECT cm.crewId, cm.personId, cm.personType, cm.position
       FROM crewMembers cm
       JOIN crews c ON c.id = cm.crewId
       WHERE c.courseId = ?
       ORDER BY cm.crewId, cm.position`,
      [courseId],
    ),
  ])
  const nextCrewPosition = new Map<string, number>()
  if (
    crewRows.some(({ sessionId, destination, position }) => {
      const expected = nextCrewPosition.get(sessionId) ?? 0
      nextCrewPosition.set(sessionId, expected + 1)
      return (
        !SESSION_IDS.includes(sessionId as SessionId) ||
        !CREW_DESTINATIONS.includes(destination as CrewDestination) ||
        (position !== null && position !== expected)
      )
    })
  ) {
    throw new Error("Invalid persisted crew history")
  }
  const nextMemberPosition = new Map<string, number>()
  if (
    memberRows.some(({ crewId, personType, position }) => {
      const expected = nextMemberPosition.get(crewId) ?? 0
      nextMemberPosition.set(crewId, expected + 1)
      return (
        !isPersonType(personType) ||
        (position !== null && position !== expected)
      )
    })
  ) {
    throw new Error("Invalid persisted crew history members")
  }
  const studentsByCrew = new Map<string, string[]>()
  memberRows.forEach(({ crewId, personId, personType }) => {
    if (personType !== "student") return
    studentsByCrew.set(crewId, [
      ...(studentsByCrew.get(crewId) ?? []),
      personId,
    ])
  })
  return crewRows.map(({ id, sessionId }) => ({
    crewId: id,
    sessionId: sessionId as SessionId,
    studentIds: studentsByCrew.get(id) ?? [],
  }))
}
