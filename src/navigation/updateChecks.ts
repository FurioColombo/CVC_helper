/**
 * D3: an installed app finds a new version when it comes back to the
 * foreground and, while it stays open, once an hour; before D3 it looked only
 * at start, so a phone that kept the app open for days never heard of one.
 * The service worker installs what it finds and `useRegisterSW` reports it as
 * waiting (src/main.tsx), which shows the offer. Nothing here reloads the app.
 */

export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
/** Several quick returns to the app make one check, not several. */
export const UPDATE_CHECK_MIN_GAP_MS = 30 * 1000

export type UpdateCheck = "offered" | "none" | "offline" | "failed"

type Registration = Pick<
  ServiceWorkerRegistration,
  "update" | "installing" | "waiting"
>

/** One check: whether a new version is now installing or waiting. */
export async function checkForUpdate(
  registration: Registration | undefined,
  online = () => navigator.onLine,
): Promise<UpdateCheck> {
  if (!registration) return "failed"
  if (!online()) return "offline"
  try {
    await registration.update()
  } catch {
    return online() ? "failed" : "offline"
  }
  return registration.installing || registration.waiting ? "offered" : "none"
}

/** Checks on every return to the foreground and periodically; returns a stop. */
export function watchForUpdates(
  registration: Registration,
  {
    intervalMs = UPDATE_CHECK_INTERVAL_MS,
    minGapMs = UPDATE_CHECK_MIN_GAP_MS,
    now = () => Date.now(),
    online = () => navigator.onLine,
    page = document,
  }: {
    intervalMs?: number
    minGapMs?: number
    now?: () => number
    online?: () => boolean
    page?: Pick<
      Document,
      "visibilityState" | "addEventListener" | "removeEventListener"
    >
  } = {},
) {
  let lastCheck = now()
  const check = () => {
    if (now() - lastCheck < minGapMs) return
    lastCheck = now()
    void checkForUpdate(registration, online)
  }
  const onVisibility = () => {
    if (page.visibilityState === "visible") check()
  }
  page.addEventListener("visibilitychange", onVisibility)
  const timer = setInterval(check, intervalMs)
  return () => {
    page.removeEventListener("visibilitychange", onVisibility)
    clearInterval(timer)
  }
}
