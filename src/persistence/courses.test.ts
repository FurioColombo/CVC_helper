import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const database = vi.hoisted(() => ({
  execute: vi.fn(),
  getOptional: vi.fn(),
  init: vi.fn(),
  writeLock: vi.fn(),
  writeTransaction: vi.fn(),
}))

vi.mock("@/persistence/db", () => ({ db: database }))
vi.mock("@/persistence/migrations", () => ({
  prepareDatabase: vi.fn(async () => "write"),
}))

import type { CourseDetails } from "@/domain/course"
import {
  COURSE_DATA_TABLES,
  eraseAllCourseData,
  getActiveCourse,
  saveActiveCourse,
} from "@/persistence/courses"
import { prepareDatabase } from "@/persistence/migrations"
import { AppSchema } from "@/persistence/schema"
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
      () =>
        new Promise((resolve) => (finishMigrations = () => resolve("write"))),
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
    const lockContext = { execute: vi.fn().mockResolvedValue(undefined) }
    database.writeLock.mockImplementation(
      async (lock: (context: typeof lockContext) => unknown) =>
        lock(lockContext),
    )
    const transaction = {
      execute: vi.fn().mockResolvedValue(undefined),
      getAll: vi
        .fn()
        .mockResolvedValue(
          [...COURSE_DATA_TABLES, "meta"].map((name) => ({ name })),
        ),
    }
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
    // Compacted outside any transaction, which SQLite requires for VACUUM
    // (D3 review DI-R2-1).
    expect(lockContext.execute).toHaveBeenCalledWith("VACUUM")
    expect(transaction.execute).not.toHaveBeenCalledWith("VACUUM")
    // The migration ledger describes the data, not the course: it stays.
    expect(transaction.execute.mock.calls.map(([sql]) => sql)).not.toContain(
      "DELETE FROM meta",
    )
    expect(
      window.localStorage.getItem("cvc-helper.scan-name-order.course-1"),
    ).toBeNull()
    // A display preference belongs to the device, not to the course.
    expect(window.localStorage.getItem("cvc-helper.crew-display-columns")).toBe(
      "3",
    )
  })

  // A 0.3.0 tab that opened the database under the open app dropped the
  // tables only newer versions declare, with their rows.
  it("erases the course tables that are still there when an older app dropped one", async () => {
    const transaction = {
      execute: vi.fn().mockResolvedValue(undefined),
      getAll: vi
        .fn()
        .mockResolvedValue(
          COURSE_DATA_TABLES.filter((name) => name !== "dutySettingItems").map(
            (name) => ({ name }),
          ),
        ),
    }
    database.writeTransaction.mockImplementation(
      async (write: (tx: typeof transaction) => unknown) => write(transaction),
    )

    await eraseAllCourseData()

    expect(transaction.execute.mock.calls.map(([sql]) => sql)).toEqual(
      COURSE_DATA_TABLES.filter((name) => name !== "dutySettingItems").map(
        (table) => `DELETE FROM ${table}`,
      ),
    )
  })

  it("names every table of the local schema that can hold course data", () => {
    const { tables } = AppSchema.toJSON() as { tables: Array<{ name: string }> }
    expect(tables.length).toBeGreaterThan(10)
    // `meta` is not course data: it holds the migration ledger (and from D3
    // the data version), which erasing a course must leave in place.
    expect(new Set(COURSE_DATA_TABLES)).toEqual(
      new Set(tables.map(({ name }) => name).filter((name) => name !== "meta")),
    )
  })
})
