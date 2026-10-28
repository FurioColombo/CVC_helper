import type {
  PowerSyncBackendConnector,
  PowerSyncDatabase,
} from "@powersync/web"

/**
 * The backup starts its connection without waiting for it: the SDK's connect
 * waits on its first request, and one hung on a dead connection would hold
 * the backup (owner check B4-PHONE-UPLOADS, 2026-10-28). A connect still on
 * its way when a disconnect is asked (Esci, an erase) would land after it and
 * upload for an account no longer signed in, so every disconnect waits for it,
 * bounded, and disconnects again.
 */
let pending: Promise<unknown> | null = null

/** How long a disconnect waits for a connect still on its way. */
const PENDING_CONNECT_WAIT_MS = 10_000

export function connectSync(
  database: PowerSyncDatabase,
  connector: PowerSyncBackendConnector,
) {
  const connecting = database.connect(connector)
  pending = connecting
  void connecting
    .catch(() => {})
    .finally(() => {
      if (pending === connecting) pending = null
    })
  return connecting
}

export async function disconnectSync(database: PowerSyncDatabase) {
  const connecting = pending
  await database.disconnect()
  if (!connecting) return
  await Promise.race([
    connecting.catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, PENDING_CONNECT_WAIT_MS)),
  ])
  await database.disconnect()
}
