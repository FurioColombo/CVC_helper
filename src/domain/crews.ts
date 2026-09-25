import {
  COURSE_CONFIG,
  SESSION_SEQUENCE,
  type BoatAvailability,
  type BoatType,
  type CrewDestination,
  type CourseCode,
  type CourseFamily,
  type CourseLevel,
  type SessionId,
} from "./config"

export type CrewPersonType = "student" | "volunteer"

export interface CrewPersonRef {
  personId: string
  personType: CrewPersonType
}

export interface CrewDraft {
  id: string
  sessionId: SessionId
  members: CrewPersonRef[]
  /** Physical crew slot for each compact member entry; omitted for packed crews. */
  memberPositions?: number[]
  /** Maximum members for this crew; fixed at two for D2–D5. */
  capacity: number
  destination: CrewDestination
  boatId: string | null
}

/** Manual capacity can grow to the synthetic 40-student stress-case size. */
export const MAX_FLEXIBLE_CREW_CAPACITY = 40

export interface CrewPlan {
  crews: CrewDraft[]
  landStudentIds: string[]
  selectedBoatIds: string[]
}

export type SessionBoatDisplayState = "unavailable" | "assigned" | "available"

export interface SessionBoatState {
  boatId: string
  type: BoatType
  number: string
  availability: BoatAvailability
  selected: boolean
  assignedCrewId: string | null
  displayState: SessionBoatDisplayState
  hasUnresolvedFault: boolean
}

export type CrewDestinationTarget =
  { kind: "crew"; crewId: string; slotIndex?: number } | { kind: "land" }

export type CrewOperationalDestination =
  { kind: "unassigned" } | { kind: "mezzi" } | { kind: "boat"; boatId: string }

export type CrewCopyRemovalReason = "comandata" | "A terra" | "non disponibile"

export interface CrewCopyRemoval {
  person: CrewPersonRef
  reason: CrewCopyRemovalReason
}

export interface CopyPreviousCrewPlanInput {
  previousPlan: CrewPlan
  sessionId: SessionId
  activeStudentIds: readonly string[]
  currentVolunteerIds: readonly string[]
  currentLandStudentIds: readonly string[]
  dutyStudentIds: readonly string[]
  selectedBoatIds: readonly string[]
  createId?: () => string
}

export type CrewPersonLocation =
  | { kind: "pool" }
  | {
      kind: "crew"
      crewId: string
      memberIndex: number
      slotIndex: number
    }
  | { kind: "land"; memberIndex: number }

export function getCrewMemberPosition(
  crew: Pick<CrewDraft, "members" | "memberPositions">,
  memberIndex: number,
) {
  return crew.memberPositions?.[memberIndex] ?? memberIndex
}

export function getCrewMemberAtPosition(
  crew: Pick<CrewDraft, "members" | "memberPositions">,
  slotIndex: number,
) {
  const memberIndex = crew.members.findIndex(
    (_, index) => getCrewMemberPosition(crew, index) === slotIndex,
  )
  return memberIndex < 0 ? undefined : crew.members[memberIndex]
}

export function getOpenCrewSlotIndexes(
  crew: Pick<CrewDraft, "members" | "memberPositions" | "capacity">,
) {
  const occupied = new Set(
    crew.members.map((_, index) => getCrewMemberPosition(crew, index)),
  )
  return Array.from({ length: crew.capacity }, (_, index) => index).filter(
    (index) => !occupied.has(index),
  )
}

function withMemberPositions(
  crew: CrewDraft,
  members: CrewPersonRef[],
  positions: number[],
): CrewDraft {
  const base = { ...crew }
  delete base.memberPositions
  const isPacked = positions.every((position, index) => position === index)
  return {
    ...base,
    members,
    ...(isPacked ? {} : { memberPositions: positions }),
  }
}

function samePerson(left: CrewPersonRef, right: CrewPersonRef) {
  return (
    left.personId === right.personId && left.personType === right.personType
  )
}

export function getPreviousSessionId(sessionId: SessionId): SessionId | null {
  const index = SESSION_SEQUENCE.findIndex(({ id }) => id === sessionId)
  return index > 0 ? SESSION_SEQUENCE[index - 1]!.id : null
}

export function copyPreviousCrewPlan({
  previousPlan,
  sessionId,
  activeStudentIds,
  currentVolunteerIds,
  currentLandStudentIds,
  dutyStudentIds,
  selectedBoatIds,
  createId = () => crypto.randomUUID(),
}: CopyPreviousCrewPlanInput): {
  plan: CrewPlan
  removals: CrewCopyRemoval[]
} {
  const activeStudents = new Set(activeStudentIds)
  const currentVolunteers = new Set(currentVolunteerIds)
  const currentLand = new Set(currentLandStudentIds)
  const onDuty = new Set(dutyStudentIds)
  const removals: CrewCopyRemoval[] = []

  function keepMember(person: CrewPersonRef) {
    let reason: CrewCopyRemovalReason | null = null
    if (person.personType === "student") {
      if (!activeStudents.has(person.personId)) reason = "non disponibile"
      else if (currentLand.has(person.personId)) reason = "A terra"
      else if (onDuty.has(person.personId)) reason = "comandata"
    } else if (!currentVolunteers.has(person.personId)) {
      reason = "non disponibile"
    }
    if (reason) removals.push({ person, reason })
    return reason === null
  }

  return {
    plan: {
      crews: previousPlan.crews.map((crew) => {
        const members: CrewPersonRef[] = []
        const positions: number[] = []
        crew.members.forEach((person, index) => {
          if (!keepMember(person)) return
          members.push(person)
          positions.push(getCrewMemberPosition(crew, index))
        })
        return withMemberPositions(
          {
            id: createId(),
            sessionId,
            members: [],
            capacity: crew.capacity,
            destination: "unassigned",
            boatId: null,
          },
          members,
          positions,
        )
      }),
      landStudentIds: [...currentLandStudentIds],
      selectedBoatIds: [...selectedBoatIds],
    },
    removals,
  }
}

export function copyPreviousBoatSelection(
  previousBoatIds: readonly string[],
  availableBoatIds: readonly string[],
  requiredBoatIds: readonly string[] = [],
) {
  const available = new Set(availableBoatIds)
  return [...previousBoatIds, ...requiredBoatIds].filter(
    (boatId, index, values) =>
      (available.has(boatId) || requiredBoatIds.includes(boatId)) &&
      values.indexOf(boatId) === index,
  )
}

export function formatCrewAnnouncement({
  destination,
  exactBoatLabel,
  inferredBoatType,
  memberLabels,
}: {
  destination: CrewDestination
  exactBoatLabel?: string | null
  inferredBoatType?: string | null
  memberLabels: readonly string[]
}) {
  const names = memberLabels.join(" / ") || "Equipaggio vuoto"
  const prefix =
    destination === "boat"
      ? exactBoatLabel
      : destination === "mezzi"
        ? "Mezzi"
        : inferredBoatType
  return prefix ? `${prefix} — ${names}` : names
}

export function getStandardCrewSize(family: CourseFamily, level: CourseLevel) {
  const prefix = family === "Deriva" ? "D" : "C"
  const config = COURSE_CONFIG[`${prefix}${level}` as CourseCode]
  return config && "standardCrewSize" in config ? config.standardCrewSize : null
}

export function getInitialCrewCapacity(
  family: CourseFamily,
  level: CourseLevel,
) {
  return getStandardCrewSize(family, level) ?? 4
}

/**
 * Normalizes the nullable field added after 0.1.0. Legacy flexible crews start
 * at four, but preserve every existing member if a crew was already larger.
 */
export function normalizeCrewCapacity(
  capacity: number | null | undefined,
  memberCount: number,
  family: CourseFamily,
  level: CourseLevel,
) {
  const standard = getStandardCrewSize(family, level)
  if (standard !== null) {
    if (capacity !== null && capacity !== undefined && capacity !== standard) {
      throw new Error("Invalid persisted crew capacity")
    }
    return standard
  }
  if (capacity === null || capacity === undefined)
    return Math.max(4, memberCount)
  if (
    !Number.isInteger(capacity) ||
    capacity < Math.max(1, memberCount) ||
    capacity > Math.max(MAX_FLEXIBLE_CREW_CAPACITY, memberCount)
  ) {
    throw new Error("Invalid persisted crew capacity")
  }
  return capacity
}

export function setCrewCapacity(
  plan: CrewPlan,
  crewId: string,
  capacity: number,
  family: CourseFamily,
  level: CourseLevel,
) {
  const crew = plan.crews.find(({ id }) => id === crewId)
  if (!crew) throw new Error("Missing crew")
  if (getStandardCrewSize(family, level) !== null) {
    throw new Error("Crew capacity is fixed for this course")
  }
  if (
    !Number.isInteger(capacity) ||
    capacity < Math.max(1, crew.members.length) ||
    capacity > Math.max(MAX_FLEXIBLE_CREW_CAPACITY, crew.members.length) ||
    crew.members.some(
      (_, index) => getCrewMemberPosition(crew, index) >= capacity,
    )
  ) {
    throw new Error("Invalid crew capacity")
  }
  return {
    ...plan,
    crews: plan.crews.map((candidate) =>
      candidate.id === crewId ? { ...candidate, capacity } : candidate,
    ),
  }
}

export function getEvenCrewTargets(peopleCount: number, crewCount: number) {
  if (!Number.isInteger(peopleCount) || peopleCount < 0) {
    throw new Error("People count must be a non-negative integer")
  }
  if (!Number.isInteger(crewCount) || crewCount < 1) {
    throw new Error("Crew count must be a positive integer")
  }
  const base = Math.floor(peopleCount / crewCount)
  const remainder = peopleCount % crewCount
  return Array.from(
    { length: crewCount },
    (_, index) => base + (index < remainder ? 1 : 0),
  )
}

export function getCrewSizeStatus(
  memberCount: number,
  family: CourseFamily,
  level: CourseLevel,
) {
  if (!Number.isInteger(memberCount) || memberCount < 0) {
    throw new Error("Crew member count must be a non-negative integer")
  }
  const requiredSize = getStandardCrewSize(family, level)
  return {
    requiredSize,
    flexible: requiredSize === null,
    complete: requiredSize === null || memberCount === requiredSize,
    canAdd: requiredSize === null || memberCount < requiredSize,
    overCapacity: requiredSize !== null && memberCount > requiredSize,
  }
}

export function getSessionBoatStates(
  boats: ReadonlyArray<{
    id: string
    type: BoatType
    number: string
    availability: BoatAvailability
  }>,
  plan: CrewPlan,
  unresolvedFaultBoatIds: ReadonlySet<string> = new Set(),
): SessionBoatState[] {
  const selectedBoatIds = new Set(plan.selectedBoatIds)
  const assignedCrewByBoatId = new Map<string, string>()
  for (const crew of plan.crews) {
    if (crew.destination === "boat" && crew.boatId) {
      assignedCrewByBoatId.set(crew.boatId, crew.id)
    }
  }
  const collator = new Intl.Collator("it-IT", {
    numeric: true,
    sensitivity: "base",
  })
  return boats
    .map((boat): SessionBoatState => {
      const assignedCrewId = assignedCrewByBoatId.get(boat.id) ?? null
      return {
        boatId: boat.id,
        type: boat.type,
        number: boat.number,
        availability: boat.availability,
        selected: selectedBoatIds.has(boat.id),
        assignedCrewId,
        displayState:
          boat.availability === "unavailable"
            ? "unavailable"
            : assignedCrewId
              ? "assigned"
              : "available",
        hasUnresolvedFault: unresolvedFaultBoatIds.has(boat.id),
      }
    })
    .sort(
      (left, right) =>
        collator.compare(left.number, right.number) ||
        collator.compare(left.type, right.type) ||
        collator.compare(left.boatId, right.boatId),
    )
}

export function setBoatGoingOut(
  plan: CrewPlan,
  boatId: string,
  goingOut: boolean,
): CrewPlan {
  const selected = plan.selectedBoatIds.includes(boatId)
  if (selected === goingOut) return plan
  return {
    ...plan,
    crews: goingOut
      ? plan.crews
      : plan.crews.map((crew) =>
          crew.destination === "boat" && crew.boatId === boatId
            ? { ...crew, destination: "unassigned", boatId: null }
            : crew,
        ),
    selectedBoatIds: goingOut
      ? [...plan.selectedBoatIds, boatId]
      : plan.selectedBoatIds.filter((id) => id !== boatId),
  }
}

export function assignAvailableSessionBoat(
  plan: CrewPlan,
  crewId: string,
  boatId: string,
  availableBoatIds: ReadonlySet<string>,
) {
  const crew = plan.crews.find(({ id }) => id === crewId)
  if (!crew) throw new Error("Missing crew")
  if (crew.boatId) throw new Error("Crew already has a boat")
  if (!availableBoatIds.has(boatId)) {
    throw new Error("Boat is not available")
  }
  const outingPlan = setBoatGoingOut(plan, boatId, true)
  return assignCrewDestination(outingPlan, crewId, { kind: "boat", boatId })
}

export function assignCrewDestination(
  plan: CrewPlan,
  crewId: string,
  destination: CrewOperationalDestination,
): CrewPlan {
  const crew = plan.crews.find(({ id }) => id === crewId)
  if (!crew) throw new Error("Missing crew")
  if (destination.kind === "boat") {
    if (!plan.selectedBoatIds.includes(destination.boatId)) {
      throw new Error("Boat is not selected for the session")
    }
    if (
      plan.crews.some(
        (candidate) =>
          candidate.id !== crewId &&
          candidate.destination === "boat" &&
          candidate.boatId === destination.boatId,
      )
    ) {
      throw new Error("Boat is already assigned in this session")
    }
  }
  return {
    ...plan,
    crews: plan.crews.map((candidate) =>
      candidate.id === crewId
        ? {
            ...candidate,
            destination: destination.kind,
            boatId: destination.kind === "boat" ? destination.boatId : null,
          }
        : candidate,
    ),
  }
}

export function findPersonLocation(
  plan: CrewPlan,
  person: CrewPersonRef,
): CrewPersonLocation {
  for (const crew of plan.crews) {
    const memberIndex = crew.members.findIndex((member) =>
      samePerson(member, person),
    )
    if (memberIndex >= 0) {
      return {
        kind: "crew",
        crewId: crew.id,
        memberIndex,
        slotIndex: getCrewMemberPosition(crew, memberIndex),
      }
    }
  }
  if (person.personType === "student") {
    const memberIndex = plan.landStudentIds.indexOf(person.personId)
    if (memberIndex >= 0) return { kind: "land", memberIndex }
  }
  return { kind: "pool" }
}

function withoutPerson(plan: CrewPlan, person: CrewPersonRef): CrewPlan {
  return {
    ...plan,
    crews: plan.crews.map((crew) => {
      const members: CrewPersonRef[] = []
      const positions: number[] = []
      crew.members.forEach((member, index) => {
        if (samePerson(member, person)) return
        members.push(member)
        positions.push(getCrewMemberPosition(crew, index))
      })
      return withMemberPositions(crew, members, positions)
    }),
    landStudentIds:
      person.personType === "student"
        ? plan.landStudentIds.filter((id) => id !== person.personId)
        : [...plan.landStudentIds],
  }
}

function putAtLocation(
  plan: CrewPlan,
  person: CrewPersonRef,
  location: CrewPersonLocation,
): CrewPlan {
  if (location.kind === "pool") return plan
  if (location.kind === "land") {
    if (person.personType !== "student") {
      throw new Error("Only students can be assigned A terra")
    }
    const landStudentIds = [...plan.landStudentIds]
    landStudentIds.splice(location.memberIndex, 0, person.personId)
    return { ...plan, landStudentIds }
  }
  return {
    ...plan,
    crews: plan.crews.map((crew) => {
      if (crew.id !== location.crewId) return crew
      const entries = crew.members.map((member, memberIndex) => ({
        member,
        slotIndex: getCrewMemberPosition(crew, memberIndex),
      }))
      entries.push({ member: person, slotIndex: location.slotIndex })
      entries.sort((left, right) => left.slotIndex - right.slotIndex)
      return withMemberPositions(
        crew,
        entries.map(({ member }) => member),
        entries.map(({ slotIndex }) => slotIndex),
      )
    }),
  }
}

export function removePerson(plan: CrewPlan, person: CrewPersonRef) {
  return withoutPerson(plan, person)
}

/**
 * The number of crews is chosen before composing, and the session then has to
 * survive the outing changing shape: a volunteer who does not sail leaves an
 * empty crew behind. Both operations are session-local and touch nothing else
 * in the plan.
 *
 * Removing refuses a crew that still holds someone rather than throwing: the
 * control that calls it is only offered on an empty crew, and a stale tap
 * should do nothing rather than lose a person.
 */
export function addCrew(
  plan: CrewPlan,
  sessionId: SessionId,
  createId: () => string = () => crypto.randomUUID(),
  capacity = 4,
): CrewPlan {
  return {
    ...plan,
    crews: [
      ...plan.crews,
      {
        id: createId(),
        sessionId,
        members: [],
        capacity,
        destination: "unassigned",
        boatId: null,
      },
    ],
  }
}

export function removeEmptyCrew(plan: CrewPlan, crewId: string): CrewPlan {
  const crew = plan.crews.find(({ id }) => id === crewId)
  if (!crew || crew.members.length > 0) return plan
  return { ...plan, crews: plan.crews.filter(({ id }) => id !== crewId) }
}

export function movePerson(
  plan: CrewPlan,
  person: CrewPersonRef,
  destination: CrewDestinationTarget,
) {
  const next = withoutPerson(plan, person)
  if (destination.kind === "land") {
    if (person.personType !== "student") {
      throw new Error("Only students can be assigned A terra")
    }
    return {
      ...next,
      landStudentIds: [...next.landStudentIds, person.personId],
    }
  }
  const crew = next.crews.find(({ id }) => id === destination.crewId)
  if (!crew) throw new Error("Missing crew")
  const openSlots = getOpenCrewSlotIndexes(crew)
  const slotIndex = destination.slotIndex ?? openSlots[0]
  if (slotIndex === undefined || !openSlots.includes(slotIndex)) {
    throw new Error("Crew slot is not available")
  }
  return {
    ...next,
    crews: next.crews.map((candidate) => {
      if (candidate.id !== crew.id) return candidate
      const entries = candidate.members.map((member, memberIndex) => ({
        member,
        slotIndex: getCrewMemberPosition(candidate, memberIndex),
      }))
      entries.push({ member: person, slotIndex })
      entries.sort((left, right) => left.slotIndex - right.slotIndex)
      return withMemberPositions(
        candidate,
        entries.map(({ member }) => member),
        entries.map(({ slotIndex: position }) => position),
      )
    }),
  }
}

export function swapPeople(
  plan: CrewPlan,
  selected: CrewPersonRef,
  target: CrewPersonRef,
) {
  if (samePerson(selected, target)) return plan
  const selectedLocation = findPersonLocation(plan, selected)
  const targetLocation = findPersonLocation(plan, target)
  if (targetLocation.kind === "pool") return plan
  if (
    (targetLocation.kind === "land" && selected.personType !== "student") ||
    (selectedLocation.kind === "land" && target.personType !== "student")
  ) {
    throw new Error("Volunteers cannot be assigned A terra")
  }
  let next = withoutPerson(withoutPerson(plan, selected), target)
  next = putAtLocation(next, selected, targetLocation)
  return putAtLocation(next, target, selectedLocation)
}

export function getCrewCompleteness(
  activeStudentIds: string[],
  plan: CrewPlan,
) {
  const counts = new Map<string, number>()
  const count = (studentId: string) =>
    counts.set(studentId, (counts.get(studentId) ?? 0) + 1)
  plan.crews.forEach((crew) =>
    crew.members.forEach((member) => {
      if (member.personType === "student") count(member.personId)
    }),
  )
  plan.landStudentIds.forEach(count)
  const missingStudentIds = activeStudentIds.filter(
    (studentId) => !counts.has(studentId),
  )
  const duplicateStudentIds = activeStudentIds.filter(
    (studentId) => (counts.get(studentId) ?? 0) > 1,
  )
  return {
    total: activeStudentIds.length,
    accounted: activeStudentIds.length - missingStudentIds.length,
    missingStudentIds,
    duplicateStudentIds,
    complete:
      missingStudentIds.length === 0 && duplicateStudentIds.length === 0,
  }
}
