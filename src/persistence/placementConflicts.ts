/**
 * Placement rows that two phones edited offline can leave the same placement
 * twice (SC-B1-1, owner decision 12): rows written before the ids became
 * deterministic (`placementIds.ts`), a student put on land on one phone and in
 * a crew on the other, or the same person in two crews. Such a clash settles
 * on the latest edit: the row with the latest `updatedAt` stays (a tie goes to
 * the greater id) and the others are dropped. Readers resolve in memory and
 * report it; the next save of that session or day deletes the losing rows.
 */
export interface StampedRow {
  id: string
  updatedAt?: string | null
}

/** Whether `candidate` is the later edit of the two. */
export function isLaterEdit(candidate: StampedRow, other: StampedRow) {
  const left = candidate.updatedAt ?? ""
  const right = other.updatedAt ?? ""
  return left !== right ? left > right : candidate.id > other.id
}

/** The rows with the latest edit of each key, and the rows that lost. */
export function resolveByKey<T extends StampedRow>(
  rows: readonly T[],
  keyOf: (row: T) => string,
) {
  const winners = new Map<string, T>()
  for (const row of rows) {
    const key = keyOf(row)
    const current = winners.get(key)
    if (!current || isLaterEdit(row, current)) winners.set(key, row)
  }
  const kept = rows.filter((row) => winners.get(keyOf(row)) === row)
  return {
    kept,
    dropped: rows.filter((row) => winners.get(keyOf(row)) !== row),
  }
}

export interface MemberRow extends StampedRow {
  crewId: string
  personType: string
  personId: string
}

export interface LandRow extends StampedRow {
  studentId: string
}

/**
 * The people of one or more sessions, each in one place: a crew member row
 * (any crew of the session) or a land row. `sessionOfCrew` maps a crew to its
 * session; members of an unknown crew are left for the validators to report.
 */
export function resolvePeople<M extends MemberRow, L extends LandRow>(
  members: readonly M[],
  land: readonly (L & { sessionId: string })[],
  sessionOfCrew: (crewId: string) => string | undefined,
) {
  type Candidate =
    | { kind: "member"; row: M; stamp: StampedRow }
    | { kind: "land"; row: L & { sessionId: string }; stamp: StampedRow }
  const winners = new Map<string, Candidate>()
  const candidates: Array<[string | null, Candidate]> = [
    ...members.map<[string | null, Candidate]>((row) => {
      const sessionId = sessionOfCrew(row.crewId)
      return [
        sessionId === undefined
          ? null
          : JSON.stringify([sessionId, row.personType, row.personId]),
        { kind: "member", row, stamp: row },
      ]
    }),
    ...land.map<[string | null, Candidate]>((row) => [
      JSON.stringify([row.sessionId, "student", row.studentId]),
      { kind: "land", row, stamp: row },
    ]),
  ]
  for (const [key, candidate] of candidates) {
    if (key === null) continue
    const current = winners.get(key)
    if (!current || isLaterEdit(candidate.stamp, current.stamp)) {
      winners.set(key, candidate)
    }
  }
  const droppedMembers: M[] = []
  const droppedLand: (L & { sessionId: string })[] = []
  for (const [key, candidate] of candidates) {
    if (key === null || winners.get(key) === candidate) continue
    if (candidate.kind === "member") droppedMembers.push(candidate.row)
    else droppedLand.push(candidate.row)
  }
  const gone = new Set<unknown>([...droppedMembers, ...droppedLand])
  return {
    members: members.filter((row) => !gone.has(row)),
    land: land.filter((row) => !gone.has(row)),
    droppedMembers,
    droppedLand,
  }
}

interface CourseRows {
  crews: ReadonlyArray<Record<string, unknown>>
  crewMembers: ReadonlyArray<Record<string, unknown>>
  landAssignments: ReadonlyArray<Record<string, unknown>>
  sessionBoats: ReadonlyArray<Record<string, unknown>>
  dutyAssignments: ReadonlyArray<Record<string, unknown>>
  evaluations: ReadonlyArray<Record<string, unknown>>
}

/**
 * A course's placement tables with each placement once, for the export: the
 * file holds the resolved state, which is also what every screen shows.
 */
export function resolveCoursePlacements<T extends CourseRows>(tables: T) {
  const sessionByCrew = new Map(
    tables.crews.map(({ id, sessionId }) => [
      id as string,
      sessionId as string,
    ]),
  )
  const people = resolvePeople(
    tables.crewMembers as unknown as Array<MemberRow>,
    tables.landAssignments as unknown as Array<LandRow & { sessionId: string }>,
    (crewId) => sessionByCrew.get(crewId),
  )
  const boats = resolveByKey(
    tables.sessionBoats as unknown as Array<
      StampedRow & { sessionId: string; boatId: string }
    >,
    ({ sessionId, boatId }) => JSON.stringify([sessionId, boatId]),
  )
  const duties = resolveByKey(
    tables.dutyAssignments as unknown as Array<
      StampedRow & { dayId: string; studentId: string }
    >,
    ({ dayId, studentId }) => JSON.stringify([dayId, studentId]),
  )
  const evaluations = resolveByKey(
    tables.evaluations as unknown as Array<
      StampedRow & { sessionId: string; studentId: string }
    >,
    ({ sessionId, studentId }) => JSON.stringify([studentId, sessionId]),
  )
  const resolved = {
    ...tables,
    crewMembers: people.members,
    landAssignments: people.land,
    sessionBoats: boats.kept,
    dutyAssignments: duties.kept,
    evaluations: evaluations.kept,
  } as unknown as T
  return {
    tables: resolved,
    conflicts:
      people.droppedMembers.length +
      people.droppedLand.length +
      boats.dropped.length +
      duties.dropped.length +
      evaluations.dropped.length,
  }
}
