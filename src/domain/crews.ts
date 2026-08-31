import {
  COURSE_CONFIG,
  type CrewDestination,
  type CourseFamily,
  type CourseLevel,
  type SessionId,
} from "@/domain/config"

export type CrewPersonType = "student" | "volunteer"

export interface CrewPersonRef {
  personId: string
  personType: CrewPersonType
}

export interface CrewDraft {
  id: string
  sessionId: SessionId
  members: CrewPersonRef[]
  destination: CrewDestination
  boatId: string | null
}

export interface CrewPlan {
  crews: CrewDraft[]
  landStudentIds: string[]
  selectedBoatIds: string[]
}

export type CrewDestinationTarget =
  { kind: "crew"; crewId: string } | { kind: "land" }

export type CrewOperationalDestination =
  { kind: "unassigned" } | { kind: "mezzi" } | { kind: "boat"; boatId: string }

export type CrewPersonLocation =
  | { kind: "pool" }
  | { kind: "crew"; crewId: string; memberIndex: number }
  | { kind: "land"; memberIndex: number }

function samePerson(left: CrewPersonRef, right: CrewPersonRef) {
  return (
    left.personId === right.personId && left.personType === right.personType
  )
}

export function getStandardCrewSize(family: CourseFamily, level: CourseLevel) {
  const prefix = family === "Deriva" ? "D" : "C"
  const config =
    COURSE_CONFIG[`${prefix}${level}` as keyof typeof COURSE_CONFIG]
  return config && "standardCrewSize" in config ? config.standardCrewSize : null
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

export function setBoatGoingOut(
  plan: CrewPlan,
  boatId: string,
  goingOut: boolean,
): CrewPlan {
  const selected = plan.selectedBoatIds.includes(boatId)
  if (selected === goingOut) return plan
  if (
    !goingOut &&
    plan.crews.some(
      (crew) => crew.destination === "boat" && crew.boatId === boatId,
    )
  ) {
    throw new Error("Cannot remove a boat assigned to a crew")
  }
  return {
    ...plan,
    selectedBoatIds: goingOut
      ? [...plan.selectedBoatIds, boatId]
      : plan.selectedBoatIds.filter((id) => id !== boatId),
  }
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
    if (memberIndex >= 0) return { kind: "crew", crewId: crew.id, memberIndex }
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
    crews: plan.crews.map((crew) => ({
      ...crew,
      members: crew.members.filter((member) => !samePerson(member, person)),
    })),
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
      const members = [...crew.members]
      members.splice(location.memberIndex, 0, person)
      return { ...crew, members }
    }),
  }
}

export function removePerson(plan: CrewPlan, person: CrewPersonRef) {
  return withoutPerson(plan, person)
}

export function movePerson(
  plan: CrewPlan,
  person: CrewPersonRef,
  destination: CrewDestinationTarget,
  crewSize: number,
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
  if (crew.members.length >= crewSize) throw new Error("Crew is full")
  return {
    ...next,
    crews: next.crews.map((candidate) =>
      candidate.id === crew.id
        ? { ...candidate, members: [...candidate.members, person] }
        : candidate,
    ),
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
