import { PowerSyncDatabase } from "@powersync/web"

import { SyncedSchema } from "@/persistence/syncMode"

/**
 * B2: what the development PowerSync instance sends one signed-in account.
 * A throwaway database with the synced schema connects with the account's
 * Supabase token, waits for its first complete sync and reports the course
 * ids it received. It uploads nothing.
 */
export async function syncedCourseIds(endpoint: string, token: string) {
  const database = new PowerSyncDatabase({
    schema: SyncedSchema,
    database: { dbFilename: `b2-sync-${crypto.randomUUID()}.db` },
  })
  await database.init()
  try {
    await database.connect({
      fetchCredentials: async () => ({ endpoint, token }),
      uploadData: async () => {},
    })
    await Promise.race([
      database.waitForFirstSync(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("first sync timed out")), 60_000),
      ),
    ])
    const courses = await database.getAll<{ id: string }>(
      "SELECT id FROM courses ORDER BY id",
    )
    const students = await database.getAll<{ id: string }>(
      "SELECT id FROM students ORDER BY id",
    )
    return {
      courses: courses.map(({ id }) => id),
      students: students.map(({ id }) => id),
    }
  } finally {
    await database.disconnectAndClear()
    await database.close()
  }
}
