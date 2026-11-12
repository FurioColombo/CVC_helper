import { LAMMA_MAP } from "@/domain/windConfig"

export type LammaField = "wind10" | "swh"

/**
 * LaMMA's server gives a browser no way to read the run time (no CORS), so the
 * latest run is worked out from the clock: runs at 00 and 12 UTC, published
 * some hours later. A wrong guess costs at least twelve hours on the label, more
 * if a chain stalls, but never a wrong reading, because every map prints its own
 * valid time and the screen tells the reader to trust that.
 */
export function estimatedLammaRun(now: number) {
  const available = now - LAMMA_MAP.publishDelayHours * 3600
  const halfDay = 12 * 3600
  return Math.floor(available / halfDay) * halfDay
}

/** LaMMA's image number for hours after the run: hourly, then 3 h, then 6 h. */
export function lammaStepFromHours(hours: number) {
  if (hours <= LAMMA_MAP.hourlySteps) return Math.max(0, Math.round(hours)) + 1
  if (hours <= 84) return 61 + Math.round((hours - 60) / 3)
  return 69 + Math.round((Math.min(hours, LAMMA_MAP.maxStepHours) - 84) / 6)
}

export function lammaHoursFromStep(step: number) {
  if (step <= 61) return step - 1
  if (step <= 69) return 60 + (step - 61) * 3
  return 84 + (step - 69) * 6
}

export const LAMMA_LAST_STEP = lammaStepFromHours(LAMMA_MAP.maxStepHours)

/**
 * LaMMA overwrites the same address at every run, so the estimated run goes in
 * the query: a new run is a new picture, not yesterday's from the browser's cache.
 */
export function lammaMapUrl(field: LammaField, step: number, run: number) {
  return `${LAMMA_MAP.baseUrl}/${field}.${LAMMA_MAP.area}.${step}.png?run=${run}`
}
