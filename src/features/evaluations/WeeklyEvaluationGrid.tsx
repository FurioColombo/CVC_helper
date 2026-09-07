import { FileText } from "lucide-react"
import { useId, useState } from "react"

import { formatEvaluationSession } from "@/domain/evaluations"
import { SESSION_SEQUENCE, type SessionId } from "@/domain/config"
import type { EvaluationRecord } from "@/persistence/evaluations"
import { cn } from "@/lib/utils"

type EvaluationPeriod = "AM" | "PM"

interface EvaluationDayRow {
  day: string
  am: SessionId | null
  pm: SessionId | null
}

const EVALUATION_CELL_STYLES = {
  "++": "border-[#5b9b6a] bg-[#e4f3e7] text-[#23613a]",
  "+": "border-[#8abd93] bg-[#f0f8f1] text-[#327144]",
  "=": "border-[#a9b7c7] bg-[#f0f3f7] text-[#53667d]",
  "-": "border-[#d6a853] bg-[#fff6df] text-[#8a5a00]",
  "--": "border-[#dc8b8b] bg-[#fff0f0] text-[#a22c2c]",
  missing: "border-border bg-muted text-muted-foreground",
} as const

/**
 * Builds the compact day rows while preserving the canonical course session
 * order. A missing period means that no course session exists for that slot
 * (Saturday AM, for example); a present period with no record is left blank.
 */
function buildEvaluationDayRows(): EvaluationDayRow[] {
  const rows: EvaluationDayRow[] = []

  SESSION_SEQUENCE.forEach((session) => {
    const row = rows.find(({ day }) => day === session.day)
    if (row) {
      row[session.period.toLowerCase() as "am" | "pm"] = session.id
      return
    }
    rows.push({
      day: session.day,
      am: session.period === "AM" ? session.id : null,
      pm: session.period === "PM" ? session.id : null,
    })
  })

  return rows
}

function sortNotes(records: readonly EvaluationRecord[]) {
  return records
    .filter((record) => Boolean(record.note?.trim()))
    .sort(
      (left, right) =>
        SESSION_SEQUENCE.findIndex(({ id }) => id === left.sessionId) -
        SESSION_SEQUENCE.findIndex(({ id }) => id === right.sessionId),
    )
}

function EvaluationCell({
  day,
  period,
  sessionId,
  record,
}: {
  day: string
  period: EvaluationPeriod
  sessionId: SessionId | null
  record: EvaluationRecord | undefined
}) {
  if (!sessionId) {
    return <span aria-hidden="true" className="block h-8" />
  }

  const value = record?.value ?? null
  const marker = value ?? "missing"
  const sessionLabel = formatEvaluationSession(sessionId)

  return (
    <span
      aria-label={`${day} ${period}: ${value ?? "nessuna valutazione"}`}
      className={cn(
        "relative mx-auto flex h-8 min-w-10 max-w-14 items-center justify-center rounded-lg border px-2 text-sm font-black leading-none",
        EVALUATION_CELL_STYLES[marker],
      )}
      data-evaluation={marker}
      role="img"
      title={sessionLabel}
    >
      {value ?? ""}
      {record?.note && (
        <FileText
          aria-hidden="true"
          className="absolute -right-1 -top-1 size-3 rounded-full bg-card text-[#a34a18]"
        />
      )}
    </span>
  )
}

export interface WeeklyEvaluationGridProps {
  /** Evaluations for the displayed student, normally loaded from persistence. */
  records: readonly EvaluationRecord[]
  studentName?: string
  title?: string
  className?: string
}

/**
 * A phone-safe weekly evaluation summary shared by the profile and overview
 * surfaces. It intentionally uses a fixed three-column table, so the week is
 * readable without horizontal scrolling at the smallest supported viewport.
 */
export function WeeklyEvaluationGrid({
  records,
  studentName,
  title = "Storico valutazioni",
  className,
}: WeeklyEvaluationGridProps) {
  const titleId = useId()
  const [showAllNotes, setShowAllNotes] = useState(false)
  const rows = buildEvaluationDayRows()
  const recordsBySession = new Map(
    records.map((record) => [record.sessionId, record]),
  )
  const notes = sortNotes(records)
  const visibleNotes = showAllNotes ? notes : notes.slice(-2)
  const extraNotes = Math.max(notes.length - 2, 0)
  const subject = studentName ? ` di ${studentName}` : ""

  return (
    <section
      aria-labelledby={titleId}
      className={cn("mt-4 rounded-2xl border bg-card p-3 sm:p-4", className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-black" id={titleId}>
          {title}
        </h3>
        {rows.length > 0 && (
          <span className="text-[0.68rem] font-semibold text-muted-foreground">
            {rows.length} {rows.length === 1 ? "giorno" : "giorni"}
          </span>
        )}
      </div>

      <div className="mt-3 min-w-0 overflow-hidden rounded-xl border">
        <table
          aria-label={`Valutazioni settimanali${subject}`}
          className="w-full table-fixed border-collapse text-sm"
        >
          <thead className="bg-muted/70 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            <tr>
              <th className="w-[43%] px-3 py-2 text-left" scope="col">
                Giorno
              </th>
              <th className="w-[28.5%] px-2 py-2 text-center" scope="col">
                AM
              </th>
              <th className="w-[28.5%] px-2 py-2 text-center" scope="col">
                PM
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-t odd:bg-muted/20" key={row.day}>
                <th
                  className="truncate px-3 py-2.5 text-left text-sm font-bold"
                  scope="row"
                >
                  {row.day}
                </th>
                <td className="px-2 py-1.5 text-center">
                  <EvaluationCell
                    day={row.day}
                    period="AM"
                    record={row.am ? recordsBySession.get(row.am) : undefined}
                    sessionId={row.am}
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <EvaluationCell
                    day={row.day}
                    period="PM"
                    record={row.pm ? recordsBySession.get(row.pm) : undefined}
                    sessionId={row.pm}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {notes.length > 0 && (
        <div
          aria-label={`Note recenti${subject}`}
          className="mt-3 border-t pt-3"
          role="region"
        >
          <p className="text-xs font-bold text-muted-foreground">
            Note recenti
          </p>
          <div className="mt-2 grid gap-2">
            {visibleNotes.map((record) => (
              <article
                className="min-w-0 rounded-xl bg-muted/60 px-3 py-2"
                key={record.id}
              >
                <p className="text-[0.68rem] font-bold text-primary">
                  {formatEvaluationSession(record.sessionId)}
                </p>
                <p className="mt-0.5 overflow-hidden text-sm leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                  {record.note?.trim()}
                </p>
              </article>
            ))}
          </div>
          {extraNotes > 0 && (
            <button
              aria-expanded={showAllNotes}
              className="mt-2 min-h-11 rounded-lg px-2 text-sm font-bold text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
              onClick={() => setShowAllNotes((current) => !current)}
              type="button"
            >
              {showAllNotes ? "Mostra meno note" : "Altre note"}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
