import {
  CalendarDays,
  Check,
  ChevronLeft,
  LoaderCircle,
  MoreVertical,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  ScanLine,
  Trash2,
  UserRound,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MinorBadge, SexIcon } from "@/components/PersonBadges"
import { StudentSizeSelector } from "@/components/StudentSizeSelector"
import {
  DUTY_DAYS,
  SESSION_SEQUENCE,
  STUDENT_SEXES,
  type SessionId,
  type StudentSex,
  type StudentSize,
} from "@/domain/config"
import { formatEvaluationSession } from "@/domain/evaluations"
import { validateStudentRecords } from "@/domain/invariants"
import { calculateAge, getStudentDisplayName, isMinor } from "@/domain/student"
import { DictatedNoteField } from "@/features/speech/DictatedNoteField"
import { StudentKnowledge } from "@/features/students/StudentKnowledge"
import { StudentScan } from "@/features/students/StudentScan"
import { StudentEvaluationHistory } from "@/features/evaluations/StudentEvaluationHistory"
import type { CourseRecord } from "@/persistence/courses"
import {
  createStudent,
  assessStudentDeletion,
  deleteUnusedStudent,
  listStudents,
  setStudentActive,
  updateStudent,
  type StudentKnowledgeInput,
  type StudentDeletionAssessment,
  type StudentDeletionReference,
  type StudentEditInput,
  type StudentRecord,
} from "@/persistence/students"

/** A field of the edit form that the profile can open focused. */
type StudentField =
  | "firstName"
  | "surname"
  | "dateOfBirth"
  | "sex"
  | "phone"
  | "nickname"
  | "size"
  | "initialNote"
  | "courseNote"

type StudentScreen =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "scan" }
  | { kind: "knowledge" }
  | { kind: "detail"; studentId: string }
  | { kind: "edit"; studentId: string; focusField?: StudentField }

type LoadState = "loading" | "ready" | "error"

async function readValidStudents(courseId: string) {
  const records = await listStudents(courseId)
  if (validateStudentRecords(records).length > 0) {
    throw new Error("Persisted student state violates invariants")
  }
  return records
}

function sexLabel(sex: StudentSex | null, compact = false) {
  const option = STUDENT_SEXES.find(({ id }) => id === sex)
  if (!option) return compact ? "—" : "Non indicato"
  return compact ? option.label : option.detailLabel
}

/**
 * Double click with a pointer, or a long press on touch, as the shortcut the
 * Product Specification allows on a profile field. `Modifica` remains the
 * explicit path, so this never becomes the only way to reach the form.
 */
function useFieldShortcut(onShortcut: () => void) {
  const pressStartedAt = useRef<number | null>(null)
  const pressOrigin = useRef<{ x: number; y: number } | null>(null)
  const pressMoved = useRef(false)
  const longPressed = useRef(false)

  function cancelPress() {
    pressStartedAt.current = null
    pressOrigin.current = null
    pressMoved.current = false
  }

  return {
    onDoubleClick: () => {
      if (longPressed.current) {
        longPressed.current = false
        return
      }
      onShortcut()
    },
    onPointerCancel: cancelPress,
    onPointerDown: (event: React.PointerEvent) => {
      if (event.pointerType === "mouse") return
      longPressed.current = false
      pressStartedAt.current = event.timeStamp
      pressOrigin.current = { x: event.clientX, y: event.clientY }
      pressMoved.current = false
    },
    onPointerLeave: cancelPress,
    onPointerMove: (event: React.PointerEvent) => {
      const origin = pressOrigin.current
      if (!origin) return
      if (
        Math.abs(event.clientX - origin.x) > 10 ||
        Math.abs(event.clientY - origin.y) > 10
      ) {
        pressMoved.current = true
      }
    },
    onPointerUp: (event: React.PointerEvent) => {
      const startedAt = pressStartedAt.current
      cancelPress()
      if (
        startedAt === null ||
        pressMoved.current ||
        event.timeStamp - startedAt < 500
      ) {
        return
      }
      longPressed.current = true
      onShortcut()
    },
  }
}

function ProfileField({
  label,
  icon,
  value,
  onShortcut,
  field,
}: {
  label: string
  icon?: React.ReactNode
  value: React.ReactNode
  onShortcut: () => void
  field: StudentField
}) {
  const shortcut = useFieldShortcut(onShortcut)
  return (
    <div
      className="min-w-0 bg-muted p-3 [@media(pointer:coarse)]:select-none [-webkit-touch-callout:none]"
      data-profile-field={field}
      title={`Doppio clic o pressione prolungata per modificare: ${label}`}
      {...shortcut}
    >
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-bold">{value}</dd>
    </div>
  )
}

function StudentPageHeader({
  title,
  onBack,
  action,
}: {
  title: string
  onBack: () => void
  action?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex min-w-0 items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <button
          aria-label={`Indietro da ${title}`}
          className="grid size-[44px] shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          onClick={onBack}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <h1 className="min-w-0 break-words text-2xl font-black tracking-tight [overflow-wrap:anywhere] max-[350px]:text-xl">
          {title}
        </h1>
      </div>
      {action}
    </div>
  )
}

function EmptyStudents({
  onAdd,
  onScan,
}: {
  onAdd: () => void
  onScan: () => void
}) {
  return (
    <section className="rounded-3xl border bg-card p-5 text-center shadow-[0_12px_32px_rgb(6_59_82/0.07)]">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted text-primary">
        <UserRound aria-hidden="true" className="size-7" />
      </span>
      <h2 className="mt-4 text-xl font-black">Nessun allievo</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Aggiungi manualmente il primo allievo per iniziare.
      </p>
      <div className="mt-6 grid gap-3">
        <Button onClick={onAdd} size="lg">
          <Plus aria-hidden="true" className="size-5" />
          Aggiungi allievo
        </Button>
        <Button onClick={onScan} size="lg" variant="secondary">
          <ScanLine aria-hidden="true" className="size-5" />
          Scan allievi
        </Button>
      </div>
    </section>
  )
}

function StudentList({
  course,
  students,
  onOpen,
}: {
  course: CourseRecord
  students: StudentRecord[]
  onOpen: (studentId: string) => void
}) {
  return (
    <section
      aria-label="Elenco allievi"
      className="grid grid-cols-2 gap-1.5 pb-24"
    >
      {students.map((student) => {
        const displayName = getStudentDisplayName(student, students)
        const age = calculateAge(student.dateOfBirth, course.startDate)
        const minor = isMinor(student.dateOfBirth, course.startDate)
        return (
          <button
            aria-label={`${displayName}, ${age} anni, ${sexLabel(student.sex, true)}${minor ? ", Minorenne" : ""}${student.active ? "" : ", Non disponibile"}`}
            className={`flex min-h-14 min-w-0 items-center gap-2 rounded-xl border bg-card px-2 py-1.5 text-left shadow-[0_4px_12px_rgb(6_59_82/0.04)] outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 ${student.active ? "" : "opacity-55"}`}
            key={student.id}
            onClick={() => onOpen(student.id)}
            type="button"
          >
            {/* The figure carries the sex; below 380px it moves into the detail
                line, where it costs no width of its own. */}
            <span
              aria-hidden="true"
              className={`hidden size-8 shrink-0 place-items-center rounded-lg min-[380px]:grid ${student.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              <SexIcon className="size-5" sex={student.sex} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block break-words text-[0.95rem] font-bold leading-tight">
                {displayName}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.72rem] leading-4 text-muted-foreground">
                <SexIcon
                  className="size-3.5 min-[380px]:hidden"
                  sex={student.sex}
                />
                <span>{age} anni</span>
                {minor && <MinorBadge />}
                {!student.active && (
                  <span className="font-bold">Non disponibile</span>
                )}
              </span>
            </span>
          </button>
        )
      })}
    </section>
  )
}

function Field({
  label,
  children,
  hint,
  field,
}: {
  label: string
  children: React.ReactNode
  hint?: string
  field?: StudentField
}) {
  return (
    <label className="grid gap-2 text-sm font-bold" data-field={field}>
      <span>{label}</span>
      {children}
      {hint && (
        <span className="text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  )
}

function StudentForm({
  course,
  student,
  focusField,
  onCancel,
  onSaved,
}: {
  course: CourseRecord
  student?: StudentRecord
  focusField?: StudentField
  onCancel: () => void
  onSaved: () => void
}) {
  const [firstName, setFirstName] = useState(student?.firstName ?? "")
  const [surname, setSurname] = useState(student?.surname ?? "")
  const [nickname, setNickname] = useState(student?.nickname ?? "")
  const [dateOfBirth, setDateOfBirth] = useState(student?.dateOfBirth ?? "")
  // A new card starts on Altro: it is the value that claims nothing, and the
  // other two are one tap away.
  const [sex, setSex] = useState<StudentSex | "">(
    student?.sex ?? (student ? "" : "other"),
  )
  const [phone, setPhone] = useState(student?.phone ?? "")
  const [size, setSize] = useState<StudentSize | "">(student?.size ?? "")
  const [initialNote, setInitialNote] = useState(student?.initialNote ?? "")
  const [courseNote, setCourseNote] = useState(student?.courseNote ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)
  const initialized = useRef(false)
  const saveChain = useRef<Promise<void>>(Promise.resolve())
  const saveVersion = useRef(0)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!focusField) return
    const group = formRef.current?.querySelector<HTMLElement>(
      `[data-field="${focusField}"]`,
    )
    const target =
      group?.querySelector<HTMLElement>(
        'input:not([type="radio"]), textarea',
      ) ??
      group?.querySelector<HTMLElement>(
        'input[type="radio"]:checked, [aria-pressed="true"]',
      ) ??
      group?.querySelector<HTMLElement>('input[type="radio"], button')
    target?.focus()
  }, [focusField])

  const input = useMemo<StudentEditInput>(
    () => ({
      firstName: firstName.trim(),
      surname: surname.trim(),
      nickname: nickname.trim() || null,
      dateOfBirth,
      sex: sex || null,
      phone: phone.trim() || null,
      size: size || null,
      initialNote: initialNote.trim() || null,
      courseNote: courseNote.trim() || null,
    }),
    [
      courseNote,
      dateOfBirth,
      firstName,
      initialNote,
      nickname,
      phone,
      sex,
      size,
      surname,
    ],
  )

  async function persistEdit(draftVersion?: number) {
    if (
      !student ||
      !input.firstName ||
      !input.surname ||
      !input.dateOfBirth ||
      !input.sex
    ) {
      return false
    }
    const version = draftVersion ?? ++saveVersion.current
    const snapshot = input
    setSaving(true)
    setSaved(false)
    setError(false)
    const request = saveChain.current.then(() =>
      updateStudent(student.id, course.id, snapshot),
    )
    saveChain.current = request.catch(() => undefined)
    try {
      await request
      if (version === saveVersion.current) {
        setSaving(false)
        setSaved(true)
      }
      return true
    } catch {
      if (version === saveVersion.current) {
        setSaving(false)
        setError(true)
      }
      return false
    }
  }

  useEffect(() => {
    if (!student) return
    if (!initialized.current) {
      initialized.current = true
      return
    }
    const draftVersion = ++saveVersion.current
    setSaved(false)
    setSaving(false)
    const timer = window.setTimeout(() => void persistEdit(draftVersion), 500)
    return () => window.clearTimeout(timer)
    // input contains the complete editable snapshot and intentionally drives autosave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, student?.id])

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(false)
    try {
      if (student) {
        const persisted = await persistEdit()
        if (!persisted) return
      } else await createStudent(course.id, input)
      onSaved()
    } catch {
      setSaving(false)
      setError(true)
    }
  }

  async function exitForm() {
    if (!student) {
      onCancel()
      return
    }
    if (await persistEdit()) onSaved()
  }

  return (
    <>
      <StudentPageHeader
        onBack={() => void exitForm()}
        title={student ? "Modifica allievo" : "Nuovo allievo"}
      />
      <form className="grid gap-5" onSubmit={save} ref={formRef}>
        <div className="grid grid-cols-2 gap-3">
          <Field field="firstName" label="Nome">
            <Input
              autoComplete="given-name"
              onChange={(event) => setFirstName(event.target.value)}
              required
              value={firstName}
            />
          </Field>
          <Field field="surname" label="Cognome">
            <Input
              autoComplete="family-name"
              onChange={(event) => setSurname(event.target.value)}
              required
              value={surname}
            />
          </Field>
        </div>

        <Field
          field="dateOfBirth"
          label="Data di nascita"
          hint="Formato GG/MM/AAAA. Età e stato Minorenne sono calcolati all’inizio del corso."
        >
          <Input
            aria-label="Data di nascita"
            max={course.startDate}
            onChange={(event) => setDateOfBirth(event.target.value)}
            required
            type="date"
            value={dateOfBirth}
          />
        </Field>

        <fieldset className="grid gap-2 text-sm font-bold" data-field="sex">
          <legend>Sesso</legend>
          <div className="grid grid-cols-3 gap-2">
            {STUDENT_SEXES.map((option) => (
              <label className="cursor-pointer" key={option.id}>
                <input
                  checked={sex === option.id}
                  className="peer sr-only"
                  name="sex"
                  onChange={() => setSex(option.id)}
                  required
                  type="radio"
                  value={option.id}
                />
                <span className="flex h-12 items-center justify-center gap-1.5 rounded-xl border bg-card text-base transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40">
                  <SexIcon className="size-5" sex={option.id} />
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field field="phone" label="Telefono">
          <Input
            autoComplete="tel"
            inputMode="tel"
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            value={phone}
          />
        </Field>

        <Field
          field="nickname"
          label="Nome visualizzato / soprannome"
          hint="Facoltativo. Se vuoto, il nome breve viene generato automaticamente."
        >
          <Input
            aria-label="Nome visualizzato / soprannome"
            onChange={(event) => setNickname(event.target.value)}
            value={nickname}
          />
        </Field>

        <div data-field="size">
          <StudentSizeSelector onChange={setSize} value={size} />
        </div>

        <div data-field="initialNote">
          <DictatedNoteField
            hint="Esperienza o informazioni note prima del corso."
            label="Nota iniziale"
            naming={{
              start: "Detta nota iniziale",
              subject: "nota iniziale",
            }}
            onChange={setInitialNote}
            reviewHint="Rileggi la trascrizione: il testo viene salvato con la scheda."
            value={initialNote}
          />
        </div>

        <div data-field="courseNote">
          <DictatedNoteField
            hint="Nota generale per questa settimana, distinta dalle valutazioni."
            label="Nota del corso"
            naming={{
              start: "Detta nota del corso",
              subject: "nota del corso",
            }}
            onChange={setCourseNote}
            reviewHint="Rileggi la trascrizione: il testo viene salvato con la scheda."
            value={courseNote}
          />
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3" role="alert">
            <p className="text-sm font-semibold text-[#a2381b]">
              Modifiche non salvate. Il testo resta qui.
            </p>
            {student && (
              <Button
                onClick={() => void persistEdit()}
                type="button"
                variant="secondary"
              >
                Riprova
              </Button>
            )}
          </div>
        )}

        {student && (saving || saved) && (
          <p
            className="flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            {saving ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : (
              <Check aria-hidden="true" className="size-4 text-[#18794e]" />
            )}
            {saving ? "Salvataggio…" : "Salvato"}
          </p>
        )}

        <div className={`grid gap-3 pt-1 ${student ? "" : "grid-cols-2"}`}>
          {!student && (
            <Button onClick={onCancel} type="button" variant="secondary">
              Annulla
            </Button>
          )}
          <Button disabled={saving} type="submit">
            {saving ? "Salvataggio…" : student ? "Fine" : "Salva allievo"}
          </Button>
        </div>
      </form>
    </>
  )
}

function StudentDetail({
  course,
  student,
  students,
  onBack,
  onEdit,
  onChanged,
  onDeleted,
  focusEvaluationHistory,
}: {
  course: CourseRecord
  student: StudentRecord
  students: StudentRecord[]
  onBack: () => void
  onEdit: (focusField?: StudentField) => void
  onChanged: () => Promise<void>
  onDeleted: () => Promise<void>
  focusEvaluationHistory: boolean
}) {
  const [changing, setChanging] = useState(false)
  const [error, setError] = useState(false)
  const [lifecycleOpen, setLifecycleOpen] = useState(false)
  const [assessment, setAssessment] =
    useState<StudentDeletionAssessment | null>(null)
  const [assessmentError, setAssessmentError] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const displayName = getStudentDisplayName(student, students)
  const age = calculateAge(student.dateOfBirth, course.startDate)
  const minor = isMinor(student.dateOfBirth, course.startDate)
  const nameShortcut = useFieldShortcut(() => onEdit("firstName"))
  const initialNoteShortcut = useFieldShortcut(() => onEdit("initialNote"))
  const courseNoteShortcut = useFieldShortcut(() => onEdit("courseNote"))

  async function toggleActive() {
    setChanging(true)
    setError(false)
    try {
      await setStudentActive(student.id, course.id, !student.active)
      await onChanged()
      setChanging(false)
    } catch {
      setChanging(false)
      setError(true)
    }
  }

  async function loadDeletionAssessment() {
    setAssessmentError(false)
    setAssessment(null)
    try {
      setAssessment(await assessStudentDeletion(student.id, course.id))
    } catch {
      setAssessmentError(true)
    }
  }

  function openLifecycle() {
    const nextOpen = !lifecycleOpen
    setLifecycleOpen(nextOpen)
    if (nextOpen && !assessment) void loadDeletionAssessment()
  }

  async function permanentlyDelete() {
    setDeleting(true)
    setAssessmentError(false)
    try {
      await deleteUnusedStudent(student.id, course.id)
      await onDeleted()
    } catch (reason) {
      setDeleting(false)
      if (reason instanceof Error && "assessment" in reason) {
        setAssessment(
          (reason as { assessment: StudentDeletionAssessment }).assessment,
        )
      } else setAssessmentError(true)
      setConfirmDelete(false)
    }
  }

  function referenceLabel(reference: StudentDeletionReference) {
    if (reference.kind === "duty") {
      const day = DUTY_DAYS.find(({ id }) => id === reference.referenceId)
      return `Comandata: ${day?.label ?? reference.referenceId}`
    }
    if (reference.kind === "stay-over")
      return "Preferenza: resta la prossima settimana"
    if (reference.referenceId.startsWith("orphan:"))
      return "Equipaggio: riferimento non valido da correggere"
    const sessionId = SESSION_SEQUENCE.some(
      ({ id }) => id === reference.referenceId,
    )
      ? (reference.referenceId as SessionId)
      : null
    const session = sessionId
      ? formatEvaluationSession(sessionId)
      : "sessione non valida"
    if (reference.kind === "crew") return `Equipaggio: ${session}`
    if (reference.kind === "land") return `A terra: ${session}`
    return `Valutazione o nota: ${session}`
  }

  return (
    <>
      <StudentPageHeader
        action={
          <Button
            aria-label="Modifica allievo"
            className="h-[44px] min-h-[44px] shrink-0 gap-[8px] px-[12px] text-[14px] [&>svg]:size-[16px]"
            onClick={() => onEdit()}
            variant="secondary"
          >
            <Pencil aria-hidden="true" className="size-4" />
            Modifica
          </Button>
        }
        onBack={onBack}
        title="Profilo"
      />
      <section
        className={`rounded-3xl border bg-card p-4 shadow-[0_12px_32px_rgb(6_59_82/0.07)] ${student.active ? "" : "opacity-65"}`}
      >
        <div
          className="flex items-start gap-3 [@media(pointer:coarse)]:select-none [-webkit-touch-callout:none]"
          title="Doppio clic o pressione prolungata per modificare: Nome"
          {...nameShortcut}
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <SexIcon className="size-6" sex={student.sex} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-black tracking-tight">
              {displayName}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {student.firstName} {student.surname}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {minor && (
                <span className="rounded-full bg-[#b42318] px-2.5 py-1 text-xs font-bold text-white">
                  Minorenne
                </span>
              )}
              {!student.active && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">
                  Non disponibile
                </span>
              )}
            </div>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border">
          <ProfileField
            field="dateOfBirth"
            icon={<CalendarDays aria-hidden="true" className="size-4" />}
            label="Età"
            onShortcut={() => onEdit("dateOfBirth")}
            value={`${age} anni`}
          />
          <ProfileField
            field="sex"
            label="Sesso"
            onShortcut={() => onEdit("sex")}
            value={sexLabel(student.sex)}
          />
          <ProfileField
            field="size"
            label="Taglia"
            onShortcut={() => onEdit("size")}
            value={student.size || "—"}
          />
          <ProfileField
            field="phone"
            icon={<Phone aria-hidden="true" className="size-4" />}
            label="Telefono"
            onShortcut={() => onEdit("phone")}
            value={student.phone || "—"}
          />
          <ProfileField
            field="nickname"
            label="Nome visualizzato"
            onShortcut={() => onEdit("nickname")}
            value={displayName}
          />
        </dl>

        <div
          className="mt-4 rounded-2xl bg-muted p-4 [@media(pointer:coarse)]:select-none [-webkit-touch-callout:none]"
          title="Doppio clic o pressione prolungata per modificare: Nota iniziale"
          {...initialNoteShortcut}
        >
          <h3 className="text-sm font-semibold">Nota iniziale</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm font-normal leading-6 text-muted-foreground">
            {student.initialNote || "Nessuna nota iniziale."}
          </p>
        </div>

        {student.courseNote && (
          <div
            className="mt-3 rounded-2xl bg-[#eef5ff] p-4 [@media(pointer:coarse)]:select-none [-webkit-touch-callout:none]"
            title="Doppio clic o pressione prolungata per modificare: Nota del corso"
            {...courseNoteShortcut}
          >
            <h3 className="text-sm font-semibold">Nota del corso</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm font-normal leading-6 text-muted-foreground">
              {student.courseNote}
            </p>
          </div>
        )}

        <StudentEvaluationHistory
          courseId={course.id}
          focusOnMount={focusEvaluationHistory}
          studentId={student.id}
          studentName={displayName}
          studentFullName={`${student.firstName} ${student.surname}`}
        />

        {error && (
          <p className="mt-4 text-sm font-semibold text-[#a2381b]" role="alert">
            Lo stato non è stato modificato. Riprova.
          </p>
        )}

        <Button
          className="mt-4 w-full"
          onClick={openLifecycle}
          variant="secondary"
        >
          Disponibilità ed eliminazione
        </Button>

        {lifecycleOpen && (
          <section
            aria-label="Disponibilità ed eliminazione"
            className="mt-3 rounded-2xl border p-4"
          >
            <Button
              className={`w-full ${student.active ? "border-[#d92d20] text-[#b42318] hover:bg-[#fee4e2]" : ""}`}
              disabled={changing}
              onClick={toggleActive}
              variant="secondary"
            >
              {changing
                ? "Aggiornamento…"
                : student.active
                  ? "Disabilita allievo"
                  : "Riattiva allievo"}
            </Button>

            {!assessment && !assessmentError && (
              <p className="mt-3 text-sm text-muted-foreground" role="status">
                Controllo dello storico…
              </p>
            )}
            {assessmentError && (
              <div
                className="mt-3 flex items-center justify-between gap-3"
                role="alert"
              >
                <p className="text-sm text-[#b42318]">
                  Controllo non riuscito.
                </p>
                <Button
                  onClick={() => {
                    void loadDeletionAssessment()
                  }}
                  type="button"
                  variant="secondary"
                >
                  Riprova
                </Button>
              </div>
            )}
            {assessment && !assessment.canDelete && (
              <div className="mt-4">
                <p className="text-sm font-semibold">
                  Non può essere eliminato perché compare nello storico:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {assessment.references.map((reference, index) => (
                    <li
                      key={`${reference.kind}-${reference.referenceId}-${index}`}
                    >
                      {referenceLabel(reference)}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-muted-foreground">
                  Puoi disabilitarlo senza perdere questi dati.
                </p>
              </div>
            )}
            {assessment?.canDelete && !confirmDelete && (
              <Button
                className="mt-3 w-full border-[#d92d20] text-[#b42318] hover:bg-[#fee4e2]"
                onClick={() => setConfirmDelete(true)}
                variant="secondary"
              >
                <Trash2 aria-hidden="true" className="size-4" /> Elimina
                definitivamente
              </Button>
            )}
            {assessment?.canDelete && confirmDelete && (
              <div className="mt-4 rounded-xl bg-[#fff3f2] p-3">
                <p className="text-sm font-semibold">
                  Eliminare definitivamente {displayName}?
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Il profilo verrà rimosso e non sarà possibile annullare.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => setConfirmDelete(false)}
                    variant="secondary"
                  >
                    Annulla
                  </Button>
                  <Button
                    disabled={deleting}
                    onClick={() => void permanentlyDelete()}
                  >
                    {deleting ? "Eliminazione…" : "Conferma"}
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}
      </section>
    </>
  )
}

export function StudentManagement({
  course,
  onHome,
  initialStudentId,
  onInitialStudentBack,
  focusEvaluationHistory = false,
}: {
  course: CourseRecord
  onHome: () => void
  initialStudentId?: string | null
  onInitialStudentBack?: () => void
  focusEvaluationHistory?: boolean
}) {
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [screen, setScreen] = useState<StudentScreen>(
    initialStudentId
      ? { kind: "detail", studentId: initialStudentId }
      : { kind: "list" },
  )
  const [menuOpen, setMenuOpen] = useState(false)

  async function refreshStudents() {
    try {
      setStudents(await readValidStudents(course.id))
      setLoadState("ready")
    } catch {
      setLoadState("error")
    }
  }

  useEffect(() => {
    let active = true
    readValidStudents(course.id)
      .then((records) => {
        if (!active) return
        setStudents(records)
        setLoadState("ready")
      })
      .catch(() => {
        if (active) setLoadState("error")
      })
    return () => {
      active = false
    }
  }, [course.id])

  const selectedStudent = useMemo(() => {
    if (screen.kind !== "detail" && screen.kind !== "edit") return undefined
    return students.find(({ id }) => id === screen.studentId)
  }, [screen, students])

  if (loadState === "loading") {
    return (
      <p className="py-12 text-center text-sm font-semibold">
        Apertura allievi…
      </p>
    )
  }

  if (loadState === "error") {
    return (
      <section className="rounded-3xl border bg-card p-5">
        <h1 className="text-xl font-black">Allievi non disponibili</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Non riesco a leggere l’archivio locale.
        </p>
        <Button className="mt-5" onClick={refreshStudents}>
          Riprova
        </Button>
      </section>
    )
  }

  if (screen.kind === "create") {
    return (
      <StudentForm
        course={course}
        onCancel={() => setScreen({ kind: "list" })}
        onSaved={() => {
          void refreshStudents()
          setScreen({ kind: "list" })
        }}
      />
    )
  }

  if (screen.kind === "knowledge") {
    return (
      <StudentKnowledge
        courseId={course.id}
        onBack={() => setScreen({ kind: "list" })}
        onSaved={(studentId: string, input: StudentKnowledgeInput) => {
          setStudents((current) =>
            current.map((student) =>
              student.id === studentId ? { ...student, ...input } : student,
            ),
          )
        }}
        students={students}
      />
    )
  }

  if (screen.kind === "scan") {
    return (
      <StudentScan
        courseId={course.id}
        courseStartDate={course.startDate}
        onBack={() => setScreen({ kind: "list" })}
        onCommitted={() => {
          void refreshStudents()
          setScreen({ kind: "list" })
        }}
        onManualAdd={() => setScreen({ kind: "create" })}
      />
    )
  }

  if (screen.kind === "edit" && selectedStudent) {
    return (
      <StudentForm
        course={course}
        focusField={screen.focusField}
        key={selectedStudent.id}
        onCancel={() =>
          setScreen({ kind: "detail", studentId: selectedStudent.id })
        }
        onSaved={() => {
          void refreshStudents()
          setScreen({ kind: "detail", studentId: selectedStudent.id })
        }}
        student={selectedStudent}
      />
    )
  }

  if (screen.kind === "detail" && selectedStudent) {
    return (
      <StudentDetail
        course={course}
        focusEvaluationHistory={focusEvaluationHistory}
        onBack={() => {
          if (initialStudentId && onInitialStudentBack) {
            onInitialStudentBack()
            return
          }
          setScreen({ kind: "list" })
        }}
        onChanged={refreshStudents}
        onDeleted={async () => {
          await refreshStudents()
          setScreen({ kind: "list" })
        }}
        onEdit={(focusField) =>
          setScreen({ kind: "edit", focusField, studentId: selectedStudent.id })
        }
        student={selectedStudent}
        students={students}
      />
    )
  }

  return (
    <>
      <StudentPageHeader
        action={
          <div className="flex items-center gap-1">
            <Button
              aria-controls="student-actions"
              aria-expanded={menuOpen}
              aria-label="Menu allievi"
              className="h-[44px] min-h-[44px] w-[44px] px-0"
              onClick={() => setMenuOpen((open) => !open)}
              variant="secondary"
            >
              <MoreVertical aria-hidden="true" className="size-5" />
            </Button>
          </div>
        }
        onBack={onHome}
        title="Allievi"
      />
      {menuOpen && (
        <section
          aria-label="Azioni allievi"
          className="mb-4 grid gap-2 rounded-2xl border bg-card p-2 shadow-[0_8px_24px_rgb(6_59_82/0.08)]"
          id="student-actions"
        >
          <Button
            className="justify-start"
            onClick={() => {
              setMenuOpen(false)
              setScreen({ kind: "create" })
            }}
            variant="secondary"
          >
            <Plus aria-hidden="true" className="size-5" />
            Aggiungi allievo
          </Button>
          <Button
            className="justify-start"
            onClick={() => {
              setMenuOpen(false)
              setScreen({ kind: "scan" })
            }}
            variant="secondary"
          >
            <ScanLine aria-hidden="true" className="size-5" />
            Scan allievi
          </Button>
          <Button
            className="justify-start"
            disabled={students.length === 0}
            onClick={() => {
              setMenuOpen(false)
              setScreen({ kind: "knowledge" })
            }}
            variant="secondary"
          >
            <NotebookPen aria-hidden="true" className="size-5" />
            Conoscenza allievi
          </Button>
        </section>
      )}
      {students.length === 0 ? (
        <EmptyStudents
          onAdd={() => setScreen({ kind: "create" })}
          onScan={() => setScreen({ kind: "scan" })}
        />
      ) : (
        <>
          <StudentList
            course={course}
            onOpen={(studentId) => setScreen({ kind: "detail", studentId })}
            students={students}
          />
          <Button
            aria-label="Aggiungi allievo"
            className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full p-0 shadow-[0_10px_28px_rgb(13_91_166/0.3)]"
            onClick={() => setScreen({ kind: "create" })}
          >
            <Plus aria-hidden="true" className="size-6" />
          </Button>
        </>
      )}
    </>
  )
}
