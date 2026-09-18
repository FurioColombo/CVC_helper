import {
  Camera,
  ChevronLeft,
  FileCheck2,
  ImagePlus,
  RotateCcw,
  Trash2,
  UserPlus,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import {
  applyStudentNameOrder,
  MIN_FIELD_CONFIDENCE,
  scanStudents,
  type StudentNameOrder,
  type StudentScanCandidate,
  type StudentScanField,
  type StudentScanProgress,
  type StudentScanResult,
} from "@/capabilities/studentScan"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { STUDENT_SEXES, type StudentSex } from "@/domain/config"
import { StudentScanImageEditor } from "@/features/students/StudentScanImageEditor"
import { createStudents, type StudentInput } from "@/persistence/students"

type ScanState =
  "idle" | "scanning" | "review" | "unsuitable" | "error" | "saving"

// The name reading and its order live in the capability, which owns the
// surname-particle and compound rules. This screen only chooses when to apply
// them and records that the operator has taken over a row by hand.
interface ReviewCandidate extends StudentScanCandidate {
  id: string
  nameManuallyEdited?: boolean
}

interface Acquisition {
  file: File
  source: "camera" | "gallery"
}

function needsReview(candidate: ReviewCandidate, field: StudentScanField) {
  if (field === "phone" && !candidate.phone.trim()) return false
  return candidate.confidence[field] < MIN_FIELD_CONFIDENCE
}

function nameReadingNeedsReview(candidate: ReviewCandidate) {
  const reading = candidate.nameReading
  if (!reading) return false
  return (
    reading.order === "unknown" ||
    (reading.compoundAmbiguity && !reading.acknowledged)
  )
}

function candidateIsReady(candidate: ReviewCandidate, courseStartDate: string) {
  return Boolean(
    candidate.firstName.trim() &&
    candidate.surname.trim() &&
    candidate.dateOfBirth &&
    candidate.dateOfBirth <= courseStartDate &&
    candidate.sex &&
    !nameReadingNeedsReview(candidate) &&
    !(["firstName", "surname", "dateOfBirth", "phone"] as const).some((field) =>
      needsReview(candidate, field),
    ),
  )
}

/**
 * Apply an explicitly chosen source order across the sheet without overwriting
 * operator work. The split itself is the capability's decision; this only picks
 * which rows it may touch, and there is intentionally no implicit default.
 */
function applyNameOrderToCandidates(
  candidates: ReviewCandidate[],
  order: Exclude<StudentNameOrder, "unknown">,
  scope: "unresolved" | "all",
): ReviewCandidate[] {
  return candidates.map((candidate) => {
    const reading = candidate.nameReading
    if (!reading || candidate.nameManuallyEdited || reading.acknowledged) {
      return candidate
    }
    if (scope === "unresolved" && reading.order !== "unknown") {
      return candidate
    }
    return { ...applyStudentNameOrder(candidate, order), id: candidate.id }
  })
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
        className={`scroll-mt-[180px] ${uncertain ? "border-[#f79009]" : ""}`}
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
  disabled,
  onChange,
  onRemove,
}: {
  candidate: ReviewCandidate
  courseStartDate: string
  index: number
  invalid: boolean
  disabled: boolean
  onChange: (candidate: ReviewCandidate) => void
  onRemove: () => void
}) {
  function updateField(field: StudentScanField, value: string) {
    onChange({
      ...candidate,
      [field]: value,
      confidence: { ...candidate.confidence, [field]: 100 },
      ...(field === "firstName" || field === "surname"
        ? { nameManuallyEdited: true }
        : {}),
    })
  }

  function swapNameOrder() {
    const reading = candidate.nameReading
    if (!reading) return
    // An unresolved row is shown given-name-first, so swapping it means the
    // sheet is surname-first. The split is re-derived from the words as read,
    // which keeps a surname particle attached and makes this idempotent.
    const nextOrder: StudentNameOrder =
      reading.order === "surname-given" ? "given-surname" : "surname-given"
    onChange({
      ...applyStudentNameOrder(candidate, nextOrder),
      id: candidate.id,
    })
  }

  function confirmNameOrder() {
    const reading = candidate.nameReading
    if (!reading) return
    onChange({
      ...candidate,
      nameReading: {
        ...reading,
        order: reading.order === "unknown" ? "given-surname" : reading.order,
        acknowledged: true,
      },
    })
  }

  const nameNeedsReview = nameReadingNeedsReview(candidate)

  return (
    <article
      className={`rounded-2xl border bg-card p-3 shadow-[0_6px_18px_rgb(6_59_82/0.05)] ${invalid ? "border-[#d92d20]" : ""}`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-black">Allievo {index + 1}</h2>
        <Button
          aria-label={`Rimuovi allievo ${index + 1}`}
          className="scroll-mt-[180px] size-10 px-0 text-[#b42318]"
          disabled={disabled}
          onClick={onRemove}
          type="button"
          variant="secondary"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </div>

      {candidate.nameReading && (
        <div className="mb-2 rounded-xl border border-primary/20 bg-primary/5 p-2.5">
          <p className="text-xs leading-5 text-muted-foreground">
            <span className="font-bold text-foreground">Letto:</span>{" "}
            {candidate.nameReading.raw || "testo non disponibile"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold">
              {candidate.nameReading.order === "given-surname"
                ? "Nome · Cognome"
                : candidate.nameReading.order === "surname-given"
                  ? "Cognome · Nome"
                  : "Ordine da decidere"}
            </span>
            <Button
              aria-label={`Scambia nome e cognome riga ${candidate.id}`}
              className="min-h-10 px-2.5 text-xs"
              disabled={disabled}
              onClick={swapNameOrder}
              type="button"
              variant="secondary"
            >
              Scambia nome e cognome
            </Button>
            {nameNeedsReview && (
              <Button
                className="min-h-10 px-2.5 text-xs"
                disabled={disabled}
                onClick={confirmNameOrder}
                type="button"
              >
                Conferma nome e cognome
              </Button>
            )}
          </div>
          {candidate.nameReading.compoundAmbiguity &&
            !candidate.nameReading.acknowledged && (
              <p className="mt-1 text-xs font-semibold text-[#a2381b]">
                Nome o cognome composto: controlla la suddivisione.
              </p>
            )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <ReviewField
          autoComplete="given-name"
          candidate={candidate}
          field="firstName"
          label="Nome"
          disabled={disabled}
          onChange={(value) => updateField("firstName", value)}
        />
        <ReviewField
          autoComplete="family-name"
          candidate={candidate}
          field="surname"
          label="Cognome"
          disabled={disabled}
          onChange={(value) => updateField("surname", value)}
        />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <ReviewField
          candidate={candidate}
          field="dateOfBirth"
          label="Data di nascita"
          disabled={disabled}
          max={courseStartDate}
          onChange={(value) => updateField("dateOfBirth", value)}
          type="date"
        />
        <ReviewField
          candidate={candidate}
          field="phone"
          inputMode="tel"
          label="Telefono"
          disabled={disabled}
          onChange={(value) => updateField("phone", value)}
          type="tel"
        />
      </div>

      <fieldset className="mt-2 grid gap-1.5 text-sm font-bold">
        <legend>Sesso</legend>
        <div className="grid grid-cols-3 gap-2">
          {STUDENT_SEXES.map((option) => (
            <label className="cursor-pointer" key={option.id}>
              <input
                checked={candidate.sex === option.id}
                className="peer scroll-mt-[180px] sr-only"
                disabled={disabled}
                name={`scan-sex-${candidate.id}`}
                onChange={() => onChange({ ...candidate, sex: option.id })}
                type="radio"
                value={option.id}
              />
              <span className="grid h-10 place-items-center rounded-xl border bg-card text-sm transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {invalid && (
        <p className="mt-3 text-xs font-semibold text-[#b42318]" role="alert">
          {nameNeedsReview
            ? "Conferma la suddivisione di nome e cognome."
            : "Completa nome, cognome, data di nascita e sesso."}
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
  onManualAdd = onBack,
  scan = scanStudents,
}: {
  courseId: string
  courseStartDate: string
  onBack: () => void
  onCommitted: () => void
  onManualAdd?: () => void
  scan?: (
    image: Blob,
    onProgress?: (progress: StudentScanProgress) => void,
  ) => Promise<StudentScanResult>
}) {
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryButtonRef = useRef<HTMLButtonElement>(null)
  const cameraButtonRef = useRef<HTMLButtonElement>(null)
  const scanGenerationRef = useRef(0)
  const saveInFlightRef = useRef(false)
  const [state, setState] = useState<ScanState>("idle")
  const [progress, setProgress] = useState<StudentScanProgress>({
    phase: "loading",
    value: 0,
  })
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [candidates, setCandidates] = useState<ReviewCandidate[]>([])
  const [invalidIds, setInvalidIds] = useState<Set<string>>(new Set())
  const [saveError, setSaveError] = useState(false)
  const [acquisition, setAcquisition] = useState<Acquisition>()

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(
    () => () => {
      scanGenerationRef.current += 1
    },
    [],
  )

  function chooseAnother(source: "camera" | "gallery") {
    if (source === "camera") cameraInputRef.current?.click()
    else galleryInputRef.current?.click()
  }

  function closeAcquisition() {
    const source = acquisition?.source
    setAcquisition(undefined)
    window.requestAnimationFrame(() => {
      if (source === "camera") cameraButtonRef.current?.focus()
      else galleryButtonRef.current?.focus()
    })
  }

  async function handleImage(file: Blob) {
    const generation = ++scanGenerationRef.current
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setState("scanning")
    setProgress({ phase: "loading", value: 0 })
    setCandidates([])
    setInvalidIds(new Set())
    setSaveError(false)
    try {
      const result = await scan(file, (nextProgress) => {
        if (scanGenerationRef.current === generation) {
          setProgress(nextProgress)
        }
      })
      if (scanGenerationRef.current !== generation) return
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
      if (scanGenerationRef.current !== generation) return
      setState("error")
    } finally {
      if (scanGenerationRef.current === generation) {
        setPreviewUrl(undefined)
      }
    }
  }

  async function commitCandidates() {
    if (saveInFlightRef.current) return
    const invalid = new Set(
      candidates
        .filter((candidate) => !candidateIsReady(candidate, courseStartDate))
        .map(({ id }) => id),
    )
    setInvalidIds(invalid)
    if (invalid.size > 0 || candidates.length === 0) return

    saveInFlightRef.current = true
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
    } catch {
      saveInFlightRef.current = false
      setState("review")
      setSaveError(true)
      return
    }
    onCommitted()
  }

  const progressPercent = Math.round(progress.value * 100)
  const missingFields = candidates.reduce(
    (total, candidate) =>
      total +
      Number(!candidate.firstName.trim()) +
      Number(!candidate.surname.trim()) +
      Number(!candidate.dateOfBirth) +
      Number(!candidate.sex),
    0,
  )
  const rowsToReview = candidates.filter(
    (candidate) =>
      !candidate.firstName.trim() ||
      !candidate.surname.trim() ||
      !candidate.dateOfBirth ||
      !candidate.sex ||
      nameReadingNeedsReview(candidate) ||
      (["firstName", "surname", "dateOfBirth", "phone"] as const).some(
        (field) => needsReview(candidate, field),
      ),
  ).length
  const readyStudents = candidates.filter((candidate) =>
    candidateIsReady(candidate, courseStartDate),
  ).length
  const hasUnresolvedNameOrder = candidates.some(
    (candidate) => candidate.nameReading?.order === "unknown",
  )

  function acquisitionInput(
    ref: React.RefObject<HTMLInputElement | null>,
    source: "camera" | "gallery",
  ) {
    return (
      <input
        accept="image/*"
        aria-label={
          source === "camera"
            ? "Scatta foto dell’elenco allievi"
            : "Scegli foto dell’elenco allievi dalla galleria"
        }
        capture={source === "camera" ? "environment" : undefined}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) setAcquisition({ file, source })
        }}
        ref={ref}
        type="file"
      />
    )
  }

  return (
    <>
      <div className="mb-4 flex min-w-0 items-center gap-[4px]">
        <button
          aria-label="Indietro da Scan allievi"
          className="grid size-[44px] shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          onClick={onBack}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-black tracking-tight">
            Scan allievi
          </h1>
          <p className="[overflow-wrap:anywhere] text-xs text-muted-foreground">
            Foto o screenshot · revisione obbligatoria
          </p>
        </div>
      </div>

      {acquisitionInput(galleryInputRef, "gallery")}
      {acquisitionInput(cameraInputRef, "camera")}

      {(state === "idle" || state === "error") && (
        <section className="rounded-3xl border bg-card [padding:clamp(8px,4vw,20px)] text-center shadow-[0_12px_32px_rgb(6_59_82/0.07)]">
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
          <div className="mt-5 grid gap-2">
            <Button
              className="h-auto min-h-[48px] w-full gap-[6px] px-[8px] py-[8px] [&>svg]:size-[20px]"
              onClick={() => chooseAnother("camera")}
              ref={cameraButtonRef}
              size="lg"
            >
              <Camera aria-hidden="true" className="size-5" />
              Fai una foto
            </Button>
            <Button
              className="h-auto min-h-[48px] w-full gap-[6px] px-[8px] py-[8px] [&>svg]:size-[20px]"
              onClick={() => chooseAnother("gallery")}
              ref={galleryButtonRef}
              size="lg"
              variant="secondary"
            >
              <ImagePlus aria-hidden="true" className="size-5" />
              Scegli dalla galleria
            </Button>
            <Button
              className="h-auto min-h-[48px] w-full gap-[6px] px-[8px] py-[8px] [&>svg]:size-[20px]"
              onClick={onManualAdd}
              variant="secondary"
            >
              <UserPlus aria-hidden="true" className="size-5" />
              Inserisci manualmente
            </Button>
          </div>
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
          className="rounded-3xl border border-[#f79009] bg-card [padding:clamp(8px,4vw,20px)] shadow-[0_12px_32px_rgb(6_59_82/0.07)]"
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
          <div className="mt-5 grid gap-2">
            <Button
              className="h-auto min-h-[48px] w-full gap-[6px] px-[8px] py-[8px] [&>svg]:size-[20px]"
              onClick={() => chooseAnother("camera")}
              ref={cameraButtonRef}
              size="lg"
            >
              <Camera aria-hidden="true" className="size-5" />
              Rifai la foto
            </Button>
            <Button
              className="h-auto min-h-[48px] w-full gap-[6px] px-[8px] py-[8px] [&>svg]:size-[20px]"
              onClick={() => chooseAnother("gallery")}
              ref={galleryButtonRef}
              size="lg"
              variant="secondary"
            >
              <ImagePlus aria-hidden="true" className="size-5" />
              Scegli dalla galleria
            </Button>
            <Button
              className="h-auto min-h-[48px] w-full gap-[6px] px-[8px] py-[8px] [&>svg]:size-[20px]"
              onClick={onManualAdd}
              variant="secondary"
            >
              <UserPlus aria-hidden="true" className="size-5" />
              Inserisci manualmente
            </Button>
          </div>
        </section>
      )}

      {(state === "review" || state === "saving") && (
        <form
          aria-busy={state === "saving"}
          onSubmit={(event) => {
            event.preventDefault()
            void commitCandidates()
          }}
        >
          <section
            aria-label="Stato revisione scansione"
            aria-live="polite"
            className="sticky top-0 z-30 mb-3 grid grid-cols-3 gap-1.5 rounded-2xl border bg-background/95 p-2 shadow-[0_8px_24px_rgb(6_59_82/0.1)] backdrop-blur"
          >
            <div className="rounded-xl bg-muted px-1.5 py-2 text-center">
              <strong className="block text-lg leading-none">
                {rowsToReview}
              </strong>
              <span className="mt-1 block text-[0.62rem] leading-3 text-muted-foreground">
                righe da controllare
              </span>
            </div>
            <div
              className={`rounded-xl px-1.5 py-2 text-center ${missingFields ? "bg-[#fff4e5]" : "bg-[#e9f7ef]"}`}
            >
              <strong className="block text-lg leading-none">
                {missingFields}
              </strong>
              <span className="mt-1 block text-[0.62rem] leading-3 text-muted-foreground">
                campi da completare
              </span>
            </div>
            <div className="rounded-xl bg-primary/10 px-1.5 py-2 text-center">
              <strong className="block text-lg leading-none">
                {readyStudents}
              </strong>
              <span className="mt-1 block text-[0.62rem] leading-3 text-muted-foreground">
                allievi pronti
              </span>
            </div>
          </section>

          <section className="mb-3 rounded-2xl border bg-primary/5 p-3">
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

          {hasUnresolvedNameOrder && (
            <section
              aria-label="Ordine dei nomi"
              className="mb-3 rounded-2xl border bg-card p-3"
            >
              <h2 className="text-sm font-black">Ordine dei nomi</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Scegli solo se il foglio usa lo stesso ordine. Le righe già
                corrette restano invariate.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  className="h-auto min-h-10 px-2 text-xs"
                  disabled={state === "saving"}
                  onClick={() =>
                    setCandidates((current) =>
                      applyNameOrderToCandidates(
                        current,
                        "given-surname",
                        "unresolved",
                      ),
                    )
                  }
                  type="button"
                  variant="secondary"
                >
                  Applica Nome · Cognome
                </Button>
                <Button
                  className="h-auto min-h-10 px-2 text-xs"
                  disabled={state === "saving"}
                  onClick={() =>
                    setCandidates((current) =>
                      applyNameOrderToCandidates(
                        current,
                        "surname-given",
                        "unresolved",
                      ),
                    )
                  }
                  type="button"
                  variant="secondary"
                >
                  Applica Cognome · Nome
                </Button>
              </div>
            </section>
          )}

          <section aria-label="Allievi estratti" className="grid gap-3">
            {candidates.map((candidate, index) => (
              <CandidateCard
                candidate={candidate}
                courseStartDate={courseStartDate}
                disabled={state === "saving"}
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

          <div className="mt-4 grid grid-cols-[48px_minmax(0,1fr)] gap-[8px] pb-2">
            <Button
              aria-label="Scegli un’altra immagine"
              className="size-[48px] px-0"
              disabled={state === "saving"}
              onClick={() => chooseAnother("gallery")}
              type="button"
              variant="secondary"
            >
              <ImagePlus aria-hidden="true" className="size-5" />
            </Button>
            <Button
              className="h-auto min-h-[48px] min-w-0 [overflow-wrap:anywhere] px-[8px] py-[8px]"
              disabled={state === "saving" || candidates.length === 0}
              size="lg"
              type="submit"
            >
              {state === "saving"
                ? "Aggiunta…"
                : saveError
                  ? "Riprova inserimento"
                  : `Aggiungi ${candidates.length} ${candidates.length === 1 ? "allievo" : "allievi"}`}
            </Button>
          </div>
        </form>
      )}

      {acquisition && (
        <StudentScanImageEditor
          file={acquisition.file}
          onCancel={closeAcquisition}
          onUse={(image) => {
            setAcquisition(undefined)
            void handleImage(image)
          }}
          source={acquisition.source}
        />
      )}
    </>
  )
}
