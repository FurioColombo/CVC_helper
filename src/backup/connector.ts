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
 * B4: consecutive inserts into one table go in one request (the switch
 * queues the whole course as one transaction, B1 review SC-B1-Q3). A failure
 * is classified (src/backup/uploadPolicy.ts): a transient one leaves the
 * transaction queued for PowerSync to retry; an app below the server's
 * minimum writer stops uploading until updated; a refusal is kept on the
 * device with its data and reported, and the rest of the queue goes on.
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
}
type Result = {
  error: (UploadFailure & { message?: string }) | null
  status?: number
}

/**
 * Writes one queued change, or a run of inserts into one table, with
 * `token`, the access token its transaction started with: a sign-in of
 * another account while the upload runs cannot lend it its own (B3 review
 * SP-B3-9). Returns the server's answer; it throws only when no answer came.
 */
export async function uploadEntries(
  client: Client,
  entries: Entry[],
  token: string,
): Promise<Result> {
  const [first] = entries
  if (!first) return { error: null }
  const table = client.from(serverTable(first.table))
  const authorization = `Bearer ${token}`
  if (first.op === UpdateType.PUT)
    return table
      .upsert(entries.map((entry) => ({ ...entry.opData, id: entry.id })))
      .setHeader("Authorization", authorization)
  if (first.op === UpdateType.PATCH)
    return table
      .update(first.opData ?? {})
      .setHeader("Authorization", authorization)
      .eq("id", first.id)
  return table
    .delete()
    .setHeader("Authorization", authorization)
    .eq("id", first.id)
}

/** The queue's entries in runs: consecutive inserts into one table together. */
export function uploadRuns<T extends Entry>(crud: T[]): T[][] {
  const runs: T[][] = []
  for (const entry of crud) {
    const last = runs.at(-1)
    if (
      last &&
      entry.op === UpdateType.PUT &&
      last[0]!.op === UpdateType.PUT &&
      last[0]!.table === entry.table &&
      last.length < BATCH_ROWS
    )
      last.push(entry)
    else runs.push([entry])
  }
  return runs
}

/** A refused change, as the device keeps it (src/persistence/backupLink.ts). */
export type Refusal = {
  id: string
  tableName: string
  rowId: string
  op: "PUT" | "PATCH" | "DELETE"
  data: Record<string, unknown> | null
  reason: RefusalReason
  refusedAt: string
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

export type UploadReports = {
  /** Keeps the refusals; the transaction completes after it. */
  recordRefusals: (refusals: Refusal[]) => Promise<void>
  /** The server asks for a newer app (true) or accepted one again (false). */
  onOutdated: (outdated: boolean) => void
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
  reports: UploadReports,
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
      const refusals: Refusal[] = []
      const refusedAt = new Date().toISOString()
      const send = async (entries: Entry[]) => {
        let result: Result
        try {
          result = await uploadEntries(client, entries, session.access_token)
        } catch {
          throw new UploadPending(false)
        }
        return result
      }
      // One change at a time, once its run failed: which one did?
      const settle = async (entry: Entry, result: Result) => {
        if (!result.error) return
        const table = serverTable(entry.table)
        const outcome = classifyUploadFailure(failureOf(result), table)
        if (outcome.kind === "retry") throw new UploadPending(false)
        if (outcome.kind === "outdated") {
          reports.onOutdated(true)
          throw new UploadPending(true)
        }
        refusals.push({
          id: `refusal:${entry.clientId ?? `${entry.table}:${entry.id}`}`,
          tableName: table,
          rowId: entry.id,
          op: entry.op as Refusal["op"],
          data: (entry.opData as Record<string, unknown> | undefined) ?? null,
          reason: outcome.reason,
          refusedAt,
        })
      }
      for (const run of uploadRuns(transaction.crud)) {
        const result = await send(run)
        if (!result.error) continue
        // A run is one statement: refused, none of it was written, so each
        // change goes alone; anything else is the run's own answer.
        const refused =
          run.length > 1 &&
          classifyUploadFailure(failureOf(result), serverTable(run[0]!.table))
            .kind === "refused"
        if (!refused) await settle(run[0]!, result)
        else for (const entry of run) await settle(entry, await send([entry]))
      }
      reports.onOutdated(false)
      await reports.recordRefusals(refusals)
      await transaction.complete()
    },
  }
}
