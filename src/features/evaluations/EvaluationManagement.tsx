import {
  Check,
  ChevronLeft,
  FilePenLine,
  LoaderCircle,
  Mic,
  Square,
  Trash2,
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
import type { CourseRecord } from "@/persistence/courses"
import { readCrewPlan, type CrewPlanRecord } from "@/persistence/crews"
import {
  listEvaluations,
  saveEvaluation,
  type EvaluationRecord,
} from "@/persistence/evaluations"
import { listStudents, type StudentRecord } from "@/persistence/students"

type EvaluationView = "students" | "crews"
type VoiceStatus = "idle" | "recording" | "transcribing" | "review" | "error"

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
  saving,
  onCancel,
  onSave,
  transcribe,
}: {
  student: StudentRecord
  students: StudentRecord[]
  initialNote: string | null
  saving: boolean
  onCancel: () => void
  onSave: (note: string | null) => Promise<void>
  transcribe: (audio: Blob) => Promise<string>
}) {
  const name = displayName(student, students)
  const [note, setNote] = useState(initialNote ?? "")
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle")
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const beforeVoiceRef = useRef("")

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  async function finishTranscription(recorder: MediaRecorder) {
    const audio = new Blob(chunksRef.current, {
      type: recorder.mimeType || "audio/webm",
    })
    chunksRef.current = []
    stopStream()
    try {
      const transcript = await transcribe(audio)
      if (!transcript.trim()) throw new Error("Empty transcript")
      const prefix = beforeVoiceRef.current.trim()
      setNote(prefix ? `${prefix} ${transcript.trim()}` : transcript.trim())
      setVoiceStatus("review")
    } catch {
      setVoiceStatus("error")
    } finally {
      recorderRef.current = null
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      streamRef.current = stream
      recorderRef.current = recorder
      chunksRef.current = []
      beforeVoiceRef.current = note
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => void finishTranscription(recorder)
      recorder.start()
      setVoiceStatus("recording")
    } catch {
      stopStream()
      setVoiceStatus("error")
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === "inactive") return
    setVoiceStatus("transcribing")
    recorder.stop()
  }

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current
      if (recorder && recorder.state !== "inactive") {
        recorder.ondataavailable = null
        recorder.onstop = null
        recorder.stop()
      }
      stopStream()
    }
  }, [])

  const voiceSupported =
    typeof MediaRecorder !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"

  return (
    <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <label
          className="text-sm font-black"
          htmlFor={`evaluation-note-${student.id}`}
        >
          Nota di {name}
        </label>
        <Button
          aria-label={
            voiceStatus === "recording"
              ? `Termina dettatura valutazione di ${name}`
              : `Detta nota valutazione di ${name}`
          }
          className={`h-11 px-3 text-xs ${voiceStatus === "recording" ? "border-[#d92d20] text-[#b42318]" : ""}`}
          disabled={
            !voiceSupported ||
            saving ||
            voiceStatus === "transcribing" ||
            voiceStatus === "review"
          }
          onClick={() =>
            voiceStatus === "recording"
              ? stopRecording()
              : void startRecording()
          }
          type="button"
          variant="secondary"
        >
          {voiceStatus === "recording" ? (
            <Square aria-hidden="true" className="size-3.5 fill-current" />
          ) : (
            <Mic aria-hidden="true" className="size-4" />
          )}
          {voiceStatus === "recording"
            ? "Termina"
            : voiceStatus === "transcribing"
              ? "Trascrizione…"
              : "Detta"}
        </Button>
      </div>
      <textarea
        aria-label={`Nota valutazione di ${name}`}
        className="mt-2 min-h-24 w-full resize-y rounded-xl border bg-card px-3 py-2.5 text-base leading-6 outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
        id={`evaluation-note-${student.id}`}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Nota facoltativa per questa sessione"
        value={note}
      />
      {voiceStatus === "review" && (
        <div className="mt-2 rounded-xl border border-primary/30 bg-card p-3">
          <p className="text-xs leading-5 text-muted-foreground">
            Rileggi la trascrizione. Il testo sarà salvato solo con la nota.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                setNote(beforeVoiceRef.current)
                setVoiceStatus("idle")
              }}
              type="button"
              variant="secondary"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Scarta
            </Button>
            <Button
              onClick={() => setVoiceStatus("idle")}
              type="button"
              variant="secondary"
            >
              <Check aria-hidden="true" className="size-4" />
              Usa testo
            </Button>
          </div>
        </div>
      )}
      {voiceStatus === "error" && (
        <p className="mt-2 text-xs font-semibold text-[#b42318]" role="alert">
          Dettatura non riuscita. Puoi riprovare o scrivere la nota.
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          disabled={saving}
          onClick={onCancel}
          type="button"
          variant="secondary"
        >
          Annulla
        </Button>
        <Button
          disabled={
            saving ||
            voiceStatus === "recording" ||
            voiceStatus === "transcribing" ||
            voiceStatus === "review"
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
}: {
  student: StudentRecord
  students: StudentRecord[]
  evaluation: EvaluationDraft
  isLand: boolean
  saving: boolean
  saved: boolean
  saveError: boolean
  noteOpen: boolean
  onValue: (value: EvaluationSymbol | null) => void
  onOpenNote: () => void
  onCloseNote: () => void
  onSaveNote: (note: string | null) => Promise<void>
  transcribe: (audio: Blob) => Promise<string>
}) {
  const name = displayName(student, students)
  const choices: Array<{ symbol: EvaluationSymbol | null; label: string }> = [
    { symbol: null, label: "—" },
    ...EVALUATION_VALUES.map(({ symbol }) => ({ symbol, label: symbol })),
  ]
  return (
    <article className="rounded-2xl border bg-card p-4 shadow-[0_6px_18px_rgb(6_59_82/0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-black">{name}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {isLand && (
              <span className="rounded-full bg-[#fbe7c6] px-2 py-0.5 text-xs font-bold text-[#8a4b08]">
                A terra
              </span>
            )}
            {!student.active && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                Non disponibile
              </span>
            )}
          </div>
        </div>
        <Button
          aria-label={`${evaluation.note ? "Modifica" : "Aggiungi"} nota valutazione di ${name}`}
          className="size-11 shrink-0 px-0"
          disabled={saving}
          onClick={onOpenNote}
          type="button"
          variant="secondary"
        >
          <FilePenLine aria-hidden="true" className="size-4" />
          {evaluation.note && <span className="sr-only">Nota presente</span>}
        </Button>
      </div>
      {isLand && evaluation.value === null && (
        <p className="mt-2 text-xs font-bold text-[#9a4b12]" role="status">
          Valutazione mancante: resta comunque valutabile.
        </p>
      )}
      <div
        className="mt-3 grid grid-cols-6 gap-1.5"
        role="group"
        aria-label={`Valutazione di ${name}`}
      >
        {choices.map(({ symbol, label }) => (
          <button
            aria-label={`Valutazione di ${name}: ${symbol ?? "mancante"}`}
            aria-pressed={evaluation.value === symbol}
            className="grid min-h-11 min-w-0 place-items-center rounded-xl border bg-card px-0 text-sm font-black outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground disabled:opacity-50"
            disabled={saving}
            key={symbol ?? "missing"}
            onClick={() => onValue(symbol)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <div
        aria-label={`Stato salvataggio valutazione di ${name}`}
        aria-live="polite"
        className={`mt-2 min-h-4 text-right text-xs font-semibold ${saveError ? "text-[#b42318]" : "text-muted-foreground"}`}
      >
        {saving
          ? "Salvataggio…"
          : saveError
            ? "Non salvato"
            : saved
              ? "Salvato"
              : evaluation.note
                ? "Nota presente"
                : ""}
      </div>
      {noteOpen && (
        <EvaluationNoteEditor
          initialNote={evaluation.note}
          onCancel={onCloseNote}
          onSave={onSaveNote}
          saving={saving}
          student={student}
          students={students}
          transcribe={transcribe}
        />
      )}
    </article>
  )
}

export function EvaluationManagement({
  course,
  onHome,
  referenceDate = new Date(),
  transcribe = transcribeAudio,
}: {
  course: CourseRecord
  onHome: () => void
  referenceDate?: Date
  transcribe?: (audio: Blob) => Promise<string>
}) {
  const [sessionId, setSessionId] = useState<SessionId>(() =>
    getDefaultEvaluationSession(course.startDate, referenceDate),
  )
  const [view, setView] = useState<EvaluationView>("students")
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
      setRecords((current) => {
        const copy = new Map(current)
        if (previous) copy.set(studentId, previous)
        else copy.delete(studentId)
        return copy
      })
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
        saved={savedIds.has(student.id)}
        saveError={saveErrors.has(student.id)}
        saving={savingIds.has(student.id)}
        student={student}
        students={students}
        transcribe={transcribe}
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

  return (
    <>
      <div className="mb-5 flex items-center gap-1">
        <button
          aria-label="Indietro da Valutazioni"
          className="grid size-11 shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          onClick={onHome}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black tracking-tight">
            Valutazioni
          </h1>
          <p className="text-xs text-muted-foreground">
            Una valutazione per allievo e sessione
          </p>
        </div>
      </div>

      <label className="grid gap-2 text-sm font-black">
        Sessione
        <select
          aria-label="Sessione valutazioni"
          className="h-14 rounded-2xl border bg-card px-4 text-base font-bold outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50"
          disabled={loading || savingIds.size > 0}
          onChange={(event) => {
            const nextSessionId = event.target.value as SessionId
            if (nextSessionId === sessionId) return
            setLoading(true)
            setLoadError(false)
            setNoteStudentId(null)
            setSessionId(nextSessionId)
          }}
          value={sessionId}
        >
          {SESSION_SEQUENCE.map(({ id, day, period }) => (
            <option key={id} value={id}>
              {day} · {period}
            </option>
          ))}
        </select>
      </label>

      <div
        className="mt-4 grid grid-cols-2 rounded-2xl bg-muted p-1"
        role="group"
        aria-label="Vista valutazioni"
      >
        <button
          aria-pressed={view === "students"}
          className="min-h-11 rounded-xl px-3 text-sm font-black outline-none focus-visible:ring-3 focus-visible:ring-ring/40 aria-pressed:bg-card aria-pressed:text-primary aria-pressed:shadow-sm"
          onClick={() => setView("students")}
          type="button"
        >
          Allievi
        </button>
        <button
          aria-pressed={view === "crews"}
          className="min-h-11 rounded-xl px-3 text-sm font-black outline-none focus-visible:ring-3 focus-visible:ring-ring/40 aria-pressed:bg-card aria-pressed:text-primary aria-pressed:shadow-sm"
          onClick={() => setView("crews")}
          type="button"
        >
          Equipaggi
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
      {!loading && !loadError && students.length > 0 && (
        <div className="mt-4 grid gap-3">
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
