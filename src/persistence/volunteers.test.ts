import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
import { TOUCH } from "@/persistence/stamp"

const NOW = "2026-09-19T12:20:05.625Z"

describe("volunteer persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(NOW))
    database.init.mockResolvedValue(undefined)
    database.execute.mockResolvedValue([{ id: "volunteer-1" }])
    database.getAll.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("lists unchanged ADV/IS rows together with CT by name", async () => {
    const rows = [
      { id: "volunteer-1", courseId: "course-1", name: "Anna", role: "ADV" },
      { id: "volunteer-3", courseId: "course-1", name: "Carla", role: "CT" },
      { id: "volunteer-2", courseId: "course-1", name: "Ivo", role: "IS" },
    ] as const
    database.getAll.mockResolvedValue([...rows])

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
        expect.stringMatching(
          /INSERT INTO volunteers\([^)]*createdAt, updatedAt\s*\)/,
        ),
        [volunteer.id, "course-1", "Anna Bianchi", role, NOW, NOW],
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
      ["Anna Neri", "CT", NOW, "volunteer-1", "course-1"],
    )
    const sql = database.execute.mock.calls[0]?.[0]
    expect(sql).toContain(`SET name = ?, role = ?, ${TOUCH}`)
    expect(sql).toContain("RETURNING id")
  })

  it("trims names at create and update boundaries", async () => {
    const created = await createVolunteer("course-1", {
      name: "  Carla Timoniere  ",
      role: "CT",
    })
    expect(created.name).toBe("Carla Timoniere")
    expect(database.execute).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO volunteers"),
      [created.id, "course-1", "Carla Timoniere", "CT", NOW, NOW],
    )

    await updateVolunteer("volunteer-1", "course-1", {
      name: "  Carla T.  ",
      role: "CT",
    })
    expect(database.execute).toHaveBeenLastCalledWith(
      expect.stringContaining("RETURNING id"),
      ["Carla T.", "CT", NOW, "volunteer-1", "course-1"],
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

// UG2-FUN-2: SQLite's NOCASE puts an accented initial after the Z.
describe("volunteer list order", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    database.init.mockResolvedValue(undefined)
  })

  it("lists accented names with their base letter", async () => {
    database.getAll.mockResolvedValue(
      ["Zeno", "Élodie", "Anna", "Ivo", "Östen", "Carla"].map(
        (name, index) => ({
          id: `volunteer-${index}`,
          courseId: "course-1",
          name,
          role: "ADV",
        }),
      ),
    )

    expect((await listVolunteers("course-1")).map(({ name }) => name)).toEqual([
      "Anna",
      "Carla",
      "Élodie",
      "Ivo",
      "Östen",
      "Zeno",
    ])
  })
})
