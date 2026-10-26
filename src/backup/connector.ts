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

export async function uploadEntry(
  client: Client,
  entry: Pick<CrudEntry, "op" | "table" | "id" | "opData">,
) {
  const table = client.from(serverTable(entry.table))
  const result =
    entry.op === UpdateType.PUT
      ? await table.upsert({ ...entry.opData, id: entry.id })
      : entry.op === UpdateType.PATCH
        ? await table.update(entry.opData ?? {}).eq("id", entry.id)
        : await table.delete().eq("id", entry.id)
  if (result.error) throw result.error
}

export function createConnector(
  client: Client,
  config: BackupConfig,
): PowerSyncBackendConnector {
  return {
    async fetchCredentials(): Promise<PowerSyncCredentials | null> {
      const {
        data: { session },
        error,
      } = await client.auth.getSession()
      if (error) throw error
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
      const transaction = await database.getNextCrudTransaction()
      if (!transaction) return
      for (const entry of transaction.crud) await uploadEntry(client, entry)
      await transaction.complete()
    },
  }
}
