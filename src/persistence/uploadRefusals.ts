import { db } from "@/persistence/db"
import { prepareDatabase } from "@/persistence/migrations"
import { AppSchema, COURSE_TABLES } from "@/persistence/schema"

/**
 * B4: the changes the online backup refused for good, kept on the device
 * (the uploadRefusals table, src/persistence/schema.ts) so Impostazioni
 * lists them and can send them again. Sending again applies each change
 * verbatim, the metadata it was queued with included, as the switch copies
 * rows (src/persistence/writeStatements.test.ts exempts this file).
 */
/** A change the online backup refused for good (B4). */
export type UploadRefusal = {
  /** "refusal:<queue entry>": recording one twice keeps one. */
  id: string
  /** The app's table name, without `synced_`. */
  tableName: string
  rowId: string
  op: "PUT" | "PATCH" | "DELETE"
  /** The change's columns, as the queue held them. */
  data: Record<string, unknown> | null
  reason: string
  refusedAt: string
}

/** Keeps the refused changes of one upload; their transaction then ends. */
export async function recordUploadRefusals(refusals: UploadRefusal[]) {
  if (refusals.length === 0) return
  await db.writeTransaction((transaction) =>
    transaction.executeBatch(
      `INSERT OR REPLACE INTO uploadRefusals(
         id, tableName, rowId, op, data, reason, refusedAt
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      refusals.map((refusal) => [
        refusal.id,
        refusal.tableName,
        refusal.rowId,
        refusal.op,
        JSON.stringify(refusal.data),
        refusal.reason,
        refusal.refusedAt,
      ]),
    ),
  )
}

type RefusalRow = Omit<UploadRefusal, "data"> & { data: string | null }

export async function uploadRefusals(): Promise<UploadRefusal[]> {
  await prepareDatabase(db)
  const rows = await db.getAll<RefusalRow>(
    `SELECT id, tableName, rowId, op, data, reason, refusedAt
     FROM uploadRefusals ORDER BY refusedAt, id`,
  )
  return rows.map((row) => ({
    ...row,
    data: row.data ? (JSON.parse(row.data) as Record<string, unknown>) : null,
  }))
}

const COURSE_TABLE_SET = new Set<string>(COURSE_TABLES)
const columnsOf = new Map(
  (
    AppSchema as unknown as {
      toJSON: () => {
        tables: Array<{ name: string; columns: Array<{ name: string }> }>
      }
    }
  )
    .toJSON()
    .tables.map(({ name, columns }) => [
      name,
      new Set(columns.map((column) => column.name)),
    ]),
)

/** Only the course's own tables and columns: the stored data names them. */
function checkedColumns(refusal: UploadRefusal) {
  const known = columnsOf.get(refusal.tableName)
  if (!COURSE_TABLE_SET.has(refusal.tableName) || !known)
    throw new Error("Not a course table")
  const columns = Object.keys(refusal.data ?? {}).filter(
    (name) => name !== "id",
  )
  if (columns.some((name) => !known.has(name)))
    throw new Error("Not a column of the table")
  return columns
}

/**
 * Sends the refused changes again: each is applied once more to the course,
 * which queues it for upload, and its record goes. A change to a row that
 * is no longer on the device cannot be rebuilt from its changed columns and
 * stays recorded. Returns how many stay.
 */
export async function retryUploadRefusals() {
  const refusals = await uploadRefusals()
  return db.writeTransaction(async (transaction) => {
    let kept = 0
    for (const refusal of refusals) {
      const columns = checkedColumns(refusal)
      const values = columns.map((name) => refusal.data?.[name] ?? null)
      const table = `"${refusal.tableName}"`
      if (refusal.op === "DELETE") {
        await transaction.execute(`DELETE FROM ${table} WHERE id = ?`, [
          refusal.rowId,
        ])
      } else if (refusal.op === "PUT") {
        const names = ["id", ...columns].map((name) => `"${name}"`)
        await transaction.execute(
          `INSERT OR REPLACE INTO ${table} (${names.join(", ")})
           VALUES (${names.map(() => "?").join(", ")})`,
          [refusal.rowId, ...values],
        )
      } else {
        const present = await transaction.getAll(
          `SELECT 1 FROM ${table} WHERE id = ?`,
          [refusal.rowId],
        )
        if (present.length === 0 || columns.length === 0) {
          kept += 1
          continue
        }
        await transaction.execute(
          `UPDATE ${table} SET ${columns.map((name) => `"${name}" = ?`).join(", ")}
           WHERE id = ?`,
          [...values, refusal.rowId],
        )
      }
      await transaction.execute("DELETE FROM uploadRefusals WHERE id = ?", [
        refusal.id,
      ])
    }
    return kept
  })
}
