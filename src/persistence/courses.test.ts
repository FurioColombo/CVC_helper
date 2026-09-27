import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

const database = vi.hoisted(() => ({
  execute: vi.fn(),
  getOptional: vi.fn(),
  init: vi.fn(),
  writeTransaction: vi.fn(),
}))

vi.mock("@/persistence/db", () => ({ db: database }))

import type { CourseDetails } from "@/domain/course"
import {
  COURSE_DATA_TABLES,
  eraseAllCourseData,
  getActiveCourse,
  saveActiveCourse,
} from "@/persistence/courses"

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

  it("erases every course table in one transaction and forgets course preferences", async () => {
    const transaction = { execute: vi.fn().mockResolvedValue(undefined) }
    database.writeTransaction.mockImplementation(
      async (write: (tx: typeof transaction) => unknown) => write(transaction),
    )
    window.localStorage.setItem(
      "cvc-helper.scan-name-order.course-1",
      "surname-given",
    )
    window.localStorage.setItem("cvc-helper.crew-display-columns", "3")

    await eraseAllCourseData()

    expect(database.writeTransaction).toHaveBeenCalledOnce()
    expect(transaction.execute.mock.calls.map(([sql]) => sql)).toEqual(
      COURSE_DATA_TABLES.map((table) => `DELETE FROM ${table}`),
    )
    expect(
      window.localStorage.getItem("cvc-helper.scan-name-order.course-1"),
    ).toBeNull()
    // A display preference belongs to the device, not to the course.
    expect(window.localStorage.getItem("cvc-helper.crew-display-columns")).toBe(
      "3",
    )
  })

  it("names every table of the local schema that can hold course data", () => {
    const schema = readFileSync(resolve(import.meta.dirname, "db.ts"), "utf8")
    const body = /new Schema\(\{([^}]*)\}\)/.exec(schema)?.[1] ?? ""
    const tables = body
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
    expect(tables.length).toBeGreaterThan(10)
    // `meta` is an empty probe table kept only for schema compatibility.
    expect(new Set(COURSE_DATA_TABLES)).toEqual(
      new Set(tables.filter((name) => name !== "meta")),
    )
  })
})
