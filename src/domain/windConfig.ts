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
 * for sea cells. The owner set the areas on 2026-11-05 and gave the Derive
 * places on 2026-11-11 (.evidence/WX1/owner-places.json on claude/0.5.0-prep);
 * the Cabinati points still await the owner's check.
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
    centre: { latitude: 41.18, longitude: 9.455 },
    waves: false,
    points: [
      {
        id: "cala-fico",
        label: "Cala Fico",
        latitude: 41.185,
        longitude: 9.448,
      },
      {
        id: "isola-del-porco",
        label: "Isola del Porco",
        latitude: 41.1757,
        longitude: 9.4597,
      },
      {
        id: "punta-rossa",
        label: "Punta Rossa",
        latitude: 41.1712,
        longitude: 9.4659,
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
 * The hours each half-day covers (Italy), whole hours with the end excluded.
 * The school boats at 9:00 and is back by 12:30, then out from 15:00 to 18:00
 * (the CT's guide). The owner chose on 2026-11-12 to show an hour more on each
 * side, to read the trend: 8 to 14 and 14 to 19.
 */
export const WIND_SESSION_HOURS = {
  AM: { start: 8, end: 14 },
  PM: { start: 14, end: 19 },
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
 * grid, and UKMO because its CC BY-SA terms would reach the blend.
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
  // GFS stays above AIFS at 144 h though AIFS scored better near there: AIFS's
  // smooth forecasts flatter a mean-error score. A judgement, not a measurement.
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
 * agreement too, and the error grows with the wind. The range shown is at least
 * this far either side of the expected value; WEATHER_EVIDENCE.md gives how often
 * it holds, by strength. Tuned on the season it is scored on.
 */
export const RANGE_HALF_WIDTH = { minKnots: 3, ofExpected: 0.3 } as const

/**
 * The highest model gust, or a multiple of the expected wind if that is higher,
 * which it usually is: every model under-reads gusts on sea cells, more in strong wind.
 * The multiple comes from headland peaks and may read high over water. Tuned on
 * the season it is scored on. Beyond the last lead the few runs left cannot make
 * a gust number, so none is shown.
 */
export const GUST_RULE = { ofExpected: 2, lastLeadHours: 120 } as const

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
/** From here single runs do little better than a constant season mean (backtest). */
export const SEASONAL_AFTER_HOURS = 120

/**
 * The week grid's one-blue tint, by expected wind: sensing the week at a glance.
 * Never alone: every cell prints its number.
 */
export const WIND_TINTS = [
  { fromKnots: 0, background: "transparent", color: "var(--foreground)" },
  { fromKnots: 11, background: "#dde8f5", color: "var(--foreground)" },
  { fromKnots: 17, background: "#c3d6ee", color: "var(--foreground)" },
  { fromKnots: 22, background: "#a9c4e6", color: "var(--foreground)" },
  { fromKnots: 28, background: "#2f5fa0", color: "#ffffff" },
] as const

/**
 * The sky of the WMO weather codes Open-Meteo sends, from the clearest to the
 * worst. A half-day shows the worst rain, fog or storm any of its hours has,
 * and otherwise its most frequent cloud: an hour of rain matters on the water,
 * an hour of cloud does not.
 */
export const WEATHER_KINDS = [
  { id: "clear", label: "Sereno", codes: [0], wet: false },
  { id: "partly", label: "Poco nuvoloso", codes: [1, 2], wet: false },
  { id: "overcast", label: "Coperto", codes: [3], wet: false },
  { id: "fog", label: "Nebbia", codes: [45, 48], wet: true },
  {
    id: "drizzle",
    label: "Pioviggine",
    codes: [51, 53, 55, 56, 57],
    wet: true,
  },
  {
    id: "rain",
    label: "Pioggia",
    codes: [61, 63, 65, 66, 67, 80, 81, 82],
    wet: true,
  },
  { id: "snow", label: "Neve", codes: [71, 73, 75, 77, 85, 86], wet: true },
  { id: "storm", label: "Temporale", codes: [95, 96, 99], wet: true },
] as const satisfies readonly {
  id: string
  label: string
  codes: readonly number[]
  wet: boolean
}[]

export type WeatherKindId = (typeof WEATHER_KINDS)[number]["id"]

/**
 * The map's landmark: the Scalo of the centre, from the owner's record of
 * places (.evidence/WX1/owner-places.json, 2026-11-11).
 */
export const CENTRE_PLACE = {
  label: "CVC",
  latitude: 41.186,
  longitude: 9.442,
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
