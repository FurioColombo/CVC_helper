import type {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from "@powersync/web"
import { UpdateType } from "@powersync/web"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { BackupConfig } from "@/backup/config"

/**
 * B3: how PowerSync reaches the owner's backup. Credentials are the signed-in
 * Supabase session, fresh at every request (the powersync skill: never a
 * cached token). Uploads write each queued change through that session to
 * the server table of the same name without its `synced_` prefix
 * (src/persistence/syncMode.ts), in queue order, which keeps parents first
 * (B1 review SC-B1-Q4). Any error leaves the transaction queued, so PowerSync
 * retries it; B4 adds per-change refusal handling and the app version.
 */
export const SYNCED_PREFIX = "synced_"

export function serverTable(type: string) {
  if (!type.startsWith(SYNCED_PREFIX))
    throw new Error(`Not a synced table: ${type}`)
  return type.slice(SYNCED_PREFIX.length)
}

type Client = Pick<SupabaseClient, "auth" | "from">

/**
 * Writes one queued change with `token`, the access token its transaction
 * started with: a sign-in of another account while the upload runs cannot
 * lend it its own (B3 review SP-B3-9).
 */
export async function uploadEntry(
  client: Client,
  entry: Pick<CrudEntry, "op" | "table" | "id" | "opData">,
  token: string,
) {
  const table = client.from(serverTable(entry.table))
  const authorization = `Bearer ${token}`
  const result =
    entry.op === UpdateType.PUT
      ? await table
          .upsert({ ...entry.opData, id: entry.id })
          .setHeader("Authorization", authorization)
      : entry.op === UpdateType.PATCH
        ? await table
            .update(entry.opData ?? {})
            .setHeader("Authorization", authorization)
            .eq("id", entry.id)
        : await table
            .delete()
            .setHeader("Authorization", authorization)
            .eq("id", entry.id)
  if (result.error) throw result.error
}

/**
 * The connector belongs to the account that opened it: once another account
 * is signed in, it neither fetches a token nor uploads, even if it outlives
 * a sign-out (B3 reviews SP-B3-1, FUX-B3-1).
 */
export function createConnector(
  client: Client,
  config: BackupConfig,
  account: string,
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
      for (const entry of transaction.crud)
        await uploadEntry(client, entry, session.access_token)
      await transaction.complete()
    },
  }
}
