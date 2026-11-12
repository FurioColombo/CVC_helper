import {
  SESSION_SEQUENCE,
  sessionDayOffset,
  type SessionId,
} from "@/domain/config"
import {
  BEAUFORT_MIN_KNOTS,
  ENSEMBLE_WEIGHTS,
  ENSEMBLE_WIDENING_HOURS,
  GUST_RULE,
  LEAD_ANCHOR_HOURS,
  MODEL_END_TAPER_HOURS,
  RANGE_HALF_WIDTH,
  SEASONAL_AFTER_HOURS,
  SPLIT_RULES,
  TENDENCY_AFTER_HOURS,
  WEATHER_KINDS,
  type WeatherKindId,
  WIND_MODELS,
  WIND_NAMES,
  WIND_SESSION_HOURS,
  type WindModelId,
} from "@/domain/windConfig"

/** One model at one sea point, hour by hour; null where it has no value. */
export type ModelSeries = {
  speed: readonly (number | null)[]
  direction: readonly (number | null)[]
  gust: readonly (number | null)[]
}

/** What a forecast download holds once parsed. Times are Unix seconds. */
export type WindForecast = {
  fetchedAt: number
  times: readonly number[]
  /** point id → model id → series */
  points: Readonly<Record<string, Partial<Record<WindModelId, ModelSeries>>>>
  /** ECMWF's ensemble at the zone's centre, as quantiles of its 51 members. */
  ensemble?: {
    low: readonly (number | null)[]
    mid: readonly (number | null)[]
    high: readonly (number | null)[]
  }
  /** fetchedAt on the extras: a copy can carry one older than its wind. */
  waves?: { height: readonly (number | null)[]; fetchedAt?: number }
  /** At the zone's centre, from the provider's best model for the place. */
  sky?: {
    code: readonly (number | null)[]
    /** Air at 2 m, °C; over a sea cell, so cooler by day than on land. */
    temperature?: readonly (number | null)[]
    fetchedAt?: number
  }
}

export type ModelContribution = {
  model: WindModelId | "ensemble"
  /** Its share of the speed blend, the ensemble counted. */
  weight: number
  speed: number
  direction: number | null
}

export type BlendedHour = {
  time: number
  /** Hours ahead when the forecast was downloaded, not from the clock now. */
  lead: number
  low: number
  mid: number
  high: number
  /** How far the models themselves are apart: the 20-80 band's width. */
  modelSpread: number
  gust: number | null
  /** null when the wind is too light or too spread to have one direction. */
  direction: number | null
  directionSpread: number
  models: ModelContribution[]
  waveHeight: number | null
  /** null: the sky was not downloaded, which is not the same as no thunder. */
  thunder: boolean | null
  weather: WeatherKindId | null
  temperature: number | null
}

type Sample = { value: number; weight: number }

/** Weighted quantile, interpolated between each sample's centre of mass. */
export function weightedQuantile(samples: readonly Sample[], q: number) {
  const sorted = samples
    .filter((sample) => sample.weight > 0)
    .sort((a, b) => a.value - b.value)
  if (sorted.length === 0) return null
  const total = sorted.reduce((sum, sample) => sum + sample.weight, 0)
  let cumulative = 0
  const positions = sorted.map((sample) => {
    const position = (cumulative + sample.weight / 2) / total
    cumulative += sample.weight
    return position
  })
  let previous = { position: 0, value: 0 }
  for (const [index, sample] of sorted.entries()) {
    const position = positions[index] ?? 1
    if (q <= position) {
      if (index === 0) return sample.value
      const span = position - previous.position
      const part = span === 0 ? 0 : (q - previous.position) / span
      return previous.value + part * (sample.value - previous.value)
    }
    previous = { position, value: sample.value }
  }
  return previous.value
}

/**
 * Directions are angles: 350° and 10° average to 0°, not 180°. Returns the
 * mean and its spread in degrees (the circular standard deviation).
 */
export function circularMean(samples: readonly Sample[]) {
  let x = 0
  let y = 0
  let total = 0
  for (const { value, weight } of samples) {
    const radians = (value * Math.PI) / 180
    x += Math.cos(radians) * weight
    y += Math.sin(radians) * weight
    total += weight
  }
  if (total <= 0) return null
  const resultant = Math.min(1, Math.hypot(x, y) / total)
  const mean = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  const spread =
    resultant <= 0
      ? 180
      : (Math.sqrt(-2 * Math.log(Math.max(resultant, 1e-6))) * 180) / Math.PI
  return { mean, spread: Math.min(180, spread) }
}

/** A weight at a lead time: a straight line between the two nearest anchors. */
export function weightAtLead(
  weights: readonly number[],
  leadHours: number,
): number {
  const anchors = LEAD_ANCHOR_HOURS
  const next = anchors.findIndex((anchor) => leadHours <= anchor)
  if (next === 0) return weights[0] ?? 0
  if (next === -1) return weights[anchors.length - 1] ?? 0
  const from = anchors[next - 1] ?? 0
  const to = anchors[next] ?? 0
  const part = (leadHours - from) / (to - from)
  const start = weights[next - 1] ?? 0
  return start + part * ((weights[next] ?? 0) - start)
}

export type WindSplit = "speed" | "direction"

/** Whether the models disagree enough to say so, and over what. */
export function splitOf(
  modelSpread: number,
  mid: number,
  directionSpread: number,
): WindSplit | null {
  const { minKnots, ratio, direction, directionMatters } = SPLIT_RULES
  if (mid >= directionMatters && directionSpread > direction) return "direction"
  if (modelSpread > Math.max(minKnots, ratio * mid)) return "speed"
  return null
}

function lastValueIndexes(forecast: WindForecast) {
  const last = new Map<WindModelId, number>()
  for (const point of Object.values(forecast.points)) {
    for (const [id, series] of Object.entries(point)) {
      const model = id as WindModelId
      for (let index = series.speed.length - 1; index >= 0; index -= 1) {
        if (series.speed[index] !== null) {
          last.set(model, Math.max(last.get(model) ?? 0, index))
          break
        }
      }
    }
  }
  return last
}

export function weatherKindOf(code: number | null): WeatherKindId | null {
  if (code === null) return null
  return (
    WEATHER_KINDS.find((kind) =>
      (kind.codes as readonly number[]).includes(code),
    )?.id ?? null
  )
}

const WEATHER_ORDER: readonly WeatherKindId[] = WEATHER_KINDS.map(
  (kind) => kind.id,
)

/**
 * The worst rain, fog or storm of the hours; failing that, their most frequent
 * cloud, the cloudier on a tie. null when no hour has a sky.
 */
export function weatherOfHours(
  hours: readonly { weather: WeatherKindId | null }[],
): WeatherKindId | null {
  const known = hours.flatMap((hour) =>
    hour.weather === null ? [] : [hour.weather],
  )
  const first = known[0]
  if (first === undefined) return null
  const rank = (id: WeatherKindId) => WEATHER_ORDER.indexOf(id)
  const wet = known.filter(
    (id) => WEATHER_KINDS.find((kind) => kind.id === id)?.wet,
  )
  if (wet.length > 0) {
    return wet.reduce((worst, id) => (rank(id) > rank(worst) ? id : worst))
  }
  const counts = new Map<WeatherKindId, number>()
  for (const id of known) counts.set(id, (counts.get(id) ?? 0) + 1)
  let best: WeatherKindId = first
  for (const [id, count] of counts) {
    const bestCount = counts.get(best) ?? 0
    if (count > bestCount || (count === bestCount && rank(id) > rank(best))) {
      best = id
    }
  }
  return best
}

function thunderAt(forecast: WindForecast, index: number) {
  const code = forecast.sky?.code[index]
  if (code === null || code === undefined) return null
  return code >= 95
}

/**
 * The blend. Each model weighs by how it scored at this lead time (windConfig);
 * a high-resolution run fades over its last hours so the central value does
 * not jump when it ends. The central value is a weighted median, so one model
 * far from the others moves it little and shows up in the band instead.
 *
 * Each model counts once however many points were asked for, so the band holds
 * what the models disagree over, not how much the places differ.
 *
 * Speed and direction blend separately: averaging wind vectors would shrink
 * the speed exactly when models disagree on the direction.
 */
/**
 * The highest gust, with a run in its last hours fading towards the others', so
 * the second number on the screen does not jump when that run ends.
 */
function fadedHighest(gusts: readonly { value: number; taper: number }[]) {
  const steady = gusts.filter(({ taper }) => taper >= 1)
  if (steady.length === 0) return Math.max(...gusts.map(({ value }) => value))
  const top = Math.max(...steady.map(({ value }) => value))
  return Math.max(
    top,
    ...gusts.map(({ value, taper }) => top + taper * (value - top)),
  )
}

export function blendForecast(
  forecast: WindForecast,
  now: number,
  pointIds?: readonly string[],
): BlendedHour[] {
  const ids = pointIds ?? Object.keys(forecast.points)
  const last = lastValueIndexes(forecast)
  const hours: BlendedHour[] = []

  forecast.times.forEach((time, index) => {
    if (time <= now - 3600) return
    const lead = Math.max(0, (time - forecast.fetchedAt) / 3600)
    const gusts: { value: number; taper: number }[] = []
    const perModel = new Map<
      WindModelId,
      { weight: number; speed: number; direction: Sample[] }
    >()

    for (const id of ids) {
      const point = forecast.points[id]
      if (!point) continue
      for (const model of WIND_MODELS) {
        const series = point[model.id]
        const speed = series?.speed[index]
        if (speed === null || speed === undefined) continue
        const hoursLeft = (last.get(model.id) ?? index) - index
        const taper = Math.min(1, (hoursLeft + 1) / MODEL_END_TAPER_HOURS)
        const weight = (weightAtLead(model.weights, lead) * taper) / ids.length
        if (weight <= 0) continue
        const entry = perModel.get(model.id) ?? {
          weight: 0,
          speed: 0,
          direction: [],
        }
        entry.weight += weight
        entry.speed += speed * weight
        const direction = series?.direction[index]
        if (direction !== null && direction !== undefined) {
          entry.direction.push({ value: direction, weight })
        }
        const gust = series?.gust[index]
        if (gust !== null && gust !== undefined) {
          gusts.push({ value: gust, taper })
        }
        perModel.set(model.id, entry)
      }
    }

    const speeds: Sample[] = [...perModel.values()].map((entry) => ({
      value: entry.speed / entry.weight,
      weight: entry.weight,
    }))
    // The ensemble's median carries no direction; it steers the long range,
    // where single runs are mostly chance.
    const ensembleMid = forecast.ensemble?.mid[index] ?? null
    const ensembleWeight = weightAtLead(ENSEMBLE_WEIGHTS, lead)
    const ensembleCounts = ensembleMid !== null && ensembleWeight > 0
    if (ensembleCounts) {
      speeds.push({ value: ensembleMid, weight: ensembleWeight })
    }
    if (speeds.length === 0) return

    const bandLow = weightedQuantile(speeds, 0.2) ?? 0
    const mid = weightedQuantile(speeds, 0.5) ?? 0
    const bandHigh = weightedQuantile(speeds, 0.8) ?? 0
    const widening = Math.min(
      1,
      Math.max(
        0,
        (lead - ENSEMBLE_WIDENING_HOURS.from) /
          (ENSEMBLE_WIDENING_HOURS.to - ENSEMBLE_WIDENING_HOURS.from),
      ),
    )
    const ensembleLow = forecast.ensemble?.low[index] ?? bandLow
    const ensembleHigh = forecast.ensemble?.high[index] ?? bandHigh
    const widerLow =
      bandLow + widening * (Math.min(bandLow, ensembleLow) - bandLow)
    const widerHigh =
      bandHigh + widening * (Math.max(bandHigh, ensembleHigh) - bandHigh)

    // Each model counts once here too, or places apart would read as models apart.
    const circular = circularMean(
      [...perModel.values()].flatMap((entry) => {
        const own = circularMean(entry.direction)
        return own ? [{ value: own.mean, weight: entry.weight }] : []
      }),
    )
    const directionSpread = circular?.spread ?? 180
    const halfWidth = Math.max(
      RANGE_HALF_WIDTH.minKnots,
      RANGE_HALF_WIDTH.ofExpected * mid,
    )
    const variable =
      !circular ||
      mid < SPLIT_RULES.variableBelowKnots ||
      directionSpread > SPLIT_RULES.variableSpread

    const totalWeight = speeds.reduce((sum, sample) => sum + sample.weight, 0)
    const contributions: ModelContribution[] = [...perModel.entries()].map(
      ([model, entry]) => ({
        model,
        weight: entry.weight / totalWeight,
        speed: entry.speed / entry.weight,
        direction: circularMean(entry.direction)?.mean ?? null,
      }),
    )
    if (ensembleCounts) {
      contributions.push({
        model: "ensemble",
        weight: ensembleWeight / totalWeight,
        speed: ensembleMid,
        direction: null,
      })
    }

    hours.push({
      time,
      lead,
      low: Math.max(0, Math.min(widerLow, mid - halfWidth)),
      mid,
      high: Math.max(widerHigh, mid + halfWidth),
      modelSpread: widerHigh - widerLow,
      gust:
        lead > GUST_RULE.lastLeadHours || gusts.length === 0
          ? null
          : Math.max(fadedHighest(gusts), mid * GUST_RULE.ofExpected),
      direction: variable ? null : circular.mean,
      directionSpread,
      models: contributions.sort((a, b) => b.weight - a.weight),
      waveHeight: forecast.waves?.height[index] ?? null,
      thunder: thunderAt(forecast, index),
      weather: weatherKindOf(forecast.sky?.code[index] ?? null),
      temperature: forecast.sky?.temperature?.[index] ?? null,
    })
  })

  return hours
}

export type DirectionOption = { direction: number; speed: number }

export type WindSummary = {
  low: number
  high: number
  mid: number
  firstMid: number
  lastMid: number
  gust: number | null
  direction: number | null
  firstDirection: number | null
  lastDirection: number | null
  /** Over what the models are divided; null when they are not, or too far out. */
  split: WindSplit | null
  /** The two camps, when the models split over direction. */
  directionOptions: readonly [DirectionOption, DirectionOption] | null
  trend: "rinforzo" | "calo" | "stabile"
  turning: boolean
  waveHeight: number | null
  thunder: boolean | null
  weather: WeatherKindId | null
  temperature: { low: number; high: number } | null
  /** How far ahead: a tendency beyond 72 h, close to the season's average beyond 120 h. */
  reach: "near" | "tendency" | "seasonal"
}

function mean(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function angleBetween(a: number, b: number) {
  const difference = Math.abs(a - b) % 360
  return difference > 180 ? 360 - difference : difference
}

/** The heaviest model's wind, and the heaviest that clearly differs in direction. */
function directionOptionsOf(hour: BlendedHour | undefined) {
  const known = (hour?.models ?? []).flatMap(({ direction, speed }) =>
    direction === null ? [] : [{ direction, speed }],
  )
  const first = known[0]
  if (first === undefined) return null
  const second = known.find(
    ({ direction }) =>
      angleBetween(first.direction, direction) >= SPLIT_RULES.direction,
  )
  return second === undefined ? null : ([first, second] as const)
}

/**
 * A stretch of hours in one line. The range encloses both the hours' average
 * range and how the central value moves, so a wind building from 8 to 20 kn
 * never reads as a steady 12-16; the words on the screen say which it is.
 */
export function summariseHours(
  hours: readonly BlendedHour[],
): WindSummary | null {
  const firstHour = hours[0]
  const lastHour = hours[hours.length - 1]
  if (!firstHour || !lastHour) return null
  const mids = hours.map((hour) => hour.mid)
  const half = Math.max(1, Math.floor(hours.length / 2))
  const change = mean(mids.slice(-half)) - mean(mids.slice(0, half))
  const known = hours.flatMap((hour) =>
    hour.direction === null ? [] : [hour.direction],
  )
  const circular = circularMean(known.map((value) => ({ value, weight: 1 })))
  const direction =
    circular && known.length * 2 >= hours.length ? circular.mean : null
  const firstDirection = known[0] ?? null
  const lastDirection = known[known.length - 1] ?? null
  const midMean = mean(mids)
  const gusts = hours.flatMap((hour) => (hour.gust === null ? [] : [hour.gust]))
  const waves = hours.flatMap((hour) =>
    hour.waveHeight === null ? [] : [hour.waveHeight],
  )
  const temperatures = hours.flatMap((hour) =>
    hour.temperature === null ? [] : [hour.temperature],
  )
  const reach =
    firstHour.lead >= SEASONAL_AFTER_HOURS
      ? "seasonal"
      : firstHour.lead >= TENDENCY_AFTER_HOURS
        ? "tendency"
        : "near"
  const split =
    reach === "near"
      ? splitOf(
          mean(hours.map((hour) => hour.modelSpread)),
          midMean,
          mean(hours.map((hour) => hour.directionSpread)),
        )
      : null
  return {
    low: Math.min(mean(hours.map((hour) => hour.low)), Math.min(...mids)),
    high: Math.max(mean(hours.map((hour) => hour.high)), Math.max(...mids)),
    mid: midMean,
    firstMid: firstHour.mid,
    lastMid: lastHour.mid,
    gust: gusts.length ? Math.max(...gusts) : null,
    direction,
    firstDirection,
    lastDirection,
    split,
    directionOptions:
      split === "direction"
        ? directionOptionsOf(hours[Math.floor(hours.length / 2)])
        : null,
    trend: change >= 3 ? "rinforzo" : change <= -3 ? "calo" : "stabile",
    turning:
      firstDirection !== null &&
      lastDirection !== null &&
      angleBetween(firstDirection, lastDirection) >= 40,
    waveHeight: waves.length ? Math.max(...waves) : null,
    weather: weatherOfHours(hours),
    temperature: temperatures.length
      ? { low: Math.min(...temperatures), high: Math.max(...temperatures) }
      : null,
    thunder: hours.some((hour) => hour.thunder === true)
      ? true
      : hours.some((hour) => hour.thunder === null)
        ? null
        : false,
    reach,
  }
}

const COMPASS_16 = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const

const COMPASS_8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const

export function compassPoint(degrees: number) {
  return COMPASS_16[Math.round(((degrees % 360) + 360) / 22.5) % 16]
}

/** Eight points, for a cell only two letters wide. */
export function compassPoint8(degrees: number) {
  return COMPASS_8[Math.round(((degrees % 360) + 360) / 45) % 8]
}

/** The rose's name for this wind: Maestrale, Ponente, Libeccio... */
export function windName(degrees: number) {
  return WIND_NAMES[Math.round(((degrees % 360) + 360) / 45) % 8]
}

export function beaufort(knots: number) {
  let force = 0
  BEAUFORT_MIN_KNOTS.forEach((minimum, index) => {
    if (knots >= minimum) force = index
  })
  return force
}

// --- Time: all sailing hours are Caprera's, wherever the phone is ---

const romeParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
})

export function romeClock(epochSeconds: number) {
  const parts = Object.fromEntries(
    romeParts
      .formatToParts(new Date(epochSeconds * 1000))
      .map((part) => [part.type, part.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  }
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export type WindPeriod = "AM" | "PM"

/** One half-day on the water: a course session, or a plain AM/PM outside it. */
export type WindSlot = {
  key: string
  date: string
  period: WindPeriod
  sessionId: SessionId | null
}

export type WindHorizon = "week" | "seven"

type CourseDates = { startDate: string }

function sessionSlots(course: CourseDates): WindSlot[] {
  return SESSION_SEQUENCE.map((session, index) => {
    const date = addDays(course.startDate, sessionDayOffset(index))
    return {
      key: `${date}-${session.period}`,
      date,
      period: session.period,
      sessionId: session.id,
    }
  })
}

function slotEnded(slot: WindSlot, now: number) {
  const clock = romeClock(now)
  if (slot.date !== clock.date) return slot.date < clock.date
  return clock.hour >= WIND_SESSION_HOURS[slot.period].end
}

export function slotInProgress(slot: WindSlot, now: number) {
  const clock = romeClock(now)
  return (
    slot.date === clock.date &&
    clock.hour >= WIND_SESSION_HOURS[slot.period].start &&
    clock.hour < WIND_SESSION_HOURS[slot.period].end
  )
}

/**
 * Week: what is left of the course's thirteen sessions. Seven days: every AM
 * and PM from now on, with the session id where one falls inside the course.
 */
export function slotsForHorizon(
  horizon: WindHorizon,
  course: CourseDates,
  now: number,
): WindSlot[] {
  if (horizon === "week") {
    return sessionSlots(course).filter((slot) => !slotEnded(slot, now))
  }
  const sessions = new Map(
    sessionSlots(course).map((slot) => [slot.key, slot.sessionId]),
  )
  const today = romeClock(now).date
  const slots: WindSlot[] = []
  for (let day = 0; day < 7; day += 1) {
    const date = addDays(today, day)
    for (const period of ["AM", "PM"] as const) {
      const key = `${date}-${period}`
      slots.push({
        key,
        date,
        period,
        sessionId: sessions.get(key) ?? null,
      })
    }
  }
  return slots.filter((slot) => !slotEnded(slot, now))
}

/**
 * The week is the default while its forecast can say something: from seven
 * days before it starts until its last session ends.
 */
export function defaultHorizon(course: CourseDates, now: number): WindHorizon {
  const today = romeClock(now).date
  return slotsForHorizon("week", course, now).length > 0 &&
    addDays(today, 7) >= course.startDate
    ? "week"
    : "seven"
}

/**
 * The half-day being decided: the next one in the default horizon. In a session's
 * last hour that is already the following one, because the boats are coming in.
 */
export function nextDecisionSlot(course: CourseDates, now: number): WindSlot {
  const slots = slotsForHorizon(defaultHorizon(course, now), course, now)
  const ordered =
    slots.length > 0 ? slots : slotsForHorizon("seven", course, now)
  const first = ordered[0] as WindSlot
  const inLastHour =
    slotInProgress(first, now) &&
    romeClock(now).hour >= WIND_SESSION_HOURS[first.period].end - 1
  return inLastHour ? (ordered[1] ?? first) : first
}

export function hoursInSlot(
  hours: readonly BlendedHour[],
  slot: WindSlot,
): BlendedHour[] {
  const { start, end } = WIND_SESSION_HOURS[slot.period]
  return hours.filter((hour) => {
    const clock = romeClock(hour.time)
    return clock.date === slot.date && clock.hour >= start && clock.hour < end
  })
}
