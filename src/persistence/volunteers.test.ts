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
    database.execute.mockResolvedValue(undefined)
    database.getAll.mockResolvedValue([])
  })

  it("lists only current-course volunteers by name", async () => {
    await listVolunteers("course-1")

    expect(database.getAll).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY name COLLATE NOCASE"),
      ["course-1"],
    )
  })

  it("creates a separate name and ADV/IS role record", async () => {
    const volunteer = await createVolunteer("course-1", {
      name: "Anna Bianchi",
      role: "ADV",
    })

    expect(volunteer).toEqual(
      expect.objectContaining({
        courseId: "course-1",
        name: "Anna Bianchi",
        role: "ADV",
      }),
    )
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO volunteers"),
      [volunteer.id, "course-1", "Anna Bianchi", "ADV"],
    )
  })

  it("scopes updates to the current course", async () => {
    await updateVolunteer("volunteer-1", "course-1", {
      name: "Anna Neri",
      role: "IS",
    })
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ? AND courseId = ?"),
      ["Anna Neri", "IS", "volunteer-1", "course-1"],
    )
  })
})
