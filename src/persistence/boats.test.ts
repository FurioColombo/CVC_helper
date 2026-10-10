import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
import { TOUCH } from "@/persistence/stamp"

const NOW = "2026-09-20T08:15:30.250Z"

describe("boat and fault persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(NOW))
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

  afterEach(() => {
    vi.useRealTimers()
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
    // One stamp for the whole batch, as both created and updated time.
    expect(transaction.executeBatch).toHaveBeenCalledWith(
      expect.stringMatching(
        /INSERT INTO boats\([^)]*createdAt, updatedAt\s*\)/,
      ),
      [
        [boats[0]?.id, "course-1", "RS Quest", "2", "available", NOW, NOW],
        [boats[1]?.id, "course-1", "RS Quest", "7", "available", NOW, NOW],
      ],
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
      expect.stringContaining(`UPDATE boats SET availability = ?, ${TOUCH}`),
      ["unavailable", NOW, "boat-1", "course-1"],
    )
  })

  it("reports a stale or wrong-course availability write", async () => {
    database.execute.mockResolvedValueOnce([])

    await expect(
      setBoatAvailability("boat-1", "wrong-course", "unavailable"),
    ).rejects.toThrow("Boat does not belong to course")
  })

  it("creates independent faults and updates description and state", async () => {
    transaction.getOptional.mockResolvedValueOnce({
      id: "boat-1",
      courseId: "course-1",
    })
    const fault = await createFault("boat-1", "  Scotta usurata  ")
    await updateFaultDescription(fault.id, "Scotta randa usurata")
    await updateFaultState(fault.id, "reported")

    expect(fault).toEqual({
      id: expect.any(String),
      boatId: "boat-1",
      description: "Scotta usurata",
      state: "open",
      createdAt: NOW,
      updatedAt: NOW,
    })
    expect(transaction.execute).toHaveBeenCalledOnce()
    expect(transaction.execute).toHaveBeenCalledWith(
      expect.stringMatching(
        /INSERT INTO faults\([^)]*courseId[^)]*createdAt, updatedAt\s*\)/,
      ),
      [fault.id, "course-1", "boat-1", "Scotta usurata", "open", NOW, NOW],
    )
    expect(database.execute).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(`UPDATE faults SET description = ?, ${TOUCH}`),
      ["Scotta randa usurata", NOW, fault.id],
    )
    expect(database.execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(`UPDATE faults SET state = ?, ${TOUCH}`),
      ["reported", NOW, fault.id],
    )
  })

  // UG2-DAT-7: the boat used to be looked up and the fault inserted in two
  // separate steps, so a boat deleted in between left a fault without a boat.
  it("checks the boat and inserts the fault in one transaction, with the boat's course", async () => {
    transaction.getOptional.mockResolvedValueOnce({
      id: "boat-1",
      courseId: "course-7",
    })

    await createFault("boat-1", "Timone duro")

    expect(database.writeTransaction).toHaveBeenCalledOnce()
    expect(database.getOptional).not.toHaveBeenCalled()
    expect(database.execute).not.toHaveBeenCalled()
    expect(transaction.getOptional).toHaveBeenCalledWith(
      "SELECT id, courseId FROM boats WHERE id = ? LIMIT 1",
      ["boat-1"],
    )
    expect(transaction.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO faults"),
      [
        expect.any(String),
        "course-7",
        "boat-1",
        "Timone duro",
        "open",
        NOW,
        NOW,
      ],
    )
  })

  it("refuses empty fault text on create and update", async () => {
    await expect(createFault("boat-1", "   ")).rejects.toThrow(
      "Fault description is required",
    )
    await expect(updateFaultDescription("fault-1", " ")).rejects.toThrow(
      "Fault description is required",
    )
    expect(database.writeTransaction).not.toHaveBeenCalled()
    expect(database.execute).not.toHaveBeenCalled()
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
    transaction.getOptional.mockResolvedValueOnce(null)

    await expect(createFault("missing-boat", "Timone duro")).rejects.toThrow(
      "Fault boat does not exist",
    )
    expect(transaction.execute).not.toHaveBeenCalled()
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

// UG2-DAT-2: a phone clock that steps back between creating a fault and editing
// it used to store an update "before" the creation, which made Avarie, Barche
// and Equipaggi refuse to open. The statements the app sends are run here on a
// real SQLite, with the clock set back.
describe("fault update stamps", () => {
  const CREATED_AT = "2026-09-19T10:00:00.000Z"

  beforeEach(() => {
    vi.clearAllMocks()
    database.init.mockResolvedValue(undefined)
    database.execute.mockResolvedValue([{ id: "fault-1" }])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function runOnSqlite(
    clock: string,
    update: () => Promise<unknown>,
    storedUpdatedAt = CREATED_AT,
  ): Promise<{ createdAt: string; updatedAt: string }> {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(clock))
    await update()
    const { DatabaseSync } = await import("node:sqlite")
    const sqlite = new DatabaseSync(":memory:")
    sqlite.exec(
      `CREATE TABLE faults (
         id TEXT PRIMARY KEY, boatId TEXT, description TEXT, state TEXT,
         createdAt TEXT, updatedAt TEXT)`,
    )
    sqlite
      .prepare("INSERT INTO faults VALUES (?, ?, ?, ?, ?, ?)")
      .run("fault-1", "boat-1", "Scotta", "open", CREATED_AT, storedUpdatedAt)
    for (const [sql, params] of database.execute.mock.calls as Array<
      [string, Array<string | number>]
    >) {
      sqlite.prepare(sql).all(...params)
    }
    const row = sqlite
      .prepare("SELECT createdAt, updatedAt FROM faults WHERE id = ?")
      .get("fault-1") as { createdAt: string; updatedAt: string }
    sqlite.close()
    return row
  }

  it.each([
    ["state", () => updateFaultState("fault-1", "reported")],
    [
      "description",
      () => updateFaultDescription("fault-1", "Scotta della randa"),
    ],
  ])(
    "keeps a %s edit made with the clock set back at the creation time",
    async (_field, update) => {
      const row = await runOnSqlite("2026-09-19T09:00:00.000Z", update)

      expect(row.updatedAt).toBe(CREATED_AT)
      expect(row.updatedAt >= row.createdAt).toBe(true)
    },
  )

  it.each([
    ["state", () => updateFaultState("fault-1", "reported")],
    [
      "description",
      () => updateFaultDescription("fault-1", "Scotta della randa"),
    ],
  ])("stamps a %s edit made later with the clock", async (_field, update) => {
    const row = await runOnSqlite("2026-09-19T11:30:00.000Z", update)

    expect(row.updatedAt).toBe("2026-09-19T11:30:00.000Z")
  })

  // The stamp moves forward from the fault's last edit, not only from its
  // creation: an edit made after the clock stepped back keeps the later time.
  it("never moves a later stored updatedAt backwards", async () => {
    const row = await runOnSqlite(
      "2026-09-19T10:15:00.000Z",
      () => updateFaultState("fault-1", "reported"),
      "2026-09-19T10:30:00.000Z",
    )

    expect(row.updatedAt).toBe("2026-09-19T10:30:00.000Z")
  })
})
