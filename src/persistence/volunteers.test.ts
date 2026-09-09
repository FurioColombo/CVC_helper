import { beforeEach, describe, expect, it, vi } from "vitest"

const database = vi.hoisted(() => ({
  execute: vi.fn(),
  getAll: vi.fn(),
  init: vi.fn(),
}))

vi.mock("@/persistence/db", () => ({ db: database }))

import {
  createVolunteer,
  listVolunteers,
  updateVolunteer,
} from "@/persistence/volunteers"

describe("volunteer persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    database.init.mockResolvedValue(undefined)
    database.execute.mockResolvedValue([{ id: "volunteer-1" }])
    database.getAll.mockResolvedValue([])
  })

  it("lists unchanged ADV/IS rows together with CT by name", async () => {
    const rows = [
      { id: "volunteer-1", courseId: "course-1", name: "Anna", role: "ADV" },
      { id: "volunteer-2", courseId: "course-1", name: "Ivo", role: "IS" },
      { id: "volunteer-3", courseId: "course-1", name: "Carla", role: "CT" },
    ] as const
    database.getAll.mockResolvedValue(rows)

    await expect(listVolunteers("course-1")).resolves.toEqual(rows)

    expect(database.getAll).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY name COLLATE NOCASE"),
      ["course-1"],
    )
  })

  it.each(["ADV", "IS", "CT"] as const)(
    "creates a separate name and %s role record",
    async (role) => {
      const volunteer = await createVolunteer("course-1", {
        name: "Anna Bianchi",
        role,
      })

      expect(volunteer).toEqual(
        expect.objectContaining({
          courseId: "course-1",
          name: "Anna Bianchi",
          role,
        }),
      )
      expect(database.execute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO volunteers"),
        [volunteer.id, "course-1", "Anna Bianchi", role],
      )
    },
  )

  it("scopes updates to the current course", async () => {
    await updateVolunteer("volunteer-1", "course-1", {
      name: "Anna Neri",
      role: "CT",
    })
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ? AND courseId = ?"),
      ["Anna Neri", "CT", "volunteer-1", "course-1"],
    )
    expect(database.execute.mock.calls[0]?.[0]).toContain("RETURNING id")
  })

  it("trims names at create and update boundaries", async () => {
    const created = await createVolunteer("course-1", {
      name: "  Carla Timoniere  ",
      role: "CT",
    })
    expect(created.name).toBe("Carla Timoniere")
    expect(database.execute).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO volunteers"),
      [created.id, "course-1", "Carla Timoniere", "CT"],
    )

    await updateVolunteer("volunteer-1", "course-1", {
      name: "  Carla T.  ",
      role: "CT",
    })
    expect(database.execute).toHaveBeenLastCalledWith(
      expect.stringContaining("RETURNING id"),
      ["Carla T.", "CT", "volunteer-1", "course-1"],
    )
  })

  it("fails visibly when the current-course update matches no volunteer", async () => {
    database.execute.mockResolvedValue([])

    await expect(
      updateVolunteer("volunteer-stale", "course-1", {
        name: "Carla",
        role: "CT",
      }),
    ).rejects.toThrow("Volunteer does not belong to course")
  })

  it("rejects empty names and roles outside the canonical table", async () => {
    await expect(
      createVolunteer("course-1", { name: "  ", role: "ADV" }),
    ).rejects.toThrow("Volunteer name is required")
    await expect(
      updateVolunteer("volunteer-1", "course-1", {
        name: "Anna",
        role: "student" as never,
      }),
    ).rejects.toThrow("Invalid volunteer role")
    expect(database.execute).not.toHaveBeenCalled()
  })

  it("rejects corrupt persisted roles at the read boundary", async () => {
    database.getAll.mockResolvedValue([
      {
        id: "volunteer-1",
        courseId: "course-1",
        name: "Anna",
        role: "student",
      },
    ])

    await expect(listVolunteers("course-1")).rejects.toThrow(
      "Invalid persisted volunteer",
    )
  })
})
