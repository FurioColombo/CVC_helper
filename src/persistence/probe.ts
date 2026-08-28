import { db } from "@/persistence/db"

const PROBE_KEY = "m0-persistence-probe"

export async function readPersistenceProbe() {
  await db.init()
  const record = await db.getOptional<{ value: number }>(
    "SELECT value FROM meta WHERE id = ?",
    [PROBE_KEY],
  )
  return typeof record?.value === "number" ? record.value : 0
}

export async function incrementPersistenceProbe() {
  const current = await readPersistenceProbe()
  const next = current + 1
  await db.execute("INSERT OR REPLACE INTO meta(id, value) VALUES(?, ?)", [
    PROBE_KEY,
    next,
  ])
  return next
}
