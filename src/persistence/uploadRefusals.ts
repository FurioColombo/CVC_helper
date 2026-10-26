import type { Transaction } from "@powersync/web"

import { db } from "@/persistence/db"
import { prepareDatabase } from "@/persistence/migrations"
import { AppSchema, COURSE_PARENTS, COURSE_TABLES } from "@/persistence/schema"

/**
 * B4: the changes the online backup refused for good, kept on the device
 * (the uploadRefusals table, src/persistence/schema.ts) so Impostazioni
 * lists them and can send them again. Sending again writes rows whole with
 * the metadata they carry, as the switch copies rows
 * (src/persistence/writeStatements.test.ts exempts this file).
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

/** The meta row counting changes the server already held a later edit of. */
export const SUPERSEDED_EDITS_ID = "local:superseded-edits"

/**
 * What one upload learned, in one write before its transaction completes:
 * the refusals to keep (a refusal recorded twice stays one), the refusals of
 * rows written whole or deleted since, which no longer apply (review
 * SC-B4-1), and how many changes the server had a later edit of (owner
 * decision 12: the app says when two phones edited offline).
 */
export async function recordUploadOutcome(outcome: {
  refusals: UploadRefusal[]
  settledRows: Array<{ tableName: string; rowId: string }>
  superseded: number
}) {
  const { refusals, settledRows, superseded } = outcome
  if (refusals.length === 0 && settledRows.length === 0 && superseded === 0)
    return
  await db.writeTransaction(async (transaction) => {
    if (settledRows.length > 0)
      await transaction.executeBatch(
        "DELETE FROM uploadRefusals WHERE tableName = ? AND rowId = ?",
        settledRows.map(({ tableName, rowId }) => [tableName, rowId]),
      )
    // A refusal arriving after its course was erased or replaced on this
    // device is not kept: it would hold the erased people's data, and sending
    // it again would bring them back (review SP-B4-1).
    const kept: UploadRefusal[] = []
    for (const refusal of refusals)
      if (await courseStillHere(transaction, refusal)) kept.push(refusal)
    if (kept.length > 0)
      await transaction.executeBatch(
        `INSERT OR REPLACE INTO uploadRefusals(
           id, tableName, rowId, op, data, reason, refusedAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        kept.map((refusal) => [
          refusal.id,
          refusal.tableName,
          refusal.rowId,
          refusal.op,
          JSON.stringify(refusal.data),
          refusal.reason,
          refusal.refusedAt,
        ]),
      )
    if (superseded > 0) {
      const [row] = await transaction.getAll<{ value: number | null }>(
        "SELECT value FROM meta WHERE id = ?",
        [SUPERSEDED_EDITS_ID],
      )
      await transaction.execute(
        "INSERT OR REPLACE INTO meta(id, value) VALUES (?, ?)",
        [SUPERSEDED_EDITS_ID, Number(row?.value ?? 0) + superseded],
      )
    }
  })
}

/**
 * Whether a refused change still belongs to a course on this device: a
 * delete always does (it names no one); an insert or edit when its course,
 * or for a course row the course itself, is here. An edit of a row no longer
 * here is not kept: its delete follows it in the queue.
 */
async function courseStillHere(
  transaction: Transaction,
  refusal: UploadRefusal,
) {
  if (refusal.op === "DELETE") return true
  let courseId =
    refusal.tableName === "courses" ? refusal.rowId : refusal.data?.courseId
  if (typeof courseId !== "string" && COURSE_TABLE_SET.has(refusal.tableName)) {
    const [row] = await transaction.getAll<{ courseId: string | null }>(
      `SELECT courseId FROM "${refusal.tableName}" WHERE id = ?`,
      [refusal.rowId],
    )
    courseId = row?.courseId ?? undefined
  }
  if (typeof courseId !== "string") return false
  const course = await transaction.getAll(
    "SELECT 1 FROM courses WHERE id = ?",
    [courseId],
  )
  return course.length > 0
}

/** How many changes since the owner last read it the server had a later edit of. */
export async function supersededEdits() {
  await prepareDatabase(db)
  const [row] = await db.getAll<{ value: number | null }>(
    "SELECT value FROM meta WHERE id = ?",
    [SUPERSEDED_EDITS_ID],
  )
  return Number(row?.value ?? 0)
}

export async function forgetSupersededEdits() {
  await db.writeTransaction((transaction) =>
    transaction.execute("DELETE FROM meta WHERE id = ?", [SUPERSEDED_EDITS_ID]),
  )
}

/** The app's columns of a course table, `id` aside (whole-row uploads). */
export function courseTableColumns(table: string): readonly string[] {
  const known = columnsOf.get(table)
  if (!COURSE_TABLE_SET.has(table) || !known)
    throw new Error("Not a course table")
  return [...known]
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

type Row = Record<string, unknown> & { id: string; updatedAt?: string | null }

/** The refused row's columns, if its table and every column are known. */
function knownColumns(refusal: UploadRefusal) {
  const known = columnsOf.get(refusal.tableName)
  if (!COURSE_TABLE_SET.has(refusal.tableName) || !known) return null
  const named = Object.keys(refusal.data ?? {}).filter((name) => name !== "id")
  return named.every((name) => known.has(name)) ? [...known] : null
}

async function writeWhole(
  transaction: Transaction,
  table: string,
  columns: string[],
  row: Row,
) {
  const names = ["id", ...columns].map((name) => `"${name}"`)
  await transaction.execute(
    `INSERT OR REPLACE INTO "${table}" (${names.join(", ")})
     VALUES (${names.map(() => "?").join(", ")})`,
    [row.id, ...columns.map((name) => row[name] ?? null)],
  )
}

/** Whether the row's course and parent are on the device (no orphan). */
async function parentsPresent(
  transaction: Transaction,
  table: string,
  row: Row,
) {
  const checks: Array<[string, unknown]> = []
  // A course is never re-created from a refusal: only one on the device is
  // sent again (review SP-B4-1).
  checks.push(
    table === "courses" ? ["courses", row.id] : ["courses", row.courseId],
  )
  const parent = COURSE_PARENTS[table as keyof typeof COURSE_PARENTS]
  if (parent) checks.push([parent.table, row[parent.key]])
  for (const [parentTable, id] of checks) {
    if (typeof id !== "string") return false
    const found = await transaction.getAll(
      `SELECT 1 FROM "${parentTable}" WHERE id = ?`,
      [id],
    )
    if (found.length === 0) return false
  }
  return true
}

/**
 * Sends the refused changes again, without ever going back on a later edit
 * (B4 reviews DI-B4-2, -3, SC-B4-1). Once a refusal is done, the next sync
 * brings the server's copy back onto the device, so the refused data is kept
 * here. Each refused row's changes are folded in the order refused (an
 * insert, then the edits over it, or a delete), then:
 * - edited on the device after the last refusal: the row as it is now goes;
 * - otherwise the folded change goes, always as a whole row, never an empty
 *   change: over the row now on the device when there is one; a delete
 *   removes the server's copy that came back;
 * - what cannot be rebuilt here (no whole row, its course or parent gone,
 *   its table or a column unknown to this version) is never applied and
 *   stays listed, for "Togli dall’elenco".
 * A row deleted on the device since is not refused any more: its delete
 * cancels its refusals as it uploads (src/backup/connector.ts).
 * Every change goes back through the queue. Returns how many stay listed.
 */
export async function retryUploadRefusals() {
  const refusals = await uploadRefusals()
  const byRow = new Map<string, UploadRefusal[]>()
  for (const refusal of refusals) {
    const key = JSON.stringify([refusal.tableName, refusal.rowId])
    byRow.set(key, [...(byRow.get(key) ?? []), refusal])
  }
  return db.writeTransaction(async (transaction) => {
    let kept = 0
    for (const group of byRow.values()) {
      const [{ tableName, rowId }] = group as [UploadRefusal]
      const columns = group.every((refusal) => knownColumns(refusal))
        ? courseTableColumns(tableName)
        : null
      if (!columns) {
        kept += group.length
        continue
      }
      const [current] = await transaction.getAll<Row>(
        `SELECT * FROM "${tableName}" WHERE id = ?`,
        [rowId],
      )
      // The refused changes, folded: null data means "deleted".
      let folded: Row | null = null
      let whole = false
      let removed = false
      let lastEdit = ""
      for (const refusal of group) {
        lastEdit = maxText(
          lastEdit,
          (refusal.data?.updatedAt as string | undefined) ?? refusal.refusedAt,
        )
        if (refusal.op === "DELETE") {
          folded = null
          removed = true
          whole = false
        } else if (refusal.op === "PUT") {
          folded = { ...refusal.data, id: rowId }
          removed = false
          whole = true
        } else {
          folded = { ...(folded ?? {}), ...refusal.data, id: rowId }
          removed = false
        }
      }
      let row: Row | null = null
      if (current && (current.updatedAt ?? "") > lastEdit) row = current
      else if (removed) {
        if (current)
          await transaction.execute(`DELETE FROM "${tableName}" WHERE id = ?`, [
            rowId,
          ])
      } else if (folded && (whole || current))
        row = whole ? folded : { ...current!, ...folded }
      if (!removed || row) {
        if (!row || !(await parentsPresent(transaction, tableName, row))) {
          kept += group.length
          continue
        }
        await writeWhole(transaction, tableName, [...columns], row)
      }
      await transaction.executeBatch(
        "DELETE FROM uploadRefusals WHERE id = ?",
        group.map(({ id }) => [id]),
      )
    }
    return kept
  })
}

const maxText = (left: string, right: string) => (right > left ? right : left)

/**
 * The owner gives up sending the listed refusals: they leave the list, and
 * the online copy stays without them. The course on the device is not
 * changed.
 */
export async function discardUploadRefusals() {
  await db.writeTransaction((transaction) =>
    transaction.execute("DELETE FROM uploadRefusals"),
  )
}
