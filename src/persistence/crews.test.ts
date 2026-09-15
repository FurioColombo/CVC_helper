import { beforeEach, describe, expect, it, vi } from "vitest"

const database = vi.hoisted(() => ({
  execute: vi.fn(),
  executeBatch: vi.fn(),
  getAll: vi.fn(),
  getOptional: vi.fn(),
  init: vi.fn(),
  transactionGetAll: vi.fn(),
  writeTransaction: vi.fn(),
}))

vi.mock("@/persistence/db", () => ({ db: database }))

import {
  readCrewHistory,
  readCrewPlan,
  saveCrewPlan,
} from "@/persistence/crews"

function existingCourseEntities(sql: string) {
  if (sql.includes("FROM students")) {
    return ["student-1", "student-2", "student-3"].map((id) => ({ id }))
  }
  if (sql.includes("FROM volunteers")) {
    return ["volunteer-1", "volunteer-ct"].map((id) => ({ id }))
  }
  if (sql.includes("FROM boats")) {
    return ["boat-1", "boat-2", "boat-10"].map((id) => ({ id }))
  }
  return []
}

describe("crew persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    database.init.mockResolvedValue(undefined)
    database.getAll.mockResolvedValue([])
    database.getOptional.mockResolvedValue({ family: "Deriva", level: 2 })
    database.transactionGetAll.mockImplementation(existingCourseEntities)
    database.writeTransaction.mockImplementation(
      async (
        callback: (transaction: {
          execute: typeof database.execute
          executeBatch: typeof database.executeBatch
          getAll: typeof database.transactionGetAll
        }) => Promise<unknown>,
      ) =>
        callback({
          execute: database.execute,
          executeBatch: database.executeBatch,
          getAll: database.transactionGetAll,
        }),
    )
  })

  it("reads legacy null positions without dropping crews or A terra", async () => {
    database.getAll
      .mockResolvedValueOnce([
        {
          id: "crew-1",
          sessionId: "sat-pm",
          destination: "unassigned",
          boatId: null,
          position: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          crewId: "crew-1",
          personId: "student-1",
          personType: "student",
          position: null,
        },
        {
          crewId: "crew-1",
          personId: "volunteer-1",
          personType: "volunteer",
          position: null,
        },
      ])
      .mockResolvedValueOnce([
        { id: "land-1", sessionId: "sat-pm", studentId: "student-2" },
      ])
      .mockResolvedValueOnce([])

    await expect(readCrewPlan("course-1", "sat-pm")).resolves.toEqual(
      expect.objectContaining({
        crews: [
          expect.objectContaining({
            members: [
              { personId: "student-1", personType: "student" },
              { personId: "volunteer-1", personType: "volunteer" },
            ],
          }),
        ],
        landStudentIds: ["student-2"],
      }),
    )
  })

  it("inserts one session atomically including empty crews", async () => {
    await saveCrewPlan("course-1", "sat-pm", {
      crews: [
        {
          id: "crew-1",
          sessionId: "sat-pm",
          members: [{ personId: "student-1", personType: "student" }],
          destination: "unassigned",
          boatId: null,
        },
        {
          id: "crew-2",
          sessionId: "sat-pm",
          members: [],
          destination: "unassigned",
          boatId: null,
        },
      ],
      landStudentIds: ["student-2"],
      selectedBoatIds: [],
    })

    expect(database.writeTransaction).toHaveBeenCalledOnce()
    expect(database.executeBatch).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO crews"),
      expect.arrayContaining([
        expect.arrayContaining(["crew-1", "course-1", "sat-pm", 0]),
        expect.arrayContaining(["crew-2", "course-1", "sat-pm", 1]),
      ]),
    )
    expect(database.executeBatch).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO landAssignments"),
      [expect.arrayContaining(["course-1", "sat-pm", "student-2"])],
    )
    expect(
      database.executeBatch.mock.calls.some(([sql]) =>
        String(sql).includes("DELETE FROM"),
      ),
    ).toBe(false)
  })

  it("allows flexible D1 and cabin crews but rejects more than two people for D2-D5", async () => {
    const threeMembers = ["student-1", "student-2", "student-3"].map(
      (personId) => ({ personId, personType: "student" as const }),
    )
    const plan = {
      crews: [
        {
          id: "crew-1",
          sessionId: "sat-pm" as const,
          members: threeMembers,
          destination: "mezzi" as const,
          boatId: null,
        },
      ],
      landStudentIds: [],
      selectedBoatIds: [],
    }

    await expect(saveCrewPlan("course-1", "sat-pm", plan)).rejects.toThrow(
      "over capacity",
    )
    database.getOptional.mockResolvedValueOnce({
      family: "Deriva",
      level: 1,
    })
    await expect(saveCrewPlan("course-1", "sat-pm", plan)).resolves.toBe(
      undefined,
    )
    database.getOptional.mockResolvedValueOnce({
      family: "Cabinato",
      level: 3,
    })
    await expect(saveCrewPlan("course-1", "sat-pm", plan)).resolves.toBe(
      undefined,
    )
  })

  it("refuses duplicate simultaneous assignment before writing", async () => {
    await expect(
      saveCrewPlan("course-1", "sat-pm", {
        crews: [
          {
            id: "crew-1",
            sessionId: "sat-pm",
            members: [{ personId: "student-1", personType: "student" }],
            destination: "unassigned",
            boatId: null,
          },
        ],
        landStudentIds: ["student-1"],
        selectedBoatIds: [],
      }),
    ).rejects.toThrow("Duplicate session student")
    expect(database.writeTransaction).not.toHaveBeenCalled()
  })

  it.each([
    [
      "invalid person type",
      {
        crews: [
          {
            id: "crew-1",
            sessionId: "sat-pm",
            members: [{ personId: "person-1", personType: "land" }],
            destination: "unassigned",
            boatId: null,
          },
        ],
        landStudentIds: [],
        selectedBoatIds: [],
      },
    ],
    [
      "A terra as a destination",
      {
        crews: [
          {
            id: "crew-1",
            sessionId: "sat-pm",
            members: [],
            destination: "land",
            boatId: null,
          },
        ],
        landStudentIds: [],
        selectedBoatIds: [],
      },
    ],
  ])("rejects %s before any session mutation", async (_label, malformed) => {
    await expect(
      saveCrewPlan("course-1", "sat-pm", malformed as never),
    ).rejects.toThrow()
    expect(database.writeTransaction).not.toHaveBeenCalled()
  })

  it("refuses duplicate or gapped persisted positions", async () => {
    database.getAll
      .mockResolvedValueOnce([
        {
          id: "crew-1",
          sessionId: "sat-pm",
          destination: "unassigned",
          boatId: null,
          position: 1,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await expect(readCrewPlan("course-1", "sat-pm")).rejects.toThrow(
      "Invalid persisted crew plan",
    )
  })

  it("reads a selected boat and its exact crew destination", async () => {
    database.getAll
      .mockResolvedValueOnce([
        {
          id: "crew-1",
          sessionId: "sat-pm",
          destination: "boat",
          boatId: "boat-2",
          position: 0,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "session-boat-1",
          sessionId: "sat-pm",
          boatId: "boat-2",
          position: 0,
        },
      ])

    await expect(readCrewPlan("course-1", "sat-pm")).resolves.toEqual(
      expect.objectContaining({
        selectedBoatIds: ["boat-2"],
        crews: [
          expect.objectContaining({ destination: "boat", boatId: "boat-2" }),
        ],
      }),
    )
  })

  it("persists the outgoing boat set and exact destinations atomically", async () => {
    database.getAll.mockResolvedValueOnce([{ id: "boat-2" }])

    await saveCrewPlan("course-1", "sat-pm", {
      crews: [
        {
          id: "crew-1",
          sessionId: "sat-pm",
          members: [],
          destination: "boat",
          boatId: "boat-2",
        },
        {
          id: "crew-2",
          sessionId: "sat-pm",
          members: [],
          destination: "mezzi",
          boatId: null,
        },
      ],
      landStudentIds: [],
      selectedBoatIds: ["boat-2"],
    })

    expect(database.executeBatch).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO crews"),
      expect.arrayContaining([
        expect.arrayContaining(["crew-1", "boat", "boat-2"]),
        expect.arrayContaining(["crew-2", "mezzi", null]),
      ]),
    )
    expect(database.executeBatch).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO sessionBoats"),
      [expect.arrayContaining(["course-1", "sat-pm", "boat-2", 0])],
    )
  })

  it("reloads the exact session plan", async () => {
    database.getAll.mockResolvedValueOnce([{ id: "boat-10" }])
    const savedPlan = {
      crews: [
        {
          id: "crew-sun-am-1",
          sessionId: "sun-am" as const,
          members: [
            { personId: "student-1", personType: "student" as const },
            { personId: "volunteer-ct", personType: "volunteer" as const },
          ],
          destination: "boat" as const,
          boatId: "boat-10",
        },
      ],
      landStudentIds: ["student-2"],
      selectedBoatIds: ["boat-10"],
    }

    await saveCrewPlan("course-1", "sun-am", savedPlan)
    database.getAll.mockReset()
    database.getAll
      .mockResolvedValueOnce([
        {
          id: "crew-sun-am-1",
          sessionId: "sun-am",
          destination: "boat",
          boatId: "boat-10",
          position: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          crewId: "crew-sun-am-1",
          personId: "student-1",
          personType: "student",
          position: 0,
        },
        {
          crewId: "crew-sun-am-1",
          personId: "volunteer-ct",
          personType: "volunteer",
          position: 1,
        },
      ])
      .mockResolvedValueOnce([
        { id: "land-sun-am-1", sessionId: "sun-am", studentId: "student-2" },
      ])
      .mockResolvedValueOnce([
        {
          id: "session-boat-sun-am-1",
          sessionId: "sun-am",
          boatId: "boat-10",
          position: 0,
        },
      ])

    await expect(readCrewPlan("course-1", "sun-am")).resolves.toEqual(
      expect.objectContaining({
        crews: savedPlan.crews,
        landStudentIds: ["student-2"],
        selectedBoatIds: ["boat-10"],
      }),
    )
  })

  it("keeps every unchanged crew, member, boat and land row ID", async () => {
    database.transactionGetAll.mockImplementation((sql: string) => {
      if (sql.includes("FROM crewMembers cm"))
        return [
          {
            id: "member-1",
            crewId: "crew-1",
            personId: "student-1",
            personType: "student",
            position: 0,
          },
        ]
      if (sql.includes("FROM crews WHERE"))
        return [
          {
            id: "crew-1",
            sessionId: "sat-pm",
            destination: "boat",
            boatId: "boat-1",
            position: 0,
          },
        ]
      if (sql.includes("FROM landAssignments"))
        return [{ id: "land-1", sessionId: "sat-pm", studentId: "student-2" }]
      if (sql.includes("FROM sessionBoats"))
        return [
          {
            id: "selection-1",
            sessionId: "sat-pm",
            boatId: "boat-1",
            position: 0,
          },
        ]
      return existingCourseEntities(sql)
    })

    await saveCrewPlan("course-1", "sat-pm", {
      crews: [
        {
          id: "crew-1",
          sessionId: "sat-pm",
          members: [{ personId: "student-1", personType: "student" }],
          destination: "boat",
          boatId: "boat-1",
        },
      ],
      landStudentIds: ["student-2"],
      selectedBoatIds: ["boat-1"],
    })

    expect(database.executeBatch).not.toHaveBeenCalled()
    expect(database.execute).not.toHaveBeenCalled()
  })

  it("deletes removed rows and reorders retained rows within one session", async () => {
    database.transactionGetAll.mockImplementation((sql: string) => {
      if (sql.includes("FROM crewMembers cm"))
        return [
          {
            id: "member-1",
            crewId: "crew-1",
            personId: "student-1",
            personType: "student",
            position: 1,
          },
          {
            id: "member-old",
            crewId: "crew-old",
            personId: "student-2",
            personType: "student",
            position: 0,
          },
        ]
      if (sql.includes("FROM crews WHERE"))
        return [
          {
            id: "crew-1",
            sessionId: "sat-pm",
            destination: "unassigned",
            boatId: null,
            position: 1,
          },
          {
            id: "crew-old",
            sessionId: "sat-pm",
            destination: "unassigned",
            boatId: null,
            position: 0,
          },
        ]
      if (sql.includes("FROM landAssignments"))
        return [{ id: "land-old", sessionId: "sat-pm", studentId: "student-3" }]
      if (sql.includes("FROM sessionBoats"))
        return [
          {
            id: "selection-old",
            sessionId: "sat-pm",
            boatId: "boat-1",
            position: 0,
          },
          {
            id: "selection-2",
            sessionId: "sat-pm",
            boatId: "boat-2",
            position: 1,
          },
        ]
      return existingCourseEntities(sql)
    })

    await saveCrewPlan("course-1", "sat-pm", {
      crews: [
        {
          id: "crew-1",
          sessionId: "sat-pm",
          members: [{ personId: "student-1", personType: "student" }],
          destination: "boat",
          boatId: "boat-2",
        },
      ],
      landStudentIds: [],
      selectedBoatIds: ["boat-2"],
    })

    expect(database.executeBatch).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM crewMembers"),
      [["member-old", "course-1", "sat-pm"]],
    )
    expect(database.executeBatch).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM crews"),
      [["crew-old", "course-1", "sat-pm"]],
    )
    expect(database.executeBatch).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM landAssignments"),
      [["land-old", "course-1", "sat-pm"]],
    )
    expect(database.executeBatch).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM sessionBoats"),
      [["selection-old", "course-1", "sat-pm"]],
    )
    expect(database.executeBatch).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE crews"),
      [["boat", "boat-2", 0, "crew-1", "course-1", "sat-pm"]],
    )
    expect(database.executeBatch).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE sessionBoats"),
      [[0, "selection-2", "course-1", "sat-pm"]],
    )
    expect(database.executeBatch).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE crewMembers"),
      [[0, "member-1", "course-1", "sat-pm"]],
    )
    for (const [sql, rows] of database.executeBatch.mock.calls) {
      expect(sql).toContain("sessionId = ?")
      for (const params of rows) {
        expect(params).toEqual(expect.arrayContaining(["course-1", "sat-pm"]))
      }
    }
  })

  it.each([
    [
      "blank ID",
      [
        {
          id: " ",
          sessionId: "sat-pm",
          destination: "unassigned",
          boatId: null,
          position: 0,
        },
      ],
    ],
    [
      "duplicate ID",
      [
        {
          id: "same",
          sessionId: "sat-pm",
          destination: "unassigned",
          boatId: null,
          position: 0,
        },
        {
          id: "same",
          sessionId: "sat-pm",
          destination: "unassigned",
          boatId: null,
          position: 1,
        },
      ],
    ],
  ])(
    "rejects persisted crews with a %s before mutation",
    async (_case, rows) => {
      database.transactionGetAll.mockImplementation((sql: string) =>
        sql.includes("FROM crews WHERE") ? rows : existingCourseEntities(sql),
      )
      await expect(
        saveCrewPlan("course-1", "sat-pm", {
          crews: [],
          landStudentIds: [],
          selectedBoatIds: [],
        }),
      ).rejects.toThrow("Duplicate persisted crew record")
      expect(database.executeBatch).not.toHaveBeenCalled()
    },
  )

  it("rejects duplicate boat assignment and boats outside the course", async () => {
    const duplicatePlan = {
      crews: ["crew-1", "crew-2"].map((id) => ({
        id,
        sessionId: "sat-pm" as const,
        members: [],
        destination: "boat" as const,
        boatId: "boat-2",
      })),
      landStudentIds: [],
      selectedBoatIds: ["boat-2"],
    }
    await expect(
      saveCrewPlan("course-1", "sat-pm", duplicatePlan),
    ).rejects.toThrow("assigned twice")

    database.transactionGetAll.mockImplementation((sql: string) =>
      sql.includes("FROM boats") ? [] : existingCourseEntities(sql),
    )
    await expect(
      saveCrewPlan("course-1", "sat-pm", {
        ...duplicatePlan,
        crews: [duplicatePlan.crews[0]!],
      }),
    ).rejects.toThrow("does not belong to course")
  })

  it("refuses stale or foreign people inside the save transaction before deleting a session", async () => {
    const plan = {
      crews: [
        {
          id: "crew-1",
          sessionId: "sat-pm" as const,
          members: [
            { personId: "student-1", personType: "student" as const },
            { personId: "volunteer-ct", personType: "volunteer" as const },
          ],
          destination: "unassigned" as const,
          boatId: null,
        },
      ],
      landStudentIds: ["student-2"],
      selectedBoatIds: [],
    }
    database.transactionGetAll.mockImplementation((sql: string) =>
      sql.includes("FROM students")
        ? [{ id: "student-1" }]
        : existingCourseEntities(sql),
    )
    await expect(saveCrewPlan("course-1", "sat-pm", plan)).rejects.toThrow(
      "Crew student does not belong to course",
    )
    expect(database.execute).not.toHaveBeenCalled()

    database.transactionGetAll.mockImplementation((sql: string) =>
      sql.includes("FROM volunteers") ? [] : existingCourseEntities(sql),
    )
    await expect(saveCrewPlan("course-1", "sat-pm", plan)).rejects.toThrow(
      "Crew volunteer does not belong to course",
    )
    expect(database.execute).not.toHaveBeenCalled()
  })

  it("reads only real crews into student pair history, including Mezzi", async () => {
    database.getAll
      .mockResolvedValueOnce([
        {
          id: "crew-1",
          sessionId: "sat-pm",
          destination: "mezzi",
          boatId: null,
          position: 0,
        },
        {
          id: "crew-2",
          sessionId: "sun-am",
          destination: "unassigned",
          boatId: null,
          position: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          crewId: "crew-1",
          personId: "student-1",
          personType: "student",
          position: 0,
        },
        {
          crewId: "crew-1",
          personId: "volunteer-1",
          personType: "volunteer",
          position: 1,
        },
      ])

    await expect(readCrewHistory("course-1")).resolves.toEqual([
      {
        crewId: "crew-1",
        sessionId: "sat-pm",
        studentIds: ["student-1"],
      },
      { crewId: "crew-2", sessionId: "sun-am", studentIds: [] },
    ])
    expect(database.getAll.mock.calls[0]![0]).toContain("FROM crews")
    expect(database.getAll.mock.calls[0]![0]).not.toContain("landAssignments")
  })
})
