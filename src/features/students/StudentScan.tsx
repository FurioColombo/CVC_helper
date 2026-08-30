import {
  Camera,
  ChevronLeft,
  FileCheck2,
  ImagePlus,
  RotateCcw,
  Trash2,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import {
  MIN_FIELD_CONFIDENCE,
  scanStudents,
  type StudentScanCandidate,
  type StudentScanField,
  type StudentScanProgress,
  type StudentScanResult,
} from "@/capabilities/studentScan"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { STUDENT_SEXES, type StudentSex } from "@/domain/config"
import { createStudents, type StudentInput } from "@/persistence/students"

type ScanState =
  "idle" | "scanning" | "review" | "unsuitable" | "error" | "saving"

interface ReviewCandidate extends StudentScanCandidate {
  id: string
}

function needsReview(candidate: ReviewCandidate, field: StudentScanField) {
  if (field === "phone" && candidate.confidence.phone === 0) return false
  return candidate.confidence[field] < MIN_FIELD_CONFIDENCE
}

function ReviewField({
  candidate,
  field,
  label,
  onChange,
  ...inputProps
}: {
  candidate: ReviewCandidate
  field: StudentScanField
  label: string
  onChange: (value: string) => void
} & Omit<React.ComponentProps<typeof Input>, "onChange" | "value">) {
  const uncertain = needsReview(candidate, field)
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-bold">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        {uncertain && (
          <span className="text-[0.68rem] font-bold text-[#a2381b]">
            Da controllare
          </span>
        )}
      </span>
      <Input
        aria-label={`${label} riga ${candidate.id}`}
        className={uncertain ? "border-[#f79009]" : ""}
        onChange={(event) => onChange(event.target.value)}
        value={candidate[field]}
        {...inputProps}
      />
    </label>
  )
}

function CandidateCard({
  candidate,
  courseStartDate,
  index,
  invalid,
  onChange,
  onRemove,
}: {
  candidate: ReviewCandidate
  courseStartDate: string
  index: number
  invalid: boolean
  onChange: (candidate: ReviewCandidate) => void
  onRemove: () => void
}) {
  function updateField(field: StudentScanField, value: string) {
    onChange({
      ...candidate,
      [field]: value,
      confidence: { ...candidate.confidence, [field]: 100 },
    })
  }

  return (
    <article
      className={`rounded-2xl border bg-card p-4 shadow-[0_6px_18px_rgb(6_59_82/0.05)] ${invalid ? "border-[#d92d20]" : ""}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-black">Allievo {index + 1}</h2>
        <Button
          aria-label={`Rimuovi allievo ${index + 1}`}
          className="size-11 px-0 text-[#b42318]"
          onClick={onRemove}
          type="button"
          variant="secondary"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ReviewField
          autoComplete="given-name"
          candidate={candidate}
          field="firstName"
          label="Nome"
          onChange={(value) => updateField("firstName", value)}
        />
        <ReviewField
          autoComplete="family-name"
          candidate={candidate}
          field="surname"
          label="Cognome"
          onChange={(value) => updateField("surname", value)}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <ReviewField
          candidate={candidate}
          field="dateOfBirth"
          label="Data di nascita"
          max={courseStartDate}
          onChange={(value) => updateField("dateOfBirth", value)}
          type="date"
        />
        <ReviewField
          candidate={candidate}
          field="phone"
          inputMode="tel"
          label="Telefono"
          onChange={(value) => updateField("phone", value)}
          type="tel"
        />
      </div>

      <fieldset className="mt-3 grid gap-2 text-sm font-bold">
        <legend>Sesso</legend>
        <div className="grid grid-cols-3 gap-2">
          {STUDENT_SEXES.map((option) => (
            <label className="cursor-pointer" key={option.id}>
              <input
                checked={candidate.sex === option.id}
                className="peer sr-only"
                name={`scan-sex-${candidate.id}`}
                onChange={() => onChange({ ...candidate, sex: option.id })}
                type="radio"
                value={option.id}
              />
              <span className="grid h-12 place-items-center rounded-xl border bg-card text-base transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {invalid && (
        <p className="mt-3 text-xs font-semibold text-[#b42318]" role="alert">
          Completa nome, cognome, data di nascita e sesso.
        </p>
      )}
    </article>
  )
}

export function StudentScan({
  courseId,
  courseStartDate,
  onBack,
  onCommitted,
  scan = scanStudents,
}: {
  courseId: string
  courseStartDate: string
  onBack: () => void
  onCommitted: () => void
  scan?: (
    image: Blob,
    onProgress?: (progress: StudentScanProgress) => void,
  ) => Promise<StudentScanResult>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<ScanState>("idle")
  const [progress, setProgress] = useState<StudentScanProgress>({
    phase: "loading",
    value: 0,
  })
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [candidates, setCandidates] = useState<ReviewCandidate[]>([])
  const [invalidIds, setInvalidIds] = useState<Set<string>>(new Set())
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function chooseAnother() {
    inputRef.current?.click()
  }

  async function handleImage(file: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setState("scanning")
    setProgress({ phase: "loading", value: 0 })
    setCandidates([])
    setInvalidIds(new Set())
    setSaveError(false)
    try {
      const result = await scan(file, setProgress)
      if (result.unsuitable) {
        setState("unsuitable")
        return
      }
      setCandidates(
        result.candidates.map((candidate, index) => ({
          ...candidate,
          id: `${candidate.sourceId}-${index + 1}`,
        })),
      )
      setState("review")
    } catch {
      setState("error")
    } finally {
      setPreviewUrl(undefined)
    }
  }

  async function commitCandidates() {
    const invalid = new Set(
      candidates
        .filter(
          ({ firstName, surname, dateOfBirth, sex }) =>
            !firstName.trim() ||
            !surname.trim() ||
            !dateOfBirth ||
            dateOfBirth > courseStartDate ||
            !sex,
        )
        .map(({ id }) => id),
    )
    setInvalidIds(invalid)
    if (invalid.size > 0 || candidates.length === 0) return

    setState("saving")
    setSaveError(false)
    const inputs: StudentInput[] = candidates.map((candidate) => ({
      firstName: candidate.firstName.trim(),
      surname: candidate.surname.trim(),
      nickname: null,
      dateOfBirth: candidate.dateOfBirth,
      sex: candidate.sex as StudentSex,
      phone: candidate.phone.trim() || null,
    }))
    try {
      await createStudents(courseId, inputs)
      onCommitted()
    } catch {
      setState("review")
      setSaveError(true)
    }
  }

  const progressPercent = Math.round(progress.value * 100)

  return (
    <>
      <div className="mb-4 flex items-center gap-1">
        <button
          aria-label="Indietro da Scan allievi"
          className="grid size-11 shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          onClick={onBack}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Scan allievi</h1>
          <p className="text-xs text-muted-foreground">
            Foto o screenshot · revisione obbligatoria
          </p>
        </div>
      </div>

      <input
        accept="image/*"
        aria-label="Foto o screenshot degli allievi"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) void handleImage(file)
        }}
        ref={inputRef}
        type="file"
      />

      {(state === "idle" || state === "error") && (
        <section className="rounded-3xl border bg-card p-5 text-center shadow-[0_12px_32px_rgb(6_59_82/0.07)]">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted text-primary">
            <Camera aria-hidden="true" className="size-7" />
          </span>
          <h2 className="mt-4 text-xl font-black">Importa l’elenco</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Inquadra bene nomi, date di nascita e telefoni. L’analisi avviene
            sul dispositivo.
          </p>
          {state === "error" && (
            <p
              className="mt-3 text-sm font-semibold text-[#b42318]"
              role="alert"
            >
              Non sono riuscito ad analizzare l’immagine. Riprova.
            </p>
          )}
          <Button
            className="mt-5 w-full"
            onClick={() => inputRef.current?.click()}
            size="lg"
          >
            <ImagePlus aria-hidden="true" className="size-5" />
            Scatta o scegli immagine
          </Button>
        </section>
      )}

      {state === "scanning" && (
        <section
          aria-live="polite"
          className="rounded-3xl border bg-card p-5 shadow-[0_12px_32px_rgb(6_59_82/0.07)]"
        >
          {previewUrl && (
            <img
              alt="Immagine selezionata"
              className="h-36 w-full rounded-2xl object-cover"
              src={previewUrl}
            />
          )}
          <h2 className="mt-4 text-lg font-black">
            {progress.phase === "loading"
              ? "Preparo il riconoscimento…"
              : "Leggo l’elenco…"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            La prima scansione può richiedere più tempo.
          </p>
          <div
            aria-label="Avanzamento analisi immagine"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progressPercent}
            className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-right text-xs font-semibold text-muted-foreground">
            {progressPercent}%
          </p>
        </section>
      )}

      {state === "unsuitable" && (
        <section
          className="rounded-3xl border border-[#f79009] bg-card p-5 shadow-[0_12px_32px_rgb(6_59_82/0.07)]"
          role="alert"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-[#fff4e5] text-[#a2381b]">
            <RotateCcw aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-4 text-xl font-black">Immagine poco leggibile</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Riprova con il foglio intero, a fuoco, dritto e senza riflessi. Non
            ho preparato dati incerti da salvare.
          </p>
          <Button className="mt-5 w-full" onClick={chooseAnother} size="lg">
            <ImagePlus aria-hidden="true" className="size-5" />
            Scegli un’altra immagine
          </Button>
        </section>
      )}

      {(state === "review" || state === "saving") && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void commitCandidates()
          }}
        >
          <section className="mb-3 rounded-2xl border bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <FileCheck2
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-primary"
              />
              <div>
                <h2 className="font-black">Controlla prima di salvare</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Correggi i campi evidenziati e rimuovi eventuali righe false.
                  Nulla è stato ancora aggiunto.
                </p>
              </div>
            </div>
          </section>

          <section aria-label="Allievi estratti" className="grid gap-3">
            {candidates.map((candidate, index) => (
              <CandidateCard
                candidate={candidate}
                courseStartDate={courseStartDate}
                index={index}
                invalid={invalidIds.has(candidate.id)}
                key={candidate.id}
                onChange={(updated) =>
                  setCandidates((current) =>
                    current.map((item) =>
                      item.id === updated.id ? updated : item,
                    ),
                  )
                }
                onRemove={() =>
                  setCandidates((current) =>
                    current.filter(({ id }) => id !== candidate.id),
                  )
                }
              />
            ))}
          </section>

          {candidates.length === 0 && (
            <p className="rounded-2xl border bg-card p-4 text-sm font-semibold">
              Hai rimosso tutte le righe. Scegli un’altra immagine oppure torna
              indietro.
            </p>
          )}

          {saveError && (
            <p
              className="mt-4 text-sm font-semibold text-[#b42318]"
              role="alert"
            >
              Gli allievi non sono stati aggiunti. Controlla e riprova.
            </p>
          )}

          <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
            <Button
              aria-label="Scegli un’altra immagine"
              className="size-12 px-0"
              onClick={chooseAnother}
              type="button"
              variant="secondary"
            >
              <ImagePlus aria-hidden="true" className="size-5" />
            </Button>
            <Button
              disabled={state === "saving" || candidates.length === 0}
              size="lg"
              type="submit"
            >
              {state === "saving"
                ? "Aggiunta…"
                : `Aggiungi ${candidates.length} ${candidates.length === 1 ? "allievo" : "allievi"}`}
            </Button>
          </div>
        </form>
      )}
    </>
  )
}
