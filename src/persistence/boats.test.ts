import { beforeEach, describe, expect, it, vi } from "vitest"

const database = vi.hoisted(() => ({
  execute: vi.fn(),
  executeBatch: vi.fn(),
  getAll: vi.fn(),
  getOptional: vi.fn(),
  init: vi.fn(),
  writeTransaction: vi.fn(),
}))

vi.mock("@/persistence/db", () => ({ db: database }))

import {
  createBoats,
  createFault,
  deleteBoat,
  listBoats,
  listFaults,
  setBoatAvailability,
  updateFaultDescription,
  updateFaultState,
} from "@/persistence/boats"

describe("boat and fault persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    database.init.mockResolvedValue(undefined)
    database.execute.mockResolvedValue(undefined)
    database.executeBatch.mockResolvedValue(undefined)
    database.getAll.mockResolvedValue([])
    database.getOptional.mockResolvedValue(null)
    database.writeTransaction.mockImplementation(
      async (
        callback: (transaction: {
          execute: typeof database.execute
        }) => Promise<unknown>,
      ) => callback({ execute: database.execute }),
    )
  })

  it("lists course boats and course fault records separately", async () => {
    await listBoats("course-1")
    await listFaults("course-1")

    expect(database.getAll).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("FROM boats"),
      ["course-1"],
    )
    expect(database.getAll).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("JOIN boats"),
      ["course-1"],
    )
  })

  it("sorts numeric boat identifiers naturally", async () => {
    database.getAll.mockResolvedValue([
      {
        id: "boat-11",
        courseId: "course-1",
        type: "RS Quest",
        number: "11",
        availability: "available",
      },
      {
        id: "boat-2",
        courseId: "course-1",
        type: "RS Quest",
        number: "2",
        availability: "available",
      },
    ])

    await expect(listBoats("course-1")).resolves.toEqual([
      expect.objectContaining({ number: "2" }),
      expect.objectContaining({ number: "11" }),
    ])
  })

  it("rejects persisted orphan faults before the join can hide them", async () => {
    database.getOptional.mockResolvedValueOnce({ id: "fault-orphan" })

    await expect(listFaults("course-1")).rejects.toThrow(
      "Fault references missing boat",
    )
    expect(database.getAll).not.toHaveBeenCalled()
  })

  it("creates multiple available boats after rejecting duplicate identities", async () => {
    const boats = await createBoats("course-1", [
      { type: "RS Quest", number: " 2 " },
      { type: "RS Quest", number: "7" },
    ])

    expect(boats).toEqual([
      expect.objectContaining({ number: "2", availability: "available" }),
      expect.objectContaining({ number: "7", availability: "available" }),
    ])
    expect(database.executeBatch).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO boats"),
      expect.arrayContaining([
        expect.arrayContaining(["course-1", "RS Quest", "2", "available"]),
        expect.arrayContaining(["course-1", "RS Quest", "7", "available"]),
      ]),
    )

    database.getAll.mockResolvedValueOnce([{ type: "RS Quest", number: "7" }])
    await expect(
      createBoats("course-1", [{ type: "RS Quest", number: "7" }]),
    ).rejects.toThrow("Boat already exists")
    await expect(
      createBoats("course-1", [{ type: "RS Quest", number: "   " }]),
    ).rejects.toThrow("Boat number is required")
  })

  it("updates availability without mutating faults", async () => {
    await setBoatAvailability("boat-1", "course-1", "unavailable")

    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE boats SET availability"),
      ["unavailable", "boat-1", "course-1"],
    )
  })

  it("creates independent faults and updates description and state", async () => {
    database.getOptional.mockResolvedValueOnce({ id: "boat-1" })
    const fault = await createFault("boat-1", "  Scotta usurata  ")
    await updateFaultDescription(fault.id, "Scotta randa usurata")
    await updateFaultState(fault.id, "reported")

    expect(fault).toEqual(
      expect.objectContaining({
        boatId: "boat-1",
        description: "Scotta usurata",
        state: "open",
      }),
    )
    expect(database.execute).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("INSERT INTO faults"),
      expect.arrayContaining([fault.id, "boat-1", "Scotta usurata", "open"]),
    )
    expect(database.execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("UPDATE faults SET description"),
      expect.arrayContaining(["Scotta randa usurata", fault.id]),
    )
    expect(database.execute).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("UPDATE faults SET state"),
      expect.arrayContaining(["reported", fault.id]),
    )
  })

  it("refuses empty fault text on create and update", async () => {
    await expect(createFault("boat-1", "   ")).rejects.toThrow(
      "Fault description is required",
    )
    await expect(updateFaultDescription("fault-1", " ")).rejects.toThrow(
      "Fault description is required",
    )
  })

  it("refuses to create a fault for a missing boat", async () => {
    await expect(createFault("missing-boat", "Timone duro")).rejects.toThrow(
      "Fault boat does not exist",
    )
    expect(database.execute).not.toHaveBeenCalled()
  })

  it("deletes mistaken boats and their faults atomically", async () => {
    database.getOptional
      .mockResolvedValueOnce({ id: "boat-1" })
      .mockResolvedValueOnce(null)
    await deleteBoat("boat-1", "course-1")

    expect(database.writeTransaction).toHaveBeenCalledOnce()
    expect(database.execute).toHaveBeenNthCalledWith(
      1,
      "DELETE FROM faults WHERE boatId = ?",
      ["boat-1"],
    )
    expect(database.execute).toHaveBeenNthCalledWith(
      2,
      "DELETE FROM boats WHERE id = ? AND courseId = ?",
      ["boat-1", "course-1"],
    )
  })

  it("refuses deletion when operational history references the boat", async () => {
    database.getOptional
      .mockResolvedValueOnce({ id: "boat-1" })
      .mockResolvedValueOnce({ id: "crew-1" })

    await expect(deleteBoat("boat-1", "course-1")).rejects.toThrow(
      "historical operational references",
    )
    expect(database.getOptional).toHaveBeenLastCalledWith(
      expect.stringContaining("sessionBoats"),
      ["boat-1", "boat-1"],
    )
    expect(database.writeTransaction).not.toHaveBeenCalled()
  })

  it("does not touch faults when the boat belongs to another course", async () => {
    await expect(deleteBoat("boat-1", "wrong-course")).rejects.toThrow(
      "Boat does not belong to course",
    )
    expect(database.getOptional).toHaveBeenCalledWith(
      expect.stringContaining("id = ? AND courseId = ?"),
      ["boat-1", "wrong-course"],
    )
    expect(database.writeTransaction).not.toHaveBeenCalled()
    expect(database.execute).not.toHaveBeenCalled()
  })
})
