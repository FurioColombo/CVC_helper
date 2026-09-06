import type { CourseFamily, CourseLevel } from "@/domain/config"

const DAY_IN_MS = 24 * 60 * 60 * 1000

export type IsoWeekInfo = {
  isoWeek: number
  year: number
}

export type CourseDetails = IsoWeekInfo & {
  family: CourseFamily
  level: CourseLevel
  startDate: string
  endDate: string
  label: string
}

type CourseIdentityDetails = Pick<
  CourseDetails,
  "family" | "level" | "isoWeek" | "year"
>

function toUtcCalendarDate(date: Date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function getIsoWeekInfo(date: Date): IsoWeekInfo {
  const thursday = toUtcCalendarDate(date)
  const weekday = thursday.getUTCDay() || 7
  thursday.setUTCDate(thursday.getUTCDate() + 4 - weekday)

  const year = thursday.getUTCFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const isoWeek = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / DAY_IN_MS + 1) / 7,
  )

  return { isoWeek, year }
}

export function getCourseDateRange({ isoWeek, year }: IsoWeekInfo) {
  const januaryFourth = new Date(Date.UTC(year, 0, 4))
  const januaryFourthWeekday = januaryFourth.getUTCDay() || 7
  const weekOneMonday = new Date(januaryFourth)
  weekOneMonday.setUTCDate(
    januaryFourth.getUTCDate() - januaryFourthWeekday + 1,
  )

  const start = new Date(
    weekOneMonday.getTime() + ((isoWeek - 1) * 7 + 5) * DAY_IN_MS,
  )
  const end = new Date(start.getTime() + 7 * DAY_IN_MS)

  return {
    startDate: formatDateOnly(start),
    endDate: formatDateOnly(end),
  }
}

export function buildCourseDetails(
  family: CourseFamily,
  level: CourseLevel,
  date: Date,
): CourseDetails {
  const week = getIsoWeekInfo(date)
  const dates = getCourseDateRange(week)
  const familyCode = family === "Deriva" ? "D" : "C"

  return {
    family,
    level,
    ...week,
    ...dates,
    label: `${familyCode}${level} ${week.isoWeek} ${week.year}`,
  }
}

export function formatCourseIdentity({
  family,
  level,
  isoWeek,
  year,
}: CourseIdentityDetails) {
  return `${family === "Deriva" ? "D" : "C"}${level} - ${isoWeek} | ${year}`
}
