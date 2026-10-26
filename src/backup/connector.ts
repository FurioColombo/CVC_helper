import type {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from "@powersync/web"
import { UpdateType } from "@powersync/web"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { BackupConfig } from "@/backup/config"
import {
  classifyUploadFailure,
  type RefusalReason,
  type UploadFailure,
} from "@/backup/uploadPolicy"

/**
 * B3: how PowerSync reaches the owner's backup. Credentials are the signed-in
 * Supabase session, fresh at every request (the powersync skill: never a
 * cached token). Uploads write each queued change through that session to
 * the server table of the same name without its `synced_` prefix
 * (src/persistence/syncMode.ts), in queue order, which keeps parents first
 * (B1 review SC-B1-Q4).
 *
 * B4: an insert, and an edit, goes as the whole row, every column, so it
 * replaces the server row instead of merging into it (review SC-B4-3); consecutive inserts
 * into one table go in one request (B1 review SC-B1-Q3). The server keeps the
 * latest edit of a row (supabase/migrations/20261026000000_upload_rules.sql):
 * an older change comes back with no row and counts as superseded, which
 * Impostazioni reports; a delete removes the server row only if nobody edited
 * it after this device last saw it. A failure is classified
 * (src/backup/uploadPolicy.ts): a transient one leaves the transaction
 * queued; an app below the server's minimum writer waits for the update; a
 * refusal, or an edit of a row the server does not have, is kept on the
 * device with its data and reported, and the queue goes on.
 */
export const SYNCED_PREFIX = "synced_"

/** Rows per insert request: the switch's first transaction is the course. */
export const BATCH_ROWS = 100

export function serverTable(type: string) {
  if (!type.startsWith(SYNCED_PREFIX))
    throw new Error(`Not a synced table: ${type}`)
  return type.slice(SYNCED_PREFIX.length)
}

type Client = Pick<SupabaseClient, "auth" | "from">
type Entry = Pick<CrudEntry, "op" | "table" | "id" | "opData"> & {
  clientId?: number
  previousValues?: Record<string, unknown>
}
type Result = {
  data?: Array<{ id: string }> | null
  error: (UploadFailure & { message?: string }) | null
  status?: number
}

/** A refused change, as the device keeps it (src/persistence/uploadRefusals.ts). */
export type Refusal = {
  id: string
  tableName: string
  rowId: string
  op: "PUT" | "PATCH" | "DELETE"
  data: Record<string, unknown> | null
  reason: RefusalReason | "missing"
  refusedAt: string
}

/** What one upload learned, kept in one write before it completes. */
export type UploadOutcome = {
  refusals: Refusal[]
  /** Rows written whole or deleted since: their older refusals are moot. */
  settledRows: Array<{ tableName: string; rowId: string }>
  /** Changes the server already held a later edit of. */
  superseded: number
}

export type UploadLink = {
  /** The app's columns of a course table, `id` aside. */
  columnsOf: (table: string) => readonly string[]
  /** Keeps the outcome; the transaction completes after it. */
  recordOutcome: (outcome: UploadOutcome) => Promise<void>
  /** The server asks for a newer app (true) or accepted one again (false). */
  onOutdated: (outdated: boolean) => void
}

/**
 * Writes one queued change, or a run of inserts into one table, with
 * `token`, the access token its transaction started with: a sign-in of
 * another account while the upload runs cannot lend it its own (B3 review
 * SP-B3-9). Each answer names the rows the server changed.
 */
export async function uploadEntries(
  client: Client,
  entries: Entry[],
  token: string,
  columns: readonly string[],
): Promise<Result> {
  const [first] = entries
  if (!first) return { error: null, data: [] }
  const table = client.from(serverTable(first.table))
  const authorization = `Bearer ${token}`
  if (first.op === UpdateType.PUT)
    return table
      .upsert(
        entries.map((entry) => ({
          id: entry.id,
          ...Object.fromEntries(
            columns.map((name) => [name, entry.opData?.[name] ?? null]),
          ),
        })),
      )
      .setHeader("Authorization", authorization)
      .select("id")
  if (first.op === UpdateType.PATCH)
    return table
      .update(first.opData ?? {})
      .setHeader("Authorization", authorization)
      .eq("id", first.id)
      .select("id")
  const seen = first.previousValues?.updatedAt
  const remove = table
    .delete()
    .setHeader("Authorization", authorization)
    .eq("id", first.id)
  return (
    typeof seen === "string" ? remove.lte("updatedAt", seen) : remove
  ).select("id")
}

/** Whether the server holds the row, when a change came back without it. */
async function serverHasRow(client: Client, entry: Entry, token: string) {
  const { data, error } = await client
    .from(serverTable(entry.table))
    .select("id")
    .setHeader("Authorization", `Bearer ${token}`)
    .eq("id", entry.id)
  if (error) throw new UploadPending(false)
  return (data ?? []).length > 0
}

/**
 * The queue's entries in runs: consecutive inserts into one table together,
 * never one row twice in a run (the server refuses that statement whole,
 * review SC-B4-4).
 */
export function uploadRuns<T extends Entry>(crud: T[]): T[][] {
  const runs: T[][] = []
  for (const entry of crud) {
    const last = runs.at(-1)
    if (
      last &&
      entry.op === UpdateType.PUT &&
      last[0]!.op === UpdateType.PUT &&
      last[0]!.table === entry.table &&
      last.length < BATCH_ROWS &&
      !last.some(({ id }) => id === entry.id)
    )
      last.push(entry)
    else runs.push([entry])
  }
  return runs
}

/** Thrown to leave the transaction queued; it names no row and no value. */
export class UploadPending extends Error {
  constructor(readonly outdated: boolean) {
    super(
      outdated
        ? "The backup needs a newer app to accept changes"
        : "The backup did not answer; the change stays queued",
    )
    this.name = "UploadPending"
  }
}

const failureOf = (result: Result): UploadFailure => ({
  code: result.error?.code,
  status: result.status ?? 0,
})

/**
 * The connector belongs to the account that opened it: once another account
 * is signed in, it neither fetches a token nor uploads, even if it outlives
 * a sign-out (B3 reviews SP-B3-1, FUX-B3-1).
 */
export function createConnector(
  client: Client,
  config: BackupConfig,
  account: string,
  link: UploadLink,
): PowerSyncBackendConnector {
  const sessionOf = async () => {
    const {
      data: { session },
      error,
    } = await client.auth.getSession()
    if (error) throw error
    return session?.user.id === account ? session : null
  }
  return {
    async fetchCredentials(): Promise<PowerSyncCredentials | null> {
      const session = await sessionOf()
      if (!session) return null
      return {
        endpoint: config.powersyncUrl,
        token: session.access_token,
        expiresAt: session.expires_at
          ? new Date(session.expires_at * 1000)
          : undefined,
      }
    },
    async uploadData(database: AbstractPowerSyncDatabase) {
      const session = await sessionOf()
      if (!session) throw new Error("Not signed in as this device's account")
      const transaction = await database.getNextCrudTransaction()
      if (!transaction) return
      const token = session.access_token
      const outcome: UploadOutcome = {
        refusals: [],
        settledRows: [],
        superseded: 0,
      }
      const refusedAt = new Date().toISOString()
      const refuse = (entry: Entry, reason: Refusal["reason"]) =>
        outcome.refusals.push({
          id: `refusal:${entry.clientId ?? `${entry.table}:${entry.id}`}`,
          tableName: serverTable(entry.table),
          rowId: entry.id,
          op: entry.op as Refusal["op"],
          data: (entry.opData as Record<string, unknown> | undefined) ?? null,
          reason,
          refusedAt,
        })
      const send = async (entries: Entry[]) => {
        try {
          return await uploadEntries(
            client,
            entries,
            token,
            link.columnsOf(serverTable(entries[0]!.table)),
          )
        } catch {
          throw new UploadPending(false)
        }
      }
      // What the server's answer to one change means.
      const settle = async (entry: Entry, result: Result) => {
        const tableName = serverTable(entry.table)
        if (result.error) {
          const failure = classifyUploadFailure(failureOf(result), tableName)
          if (failure.kind === "retry") throw new UploadPending(false)
          if (failure.kind === "outdated") {
            link.onOutdated(true)
            throw new UploadPending(true)
          }
          refuse(entry, failure.reason)
          return
        }
        const changed = (result.data ?? []).some(({ id }) => id === entry.id)
        if (entry.op !== UpdateType.PATCH)
          outcome.settledRows.push({ tableName, rowId: entry.id })
        if (changed) return
        if (entry.op === UpdateType.PUT) outcome.superseded += 1
        else if (await serverHasRow(client, entry, token))
          outcome.superseded += 1
        else if (entry.op === UpdateType.PATCH) refuse(entry, "missing")
      }
      // An edit goes as the whole row as it stands on the device now: on the
      // server it then replaces the row, or brings it back if an earlier
      // delete from another phone removed it, instead of merging single
      // columns or vanishing (B4 sync-chaos convergence). A row deleted on
      // the device since keeps its edit as queued; its delete follows.
      const crud: Entry[] = []
      for (const entry of transaction.crud as Entry[]) {
        if (entry.op !== UpdateType.PATCH) {
          crud.push(entry)
          continue
        }
        const now = await database.getOptional<Record<string, unknown>>(
          `SELECT * FROM "${serverTable(entry.table)}" WHERE id = ?`,
          [entry.id],
        )
        crud.push(
          now
            ? {
                ...entry,
                op: UpdateType.PUT,
                opData: { ...now, id: undefined },
              }
            : entry,
        )
      }
      for (const run of uploadRuns(crud)) {
        const result = await send(run)
        // A run is one statement: refused, none of it was written, so each
        // change goes alone; anything else is the run's own answer.
        if (
          run.length > 1 &&
          result.error &&
          classifyUploadFailure(failureOf(result), serverTable(run[0]!.table))
            .kind === "refused"
        ) {
          for (const entry of run) await settle(entry, await send([entry]))
        } else {
          for (const entry of run) await settle(entry, result)
        }
      }
      link.onOutdated(false)
      await link.recordOutcome(outcome)
      await transaction.complete()
    },
  }
}
