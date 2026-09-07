import { LoaderCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { WeeklyEvaluationGrid } from "@/features/evaluations/WeeklyEvaluationGrid"
import {
  listStudentEvaluations,
  type EvaluationRecord,
} from "@/persistence/evaluations"

export function StudentEvaluationHistory({
  courseId,
  studentId,
  studentName,
  focusOnMount = false,
}: {
  courseId: string
  studentId: string
  studentName?: string
  focusOnMount?: boolean
}) {
  const [records, setRecords] = useState<EvaluationRecord[]>([])
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  )
  const sectionRef = useRef<HTMLElement>(null)

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

  useEffect(() => {
    if (focusOnMount && loadState === "ready") sectionRef.current?.focus()
  }, [focusOnMount, loadState])

  return (
    <section
      aria-label="Storico valutazioni"
      className="outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
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
        <p
          className="mt-4 rounded-2xl border bg-card p-4 text-sm font-semibold text-[#b42318]"
          role="alert"
        >
          Valutazioni non disponibili.
        </p>
      )}
      {loadState === "ready" && (
        <WeeklyEvaluationGrid
          records={records}
          studentName={studentName}
          title="Valutazioni"
        />
      )}
    </section>
  )
}
