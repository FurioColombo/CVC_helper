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

/**
 * `offered`: a new version is installed and waiting, ready to apply;
 * `downloading`: one is still installing, and may yet fail (a dropped
 * connection), so it is not called ready (D3 review RH-Q7).
 */
export type UpdateCheck =
  "offered" | "downloading" | "none" | "offline" | "failed"

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
  if (registration.waiting) return "offered"
  return registration.installing ? "downloading" : "none"
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
  let deferred: ReturnType<typeof setTimeout> | undefined
  const run = () => {
    deferred = undefined
    lastCheck = now()
    void checkForUpdate(registration, online)
  }
  // A return within the gap is not dropped but checked when the gap ends, so
  // a deploy that landed just after a check still shows within the minute
  // (D3 review RH-Q6).
  const check = () => {
    const wait = minGapMs - (now() - lastCheck)
    if (wait <= 0) run()
    else deferred ??= setTimeout(run, wait)
  }
  const onVisibility = () => {
    if (page.visibilityState === "visible") check()
  }
  page.addEventListener("visibilitychange", onVisibility)
  const timer = setInterval(check, intervalMs)
  return () => {
    page.removeEventListener("visibilitychange", onVisibility)
    clearInterval(timer)
    clearTimeout(deferred)
  }
}
