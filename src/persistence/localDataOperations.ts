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
  // The SDK's close first waits for its own startup, which never ends when the
  // engine fails to start (the 30 s worker deadline on phones, D4 review
  // SC-R3-I1): a reset resumed then would never delete anything. The app's
  // init settles with that failure, and an engine that never started holds no
  // connection, so the reset goes on to the deletion.
  const startupFailed = db.init().then(
    () => new Promise<void>(() => {}),
    () => undefined,
  )
  closing ??= Promise.race([db.close(), startupFailed])
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

// A reset survives the app being closed midway: the next open resumes it
// before using the course (owner phone check, 2026-10-19). The marker is
// outside the preferences the reset clears and goes once the course database
// is deleted: a cache that keeps failing to clear must not lock the app out
// for good (D4 reviews DI-R6-1, SP-R4-Q1); its retry stays on the screen.
function setResetPending(pending: boolean) {
  try {
    if (pending) localStorage.setItem(appChannelConfig.resetPendingKey, "1")
    else localStorage.removeItem(appChannelConfig.resetPendingKey)
  } catch {
    // Without storage the reset still runs; it just cannot resume.
  }
}

export function isResetPending() {
  try {
    return localStorage.getItem(appChannelConfig.resetPendingKey) !== null
  } catch {
    return false
  }
}

/** Permanently invalidate old callbacks before closing; retry is idempotent. */
export function resetAllLocalData() {
  if (resetting) return resetting
  setResetPending(true)
  notify("resetting")
  channel?.postMessage("reset")
  resetting = (async () => {
    await closeCourse()
    await deleteCourseDatabase()
    setResetPending(false)
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
