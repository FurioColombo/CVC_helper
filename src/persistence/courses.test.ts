import { beforeEach, describe, expect, it, vi } from "vitest"

const database = vi.hoisted(() => ({
  execute: vi.fn(),
  getOptional: vi.fn(),
  init: vi.fn(),
  writeTransaction: vi.fn(),
}))

vi.mock("@/persistence/db", () => ({ db: database }))

import type { CourseDetails } from "@/domain/course"
import { getActiveCourse, saveActiveCourse } from "@/persistence/courses"

const DETAILS: CourseDetails = {
  family: "Deriva",
  level: 2,
  isoWeek: 35,
  year: 2026,
  startDate: "2026-08-29",
  endDate: "2026-09-05",
  label: "D2 35 2026",
}

describe("course persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    database.init.mockResolvedValue(undefined)
    database.execute.mockResolvedValue(undefined)
    database.writeTransaction.mockImplementation(
      async (
        callback: (transaction: {
          execute: typeof database.execute
        }) => Promise<unknown>,
      ) => callback({ execute: database.execute }),
    )
  })

  it("reads only the active course", async () => {
    database.getOptional.mockResolvedValue({ id: "course-1", ...DETAILS })

    await getActiveCourse()

    expect(database.getOptional).toHaveBeenCalledWith(
      expect.stringContaining("WHERE active = 1"),
    )
  })

  it("deactivates an existing course and inserts the new one atomically", async () => {
    const course = await saveActiveCourse(DETAILS)

    expect(database.writeTransaction).toHaveBeenCalledOnce()
    expect(database.execute).toHaveBeenNthCalledWith(
      1,
      "UPDATE courses SET active = 0 WHERE active = 1",
    )
    expect(database.execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO courses"),
      expect.arrayContaining([course.id, 1, "Deriva", 2, "D2 35 2026"]),
    )
    expect(course).toEqual(expect.objectContaining({ active: 1, ...DETAILS }))
  })
})
