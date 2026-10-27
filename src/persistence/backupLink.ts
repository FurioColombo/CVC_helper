import type { PowerSyncBackendConnector } from "@powersync/web"

import { db } from "@/persistence/db"
import { expectsSyncedTables } from "@/persistence/openedSchema"
import { courseLeftThisDevice, prepareDatabase } from "@/persistence/migrations"
import {
  accountMark,
  AWAITING_ACCOUNT_COURSE_ID,
  BACKUP_ACCOUNT_ID,
  readAccountMark,
  readSyncMode,
  switchToSyncedTables,
} from "@/persistence/syncMode"
import { APP_VERSION } from "@/appVersion"
import { newer, parseVersion } from "@/domain/compatibility"
import { readDataVersion, writeDataVersion } from "@/persistence/dataVersion"
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

/** Whether this tab reads the synced tables, not only the device's data. */
export function openedWithSyncedTables() {
  return expectsSyncedTables(db)
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

/**
 * B5: a restored course takes the server's minimum writer
 * (supabase/migrations/20261027000000_minimum_writer_read.sql). The data
 * version only ever rises: an app older than the minimum then opens the
 * course read-only and asks for the update (03 §3.1). Returns whether it
 * rose.
 */
export async function adoptMinimumWriter(versionText: string) {
  const minimum = parseVersion(versionText)
  return db.writeTransaction(async (transaction) => {
    const stored = await readDataVersion(transaction)
    const next = {
      version: newer(stored?.version ?? minimum, minimum),
      minimumWriter: newer(stored?.minimumWriter ?? minimum, minimum),
    }
    if (
      stored &&
      next.version === stored.version &&
      next.minimumWriter === stored.minimumWriter
    )
      return false
    await writeDataVersion(transaction, next)
    return true
  })
}

/**
 * B5: whether this device switched without a course and still awaits the
 * account's: no course is created or imported here meanwhile.
 */
export async function awaitingAccountCourse() {
  await prepareDatabase(db)
  const rows = await db.getAll("SELECT 1 FROM meta WHERE id = ?", [
    AWAITING_ACCOUNT_COURSE_ID,
  ])
  return rows.length > 0
}

/** The account's course is here, or the account was found to have none. */
export async function stopAwaitingAccountCourse() {
  if (!(await awaitingAccountCourse())) return
  await db.writeTransaction((transaction) =>
    transaction.execute("DELETE FROM meta WHERE id = ?", [
      AWAITING_ACCOUNT_COURSE_ID,
    ]),
  )
}

/** Resolves once the device holds a complete download of the backup. */
export function firstSync() {
  return db.waitForFirstSync()
}

export function connectDatabase(connector: PowerSyncBackendConnector) {
  return db.connect(connector)
}

export function disconnectDatabase() {
  return db.disconnect()
}

export {
  awaitingServerErase,
  forgetServerErasures,
  keepForLater,
  pendingServerErasures,
  type ServerErasures,
} from "@/persistence/serverErasures"

export {
  courseTableColumns,
  discardUploadRefusals,
  forgetSupersededEdits,
  recordUploadOutcome,
  retryUploadRefusals,
  supersededEdits,
  type UploadRefusal,
  uploadRefusals,
} from "@/persistence/uploadRefusals"

/** Changes still waiting in the upload queue. */
export async function pendingUploads() {
  const [row] = await db.getAll<{ n: number }>(
    "SELECT count(*) AS n FROM ps_crud",
  )
  return row?.n ?? 0
}

/**
 * B6: the course erased on another phone left this one with the backup's
 * download; the app then reopens without it (src/App.tsx). A course whose
 * own row the backup refused is not that: it stays for Riprova.
 */
export async function courseLeftWithBackup() {
  await prepareDatabase(db)
  return courseLeftThisDevice(db)
}

export function databaseConnected() {
  return db.currentStatus.connected
}

/** Calls `listener` when the sync status changes; returns a stop. */
export function onDatabaseStatus(listener: () => void) {
  return db.registerListener({ statusChanged: listener })
}
