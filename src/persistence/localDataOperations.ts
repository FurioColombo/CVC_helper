import { appChannelConfig } from "@/runtimeConfig"
import { clearAppBrowserStorage } from "@/persistence/browserStorage"
import { db } from "@/persistence/db"
import {
  invalidateCourseSession,
  onCourseReplaced,
} from "@/persistence/courseSession"

export type LocalDataState =
  "changed" | "resetting" | "blocked" | "reset-failed" | "reset-complete"
const listeners = new Set<(state: LocalDataState) => void>()
let channel: BroadcastChannel | undefined
let state: LocalDataState | undefined
let closing: Promise<void> | undefined
let resetting: Promise<void> | undefined

function notify(next: LocalDataState) {
  state = next
  for (const listener of listeners) listener(next)
}

function closeCourse() {
  invalidateCourseSession(db)
  closing ??= db.close()
  closing.catch(() => {
    closing = undefined
  })
  return closing
}

/** One channel per app namespace, even on a shared GitHub Pages hostname. */
export function watchLocalData(listener: (state: LocalDataState) => void) {
  listeners.add(listener)
  if (state) listener(state)
  const stop = onCourseReplaced((database) => {
    if (database === db && !state) notify("changed")
  })
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(
      `cvc-local-data:${appChannelConfig.databaseFilename}`,
    )
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === "reset") {
        notify("resetting")
        void closeCourse().catch(() => notify("reset-failed"))
      } else if (event.data === "reset-complete") {
        notify("reset-complete")
      } else if (event.data === "changed") {
        notify("changed")
        void closeCourse().catch(() => {})
      }
    }
  }
  return () => {
    listeners.delete(listener)
    stop()
    if (listeners.size === 0) {
      channel?.close()
      channel = undefined
    }
  }
}

export function announceCourseReplacement() {
  channel?.postMessage("changed")
}

function deleteCourseDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(appChannelConfig.databaseFilename)
    request.onsuccess = () => resolve()
    request.onerror = () =>
      reject(new Error("Impossibile eliminare l’archivio locale."))
    // A legacy/unresponsive tab can still own the file. Never claim success
    // until IndexedDB confirms deletion; closing that tab lets this finish.
    request.onblocked = () => notify("blocked")
  })
}

/** Permanently invalidate old callbacks before closing; retry is idempotent. */
export function resetAllLocalData() {
  if (resetting) return resetting
  notify("resetting")
  channel?.postMessage("reset")
  resetting = (async () => {
    await closeCourse()
    await deleteCourseDatabase()
    await clearAppBrowserStorage()
    notify("reset-complete")
    channel?.postMessage("reset-complete")
  })()
    .catch(() => {
      notify("reset-failed")
    })
    .finally(() => {
      resetting = undefined
    })
  return resetting
}
