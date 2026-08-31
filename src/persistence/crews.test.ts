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

  it("replaces one session atomically including empty crews", async () => {
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

    database.getAll.mockResolvedValueOnce([])
    await expect(
      saveCrewPlan("course-1", "sat-pm", {
        ...duplicatePlan,
        crews: [duplicatePlan.crews[0]!],
      }),
    ).rejects.toThrow("does not belong to course")
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
