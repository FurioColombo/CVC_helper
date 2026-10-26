import type { CourseFamily, CourseLevel } from "@/domain/config"
import { getStandardCrewSize } from "@/domain/crews"

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

export interface CrewRow extends StampedRow {
  position: number | null
  /** A flexible crew's seats; a fixed-size course's crews use the size. */
  capacity?: number | null
  destination: string
  boatId: string | null
  createdAt?: string | null
}

export interface SlotMemberRow extends StampedRow {
  crewId: string
  position: number | null
}

const positionOf = (row: { position: number | null }) =>
  row.position ?? Number.POSITIVE_INFINITY

/**
 * One session's crews after two phones created crews offline (owner decision
 * 12), each fix counted once:
 *
 * - positions that are not 0..n-1 in order are renumbered in memory, crews
 *   sorted by (position, createdAt, id);
 * - a boat that is not in the session's selection (one phone removed it, the
 *   other assigned it) is taken off the crew, which keeps its people and
 *   becomes `unassigned`;
 * - a boat claimed by two crews stays on the crew with the later edit; the
 *   other is treated the same;
 * - a member slot taken by two people stays with the later edit; the other
 *   moves to the next free slot after it, or to the lowest free one when none
 *   above is within the crew's fixed size; when no slot is free the
 *   earliest-edited surplus members lose their place
 *   (unplaced for the session: no land row is invented). One fix each.
 *
 * Rows come back changed only where something was fixed. A member that moved
 * gets an explicit position, as do all members of its crew, so reading them
 * back needs no guess. The next save writes this state.
 */
export function resolveCrews<C extends CrewRow, M extends SlotMemberRow>(
  crews: readonly C[],
  members: readonly M[],
  options: {
    /** The session's selected boats; omitted, a boat is never unselected. */
    selectedBoatIds?: ReadonlySet<string>
    /** The course's fixed crew size, null or omitted for flexible crews. */
    standardCrewSize?: number | null
  } = {},
) {
  let conflicts = 0
  let ordered = [...crews]
  if (
    ordered.some(
      ({ position }, index) => position != null && position !== index,
    )
  ) {
    ordered.sort(
      (left, right) =>
        (positionOf(left) === positionOf(right)
          ? 0
          : positionOf(left) < positionOf(right)
            ? -1
            : 1) ||
        (left.createdAt ?? "").localeCompare(right.createdAt ?? "") ||
        left.id.localeCompare(right.id),
    )
    ordered = ordered.map((crew, position) => ({ ...crew, position }))
    conflicts += 1
  }

  const unselected = new Set<string>()
  const claims = new Map<string, C[]>()
  for (const crew of ordered) {
    if (crew.destination === "boat" && crew.boatId) {
      if (
        options.selectedBoatIds &&
        !options.selectedBoatIds.has(crew.boatId)
      ) {
        unselected.add(crew.id)
        continue
      }
      claims.set(crew.boatId, [...(claims.get(crew.boatId) ?? []), crew])
    }
  }
  const boatLosers = new Set<string>(unselected)
  for (const claimants of claims.values()) {
    if (claimants.length < 2) continue
    const winner = claimants.reduce((best, crew) =>
      isLaterEdit(crew, best) ? crew : best,
    )
    for (const { id } of claimants) if (id !== winner.id) boatLosers.add(id)
  }
  conflicts += boatLosers.size
  const resolvedCrews = ordered.map((crew) =>
    boatLosers.has(crew.id)
      ? { ...crew, boatId: null, destination: "unassigned" }
      : crew,
  ) as C[]

  const byCrew = new Map<string, Array<{ row: M; slot: number }>>()
  const nextSlot = new Map<string, number>()
  for (const row of members) {
    const expected = nextSlot.get(row.crewId) ?? 0
    const slot = row.position ?? expected
    nextSlot.set(row.crewId, Math.max(expected, slot + 1))
    byCrew.set(row.crewId, [...(byCrew.get(row.crewId) ?? []), { row, slot }])
  }
  // Seats per crew: the course's fixed size, else the crew's own capacity
  // (a flexible crew, review DI-B4-1).
  const seatsOf = new Map(
    resolvedCrews.map((crew) => [
      crew.id,
      options.standardCrewSize ??
        (typeof crew.capacity === "number" ? crew.capacity : null),
    ]),
  )
  const resolvedMembers: M[] = []
  for (const [crewId, entries] of byCrew) {
    const seats = seatsOf.get(crewId) ?? null
    const clash =
      new Set(entries.map(({ slot }) => slot)).size !== entries.length
    const overflow = seats != null && entries.some(({ slot }) => slot >= seats)
    if (!clash && !overflow) {
      resolvedMembers.push(...entries.map(({ row }) => row))
      continue
    }
    // More people than seats: the earliest edits lose their place
    // (unplaced for the session: no land row is invented).
    const latestFirst = [...entries].sort((left, right) =>
      isLaterEdit(left.row, right.row) ? -1 : 1,
    )
    const kept =
      seats != null && latestFirst.length > seats
        ? latestFirst.slice(0, seats)
        : latestFirst
    conflicts += latestFirst.length - kept.length
    // Each seat goes to its latest claimant within the seats; the others
    // take a free seat, above their own first, else the lowest.
    const used = new Set<number>()
    const placed: Array<{ row: M; slot: number }> = []
    const displaced: Array<{ row: M; slot: number }> = []
    for (const entry of kept) {
      if (used.has(entry.slot) || (seats != null && entry.slot >= seats))
        displaced.push(entry)
      else {
        used.add(entry.slot)
        placed.push(entry)
      }
    }
    for (const loser of displaced) {
      conflicts += 1
      let free = loser.slot + 1
      while (used.has(free)) free += 1
      if (seats != null && free >= seats) {
        free = 0
        while (used.has(free)) free += 1
      }
      used.add(free)
      placed.push({ row: loser.row, slot: free })
    }
    placed.sort((left, right) => left.slot - right.slot)
    resolvedMembers.push(
      ...placed.map(({ row, slot }) => ({ ...row, position: slot })),
    )
  }
  return { crews: resolvedCrews, members: resolvedMembers, conflicts }
}

/** Rows of one session sorted by (position, id) and numbered 0..n-1. */
function renumbered<T extends StampedRow & { position: number | null }>(
  rows: readonly T[],
) {
  const sorted = [...rows].sort(
    (left, right) =>
      (positionOf(left) === positionOf(right)
        ? 0
        : positionOf(left) < positionOf(right)
          ? -1
          : 1) || left.id.localeCompare(right.id),
  )
  return sorted.some(
    ({ position }, index) => position != null && position !== index,
  )
    ? sorted.map((row, position) => ({ ...row, position }))
    : [...rows]
}

interface CourseRows {
  courses: ReadonlyArray<Record<string, unknown>>
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
  // Crews and their members, one session at a time.
  const crewRows = tables.crews as unknown as Array<
    CrewRow & { sessionId: string }
  >
  const sessionBoatRows = boats.kept as unknown as Array<
    StampedRow & { sessionId: string; boatId: string; position: number | null }
  >
  const course = tables.courses[0]
  const standardCrewSize = course
    ? getStandardCrewSize(
        course.family as CourseFamily,
        course.level as CourseLevel,
      )
    : null
  let crewConflicts = 0
  const crewsOut = new Map<string, CrewRow & { sessionId: string }>()
  const membersOut: MemberRow[] = []
  const sessions = [...new Set(crewRows.map(({ sessionId }) => sessionId))]
  const placedMembers = people.members as unknown as Array<
    MemberRow & SlotMemberRow
  >
  for (const sessionId of sessions) {
    const sessionCrews = crewRows.filter((crew) => crew.sessionId === sessionId)
    const ids = new Set(sessionCrews.map(({ id }) => id))
    const result = resolveCrews(
      sessionCrews,
      placedMembers.filter(({ crewId }) => ids.has(crewId)),
      {
        standardCrewSize,
        selectedBoatIds: new Set(
          sessionBoatRows
            .filter((row) => row.sessionId === sessionId)
            .map(({ boatId }) => boatId),
        ),
      },
    )
    crewConflicts += result.conflicts
    for (const crew of result.crews) crewsOut.set(crew.id, crew)
    membersOut.push(...result.members)
  }
  const resolved = {
    ...tables,
    crews: crewRows.map((crew) => crewsOut.get(crew.id) ?? crew),
    crewMembers: [
      ...membersOut,
      // Members of a crew the table does not have are left for the validators.
      ...placedMembers.filter(({ crewId }) => !sessionByCrew.has(crewId)),
    ],
    landAssignments: people.land,
    sessionBoats: sessions
      .concat(
        sessionBoatRows
          .map(({ sessionId }) => sessionId)
          .filter((id) => !sessions.includes(id)),
      )
      .filter((id, index, all) => all.indexOf(id) === index)
      .flatMap((sessionId) =>
        renumbered(
          sessionBoatRows.filter((row) => row.sessionId === sessionId),
        ),
      ),
    dutyAssignments: duties.kept,
    evaluations: evaluations.kept,
  } as unknown as T
  return {
    tables: resolved,
    conflicts:
      people.droppedMembers.length +
      people.droppedLand.length +
      boats.dropped.length +
      crewConflicts +
      duties.dropped.length +
      evaluations.dropped.length,
  }
}
