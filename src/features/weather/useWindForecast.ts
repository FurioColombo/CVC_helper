import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { WindForecast } from "@/domain/wind"
import type { WindZoneId } from "@/domain/windConfig"
import {
  downloadWindForecast,
  readCachedForecast,
  writeCachedForecast,
} from "@/features/weather/windData"

/** How old a forecast may be before opening the app fetches a newer one. */
const REFRESH_AFTER_SECONDS = 45 * 60

export type WindDownloadState = "idle" | "loading" | "failed"

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

/**
 * `whenCached` is Home's mode: it refreshes a forecast the instructor has
 * already asked for, and contacts nobody until they first open Vento.
 */
export function useWindForecast(
  zone: WindZoneId,
  mode: "always" | "whenCached",
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
  const latestZone = useRef(zone)

  const forecast = downloaded?.zone === zone ? downloaded.forecast : cached
  const state = status?.zone === zone ? status.state : "idle"

  const download = useCallback(async () => {
    setStatus({ zone, state: "loading" })
    try {
      const next = await downloadWindForecast(zone)
      writeCachedForecast(zone, next)
      if (latestZone.current !== zone) return
      setDownloaded({ zone, forecast: next })
      setNow(nowSeconds())
      setStatus({ zone, state: "idle" })
    } catch {
      if (latestZone.current === zone) setStatus({ zone, state: "failed" })
    }
  }, [zone])

  const refreshIfDue = useCallback(() => {
    const stored = readCachedForecast(zone)
    if (mode === "whenCached" && !stored) return
    if (stored && nowSeconds() - stored.fetchedAt < REFRESH_AFTER_SECONDS)
      return
    void download()
  }, [download, mode, zone])

  useEffect(() => {
    latestZone.current = zone
    const timer = window.setTimeout(refreshIfDue, 0)
    // Signal back after a dead spot: fetch once if what is on screen has aged.
    window.addEventListener("online", refreshIfDue)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("online", refreshIfDue)
    }
  }, [refreshIfDue, zone])

  useEffect(() => {
    const tick = window.setInterval(() => setNow(nowSeconds()), 60_000)
    return () => window.clearInterval(tick)
  }, [])

  return { forecast, state, now, refresh: download }
}
