import { FileText, LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"

import { formatEvaluationSession } from "@/domain/evaluations"
import {
  listStudentEvaluations,
  type EvaluationRecord,
} from "@/persistence/evaluations"

export function StudentEvaluationHistory({
  courseId,
  studentId,
}: {
  courseId: string
  studentId: string
}) {
  const [records, setRecords] = useState<EvaluationRecord[]>([])
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  )

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
  }, [courseId, studentId])

  return (
    <section
      className="mt-4 rounded-2xl border bg-card p-4"
      aria-labelledby="student-evaluation-history-title"
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
      {loadState === "ready" && records.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          Nessuna valutazione inserita.
        </p>
      )}
      {loadState === "ready" && records.length > 0 && (
        <div className="mt-3 divide-y rounded-xl bg-muted px-3">
          {records.map((record) => (
            <article className="py-3" key={record.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold">
                  {formatEvaluationSession(record.sessionId)}
                </p>
                <span
                  aria-label={`Valutazione ${record.value ?? "mancante"}`}
                  className="min-w-10 rounded-lg bg-card px-2 py-1 text-center text-sm font-black"
                >
                  {record.value ?? "—"}
                </span>
              </div>
              {record.note && (
                <p className="mt-2 flex items-start gap-2 whitespace-pre-wrap text-sm leading-6">
                  <FileText
                    aria-hidden="true"
                    className="mt-1 size-4 shrink-0 text-[#a34a18]"
                  />
                  {record.note}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
