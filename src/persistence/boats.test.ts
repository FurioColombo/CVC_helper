import { beforeEach, describe, expect, it, vi } from "vitest"

const database = vi.hoisted(() => ({
  execute: vi.fn(),
  executeBatch: vi.fn(),
  getAll: vi.fn(),
  getOptional: vi.fn(),
  init: vi.fn(),
  writeTransaction: vi.fn(),
}))

const transaction = vi.hoisted(() => ({
  execute: vi.fn(),
  executeBatch: vi.fn(),
  getAll: vi.fn(),
  getOptional: vi.fn(),
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
    database.execute.mockResolvedValue([{ id: "boat-1" }])
    database.executeBatch.mockResolvedValue(undefined)
    database.getAll.mockResolvedValue([])
    database.getOptional.mockResolvedValue(null)
    transaction.execute.mockResolvedValue([{ id: "boat-1" }])
    transaction.executeBatch.mockResolvedValue(undefined)
    transaction.getAll.mockResolvedValue([])
    transaction.getOptional.mockResolvedValue({ id: "course-1" })
    database.writeTransaction.mockImplementation(
      async (callback: (context: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
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

  it("sorts boat identifiers numerically before using model as a tie-breaker", async () => {
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
      {
        id: "boat-vago-7",
        courseId: "course-1",
        type: "Laser Vago",
        number: "7",
        availability: "available",
      },
    ])

    await expect(listBoats("course-1")).resolves.toEqual([
      expect.objectContaining({ number: "2" }),
      expect.objectContaining({ number: "7", type: "Laser Vago" }),
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

  it("creates only unique normalized identities from a batch", async () => {
    const boats = await createBoats("course-1", [
      { type: "RS Quest", number: " 2 " },
      { type: "RS Quest", number: "02" },
      { type: "RS Quest", number: "7" },
      { type: "RS Quest", number: "７" },
    ])

    expect(boats).toEqual([
      expect.objectContaining({ number: "2", availability: "available" }),
      expect.objectContaining({ number: "7", availability: "available" }),
    ])
    expect(transaction.executeBatch).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO boats"),
      expect.arrayContaining([
        expect.arrayContaining(["course-1", "RS Quest", "2", "available"]),
        expect.arrayContaining(["course-1", "RS Quest", "7", "available"]),
      ]),
    )

    await expect(
      createBoats("course-1", [{ type: "RS Quest", number: "   " }]),
    ).rejects.toThrow("Boat number is required")
  })

  it("collapses persisted duplicates while retaining new and cross-model identities", async () => {
    transaction.getAll.mockResolvedValueOnce([
      { type: "RS Quest", number: "07" },
    ])

    const boats = await createBoats("course-1", [
      { type: "RS Quest", number: "7" },
      { type: "RS Quest", number: "11" },
      { type: "RS 500", number: "7" },
    ])

    expect(boats.map(({ type, number }) => ({ type, number }))).toEqual([
      { type: "RS Quest", number: "11" },
      { type: "RS 500", number: "7" },
    ])
    expect(transaction.executeBatch).toHaveBeenCalledOnce()

    transaction.getAll.mockResolvedValueOnce([
      { type: "RS Quest", number: "7" },
    ])
    await expect(
      createBoats("course-1", [{ type: "RS Quest", number: "07" }]),
    ).resolves.toEqual([])
    expect(transaction.executeBatch).toHaveBeenCalledOnce()
  })

  it("rejects runtime values outside the canonical model list", async () => {
    await expect(
      createBoats("course-1", [{ type: "Optimist" as never, number: "2" }]),
    ).rejects.toThrow("Invalid boat type")
    expect(database.writeTransaction).not.toHaveBeenCalled()
  })

  it("refuses to create boats for a missing course", async () => {
    transaction.getOptional.mockResolvedValueOnce(null)

    await expect(
      createBoats("missing-course", [{ type: "RS Quest", number: "2" }]),
    ).rejects.toThrow("Boat course does not exist")
    expect(transaction.executeBatch).not.toHaveBeenCalled()
  })

  it("updates availability without mutating faults", async () => {
    await setBoatAvailability("boat-1", "course-1", "unavailable")

    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE boats SET availability"),
      ["unavailable", "boat-1", "course-1"],
    )
  })

  it("reports a stale or wrong-course availability write", async () => {
    database.execute.mockResolvedValueOnce([])

    await expect(
      setBoatAvailability("boat-1", "wrong-course", "unavailable"),
    ).rejects.toThrow("Boat does not belong to course")
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

  it("rejects stale fault updates and runtime-invalid states", async () => {
    database.execute.mockResolvedValueOnce([])
    await expect(
      updateFaultDescription("missing", "Timone duro"),
    ).rejects.toThrow("Fault does not exist")

    database.execute.mockResolvedValueOnce([])
    await expect(updateFaultState("missing", "reported")).rejects.toThrow(
      "Fault does not exist",
    )
    await expect(
      updateFaultState("fault-1", "archived" as never),
    ).rejects.toThrow("Invalid fault state")
  })

  it("refuses to create a fault for a missing boat", async () => {
    await expect(createFault("missing-boat", "Timone duro")).rejects.toThrow(
      "Fault boat does not exist",
    )
    expect(database.execute).not.toHaveBeenCalled()
  })

  it("deletes only a never-used mistaken boat", async () => {
    transaction.getOptional
      .mockResolvedValueOnce({ id: "boat-1" })
      .mockResolvedValueOnce(null)
    await deleteBoat("boat-1", "course-1")

    expect(database.writeTransaction).toHaveBeenCalledOnce()
    expect(transaction.execute).toHaveBeenCalledOnce()
    expect(transaction.execute).toHaveBeenCalledWith(
      "DELETE FROM boats WHERE id = ? AND courseId = ? RETURNING id",
      ["boat-1", "course-1"],
    )
  })

  it.each(["crew-1", "session-boat-1", "fault-1"])(
    "refuses deletion when history contains %s",
    async (referenceId) => {
      transaction.getOptional
        .mockResolvedValueOnce({ id: "boat-1" })
        .mockResolvedValueOnce({ id: referenceId })

      await expect(deleteBoat("boat-1", "course-1")).rejects.toThrow(
        "historical operational references",
      )
      expect(transaction.getOptional).toHaveBeenLastCalledWith(
        expect.stringMatching(/crews[\s\S]*sessionBoats[\s\S]*faults/),
        ["boat-1", "boat-1", "boat-1"],
      )
      expect(transaction.execute).not.toHaveBeenCalled()
    },
  )

  it("does not inspect or change history when the boat belongs to another course", async () => {
    transaction.getOptional.mockResolvedValueOnce(null)
    await expect(deleteBoat("boat-1", "wrong-course")).rejects.toThrow(
      "Boat does not belong to course",
    )
    expect(transaction.getOptional).toHaveBeenCalledWith(
      expect.stringContaining("id = ? AND courseId = ?"),
      ["boat-1", "wrong-course"],
    )
    expect(transaction.getOptional).toHaveBeenCalledOnce()
    expect(transaction.execute).not.toHaveBeenCalled()
  })

  it("rolls back when deletion does not return exactly one owned row", async () => {
    transaction.getOptional
      .mockResolvedValueOnce({ id: "boat-1" })
      .mockResolvedValueOnce(null)
    transaction.execute.mockResolvedValueOnce([])

    await expect(deleteBoat("boat-1", "course-1")).rejects.toThrow(
      "did not remove exactly one row",
    )
  })
})
