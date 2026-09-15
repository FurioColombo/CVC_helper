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
          getAll: typeof database.getAll
          getOptional: typeof database.getOptional
        }) => Promise<unknown>,
      ) =>
        callback({
          execute: database.execute,
          executeBatch: database.executeBatch,
          getAll: database.getAll,
          getOptional: database.getOptional,
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

  it("reloads explicit extra days and accepts a base count of zero", async () => {
    database.getOptional.mockResolvedValue({
      desiredPerDay: 0,
      fewerDayIds: "[]",
      extraDayIds: '["sunday","wednesday","friday"]',
      balanceMinors: 1,
      balanceSex: 0,
      tieBreaker: "alphabetical",
      stayOverStudentIds: "[]",
      completedDayIds: "[]",
      acknowledgedWarningKeys: "[]",
    })

    await expect(readDutyPlan("course-1")).resolves.toEqual({
      assignments: [],
      settings: expect.objectContaining({
        desiredPerDay: 0,
        extraDayIds: ["sunday", "wednesday", "friday"],
      }),
    })
  })

  it("inserts new assignments and settings atomically without replacing other rows", async () => {
    await saveDutyPlan(
      "course-1",
      [{ dayId: "saturday", studentId: "student-1" }],
      SETTINGS,
    )

    expect(database.writeTransaction).toHaveBeenCalledOnce()
    expect(database.executeBatch).not.toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM dutyAssignments"),
      expect.anything(),
    )
    expect(database.executeBatch).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO dutyAssignments"),
      [expect.arrayContaining(["course-1", "saturday", "student-1"])],
    )
    expect(database.execute).toHaveBeenNthCalledWith(
      1,
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

  it("persists base zero for N below D", async () => {
    await saveDutyPlan("course-1", [], {
      ...SETTINGS,
      desiredPerDay: 0,
      extraDayIds: ["sunday"],
    })

    expect(database.execute).toHaveBeenLastCalledWith(
      expect.stringContaining("extraDayIds"),
      expect.arrayContaining([0, '["sunday"]']),
    )
  })

  it.each([
    {
      label: "removes a completed day marker",
      assignments: [{ dayId: "saturday" as const, studentId: "student-1" }],
      completedDayIds: [] as const,
    },
    {
      label: "removes a completed assignment",
      assignments: [] as const,
      completedDayIds: ["saturday"] as const,
    },
    {
      label: "adds a completed assignment",
      assignments: [
        { dayId: "saturday" as const, studentId: "student-1" },
        { dayId: "saturday" as const, studentId: "student-2" },
      ],
      completedDayIds: ["saturday"] as const,
    },
  ])("rejects a save that $label", async ({ assignments, completedDayIds }) => {
    database.getOptional.mockResolvedValue({
      completedDayIds: '["saturday"]',
    })
    database.getAll.mockResolvedValue([
      { dayId: "saturday", studentId: "student-1" },
      { dayId: "sunday", studentId: "student-2" },
    ])

    await expect(
      saveDutyPlan("course-1", [...assignments], {
        ...SETTINGS,
        completedDayIds: [...completedDayIds],
      }),
    ).rejects.toThrow("Completed duty history is immutable")
    expect(database.execute).not.toHaveBeenCalled()
  })

  it("allows unrestricted future overrides while preserving completed rows", async () => {
    database.getOptional.mockResolvedValue({
      completedDayIds: '["saturday"]',
    })
    database.getAll.mockResolvedValue([
      { id: "completed-saturday", dayId: "saturday", studentId: "student-1" },
      { id: "future-sunday", dayId: "sunday", studentId: "student-2" },
    ])

    await expect(
      saveDutyPlan(
        "course-1",
        [
          { dayId: "saturday", studentId: "student-1" },
          { dayId: "friday", studentId: "student-1" },
          { dayId: "friday", studentId: "student-3" },
        ],
        SETTINGS,
      ),
    ).resolves.toBeUndefined()
    expect(database.executeBatch).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO dutyAssignments"),
      expect.arrayContaining([expect.arrayContaining(["friday", "student-3"])]),
    )
    expect(database.executeBatch).toHaveBeenCalledWith(
      "DELETE FROM dutyAssignments WHERE id = ? AND courseId = ?",
      [["future-sunday", "course-1"]],
    )
  })

  it("retains unchanged assignment IDs while adding and removing other duties", async () => {
    database.getAll.mockResolvedValue([
      { id: "retained", dayId: "saturday", studentId: "student-1" },
      { id: "removed", dayId: "sunday", studentId: "student-2" },
    ])

    await saveDutyPlan(
      "course-1",
      [
        { dayId: "saturday", studentId: "student-1" },
        { dayId: "monday", studentId: "student-3" },
      ],
      SETTINGS,
    )

    expect(database.executeBatch).toHaveBeenCalledWith(
      "DELETE FROM dutyAssignments WHERE id = ? AND courseId = ?",
      [["removed", "course-1"]],
    )
    expect(database.executeBatch).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO dutyAssignments"),
      [expect.arrayContaining(["course-1", "monday", "student-3"])],
    )
    expect(JSON.stringify(database.executeBatch.mock.calls)).not.toContain(
      '"retained"',
    )
  })

  it.each([
    ["blank ID", [{ id: " ", dayId: "saturday", studentId: "student-1" }]],
    [
      "duplicate ID",
      [
        { id: "same", dayId: "saturday", studentId: "student-1" },
        { id: "same", dayId: "sunday", studentId: "student-2" },
      ],
    ],
  ])(
    "rejects persisted duty rows with a %s before mutation",
    async (_case, rows) => {
      database.getAll.mockResolvedValue(rows)
      await expect(saveDutyPlan("course-1", [], SETTINGS)).rejects.toThrow(
        "Duplicate persisted duty assignment",
      )
      expect(database.executeBatch).not.toHaveBeenCalled()
      expect(database.execute).not.toHaveBeenCalled()
    },
  )

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

  it("rejects invalid or duplicate persisted assignment rows", async () => {
    database.getAll.mockResolvedValue([
      { dayId: "saturday", studentId: "student-1" },
      { dayId: "saturday", studentId: "student-1" },
    ])
    await expect(readDutyPlan("course-1")).rejects.toThrow(
      "Invalid persisted duty assignment",
    )

    database.getAll.mockResolvedValue([
      { dayId: "not-a-day", studentId: "student-1" },
    ])
    await expect(readDutyPlan("course-1")).rejects.toThrow(
      "Invalid persisted duty assignment",
    )
  })
})
