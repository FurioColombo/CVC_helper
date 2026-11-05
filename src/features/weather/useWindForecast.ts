import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { WindForecast } from "@/domain/wind"
import type { WindZoneId } from "@/domain/windConfig"
import {
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
 * owner's rule), so the network belongs to the Vento screen, which a tap opens.
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

  const forecast = downloaded?.zone === zone ? downloaded.forecast : cached
  const state = status?.zone === zone ? status.state : "idle"

  const download = useCallback(async () => {
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
      if (signal.aborted) {
        setStatus((current) =>
          current?.zone === zone ? { zone, state: "idle" } : current,
        )
        return
      }
      lastFailureAt = nowSeconds()
      setStatus({ zone, state: "failed" })
    }
  }, [zone])

  useEffect(() => {
    if (mode === "cacheOnly") return undefined
    const refreshIfDue = () => {
      setNow(nowSeconds())
      if (document.visibilityState === "hidden") return
      const moment = nowSeconds()
      const stored = readCachedForecast(zone)
      if (moment - lastFailureAt < RETRY_AFTER_SECONDS) {
        // Reopened soon after a failure with nothing to show: say so, so that
        // the screen offers Riprova instead of staying empty.
        if (!stored) setStatus({ zone, state: "failed" })
        return
      }
      if (stored && moment - stored.fetchedAt < REFRESH_AFTER_SECONDS) return
      void download()
    }
    const onlineAgain = () => {
      lastFailureAt = 0
      refreshIfDue()
    }
    const timer = window.setTimeout(refreshIfDue, 0)
    // Signal back after a dead spot, or the phone picked up again hours later.
    window.addEventListener("online", onlineAgain)
    window.addEventListener("pageshow", refreshIfDue)
    document.addEventListener("visibilitychange", refreshIfDue)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("online", onlineAgain)
      window.removeEventListener("pageshow", refreshIfDue)
      document.removeEventListener("visibilitychange", refreshIfDue)
      running.current?.abort()
    }
  }, [download, mode, zone])

  useEffect(() => {
    const tick = window.setInterval(() => setNow(nowSeconds()), 60_000)
    return () => window.clearInterval(tick)
  }, [])

  return { forecast, state, now, refresh: download }
}
