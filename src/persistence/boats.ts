import { getBoatIdentityKey, normalizeBoatNumber } from "@/domain/boat"
import {
  BOAT_TYPES,
  type BoatAvailability,
  type BoatType,
  type FaultState,
} from "@/domain/config"
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
      collator.compare(left.number, right.number) ||
      collator.compare(left.type, right.type),
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

export async function createBoats(courseId: string, inputs: BoatInput[]) {
  await db.init()
  if (inputs.length === 0) return []

  const uniqueInputs = new Map<string, BoatInput>()
  for (const input of inputs) {
    if (!BOAT_TYPES.includes(input.type)) throw new Error("Invalid boat type")
    const normalizedInput = {
      ...input,
      number: normalizeBoatNumber(input.number),
    }
    if (!normalizedInput.number) throw new Error("Boat number is required")
    const identity = getBoatIdentityKey(
      normalizedInput.type,
      normalizedInput.number,
    )
    if (!uniqueInputs.has(identity)) uniqueInputs.set(identity, normalizedInput)
  }

  return db.writeTransaction(async (transaction) => {
    const ownedCourse = await transaction.getOptional<{ id: string }>(
      "SELECT id FROM courses WHERE id = ? LIMIT 1",
      [courseId],
    )
    if (!ownedCourse) throw new Error("Boat course does not exist")
    const existing = await transaction.getAll<
      Pick<BoatRecord, "type" | "number">
    >("SELECT type, number FROM boats WHERE courseId = ?", [courseId])
    const existingIdentities = new Set(
      existing.map(({ type, number }) => getBoatIdentityKey(type, number)),
    )
    const newInputs = [...uniqueInputs.entries()]
      .filter(([identity]) => !existingIdentities.has(identity))
      .map(([, input]) => input)
    const boats = newInputs.map<BoatRecord>((input) => ({
      id: crypto.randomUUID(),
      courseId,
      ...input,
      availability: "available",
    }))
    if (boats.length > 0) {
      await transaction.executeBatch(
        "INSERT INTO boats(id, courseId, type, number, availability) VALUES (?, ?, ?, ?, ?)",
        boats.map((boat) => [
          boat.id,
          boat.courseId,
          boat.type,
          boat.number,
          boat.availability,
        ]),
      )
    }
    return boats
  })
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
  const result = await db.execute<{ id: string }>(
    "UPDATE boats SET availability = ? WHERE id = ? AND courseId = ? RETURNING id",
    [availability, boatId, courseId],
  )
  if (Array.from(result).length !== 1) {
    throw new Error("Boat does not belong to course")
  }
}

export async function deleteBoat(boatId: string, courseId: string) {
  await db.init()
  await db.writeTransaction(async (transaction) => {
    const ownedBoat = await transaction.getOptional<{ id: string }>(
      "SELECT id FROM boats WHERE id = ? AND courseId = ? LIMIT 1",
      [boatId, courseId],
    )
    if (!ownedBoat) throw new Error("Boat does not belong to course")
    const historicalReference = await transaction.getOptional<{ id: string }>(
      `SELECT id FROM crews WHERE boatId = ?
       UNION ALL
       SELECT id FROM sessionBoats WHERE boatId = ?
       UNION ALL
       SELECT id FROM faults WHERE boatId = ?
       LIMIT 1`,
      [boatId, boatId, boatId],
    )
    if (historicalReference) {
      throw new Error("Boat has historical operational references")
    }
    const result = await transaction.execute<{ id: string }>(
      "DELETE FROM boats WHERE id = ? AND courseId = ? RETURNING id",
      [boatId, courseId],
    )
    if (Array.from(result).length !== 1) {
      throw new Error("Boat deletion did not remove exactly one row")
    }
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
