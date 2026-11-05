import type { CourseFamily } from "@/domain/config"

/**
 * The weather section's canonical tables: where we forecast, with which models
 * and how much each one counts. Reasons and evidence are in
 * docs/working/WEATHER_PROPOSAL.md and docs/working/weather-backtest.json.
 */

type WindPoint = {
  id: string
  label: string
  latitude: number
  longitude: number
}

export type WindZoneId = "derive" | "cabinati"

/**
 * Points sit on open water just off each place, because the models are asked
 * for sea cells. The owner set the areas on 2026-11-05. Cala Fico is not named
 * on OpenStreetMap: its position is estimated and awaits the owner's check.
 */
export const WIND_ZONES: Readonly<
  Record<
    WindZoneId,
    {
      label: string
      description: string
      centre: { latitude: number; longitude: number }
      points: readonly WindPoint[]
      /** Open-sea waves say little inside Cala Fico, so Derive does not ask. */
      waves: boolean
    }
  >
> = {
  derive: {
    label: "Derive",
    description: "Cala Fico, Isola del Porco, Punta Rossa",
    centre: { latitude: 41.172, longitude: 9.466 },
    waves: false,
    points: [
      {
        id: "cala-fico",
        label: "Cala Fico",
        latitude: 41.178,
        longitude: 9.478,
      },
      {
        id: "isola-del-porco",
        label: "Isola del Porco",
        latitude: 41.1725,
        longitude: 9.455,
      },
      {
        id: "punta-rossa",
        label: "Punta Rossa",
        latitude: 41.167,
        longitude: 9.472,
      },
    ],
  },
  cabinati: {
    label: "Cabinati",
    description: "Caprera, La Maddalena, Spargi, Cannigione, Liscia di Vacca",
    centre: { latitude: 41.2, longitude: 9.43 },
    waves: true,
    points: [
      { id: "spargi", label: "Spargi", latitude: 41.24, longitude: 9.325 },
      {
        id: "maddalena",
        label: "La Maddalena nord",
        latitude: 41.265,
        longitude: 9.41,
      },
      {
        id: "caprera-est",
        label: "Caprera est",
        latitude: 41.215,
        longitude: 9.5,
      },
      {
        id: "caprera-sud",
        label: "Caprera sud",
        latitude: 41.168,
        longitude: 9.465,
      },
      {
        id: "liscia-di-vacca",
        label: "Liscia di Vacca",
        latitude: 41.148,
        longitude: 9.53,
      },
      {
        id: "cannigione",
        label: "Cannigione",
        latitude: 41.125,
        longitude: 9.445,
      },
    ],
  },
}

export function zoneForCourse(family: CourseFamily): WindZoneId {
  return family === "Cabinato" ? "cabinati" : "derive"
}

/**
 * Provisional: the specification gives sessions no clock time (01 §7.1), and
 * the forecast needs one. The owner is asked to confirm these hours (Italy).
 */
export const WIND_SESSION_HOURS = {
  AM: { start: 9, end: 13 },
  PM: { start: 14, end: 18 },
} as const

export const WIND_FORECAST_DAYS = 8

/**
 * Hours ahead each weight below applies to. Between two anchors a weight moves
 * in a straight line, so the blend never steps when only the clock has moved.
 */
export const LEAD_ANCHOR_HOURS = [12, 36, 60, 96, 144] as const

/** A run fades over its last hours, so the blend does not step when it ends. */
export const MODEL_END_TAPER_HOURS = 6

type WindModelFamily = "meteo-france" | "icon" | "ecmwf" | "ncep"

/**
 * Judgement informed by scores, not a formula: the shares of 1/MAE² on sea cells
 * at Cap Pertusato and La Chiappa (docs/working/weather-backtest.json), rounded
 * coarsely because they barely move the median. A zero means the model does not
 * reach that lead. AROME 2.5 km is left out as the same run as AROME HD on another
 * grid, and UKMO because its CC BY-SA terms would reach the blend; the proposal's
 * section 4 gives what each costs.
 */
export const WIND_MODELS = [
  {
    id: "meteofrance_arome_france_hd",
    label: "AROME HD",
    gridKm: 1.3,
    family: "meteo-france",
    weights: [30, 25, 0, 0, 0],
  },
  {
    id: "italia_meteo_arpae_icon_2i",
    label: "ICON-2I",
    gridKm: 2,
    family: "icon",
    weights: [15, 15, 20, 0, 0],
  },
  {
    id: "meteofrance_arpege_europe",
    label: "ARPEGE",
    gridKm: 11,
    family: "meteo-france",
    weights: [15, 15, 20, 20, 0],
  },
  {
    id: "icon_eu",
    label: "ICON-EU",
    gridKm: 7,
    family: "icon",
    weights: [10, 10, 15, 15, 0],
  },
  {
    id: "ecmwf_ifs",
    label: "IFS",
    gridKm: 9,
    family: "ecmwf",
    weights: [15, 15, 20, 30, 40],
  },
  {
    id: "ecmwf_aifs025_single",
    label: "AIFS",
    gridKm: 25,
    family: "ecmwf",
    weights: [5, 8, 10, 15, 20],
  },
  {
    id: "gfs_global",
    label: "GFS",
    gridKm: 25,
    family: "ncep",
    weights: [10, 12, 15, 20, 25],
  },
] as const satisfies readonly {
  id: string
  label: string
  gridKm: number
  family: WindModelFamily
  weights: readonly [number, number, number, number, number]
}[]

export type WindModelId = (typeof WIND_MODELS)[number]["id"]

/**
 * No family decides alone while the islands can still be seen: checked by test
 * up to 72 h, the ensemble included. Beyond that the forecast is mostly ECMWF on
 * purpose, because IFS scores best there on sea cells.
 */
export const FAMILY_MAX_SHARE = 0.5
export const FAMILY_CAP_UNTIL_HOURS = 72

/**
 * ECMWF's 51-member median, at the same anchors. Not scored (the archive keeps no
 * ensemble), so this is a prior: ensemble medians beat single runs at long range.
 */
export const ENSEMBLE_WEIGHTS = [0, 0, 5, 30, 45] as const
/** Its spread widens the band gradually, not all at once at its first weight. */
export const ENSEMBLE_WIDENING_HOURS = { from: 48, to: 72 } as const

/**
 * The real wind leaves the models' 20-80 band about half the time, under
 * agreement too. The range shown is at least this far either side of the expected
 * value; the proposal's section 4 gives how often it holds the wind.
 */
export const RANGE_MIN_HALF_WIDTH_KNOTS = 3

/**
 * The highest model gust, or the band's top scaled up if that is higher, because
 * every model under-reads gusts on sea cells. Beyond the last lead the few runs
 * left cannot make a gust number, so none is shown.
 */
export const GUST_RULE = { bandFactor: 1.5, lastLeadHours: 120 } as const

export const SPLIT_RULES = {
  // Band as wide as this, or directions this far apart: the models are divided.
  minKnots: 7,
  ratio: 0.5,
  direction: 45,
  directionMatters: 6,
  variableBelowKnots: 3,
  variableSpread: 75,
} as const

/** From here a half-day is a tendency: no split mark, the number carries a ~. */
export const TENDENCY_AFTER_HOURS = 72
/** From here single runs do little better than the season's average (backtest). */
export const SEASONAL_AFTER_HOURS = 120

/**
 * The week grid's one-blue tint, by expected wind: sensing the week at a glance.
 * Never alone: every cell prints its number.
 */
export const WIND_TINTS = [
  { fromKnots: 0, background: "transparent", color: "var(--foreground)" },
  { fromKnots: 11, background: "#e8eef6", color: "var(--foreground)" },
  { fromKnots: 17, background: "#cfdff2", color: "var(--foreground)" },
  { fromKnots: 22, background: "#a9c4e6", color: "var(--foreground)" },
  { fromKnots: 28, background: "#2f5fa0", color: "#ffffff" },
] as const

/** Minimum knots of Beaufort forces 0-12. */
export const BEAUFORT_MIN_KNOTS = [
  0, 1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64,
] as const

/** The wind rose, from N clockwise by 45°. */
export const WIND_NAMES = [
  "Tramontana",
  "Grecale",
  "Levante",
  "Scirocco",
  "Ostro",
  "Libeccio",
  "Ponente",
  "Maestrale",
] as const

/**
 * LaMMA's own map: WW3 forced by its MOLOCH run from ECMWF, over Bonifacio. The
 * grid size is left unsaid until LaMMA confirms it (proposal section 7). It covers the whole sailing area on one image. LaMMA publishes no point
 * values a browser can read, so it stands beside the blend, unaltered (CC BY-ND).
 */
export const LAMMA_MAP = {
  baseUrl: "https://www.lamma.toscana.it/models/ww3gnshrecm/last",
  area: "AQ",
  pageUrl: "https://www.lamma.toscana.it/mare/modelli/vento-e-mare-costa.php",
  /** Runs at 00 and 12 UTC; each was seen published about eight hours later. */
  publishDelayHours: 9,
  hourlySteps: 60,
  maxStepHours: 120,
} as const

export const WEATHER_LINKS = [
  {
    label: "Meteomar",
    detail: "Bollettino ufficiale",
    url: "https://www.meteoam.it/it/meteomar",
  },
  {
    label: "LaMMA",
    detail: "Vento e mare, costa",
    url: LAMMA_MAP.pageUrl,
  },
  {
    label: "Windy",
    detail: "Mappa, tutti i modelli",
    url: "https://www.windy.com/41.180/9.460?41.180,9.460,12",
  },
  {
    label: "Windfinder",
    detail: "La Maddalena, Superforecast",
    url: "https://www.windfinder.com/weatherforecast/la_maddalena",
  },
] as const

export const DATA_CREDIT = {
  provider: "Open-Meteo.com",
  providerUrl: "https://open-meteo.com/",
  licence: "CC BY 4.0",
  licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
} as const
