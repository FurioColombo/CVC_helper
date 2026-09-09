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
  { id: "saturday", label: "Sabato" },
  { id: "sunday", label: "Domenica" },
  { id: "monday", label: "Lunedì" },
  { id: "tuesday", label: "Martedì" },
  { id: "wednesday", label: "Mercoledì" },
  { id: "thursday", label: "Giovedì" },
  { id: "friday", label: "Venerdì" },
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
