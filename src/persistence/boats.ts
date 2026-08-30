import type { BoatAvailability, BoatType, FaultState } from "@/domain/config"
import { db } from "@/persistence/db"

export interface BoatRecord {
  id: string
  courseId: string
  type: BoatType
  number: string
  availability: BoatAvailability
}

export interface BoatInput {
  type: BoatType
  number: string
}

export interface FaultRecord {
  id: string
  boatId: string
  description: string
  state: FaultState
  createdAt: string
  updatedAt: string
}

export interface CourseFaultRecord extends FaultRecord {
  boatType: BoatType
  boatNumber: string
}

const BOAT_COLUMNS = "id, courseId, type, number, availability"
const FAULT_COLUMNS = "id, boatId, description, state, createdAt, updatedAt"

export async function listBoats(courseId: string) {
  await db.init()
  const boats = await db.getAll<BoatRecord>(
    `SELECT ${BOAT_COLUMNS}
     FROM boats
     WHERE courseId = ?
     ORDER BY type COLLATE NOCASE, number COLLATE NOCASE`,
    [courseId],
  )
  const collator = new Intl.Collator("it-IT", {
    numeric: true,
    sensitivity: "base",
  })
  return boats.sort(
    (left, right) =>
      collator.compare(left.type, right.type) ||
      collator.compare(left.number, right.number),
  )
}

export async function listFaultsForBoat(boatId: string) {
  await db.init()
  return db.getAll<FaultRecord>(
    `SELECT ${FAULT_COLUMNS}
     FROM faults
     WHERE boatId = ?
     ORDER BY CASE state WHEN 'resolved' THEN 1 ELSE 0 END,
              updatedAt DESC`,
    [boatId],
  )
}

export async function listFaults(courseId: string) {
  await db.init()
  const orphan = await db.getOptional<{ id: string }>(
    `SELECT f.id
     FROM faults f
     LEFT JOIN boats b ON b.id = f.boatId
     WHERE b.id IS NULL
     LIMIT 1`,
  )
  if (orphan) throw new Error(`Fault references missing boat: ${orphan.id}`)
  return db.getAll<CourseFaultRecord>(
    `SELECT f.id, f.boatId, f.description, f.state, f.createdAt, f.updatedAt,
            b.type AS boatType, b.number AS boatNumber
     FROM faults f
     JOIN boats b ON b.id = f.boatId
     WHERE b.courseId = ?
     ORDER BY CASE f.state WHEN 'resolved' THEN 1 ELSE 0 END,
              f.updatedAt DESC`,
    [courseId],
  )
}

async function assertNoDuplicateBoat(courseId: string, inputs: BoatInput[]) {
  const existing = await db.getAll<Pick<BoatRecord, "type" | "number">>(
    "SELECT type, number FROM boats WHERE courseId = ?",
    [courseId],
  )
  const identities = new Set(
    existing.map(
      ({ type, number }) =>
        `${type}:${number.trim().toLocaleLowerCase("it-IT")}`,
    ),
  )
  for (const input of inputs) {
    const identity = `${input.type}:${input.number.trim().toLocaleLowerCase("it-IT")}`
    if (identities.has(identity)) throw new Error("Boat already exists")
    identities.add(identity)
  }
}

export async function createBoats(courseId: string, inputs: BoatInput[]) {
  await db.init()
  if (inputs.length === 0) return []
  const normalizedInputs = inputs.map((input) => ({
    ...input,
    number: input.number.trim(),
  }))
  if (normalizedInputs.some(({ number }) => !number)) {
    throw new Error("Boat number is required")
  }
  await assertNoDuplicateBoat(courseId, normalizedInputs)
  const boats = normalizedInputs.map<BoatRecord>((input) => ({
    id: crypto.randomUUID(),
    courseId,
    ...input,
    availability: "available",
  }))
  await db.executeBatch(
    "INSERT INTO boats(id, courseId, type, number, availability) VALUES (?, ?, ?, ?, ?)",
    boats.map((boat) => [
      boat.id,
      boat.courseId,
      boat.type,
      boat.number,
      boat.availability,
    ]),
  )
  return boats
}

export async function createBoat(courseId: string, input: BoatInput) {
  const [boat] = await createBoats(courseId, [input])
  if (!boat) throw new Error("Boat was not created")
  return boat
}

export async function setBoatAvailability(
  boatId: string,
  courseId: string,
  availability: BoatAvailability,
) {
  await db.init()
  await db.execute(
    "UPDATE boats SET availability = ? WHERE id = ? AND courseId = ?",
    [availability, boatId, courseId],
  )
}

export async function deleteBoat(boatId: string, courseId: string) {
  await db.init()
  const ownedBoat = await db.getOptional<{ id: string }>(
    "SELECT id FROM boats WHERE id = ? AND courseId = ? LIMIT 1",
    [boatId, courseId],
  )
  if (!ownedBoat) throw new Error("Boat does not belong to course")
  const crewReference = await db.getOptional<{ id: string }>(
    "SELECT id FROM crews WHERE boatId = ? LIMIT 1",
    [boatId],
  )
  if (crewReference) throw new Error("Boat has historical crew references")
  await db.writeTransaction(async (transaction) => {
    await transaction.execute("DELETE FROM faults WHERE boatId = ?", [boatId])
    await transaction.execute(
      "DELETE FROM boats WHERE id = ? AND courseId = ?",
      [boatId, courseId],
    )
  })
}

export async function createFault(boatId: string, description: string) {
  await db.init()
  const normalizedDescription = description.trim()
  if (!normalizedDescription) throw new Error("Fault description is required")
  const boat = await db.getOptional<{ id: string }>(
    "SELECT id FROM boats WHERE id = ? LIMIT 1",
    [boatId],
  )
  if (!boat) throw new Error("Fault boat does not exist")
  const now = new Date().toISOString()
  const fault: FaultRecord = {
    id: crypto.randomUUID(),
    boatId,
    description: normalizedDescription,
    state: "open",
    createdAt: now,
    updatedAt: now,
  }
  await db.execute(
    `INSERT INTO faults(id, boatId, description, state, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      fault.id,
      fault.boatId,
      fault.description,
      fault.state,
      fault.createdAt,
      fault.updatedAt,
    ],
  )
  return fault
}

export async function updateFaultState(faultId: string, state: FaultState) {
  await db.init()
  await db.execute("UPDATE faults SET state = ?, updatedAt = ? WHERE id = ?", [
    state,
    new Date().toISOString(),
    faultId,
  ])
}

export async function updateFaultDescription(
  faultId: string,
  description: string,
) {
  await db.init()
  const normalizedDescription = description.trim()
  if (!normalizedDescription) throw new Error("Fault description is required")
  await db.execute(
    "UPDATE faults SET description = ?, updatedAt = ? WHERE id = ?",
    [normalizedDescription, new Date().toISOString(), faultId],
  )
}
