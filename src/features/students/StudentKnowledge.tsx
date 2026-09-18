import {
  Check,
  ChevronLeft,
  LoaderCircle,
  Mic,
  NotebookPen,
  Pencil,
  Square,
  Trash2,
  X,
} from "lucide-react"
import { useEffect, useRef, useState, type KeyboardEvent } from "react"

import { transcribeAudio } from "@/capabilities/speech"
import { StudentSizeSelector } from "@/components/StudentSizeSelector"
import { Button } from "@/components/ui/button"
import type { StudentSize } from "@/domain/config"
import { getStudentDisplayName } from "@/domain/student"
import { DictationMeter } from "@/features/speech/DictationMeter"
import {
  useDictation,
  type SpeechPrepare,
  type SpeechTranscribe,
} from "@/features/speech/useDictation"
import {
  updateStudentKnowledge,
  type StudentKnowledgeInput,
  type StudentRecord,
} from "@/persistence/students"

type SaveStatus = "saved" | "saving" | "error"

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
  prepareSpeech,
}: {
  courseId: string
  student: StudentRecord
  students: StudentRecord[]
  onSaved: (studentId: string, input: StudentKnowledgeInput) => void
  transcribe: SpeechTranscribe
  prepareSpeech?: SpeechPrepare
}) {
  const displayName = getStudentDisplayName(student, students)
  const [size, setSize] = useState<StudentSize | "">(student.size ?? "")
  const [initialNote, setInitialNote] = useState(student.initialNote ?? "")
  const [status, setStatus] = useState<SaveStatus>("saved")
  const [noteOpen, setNoteOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const noteButtonRef = useRef<HTMLButtonElement | null>(null)
  const noteDialogRef = useRef<HTMLElement | null>(null)
  const revisionRef = useRef(0)
  const mountedRef = useRef(true)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const onSavedRef = useRef(onSaved)
  const lastQueuedRef = useRef<StudentKnowledgeInput>({
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
    lastQueuedRef.current = input
    const operation = saveQueueRef.current
      .catch(() => undefined)
      .then(() => updateStudentKnowledge(student.id, courseId, input))
    saveQueueRef.current = operation
    void operation
      .then(() => {
        onSavedRef.current(student.id, input)
        if (mountedRef.current && revision === revisionRef.current)
          setStatus("saved")
      })
      .catch(() => {
        if (mountedRef.current && revision === revisionRef.current)
          setStatus("error")
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

  function retrySave() {
    schedule(latestRef.current, 0)
  }

  const dictation = useDictation({
    value: initialNote,
    onDraft: setInitialNote,
    onAccept: (acceptedNote) =>
      schedule(normalizeKnowledge(size, acceptedNote), 0),
    transcribe,
    prepare: prepareSpeech,
  })

  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
      const latest = latestRef.current
      if (!isSameKnowledge(latest, lastQueuedRef.current)) {
        saveQueueRef.current = saveQueueRef.current
          .catch(() => undefined)
          .then(() => updateStudentKnowledge(student.id, courseId, latest))
          .then(() => onSavedRef.current(student.id, latest))
      }
    }
  }, [courseId, student.id])

  const dictationBusy = new Set(["permission", "loading", "processing"]).has(
    dictation.status,
  )
  const dictationProgress =
    dictation.status === "loading" && dictation.loadPercent !== undefined
      ? ` ${dictation.loadPercent}%`
      : ""

  function closeNoteEditor() {
    if (dictation.status === "review") {
      // Closing is not consent to persist a generated transcript. The explicit
      // Usa testo action is the only acceptance path.
      dictation.cancel()
    } else {
      if (dictation.status !== "idle") dictation.cancel()
      schedule(normalizeKnowledge(size, initialNote), 0)
    }
    setNoteOpen(false)
    window.requestAnimationFrame(() => noteButtonRef.current?.focus())
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      closeNoteEditor()
      return
    }
    if (event.key !== "Tab") return

    const focusable = Array.from(
      noteDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    )
    const first = focusable.at(0)
    const last = focusable.at(-1)
    if (!first || !last) return

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <>
      <article
        className={`grid grid-cols-1 gap-2 rounded-2xl border bg-card p-3 shadow-[0_6px_18px_rgb(6_59_82/0.05)] min-[360px]:grid-cols-[minmax(0,1fr)_13.25rem] min-[360px]:items-center ${student.active ? "" : "opacity-60"}`}
      >
        <div className="flex min-w-0 items-center gap-1">
          <button
            aria-label={`Nota di ${displayName}`}
            className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            onClick={() => setNoteOpen(true)}
            ref={noteButtonRef}
            type="button"
          >
            <h2 className="truncate text-base font-black">{displayName}</h2>
            <Pencil
              aria-hidden="true"
              className="size-4 shrink-0 text-primary"
            />
          </button>
          <span
            aria-label={`Stato salvataggio ${displayName}`}
            aria-live="polite"
            className={`flex shrink-0 items-center gap-1 text-xs font-semibold ${status === "error" ? "text-[#b42318]" : "text-muted-foreground"}`}
          >
            {status === "saving" ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-3 animate-spin"
              />
            ) : status === "error" ? (
              "!"
            ) : (
              <Check aria-hidden="true" className="size-4 text-[#18794e]" />
            )}
            <span className="sr-only">
              {status === "saving"
                ? "Salvataggio…"
                : status === "error"
                  ? "Non salvato"
                  : "Salvato"}
            </span>
          </span>
        </div>

        <StudentSizeSelector
          ariaLabel={`Taglia di ${displayName}`}
          hideLabel
          onChange={(nextSize) => {
            setSize(nextSize)
            schedule(normalizeKnowledge(nextSize, initialNote), 0)
          }}
          value={size}
        />

        {!student.active && (
          <p className="col-span-full text-xs font-bold text-muted-foreground">
            Non disponibile
          </p>
        )}
        {initialNote && (
          <p className="col-span-full truncate text-xs font-normal text-muted-foreground">
            {initialNote}
          </p>
        )}
        {status === "error" && (
          <div
            className="col-span-full flex items-center justify-between gap-3"
            role="alert"
          >
            <p className="text-xs font-semibold text-[#b42318]">
              Modifica non salvata. Il testo resta qui.
            </p>
            <Button
              aria-label={`Riprova salvataggio di ${displayName}`}
              className="h-10 shrink-0 px-3 text-xs"
              onClick={retrySave}
              type="button"
              variant="secondary"
            >
              Riprova
            </Button>
          </div>
        )}
      </article>

      {noteOpen && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-foreground/35 p-0 min-[520px]:items-center min-[520px]:p-5">
          <section
            aria-labelledby={`knowledge-note-title-${student.id}`}
            aria-modal="true"
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-background p-4 shadow-2xl min-[520px]:rounded-3xl"
            onKeyDown={handleDialogKeyDown}
            ref={noteDialogRef}
            role="dialog"
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                className="min-w-0 truncate text-xl font-black"
                id={`knowledge-note-title-${student.id}`}
              >
                Nota · {displayName}
              </h2>
              <Button
                aria-label={`Chiudi nota di ${displayName}`}
                className="size-11 shrink-0 p-0"
                onClick={closeNoteEditor}
                type="button"
                variant="secondary"
              >
                <X aria-hidden="true" className="size-5" />
              </Button>
            </div>

            <label
              className="mt-4 grid gap-2 text-sm font-bold"
              htmlFor={`knowledge-note-${student.id}`}
            >
              Testo
            </label>
            <textarea
              aria-label={`Nota iniziale di ${displayName}`}
              autoFocus
              className="mt-2 min-h-36 w-full resize-y rounded-xl border bg-card px-3 py-2.5 text-base font-normal leading-6 outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
              id={`knowledge-note-${student.id}`}
              onChange={(event) => {
                const nextNote = event.target.value
                dictation.syncValue(nextNote)
                setInitialNote(nextNote)
                if (dictation.status !== "review")
                  schedule(normalizeKnowledge(size, nextNote), 500)
              }}
              placeholder="Nessuna nota speciale"
              value={initialNote}
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  aria-label={
                    dictation.status === "recording"
                      ? `Termina dettatura di ${displayName}`
                      : `Detta nota di ${displayName}`
                  }
                  className={`h-11 px-3 text-xs ${dictation.status === "recording" ? "border-[#d92d20] text-[#b42318]" : ""}`}
                  disabled={
                    !dictation.supported ||
                    dictationBusy ||
                    dictation.status === "review"
                  }
                  onClick={() =>
                    dictation.status === "recording"
                      ? dictation.stop()
                      : void dictation.start()
                  }
                  type="button"
                  variant="secondary"
                >
                  {dictationBusy ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : dictation.status === "recording" ? (
                    <Square
                      aria-hidden="true"
                      className="size-3.5 fill-current"
                    />
                  ) : (
                    <Mic aria-hidden="true" className="size-4" />
                  )}
                  {dictation.status === "recording"
                    ? "Termina"
                    : dictation.status === "permission"
                      ? "Permesso…"
                      : dictation.status === "loading"
                        ? `Caricamento${dictationProgress}`
                        : dictation.status === "processing"
                          ? "Elaborazione…"
                          : "Detta"}
                </Button>
                {dictation.status === "recording" && (
                  <DictationMeter
                    className="text-[#b42318]"
                    stream={dictation.mediaStream}
                  />
                )}
              </div>
              <Button onClick={closeNoteEditor} type="button">
                Fine
              </Button>
            </div>

            {!dictation.supported && dictation.status === "idle" && (
              <p className="mt-3 text-xs text-muted-foreground">
                Dettatura non disponibile in questo browser. Puoi scrivere la
                nota.
              </p>
            )}

            {(dictation.status === "permission" ||
              dictation.status === "recording" ||
              dictation.status === "loading" ||
              dictation.status === "processing") && (
              <div
                aria-live="polite"
                className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2"
                role="status"
              >
                <p className="text-xs font-semibold text-muted-foreground">
                  {dictation.status === "permission"
                    ? "Attendo il permesso del microfono…"
                    : dictation.status === "recording"
                      ? "Registrazione in corso"
                      : dictation.status === "loading"
                        ? `Caricamento del modello vocale${dictationProgress}…`
                        : "Elaborazione locale dell’audio…"}
                </p>
                <Button
                  aria-label={`Annulla dettatura di ${displayName}`}
                  className="size-10 shrink-0 p-0"
                  onClick={dictation.cancel}
                  type="button"
                  variant="secondary"
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </div>
            )}

            {dictation.status === "review" && (
              <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs leading-5 text-muted-foreground">
                  Rileggi la trascrizione: il testo non viene salvato finché non
                  lo confermi.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    aria-label={`Scarta trascrizione di ${displayName}`}
                    onClick={dictation.cancel}
                    type="button"
                    variant="secondary"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    Scarta
                  </Button>
                  <Button
                    aria-label={`Usa trascrizione di ${displayName}`}
                    onClick={dictation.accept}
                    type="button"
                  >
                    <Check aria-hidden="true" className="size-4" />
                    Usa testo
                  </Button>
                </div>
              </div>
            )}

            {dictation.status === "error" && (
              <div
                className="mt-3 flex items-start justify-between gap-3"
                role="alert"
              >
                <p className="text-xs font-semibold text-[#b42318]">
                  {dictation.error === "permission"
                    ? "Permesso microfono non concesso. Il testo è rimasto invariato."
                    : "Dettatura non riuscita. Il testo è rimasto invariato."}
                </p>
                <Button
                  aria-label={`Riprovare dettatura di ${displayName}`}
                  className="h-10 shrink-0 px-3 text-xs"
                  onClick={() => void dictation.start()}
                  type="button"
                  variant="secondary"
                >
                  Riprova
                </Button>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}

export function StudentKnowledge({
  courseId,
  students,
  onBack,
  onSaved,
  transcribe = transcribeAudio,
  prepareSpeech,
}: {
  courseId: string
  students: StudentRecord[]
  onBack: () => void
  onSaved: (studentId: string, input: StudentKnowledgeInput) => void
  transcribe?: SpeechTranscribe
  prepareSpeech?: SpeechPrepare
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
            prepareSpeech={prepareSpeech}
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
