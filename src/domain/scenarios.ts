import type { CourseStateSnapshot } from "./invariants"
import { DUTY_DAYS, SESSION_SEQUENCE, type SessionId } from "./config"

export function buildD2FoundationScenario(): CourseStateSnapshot {
  return {
    students: [{ id: "student-mario-rossi" }, { id: "student-luca-bianchi" }],
    volunteers: [
      { id: "volunteer-adv-anna", name: "Anna Bianchi", role: "ADV" },
    ],
    boats: [
      {
        id: "boat-quest-7",
        type: "RS Quest",
        number: "7",
        availability: "available",
      },
    ],
    faults: [
      {
        id: "fault-quest-7-sheet",
        boatId: "boat-quest-7",
        description: "Scotta randa usurata",
        state: "reported",
        createdAt: "2026-08-29T10:00:00.000Z",
        updatedAt: "2026-08-29T10:05:00.000Z",
      },
    ],
    crews: [
      {
        id: "crew-sat-pm-1",
        sessionId: "sat-pm",
        studentIds: ["student-mario-rossi", "student-luca-bianchi"],
        volunteerIds: [],
        destination: "boat",
        boatId: "boat-quest-7",
      },
    ],
    landAssignments: [],
    sessionBoats: [
      {
        id: "session-boat-sat-pm-quest-7",
        sessionId: "sat-pm",
        boatId: "boat-quest-7",
      },
    ],
    evaluations: [
      {
        id: "evaluation-mario-sat-pm",
        sessionId: "sat-pm",
        studentId: "student-mario-rossi",
        value: "+",
      },
    ],
  }
}

export interface D2FullWeekScenario extends CourseStateSnapshot {
  students: Array<
    CourseStateSnapshot["students"][number] & {
      firstName: string
      surname: string
      dateOfBirth: string
      active: 1
      sex: "male" | "female"
      size: "XS" | "S" | "M" | "L" | "XL"
    }
  >
  course: {
    id: string
    family: "Deriva"
    level: 2
    startDate: string
    endDate: string
    label: string
  }
  timeline: Array<
    | {
        kind: "duty-override"
        dayId: string
        removedStudentId: string
        addedStudentId: string
      }
    | {
        kind: "student-availability"
        afterSessionId: SessionId
        studentId: string
        active: 0 | 1
      }
    | { kind: "reopen"; afterSessionId: SessionId }
  >
}

const FULL_WEEK_STUDENTS = [
  ["aldo-rossi", "Aldo", "Rossi", "2010-04-12", "male", "XS"],
  ["bea-verdi", "Bea", "Verdi", "1997-06-22", "female", "S"],
  ["carlo-neri", "Carlo", "Neri", "1991-03-15", "male", "M"],
  ["dina-blu", "Dina", "Blu", "1998-11-09", "female", "L"],
  ["enzo-gialli", "Enzo", "Gialli", "1989-07-01", "male", "XL"],
  ["fina-bianchi", "Fina", "Bianchi", "1996-01-24", "female", "M"],
  ["giorgio-serra", "Giorgio", "Serra", "1994-05-20", "male", "L"],
  ["iris-costa", "Iris", "Costa", "2001-12-03", "female", "S"],
  ["luca-romano", "Luca", "Romano", "1993-09-17", "male", "M"],
  ["marta-greco", "Marta", "Greco", "2011-02-08", "female", "XS"],
  ["nico-fontana", "Nico", "Fontana", "1987-04-18", "male", "XL"],
  ["olga-conti", "Olga", "Conti", "1995-08-29", "female", "S"],
  ["paolo-villa", "Paolo", "Villa", "1992-10-30", "male", "M"],
  ["rita-moretti", "Rita", "Moretti", "1999-02-12", "female", "L"],
  ["sara-ricci", "Sara", "Ricci", "2000-06-16", "female", "M"],
  ["teo-marino", "Teo", "Marino", "1990-01-11", "male", "S"],
  ["ugo-ferri", "Ugo", "Ferri", "1988-12-07", "male", "XL"],
  ["vera-leone", "Vera", "Leone", "2002-03-21", "female", "XS"],
  ["aldo-colombo", "Aldo", "Colombo", "1994-09-02", "male", "M"],
  ["zoe-riva", "Zoe", "Riva", "1998-05-13", "female", "L"],
  ["milo-sala", "Milo", "Sala", "1996-07-25", "male", "S"],
] as const

export function buildD2FullWeekScenario(): D2FullWeekScenario {
  const students = FULL_WEEK_STUDENTS.map(
    ([id, firstName, surname, dateOfBirth, sex, size]) => ({
      id: `student-${id}`,
      firstName,
      surname,
      dateOfBirth,
      active: 1 as const,
      sex,
      size,
    }),
  )
  const dutyAssignments = DUTY_DAYS.flatMap(({ id: dayId }, dayIndex) => {
    const assigned = students.slice(dayIndex * 3, dayIndex * 3 + 3)
    if (dayId === "wednesday") assigned[0] = students[18]!
    return assigned.map(({ id: studentId }) => ({ dayId, studentId }))
  })
  const crews = SESSION_SEQUENCE.flatMap(({ id: sessionId }) => [
    {
      id: `crew-${sessionId}-1`,
      sessionId,
      studentIds: [students[0]!.id, students[1]!.id],
      volunteerIds: [],
      destination: "boat",
      boatId: "boat-quest-2",
    },
    {
      id: `crew-${sessionId}-2`,
      sessionId,
      studentIds: [students[2]!.id, students[3]!.id],
      volunteerIds: [],
      destination: "mezzi",
    },
    ...Array.from({ length: 7 }, (_, pairIndex) => {
      const studentIds = [
        students[pairIndex * 2 + 4]!.id,
        students[pairIndex * 2 + 5]!.id,
      ]
      return {
        id: `crew-${sessionId}-${pairIndex + 3}`,
        sessionId,
        studentIds:
          sessionId === "wed-am" || sessionId === "wed-pm"
            ? studentIds.filter((studentId) => studentId !== students[12]!.id)
            : studentIds,
        volunteerIds: [],
        destination: "unassigned",
      }
    }),
    {
      id: `crew-${sessionId}-10`,
      sessionId,
      studentIds: [students[18]!.id],
      volunteerIds: ["volunteer-adv-anna"],
      destination: "unassigned",
    },
  ])
  const evaluationValues = ["++", "+", "=", "-", "--"] as const

  return {
    course: {
      id: "course-d2-week-35-2026",
      family: "Deriva",
      level: 2,
      startDate: "2026-08-29",
      endDate: "2026-09-05",
      label: "D2 35 2026",
    },
    students,
    volunteers: [
      { id: "volunteer-adv-anna", name: "Anna Bianchi", role: "ADV" },
      { id: "volunteer-adv-bruno", name: "Bruno Costa", role: "ADV" },
      { id: "volunteer-is-clara", name: "Clara Riva", role: "IS" },
    ],
    boats: [
      {
        id: "boat-quest-2",
        type: "RS Quest",
        number: "2",
        availability: "available",
      },
      {
        id: "boat-quest-7",
        type: "RS Quest",
        number: "7",
        availability: "available",
      },
      {
        id: "boat-quest-9",
        type: "RS Quest",
        number: "9",
        availability: "available",
      },
      {
        id: "boat-quest-12",
        type: "RS Quest",
        number: "12",
        availability: "unavailable",
      },
    ],
    faults: [
      {
        id: "fault-quest-7-rudder",
        boatId: "boat-quest-7",
        description: "Timone da controllare",
        state: "open",
        createdAt: "2026-08-29T08:00:00.000Z",
        updatedAt: "2026-08-29T08:00:00.000Z",
      },
      {
        id: "fault-quest-9-sheet",
        boatId: "boat-quest-9",
        description: "Scotta randa usurata",
        state: "reported",
        createdAt: "2026-08-30T17:00:00.000Z",
        updatedAt: "2026-08-30T17:15:00.000Z",
      },
    ],
    dutyAssignments,
    completedDutyDayIds: ["saturday", "sunday", "monday"],
    crews,
    landAssignments: SESSION_SEQUENCE.flatMap(({ id: sessionId }) => [
      {
        id: `land-${sessionId}-${students[19]!.id}`,
        sessionId,
        studentId: students[19]!.id,
      },
      {
        id: `land-${sessionId}-${students[20]!.id}`,
        sessionId,
        studentId: students[20]!.id,
      },
    ]),
    sessionBoats: SESSION_SEQUENCE.flatMap(({ id: sessionId }) => [
      {
        id: `session-boat-${sessionId}-quest-2`,
        sessionId,
        boatId: "boat-quest-2",
      },
      {
        id: `session-boat-${sessionId}-quest-7`,
        sessionId,
        boatId: "boat-quest-7",
      },
    ]),
    evaluations: SESSION_SEQUENCE.flatMap(({ id: sessionId }, sessionIndex) =>
      students.slice(0, 4).map(({ id: studentId }, studentIndex) => ({
        id: `evaluation-${sessionId}-${studentId}`,
        sessionId,
        studentId,
        value: evaluationValues[(sessionIndex + studentIndex) % 5]!,
        note:
          sessionIndex === 0 && studentIndex === 0
            ? "Conduzione sicura e comunicazione chiara"
            : null,
      })),
    ),
    timeline: [
      {
        kind: "duty-override",
        dayId: "wednesday",
        removedStudentId: students[12]!.id,
        addedStudentId: students[18]!.id,
      },
      {
        kind: "student-availability",
        afterSessionId: "tue-pm",
        studentId: students[12]!.id,
        active: 0,
      },
      { kind: "reopen", afterSessionId: "wed-am" },
      {
        kind: "student-availability",
        afterSessionId: "wed-pm",
        studentId: students[12]!.id,
        active: 1,
      },
      { kind: "reopen", afterSessionId: "fri-pm" },
    ],
  }
}
