import { DatabaseSync } from "node:sqlite"
import type { PowerSyncDatabase } from "@powersync/web"
import { describe, expect, it, vi } from "vitest"
import {
  advanceCourseGeneration,
  bindCourseSession,
  CourseReplacedError,
  invalidateCourseSession,
  onCourseReplaced,
} from "./courseSession"
import { guardWrites } from "./writeGuard"

function sharedDatabase() {
  const sqlite = new DatabaseSync(":memory:")
  sqlite.exec(
    "CREATE TABLE meta(id TEXT PRIMARY KEY, value INTEGER); CREATE TABLE edits(value TEXT); CREATE TABLE courses(id TEXT, active INTEGER)",
  )
  const context = {
    getAll: async (sql: string, parameters: unknown[] = []) =>
      sqlite.prepare(sql).all(...(parameters as Array<string | number>)),
    execute: async (sql: string, parameters: unknown[] = []) =>
      sqlite.prepare(sql).run(...(parameters as Array<string | number>)),
  }
  const withContext = async (
    callback: (tx: typeof context) => Promise<unknown>,
  ) => callback(context)
  const open = () =>
    guardWrites({
      readTransaction: withContext,
      writeTransaction: withContext,
      writeLock: withContext,
      executeRaw: vi.fn(),
      getAll: context.getAll,
    } as unknown as PowerSyncDatabase)
  return { sqlite, context, open }
}

describe("a course session", () => {
  it("rejects a stale tab's FIRST write after an atomic replacement, including the same course IDs", async () => {
    const { open, context, sqlite } = sharedDatabase()
    const old = open(),
      replacing = open()
    await bindCourseSession(old)
    await bindCourseSession(replacing)
    await replacing.writeTransaction(async (tx) => {
      await tx.execute("INSERT INTO edits(value) VALUES (?)", ["imported"])
      await advanceCourseGeneration(tx)
    })
    const callback = vi.fn(async () => {
      await context.execute("INSERT INTO edits(value) VALUES (?)", ["stale"])
    })
    await expect(old.writeTransaction(callback)).rejects.toBeInstanceOf(
      CourseReplacedError,
    )
    expect(callback).not.toHaveBeenCalled()
    expect(sqlite.prepare("SELECT * FROM edits").all()).toEqual([
      { value: "imported" },
    ])
    // A new app instance reads the new generation and can save.
    const fresh = open()
    await bindCourseSession(fresh)
    await fresh.execute("INSERT INTO edits(value) VALUES (?)", ["fresh"])
    expect(sqlite.prepare("SELECT * FROM edits").all()).toHaveLength(2)
    sqlite.close()
  })

  it("checks inside the acquired write lock and never rebinds an old instance", async () => {
    const { open, context, sqlite } = sharedDatabase()
    const old = open()
    await bindCourseSession(old)
    await advanceCourseGeneration(context as never)
    await bindCourseSession(old)
    await expect(
      old.execute("INSERT INTO edits(value) VALUES (?)", ["late"]),
    ).rejects.toBeInstanceOf(CourseReplacedError)
    expect(sqlite.prepare("SELECT * FROM edits").all()).toEqual([])
    sqlite.close()
  })

  it("permanently rejects reset callbacks even if a deleted database's generation restarts at zero", async () => {
    const { open, context, sqlite } = sharedDatabase()
    const old = open()
    await bindCourseSession(old)
    const notified = vi.fn()
    const stop = onCourseReplaced(notified)
    invalidateCourseSession(old)
    await context.execute("DELETE FROM meta")
    await expect(
      old.execute("INSERT INTO edits(value) VALUES (?)", ["resurrected"]),
    ).rejects.toBeInstanceOf(CourseReplacedError)
    expect(notified).toHaveBeenCalledOnce()
    stop()
    sqlite.close()
  })

  it("refuses student, volunteer or duty writes after the course itself was erased", async () => {
    const { open, context, sqlite } = sharedDatabase()
    await context.execute(
      "INSERT INTO courses(id, active) VALUES ('old-course', 1)",
    )
    const old = open()
    await bindCourseSession(old)
    await context.execute("DELETE FROM courses")
    const callback = vi.fn(async () =>
      context.execute("INSERT INTO edits(value) VALUES (?)", [
        "dangling record",
      ]),
    )
    await expect(old.writeTransaction(callback)).rejects.toBeInstanceOf(
      CourseReplacedError,
    )
    expect(callback).not.toHaveBeenCalled()
    expect(sqlite.prepare("SELECT * FROM edits").all()).toEqual([])
    sqlite.close()
  })

  it("rejects before contacting an already closed worker, while keeping the in-lock race check", async () => {
    const neverAcquired = vi.fn(() => new Promise(() => {}))
    const old = guardWrites({
      writeTransaction: neverAcquired,
      writeLock: neverAcquired,
      executeRaw: neverAcquired,
    } as unknown as PowerSyncDatabase)
    invalidateCourseSession(old)
    await expect(
      old.execute("INSERT INTO edits(value) VALUES (?)", ["late"]),
    ).rejects.toBeInstanceOf(CourseReplacedError)
    await expect(old.writeLock(async () => {})).rejects.toBeInstanceOf(
      CourseReplacedError,
    )
    expect(neverAcquired).not.toHaveBeenCalled()
  })
})
