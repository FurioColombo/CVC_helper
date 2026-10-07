import {
  ArrowLeftRight,
  Camera,
  Check,
  ChevronLeft,
  FileCheck2,
  ImagePlus,
  RotateCcw,
  Trash2,
  UserPlus,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import type { UnparsedPasteLine } from "@/capabilities/rosterPaste"
import {
  applyStudentNameOrder,
  inferSex,
  inferStudentNameOrder,
  MIN_FIELD_CONFIDENCE,
  scanStudents,
  studentScanAge,
  type StudentNameOrder,
  type StudentNameOrderInference,
  type StudentScanCandidate,
  type StudentScanField,
  type StudentScanOptions,
  type StudentScanProgress,
  type StudentScanResult,
  type StudentScanRowWarning,
} from "@/capabilities/studentScan"
import {
  ageConflictsWithReadDate,
  ageNeedsReview,
  candidateIsReady,
  candidateNeedsReview,
  missingFieldCount,
  nameReadingNeedsReview,
  needsReview,
  parsedReviewAge,
  rowWarningNeedsReview,
  toReviewCandidate,
  type ScanReviewCandidate,
} from "@/capabilities/studentScanReview"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { STUDENT_SEXES, type StudentSex } from "@/domain/config"
import {
  calculateAge,
  isValidDateOnly,
  MAX_DECLARED_STUDENT_AGE,
} from "@/domain/student"
import {
  StudentScanAssistantSection,
  StudentScanUnparsedLines,
} from "@/features/students/StudentScanAssistant"
import { StudentScanImageEditorDocument } from "@/features/students/StudentScanImageEditorDocument"
import {
  readNameOrderPreference,
  writeNameOrderPreference,
} from "@/features/students/studentScanNameOrderPreference"
import { requestLeave, useLeaveGuard } from "@/navigation/browserHistory"
import {
  createStudents,
  type StudentInput,
  type StudentRecord,
} from "@/persistence/students"

type ScanState =
  "idle" | "scanning" | "review" | "unsuitable" | "error" | "saving"

/**
 * `sexManuallyChosen` remembers whether the operator picked the sex
 * themselves, as opposed to a suggestion the scan or a split inferred. A
 * choice the operator made must never be overwritten by a later guess; a
 * suggestion is only ever a suggestion and must not survive attached to a
 * given name it was never read from. `scannedFirstName` is the given name the
 * row started with, so a field that started blank and is being filled in for
 * the first time is not mistaken for a name that changed.
 */
type ReviewCandidate = ScanReviewCandidate & {
  sexManuallyChosen?: boolean
  scannedFirstName?: string
  /** The operator pressed "Tieni entrambi" on a possible-duplicate warning
   * the screen computed for this row (V05 review V5-5). An edit that makes
   * the row stop matching clears the warning on its own; this flag only
   * covers the case where it still matches and the operator vouches for it
   * anyway. */
  duplicateAcknowledged?: boolean
}

const ROW_WARNING_TEXT: Record<StudentScanRowWarning, string> = {
  "possible-staff":
    "Forse personale e non un allievo: controlla la riga sul foglio, poi segnala controllata o rimuovila.",
  "possible-merged-rows":
    "Forse due righe lette insieme: controlla nomi e date sul foglio, correggi o rimuovi la riga.",
  "possible-heading":
    "Forse un’intestazione e non un allievo: controlla la riga sul foglio, poi segnala controllata o rimuovila.",
}

interface Acquisition {
  file: File
  source: "camera" | "gallery"
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
    return { ...candidate, ...applyStudentNameOrder(candidate, order) }
  })
}

/**
 * Case, accents and incidental extra spacing are an assistant's or a scan's
 * typography, not a different name, so they are folded away before two rows'
 * surname and given name are compared for a possible duplicate.
 */
function duplicateNamePart(value: string) {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("it-IT")
}

/**
 * The one value that stands in for a row's age when comparing it against
 * another row for a possible duplicate (V05 review V5-5): the birth date's
 * computed age when the row has a usable date, its printed or declared age
 * otherwise. Converting a date to an age here, rather than comparing dates
 * literally, is what lets a scanned row with a full date and an existing
 * profile that only ever recorded a declared age still be compared at all.
 */
function duplicateAgeSignal(
  dateOfBirth: string,
  age: number | null,
  courseStartDate: string,
) {
  if (dateOfBirth && isValidDateOnly(dateOfBirth)) {
    return calculateAge(dateOfBirth, courseStartDate)
  }
  return age
}

function duplicateSignature(
  firstName: string,
  surname: string,
  dateOfBirth: string,
  age: number | null,
  courseStartDate: string,
) {
  if (!firstName.trim() || !surname.trim()) return null
  const ageSignal = duplicateAgeSignal(dateOfBirth, age, courseStartDate)
  if (ageSignal === null) return null
  return `${duplicateNamePart(surname)}|${duplicateNamePart(firstName)}#${ageSignal}`
}

/**
 * Possible duplicates, within the pasted or scanned batch itself and against
 * the course's existing roster (V05 review V5-5). This lives here, in the
 * screen, rather than in the review gate module: it compares rows against
 * each other and against data the gate never sees, which is not a rule about
 * one candidate's own fields. Only the later occurrence of a collision is
 * flagged, so resolving it never depends on touching the row it matches.
 */
function findPossibleDuplicates(
  candidates: ReviewCandidate[],
  existingStudents: StudentRecord[],
  courseStartDate: string,
): Map<string, string> {
  const matches = new Map<string, string>()
  const existingBySignature = new Map<string, string>()
  existingStudents.forEach((student) => {
    const key = duplicateSignature(
      student.firstName,
      student.surname,
      student.dateOfBirth,
      student.declaredAgeAtCourseStart,
      courseStartDate,
    )
    if (key && !existingBySignature.has(key)) {
      existingBySignature.set(
        key,
        `${student.firstName} ${student.surname}`.trim(),
      )
    }
  })

  const seenBySignature = new Map<string, ReviewCandidate>()
  candidates.forEach((candidate) => {
    const key = duplicateSignature(
      candidate.firstName,
      candidate.surname,
      candidate.dateOfBirth,
      parsedReviewAge(candidate),
      courseStartDate,
    )
    if (!key) return
    const existingMatch = existingBySignature.get(key)
    if (existingMatch) {
      matches.set(candidate.id, existingMatch)
      return
    }
    const earlier = seenBySignature.get(key)
    if (earlier) {
      matches.set(
        candidate.id,
        `${earlier.firstName} ${earlier.surname}`.trim(),
      )
      return
    }
    seenBySignature.set(key, candidate)
  })

  return matches
}

/** The letters a sex choice shows: "Altro" does not fit the 40 px square. */
function sexOptionLabel(option: (typeof STUDENT_SEXES)[number]) {
  return option.id === "other" ? "Alt" : option.label
}

function missingFieldNames(candidate: ReviewCandidate) {
  return [
    !candidate.firstName.trim() && "nome",
    !candidate.surname.trim() && "cognome",
    parsedReviewAge(candidate) === null && "età",
    !candidate.sex && "sesso",
  ].filter((name): name is string => Boolean(name))
}

/** "nome", "nome e sesso", "nome, cognome e sesso". */
function joinItalian(items: string[]) {
  return items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`
}

function ReviewField({
  candidate,
  courseStartDate,
  field,
  label,
  rowNumber,
  onChange,
  onAcknowledge,
  consumeProgrammaticFocus,
  ...inputProps
}: {
  candidate: ReviewCandidate
  courseStartDate: string
  field: StudentScanField
  label: string
  /** The row's place on screen (the "Allievo n" of its card): the name a
   * screen reader or a voice command uses, never the internal row id. */
  rowNumber: number
  onChange: (value: string) => void
  onAcknowledge: () => void
  /** True when this exact focus was the counter's own navigation rather than
   * the operator's pointer or keyboard, so it must not arm acknowledgement. */
  consumeProgrammaticFocus: (target: EventTarget | null) => boolean
} & Omit<
  React.ComponentProps<typeof Input>,
  "onChange" | "onBlur" | "onFocus" | "value"
>) {
  const uncertain = needsReview(candidate, field, courseStartDate)
  // A blur only counts as review when this field's own focus was the
  // operator's doing. A focus the counter gave it programmatically, then lost
  // again on the next tap, must never silently acknowledge the field.
  const armedRef = useRef(false)
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-bold">
      {/* The caption and its "Da controllare" flag share a half-width column.
          At 200% text neither fits beside the other, and flex items will not
          shrink below their own content unless told to, so the row used to push
          past the card. It wraps and breaks instead. */}
      <span className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
        <span className="min-w-0 break-words">{label}</span>
        {uncertain && (
          <span className="min-w-0 text-[0.68rem] font-bold break-words text-[#a2381b]">
            Da controllare
          </span>
        )}
      </span>
      <Input
        aria-label={`${label} riga ${rowNumber}`}
        className={`scroll-mt-[180px] ${uncertain ? "border-[#f79009]" : ""}`}
        data-scan-field={field}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => {
          armedRef.current = !consumeProgrammaticFocus(event.target)
        }}
        onBlur={() => {
          if (armedRef.current && uncertain && candidate[field].trim()) {
            onAcknowledge()
          }
          armedRef.current = false
        }}
        value={candidate[field]}
        {...inputProps}
      />
    </label>
  )
}

function CandidateCard({
  candidate,
  courseStartDate,
  duplicateOf,
  index,
  invalid,
  disabled,
  readPhone,
  consumeProgrammaticFocus,
  onChange,
  onRemove,
  cardRef,
}: {
  candidate: ReviewCandidate
  courseStartDate: string
  /** The name of the row or existing student this candidate's normalized
   * name and date/age match, if any (computed by the screen; see
   * `findPossibleDuplicates`). */
  duplicateOf?: string
  index: number
  invalid: boolean
  disabled: boolean
  readPhone: boolean
  consumeProgrammaticFocus: (target: EventTarget | null) => boolean
  onChange: (candidate: ReviewCandidate) => void
  onRemove: () => void
  cardRef: (node: HTMLElement | null) => void
}) {
  const ageArmedRef = useRef(false)

  function updateField(field: StudentScanField, value: string) {
    // A sex suggestion is only ever evidence about the given name it was read
    // from. Once the operator changes a name that was actually read, the old
    // guess is not evidence about the new one and must not silently survive
    // attached to it, unless the operator picked the sex themselves. A field
    // that started blank is being completed, not corrected, so whatever sex
    // it already carries is left alone while it is typed in.
    const staleSex =
      field === "firstName" &&
      !candidate.sexManuallyChosen &&
      Boolean(candidate.scannedFirstName?.trim())
    onChange({
      ...candidate,
      [field]: value,
      confidence: { ...candidate.confidence, [field]: 100 },
      ...(field === "firstName" || field === "surname"
        ? { nameManuallyEdited: true }
        : {}),
      // The typed given name is the operator's own, so it may suggest again.
      ...(staleSex ? { sex: inferSex(value) } : {}),
    })
  }

  function updateAge(value: string) {
    const parsed = /^\d{1,3}$/.test(value) ? Number(value) : null
    const validAge =
      parsed !== null && parsed <= MAX_DECLARED_STUDENT_AGE ? parsed : null
    onChange({
      ...candidate,
      reviewAge: value,
      ageManuallyEdited: true,
      acknowledgedFields: {
        ...candidate.acknowledgedFields,
        age: false,
      },
      ...(validAge !== null
        ? { ageReading: { value: validAge, confidence: 100 } }
        : { ageReading: undefined }),
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
  const hasUnacknowledgedLowConfidenceName =
    !candidate.confirmed &&
    (["firstName", "surname"] as const).some(
      (field) =>
        candidate.confidence[field] < MIN_FIELD_CONFIDENCE &&
        !candidate.acknowledgedFields?.[field],
    )
  const nameReadingVisible = Boolean(
    candidate.nameReading &&
    (nameNeedsReview || hasUnacknowledgedLowConfidenceName),
  )
  const reviewAgeNeedsAttention = ageNeedsReview(candidate, courseStartDate)
  const duplicateUnresolved =
    Boolean(duplicateOf) && !candidate.duplicateAcknowledged
  // The date is never shown or edited directly (age-only entry, owner
  // decision 2026-09-28): it is internal working data the scan read
  // alongside a printed age, kept only so a real conflict between the two
  // can still be surfaced. A conflict says what the date alone gives, so the
  // operator can adopt it in one tap without ever seeing the date itself
  // (V05 review V5R2-1); the operator's decision always wins in the end
  // (owner decision 2026-09-28), whichever of the three ways out they take.
  const storedDateValid =
    Boolean(candidate.dateOfBirth) && isValidDateOnly(candidate.dateOfBirth)
  const derivedAgeFromDate = storedDateValid
    ? studentScanAge({ ...candidate, ageReading: undefined }, courseStartDate)
    : null
  const ageDateConflict =
    storedDateValid &&
    derivedAgeFromDate !== null &&
    ageConflictsWithReadDate(candidate, courseStartDate)

  function useAgeFromDate() {
    if (derivedAgeFromDate === null) return
    onChange({
      ...candidate,
      reviewAge: String(derivedAgeFromDate),
      ageReading: undefined,
      ageManuallyEdited: false,
    })
  }

  function acknowledgeField(field: StudentScanField | "age") {
    onChange({
      ...candidate,
      acknowledgedFields: {
        ...candidate.acknowledgedFields,
        [field]: true,
      },
    })
  }

  function swapNameFields() {
    const reading = candidate.nameReading
    // Two words are unambiguous: swapping them is itself the whole answer to
    // which one is the given name, so the reading is resolved. A compound
    // reading's split is a separate question the swap does not settle, so it
    // stays pending.
    // A short word left out between the two (droppedInteriorWord) means the
    // reading is not really two words, so the swap does not settle it.
    const twoWordReading =
      reading?.words.length === 2 && !reading.droppedInteriorWord
    onChange({
      ...candidate,
      firstName: candidate.surname,
      surname: candidate.firstName,
      // The confidence and the acknowledgement travel with the text: a
      // low-confidence reading that moves from one field to the other must
      // still be flagged there, not silently cleared by the swap.
      confidence: {
        ...candidate.confidence,
        firstName: candidate.confidence.surname,
        surname: candidate.confidence.firstName,
      },
      acknowledgedFields: {
        ...candidate.acknowledgedFields,
        firstName: candidate.acknowledgedFields?.surname,
        surname: candidate.acknowledgedFields?.firstName,
      },
      nameManuallyEdited: true,
      // The old suggestion was read from the given name that just moved to
      // the surname field; it says nothing about the new given name.
      ...(candidate.sexManuallyChosen
        ? {}
        : {
            sex:
              candidate.confidence.surname >= MIN_FIELD_CONFIDENCE
                ? inferSex(candidate.surname)
                : null,
          }),
      // The swapped-in text is now the row's given name, so a later edit to
      // it is judged against this value, not the word that used to be there.
      scannedFirstName: candidate.surname,
      ...(reading
        ? {
            nameReading: twoWordReading
              ? { ...reading, acknowledged: true }
              : reading,
          }
        : {}),
    })
  }

  return (
    <article
      className={`rounded-2xl border bg-card p-3 shadow-[0_6px_18px_rgb(6_59_82/0.05)] ${invalid ? "border-[#d92d20]" : ""}`}
      ref={cardRef}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2
          className="min-w-0 truncate text-base font-black outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
          tabIndex={-1}
        >
          Allievo {index + 1}
        </h2>
        {/* The cluster wraps under the heading at 200% text rather than
            widening the card past the viewport. */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button
            aria-label={`Scambia nome e cognome riga ${index + 1}`}
            className="size-10 shrink-0 px-0"
            disabled={disabled}
            onClick={swapNameFields}
            type="button"
            variant="secondary"
          >
            <ArrowLeftRight aria-hidden="true" className="size-4" />
          </Button>
          <Button
            aria-label={`Segna controllata la riga di allievo ${index + 1}`}
            aria-pressed={Boolean(candidate.confirmed)}
            data-scan-field="row"
            className={`min-h-10 px-2.5 text-xs ${candidate.confirmed ? "border-[#2e7d51] text-[#1d6b41]" : ""}`}
            disabled={disabled}
            onClick={() =>
              onChange({ ...candidate, confirmed: !candidate.confirmed })
            }
            type="button"
            variant="secondary"
          >
            <Check aria-hidden="true" className="size-3.5" />
            {candidate.confirmed ? "Controllato" : "Controlla"}
          </Button>
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
      </div>

      {nameReadingVisible && candidate.nameReading && (
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
            {nameNeedsReview && (
              <Button
                aria-label={`Conferma suddivisione nome e cognome riga ${index + 1}`}
                className="min-h-10 max-w-full min-w-0 px-2.5 text-xs whitespace-normal"
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

      {duplicateUnresolved && (
        <div
          className="mb-2 rounded-xl border border-[#f0b69f] bg-[#fff4ee] p-2.5"
          role="alert"
        >
          <p className="text-xs leading-5 font-semibold text-[#9a3412]">
            Possibile doppione di {duplicateOf}: rimuovi la riga se è lo stesso
            allievo.
          </p>
          <Button
            className="mt-2 min-h-10 px-2.5 text-xs"
            data-scan-field="duplicate"
            disabled={disabled}
            onClick={() =>
              onChange({ ...candidate, duplicateAcknowledged: true })
            }
            type="button"
            variant="secondary"
          >
            Tieni entrambi
          </Button>
        </div>
      )}

      {candidate.rowWarning && rowWarningNeedsReview(candidate) && (
        <p className="mb-2 rounded-xl border border-[#f0b69f] bg-[#fff4ee] p-2.5 text-xs leading-5 font-semibold text-[#9a3412]">
          {ROW_WARNING_TEXT[candidate.rowWarning]}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <ReviewField
          autoComplete="given-name"
          candidate={candidate}
          consumeProgrammaticFocus={consumeProgrammaticFocus}
          courseStartDate={courseStartDate}
          field="firstName"
          label="Nome"
          rowNumber={index + 1}
          disabled={disabled}
          onChange={(value) => updateField("firstName", value)}
          onAcknowledge={() => acknowledgeField("firstName")}
        />
        <ReviewField
          autoComplete="family-name"
          candidate={candidate}
          consumeProgrammaticFocus={consumeProgrammaticFocus}
          courseStartDate={courseStartDate}
          field="surname"
          label="Cognome"
          rowNumber={index + 1}
          disabled={disabled}
          onChange={(value) => updateField("surname", value)}
          onAcknowledge={() => acknowledgeField("surname")}
        />
      </div>

      <div
        className={`mt-2 grid min-w-0 items-center gap-2 ${readPhone ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-[120px] flex-1 items-center gap-2">
            <label
              className="shrink-0 text-sm font-bold"
              htmlFor={`scan-age-${candidate.id}`}
            >
              Età
            </label>
            <Input
              aria-label={`Età riga ${index + 1}`}
              className={`min-w-0 flex-1 scroll-mt-[180px] ${reviewAgeNeedsAttention ? "border-[#f79009]" : ""}`}
              data-scan-field="age"
              disabled={disabled}
              id={`scan-age-${candidate.id}`}
              inputMode="numeric"
              aria-invalid={reviewAgeNeedsAttention}
              onFocus={(event) => {
                ageArmedRef.current = !consumeProgrammaticFocus(event.target)
              }}
              onBlur={() => {
                if (
                  ageArmedRef.current &&
                  reviewAgeNeedsAttention &&
                  candidate.reviewAge.trim()
                ) {
                  acknowledgeField("age")
                }
                ageArmedRef.current = false
              }}
              onChange={(event) => updateAge(event.target.value)}
              type="text"
              value={candidate.reviewAge}
            />
            {reviewAgeNeedsAttention && (
              <span className="shrink-0 text-[0.68rem] font-bold text-[#a2381b]">
                Da controllare
              </span>
            )}
          </div>
          <div
            aria-labelledby={`scan-sex-label-${candidate.id}`}
            className="flex shrink-0 items-center gap-2 text-sm font-bold"
            role="radiogroup"
          >
            <span id={`scan-sex-label-${candidate.id}`}>Sesso</span>
            <div className="grid grid-cols-3 gap-1">
              {STUDENT_SEXES.map((option) => (
                <label className="cursor-pointer" key={option.id}>
                  <input
                    aria-label={`${sexOptionLabel(option)} — ${option.detailLabel.toLowerCase()}`}
                    checked={candidate.sex === option.id}
                    className="peer scroll-mt-[180px] sr-only"
                    data-scan-field="sex"
                    disabled={disabled}
                    name={`scan-sex-${candidate.id}`}
                    onChange={() =>
                      onChange({
                        ...candidate,
                        sex: option.id,
                        sexManuallyChosen: true,
                      })
                    }
                    type="radio"
                    value={option.id}
                  />
                  <span className="grid size-[40px] place-items-center rounded-xl border bg-card text-sm transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring">
                    {sexOptionLabel(option)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        {readPhone && (
          <ReviewField
            candidate={candidate}
            consumeProgrammaticFocus={consumeProgrammaticFocus}
            courseStartDate={courseStartDate}
            field="phone"
            inputMode="tel"
            label="Telefono"
            rowNumber={index + 1}
            disabled={disabled}
            onChange={(value) => updateField("phone", value)}
            onAcknowledge={() => acknowledgeField("phone")}
            type="tel"
          />
        )}
      </div>

      {ageDateConflict && (
        <div className="mt-2 rounded-xl border border-[#f0b69f] bg-[#fff4ee] p-2.5">
          {/* A typed or acknowledged age never conflicts any more (the
              operator's decision wins), so this box only ever shows the
              printed reading, never one the operator entered themselves. */}
          <p className="text-xs leading-5 font-semibold text-[#9a3412]">
            Età sul foglio {candidate.reviewAge}, dalla data{" "}
            {derivedAgeFromDate} all’inizio del corso.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              className="min-h-10 px-2.5 text-xs"
              disabled={disabled}
              onClick={useAgeFromDate}
              type="button"
              variant="secondary"
            >
              Usa l’età dalla data ({derivedAgeFromDate})
            </Button>
            <Button
              className="min-h-10 px-2.5 text-xs"
              disabled={disabled}
              onClick={() => acknowledgeField("age")}
              type="button"
              variant="secondary"
            >
              Tieni l’età sul foglio ({candidate.reviewAge})
            </Button>
          </div>
        </div>
      )}

      {/* Not a live region of its own: with many rows refused at once the
          screen reader would read one alert per row. The screen's one summary
          alert (above the save button) announces them; this says what is wrong
          in this row, with its number, for whoever reads on. */}
      {invalid && (
        <p className="mt-3 text-xs font-semibold text-[#b42318]">
          {`Allievo ${index + 1}: `}
          {nameNeedsReview
            ? "conferma la suddivisione di nome e cognome."
            : duplicateUnresolved
              ? "possibile doppione, tieni entrambi oppure rimuovi la riga."
              : rowWarningNeedsReview(candidate)
                ? "controlla la riga sul foglio e segnala controllata, oppure rimuovila."
                : missingFieldNames(candidate).length > 0
                  ? `completa ${joinItalian(missingFieldNames(candidate))}.`
                  : "controlla i campi segnati “Da controllare”."}
        </p>
      )}
    </article>
  )
}

export function StudentScan({
  courseId,
  courseStartDate,
  existingStudents = [],
  initialAssistantExpanded = false,
  onBack,
  onCommitted,
  onManualAdd = onBack,
  scan = scanStudents,
}: {
  courseId: string
  courseStartDate: string
  /** The course's current roster, used only to flag a possible duplicate
   * (V05 review V5-5); never persisted from here. */
  existingStudents?: StudentRecord[]
  /** Lands directly in the assistant section (Task 4): the "Usa un
   * assistente" method, offered beside "Aggiungi allievo" and "Scan allievi"
   * from the empty Allievi page and the three-dot menu, opens this same
   * screen already expanded rather than making the operator open it again. */
  initialAssistantExpanded?: boolean
  onBack: () => void
  onCommitted: () => void
  onManualAdd?: () => void
  scan?: (
    image: Blob,
    onProgress?: (progress: StudentScanProgress) => void,
    options?: StudentScanOptions,
  ) => Promise<StudentScanResult>
}) {
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryButtonRef = useRef<HTMLButtonElement>(null)
  const cameraButtonRef = useRef<HTMLButtonElement>(null)
  const scanGenerationRef = useRef(0)
  const saveInFlightRef = useRef(false)
  const candidateCardRefs = useRef(new Map<string, HTMLElement>())
  // The unread-line inputs the counter can jump to once no candidate row
  // needs review first (V05 review V5-3), keyed by 1-based source line.
  const unparsedLineRefs = useRef(new Map<number, HTMLElement>())
  // The paste review's completeness confirmation button (V05 review
  // V5R2-2/V5R2-3): where a save refused for that reason alone is sent, once
  // every unread line is already resolved.
  const pasteConfirmationRef = useRef<HTMLElement | null>(null)
  // The exact element the counters last focused programmatically. A field
  // that merely receives this focus and then loses it again must not count
  // as reviewed by the operator.
  const armedFocusTargetRef = useRef<HTMLElement | null>(null)
  // A successful save must never be second-guessed by the leave guard: once
  // it flips, discarding is no longer possible, so there is nothing left to
  // ask about.
  const committedRef = useRef(false)
  const discardAlertRef = useRef<HTMLElement>(null)
  // Off by default. The owner asked for the telephone to be opt-in so a scan
  // can be judged on the names and the dates of birth, which is what the course
  // actually needs; the number is useful and rarely urgent.
  const [readPhone, setReadPhone] = useState(false)
  const [state, setState] = useState<ScanState>("idle")
  const [progress, setProgress] = useState<StudentScanProgress>({
    phase: "loading",
    value: 0,
  })
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [candidates, setCandidates] = useState<ReviewCandidate[]>([])
  const [nameOrder, setNameOrder] = useState<Exclude<
    StudentNameOrder,
    "unknown"
  > | null>(null)
  const [orderInference, setOrderInference] =
    useState<StudentNameOrderInference | null>(null)
  const [invalidIds, setInvalidIds] = useState<Set<string>>(new Set())
  const [navigationAnnouncement, setNavigationAnnouncement] = useState("")
  const [saveError, setSaveError] = useState(false)
  const [imageNeedsRetake, setImageNeedsRetake] = useState(false)
  const [acquisition, setAcquisition] = useState<Acquisition>()
  const [discardConfirmation, setDiscardConfirmation] = useState<{
    onConfirm: () => void
  } | null>(null)
  // Set only when the review on screen came from a pasted assistant answer:
  // which of its lines could not be read, whether its FINE line was ever
  // found, and the row count the operator last confirmed as the sheet's
  // whole roster (V05 review V5R2-3: required for every pasted answer, not
  // only an interrupted one). `confirmedCount` names a specific number
  // rather than a plain yes/no (V05 review V5F-1): a confirmation given for
  // N rows must not silently keep covering a different N after a row is
  // left out or removed, so it is treated as still standing only while no
  // unread line remains and today's row count is exactly the one that was
  // confirmed. Absent for an ordinary scan review, which has no such lines
  // and no such count to confirm.
  const [pasteImport, setPasteImport] = useState<{
    unparsed: UnparsedPasteLine[]
    complete: boolean
    confirmedCount: number | null
  } | null>(null)
  // The assistant section's own state lives here, not inside it: a discarded
  // review can then hand the operator back to exactly the text they pasted
  // (V05 review V5-6), which the section itself would otherwise lose the
  // moment an import replaces it on screen.
  const [assistantExpanded, setAssistantExpanded] = useState(
    initialAssistantExpanded,
  )
  const [assistantAnswer, setAssistantAnswer] = useState("")

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

  useEffect(() => {
    if (!discardConfirmation) return
    discardAlertRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "start",
    })
    discardAlertRef.current?.focus({ preventScroll: true })
  }, [discardConfirmation])

  // A review with candidates in it represents work the operator has not yet
  // saved: leaving without asking would silently discard every correction
  // made so far. A successful save is the one way out that needs no question.
  // `committedRef` is read inside the guard itself, not just when this value
  // is built, because setting it does not by itself cause a re-render: a
  // save can succeed and call `onCommitted` before this component ever
  // renders again, and a guard built before that must still see it.
  // An unread line is exactly as much unsaved work as a candidate row: it
  // came from the same pasted answer and leaving without asking would
  // silently drop it (V05 review V5-4), even when no candidate exists yet.
  // A paste review with neither (every row unread was left out, or the
  // answer had none at all) still holds the pasted text itself: leaving
  // without asking would drop that too (V05 review V5R2-5), so the mere
  // presence of a paste review is already unsaved work, not just what came
  // out of it.
  const hasUnsavedReview = candidates.length > 0 || pasteImport !== null
  useLeaveGuard(
    hasUnsavedReview
      ? (leave) => {
          if (committedRef.current) return false
          setDiscardConfirmation({
            onConfirm: () => {
              setDiscardConfirmation(null)
              leave()
            },
          })
          return true
        }
      : null,
  )

  function consumeProgrammaticFocus(target: EventTarget | null) {
    const matched =
      armedFocusTargetRef.current !== null &&
      armedFocusTargetRef.current === target
    armedFocusTargetRef.current = null
    return matched
  }

  function chooseAnother(source: "camera" | "gallery") {
    if (source === "camera") cameraInputRef.current?.click()
    else galleryInputRef.current?.click()
  }

  /**
   * Another image or a retake replaces every row on screen. While there is
   * still a review in progress, that replacement is exactly as destructive as
   * leaving the screen, so it asks the same question first.
   */
  function requestAnotherImage(source: "camera" | "gallery") {
    if (!hasUnsavedReview) {
      chooseAnother(source)
      return
    }
    setDiscardConfirmation({
      onConfirm: () => {
        setDiscardConfirmation(null)
        chooseAnother(source)
      },
    })
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
    setImageNeedsRetake(false)
    // A fresh image replaces any earlier assistant import exactly as it
    // replaces a scan: the unparsed lines and the incomplete-answer notice
    // belonged to a different sheet.
    setPasteImport(null)
    try {
      const result = await scan(
        file,
        (nextProgress) => {
          if (scanGenerationRef.current === generation) {
            setProgress(nextProgress)
          }
        },
        { readPhone },
      )
      if (scanGenerationRef.current !== generation) return
      if (result.unsuitable) {
        setState("unsuitable")
        return
      }
      // A weak page can still contain useful words. Warn and offer a retake,
      // while keeping every reading available for correction instead of
      // treating a couple of plausible fragments as a trustworthy roster.
      setImageNeedsRetake(result.aggregateConfidence < MIN_FIELD_CONFIDENCE)
      const scanned = result.candidates.map((candidate, index) => ({
        ...toReviewCandidate(candidate, index, courseStartDate),
        // The name the row started with. A sex suggestion can only ever have
        // come from a given name that was actually read, so a row that
        // started blank keeps whatever sex it carries while it is filled in
        // for the first time; only a change to a name that really was read
        // makes the old suggestion stale.
        scannedFirstName: candidate.firstName,
      }))
      // An explicit correction outranks the sheet vote. An inferred order is
      // not persisted as a human preference; the next sheet gets its own vote.
      // But a remembered choice is a tie-breaker for a sheet that cannot
      // decide on its own, not a license to override one that just did: a
      // decisive vote that disagrees with memory is asked about again rather
      // than silently overridden, since applying the wrong order mangles
      // every name on the sheet.
      const remembered = readNameOrderPreference(courseId)
      const inference = inferStudentNameOrder(scanned)
      const disagreesWithMemory =
        remembered !== null &&
        inference.order !== "unknown" &&
        inference.order !== remembered
      const selected = disagreesWithMemory
        ? null
        : (remembered ??
          (inference.order === "unknown" ? null : inference.order))
      setOrderInference(!remembered || disagreesWithMemory ? inference : null)
      setNameOrder(selected)
      setCandidates(
        selected
          ? applyNameOrderToCandidates(scanned, selected, "unresolved")
          : scanned,
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

  /**
   * The assistant path's counterpart to `handleImage`: the answer is already
   * parsed, so this only opens the same review state a scan would, minus the
   * name-order question the columns already answer.
   */
  function handlePasteImport(result: {
    candidates: StudentScanCandidate[]
    unparsed: UnparsedPasteLine[]
    complete: boolean
  }) {
    // Invalidate any scan still in flight: a pasted answer replaces whatever
    // the camera path was doing, exactly as a fresh image would.
    scanGenerationRef.current += 1
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(undefined)
    const mapped = result.candidates.map((candidate, index) => ({
      ...toReviewCandidate(candidate, index, courseStartDate),
      // Mirrors the scan path: a sex suggestion is only ever evidence about a
      // given name that was actually read.
      scannedFirstName: candidate.firstName,
    }))
    setCandidates(mapped)
    setPasteImport({
      unparsed: result.unparsed,
      complete: result.complete,
      confirmedCount: null,
    })
    setInvalidIds(new Set())
    setSaveError(false)
    setImageNeedsRetake(false)
    // The columns already say which word is the surname, so there is nothing
    // left for the name-order question to resolve.
    setNameOrder(null)
    setOrderInference(null)
    setState("review")
  }

  /** A line the answer got wrong, fixed in place and read again. Inserted at
   * its own position in the sheet (V05 review V5-11) rather than appended:
   * the operator compares the review against the sheet in that order, and a
   * fix landing at the end would put every later row out of place. */
  function handlePasteLineResolved(
    line: UnparsedPasteLine,
    candidate: StudentScanCandidate,
  ) {
    setCandidates((current) => {
      const resolved = {
        ...toReviewCandidate(candidate, current.length, courseStartDate),
        scannedFirstName: candidate.firstName,
      }
      const insertAt = current.findIndex((existing) => {
        const match = /^paste-(\d+)$/.exec(existing.sourceId)
        return match !== null && Number(match[1]) > line.line
      })
      if (insertAt === -1) return [...current, resolved]
      return [
        ...current.slice(0, insertAt),
        resolved,
        ...current.slice(insertAt),
      ]
    })
    setPasteImport((current) =>
      current
        ? {
            ...current,
            unparsed: current.unparsed.filter(
              (item) => item.line !== line.line,
            ),
          }
        : current,
    )
  }

  /** The operator chose not to fix this line: it is left out of the roster
   * without being read (V05 review V5-3). */
  function leaveOutUnparsedLine(line: UnparsedPasteLine) {
    setPasteImport((current) =>
      current
        ? {
            ...current,
            unparsed: current.unparsed.filter(
              (item) => item.line !== line.line,
            ),
          }
        : current,
    )
  }

  /** The completeness confirmation's "Sono tutti" (V05 review V5R2-3):
   * required before saving for every pasted answer, not only an interrupted
   * one, so a well-formed answer that silently omits a student still asks
   * the operator to count. Records the row count being confirmed rather than
   * a plain yes/no (V05 review V5F-1): it is disabled while an unread line
   * is still pending, so this only ever runs once none remain. */
  function confirmPasteComplete() {
    setPasteImport((current) =>
      current ? { ...current, confirmedCount: candidates.length } : current,
    )
  }

  function registerPasteConfirmation(node: HTMLElement | null) {
    pasteConfirmationRef.current = node
  }

  /** The counter's ordinary navigation goes to a plain "riga da controllare";
   * a save the operator just asked for and did not get must say so instead
   * (V05 review V5R2-2), on the same element. */
  function jumpToPasteConfirmation(
    reason: "riga da controllare" | "save refused" = "riga da controllare",
  ) {
    const button = pasteConfirmationRef.current
    button?.scrollIntoView?.({ behavior: "smooth", block: "start" })
    button?.focus({ preventScroll: true })
    setNavigationAnnouncement(
      reason === "save refused"
        ? "Salvataggio bloccato: conferma se sono tutti gli allievi del foglio."
        : "Conferma se sono tutti gli allievi del foglio, riga da controllare.",
    )
  }

  function registerUnparsedLineInput(line: number, node: HTMLElement | null) {
    if (node) unparsedLineRefs.current.set(line, node)
    else unparsedLineRefs.current.delete(line)
  }

  function jumpToUnparsedLine(
    line: UnparsedPasteLine,
    reason: "riga da controllare" | "save refused" = "riga da controllare",
  ) {
    const input = unparsedLineRefs.current.get(line.line)
    input?.scrollIntoView?.({ behavior: "smooth", block: "start" })
    input?.focus({ preventScroll: true })
    setNavigationAnnouncement(
      reason === "save refused"
        ? `Salvataggio bloccato: correggi o lascia fuori la riga non letta ${line.line}.`
        : `Riga non letta ${line.line}, riga da controllare.`,
    )
  }

  /** A way back to exactly what was pasted (V05 review V5-6), asked for like
   * any other discard: the review on screen is replaced, not merely hidden. */
  function returnToPastedAnswer() {
    setDiscardConfirmation({
      onConfirm: () => {
        setDiscardConfirmation(null)
        setCandidates([])
        setPasteImport(null)
        setInvalidIds(new Set())
        setSaveError(false)
        setState("idle")
        setAssistantExpanded(true)
      },
    })
  }

  // Possible duplicates: computed here, not in the review gate module (V05
  // review V5-5), and combined with the gate's own result everywhere below
  // that decides whether a row still needs review or is ready to save.
  const duplicateMatches = useMemo(
    () => findPossibleDuplicates(candidates, existingStudents, courseStartDate),
    [candidates, existingStudents, courseStartDate],
  )
  const candidateHasUnresolvedDuplicate = (candidate: ReviewCandidate) =>
    duplicateMatches.has(candidate.id) && !candidate.duplicateAcknowledged

  // The completeness confirmation covers a specific row count, not a plain
  // yes/no (V05 review V5F-1): it only counts as still given while no unread
  // line remains and the number of pasted rows on screen today is exactly
  // the one that was confirmed. Leaving a line out after confirming, or
  // removing a candidate row, changes that count and must ask again rather
  // than silently keep covering a roster that is no longer the one the
  // operator counted.
  const pasteCountConfirmed = Boolean(
    pasteImport &&
    pasteImport.unparsed.length === 0 &&
    pasteImport.confirmedCount === candidates.length,
  )

  async function commitCandidates() {
    if (saveInFlightRef.current) return
    const invalid = new Set(
      candidates
        .filter(
          (candidate) =>
            !candidateIsReady(candidate, courseStartDate, readPhone) ||
            candidateHasUnresolvedDuplicate(candidate),
        )
        .map(({ id }) => id),
    )
    setInvalidIds(invalid)
    // An unread line that is neither fixed nor explicitly left out, or the
    // completeness confirmation the operator has not yet given, must block
    // the save exactly like an invalid row: otherwise the roster saves with
    // that student silently missing (V05 review V5-3/V5R2-3).
    const hasUnresolvedPasteLines = Boolean(pasteImport?.unparsed.length)
    const answerNeedsConfirmation = Boolean(pasteImport && !pasteCountConfirmed)
    if (
      invalid.size > 0 ||
      candidates.length === 0 ||
      hasUnresolvedPasteLines ||
      answerNeedsConfirmation
    ) {
      // A refusal for a paste reason must say so, not do nothing: the
      // operator taps Aggiungi, sees no change and has no idea why (V05
      // review V5R2-2). Candidate-row refusals already have their own
      // "righe da controllare"/"campi da completare" counters to jump with;
      // this only covers the two reasons that counter cannot reach on its
      // own once every candidate row is otherwise ready.
      if (invalid.size === 0 && candidates.length > 0) {
        if (hasUnresolvedPasteLines) {
          jumpToUnparsedLine(pasteImport!.unparsed[0]!, "save refused")
        } else if (answerNeedsConfirmation) {
          jumpToPasteConfirmation("save refused")
        }
      }
      return
    }

    saveInFlightRef.current = true
    setState("saving")
    setSaveError(false)
    // Age only, in every mode (owner decision 2026-09-28): a read date, when
    // there was one, only ever computed the age shown above; it is never
    // itself what gets stored, on the camera path or the pasted one.
    const inputs: StudentInput[] = candidates.map((candidate) => ({
      firstName: candidate.firstName.trim(),
      surname: candidate.surname.trim(),
      nickname: null,
      dateOfBirth: "",
      declaredAgeAtCourseStart: parsedReviewAge(candidate),
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
    committedRef.current = true
    onCommitted()
  }

  // The row numbers (the "Allievo n" of each card) the last refused save
  // marked, for its one summary alert.
  const refusedRows = candidates.flatMap((candidate, index) =>
    invalidIds.has(candidate.id) ? [index + 1] : [],
  )

  const progressPercent = Math.round(progress.value * 100)
  const missingFields = candidates.reduce(
    (total, candidate) => total + missingFieldCount(candidate),
    0,
  )
  const rowNeedsReview = (candidate: ReviewCandidate) =>
    candidateNeedsReview(candidate, courseStartDate, readPhone) ||
    candidateHasUnresolvedDuplicate(candidate)
  // Each remaining unread line is exactly one more row the operator still
  // has to deal with (V05 review V5-3), so it counts here alongside every
  // candidate that still needs a look. The pending completeness confirmation
  // is exactly the same kind of outstanding row (V05 review V5R2-3): without
  // it this counter could reach zero while a save is still refused, which is
  // exactly the silent-refusal bug the counter exists to prevent.
  const rowsToReview =
    candidates.filter(rowNeedsReview).length +
    (pasteImport?.unparsed.length ?? 0) +
    (pasteImport && !pasteCountConfirmed ? 1 : 0)
  const readyStudents = candidates.filter(
    (candidate) =>
      candidateIsReady(candidate, courseStartDate, readPhone) &&
      !candidateHasUnresolvedDuplicate(candidate),
  ).length
  const hasUnresolvedNameOrder =
    !nameOrder &&
    candidates.some((candidate) => candidate.nameReading?.order === "unknown")

  function firstMissingTarget(candidate: ReviewCandidate) {
    if (!candidate.firstName.trim()) return "firstName"
    if (!candidate.surname.trim()) return "surname"
    if (parsedReviewAge(candidate) === null) return "age"
    if (!candidate.sex) return "sex"
    return "firstName"
  }

  function firstReviewTarget(candidate: ReviewCandidate) {
    if (nameReadingNeedsReview(candidate)) return "firstName"
    if (!candidate.firstName.trim() || needsReview(candidate, "firstName")) {
      return "firstName"
    }
    if (!candidate.surname.trim() || needsReview(candidate, "surname")) {
      return "surname"
    }
    // The date itself is never shown; a low-confidence date only ever
    // surfaces through the age it produced, already covered above.
    if (ageNeedsReview(candidate, courseStartDate)) return "age"
    if (!candidate.sex) return "sex"
    if (readPhone && needsReview(candidate, "phone", courseStartDate)) {
      return "phone"
    }
    if (rowWarningNeedsReview(candidate)) return "row"
    if (candidateHasUnresolvedDuplicate(candidate)) return "duplicate"
    return "firstName"
  }

  function jumpToCandidate(
    candidate: ReviewCandidate,
    index: number,
    field: string,
    reason: "campo da completare" | "riga da controllare",
  ) {
    const card = candidateCardRefs.current.get(candidate.id)
    if (!card) return
    card.scrollIntoView?.({ behavior: "smooth", block: "start" })
    window.requestAnimationFrame(() => {
      const target = Array.from(
        card.querySelectorAll<HTMLElement>("[data-scan-field]"),
      ).find((element) => element.dataset.scanField === field)
      const focusTarget = target ?? card.querySelector<HTMLElement>("h2")
      // This is the counter's own navigation, not the operator reaching for
      // the field themselves, so it must not arm an acknowledgement.
      armedFocusTargetRef.current = focusTarget
      focusTarget?.focus({ preventScroll: true })
      const targetName: Record<string, string> = {
        firstName: "nome",
        surname: "cognome",
        age: "età",
        sex: "sesso",
        phone: "telefono",
        row: "segnala la riga controllata",
        duplicate: "possibile doppione",
      }
      setNavigationAnnouncement(
        `Riga ${index + 1}, ${reason}. ${targetName[field] ?? ""}`,
      )
    })
  }

  function jumpToFirstMissing() {
    const index = candidates.findIndex(
      (candidate) =>
        !candidate.firstName.trim() ||
        !candidate.surname.trim() ||
        parsedReviewAge(candidate) === null ||
        !candidate.sex,
    )
    const candidate = candidates[index]
    if (candidate && index >= 0) {
      jumpToCandidate(
        candidate,
        index,
        firstMissingTarget(candidate),
        "campo da completare",
      )
    }
  }

  function jumpToFirstReview() {
    const index = candidates.findIndex(rowNeedsReview)
    const candidate = candidates[index]
    if (candidate && index >= 0) {
      jumpToCandidate(
        candidate,
        index,
        firstReviewTarget(candidate),
        "riga da controllare",
      )
      return
    }
    // No candidate row needs a look, but an unread line still does (V05
    // review V5-3): the counter has somewhere left to send the operator.
    const line = pasteImport?.unparsed[0]
    if (line) {
      jumpToUnparsedLine(line)
      return
    }
    // Nothing left but the completeness confirmation itself (V05 review
    // V5R2-3): the counter still has somewhere to send the operator.
    if (pasteImport && !pasteCountConfirmed) jumpToPasteConfirmation()
  }

  /** The discard prompt's own heading: it must name the unread lines
   * whenever any remain (V05 review V5-4), alongside the candidate rows when
   * there are any, so the operator knows exactly what leaving would drop. */
  function discardConfirmationHeading() {
    const studentsCount = candidates.length
    const unreadCount = pasteImport?.unparsed.length ?? 0
    const studentsPart =
      studentsCount > 0
        ? `la revisione di ${studentsCount} ${studentsCount === 1 ? "allievo" : "allievi"}`
        : ""
    const unreadPart =
      unreadCount > 0
        ? `${unreadCount} ${unreadCount === 1 ? "riga non letta" : "righe non lette"}`
        : ""
    if (studentsPart && unreadPart) {
      return `Scartare ${studentsPart} e ${unreadPart}?`
    }
    if (studentsPart || unreadPart)
      return `Scartare ${studentsPart || unreadPart}?`
    // Neither a candidate row nor an unread line remains: a paste review
    // read nothing at all from the answer (only its header and FINE), yet
    // the pasted text itself is still what leaving would drop (V05 review
    // V5R2-5). Without this fallback the heading reads the meaningless
    // "Scartare ?".
    return pasteImport
      ? "Scartare la risposta dell’assistente?"
      : "Scartare questa revisione?"
  }

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
          className="grid size-[44px] shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring"
          onClick={() => requestLeave(onBack)}
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
        <>
          <section className="rounded-3xl border bg-card [padding:clamp(8px,4vw,20px)] text-center shadow-[0_12px_32px_rgb(6_59_82/0.07)]">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted text-primary">
              <Camera aria-hidden="true" className="size-7" />
            </span>
            <h2 className="mt-4 text-xl font-black">Importa l’elenco</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Inquadra bene nomi e date di nascita. L’analisi avviene sul
              dispositivo.
            </p>
            {/* The telephone is opt-in. Left off, it is not reported and not
              counted, so the review is about the two fields the course needs. */}
            <label className="mt-4 flex min-w-0 items-start gap-3 rounded-2xl border bg-muted/50 p-3 text-left">
              <input
                checked={readPhone}
                className="mt-[2px] size-5 shrink-0 accent-[var(--primary)]"
                onChange={(event) => setReadPhone(event.target.checked)}
                type="checkbox"
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold">
                  Leggi anche il telefono
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  Lasciato spento, i numeri non vengono letti né richiesti.
                </span>
              </span>
            </label>
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
          <StudentScanAssistantSection
            answer={assistantAnswer}
            courseStartDate={courseStartDate}
            expanded={assistantExpanded}
            onAnswerChange={setAssistantAnswer}
            onExpandedChange={setAssistantExpanded}
            onImport={handlePasteImport}
            readPhone={readPhone}
          />
        </>
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
            <button
              aria-label="Vai alla prima riga da controllare"
              className="rounded-xl bg-muted px-1.5 py-2 text-center outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-70"
              disabled={rowsToReview === 0 || state === "saving"}
              onClick={jumpToFirstReview}
              type="button"
            >
              <strong className="block text-lg leading-none">
                {rowsToReview}
              </strong>
              <span className="mt-1 block text-[0.62rem] leading-3 text-muted-foreground">
                righe da controllare
              </span>
            </button>
            <button
              aria-label="Vai al primo campo da completare"
              className={`rounded-xl px-1.5 py-2 text-center outline-none transition-colors hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-70 ${missingFields ? "bg-[#fff4e5]" : "bg-[#e9f7ef]"}`}
              disabled={missingFields === 0 || state === "saving"}
              onClick={jumpToFirstMissing}
              type="button"
            >
              <strong className="block text-lg leading-none">
                {missingFields}
              </strong>
              <span className="mt-1 block text-[0.62rem] leading-3 text-muted-foreground">
                campi da completare
              </span>
            </button>
            <div className="rounded-xl bg-primary/10 px-1.5 py-2 text-center">
              <strong className="block text-lg leading-none">
                {readyStudents}
              </strong>
              <span className="mt-1 block text-[0.62rem] leading-3 text-muted-foreground">
                allievi pronti
              </span>
            </div>
          </section>
          <p
            aria-atomic="true"
            aria-live="polite"
            className="sr-only"
            role="status"
          >
            {navigationAnnouncement}
          </p>

          {discardConfirmation && (
            <section
              className="mb-3 rounded-2xl border border-[#f79009] bg-[#fff9ef] p-3 outline-none"
              ref={discardAlertRef}
              role="alert"
              tabIndex={-1}
            >
              <h2 className="text-sm font-black">
                {discardConfirmationHeading()}
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Le correzioni fatte finora non sono state salvate.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  className="min-h-11"
                  onClick={() => setDiscardConfirmation(null)}
                  type="button"
                >
                  Continua la revisione
                </Button>
                <Button
                  className="min-h-11"
                  onClick={discardConfirmation.onConfirm}
                  type="button"
                  variant="secondary"
                >
                  Scarta
                </Button>
              </div>
            </section>
          )}

          {imageNeedsRetake && (
            <section
              className="mb-3 rounded-2xl border border-[#f79009] bg-[#fff9ef] p-3"
              role="alert"
            >
              <h2 className="text-sm font-black">Immagine poco leggibile</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                La lettura è incerta. Rifai la foto o scegli un’immagine più
                nitida; i campi letti restano qui per la verifica.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  className="min-h-11"
                  onClick={() => requestAnotherImage("camera")}
                  type="button"
                  variant="secondary"
                >
                  <Camera aria-hidden="true" className="size-4" />
                  Rifai la foto
                </Button>
                <Button
                  className="min-h-11"
                  onClick={() => requestAnotherImage("gallery")}
                  type="button"
                  variant="secondary"
                >
                  <ImagePlus aria-hidden="true" className="size-4" />
                  Scegli dalla galleria
                </Button>
              </div>
            </section>
          )}

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

          {hasUnresolvedNameOrder ? (
            <section
              aria-label="Ordine dei nomi"
              className="mb-3 rounded-2xl border bg-card p-3"
            >
              <h2 className="text-sm font-black">Come sono scritti i nomi?</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Lo chiedo una volta sola: la scelta vale per le prossime
                scansioni di questo corso. Le righe già corrette restano
                invariate.
              </p>
              {orderInference && (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Il foglio non dà un ordine certo: nome in prima posizione in{" "}
                  {orderInference.firstWordVotes} righe, in ultima in{" "}
                  {orderInference.lastWordVotes}.
                </p>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    ["given-surname", "Nome · Cognome"],
                    ["surname-given", "Cognome · Nome"],
                  ] as const
                ).map(([order, label]) => (
                  <Button
                    className="h-auto min-h-10 px-2 text-xs"
                    disabled={state === "saving"}
                    key={order}
                    onClick={() => {
                      writeNameOrderPreference(courseId, order)
                      setNameOrder(order)
                      setOrderInference(null)
                      setCandidates((current) =>
                        applyNameOrderToCandidates(
                          current,
                          order,
                          "unresolved",
                        ),
                      )
                    }}
                    type="button"
                    variant="secondary"
                  >
                    Applica {label}
                  </Button>
                ))}
              </div>
            </section>
          ) : (
            nameOrder &&
            candidates.some((candidate) => candidate.nameReading) && (
              <div className="mb-2 flex justify-end">
                <Button
                  className="min-h-10 px-2.5 text-xs"
                  disabled={state === "saving"}
                  onClick={() => {
                    const next =
                      nameOrder === "surname-given"
                        ? "given-surname"
                        : "surname-given"
                    writeNameOrderPreference(courseId, next)
                    setNameOrder(next)
                    setOrderInference(null)
                    setCandidates((current) =>
                      applyNameOrderToCandidates(current, next, "all"),
                    )
                  }}
                  type="button"
                  variant="secondary"
                >
                  <ArrowLeftRight aria-hidden="true" className="size-3.5" />
                  Inverti per tutti
                </Button>
              </div>
            )
          )}

          {pasteImport && (
            <StudentScanUnparsedLines
              complete={pasteImport.complete}
              countConfirmed={pasteCountConfirmed}
              courseStartDate={courseStartDate}
              disabled={state === "saving"}
              lines={pasteImport.unparsed}
              onConfirmComplete={confirmPasteComplete}
              onLeaveOut={leaveOutUnparsedLine}
              onRegisterConfirmation={registerPasteConfirmation}
              onRegisterInput={registerUnparsedLineInput}
              onResolved={handlePasteLineResolved}
              onReturnToAnswer={returnToPastedAnswer}
              readCount={candidates.length}
              readPhone={readPhone}
            />
          )}

          {/* `grid-cols-1` rather than a bare `grid`: the implicit column is
              `auto`, which resolves to the widest card's max-content and pushes
              the page sideways at 320px with 200% text. */}
          <section
            aria-label="Allievi estratti"
            className="grid grid-cols-1 gap-3"
          >
            {candidates.map((candidate, index) => (
              <CandidateCard
                candidate={candidate}
                consumeProgrammaticFocus={consumeProgrammaticFocus}
                courseStartDate={courseStartDate}
                disabled={state === "saving"}
                duplicateOf={duplicateMatches.get(candidate.id)}
                index={index}
                readPhone={readPhone}
                invalid={invalidIds.has(candidate.id)}
                key={candidate.id}
                cardRef={(node) => {
                  if (node) candidateCardRefs.current.set(candidate.id, node)
                  else candidateCardRefs.current.delete(candidate.id)
                }}
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
              {pasteImport
                ? pasteImport.unparsed.length > 0
                  ? "Nessun allievo letto dalla risposta. Correggi le righe non lette qui sotto oppure torna alla risposta."
                  : "Nessun allievo letto dalla risposta. Torna alla risposta per correggerla."
                : "Hai rimosso tutte le righe. Scegli un’altra immagine oppure torna indietro."}
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

          {refusedRows.length > 0 && (
            // One alert for the whole refusal; each card says what its own row
            // lacks, as text.
            <p
              className="mt-4 text-sm font-semibold text-[#b42318]"
              role="alert"
            >
              {`Prima di aggiungere, correggi ${refusedRows.length === 1 ? "la riga" : "le righe"} ${refusedRows.join(", ")}.`}
            </p>
          )}

          <div className="mt-4 grid grid-cols-[48px_minmax(0,1fr)] gap-[8px] pb-2">
            <Button
              aria-label="Scegli un’altra immagine"
              className="size-[48px] px-0"
              disabled={state === "saving"}
              onClick={() => requestAnotherImage("gallery")}
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
        <StudentScanImageEditorDocument
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
