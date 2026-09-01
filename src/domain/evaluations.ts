import {
  EVALUATION_VALUES,
  SESSION_SEQUENCE,
  type EvaluationSymbol,
  type SessionId,
} from "@/domain/config"

const EVALUATION_SCORES = new Map<EvaluationSymbol, number>(
  EVALUATION_VALUES.map(({ symbol, score }) => [symbol, score]),
)

const SESSION_ENDS = SESSION_SEQUENCE.map(({ id, period }, index) => ({
  id,
  dayOffset: Math.floor((index + 1) / 2),
  hour: period === "AM" ? 13 : 18,
}))

export interface EvaluationSummary {
  count: number
  mean: number | null
}

export type EvaluationOrdering = "alphabetical" | "strongest"

export interface EvaluationValueRef {
  studentId: string
  sessionId: SessionId
  value: EvaluationSymbol | null
}

export interface EvaluationStudentRef {
  id: string
  firstName: string
  surname: string
}

export function isEvaluationSymbol(
  value: string | null,
): value is EvaluationSymbol {
  return value !== null && EVALUATION_SCORES.has(value as EvaluationSymbol)
}

export function summarizeEvaluations(
  values: ReadonlyArray<EvaluationSymbol | null>,
): EvaluationSummary {
  const scores = values.flatMap((value) =>
    value === null ? [] : [EVALUATION_SCORES.get(value)!],
  )
  return {
    count: scores.length,
    mean:
      scores.length === 0
        ? null
        : scores.reduce((total, score) => total + score, 0) / scores.length,
  }
}

function compareStudents(
  left: EvaluationStudentRef,
  right: EvaluationStudentRef,
) {
  return new Intl.Collator("it-IT", { sensitivity: "base" }).compare(
    `${left.surname} ${left.firstName}`,
    `${right.surname} ${right.firstName}`,
  )
}

export function sortStudentsByEvaluations<T extends EvaluationStudentRef>(
  students: readonly T[],
  evaluations: readonly EvaluationValueRef[],
  ordering: EvaluationOrdering,
): T[] {
  const valuesByStudent = new Map<string, Array<EvaluationSymbol | null>>()
  evaluations.forEach(({ studentId, value }) => {
    valuesByStudent.set(studentId, [
      ...(valuesByStudent.get(studentId) ?? []),
      value,
    ])
  })
  return [...students].sort((left, right) => {
    if (ordering === "strongest") {
      const leftMean = summarizeEvaluations(
        valuesByStudent.get(left.id) ?? [],
      ).mean
      const rightMean = summarizeEvaluations(
        valuesByStudent.get(right.id) ?? [],
      ).mean
      if (leftMean !== rightMean) {
        if (leftMean === null) return 1
        if (rightMean === null) return -1
        return rightMean - leftMean
      }
    }
    return compareStudents(left, right)
  })
}

export function getAccumulatedEvaluationSessions(
  evaluations: readonly EvaluationValueRef[],
): SessionId[] {
  const lastIndex = evaluations.reduce(
    (latest, { sessionId }) =>
      Math.max(
        latest,
        SESSION_SEQUENCE.findIndex(({ id }) => id === sessionId),
      ),
    -1,
  )
  return SESSION_SEQUENCE.slice(0, lastIndex + 1).map(({ id }) => id)
}

export function formatEvaluationSession(sessionId: SessionId) {
  const session = SESSION_SEQUENCE.find(({ id }) => id === sessionId)!
  return `${session.day} ${session.period}`
}

export function getDefaultEvaluationSession(
  courseStartDate: string,
  referenceDate: Date,
): SessionId {
  const [year, month, day] = courseStartDate.split("-").map(Number)
  const start = new Date(year!, month! - 1, day!)
  const completed = SESSION_ENDS.filter(({ dayOffset, hour }) => {
    const end = new Date(start)
    end.setDate(start.getDate() + dayOffset)
    end.setHours(hour, 0, 0, 0)
    return end.getTime() <= referenceDate.getTime()
  })
  return completed.at(-1)?.id ?? SESSION_SEQUENCE[0].id
}
