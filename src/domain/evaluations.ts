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
