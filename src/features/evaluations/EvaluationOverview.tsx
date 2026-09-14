import { LoaderCircle, UserRound } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import type { EvaluationOrdering } from "@/domain/evaluations"
import {
  formatEvaluationSession,
  sortStudentsByEvaluations,
  summarizeEvaluations,
} from "@/domain/evaluations"
import { getStudentDisplayName } from "@/domain/student"
import { WeeklyEvaluationGrid } from "@/features/evaluations/WeeklyEvaluationGrid"
import {
  listCourseEvaluations,
  type EvaluationRecord,
} from "@/persistence/evaluations"
import type { StudentRecord } from "@/persistence/students"

function countLabel(count: number) {
  return count === 1 ? "1 valutazione" : `${count} valutazioni`
}

export function EvaluationOverview({
  courseId,
  students,
  onOpenStudent,
}: {
  courseId: string
  students: StudentRecord[]
  onOpenStudent: (studentId: string) => void
}) {
  const [records, setRecords] = useState<EvaluationRecord[]>([])
  const [ordering, setOrdering] = useState<EvaluationOrdering>("alphabetical")
  const [openNoteKey, setOpenNoteKey] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  )

  useEffect(() => {
    let active = true
    listCourseEvaluations(courseId)
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
  }, [courseId])

  const orderedStudents = useMemo(
    () => sortStudentsByEvaluations(students, records, ordering),
    [ordering, records, students],
  )
  const recordsByKey = new Map(
    records.map((record) => [
      `${record.studentId}:${record.sessionId}`,
      record,
    ]),
  )

  if (loadState === "loading") {
    return (
      <div
        className="mt-8 text-center text-sm font-semibold text-muted-foreground"
        role="status"
      >
        <LoaderCircle
          aria-hidden="true"
          className="mx-auto mb-2 size-6 animate-spin"
        />
        Preparazione riepilogo…
      </div>
    )
  }
  if (loadState === "error") {
    return (
      <p
        className="mt-5 rounded-2xl border bg-card p-4 text-sm font-semibold text-[#b42318]"
        role="alert"
      >
        Riepilogo non disponibile. Riapri Valutazioni per riprovare.
      </p>
    )
  }

  return (
    <section className="mt-4" aria-labelledby="evaluation-overview-title">
      <div>
        <h2 className="text-lg font-black" id="evaluation-overview-title">
          Riepilogo del corso
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Le caselle vuote non contano nella valutazione complessiva.
        </p>
      </div>
      <div className="mt-3">
        <span className="block px-1 text-xs font-bold text-muted-foreground">
          Ordinamento
        </span>
        <div
          className="mt-1 grid grid-cols-2 gap-2"
          role="group"
          aria-label="Ordine riepilogo"
        >
          <button
            aria-pressed={ordering === "alphabetical"}
            className="min-h-10 rounded-xl border bg-card px-3 text-sm font-bold outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            onClick={() => setOrdering("alphabetical")}
            type="button"
          >
            Alfabetico
          </button>
          <button
            aria-pressed={ordering === "strongest"}
            className="min-h-10 rounded-xl border bg-card px-3 text-sm font-bold outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            onClick={() => setOrdering("strongest")}
            title="Ordina per valutazione"
            type="button"
          >
            Valutazione
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="mt-4 rounded-2xl border bg-card p-5 text-center">
          <p className="font-black">Nessuna valutazione inserita</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Il riepilogo si comporrà sessione dopo sessione.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid min-w-0 gap-3">
          {orderedStudents.map((student) => {
            const name = getStudentDisplayName(student, students)
            const studentRecords = records.filter(
              ({ studentId }) => studentId === student.id,
            )
            const summary = summarizeEvaluations(
              studentRecords.map(({ value }) => value),
            )
            return (
              <article
                className="min-w-0 max-w-full rounded-2xl border bg-card p-3"
                key={student.id}
              >
                <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <button
                    aria-label={`Apri dettaglio di ${name}, cognome ${student.surname}`}
                    className="flex min-h-10 min-w-[160px] flex-1 items-center gap-2 rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                    onClick={() => onOpenStudent(student.id)}
                    type="button"
                  >
                    <UserRound
                      aria-hidden="true"
                      className="size-4 shrink-0 text-primary"
                    />
                    <span className="min-w-0 break-words">
                      <h3 className="break-words text-sm font-black">{name}</h3>
                      <span className="block break-words text-[0.68rem] text-muted-foreground">
                        {student.surname}
                      </span>
                    </span>
                  </button>
                  <span className="shrink-0 text-xs font-bold text-muted-foreground">
                    {countLabel(summary.count)}
                  </span>
                </div>
                <WeeklyEvaluationGrid
                  ariaLabel={`Sequenza valutazioni di ${name}`}
                  className="mt-2 border-0 bg-transparent p-0"
                  noteOpenSessionId={
                    openNoteKey?.startsWith(`${student.id}:`)
                      ? (openNoteKey.split(
                          ":",
                        )[1] as EvaluationRecord["sessionId"])
                      : null
                  }
                  onOpenNote={(record) => {
                    const key = `${student.id}:${record.sessionId}`
                    setOpenNoteKey((current) => (current === key ? null : key))
                  }}
                  records={studentRecords}
                  showHeader={false}
                  showRecentNotes={false}
                  studentName={name}
                />
                {openNoteKey?.startsWith(`${student.id}:`) && (
                  <div
                    className="mt-3 rounded-xl bg-muted p-3"
                    role="region"
                    aria-label={`Nota di ${name}`}
                  >
                    <p className="text-xs font-bold text-primary">
                      {formatEvaluationSession(
                        recordsByKey.get(openNoteKey)!.sessionId,
                      )}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                      {recordsByKey.get(openNoteKey)!.note}
                    </p>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
