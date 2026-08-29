import {
  CalendarDays,
  ChevronLeft,
  Pencil,
  Phone,
  Plus,
  ScanLine,
  UserRound,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { STUDENT_SEXES, type StudentSex } from "@/domain/config"
import { calculateAge, getStudentDisplayName, isMinor } from "@/domain/student"
import type { CourseRecord } from "@/persistence/courses"
import {
  createStudent,
  listStudents,
  setStudentActive,
  updateStudent,
  type StudentInput,
  type StudentRecord,
} from "@/persistence/students"

type StudentScreen =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "detail"; studentId: string }
  | { kind: "edit"; studentId: string }

type LoadState = "loading" | "ready" | "error"

function sexLabel(sex: StudentSex | null, compact = false) {
  if (sex === "female") return compact ? "F" : "Donna"
  if (sex === "male") return compact ? "M" : "Uomo"
  return compact ? "—" : "Non indicato"
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-")
  return `${day}/${month}/${year}`
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
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-1">
        <button
          aria-label={`Indietro da ${title}`}
          className="grid size-11 shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          onClick={onBack}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <h1 className="truncate text-2xl font-black tracking-tight">{title}</h1>
      </div>
      {action}
    </div>
  )
}

function EmptyStudents({ onAdd }: { onAdd: () => void }) {
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
        <Button disabled size="lg" variant="secondary">
          <ScanLine aria-hidden="true" className="size-5" />
          Scan allievi · prossimamente
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
    <section aria-label="Elenco allievi" className="grid gap-2.5">
      {students.map((student) => {
        const displayName = getStudentDisplayName(student, students)
        const age = calculateAge(student.dateOfBirth, course.startDate)
        const minor = isMinor(student.dateOfBirth, course.startDate)
        return (
          <button
            aria-label={`${displayName}, ${age} anni, ${sexLabel(student.sex, true)}${minor ? ", Minorenne" : ""}${student.active ? "" : ", Non disponibile"}`}
            className={`flex min-h-20 items-center gap-3 rounded-2xl border bg-card p-3.5 text-left shadow-[0_6px_18px_rgb(6_59_82/0.05)] outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 ${student.active ? "" : "opacity-55"}`}
            key={student.id}
            onClick={() => onOpen(student.id)}
            type="button"
          >
            <span
              aria-hidden="true"
              className={`grid size-11 shrink-0 place-items-center rounded-xl ${student.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              <UserRound className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-bold">
                {displayName}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{age} anni</span>
                <span aria-label={`Sesso: ${sexLabel(student.sex)}`}>
                  {sexLabel(student.sex, true)}
                </span>
                {minor && (
                  <span className="rounded-full bg-[#b42318] px-2 py-0.5 font-bold text-white">
                    Minorenne
                  </span>
                )}
                {!student.active && (
                  <span className="font-bold">Non disponibile</span>
                )}
              </span>
            </span>
            <ChevronLeft
              aria-hidden="true"
              className="size-5 rotate-180 text-muted-foreground"
            />
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
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
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
  onCancel,
  onSaved,
}: {
  course: CourseRecord
  student?: StudentRecord
  onCancel: () => void
  onSaved: () => void
}) {
  const [firstName, setFirstName] = useState(student?.firstName ?? "")
  const [surname, setSurname] = useState(student?.surname ?? "")
  const [nickname, setNickname] = useState(student?.nickname ?? "")
  const [dateOfBirth, setDateOfBirth] = useState(student?.dateOfBirth ?? "")
  const [sex, setSex] = useState<StudentSex | "">(student?.sex ?? "")
  const [phone, setPhone] = useState(student?.phone ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(false)
    const input: StudentInput = {
      firstName: firstName.trim(),
      surname: surname.trim(),
      nickname: nickname.trim() || null,
      dateOfBirth,
      sex: sex || null,
      phone: phone.trim() || null,
    }

    try {
      if (student) await updateStudent(student.id, course.id, input)
      else await createStudent(course.id, input)
      onSaved()
    } catch {
      setSaving(false)
      setError(true)
    }
  }

  return (
    <form className="grid gap-5" onSubmit={save}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome">
          <Input
            autoComplete="given-name"
            onChange={(event) => setFirstName(event.target.value)}
            required
            value={firstName}
          />
        </Field>
        <Field label="Cognome">
          <Input
            autoComplete="family-name"
            onChange={(event) => setSurname(event.target.value)}
            required
            value={surname}
          />
        </Field>
      </div>

      <Field
        label="Data di nascita"
        hint="Età e stato Minorenne sono calcolati all’inizio del corso."
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

      <Field label="Sesso">
        <select
          aria-label="Sesso"
          className="h-12 w-full rounded-xl border bg-card px-3 text-base outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
          onChange={(event) => setSex(event.target.value as StudentSex | "")}
          value={sex}
        >
          <option value="">Non indicato</option>
          {STUDENT_SEXES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.id === "female" ? "Donna" : "Uomo"}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Telefono">
        <Input
          autoComplete="tel"
          inputMode="tel"
          onChange={(event) => setPhone(event.target.value)}
          type="tel"
          value={phone}
        />
      </Field>

      <Field
        label="Nome visualizzato / soprannome"
        hint="Facoltativo. Se vuoto, il nome breve viene generato automaticamente."
      >
        <Input
          aria-label="Nome visualizzato / soprannome"
          onChange={(event) => setNickname(event.target.value)}
          value={nickname}
        />
      </Field>

      {error && (
        <p className="text-sm font-semibold text-[#a2381b]" role="alert">
          Le modifiche non sono state salvate. Riprova.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 pt-1">
        <Button onClick={onCancel} type="button" variant="secondary">
          Annulla
        </Button>
        <Button disabled={saving} type="submit">
          {saving ? "Salvataggio…" : "Salva allievo"}
        </Button>
      </div>
    </form>
  )
}

function StudentDetail({
  course,
  student,
  students,
  onBack,
  onEdit,
  onChanged,
}: {
  course: CourseRecord
  student: StudentRecord
  students: StudentRecord[]
  onBack: () => void
  onEdit: () => void
  onChanged: () => Promise<void>
}) {
  const [changing, setChanging] = useState(false)
  const [error, setError] = useState(false)
  const displayName = getStudentDisplayName(student, students)
  const age = calculateAge(student.dateOfBirth, course.startDate)
  const minor = isMinor(student.dateOfBirth, course.startDate)

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

  return (
    <>
      <StudentPageHeader
        action={
          <Button
            aria-label="Modifica allievo"
            onClick={onEdit}
            variant="secondary"
          >
            <Pencil aria-hidden="true" className="size-4" />
            Modifica
          </Button>
        }
        onBack={onBack}
        title="Dettaglio"
      />
      <section
        className={`rounded-3xl border bg-card p-5 shadow-[0_12px_32px_rgb(6_59_82/0.07)] ${student.active ? "" : "opacity-65"}`}
      >
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <UserRound aria-hidden="true" className="size-6" />
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

        <dl className="mt-6 divide-y rounded-2xl bg-muted px-4">
          <div className="flex justify-between gap-4 py-3.5">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays aria-hidden="true" className="size-4" /> Età
            </dt>
            <dd className="text-right text-sm font-bold">{age} anni</dd>
          </div>
          <div className="flex justify-between gap-4 py-3.5">
            <dt className="text-sm text-muted-foreground">Data di nascita</dt>
            <dd className="text-right text-sm font-bold">
              {formatDate(student.dateOfBirth)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3.5">
            <dt className="text-sm text-muted-foreground">Sesso</dt>
            <dd className="text-right text-sm font-bold">
              {sexLabel(student.sex)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3.5">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone aria-hidden="true" className="size-4" /> Telefono
            </dt>
            <dd className="text-right text-sm font-bold">
              {student.phone || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-3.5">
            <dt className="text-sm text-muted-foreground">Nome visualizzato</dt>
            <dd className="text-right text-sm font-bold">{displayName}</dd>
          </div>
        </dl>

        {error && (
          <p className="mt-4 text-sm font-semibold text-[#a2381b]" role="alert">
            Lo stato non è stato modificato. Riprova.
          </p>
        )}

        <Button
          className={`mt-5 w-full ${student.active ? "border-[#d92d20] text-[#b42318] hover:bg-[#fee4e2]" : ""}`}
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
      </section>
    </>
  )
}

export function StudentManagement({
  course,
  onHome,
}: {
  course: CourseRecord
  onHome: () => void
}) {
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [screen, setScreen] = useState<StudentScreen>({ kind: "list" })

  async function refreshStudents() {
    try {
      setStudents(await listStudents(course.id))
      setLoadState("ready")
    } catch {
      setLoadState("error")
    }
  }

  useEffect(() => {
    let active = true
    listStudents(course.id)
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
      <>
        <StudentPageHeader
          onBack={() => setScreen({ kind: "list" })}
          title="Nuovo allievo"
        />
        <StudentForm
          course={course}
          onCancel={() => setScreen({ kind: "list" })}
          onSaved={() => {
            void refreshStudents()
            setScreen({ kind: "list" })
          }}
        />
      </>
    )
  }

  if (screen.kind === "edit" && selectedStudent) {
    return (
      <>
        <StudentPageHeader
          onBack={() =>
            setScreen({ kind: "detail", studentId: selectedStudent.id })
          }
          title="Modifica allievo"
        />
        <StudentForm
          course={course}
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
      </>
    )
  }

  if (screen.kind === "detail" && selectedStudent) {
    return (
      <StudentDetail
        course={course}
        onBack={() => setScreen({ kind: "list" })}
        onChanged={refreshStudents}
        onEdit={() =>
          setScreen({ kind: "edit", studentId: selectedStudent.id })
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
          students.length > 0 ? (
            <Button
              aria-label="Aggiungi allievo"
              className="size-11 px-0"
              onClick={() => setScreen({ kind: "create" })}
            >
              <Plus aria-hidden="true" className="size-5" />
            </Button>
          ) : undefined
        }
        onBack={onHome}
        title="Allievi"
      />
      {students.length === 0 ? (
        <EmptyStudents onAdd={() => setScreen({ kind: "create" })} />
      ) : (
        <StudentList
          course={course}
          onOpen={(studentId) => setScreen({ kind: "detail", studentId })}
          students={students}
        />
      )}
    </>
  )
}
