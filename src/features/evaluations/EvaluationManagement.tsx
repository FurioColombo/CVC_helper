import {
  ChevronLeft,
  FilePenLine,
  LoaderCircle,
  RotateCcw,
  UsersRound,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { transcribeAudio } from "@/capabilities/speech"
import { Button } from "@/components/ui/button"
import {
  EVALUATION_VALUES,
  SESSION_SEQUENCE,
  type EvaluationSymbol,
  type SessionId,
} from "@/domain/config"
import { getDefaultEvaluationSession } from "@/domain/evaluations"
import { getStudentDisplayName } from "@/domain/student"
import { EvaluationOverview } from "@/features/evaluations/EvaluationOverview"
import {
  DictationPanels,
  DictationTrigger,
} from "@/features/speech/DictationControls"
import { type DictationNaming } from "@/features/speech/dictationState"
import {
  useDictation,
  type SpeechPrepare,
  type SpeechTranscribe,
} from "@/features/speech/useDictation"
import type { CourseRecord } from "@/persistence/courses"
import { readCrewPlan, type CrewPlanRecord } from "@/persistence/crews"
import {
  listEvaluations,
  saveEvaluation,
  type EvaluationRecord,
} from "@/persistence/evaluations"
import { listStudents, type StudentRecord } from "@/persistence/students"

export type EvaluationView = "students" | "crews" | "overview"
interface EvaluationDraft {
  value: EvaluationSymbol | null
  note: string | null
}

function displayName(student: StudentRecord, students: StudentRecord[]) {
  return getStudentDisplayName(student, students)
}

function EvaluationNoteEditor({
  student,
  students,
  initialNote,
  sessionId,
  saving,
  onCancel,
  onSave,
  transcribe,
  prepareSpeech,
}: {
  student: StudentRecord
  students: StudentRecord[]
  initialNote: string | null
  sessionId: SessionId
  saving: boolean
  onCancel: () => void
  onSave: (note: string | null) => Promise<void>
  transcribe: SpeechTranscribe
  prepareSpeech?: SpeechPrepare
}) {
  const name = displayName(student, students)
  const fullName = `${student.firstName} ${student.surname}`.trim()
  const session = SESSION_SEQUENCE.find(({ id }) => id === sessionId)
  const [note, setNote] = useState(initialNote ?? "")
  const dictation = useDictation({
    value: note,
    onDraft: setNote,
    onAccept: () => undefined,
    transcribe,
    prepare: prepareSpeech,
  })
  const dictationNaming: DictationNaming = {
    start: `Detta nota valutazione di ${name}`,
    subject: `valutazione di ${name}`,
  }

  function cancelNote() {
    if (dictation.status !== "idle") dictation.cancel()
    onCancel()
  }

  return (
    <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <label
          className="min-w-0 text-sm font-black"
          htmlFor={`evaluation-note-${student.id}`}
        >
          Nota di {fullName} · {session?.day} {session?.period}
        </label>
        <DictationTrigger dictation={dictation} naming={dictationNaming} />
      </div>
      <textarea
        aria-label={`Nota valutazione di ${name}`}
        autoFocus
        className="mt-2 min-h-24 w-full resize-y rounded-xl border bg-card px-3 py-2.5 text-base leading-6 outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
        id={`evaluation-note-${student.id}`}
        onChange={(event) => {
          dictation.syncValue(event.target.value)
          setNote(event.target.value)
        }}
        placeholder="Nota facoltativa per questa sessione"
        value={note}
      />
      <DictationPanels
        className="mt-2"
        dictation={dictation}
        naming={dictationNaming}
        reviewHint="Rileggi la trascrizione. Il testo sarà salvato solo con la nota."
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          disabled={saving}
          onClick={cancelNote}
          type="button"
          variant="secondary"
        >
          Annulla
        </Button>
        <Button
          disabled={
            saving ||
            dictation.status === "permission" ||
            dictation.status === "recording" ||
            dictation.status === "loading" ||
            dictation.status === "processing" ||
            dictation.status === "review"
          }
          onClick={() => void onSave(note.trim() || null)}
          type="button"
        >
          {saving && (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          )}
          Salva nota
        </Button>
      </div>
    </div>
  )
}

function EvaluationCard({
  student,
  students,
  evaluation,
  sessionId,
  isLand,
  saving,
  saved,
  saveError,
  noteOpen,
  onValue,
  onOpenNote,
  onCloseNote,
  onSaveNote,
  transcribe,
  prepareSpeech,
  onRetry,
}: {
  student: StudentRecord
  students: StudentRecord[]
  evaluation: EvaluationDraft
  sessionId: SessionId
  isLand: boolean
  saving: boolean
  saved: boolean
  saveError: boolean
  noteOpen: boolean
  onValue: (value: EvaluationSymbol | null) => void
  onOpenNote: () => void
  onCloseNote: () => void
  onSaveNote: (note: string | null) => Promise<void>
  transcribe: SpeechTranscribe
  prepareSpeech?: SpeechPrepare
  onRetry: () => void
}) {
  const name = displayName(student, students)
  const fullName = `${student.firstName} ${student.surname}`.trim()
  const noteSummary = evaluation.note?.trim() ?? ""
  const noteButtonRef = useRef<HTMLButtonElement>(null)
  const wasNoteOpen = useRef(noteOpen)

  useEffect(() => {
    if (wasNoteOpen.current && !noteOpen) {
      window.requestAnimationFrame(() => noteButtonRef.current?.focus())
    }
    wasNoteOpen.current = noteOpen
  }, [noteOpen])

  function closeNote() {
    onCloseNote()
  }
  return (
    <article className="min-w-0">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_200px] overflow-hidden rounded-xl border bg-card">
        <button
          aria-description={`Nome completo: ${fullName}${isLand ? ", A terra" : ""}${!student.active ? ", non disponibile" : ""}${evaluation.note ? ", nota presente" : ""}`}
          aria-expanded={noteOpen}
          aria-label={`${evaluation.note ? "Modifica" : "Aggiungi"} nota valutazione di ${name}`}
          className="flex min-h-[40px] min-w-0 items-center justify-between gap-1 border-r px-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40"
          disabled={saving}
          onClick={onOpenNote}
          ref={noteButtonRef}
          title={fullName}
          type="button"
        >
          <span className="min-w-0 truncate text-[0.8125rem] font-bold max-[350px]:text-[0.75rem]">
            {fullName}
            {isLand && <small className="text-[#8a4b08]"> · terra</small>}
            {!student.active && (
              <small className="text-muted-foreground">
                {" "}
                · non disponibile
              </small>
            )}
          </span>
          <FilePenLine
            aria-hidden="true"
            className="size-4 shrink-0 text-primary max-[350px]:hidden"
          />
        </button>
        <div
          className="grid grid-cols-5"
          role="group"
          aria-label={`Valutazione di ${name}`}
        >
          {EVALUATION_VALUES.map(({ symbol }) => (
            <button
              aria-label={`Valutazione di ${name}: ${symbol}`}
              aria-pressed={evaluation.value === symbol}
              className={`grid h-[40px] w-[40px] place-items-center border-l outline-none transition-colors focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40 disabled:opacity-50 ${symbol.includes("+") ? "text-[#18794e] aria-pressed:bg-[#e4f4e9] aria-pressed:shadow-[inset_0_0_0_2px_#18794e]" : symbol.includes("-") ? "text-[#b42318] aria-pressed:bg-[#fbe8e7] aria-pressed:shadow-[inset_0_0_0_2px_#b42318]" : "text-[#244462] aria-pressed:bg-[#e5effb] aria-pressed:shadow-[inset_0_0_0_2px_#244462]"}`}
              disabled={saving}
              key={symbol}
              onClick={() =>
                onValue(evaluation.value === symbol ? null : symbol)
              }
              type="button"
            >
              <EvaluationMark symbol={symbol} />
            </button>
          ))}
        </div>
      </div>
      {isLand && evaluation.value === null && (
        <p className="mt-1 text-xs font-bold text-[#9a4b12]" role="status">
          Valutazione mancante: resta comunque valutabile.
        </p>
      )}
      {/* The note and the save state share one line: they never compete for
          attention — the state is empty except for the moment around a write —
          and a line each cost every row 1rem of screen. The note itself is
          shown, not the word "nota": what was written is the useful thing at a
          glance. Two lines cap the row height however long the note is, and
          the name button above opens it in full. The wrapper and the live
          region stay mounted whatever the state, because a live region
          inserted together with its text is not announced. */}
      <div className="mt-1 flex min-w-0 items-start gap-2 text-xs leading-4">
        {noteSummary && (
          <p className="flex min-w-0 flex-1 items-start gap-1.5 text-muted-foreground">
            <FilePenLine
              aria-hidden="true"
              className="mt-px size-3.5 shrink-0 text-primary"
            />
            <span className="line-clamp-2 min-w-0">{noteSummary}</span>
          </p>
        )}
        <div
          aria-label={`Stato salvataggio valutazione di ${name}`}
          aria-live="polite"
          className={`ml-auto shrink-0 text-right font-semibold ${saveError ? "text-[#b42318]" : "text-muted-foreground"}`}
        >
          {saving
            ? "Salvataggio…"
            : saveError
              ? "Non salvato"
              : saved
                ? "Salvato"
                : ""}
        </div>
      </div>
      {saveError && (
        <button
          aria-label={`Riprova salvataggio valutazione di ${name}`}
          className="ml-auto flex min-h-10 items-center gap-1 text-xs font-bold text-[#b42318] underline underline-offset-2"
          onClick={onRetry}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" /> Riprova
          salvataggio
        </button>
      )}
      {noteOpen && (
        <EvaluationNoteEditor
          initialNote={evaluation.note}
          sessionId={sessionId}
          onCancel={closeNote}
          onSave={onSaveNote}
          saving={saving}
          student={student}
          students={students}
          transcribe={transcribe}
          prepareSpeech={prepareSpeech}
        />
      )}
    </article>
  )
}

function EvaluationMark({ symbol }: { symbol: EvaluationSymbol }) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
  }
  return (
    <svg aria-hidden="true" className="h-[24px] w-[24px]" viewBox="0 0 24 24">
      {symbol === "++" && (
        <>
          <path d="M7 7v10M2 12h10" {...stroke} />
          <path d="M17 7v10M12 12h10" {...stroke} />
        </>
      )}
      {symbol === "+" && <path d="M12 7v10M7 12h10" {...stroke} />}
      {symbol === "=" && <path d="M6 9h12M6 15h12" {...stroke} />}
      {symbol === "-" && <path d="M7 12h10" {...stroke} />}
      {symbol === "--" && <path d="M2 12h9M13 12h9" {...stroke} />}
    </svg>
  )
}

export function EvaluationManagement({
  course,
  onHome,
  onOpenStudent,
  initialSessionId,
  onSessionChange,
  initialView = "students",
  onViewChange,
  referenceDate = new Date(),
  transcribe = transcribeAudio,
  prepareSpeech,
}: {
  course: CourseRecord
  onHome: () => void
  onOpenStudent?: (studentId: string) => void
  initialSessionId?: SessionId
  onSessionChange?: (sessionId: SessionId) => void
  initialView?: EvaluationView
  onViewChange?: (view: EvaluationView) => void
  referenceDate?: Date
  transcribe?: SpeechTranscribe
  prepareSpeech?: SpeechPrepare
}) {
  const [sessionId, setSessionId] = useState<SessionId>(
    () =>
      initialSessionId ??
      getDefaultEvaluationSession(course.startDate, referenceDate),
  )
  const [view, setView] = useState<EvaluationView>(initialView)
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [crewPlan, setCrewPlan] = useState<CrewPlanRecord | null>(null)
  const [records, setRecords] = useState<Map<string, EvaluationRecord>>(
    new Map(),
  )
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [saveErrors, setSaveErrors] = useState<Set<string>>(new Set())
  const [noteStudentId, setNoteStudentId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      listStudents(course.id),
      readCrewPlan(course.id, sessionId),
      listEvaluations(course.id, sessionId),
    ])
      .then(([nextStudents, nextCrewPlan, evaluations]) => {
        if (!active) return
        setStudents(nextStudents)
        setCrewPlan(nextCrewPlan)
        setRecords(
          new Map(evaluations.map((record) => [record.studentId, record])),
        )
        setSavedIds(new Set())
        setSaveErrors(new Set())
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setLoadError(true)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [course.id, retry, sessionId])

  const studentsById = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students],
  )
  const landIds = useMemo(
    () => new Set(crewPlan?.landStudentIds ?? []),
    [crewPlan],
  )

  async function persistStudent(
    studentId: string,
    next: EvaluationDraft,
  ): Promise<boolean> {
    const previous = records.get(studentId)
    setRecords((current) => {
      const copy = new Map(current)
      copy.set(studentId, {
        id: previous?.id ?? `pending-${studentId}`,
        studentId,
        sessionId,
        ...next,
      })
      return copy
    })
    setSavingIds((current) => new Set(current).add(studentId))
    setSavedIds((current) => {
      const copy = new Set(current)
      copy.delete(studentId)
      return copy
    })
    setSaveErrors((current) => {
      const copy = new Set(current)
      copy.delete(studentId)
      return copy
    })
    try {
      const saved = await saveEvaluation(course.id, studentId, sessionId, next)
      setRecords((current) => {
        const copy = new Map(current)
        if (saved) copy.set(studentId, saved)
        else copy.delete(studentId)
        return copy
      })
      setSavedIds((current) => new Set(current).add(studentId))
      return true
    } catch {
      // Keep the attempted value on screen so the user can retry or correct it.
      setSaveErrors((current) => new Set(current).add(studentId))
      return false
    } finally {
      setSavingIds((current) => {
        const copy = new Set(current)
        copy.delete(studentId)
        return copy
      })
    }
  }

  function renderCard(student: StudentRecord) {
    const evaluation = records.get(student.id) ?? { value: null, note: null }
    return (
      <EvaluationCard
        evaluation={evaluation}
        sessionId={sessionId}
        isLand={landIds.has(student.id)}
        key={student.id}
        noteOpen={noteStudentId === student.id}
        onCloseNote={() => setNoteStudentId(null)}
        onOpenNote={() => setNoteStudentId(student.id)}
        onSaveNote={async (note) => {
          const saved = await persistStudent(student.id, {
            value: evaluation.value,
            note,
          })
          if (saved) setNoteStudentId(null)
        }}
        onValue={(value) =>
          void persistStudent(student.id, { value, note: evaluation.note })
        }
        onRetry={() =>
          void persistStudent(student.id, {
            value: evaluation.value,
            note: evaluation.note,
          })
        }
        saved={savedIds.has(student.id)}
        saveError={saveErrors.has(student.id)}
        saving={savingIds.has(student.id)}
        student={student}
        students={students}
        transcribe={transcribe}
        prepareSpeech={prepareSpeech}
      />
    )
  }

  const assignedIds = new Set(
    crewPlan?.crews.flatMap((crew) =>
      crew.members
        .filter(({ personType }) => personType === "student")
        .map(({ personId }) => personId),
    ) ?? [],
  )
  const unassigned = students.filter(
    ({ id }) => !assignedIds.has(id) && !landIds.has(id),
  )

  function changeView(nextView: EvaluationView) {
    if (savingIds.size > 0 || noteStudentId !== null) return
    setView(nextView)
    onViewChange?.(nextView)
  }

  return (
    <>
      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-1">
        <button
          aria-label="Indietro da Valutazioni"
          className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          disabled={savingIds.size > 0 || noteStudentId !== null}
          onClick={onHome}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="h-[20px] w-[20px]" />
        </button>
        <div className="min-w-0 flex-none">
          <h1 className="text-2xl font-black tracking-tight">Valutazioni</h1>
        </div>
        {view !== "overview" && (
          <select
            aria-label="Sessione valutazioni"
            className="h-[44px] min-w-[160px] max-w-full flex-1 rounded-xl border bg-card px-[8px] text-sm font-bold outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50"
            disabled={loading || savingIds.size > 0 || noteStudentId !== null}
            onChange={(event) => {
              const nextSessionId = event.target.value as SessionId
              if (nextSessionId === sessionId) return
              setLoading(true)
              setLoadError(false)
              setNoteStudentId(null)
              setSessionId(nextSessionId)
              onSessionChange?.(nextSessionId)
            }}
            value={sessionId}
          >
            {SESSION_SEQUENCE.map(({ id, day, period }) => (
              <option key={id} value={id}>
                {day} · {period}
              </option>
            ))}
          </select>
        )}
      </div>

      <div
        className="flex min-w-0 flex-wrap gap-[4px] rounded-xl bg-muted p-[4px]"
        role="group"
        aria-label="Vista valutazioni"
      >
        <button
          aria-pressed={view === "students"}
          className="min-h-[40px] min-w-max flex-[1_1_auto] rounded-lg px-[8px] text-sm font-black outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50 aria-pressed:bg-card aria-pressed:text-primary aria-pressed:shadow-sm"
          disabled={savingIds.size > 0 || noteStudentId !== null}
          onClick={() => changeView("students")}
          type="button"
        >
          Allievi
        </button>
        <button
          aria-pressed={view === "crews"}
          className="min-h-[40px] min-w-max flex-[1_1_auto] rounded-lg px-[8px] text-sm font-black outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50 aria-pressed:bg-card aria-pressed:text-primary aria-pressed:shadow-sm"
          disabled={savingIds.size > 0 || noteStudentId !== null}
          onClick={() => changeView("crews")}
          type="button"
        >
          Equipaggi
        </button>
        <button
          aria-pressed={view === "overview"}
          className="min-h-[40px] min-w-max flex-[1_1_auto] rounded-lg px-[8px] text-xs font-black outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50 aria-pressed:bg-card aria-pressed:text-primary aria-pressed:shadow-sm"
          disabled={savingIds.size > 0 || noteStudentId !== null}
          onClick={() => changeView("overview")}
          type="button"
        >
          Riepilogo
        </button>
      </div>

      {loadError && (
        <section
          className="mt-5 rounded-2xl border bg-card p-5 text-center"
          role="alert"
        >
          <p className="font-black">Valutazioni non disponibili</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nessun dato è stato cancellato.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setLoading(true)
              setLoadError(false)
              setRetry((value) => value + 1)
            }}
            variant="secondary"
          >
            Riprova
          </Button>
        </section>
      )}
      {loading && !loadError && (
        <div
          className="mt-8 text-center text-sm font-semibold text-muted-foreground"
          role="status"
        >
          <LoaderCircle
            aria-hidden="true"
            className="mx-auto mb-2 size-6 animate-spin"
          />
          Apertura valutazioni…
        </div>
      )}
      {!loading && !loadError && students.length === 0 && (
        <section className="mt-5 rounded-2xl border bg-card p-5 text-center">
          <UsersRound
            aria-hidden="true"
            className="mx-auto size-7 text-primary"
          />
          <h2 className="mt-3 text-lg font-black">
            Prima aggiungi gli allievi
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Le valutazioni compariranno qui.
          </p>
        </section>
      )}
      {!loading && !loadError && students.length > 0 && view === "overview" && (
        <EvaluationOverview
          courseId={course.id}
          onOpenStudent={onOpenStudent ?? (() => undefined)}
          students={students}
        />
      )}
      {!loading && !loadError && students.length > 0 && view !== "overview" && (
        <div className="mt-3 grid gap-1.5">
          {view === "students" && students.map(renderCard)}
          {view === "crews" && (
            <>
              {(crewPlan?.crews ?? []).map((crew, index) => {
                const members = crew.members.flatMap(
                  ({ personId, personType }) => {
                    const student =
                      personType === "student"
                        ? studentsById.get(personId)
                        : undefined
                    return student ? [student] : []
                  },
                )
                if (members.length === 0) return null
                return (
                  <section
                    className="grid gap-3"
                    key={crew.id}
                    aria-labelledby={`evaluation-crew-${crew.id}`}
                  >
                    <h2
                      className="mt-2 text-sm font-black text-primary"
                      id={`evaluation-crew-${crew.id}`}
                    >
                      Equipaggio {index + 1}
                    </h2>
                    {members.map(renderCard)}
                  </section>
                )
              })}
              {landIds.size > 0 && (
                <section
                  className="grid gap-3"
                  aria-labelledby="evaluation-land-title"
                >
                  <h2
                    className="mt-2 text-sm font-black text-[#9a4b12]"
                    id="evaluation-land-title"
                  >
                    A terra
                  </h2>
                  {students.filter(({ id }) => landIds.has(id)).map(renderCard)}
                </section>
              )}
              {unassigned.length > 0 && (
                <section
                  className="grid gap-3"
                  aria-labelledby="evaluation-unassigned-title"
                >
                  <h2
                    className="mt-2 text-sm font-black text-muted-foreground"
                    id="evaluation-unassigned-title"
                  >
                    Non assegnati
                  </h2>
                  {unassigned.map(renderCard)}
                </section>
              )}
            </>
          )}
          {saveErrors.size > 0 && (
            <p
              className="rounded-xl border border-[#f0b69f] bg-[#fff4ee] p-3 text-sm font-semibold text-[#9a3412]"
              role="alert"
            >
              Una modifica non è stata salvata. Riprova sul relativo allievo.
            </p>
          )}
        </div>
      )}
    </>
  )
}
