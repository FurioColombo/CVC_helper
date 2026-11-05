import type { CourseFamily } from "@/domain/config"

/**
 * The weather section's canonical tables: where we forecast, with which models
 * and how much each one counts. Reasons and evidence are in
 * docs/working/WEATHER_PROPOSAL.md and docs/working/weather-backtest.json.
 */

export type WindPoint = {
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
    }
  >
> = {
  derive: {
    label: "Derive",
    description: "Cala Fico, Isola del Porco, Punta Rossa",
    centre: { latitude: 41.172, longitude: 9.466 },
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
        latitude: 41.14,
        longitude: 9.535,
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

/** Lead-time bucket limits, in hours; the last bucket is open-ended. */
export const LEAD_BUCKET_HOURS = [24, 48, 72, 120] as const

/** A run fades over its last hours, so the blend does not step when it ends. */
export const MODEL_END_TAPER_HOURS = 6

export type WindModelFamily =
  "meteo-france" | "icon" | "ecmwf" | "ncep" | "ukmo"

/**
 * `weights` follow the lead buckets: 0-24 h, 24-48, 48-72, 72-120, 120+.
 * Each is the model's share of 1/MAE² in the backtest, rounded. Where the
 * archive holds no score for a bucket the model reaches, the value extends its
 * last score (the proposal lists which). AROME HD scored the same as AROME at
 * the airports and leads it only on the prior that 1.3 km sees the islands
 * better. A zero means the model does not reach that bucket.
 */
export const WIND_MODELS = [
  {
    id: "meteofrance_arome_france_hd",
    label: "AROME HD",
    provider: "Météo-France",
    gridKm: 1.3,
    family: "meteo-france",
    weights: [18, 17, 0, 0, 0],
  },
  {
    id: "meteofrance_arome_france",
    label: "AROME",
    provider: "Météo-France",
    gridKm: 2.5,
    family: "meteo-france",
    weights: [14, 15, 0, 0, 0],
  },
  {
    id: "italia_meteo_arpae_icon_2i",
    label: "ICON-2I",
    provider: "ItaliaMeteo-ARPAE",
    gridKm: 2,
    family: "icon",
    weights: [14, 14, 20, 0, 0],
  },
  {
    id: "meteofrance_arpege_europe",
    label: "ARPEGE",
    provider: "Météo-France",
    gridKm: 11,
    family: "meteo-france",
    weights: [14, 13, 20, 15, 0],
  },
  {
    id: "icon_eu",
    label: "ICON-EU",
    provider: "DWD",
    gridKm: 7,
    family: "icon",
    weights: [10, 10, 15, 17, 0],
  },
  {
    id: "ecmwf_ifs",
    label: "IFS",
    provider: "ECMWF",
    gridKm: 9,
    family: "ecmwf",
    weights: [9, 9, 14, 20, 26],
  },
  {
    id: "ecmwf_aifs025_single",
    label: "AIFS",
    provider: "ECMWF",
    gridKm: 25,
    family: "ecmwf",
    weights: [6, 6, 9, 14, 21],
  },
  {
    id: "gfs_global",
    label: "GFS",
    provider: "NOAA",
    gridKm: 25,
    family: "ncep",
    weights: [8, 8, 11, 18, 29],
  },
  {
    id: "ukmo_global_deterministic_10km",
    label: "UKMO",
    provider: "Met Office",
    gridKm: 10,
    family: "ukmo",
    weights: [6, 7, 10, 16, 24],
  },
] as const satisfies readonly {
  id: string
  label: string
  provider: string
  gridKm: number
  family: WindModelFamily
  weights: readonly [number, number, number, number, number]
}[]

export type WindModelId = (typeof WIND_MODELS)[number]["id"]

/**
 * No family of related runs may decide alone. Checked on these tables by test;
 * the ensemble is outside it, being a different kind of evidence.
 */
export const FAMILY_MAX_SHARE = 0.5

/**
 * ECMWF's 51-member median, by the same buckets. Not scored by the backtest
 * (its archive keeps no ensemble), so this is a prior: ensemble medians beat
 * single runs at long range. It steers days 4-7 and leaves the short range to
 * the models that can see the islands.
 */
export const ENSEMBLE_WEIGHTS = [0, 0, 5, 30, 45] as const

export const AGREEMENT_RULES = {
  // Band as wide as this, or directions this far apart: the models are divided.
  low: { minKnots: 7, ratio: 0.5, direction: 45 },
  high: { minKnots: 3.5, ratio: 0.25, direction: 25 },
  directionMatters: 6,
  variableBelowKnots: 3,
  variableSpread: 75,
} as const

/**
 * Every model read low in strong westerlies at Figari and Olbia, June-October
 * 2026 (backtest): the screen says so when one is forecast. Below 15 kn the
 * bias is small enough to leave unsaid. No correction is applied, because an
 * airport's bias is not proven to hold on the water.
 */
export const STRONG_WESTERLY = {
  fromDegrees: 240,
  toDegrees: 345,
  minKnots: 15,
} as const

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
 * LaMMA's own map: WW3 forced by MOLOCH at 1.5 km, from ECMWF, over Bonifacio.
 * It covers the whole sailing area on one image. LaMMA publishes no point
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
    detail: "La Maddalena",
    url: "https://www.windfinder.com/forecast/la_maddalena",
  },
  {
    label: "Meteomar",
    detail: "Bollettino ufficiale",
    url: "https://www.meteoam.it/it/meteomar",
  },
] as const
