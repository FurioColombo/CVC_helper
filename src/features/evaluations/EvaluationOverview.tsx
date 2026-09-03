import { FileText, LoaderCircle, UserRound } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import type { EvaluationOrdering } from "@/domain/evaluations"
import {
  formatEvaluationSession,
  getAccumulatedEvaluationSessions,
  sortStudentsByEvaluations,
  summarizeEvaluations,
} from "@/domain/evaluations"
import { getStudentDisplayName } from "@/domain/student"
import {
  listCourseEvaluations,
  type EvaluationRecord,
} from "@/persistence/evaluations"
import type { StudentRecord } from "@/persistence/students"

function countLabel(count: number) {
  return count === 1 ? "1 valutazione" : `${count} valutazioni`
}

function compactSessionLabel(sessionId: EvaluationRecord["sessionId"]) {
  const [day, period] = formatEvaluationSession(sessionId).split(" ")
  return `${day!.slice(0, 3)} ${period![0]}`
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
  const sessions = getAccumulatedEvaluationSessions(records)
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
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black" id="evaluation-overview-title">
            Riepilogo del corso
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Le caselle vuote non contano nella valutazione complessiva.
          </p>
        </div>
      </div>
      <div
        className="mt-3 grid grid-cols-2 gap-2"
        role="group"
        aria-label="Ordine riepilogo"
      >
        <Button
          aria-pressed={ordering === "alphabetical"}
          className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          onClick={() => setOrdering("alphabetical")}
          type="button"
          variant="secondary"
        >
          Alfabetico
        </Button>
        <Button
          aria-pressed={ordering === "strongest"}
          className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          onClick={() => setOrdering("strongest")}
          type="button"
          variant="secondary"
        >
          Più forti
        </Button>
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
                className="min-w-0 max-w-full rounded-2xl border bg-card p-4"
                key={student.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    aria-label={`Apri dettaglio di ${name}, cognome ${student.surname}`}
                    className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                    onClick={() => onOpenStudent(student.id)}
                    type="button"
                  >
                    <UserRound
                      aria-hidden="true"
                      className="size-5 shrink-0 text-primary"
                    />
                    <span className="min-w-0">
                      <h3 className="truncate text-base font-black">{name}</h3>
                      <span className="block truncate text-xs text-muted-foreground">
                        {student.surname}
                      </span>
                    </span>
                  </button>
                  <span className="shrink-0 text-xs font-bold text-muted-foreground">
                    {countLabel(summary.count)}
                  </span>
                </div>
                <div
                  aria-label={`Sequenza valutazioni di ${name}`}
                  className="mt-3 flex w-full min-w-0 max-w-full gap-1.5 overflow-x-auto pb-1"
                >
                  {sessions.map((sessionId) => {
                    const key = `${student.id}:${sessionId}`
                    const record = recordsByKey.get(key)
                    const label = formatEvaluationSession(sessionId)
                    const content = (
                      <>
                        <span className="text-[0.58rem] font-bold text-muted-foreground uppercase">
                          {compactSessionLabel(sessionId)}
                        </span>
                        <span className="text-xs font-black">
                          {record?.value ?? "—"}
                        </span>
                        {record?.note && (
                          <FileText
                            aria-hidden="true"
                            className="absolute -top-1 -right-1 size-3 rounded-full bg-card text-[#a34a18]"
                          />
                        )}
                      </>
                    )
                    return record?.note ? (
                      <button
                        aria-label={`${name}, ${label}: ${record.value ?? "mancante"}, nota presente`}
                        aria-pressed={openNoteKey === key}
                        className="relative flex size-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/40 aria-pressed:border-primary aria-pressed:bg-primary/10"
                        key={sessionId}
                        onClick={() =>
                          setOpenNoteKey((current) =>
                            current === key ? null : key,
                          )
                        }
                        type="button"
                      >
                        {content}
                      </button>
                    ) : (
                      <span
                        aria-label={`${name}, ${label}: ${record?.value ?? "mancante"}`}
                        className="relative flex size-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border bg-muted"
                        key={sessionId}
                        role="img"
                      >
                        {content}
                      </span>
                    )
                  })}
                </div>
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
