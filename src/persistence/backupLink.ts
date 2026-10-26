import type { PowerSyncBackendConnector } from "@powersync/web"

import { db } from "@/persistence/db"
import { prepareDatabase } from "@/persistence/migrations"
import { readSyncMode, switchToSyncedTables } from "@/persistence/syncMode"
import { appChannelConfig } from "@/runtimeConfig"

/**
 * B3: what the online backup (src/backup/) needs from the app's database,
 * kept here so only persistence modules open it
 * (src/persistence/writeStatements.test.ts).
 */
export async function deviceSyncMode() {
  await prepareDatabase(db)
  return readSyncMode(db)
}

export async function deviceCourseId() {
  await prepareDatabase(db)
  const course = await db.getOptional<{ id: string }>(
    "SELECT id FROM courses WHERE active = 1 LIMIT 1",
  )
  return course?.id ?? null
}

/** Moves this device to synced tables (B1); the app then reopens. */
export async function switchDeviceToSyncedTables() {
  await prepareDatabase(db)
  return switchToSyncedTables(db, appChannelConfig.syncModeKey)
}

export function connectDatabase(connector: PowerSyncBackendConnector) {
  return db.connect(connector)
}

export function disconnectDatabase() {
  return db.disconnect()
}

/** Changes still waiting in the upload queue. */
export async function pendingUploads() {
  const [row] = await db.getAll<{ n: number }>(
    "SELECT count(*) AS n FROM ps_crud",
  )
  return row?.n ?? 0
}

export function databaseConnected() {
  return db.currentStatus.connected
}

/** Calls `listener` when the sync status changes; returns a stop. */
export function onDatabaseStatus(listener: () => void) {
  return db.registerListener({ statusChanged: listener })
}
