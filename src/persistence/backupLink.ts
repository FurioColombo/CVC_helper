import type { PowerSyncBackendConnector } from "@powersync/web"

import { db } from "@/persistence/db"
import { prepareDatabase } from "@/persistence/migrations"
import {
  accountMark,
  BACKUP_ACCOUNT_ID,
  readAccountMark,
  readSyncMode,
  switchToSyncedTables,
} from "@/persistence/syncMode"
import { APP_VERSION } from "@/appVersion"
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

/**
 * Moves this device to synced tables (B1) for `account`, which it then
 * belongs to; the app reopens.
 */
export async function switchDeviceToSyncedTables(account: string) {
  await prepareDatabase(db)
  return switchToSyncedTables(
    db,
    appChannelConfig.syncModeKey,
    APP_VERSION,
    account,
  )
}

/**
 * Whether `account` may connect this synced device: the account it belongs
 * to, or any account when none is recorded yet (then it becomes that one).
 */
export async function claimDeviceForAccount(account: string) {
  await prepareDatabase(db)
  const mark = accountMark(account)
  const recorded = await readAccountMark(db)
  if (recorded !== null) return recorded === mark
  await db.execute("INSERT OR REPLACE INTO meta(id, value) VALUES (?, ?)", [
    BACKUP_ACCOUNT_ID,
    mark,
  ])
  return true
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
