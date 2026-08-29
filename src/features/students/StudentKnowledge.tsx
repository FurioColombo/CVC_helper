import {
  Check,
  ChevronLeft,
  Mic,
  NotebookPen,
  Square,
  Trash2,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { transcribeAudio } from "@/capabilities/speech"
import { Button } from "@/components/ui/button"
import { STUDENT_SIZES, type StudentSize } from "@/domain/config"
import { getStudentDisplayName } from "@/domain/student"
import {
  updateStudentKnowledge,
  type StudentKnowledgeInput,
  type StudentRecord,
} from "@/persistence/students"

type SaveStatus = "saved" | "saving" | "error"
type VoiceStatus = "idle" | "recording" | "transcribing" | "review" | "error"

function normalizeKnowledge(
  size: StudentSize | "",
  initialNote: string,
): StudentKnowledgeInput {
  return {
    size: size || null,
    initialNote: initialNote.trim() || null,
  }
}

function isSameKnowledge(
  left: StudentKnowledgeInput,
  right: StudentKnowledgeInput,
) {
  return left.size === right.size && left.initialNote === right.initialNote
}

function KnowledgeCard({
  courseId,
  student,
  students,
  onSaved,
  transcribe,
}: {
  courseId: string
  student: StudentRecord
  students: StudentRecord[]
  onSaved: (studentId: string, input: StudentKnowledgeInput) => void
  transcribe: (audio: Blob) => Promise<string>
}) {
  const displayName = getStudentDisplayName(student, students)
  const [size, setSize] = useState<StudentSize | "">(student.size ?? "")
  const [initialNote, setInitialNote] = useState(student.initialNote ?? "")
  const [status, setStatus] = useState<SaveStatus>("saved")
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle")
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const noteBeforeVoiceRef = useRef("")
  const revisionRef = useRef(0)
  const committedRef = useRef<StudentKnowledgeInput>({
    size: student.size,
    initialNote: student.initialNote,
  })
  const latestRef = useRef<StudentKnowledgeInput>({
    size: student.size,
    initialNote: student.initialNote,
  })

  function persist(input: StudentKnowledgeInput, revision: number) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = undefined
    void updateStudentKnowledge(student.id, courseId, input)
      .then(() => {
        committedRef.current = input
        onSaved(student.id, input)
        if (revision === revisionRef.current) setStatus("saved")
      })
      .catch(() => {
        if (revision === revisionRef.current) setStatus("error")
      })
  }

  function schedule(input: StudentKnowledgeInput, delay: number) {
    latestRef.current = input
    revisionRef.current += 1
    const revision = revisionRef.current
    if (timerRef.current) clearTimeout(timerRef.current)
    setStatus("saving")
    timerRef.current = setTimeout(() => persist(input, revision), delay)
  }

  function stopMediaStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  async function finishTranscription(recorder: MediaRecorder) {
    const audio = new Blob(audioChunksRef.current, {
      type: recorder.mimeType || "audio/webm",
    })
    audioChunksRef.current = []
    stopMediaStream()
    try {
      const transcript = await transcribe(audio)
      if (!transcript) throw new Error("Empty transcript")
      const prefix = noteBeforeVoiceRef.current.trim()
      setInitialNote(prefix ? `${prefix} ${transcript}` : transcript)
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
      audioChunksRef.current = []
      noteBeforeVoiceRef.current = initialNote
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        void finishTranscription(recorder)
      }
      recorder.start()
      setVoiceStatus("recording")
    } catch {
      stopMediaStream()
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
      if (timerRef.current) clearTimeout(timerRef.current)
      const recorder = recorderRef.current
      if (recorder && recorder.state !== "inactive") {
        recorder.ondataavailable = null
        recorder.onstop = null
        recorder.stop()
      }
      stopMediaStream()
      const latest = latestRef.current
      if (!isSameKnowledge(latest, committedRef.current)) {
        void updateStudentKnowledge(student.id, courseId, latest)
      }
    }
  }, [courseId, student.id])

  const voiceSupported =
    typeof MediaRecorder !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"

  return (
    <article
      className={`rounded-2xl border bg-card p-4 shadow-[0_6px_18px_rgb(6_59_82/0.05)] ${student.active ? "" : "opacity-60"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-black">{displayName}</h2>
          {!student.active && (
            <p className="text-xs font-bold text-muted-foreground">
              Non disponibile
            </p>
          )}
        </div>
        <span
          aria-label={`Stato salvataggio ${displayName}`}
          aria-live="polite"
          className={`shrink-0 text-xs font-semibold ${status === "error" ? "text-[#b42318]" : "text-muted-foreground"}`}
        >
          {status === "saving"
            ? "Salvataggio…"
            : status === "error"
              ? "Non salvato"
              : "Salvato"}
        </span>
      </div>

      <div className="mt-3 grid gap-3">
        <label className="grid grid-cols-[auto_1fr] items-center gap-3 text-sm font-bold">
          <span>Taglia</span>
          <select
            aria-label={`Taglia di ${displayName}`}
            className="h-11 min-w-0 rounded-xl border bg-card px-3 text-base outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
            onChange={(event) => {
              const nextSize = event.target.value as StudentSize | ""
              setSize(nextSize)
              schedule(normalizeKnowledge(nextSize, initialNote), 0)
            }}
            value={size}
          >
            <option value="">—</option>
            {STUDENT_SIZES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-2 text-sm font-bold">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={`knowledge-note-${student.id}`}>
              Nota iniziale
            </label>
            <Button
              aria-label={
                voiceStatus === "recording"
                  ? `Termina dettatura di ${displayName}`
                  : `Detta nota di ${displayName}`
              }
              className={`h-11 px-3 text-xs ${voiceStatus === "recording" ? "border-[#d92d20] text-[#b42318]" : ""}`}
              disabled={
                !voiceSupported ||
                voiceStatus === "transcribing" ||
                voiceStatus === "review"
              }
              onClick={(event) => {
                event.preventDefault()
                if (voiceStatus === "recording") stopRecording()
                else void startRecording()
              }}
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
            aria-label={`Nota iniziale di ${displayName}`}
            className="min-h-20 resize-y rounded-xl border bg-card px-3 py-2.5 text-base font-normal leading-6 outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
            onBlur={() => {
              if (voiceStatus !== "review") schedule(latestRef.current, 0)
            }}
            onChange={(event) => {
              const nextNote = event.target.value
              setInitialNote(nextNote)
              if (voiceStatus !== "review") {
                schedule(normalizeKnowledge(size, nextNote), 500)
              }
            }}
            placeholder="Nessuna nota speciale"
            value={initialNote}
            id={`knowledge-note-${student.id}`}
          />
        </div>

        {voiceStatus === "review" && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs leading-5 text-muted-foreground">
              Rileggi la trascrizione: il testo non viene salvato finché non lo
              confermi.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                aria-label={`Scarta trascrizione di ${displayName}`}
                onClick={() => {
                  setInitialNote(noteBeforeVoiceRef.current)
                  setVoiceStatus("idle")
                }}
                type="button"
                variant="secondary"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Scarta
              </Button>
              <Button
                aria-label={`Usa trascrizione di ${displayName}`}
                onClick={() => {
                  schedule(normalizeKnowledge(size, initialNote), 0)
                  setVoiceStatus("idle")
                }}
                type="button"
              >
                <Check aria-hidden="true" className="size-4" />
                Usa testo
              </Button>
            </div>
          </div>
        )}

        {voiceStatus === "error" && (
          <p className="text-xs font-semibold text-[#b42318]" role="alert">
            Dettatura non riuscita. Puoi riprovare o scrivere la nota.
          </p>
        )}
      </div>
    </article>
  )
}

export function StudentKnowledge({
  courseId,
  students,
  onBack,
  onSaved,
  transcribe = transcribeAudio,
}: {
  courseId: string
  students: StudentRecord[]
  onBack: () => void
  onSaved: (studentId: string, input: StudentKnowledgeInput) => void
  transcribe?: (audio: Blob) => Promise<string>
}) {
  return (
    <>
      <div className="mb-4 flex items-center gap-1">
        <button
          aria-label="Indietro da Conoscenza allievi"
          className="grid size-11 shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          onClick={onBack}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black tracking-tight">
            Conoscenza
          </h1>
          <p className="text-xs text-muted-foreground">
            Taglia e nota iniziale · salvataggio automatico
          </p>
        </div>
      </div>

      <section aria-label="Conoscenza allievi" className="grid gap-3">
        {students.map((student) => (
          <KnowledgeCard
            courseId={courseId}
            key={student.id}
            onSaved={onSaved}
            student={student}
            students={students}
            transcribe={transcribe}
          />
        ))}
      </section>

      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <NotebookPen aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        La nota iniziale è facoltativa: lasciala vuota quando non c’è nulla di
        particolare da segnalare.
      </p>
    </>
  )
}
