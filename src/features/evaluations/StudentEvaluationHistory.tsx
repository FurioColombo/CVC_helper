import { FileText, LoaderCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import type { SessionId } from "@/domain/config"
import {
  formatEvaluationSession,
  getAccumulatedEvaluationSessions,
} from "@/domain/evaluations"
import {
  listCourseEvaluations,
  listStudentEvaluations,
  type EvaluationRecord,
} from "@/persistence/evaluations"

export function StudentEvaluationHistory({
  courseId,
  studentId,
  focusOnMount = false,
}: {
  courseId: string
  studentId: string
  focusOnMount?: boolean
}) {
  const [records, setRecords] = useState<EvaluationRecord[]>([])
  const [sessions, setSessions] = useState<SessionId[]>([])
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  )
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      listStudentEvaluations(courseId, studentId),
      listCourseEvaluations(courseId),
    ])
      .then(([evaluations, courseEvaluations]) => {
        if (!active) return
        setRecords(evaluations)
        setSessions(getAccumulatedEvaluationSessions(courseEvaluations))
        setLoadState("ready")
      })
      .catch(() => {
        if (active) setLoadState("error")
      })
    return () => {
      active = false
    }
  }, [courseId, studentId])

  useEffect(() => {
    if (focusOnMount && loadState === "ready") sectionRef.current?.focus()
  }, [focusOnMount, loadState])

  const recordsBySession = new Map(
    records.map((record) => [record.sessionId, record]),
  )

  return (
    <section
      className="mt-4 rounded-2xl border bg-card p-4"
      aria-labelledby="student-evaluation-history-title"
      ref={sectionRef}
      tabIndex={focusOnMount ? -1 : undefined}
    >
      <h3 className="text-sm font-black" id="student-evaluation-history-title">
        Storico valutazioni
      </h3>
      {loadState === "loading" && (
        <p
          className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Apertura storico…
        </p>
      )}
      {loadState === "error" && (
        <p className="mt-3 text-sm font-semibold text-[#b42318]" role="alert">
          Storico non disponibile.
        </p>
      )}
      {loadState === "ready" && sessions.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          Nessuna valutazione inserita.
        </p>
      )}
      {loadState === "ready" && sessions.length > 0 && (
        <div className="mt-3 divide-y rounded-xl bg-muted px-3">
          {sessions.map((sessionId) => {
            const record = recordsBySession.get(sessionId)
            return (
              <article className="py-3" key={sessionId}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold">
                    {formatEvaluationSession(sessionId)}
                  </p>
                  <span
                    aria-label={`Valutazione ${record?.value ?? "mancante"}`}
                    className="min-w-10 rounded-lg bg-card px-2 py-1 text-center text-sm font-black"
                  >
                    {record?.value ?? "—"}
                  </span>
                </div>
                {record?.note && (
                  <p className="mt-2 flex items-start gap-2 whitespace-pre-wrap text-sm leading-6">
                    <FileText
                      aria-hidden="true"
                      className="mt-1 size-4 shrink-0 text-[#a34a18]"
                    />
                    {record.note}
                  </p>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
