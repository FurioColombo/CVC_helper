import { beforeEach, describe, expect, it, vi } from "vitest"

const database = vi.hoisted(() => ({
  execute: vi.fn(),
  executeBatch: vi.fn(),
  getAll: vi.fn(),
  init: vi.fn(),
  writeTransaction: vi.fn(),
}))

vi.mock("@/persistence/db", () => ({ db: database }))

import {
  readCrewHistory,
  readCrewPlan,
  saveCrewPlan,
} from "@/persistence/crews"

describe("crew persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    database.init.mockResolvedValue(undefined)
    database.getAll.mockResolvedValue([])
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

  it("reads ordered members and A terra separately", async () => {
    database.getAll
      .mockResolvedValueOnce([
        {
          id: "crew-1",
          sessionId: "sat-pm",
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
      .mockResolvedValueOnce([
        { id: "land-1", sessionId: "sat-pm", studentId: "student-2" },
      ])

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

  it("replaces one session atomically including empty crews", async () => {
    await saveCrewPlan("course-1", "sat-pm", {
      crews: [
        {
          id: "crew-1",
          sessionId: "sat-pm",
          members: [{ personId: "student-1", personType: "student" }],
        },
        { id: "crew-2", sessionId: "sat-pm", members: [] },
      ],
      landStudentIds: ["student-2"],
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
  })

  it("refuses duplicate simultaneous assignment before writing", async () => {
    await expect(
      saveCrewPlan("course-1", "sat-pm", {
        crews: [
          {
            id: "crew-1",
            sessionId: "sat-pm",
            members: [{ personId: "student-1", personType: "student" }],
          },
        ],
        landStudentIds: ["student-1"],
      }),
    ).rejects.toThrow("Duplicate session student")
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

    await expect(readCrewPlan("course-1", "sat-pm")).rejects.toThrow(
      "Invalid persisted crew plan",
    )
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
