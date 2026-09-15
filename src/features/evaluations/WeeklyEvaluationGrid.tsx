import { FileText } from "lucide-react"
import { useId, useState } from "react"

import { formatEvaluationSession } from "@/domain/evaluations"
import { SESSION_SEQUENCE, type SessionId } from "@/domain/config"
import type { EvaluationRecord } from "@/persistence/evaluations"
import { cn } from "@/lib/utils"

type EvaluationPeriod = "AM" | "PM"

interface EvaluationDayRow {
  day: string
  shortDay: string
  am: SessionId | null
  pm: SessionId | null
}

const EVALUATION_CELL_STYLES = {
  "++": "border-[#5b9b6a] bg-[#e4f3e7] text-[#23613a]",
  "+": "border-[#8abd93] bg-[#f0f8f1] text-[#327144]",
  "=": "border-[#a9b7c7] bg-[#f0f3f7] text-[#53667d]",
  "-": "border-[#dc8b8b] bg-[#fff0f0] text-[#a22c2c]",
  "--": "border-[#b95656] bg-[#ffe5e5] text-[#8a1c1c]",
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
      shortDay: session.day.slice(0, 3),
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
  studentName,
  noteOpen,
  onOpenNote,
}: {
  day: string
  period: EvaluationPeriod
  sessionId: SessionId | null
  record: EvaluationRecord | undefined
  studentName?: string
  noteOpen?: boolean
  onOpenNote?: (record: EvaluationRecord) => void
}) {
  if (!sessionId) {
    return <span aria-hidden="true" className="block h-8" />
  }

  const value = record?.value ?? null
  const marker = value ?? "missing"
  const sessionLabel = formatEvaluationSession(sessionId)
  const notePresent = Boolean(record?.note?.trim())
  const label = `${day} ${period}: ${value ?? "nessuna valutazione"}${notePresent && onOpenNote ? ", nota presente" : ""}`
  const accessibleLabel =
    studentName && notePresent ? `${studentName}, ${label}` : label
  const content = (
    <>
      {value ?? ""}
      {notePresent && (
        <FileText
          aria-hidden="true"
          className="absolute -right-[3px] -top-[3px] size-[12px] rounded-full bg-card text-[#a34a18]"
        />
      )}
    </>
  )

  if (notePresent && record && onOpenNote) {
    return (
      <button
        aria-label={accessibleLabel}
        aria-pressed={noteOpen}
        className={cn(
          "relative mx-auto flex h-7 min-h-7 w-full min-w-0 max-w-none items-center justify-center rounded-md border px-0 text-[14px] font-black leading-none outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          EVALUATION_CELL_STYLES[marker],
          noteOpen && "ring-2 ring-primary/50",
        )}
        data-evaluation={marker}
        data-session-id={sessionId}
        onClick={() => onOpenNote(record)}
        title={`${sessionLabel}: nota presente`}
        type="button"
      >
        {content}
      </button>
    )
  }

  return (
    <span
      aria-label={label}
      className={cn(
        "relative mx-auto flex h-7 min-h-7 w-full min-w-0 max-w-none items-center justify-center rounded-md border px-0 text-[14px] font-black leading-none",
        EVALUATION_CELL_STYLES[marker],
      )}
      data-evaluation={marker}
      data-session-id={sessionId}
      role="img"
      title={sessionLabel}
    >
      {content}
    </span>
  )
}

export interface WeeklyEvaluationGridProps {
  /** Evaluations for the displayed student, normally loaded from persistence. */
  records: readonly EvaluationRecord[]
  studentName?: string
  title?: string
  className?: string
  /** Hide the heading when the surrounding card already names the student. */
  showHeader?: boolean
  /** Hide the recent-notes list when the caller renders its own note detail. */
  showRecentNotes?: boolean
  /** Override the surrounding region label while retaining the table label. */
  ariaLabel?: string
  /** Make note cells open the exact session in the parent surface. */
  onOpenNote?: (record: EvaluationRecord) => void
  noteOpenSessionId?: SessionId | null
}

/**
 * A phone-safe weekly evaluation summary shared by the profile, overview and
 * history surfaces. Seven day columns are rendered with AM/PM stacked in each
 * day; the semantic table keeps the same day/session labels for assistive tech.
 */
export function WeeklyEvaluationGrid({
  records,
  studentName,
  title = "Storico valutazioni",
  className,
  showHeader = true,
  showRecentNotes = true,
  ariaLabel,
  onOpenNote,
  noteOpenSessionId = null,
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
      aria-label={
        !showHeader
          ? (ariaLabel ?? `Valutazioni settimanali${subject}`)
          : undefined
      }
      aria-labelledby={showHeader ? titleId : undefined}
      className={cn("mt-4 rounded-2xl border bg-card p-3 sm:p-4", className)}
    >
      {showHeader && (
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
      )}

      <div
        className={cn(
          "min-w-0 overflow-hidden rounded-xl border",
          showHeader && "mt-3",
        )}
      >
        <table
          aria-label={`Valutazioni settimanali${subject}`}
          className="w-full table-fixed border-collapse text-sm"
        >
          <thead className="sr-only">
            <tr>
              <th scope="col">Giorno</th>
              <th scope="col">AM</th>
              <th scope="col">PM</th>
            </tr>
          </thead>
          <tbody className="grid grid-cols-7 gap-[2px] p-[2px]">
            {rows.map((row) => (
              <tr
                className="grid min-w-0 grid-rows-[auto_auto_auto] gap-[1px] rounded-md border border-border/70 bg-muted/20 p-[2px]"
                key={row.day}
              >
                <th
                  aria-label={row.day}
                  className="min-w-0 truncate px-[1px] text-center text-[10px] font-bold leading-4"
                  scope="row"
                >
                  <span className="inline min-[521px]:hidden">
                    {row.shortDay}
                  </span>
                  <span className="hidden min-[521px]:inline">{row.day}</span>
                </th>
                <td className="min-w-0 px-0 text-center">
                  <span
                    aria-hidden="true"
                    className="block text-[8px] font-bold leading-3 text-muted-foreground"
                  >
                    AM
                  </span>
                  <EvaluationCell
                    day={row.day}
                    period="AM"
                    record={row.am ? recordsBySession.get(row.am) : undefined}
                    sessionId={row.am}
                    studentName={studentName}
                    noteOpen={row.am === noteOpenSessionId}
                    onOpenNote={onOpenNote}
                  />
                </td>
                <td className="min-w-0 px-0 text-center">
                  <span
                    aria-hidden="true"
                    className="block text-[8px] font-bold leading-3 text-muted-foreground"
                  >
                    PM
                  </span>
                  <EvaluationCell
                    day={row.day}
                    period="PM"
                    record={row.pm ? recordsBySession.get(row.pm) : undefined}
                    sessionId={row.pm}
                    studentName={studentName}
                    noteOpen={row.pm === noteOpenSessionId}
                    onOpenNote={onOpenNote}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showRecentNotes && notes.length > 0 && (
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
