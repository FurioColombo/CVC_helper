import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const database = vi.hoisted(() => ({
  execute: vi.fn(),
  getOptional: vi.fn(),
  init: vi.fn(),
  writeTransaction: vi.fn(),
}))

vi.mock("@/persistence/db", () => ({ db: database }))
vi.mock("@/persistence/migrations", () => ({
  prepareDatabase: vi.fn(async () => {}),
}))

import type { CourseDetails } from "@/domain/course"
import {
  COURSE_DATA_TABLES,
  eraseAllCourseData,
  getActiveCourse,
  saveActiveCourse,
} from "@/persistence/courses"
import { prepareDatabase } from "@/persistence/migrations"
import { TOUCH } from "@/persistence/stamp"

const NOW = "2026-08-29T07:30:00.125Z"

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
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(NOW))
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

  afterEach(() => {
    vi.useRealTimers()
  })

  it("reads only the active course", async () => {
    database.getOptional.mockResolvedValue({ id: "course-1", ...DETAILS })

    await getActiveCourse()

    expect(database.getOptional).toHaveBeenCalledWith(
      expect.stringContaining("WHERE active = 1"),
    )
  })

  it("reads nothing until the pending migrations have run", async () => {
    let finishMigrations = () => {}
    vi.mocked(prepareDatabase).mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishMigrations = resolve)),
    )
    database.getOptional.mockResolvedValue(null)

    const read = getActiveCourse()
    await Promise.resolve()
    expect(prepareDatabase).toHaveBeenCalledOnce()
    expect(database.getOptional).not.toHaveBeenCalled()

    finishMigrations()
    await read
    expect(database.getOptional).toHaveBeenCalledOnce()
  })

  it("deactivates an existing course and inserts the new one atomically", async () => {
    const course = await saveActiveCourse(DETAILS)

    expect(database.writeTransaction).toHaveBeenCalledOnce()
    expect(database.execute).toHaveBeenNthCalledWith(
      1,
      `UPDATE courses SET active = 0, ${TOUCH} WHERE active = 1`,
      [NOW],
    )
    expect(database.execute).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(
        /INSERT INTO courses\([^)]*createdAt, updatedAt\s*\)/,
      ),
      [
        course.id,
        1,
        "Deriva",
        2,
        35,
        2026,
        "2026-08-29",
        "2026-09-05",
        "D2 35 2026",
        NOW,
        NOW,
      ],
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
    // The migration ledger describes the schema, not the course: it stays.
    expect(JSON.stringify(transaction.execute.mock.calls)).not.toContain(
      "appMeta",
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
    // Two tables are not course data: `meta` is an empty probe table kept only
    // for schema compatibility, and `appMeta` is the data's own bookkeeping
    // (the migration ledger), which erasing a course must leave in place.
    const notCourseData = ["meta", "appMeta"]
    expect(new Set(COURSE_DATA_TABLES)).toEqual(
      new Set(tables.filter((name) => !notCourseData.includes(name))),
    )
  })
})
