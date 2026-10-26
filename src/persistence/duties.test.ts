import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
import { dutySettingItems, type DutySettingItem } from "@/persistence/dutyItems"

const NOW = "2026-09-19T16:40:12.750Z"

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

/**
 * The reads share one `getAll` mock: tell the course's students, its stored
 * duty-setting rows and its duty rows apart by the table the query names.
 */
function givenStoredRows({
  students = ["student-1", "student-2", "student-3"],
  duties = [],
  items = [],
}: {
  students?: string[]
  duties?: Array<{ id?: string; dayId: string; studentId: string }>
  items?: DutySettingItem[]
} = {}) {
  database.getAll.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM students")) return students.map((id) => ({ id }))
    if (sql.includes("FROM dutySettingItems")) return items
    return duties
  })
}

/** The rows of the one batch whose SQL starts this way. */
function batchOf(start: string) {
  return database.executeBatch.mock.calls.find(([sql]) =>
    String(sql).trimStart().startsWith(start),
  )?.[1] as unknown[][] | undefined
}

describe("duty persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(NOW))
    database.init.mockResolvedValue(undefined)
    givenStoredRows()
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

  afterEach(() => {
    vi.useRealTimers()
  })

  it("reads and parses the course plan", async () => {
    givenStoredRows({
      duties: [{ dayId: "saturday", studentId: "student-1" }],
      items: dutySettingItems("course-1", {
        fewerDayIds: ["saturday"],
        stayOverStudentIds: ["student-1"],
        completedDayIds: ["saturday"],
        acknowledgedWarningKeys: ["warning-1"],
      }),
    })
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
      resolvedConflicts: 0,
      settings: expect.objectContaining({
        completedDayIds: ["saturday"],
        balanceMinors: true,
        balanceSex: false,
      }),
    })
  })

  it("drops a stay-over student the course no longer has and counts it", async () => {
    givenStoredRows({ students: ["student-1", "student-2"] })
    database.getOptional.mockResolvedValue({
      desiredPerDay: 3,
      fewerDayIds: "[]",
      balanceMinors: 1,
      balanceSex: 0,
      tieBreaker: "alphabetical",
      stayOverStudentIds: '["student-3","student-1"]',
      completedDayIds: "[]",
      acknowledgedWarningKeys: "[]",
    })

    await expect(readDutyPlan("course-1")).resolves.toMatchObject({
      resolvedConflicts: 1,
      settings: { stayOverStudentIds: ["student-1"] },
    })
  })

  it("reloads explicit extra days and accepts a base count of zero", async () => {
    givenStoredRows({
      items: dutySettingItems("course-1", {
        extraDayIds: ["sunday", "wednesday", "friday"],
      }),
    })
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
      resolvedConflicts: 0,
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
      expect.stringMatching(
        /INSERT INTO dutyAssignments\([^)]*createdAt, updatedAt\s*\)/,
      ),
      [[expect.any(String), "course-1", "saturday", "student-1", NOW, NOW]],
    )
    expect(database.execute).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(
        /INSERT OR REPLACE INTO dutySettings\([^)]*createdAt, updatedAt\s*\)/,
      ),
      [
        "course-1",
        "course-1",
        3,
        '["saturday"]',
        "[]",
        1,
        0,
        "alphabetical",
        '["student-1"]',
        '["saturday"]',
        '["minor-balance:2,0"]',
        // createdAt keeps the stored row's, else the stamp; updatedAt moves on,
        // never below the stored updatedAt or createdAt.
        "course-1",
        NOW,
        NOW,
        "course-1",
        "course-1",
      ],
    )
  })

  // REPLACE swaps the whole row, so the statement reads the row's own createdAt
  // and latest updatedAt back in. The statement the app sends is run here on a
  // real SQLite, saving three times with the clock going forward, then back.
  it("keeps a settings row's createdAt and never moves its updatedAt backwards", async () => {
    const { DatabaseSync } = await import("node:sqlite")
    const sqlite = new DatabaseSync(":memory:")
    sqlite.exec(
      `CREATE TABLE dutySettings (
         id TEXT PRIMARY KEY, courseId TEXT, desiredPerDay INTEGER,
         fewerDayIds TEXT, extraDayIds TEXT, balanceMinors INTEGER,
         balanceSex INTEGER, tieBreaker TEXT, stayOverStudentIds TEXT,
         completedDayIds TEXT, acknowledgedWarningKeys TEXT,
         createdAt TEXT, updatedAt TEXT)`,
    )
    const saveAt = async (clock: string) => {
      vi.setSystemTime(new Date(clock))
      database.execute.mockClear()
      await saveDutyPlan("course-1", [], SETTINGS)
      const [sql, params] = database.execute.mock.calls[0] as [
        string,
        Array<string | number>,
      ]
      sqlite.prepare(sql).run(...params)
      return sqlite
        .prepare("SELECT createdAt, updatedAt FROM dutySettings")
        .all()
    }

    try {
      await expect(saveAt("2026-09-19T10:00:00.000Z")).resolves.toEqual([
        {
          createdAt: "2026-09-19T10:00:00.000Z",
          updatedAt: "2026-09-19T10:00:00.000Z",
        },
      ])
      await expect(saveAt("2026-09-19T11:00:00.000Z")).resolves.toEqual([
        {
          createdAt: "2026-09-19T10:00:00.000Z",
          updatedAt: "2026-09-19T11:00:00.000Z",
        },
      ])
      await expect(saveAt("2026-09-19T09:00:00.000Z")).resolves.toEqual([
        {
          createdAt: "2026-09-19T10:00:00.000Z",
          updatedAt: "2026-09-19T11:00:00.000Z",
        },
      ])
      // A row an older version left with updatedAt before createdAt is lifted
      // to its creation time, even by a save made with the clock behind both.
      sqlite.exec(
        `UPDATE dutySettings SET createdAt = '2026-09-19T10:00:00.000Z',
           updatedAt = '2026-09-19T08:00:00.000Z'`,
      )
      await expect(saveAt("2026-09-19T07:00:00.000Z")).resolves.toEqual([
        {
          createdAt: "2026-09-19T10:00:00.000Z",
          updatedAt: "2026-09-19T10:00:00.000Z",
        },
      ])
    } finally {
      sqlite.close()
    }
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
    givenStoredRows({
      duties: [
        { dayId: "saturday", studentId: "student-1" },
        { dayId: "sunday", studentId: "student-2" },
      ],
    })

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
    givenStoredRows({
      duties: [
        { id: "completed-saturday", dayId: "saturday", studentId: "student-1" },
        { id: "future-sunday", dayId: "sunday", studentId: "student-2" },
      ],
    })

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
    givenStoredRows({
      duties: [
        { id: "retained", dayId: "saturday", studentId: "student-1" },
        { id: "removed", dayId: "sunday", studentId: "student-2" },
      ],
    })

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
      givenStoredRows({ duties: rows })
      await expect(saveDutyPlan("course-1", [], SETTINGS)).rejects.toThrow(
        "Duplicate persisted duty assignment",
      )
      expect(database.executeBatch).not.toHaveBeenCalled()
      expect(database.execute).not.toHaveBeenCalled()
    },
  )

  // UG2-DAT-3: a second window that still lists a deleted student used to be
  // able to store a duty for them, which then made Equipaggi and Comandate
  // refuse to open. Crew and evaluation saves already refused this.
  it("refuses a duty for a student the course does not have, before writing", async () => {
    await expect(
      saveDutyPlan(
        "course-1",
        [
          { dayId: "saturday", studentId: "student-1" },
          { dayId: "wednesday", studentId: "student-that-was-deleted" },
        ],
        { ...SETTINGS, completedDayIds: [] },
      ),
    ).rejects.toThrow("Duty student does not belong to course")
    expect(database.executeBatch).not.toHaveBeenCalled()
    expect(database.execute).not.toHaveBeenCalled()
  })

  it("refuses a stay-over preference for a student the course does not have", async () => {
    await expect(
      saveDutyPlan("course-1", [], {
        ...SETTINGS,
        completedDayIds: [],
        stayOverStudentIds: ["student-1", "student-that-was-deleted"],
      }),
    ).rejects.toThrow("Duty student does not belong to course")
    expect(database.execute).not.toHaveBeenCalled()
  })

  it("lets a save that no longer shows a stored duty for a missing student remove it, even on a completed day", async () => {
    database.getOptional.mockResolvedValue({
      completedDayIds: '["saturday"]',
    })
    givenStoredRows({
      duties: [
        { id: "kept", dayId: "saturday", studentId: "student-1" },
        { id: "dangling", dayId: "saturday", studentId: "student-gone" },
      ],
    })

    await expect(
      saveDutyPlan(
        "course-1",
        [{ dayId: "saturday", studentId: "student-1" }],
        SETTINGS,
      ),
    ).resolves.toBeUndefined()
    expect(database.executeBatch).toHaveBeenCalledWith(
      "DELETE FROM dutyAssignments WHERE id = ? AND courseId = ?",
      [["dangling", "course-1"]],
    )
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

  it("settles a duty stored twice on the latest row and reports it", async () => {
    database.getAll.mockResolvedValue([
      {
        id: "old",
        dayId: "saturday",
        studentId: "student-1",
        updatedAt: "2026-09-20T09:00:00.000Z",
      },
      {
        id: "new",
        dayId: "saturday",
        studentId: "student-1",
        updatedAt: "2026-09-20T10:00:00.000Z",
      },
    ])
    await expect(readDutyPlan("course-1")).resolves.toMatchObject({
      assignments: [{ dayId: "saturday", studentId: "student-1" }],
      resolvedConflicts: 1,
    })
  })

  it("rejects invalid persisted assignment rows", async () => {
    database.getAll.mockResolvedValue([
      { dayId: "not-a-day", studentId: "student-1" },
    ])
    await expect(readDutyPlan("course-1")).rejects.toThrow(
      "Invalid persisted duty assignment",
    )
  })

  describe("the lists, item by item (D2)", () => {
    const STORED = {
      desiredPerDay: 1,
      fewerDayIds: '["saturday"]',
      extraDayIds: '["monday","sunday"]',
      balanceMinors: 1,
      balanceSex: 0,
      tieBreaker: "alphabetical",
      stayOverStudentIds: '["student-1"]',
      completedDayIds: "[]",
      acknowledgedWarningKeys: "[]",
    }

    // The lists stay the copy the app reads while 0.3.0 can write them (03 §3):
    // rows an older tab has not caught up with change nothing.
    it("reads the stored lists, not the rows beside them", async () => {
      database.getOptional.mockResolvedValue(STORED)
      givenStoredRows({
        items: dutySettingItems("course-1", {
          fewerDayIds: ["sunday"],
          stayOverStudentIds: ["student-2"],
        }),
      })

      const { settings } = await readDutyPlan("course-1")

      expect(settings).toMatchObject({
        fewerDayIds: ["saturday"],
        extraDayIds: ["monday", "sunday"],
        stayOverStudentIds: ["student-1"],
        completedDayIds: [],
        acknowledgedWarningKeys: [],
      })
      expect(database.getAll).not.toHaveBeenCalledWith(
        expect.stringContaining("dutySettingItems"),
        expect.anything(),
      )
    })

    it("keeps extra days unchosen while the stored list is null", async () => {
      database.getOptional.mockResolvedValue({ ...STORED, extraDayIds: null })
      givenStoredRows({
        items: dutySettingItems("course-1", { fewerDayIds: ["saturday"] }),
      })

      const { settings } = await readDutyPlan("course-1")

      expect(settings).not.toHaveProperty("extraDayIds")
    })

    it.each([
      ["a corrupt stored list", { stayOverStudentIds: "{" }, []],
      [
        "a duplicate in a stored day list",
        { fewerDayIds: JSON.stringify(["saturday", "saturday"]) },
        [],
      ],
      [
        "an unknown day in a stored list",
        { completedDayIds: JSON.stringify(["funday"]) },
        [],
      ],
    ])("refuses %s, as before D2", async (_case, stored, items) => {
      database.getOptional.mockResolvedValue({ ...STORED, ...stored })
      givenStoredRows({ items })

      // Unparseable JSON fails with the parser's own error, as it always did;
      // either way the screen shows that the plan cannot be read.
      await expect(readDutyPlan("course-1")).rejects.toThrow()
    })

    it("writes only the items that changed, and nothing for a second identical save", async () => {
      givenStoredRows({
        items: dutySettingItems("course-1", {
          fewerDayIds: ["saturday"],
          stayOverStudentIds: ["student-1", "student-2"],
          acknowledgedWarningKeys: ["minor-balance:2,0"],
        }),
      })
      const settings: DutySettingsRecord = {
        ...SETTINGS,
        completedDayIds: [],
        fewerDayIds: ["saturday"],
        extraDayIds: ["monday"],
        stayOverStudentIds: ["student-2", "student-3"],
        acknowledgedWarningKeys: ["minor-balance:2,0"],
      }
      const id = (kind: string, value: string) =>
        JSON.stringify(["course-1", kind, value])

      await saveDutyPlan("course-1", [], settings)

      expect(batchOf("DELETE FROM dutySettingItems")).toEqual([
        [id("stay-over", "student-1")],
      ])
      expect(batchOf("UPDATE dutySettingItems")).toEqual([
        [0, NOW, id("stay-over", "student-2")],
      ])
      expect(
        batchOf("INSERT INTO dutySettingItems")?.map((row) => row.slice(2, 5)),
      ).toEqual([
        ["extra-day", "monday", 0],
        ["stay-over", "student-3", 1],
      ])

      database.executeBatch.mockClear()
      givenStoredRows({ items: dutySettingItems("course-1", settings) })
      await saveDutyPlan("course-1", [], settings)
      expect(
        database.executeBatch.mock.calls.filter(([sql]) =>
          String(sql).includes("dutySettingItems"),
        ),
      ).toEqual([])
    })

    // D2 review DI-R2-1: a stored row with this course's id but another
    // course's column is read by its id and replaced, not inserted twice.
    it("replaces a wanted row filed under another course", async () => {
      const [monday] = dutySettingItems("course-1", { extraDayIds: ["monday"] })
      givenStoredRows({ items: [{ ...monday!, courseId: "course-2" }] })

      await saveDutyPlan("course-1", [], {
        ...SETTINGS,
        completedDayIds: [],
        fewerDayIds: [],
        stayOverStudentIds: [],
        acknowledgedWarningKeys: [],
        extraDayIds: ["monday"],
      })

      expect(batchOf("DELETE FROM dutySettingItems")).toEqual([[monday!.id]])
      expect(
        batchOf("INSERT INTO dutySettingItems")?.map((row) => row.slice(0, 3)),
      ).toEqual([[monday!.id, "course-1", "extra-day"]])
      expect(database.getAll).toHaveBeenCalledWith(
        expect.stringContaining("WHERE courseId = ? OR id IN (?)"),
        ["course-1", monday!.id],
      )
    })

    it("saves a course whose extra days were never chosen with none", async () => {
      const settings: DutySettingsRecord = { ...SETTINGS, completedDayIds: [] }
      expect(settings).not.toHaveProperty("extraDayIds")

      await saveDutyPlan("course-1", [], settings)

      expect(
        batchOf("INSERT INTO dutySettingItems")?.map((row) => row[2]),
      ).not.toContain("extra-day")
    })

    it("keeps a completed day that only the stored list holds", async () => {
      // An older app marked Saturday completed after the rows were rebuilt.
      database.getOptional.mockResolvedValue({
        completedDayIds: JSON.stringify(["saturday"]),
      })
      givenStoredRows({ items: [] })

      await expect(
        saveDutyPlan("course-1", [], { ...SETTINGS, completedDayIds: [] }),
      ).rejects.toThrow("Completed duty history is immutable")
    })
  })
})
