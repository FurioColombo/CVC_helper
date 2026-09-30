export const COURSE_FAMILIES = ["Deriva", "Cabinato"] as const
export type CourseFamily = (typeof COURSE_FAMILIES)[number]

export const COURSE_LEVELS = [1, 2, 3, 4, 5] as const
export type CourseLevel = (typeof COURSE_LEVELS)[number]

export const STUDENT_SEXES = [
  { id: "male", label: "M", detailLabel: "Uomo" },
  { id: "female", label: "F", detailLabel: "Donna" },
  { id: "other", label: "Altro", detailLabel: "Altro" },
] as const
export type StudentSex = (typeof STUDENT_SEXES)[number]["id"]

export const BOAT_TYPES = [
  "RS Toura",
  "RS Quest",
  "Laser Vago",
  "RS 500",
  "J/80",
  "First 25.7",
  "First 27",
] as const
export type BoatType = (typeof BOAT_TYPES)[number]

/**
 * One class colour per boat model, used only for the crew-summary number and
 * card edge (owner's F3 C6 design, 2026-09-28); names stay ink everywhere.
 * The owner chose the five Deriva/Mezzi colours below. The three Cabinato
 * models are not yet part of a frozen mock, so instead of inventing a colour
 * each is the dominant fully-opaque ink pixel sampled from its own brand
 * logo in public/brand/boats/ (the anti-aliased edge pixels were excluded),
 * until the owner picks their own. All three already clear the 3:1 large-text
 * contrast minimum on white (`config.test.ts` computes and checks this for
 * every `BOAT_TYPES` entry), so none needed darkening.
 */
export const BOAT_TYPE_CLASS_COLORS = {
  "RS Toura": "#157a73",
  "RS Quest": "#2f9e46",
  "Laser Vago": "#c96a12",
  "RS 500": "#d81c82",
  "J/80": "#00345c", // sampled ink of public/brand/boats/j80.png (rgb(0,52,92)); 12.8:1 on white
  "First 25.7": "#000000", // sampled ink of public/brand/boats/first-25-7.png (pure black); 21:1 on white
  "First 27": "#000000", // sampled ink of public/brand/boats/first-27.png (pure black, same wordmark ink as First 25.7); 21:1 on white
} as const satisfies Record<BoatType, string>

/** The Mezzi pseudo-group's class colour; Mezzi is a crew destination, not a `BoatType`. */
export const MEZZI_CLASS_COLOR = "#0b526b"

export const COURSE_CONFIG = {
  D1: { family: "Deriva", level: 1, defaultBoatType: "RS Toura" },
  D2: {
    family: "Deriva",
    level: 2,
    defaultBoatType: "RS Quest",
    standardCrewSize: 2,
  },
  D3: {
    family: "Deriva",
    level: 3,
    defaultBoatType: "RS Quest",
    standardCrewSize: 2,
  },
  D4: {
    family: "Deriva",
    level: 4,
    defaultBoatType: "Laser Vago",
    standardCrewSize: 2,
  },
  D5: {
    family: "Deriva",
    level: 5,
    defaultBoatType: "RS 500",
    standardCrewSize: 2,
  },
  C1: { family: "Cabinato", level: 1, defaultBoatType: "J/80" },
  C2: { family: "Cabinato", level: 2, defaultBoatType: "First 25.7" },
  C3: { family: "Cabinato", level: 3, defaultBoatType: "First 27" },
} as const satisfies Record<
  string,
  {
    family: CourseFamily
    level: CourseLevel
    defaultBoatType: BoatType
    standardCrewSize?: number
  }
>
export type CourseCode = keyof typeof COURSE_CONFIG

export const SESSION_SEQUENCE = [
  { id: "sat-pm", day: "Sabato", period: "PM" },
  { id: "sun-am", day: "Domenica", period: "AM" },
  { id: "sun-pm", day: "Domenica", period: "PM" },
  { id: "mon-am", day: "Lunedì", period: "AM" },
  { id: "mon-pm", day: "Lunedì", period: "PM" },
  { id: "tue-am", day: "Martedì", period: "AM" },
  { id: "tue-pm", day: "Martedì", period: "PM" },
  { id: "wed-am", day: "Mercoledì", period: "AM" },
  { id: "wed-pm", day: "Mercoledì", period: "PM" },
  { id: "thu-am", day: "Giovedì", period: "AM" },
  { id: "thu-pm", day: "Giovedì", period: "PM" },
  { id: "fri-am", day: "Venerdì", period: "AM" },
  { id: "fri-pm", day: "Venerdì", period: "PM" },
] as const
export type SessionId = (typeof SESSION_SEQUENCE)[number]["id"]

export const DUTY_DAYS = [
  { id: "saturday", label: "Sabato", short: "Sab" },
  { id: "sunday", label: "Domenica", short: "Dom" },
  { id: "monday", label: "Lunedì", short: "Lun" },
  { id: "tuesday", label: "Martedì", short: "Mar" },
  { id: "wednesday", label: "Mercoledì", short: "Mer" },
  { id: "thursday", label: "Giovedì", short: "Gio" },
  { id: "friday", label: "Venerdì", short: "Ven" },
] as const
export type DutyDayId = (typeof DUTY_DAYS)[number]["id"]

export const SESSION_DUTY_DAY = {
  "sat-pm": "saturday",
  "sun-am": "saturday",
  "sun-pm": "sunday",
  "mon-am": "sunday",
  "mon-pm": "monday",
  "tue-am": "monday",
  "tue-pm": "tuesday",
  "wed-am": "tuesday",
  "wed-pm": "wednesday",
  "thu-am": "wednesday",
  "thu-pm": "thursday",
  "fri-am": "thursday",
  "fri-pm": "friday",
} as const satisfies Record<SessionId, DutyDayId>

export const SESSION_SMONTANTE_DUTY_DAY: Readonly<
  Partial<Record<SessionId, DutyDayId>>
> = {
  "sun-pm": "saturday",
  "mon-pm": "sunday",
  "tue-pm": "monday",
  "wed-pm": "tuesday",
  "thu-pm": "wednesday",
  "fri-pm": "thursday",
}

export const DUTY_TIE_BREAKERS = ["alphabetical", "similar-age"] as const
export type DutyTieBreaker = (typeof DUTY_TIE_BREAKERS)[number]

export const STUDENT_SIZES = ["XS", "S", "M", "L", "XL"] as const
export type StudentSize = (typeof STUDENT_SIZES)[number]

export type CrewWarningSeverity = "none" | "yellow" | "red"

export const SIZE_WARNING_MATRIX = {
  XS: { XS: "red", S: "red", M: "yellow", L: "none", XL: "none" },
  S: { XS: "red", S: "red", M: "none", L: "none", XL: "none" },
  M: { XS: "yellow", S: "none", M: "none", L: "none", XL: "none" },
  L: { XS: "none", S: "none", M: "none", L: "yellow", XL: "red" },
  XL: { XS: "none", S: "none", M: "none", L: "red", XL: "red" },
} as const satisfies Record<
  StudentSize,
  Record<StudentSize, CrewWarningSeverity>
>

export const EVALUATION_VALUES = [
  { symbol: "++", score: 2 },
  { symbol: "+", score: 1 },
  { symbol: "=", score: 0 },
  { symbol: "-", score: -1 },
  { symbol: "--", score: -2 },
] as const
export type EvaluationSymbol = (typeof EVALUATION_VALUES)[number]["symbol"]

export const FAULT_STATES = ["open", "reported", "resolved"] as const
export type FaultState = (typeof FAULT_STATES)[number]

export const FAULT_STATE_LABELS = {
  open: "Aperta",
  reported: "Comunicata",
  resolved: "Risolta",
} as const satisfies Record<FaultState, string>

export const BOAT_AVAILABILITY = ["available", "unavailable"] as const
export type BoatAvailability = (typeof BOAT_AVAILABILITY)[number]

export const CREW_DESTINATIONS = ["unassigned", "boat", "mezzi"] as const
export type CrewDestination = (typeof CREW_DESTINATIONS)[number]

export const VOLUNTEER_ROLES = ["ADV", "IS", "CT"] as const
export type VolunteerRole = (typeof VOLUNTEER_ROLES)[number]
