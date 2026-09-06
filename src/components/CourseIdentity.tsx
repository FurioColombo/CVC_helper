import type { CourseFamily, CourseLevel } from "@/domain/config"
import { formatCourseIdentity } from "@/domain/course"

type CourseIdentityProps = {
  family: CourseFamily
  level: CourseLevel
  isoWeek: number
  year: number
  size?: "large" | "compact"
}

export function CourseIdentity({
  family,
  level,
  isoWeek,
  year,
  size = "large",
}: CourseIdentityProps) {
  const familyCode = family === "Deriva" ? "D" : "C"
  const label = formatCourseIdentity({ family, level, isoWeek, year })

  return (
    <span
      aria-label={label}
      className={`course-identity course-identity--${size}`}
      data-course-identity={label}
    >
      <strong>
        {familyCode}
        {level} - {isoWeek}
      </strong>
      <span aria-hidden="true">| {year}</span>
    </span>
  )
}
