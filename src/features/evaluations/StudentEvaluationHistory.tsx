import { LoaderCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { SESSION_SEQUENCE, type SessionId } from "@/domain/config"
import { formatEvaluationSession } from "@/domain/evaluations"
import { WeeklyEvaluationGrid } from "@/features/evaluations/WeeklyEvaluationGrid"
import {
  listStudentEvaluations,
  type EvaluationRecord,
} from "@/persistence/evaluations"

interface HistoryDay {
  day: string
  sessions: Array<{
    id: SessionId
    period: "AM" | "PM"
  }>
}

function buildHistoryDays(): HistoryDay[] {
  return SESSION_SEQUENCE.reduce<HistoryDay[]>((days, session) => {
    const current = days.find(({ day }) => day === session.day)
    if (current) {
      current.sessions.push({ id: session.id, period: session.period })
    } else {
      days.push({
        day: session.day,
        sessions: [{ id: session.id, period: session.period }],
      })
    }
    return days
  }, [])
}

function evaluationTone(value: EvaluationRecord["value"]) {
  if (value?.includes("+")) return "positive"
  if (value?.includes("-")) return "negative"
  if (value === "=") return "neutral"
  return "empty"
}

function sessionCountLabel(count: number) {
  return `${count} ${count === 1 ? "sessione" : "sessioni"}`
}

function HistorySessionCard({
  period,
  sessionId,
  record,
  onOpenSession,
}: {
  period: "AM" | "PM"
  sessionId: SessionId
  record: EvaluationRecord | undefined
  onOpenSession: (sessionId: SessionId) => void
}) {
  const sessionLabel = formatEvaluationSession(sessionId)
  const value = record?.value ?? null
  const note = record?.note?.trim() ?? ""
  const tone = evaluationTone(value)
  const actionId = `history-session-action-${sessionId}`
  const noteId = `history-session-note-${sessionId}`

  return (
    <button
      aria-describedby={note ? noteId : undefined}
      aria-labelledby={actionId}
      className="flex min-h-11 min-w-0 w-full flex-col rounded-xl border bg-muted/45 px-2.5 py-2 text-left text-xs leading-5 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
      data-evaluation={value ?? "empty"}
      data-session-id={sessionId}
      onClick={() => onOpenSession(sessionId)}
      type="button"
    >
      <span className="sr-only" id={actionId}>
        Apri Valutazioni di {sessionLabel}; valutazione {value ?? "mancante"}
      </span>
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-sm font-bold text-foreground">
          {period}
        </span>
        <span
          aria-hidden="true"
          className={`grid size-7 shrink-0 place-items-center rounded-lg border text-sm font-black leading-none ${
            tone === "positive"
              ? "border-[#8abd93] bg-[#f0f8f1] text-[#327144]"
              : tone === "negative"
                ? "border-[#dc8b8b] bg-[#fff0f0] text-[#a22c2c]"
                : tone === "neutral"
                  ? "border-[#a9b7c7] bg-[#f0f3f7] text-[#53667d]"
                  : "border-border bg-background text-transparent"
          }`}
          title={value ? `Valutazione ${value}` : "Nessuna valutazione"}
        >
          {value ?? ""}
        </span>
      </span>
      {note && (
        <span
          className="mt-1 block break-words whitespace-pre-wrap text-muted-foreground"
          id={noteId}
        >
          {note}
        </span>
      )}
    </button>
  )
}

function MissingSessionCard({
  day,
  period,
}: {
  day: string
  period: "AM" | "PM"
}) {
  return (
    <article
      aria-label={`Sessione ${day} ${period}; nessuna sessione`}
      className="min-w-0 rounded-xl border border-dashed bg-background px-2.5 py-2 text-xs leading-5 text-muted-foreground"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="truncate text-sm font-bold text-foreground">{period}</h4>
        <span aria-hidden="true" className="size-7 shrink-0" />
      </div>
      <p className="mt-1">Nessuna sessione.</p>
    </article>
  )
}

export function StudentEvaluationHistory({
  courseId,
  studentId,
  studentName,
  studentFullName,
  focusOnMount = false,
  onOpenEvaluationSession,
}: {
  courseId: string
  studentId: string
  studentName?: string
  studentFullName?: string
  focusOnMount?: boolean
  onOpenEvaluationSession: (sessionId: SessionId) => void
}) {
  const [records, setRecords] = useState<EvaluationRecord[]>([])
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  )
  const [reloadToken, setReloadToken] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)
  const historyDays = buildHistoryDays()
  const subjectName = studentFullName?.trim() || studentName || "Allievo"

  useEffect(() => {
    let active = true
    listStudentEvaluations(courseId, studentId)
      .then((evaluations) => {
        if (!active) return
        setRecords(evaluations)
        setLoadState("ready")
      })
      .catch(() => {
        if (active) setLoadState("error")
      })
    return () => {
      active = false
    }
  }, [courseId, reloadToken, studentId])

  useEffect(() => {
    if (focusOnMount && loadState === "ready") sectionRef.current?.focus()
  }, [focusOnMount, loadState])

  return (
    <section
      aria-label="Storico valutazioni"
      className="min-w-0 max-w-full outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
      ref={sectionRef}
      tabIndex={focusOnMount ? -1 : undefined}
    >
      {loadState === "loading" && (
        <p
          className="mt-4 flex items-center gap-2 rounded-2xl border bg-card p-4 text-sm text-muted-foreground"
          role="status"
        >
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Apertura valutazioni…
        </p>
      )}
      {loadState === "error" && (
        <div
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4"
          role="alert"
        >
          <p className="text-sm font-semibold text-[#b42318]">
            Valutazioni non disponibili.
          </p>
          <button
            className="min-h-11 rounded-xl border px-3 text-sm font-bold text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            onClick={() => {
              setLoadState("loading")
              setReloadToken((token) => token + 1)
            }}
            type="button"
          >
            Riprova
          </button>
        </div>
      )}
      {loadState === "ready" && (
        <>
          <WeeklyEvaluationGrid
            className="mt-0"
            records={records}
            showRecentNotes={false}
            studentName={studentName}
            title="Riepilogo settimana"
          />

          <div className="sticky top-0 z-10 -mx-1 mb-2 min-w-0 max-w-full border-b bg-background/95 px-1 py-3 shadow-[0_4px_12px_rgb(23_56_89/0.06)] backdrop-blur-sm">
            <h2 className="break-words text-xl font-black leading-tight text-foreground">
              {subjectName}
            </h2>
            <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
              Storia del corso
            </p>
          </div>

          <div
            className="mt-2 grid min-w-0 max-w-full gap-2"
            aria-label="Cronologia per giorno"
          >
            {historyDays.map(({ day, sessions }) => (
              <section
                aria-labelledby={`history-day-${day}`}
                className="min-w-0 max-w-full rounded-2xl border bg-card p-2"
                key={day}
              >
                <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-1 border-b pb-1.5">
                  <h3 className="text-sm font-black" id={`history-day-${day}`}>
                    {day}
                  </h3>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {sessionCountLabel(sessions.length)}
                  </span>
                </div>
                <div className="mt-1.5 grid min-w-0 grid-cols-2 gap-1.5">
                  {(["AM", "PM"] as const).map((period) => {
                    const session = sessions.find(
                      ({ period: sessionPeriod }) => sessionPeriod === period,
                    )
                    if (!session) {
                      return (
                        <MissingSessionCard
                          day={day}
                          key={period}
                          period={period}
                        />
                      )
                    }
                    return (
                      <HistorySessionCard
                        key={session.id}
                        onOpenSession={onOpenEvaluationSession}
                        period={period}
                        sessionId={session.id}
                        record={records.find(
                          ({ sessionId }) => sessionId === session.id,
                        )}
                      />
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
