import type { PowerSyncDatabase, Transaction } from "@powersync/web"

import { db } from "@/persistence/db"
import { stamp } from "@/persistence/stamp"

/**
 * Data migrations: schema columns need none (PowerSync adds a new column as
 * null), but filling them does. Each migration runs in one write transaction
 * together with its ledger row in `appMeta`, so an interruption — the tab
 * killed, the phone asleep, the app closed — rolls the whole step back and the
 * next open runs it again; a step already in the ledger never runs twice. Every
 * step is also idempotent on its own (it only fills what is still null). Add a
 * step at the end; never edit or reorder an applied one.
 */
export interface Migration {
  id: string
  run: (transaction: Transaction, now: string) => Promise<void>
}

/** Course tables, parents before children. */
export const COURSE_TABLES = [
  "courses",
  "students",
  "volunteers",
  "boats",
  "faults",
  "dutyAssignments",
  "dutySettings",
  "crews",
  "crewMembers",
  "landAssignments",
  "sessionBoats",
  "evaluations",
] as const

export const MIGRATIONS: readonly Migration[] = [
  {
    // D1: faults, crew members and evaluations name their course directly,
    // copied from the parent that already did.
    id: "2026-10-d1-course-ownership",
    async run(transaction) {
      await transaction.execute(
        `UPDATE faults SET courseId =
           (SELECT boats.courseId FROM boats WHERE boats.id = faults.boatId)
         WHERE courseId IS NULL`,
      )
      await transaction.execute(
        `UPDATE crewMembers SET courseId =
           (SELECT crews.courseId FROM crews WHERE crews.id = crewMembers.crewId)
         WHERE courseId IS NULL`,
      )
      await transaction.execute(
        `UPDATE evaluations SET courseId =
           (SELECT students.courseId FROM students
            WHERE students.id = evaluations.studentId)
         WHERE courseId IS NULL`,
      )
    },
  },
  {
    // D1: every row gets createdAt and updatedAt. A row from before D1 has no
    // known creation time, so it gets the migration's; a fault keeps its own.
    id: "2026-10-d1-record-metadata",
    async run(transaction, now) {
      for (const table of COURSE_TABLES) {
        await transaction.execute(
          `UPDATE ${table} SET
             createdAt = coalesce(createdAt, ?),
             updatedAt = coalesce(updatedAt, createdAt, ?)
           WHERE createdAt IS NULL OR updatedAt IS NULL`,
          [now, now],
        )
      }
    },
  },
]

const ledgerKey = (migration: Migration) => `migration:${migration.id}`

type MigratableDatabase = Pick<PowerSyncDatabase, "writeTransaction">

/** Applies one migration unless the ledger already holds it. */
export async function applyMigration(
  database: MigratableDatabase,
  migration: Migration,
) {
  return database.writeTransaction(async (transaction) => {
    const applied = await transaction.getOptional<{ id: string }>(
      "SELECT id FROM appMeta WHERE id = ?",
      [ledgerKey(migration)],
    )
    if (applied) return false
    const now = stamp()
    await migration.run(transaction, now)
    await transaction.execute("INSERT INTO appMeta(id, value) VALUES (?, ?)", [
      ledgerKey(migration),
      now,
    ])
    return true
  })
}

/** Applies every pending migration, in order; returns the ids it applied. */
export async function runMigrations(
  database: MigratableDatabase,
  migrations: readonly Migration[] = MIGRATIONS,
) {
  const applied: string[] = []
  for (const migration of migrations) {
    if (await applyMigration(database, migration)) applied.push(migration.id)
  }
  return applied
}

const prepared = new WeakMap<PowerSyncDatabase, Promise<void>>()

/**
 * Opens the database and brings its data up to date before the app reads
 * anything: `getActiveCourse`, the app's first read, waits for it. One run per
 * database, however often it is asked.
 */
export function prepareDatabase(database: PowerSyncDatabase = db) {
  let ready = prepared.get(database)
  if (!ready) {
    ready = (async () => {
      await database.init()
      await runMigrations(database)
    })()
    prepared.set(database, ready)
    // A failed run may be retried by asking again.
    ready.catch(() => prepared.delete(database))
  }
  return ready
}
