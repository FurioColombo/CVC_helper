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
  readDutyPlan,
  saveDutyPlan,
  type DutySettingsRecord,
} from "@/persistence/duties"

const SETTINGS: DutySettingsRecord = {
  desiredPerDay: 3,
  fewerDayIds: ["saturday"],
  balanceMinors: true,
  balanceSex: false,
  tieBreaker: "alphabetical",
  stayOverStudentIds: ["student-1"],
  completedDayIds: ["saturday"],
  acknowledgedWarningKeys: ["minor-balance:2,0"],
}

describe("duty persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    database.init.mockResolvedValue(undefined)
    database.getAll.mockResolvedValue([])
    database.getOptional.mockResolvedValue(null)
    database.writeTransaction.mockImplementation(
      async (
        callback: (transaction: {
          execute: typeof database.execute
          executeBatch: typeof database.executeBatch
        }) => Promise<unknown>,
      ) =>
        callback({
          execute: database.execute,
          executeBatch: database.executeBatch,
        }),
    )
  })

  it("reads and parses the course plan", async () => {
    database.getAll.mockResolvedValue([
      { dayId: "saturday", studentId: "student-1" },
    ])
    database.getOptional.mockResolvedValue({
      desiredPerDay: 3,
      fewerDayIds: '["saturday"]',
      balanceMinors: 1,
      balanceSex: 0,
      tieBreaker: "alphabetical",
      stayOverStudentIds: '["student-1"]',
      completedDayIds: '["saturday"]',
      acknowledgedWarningKeys: '["warning-1"]',
    })

    await expect(readDutyPlan("course-1")).resolves.toEqual({
      assignments: [{ dayId: "saturday", studentId: "student-1" }],
      settings: expect.objectContaining({
        completedDayIds: ["saturday"],
        balanceMinors: true,
        balanceSex: false,
      }),
    })
  })

  it("replaces assignments and settings atomically", async () => {
    await saveDutyPlan(
      "course-1",
      [{ dayId: "saturday", studentId: "student-1" }],
      SETTINGS,
    )

    expect(database.writeTransaction).toHaveBeenCalledOnce()
    expect(database.execute).toHaveBeenNthCalledWith(
      1,
      "DELETE FROM dutyAssignments WHERE courseId = ?",
      ["course-1"],
    )
    expect(database.executeBatch).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO dutyAssignments"),
      [expect.arrayContaining(["course-1", "saturday", "student-1"])],
    )
    expect(database.execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT OR REPLACE INTO dutySettings"),
      expect.arrayContaining(["course-1"]),
    )
  })

  it("refuses duplicate day/student rows", async () => {
    await expect(
      saveDutyPlan(
        "course-1",
        [
          { dayId: "saturday", studentId: "student-1" },
          { dayId: "saturday", studentId: "student-1" },
        ],
        SETTINGS,
      ),
    ).rejects.toThrow("Duplicate duty assignment")
    expect(database.writeTransaction).not.toHaveBeenCalled()
  })

  it("refuses a fractional desired daily count before writing", async () => {
    await expect(
      saveDutyPlan("course-1", [], { ...SETTINGS, desiredPerDay: 2.5 }),
    ).rejects.toThrow("Invalid duty settings")
    expect(database.writeTransaction).not.toHaveBeenCalled()
  })

  it("rejects a persisted fractional desired daily count on reload", async () => {
    database.getOptional.mockResolvedValue({
      desiredPerDay: 2.5,
      fewerDayIds: "[]",
      balanceMinors: 1,
      balanceSex: 0,
      tieBreaker: "alphabetical",
      stayOverStudentIds: "[]",
      completedDayIds: "[]",
      acknowledgedWarningKeys: "[]",
    })

    await expect(readDutyPlan("course-1")).rejects.toThrow(
      "Invalid persisted duty settings",
    )
  })

  it("rejects corrupt persisted settings", async () => {
    database.getOptional.mockResolvedValue({
      desiredPerDay: 0,
      fewerDayIds: '["noday"]',
      balanceMinors: 2,
      balanceSex: 0,
      tieBreaker: "random",
      stayOverStudentIds: "[]",
      completedDayIds: "[]",
      acknowledgedWarningKeys: "[]",
    })

    await expect(readDutyPlan("course-1")).rejects.toThrow(
      "Invalid persisted duty settings",
    )
  })
})
