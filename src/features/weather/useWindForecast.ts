import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { WindForecast } from "@/domain/wind"
import type { WindZoneId } from "@/domain/windConfig"
import {
  cacheKey,
  downloadWindForecast,
  readCachedForecast,
  writeCachedForecast,
} from "@/features/weather/windData"

/** How old a forecast may be before reopening Vento fetches a newer one. */
const REFRESH_AFTER_SECONDS = 45 * 60
/** After a failed attempt nothing retries by itself for a while. */
const RETRY_AFTER_SECONDS = 5 * 60

export type WindDownloadState = "idle" | "loading" | "failed"

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

let lastFailureAt = 0

/**
 * `cacheOnly` is Home's mode: it shows the forecast last downloaded and contacts
 * nobody, ever. A signed-out app connects to nothing unprompted (plan, the
 * owner's rule), so the network belongs to the Vento screen. An open Vento also
 * refreshes by itself: on returning to it, when signal returns, after a reload.
 */
export function useWindForecast(
  zone: WindZoneId,
  mode: "network" | "cacheOnly",
) {
  const cached = useMemo(() => readCachedForecast(zone), [zone])
  const [downloaded, setDownloaded] = useState<{
    zone: WindZoneId
    forecast: WindForecast
  } | null>(null)
  const [status, setStatus] = useState<{
    zone: WindZoneId
    state: WindDownloadState
  } | null>(null)
  const [now, setNow] = useState(nowSeconds)
  const running = useRef<AbortController | null>(null)
  // Another tab removed this forecast: an erased course must not bring it back.
  const removedElsewhere = useRef(false)

  const forecast = downloaded?.zone === zone ? downloaded.forecast : cached
  const state = status?.zone === zone ? status.state : "idle"

  const download = useCallback(async () => {
    removedElsewhere.current = false
    running.current?.abort()
    const controller = new AbortController()
    running.current = controller
    const { signal } = controller
    setStatus({ zone, state: "loading" })
    try {
      const next = await downloadWindForecast(zone, {
        signal,
        previous: readCachedForecast(zone),
        onWind: (wind) => {
          if (signal.aborted) return
          // Kept at once: what was seen must survive leaving before the extras.
          writeCachedForecast(zone, wind)
          setDownloaded({ zone, forecast: wind })
          setNow(nowSeconds())
        },
      })
      // Aborted means the screen left, or a reset closed the course: nothing
      // may be written back after that.
      if (signal.aborted) return
      writeCachedForecast(zone, next)
      setDownloaded({ zone, forecast: next })
      setNow(nowSeconds())
      setStatus({ zone, state: "idle" })
    } catch {
      // Whoever aborted this run has already settled the status.
      if (signal.aborted) return
      lastFailureAt = nowSeconds()
      setStatus({ zone, state: "failed" })
    } finally {
      if (running.current === controller) running.current = null
    }
  }, [zone])

  useEffect(() => {
    if (mode === "cacheOnly") return undefined
    const refreshIfDue = () => {
      if (document.visibilityState === "hidden") return
      if (running.current || removedElsewhere.current) return
      const moment = nowSeconds()
      const stored = readCachedForecast(zone)
      if (moment - lastFailureAt < RETRY_AFTER_SECONDS) {
        // Reopened soon after a failure with nothing to show: say so, so that
        // the screen offers Riprova instead of staying empty.
        if (!stored) setStatus({ zone, state: "failed" })
        return
      }
      // A copy kept before its extras arrived is not fresh: it has no thunder.
      const age = stored ? moment - stored.fetchedAt : Infinity
      const whole = Boolean(stored?.sky && stored.ensemble)
      if (age < (whole ? REFRESH_AFTER_SECONDS : RETRY_AFTER_SECONDS)) return
      void download()
    }
    const onlineAgain = () => {
      lastFailureAt = 0
      refreshIfDue()
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== cacheKey(zone)) return
      if (event.newValue !== null) return
      removedElsewhere.current = true
      running.current?.abort()
      running.current = null
      setStatus({ zone, state: "idle" })
    }
    const timer = window.setTimeout(refreshIfDue, 0)
    window.addEventListener("storage", onStorage)
    // Signal back after a dead spot, or the phone picked up again hours later.
    window.addEventListener("online", onlineAgain)
    window.addEventListener("pageshow", refreshIfDue)
    document.addEventListener("visibilitychange", refreshIfDue)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("online", onlineAgain)
      window.removeEventListener("pageshow", refreshIfDue)
      document.removeEventListener("visibilitychange", refreshIfDue)
      running.current?.abort()
      running.current = null
      setStatus((current) =>
        current?.state === "loading" ? { ...current, state: "idle" } : current,
      )
    }
  }, [download, mode, zone])

  useEffect(() => {
    // A phone picked up in the morning must not show last night's session.
    const update = () => setNow(nowSeconds())
    const tick = window.setInterval(update, 60_000)
    window.addEventListener("pageshow", update)
    document.addEventListener("visibilitychange", update)
    return () => {
      window.clearInterval(tick)
      window.removeEventListener("pageshow", update)
      document.removeEventListener("visibilitychange", update)
    }
  }, [])

  return { forecast, state, now, refresh: download }
}
