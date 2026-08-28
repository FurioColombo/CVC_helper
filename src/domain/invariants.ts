import {
  BOAT_AVAILABILITY,
  CREW_DESTINATIONS,
  EVALUATION_VALUES,
  FAULT_STATES,
  SESSION_SEQUENCE,
  VOLUNTEER_ROLES,
} from "./config"

export interface CourseStateSnapshot {
  students: Array<{ id: string }>
  volunteers: Array<{ id: string; role: string }>
  boats: Array<{ id: string; availability: string }>
  faults: Array<{ id: string; boatId: string; state: string }>
  crews: Array<{
    id: string
    sessionId: string
    studentIds: string[]
    volunteerIds: string[]
    destination: string
    boatId?: string
  }>
  landAssignments: Array<{
    id: string
    sessionId: string
    studentId: string
  }>
  evaluations: Array<{
    id: string
    sessionId: string
    studentId: string
    value: string | null
  }>
}

export interface InvariantIssue {
  code: string
  path: string
  message: string
}

function hasValue<T extends readonly string[]>(values: T, value: string) {
  return values.includes(value as T[number])
}

function duplicateIds(
  collection: string,
  records: Array<{ id: string }>,
): InvariantIssue[] {
  const seen = new Set<string>()
  return records.flatMap((record, index) => {
    if (!seen.has(record.id)) {
      seen.add(record.id)
      return []
    }
    return [
      {
        code: "duplicate-id",
        path: `${collection}[${index}].id`,
        message: `Duplicate ${collection} id: ${record.id}`,
      },
    ]
  })
}

export function validateCourseState(
  state: CourseStateSnapshot,
): InvariantIssue[] {
  const issues: InvariantIssue[] = []
  const collections = [
    ["students", state.students],
    ["volunteers", state.volunteers],
    ["boats", state.boats],
    ["faults", state.faults],
    ["crews", state.crews],
    ["landAssignments", state.landAssignments],
    ["evaluations", state.evaluations],
  ] as const
  for (const [name, records] of collections) {
    issues.push(...duplicateIds(name, records))
  }

  const studentIds = new Set(state.students.map(({ id }) => id))
  const volunteerIds = new Set(state.volunteers.map(({ id }) => id))
  const boatIds = new Set(state.boats.map(({ id }) => id))
  const sessionIds = new Set(SESSION_SEQUENCE.map(({ id }) => id))
  const evaluationValues = EVALUATION_VALUES.map(({ symbol }) => symbol)

  state.volunteers.forEach((volunteer, index) => {
    if (!hasValue(VOLUNTEER_ROLES, volunteer.role)) {
      issues.push({
        code: "invalid-volunteer-role",
        path: `volunteers[${index}].role`,
        message: `Invalid volunteer role: ${volunteer.role}`,
      })
    }
  })

  state.boats.forEach((boat, index) => {
    if (!hasValue(BOAT_AVAILABILITY, boat.availability)) {
      issues.push({
        code: "invalid-boat-availability",
        path: `boats[${index}].availability`,
        message: `Invalid boat availability: ${boat.availability}`,
      })
    }
  })

  state.faults.forEach((fault, index) => {
    if (!boatIds.has(fault.boatId)) {
      issues.push({
        code: "dangling-fault-boat",
        path: `faults[${index}].boatId`,
        message: `Fault references missing boat: ${fault.boatId}`,
      })
    }
    if (!hasValue(FAULT_STATES, fault.state)) {
      issues.push({
        code: "invalid-fault-state",
        path: `faults[${index}].state`,
        message: `Invalid fault state: ${fault.state}`,
      })
    }
  })

  const assignedStudents = new Set<string>()
  const assignedBoats = new Set<string>()
  state.crews.forEach((crew, index) => {
    if (!sessionIds.has(crew.sessionId as never)) {
      issues.push({
        code: "invalid-session",
        path: `crews[${index}].sessionId`,
        message: `Crew has invalid session: ${crew.sessionId}`,
      })
    }
    if (!hasValue(CREW_DESTINATIONS, crew.destination)) {
      issues.push({
        code: "invalid-crew-destination",
        path: `crews[${index}].destination`,
        message: `Invalid crew destination: ${crew.destination}`,
      })
    }
    crew.studentIds.forEach((studentId, studentIndex) => {
      if (!studentIds.has(studentId)) {
        issues.push({
          code: "dangling-crew-student",
          path: `crews[${index}].studentIds[${studentIndex}]`,
          message: `Crew references missing student: ${studentId}`,
        })
      }
      const assignmentKey = `${crew.sessionId}:${studentId}`
      if (assignedStudents.has(assignmentKey)) {
        issues.push({
          code: "duplicate-session-student",
          path: `crews[${index}].studentIds[${studentIndex}]`,
          message: `Student ${studentId} is assigned more than once in ${crew.sessionId}`,
        })
      }
      assignedStudents.add(assignmentKey)
    })
    crew.volunteerIds.forEach((volunteerId, volunteerIndex) => {
      if (!volunteerIds.has(volunteerId)) {
        issues.push({
          code: "dangling-crew-volunteer",
          path: `crews[${index}].volunteerIds[${volunteerIndex}]`,
          message: `Crew references missing volunteer: ${volunteerId}`,
        })
      }
    })
    if (crew.destination === "boat") {
      if (!crew.boatId || !boatIds.has(crew.boatId)) {
        issues.push({
          code: "dangling-crew-boat",
          path: `crews[${index}].boatId`,
          message: `Boat destination references missing boat: ${crew.boatId ?? "none"}`,
        })
      } else {
        const boatKey = `${crew.sessionId}:${crew.boatId}`
        if (assignedBoats.has(boatKey)) {
          issues.push({
            code: "duplicate-session-boat",
            path: `crews[${index}].boatId`,
            message: `Boat ${crew.boatId} is assigned twice in ${crew.sessionId}`,
          })
        }
        assignedBoats.add(boatKey)
      }
    } else if (crew.boatId) {
      issues.push({
        code: "unexpected-crew-boat",
        path: `crews[${index}].boatId`,
        message: `Destination ${crew.destination} cannot retain boat ${crew.boatId}`,
      })
    }
  })

  state.landAssignments.forEach((assignment, index) => {
    if (!sessionIds.has(assignment.sessionId as never)) {
      issues.push({
        code: "invalid-session",
        path: `landAssignments[${index}].sessionId`,
        message: `A terra assignment has invalid session: ${assignment.sessionId}`,
      })
    }
    if (!studentIds.has(assignment.studentId)) {
      issues.push({
        code: "dangling-land-student",
        path: `landAssignments[${index}].studentId`,
        message: `A terra references missing student: ${assignment.studentId}`,
      })
    }
    const assignmentKey = `${assignment.sessionId}:${assignment.studentId}`
    if (assignedStudents.has(assignmentKey)) {
      issues.push({
        code: "duplicate-session-student",
        path: `landAssignments[${index}].studentId`,
        message: `Student ${assignment.studentId} is both assigned and A terra in ${assignment.sessionId}`,
      })
    }
    assignedStudents.add(assignmentKey)
  })

  const evaluationKeys = new Set<string>()
  state.evaluations.forEach((evaluation, index) => {
    if (!sessionIds.has(evaluation.sessionId as never)) {
      issues.push({
        code: "invalid-session",
        path: `evaluations[${index}].sessionId`,
        message: `Evaluation has invalid session: ${evaluation.sessionId}`,
      })
    }
    if (!studentIds.has(evaluation.studentId)) {
      issues.push({
        code: "dangling-evaluation-student",
        path: `evaluations[${index}].studentId`,
        message: `Evaluation references missing student: ${evaluation.studentId}`,
      })
    }
    if (
      evaluation.value !== null &&
      !evaluationValues.includes(evaluation.value as never)
    ) {
      issues.push({
        code: "invalid-evaluation-value",
        path: `evaluations[${index}].value`,
        message: `Invalid evaluation value: ${evaluation.value}`,
      })
    }
    const evaluationKey = `${evaluation.sessionId}:${evaluation.studentId}`
    if (evaluationKeys.has(evaluationKey)) {
      issues.push({
        code: "duplicate-evaluation",
        path: `evaluations[${index}]`,
        message: `Duplicate evaluation for ${evaluation.studentId} in ${evaluation.sessionId}`,
      })
    }
    evaluationKeys.add(evaluationKey)
  })

  return issues
}
