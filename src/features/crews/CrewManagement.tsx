import {
  Check,
  ChevronLeft,
  CircleMinus,
  HandHeart,
  ShipWheel,
  UsersRound,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SESSION_SEQUENCE, type SessionId } from "@/domain/config"
import {
  findPersonLocation,
  getCrewCompleteness,
  getEvenCrewTargets,
  getStandardCrewSize,
  movePerson,
  removePerson,
  swapPeople,
  type CrewPersonRef,
  type CrewPlan,
} from "@/domain/crews"
import { validateCrewRecords } from "@/domain/invariants"
import { getStudentDisplayName } from "@/domain/student"
import type { CourseRecord } from "@/persistence/courses"
import { readCrewPlan, saveCrewPlan } from "@/persistence/crews"
import { listStudents, type StudentRecord } from "@/persistence/students"
import { listVolunteers, type VolunteerRecord } from "@/persistence/volunteers"

function CrewHeader({ onBack }: { onBack: () => void }) {
  return (
    <div className="mb-5 flex items-center gap-1">
      <button
        aria-label="Indietro da Equipaggi"
        className="grid size-11 shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        onClick={onBack}
        type="button"
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
      </button>
      <h1 className="truncate text-2xl font-black tracking-tight">Equipaggi</h1>
    </div>
  )
}

function samePerson(left: CrewPersonRef | null, right: CrewPersonRef) {
  return (
    left?.personId === right.personId && left.personType === right.personType
  )
}

function PersonButton({
  person,
  label,
  detail,
  selected,
  disabled,
  onTap,
  onLongPress,
  ariaLabel,
}: {
  person: CrewPersonRef
  label: string
  detail: string
  selected: boolean
  disabled: boolean
  onTap: () => void
  onLongPress?: () => void
  ariaLabel?: string
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)

  function cancelTimer() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  return (
    <button
      aria-label={ariaLabel ?? label}
      aria-pressed={selected}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl border bg-card px-3 py-2.5 text-left outline-none aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60"
      disabled={disabled}
      onClick={() => {
        if (longPressed.current) {
          longPressed.current = false
          return
        }
        onTap()
      }}
      onContextMenu={(event) => {
        if (!onLongPress) return
        event.preventDefault()
        onLongPress()
      }}
      onPointerCancel={cancelTimer}
      onPointerDown={() => {
        if (!onLongPress) return
        longPressed.current = false
        timer.current = setTimeout(() => {
          longPressed.current = true
          onLongPress()
        }, 600)
      }}
      onPointerLeave={cancelTimer}
      onPointerUp={cancelTimer}
      type="button"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-xs font-black text-foreground">
        {person.personType === "volunteer" ? (
          <HandHeart aria-hidden="true" className="size-4" />
        ) : (
          label.slice(0, 1).toLocaleUpperCase("it-IT")
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{label}</span>
        <span className="block truncate text-xs opacity-75">{detail}</span>
      </span>
      {selected && <Check aria-hidden="true" className="size-4 shrink-0" />}
    </button>
  )
}

function SessionChoice({
  sessionId,
  disabled,
  onChange,
}: {
  sessionId: SessionId
  disabled: boolean
  onChange: (sessionId: SessionId) => void
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      <span>Sessione</span>
      <select
        className="h-12 rounded-xl border bg-card px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as SessionId)}
        value={sessionId}
      >
        {SESSION_SEQUENCE.map(({ id, day, period }) => (
          <option key={id} value={id}>
            {day} · {period}
          </option>
        ))}
      </select>
    </label>
  )
}

export function CrewManagement({
  course,
  initialSessionId = "sat-pm",
  onHome,
  onOpenStudent,
  onSessionChange,
}: {
  course: CourseRecord
  initialSessionId?: SessionId
  onHome: () => void
  onOpenStudent: (studentId: string) => void
  onSessionChange?: (sessionId: SessionId) => void
}) {
  const [sessionId, setSessionId] = useState<SessionId>(initialSessionId)
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [volunteers, setVolunteers] = useState<VolunteerRecord[]>([])
  const [plan, setPlan] = useState<CrewPlan>({
    crews: [],
    landStudentIds: [],
  })
  const [selected, setSelected] = useState<CrewPersonRef | null>(null)
  const [crewCount, setCrewCount] = useState(1)
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const saveInFlight = useRef(false)

  async function load(nextSessionId = sessionId) {
    setLoadState("loading")
    try {
      const [studentRecords, volunteerRecords, stored] = await Promise.all([
        listStudents(course.id),
        listVolunteers(course.id),
        readCrewPlan(course.id, nextSessionId),
      ])
      const invariantCrews = stored.crews.map((crew) => ({
        id: crew.id,
        sessionId: crew.sessionId,
        studentIds: crew.members
          .filter(({ personType }) => personType === "student")
          .map(({ personId }) => personId),
        volunteerIds: crew.members
          .filter(({ personType }) => personType === "volunteer")
          .map(({ personId }) => personId),
        destination: "unassigned",
      }))
      if (
        validateCrewRecords(
          studentRecords,
          volunteerRecords,
          invariantCrews,
          stored.landAssignments,
        ).length > 0
      ) {
        throw new Error("Persisted crew state violates invariants")
      }
      setStudents(studentRecords)
      setVolunteers(volunteerRecords)
      setPlan({ crews: stored.crews, landStudentIds: stored.landStudentIds })
      setCrewCount(Math.max(1, stored.crews.length))
      setSelected(null)
      setLoadState("ready")
    } catch {
      setLoadState("error")
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([
      listStudents(course.id),
      listVolunteers(course.id),
      readCrewPlan(course.id, sessionId),
    ])
      .then(([studentRecords, volunteerRecords, stored]) => {
        if (!active) return
        const invariantCrews = stored.crews.map((crew) => ({
          id: crew.id,
          sessionId: crew.sessionId,
          studentIds: crew.members
            .filter(({ personType }) => personType === "student")
            .map(({ personId }) => personId),
          volunteerIds: crew.members
            .filter(({ personType }) => personType === "volunteer")
            .map(({ personId }) => personId),
          destination: "unassigned",
        }))
        if (
          validateCrewRecords(
            studentRecords,
            volunteerRecords,
            invariantCrews,
            stored.landAssignments,
          ).length > 0
        ) {
          throw new Error("Persisted crew state violates invariants")
        }
        setStudents(studentRecords)
        setVolunteers(volunteerRecords)
        setPlan({ crews: stored.crews, landStudentIds: stored.landStudentIds })
        setCrewCount(Math.max(1, stored.crews.length))
        setSelected(null)
        setLoadState("ready")
      })
      .catch(() => {
        if (active) setLoadState("error")
      })
    return () => {
      active = false
    }
  }, [course.id, sessionId])

  const activeStudents = students.filter(({ active }) => active === 1)
  const maxCrewCount = Math.max(1, activeStudents.length + volunteers.length)
  const standardCrewSize = getStandardCrewSize(course.family, course.level)
  const flexibleCrewTargets = getEvenCrewTargets(
    activeStudents.length + volunteers.length,
    Math.max(1, plan.crews.length),
  )
  const completeness = getCrewCompleteness(
    activeStudents.map(({ id }) => id),
    plan,
  )
  const studentById = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students],
  )
  const volunteerById = useMemo(
    () => new Map(volunteers.map((volunteer) => [volunteer.id, volunteer])),
    [volunteers],
  )

  function personLabel(person: CrewPersonRef) {
    if (person.personType === "volunteer") {
      return volunteerById.get(person.personId)?.name ?? "Volontario mancante"
    }
    const student = studentById.get(person.personId)
    return student
      ? getStudentDisplayName(student, students)
      : "Allievo mancante"
  }

  function personDetail(person: CrewPersonRef) {
    if (person.personType === "volunteer") {
      return volunteerById.get(person.personId)?.role ?? "ADV/IS"
    }
    const student = studentById.get(person.personId)
    const size = student?.size ? ` · ${student.size}` : ""
    return `${student?.active === 0 ? "Disabilitato" : "Allievo"}${size}`
  }

  async function commit(next: CrewPlan) {
    if (saveInFlight.current) return
    saveInFlight.current = true
    setSaving(true)
    setSaveError(false)
    try {
      await saveCrewPlan(course.id, sessionId, next)
      setPlan(next)
      setSelected(null)
    } catch {
      setSaveError(true)
    } finally {
      saveInFlight.current = false
      setSaving(false)
    }
  }

  async function createCrews() {
    if (saveInFlight.current) return
    const next: CrewPlan = {
      crews: Array.from({ length: crewCount }, () => ({
        id: crypto.randomUUID(),
        sessionId,
        members: [],
      })),
      landStudentIds: [],
    }
    await commit(next)
  }

  function tapPerson(person: CrewPersonRef) {
    if (saveInFlight.current) return
    if (!selected || samePerson(selected, person)) {
      setSelected(samePerson(selected, person) ? null : person)
      return
    }
    const targetLocation = findPersonLocation(plan, person)
    if (targetLocation.kind === "pool") {
      setSelected(person)
      return
    }
    try {
      void commit(swapPeople(plan, selected, person))
    } catch {
      setSaveError(true)
    }
  }

  function placeInCrew(crewId: string) {
    if (!selected || saving) return
    try {
      void commit(
        movePerson(
          plan,
          selected,
          { kind: "crew", crewId },
          standardCrewSize ?? Number.MAX_SAFE_INTEGER,
        ),
      )
    } catch {
      setSaveError(true)
    }
  }

  function placeOnLand() {
    if (!selected || selected.personType !== "student" || saving) return
    void commit(movePerson(plan, selected, { kind: "land" }, 1))
  }

  const studentPool = activeStudents.filter(
    ({ id }) =>
      findPersonLocation(plan, { personId: id, personType: "student" }).kind ===
      "pool",
  )
  const volunteerPool = volunteers.filter(
    ({ id }) =>
      findPersonLocation(plan, { personId: id, personType: "volunteer" })
        .kind === "pool",
  )
  const selectedLocation = selected
    ? findPersonLocation(plan, selected)
    : { kind: "pool" as const }

  if (loadState === "loading") {
    return (
      <p className="py-12 text-center text-sm font-semibold">
        Apertura equipaggi…
      </p>
    )
  }
  if (loadState === "error") {
    return (
      <section className="rounded-3xl border bg-card p-5">
        <h1 className="text-xl font-black">Equipaggi non disponibili</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Non riesco a leggere l’archivio locale.
        </p>
        <Button className="mt-5" onClick={() => void load()}>
          Riprova
        </Button>
      </section>
    )
  }

  return (
    <>
      <CrewHeader onBack={onHome} />
      <SessionChoice
        disabled={saving}
        onChange={(next) => {
          if (saveInFlight.current) return
          setSessionId(next)
          onSessionChange?.(next)
          setSelected(null)
        }}
        sessionId={sessionId}
      />

      {plan.crews.length === 0 ? (
        <section className="mt-5 rounded-3xl border bg-card p-5">
          <span className="grid size-12 place-items-center rounded-2xl bg-muted text-primary">
            <UsersRound aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-4 text-xl font-black">Prepara la sessione</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Scegli quanti equipaggi creare. Persone e barche restano concetti
            separati.
          </p>
          <label className="mt-5 grid gap-2 text-sm font-bold">
            <span>Numero di equipaggi</span>
            <Input
              inputMode="numeric"
              max={maxCrewCount}
              min={1}
              onChange={(event) =>
                setCrewCount(
                  Math.min(
                    maxCrewCount,
                    Math.max(1, Math.floor(Number(event.target.value) || 1)),
                  ),
                )
              }
              step={1}
              type="number"
              value={crewCount}
            />
          </label>
          <Button
            className="mt-5 w-full"
            disabled={saving}
            onClick={() => void createCrews()}
          >
            {saving ? "Creazione…" : "Crea equipaggi"}
          </Button>
        </section>
      ) : (
        <div className={`mt-5 grid gap-5 ${selected ? "pb-36" : ""}`}>
          <section
            className={`rounded-2xl px-4 py-3 text-sm font-bold ${completeness.complete ? "bg-[#e9f5eb] text-[#176b2c]" : "bg-[#fff1ed] text-[#9d2f18]"}`}
          >
            Allievi sistemati {completeness.accounted}/{completeness.total}
            {!completeness.complete && (
              <span className="mt-1 block text-xs font-semibold">
                Mancano:{" "}
                {completeness.missingStudentIds
                  .map((id) =>
                    personLabel({ personId: id, personType: "student" }),
                  )
                  .join(" · ")}
              </span>
            )}
          </section>

          {saveError && (
            <p className="text-sm font-semibold text-[#a2381b]" role="alert">
              Modifica non valida o non salvata. Riprova.
            </p>
          )}

          {selected && (
            <section
              aria-label="Destinazione persona selezionata"
              className="fixed bottom-24 left-1/2 z-30 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-primary/30 bg-card/95 p-3 shadow-xl backdrop-blur"
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-bold">
                  Selezionato: {personLabel(selected)}
                </span>
                {selectedLocation.kind !== "pool" && (
                  <Button
                    aria-label={`Rimuovi ${personLabel(selected)} dall’assegnazione`}
                    className="h-10 shrink-0 px-3"
                    disabled={saving}
                    onClick={() => void commit(removePerson(plan, selected))}
                    variant="secondary"
                  >
                    <CircleMinus aria-hidden="true" className="size-4" />
                    Rimuovi
                  </Button>
                )}
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5">
                {plan.crews.map((crew, crewIndex) => {
                  const currentCrew =
                    selectedLocation.kind === "crew" &&
                    selectedLocation.crewId === crew.id
                  const full =
                    standardCrewSize !== null &&
                    crew.members.length >= standardCrewSize
                  return (
                    <Button
                      aria-label={`Sposta ${personLabel(selected)} in equipaggio ${crewIndex + 1}`}
                      className="h-10 shrink-0 px-3"
                      disabled={saving || currentCrew || full}
                      key={crew.id}
                      onClick={() => placeInCrew(crew.id)}
                      variant="secondary"
                    >
                      Eq. {crewIndex + 1}
                    </Button>
                  )
                })}
                {selected.personType === "student" && (
                  <Button
                    aria-label={`Sposta ${personLabel(selected)} A terra`}
                    className="h-10 shrink-0 px-3"
                    disabled={saving || selectedLocation.kind === "land"}
                    onClick={placeOnLand}
                    variant="secondary"
                  >
                    A terra
                  </Button>
                )}
              </div>
            </section>
          )}

          <section aria-label="Equipaggi della sessione" className="grid gap-3">
            {plan.crews.map((crew, crewIndex) => (
              <article className="rounded-3xl border bg-card p-4" key={crew.id}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-black">Equipaggio {crewIndex + 1}</h2>
                  <span className="text-xs font-bold text-muted-foreground">
                    {standardCrewSize
                      ? `${crew.members.length}/${standardCrewSize}`
                      : `${crew.members.length} · suggerite ${flexibleCrewTargets[crewIndex]}`}
                  </span>
                </div>
                <div className="grid gap-2">
                  {crew.members.map((person) => (
                    <PersonButton
                      ariaLabel={`${personLabel(person)}, equipaggio ${crewIndex + 1}`}
                      detail={personDetail(person)}
                      disabled={saving}
                      key={`${person.personType}:${person.personId}`}
                      label={personLabel(person)}
                      onLongPress={
                        person.personType === "student"
                          ? () => onOpenStudent(person.personId)
                          : undefined
                      }
                      onTap={() => tapPerson(person)}
                      person={person}
                      selected={samePerson(selected, person)}
                    />
                  ))}
                  {Array.from(
                    {
                      length: standardCrewSize
                        ? Math.max(0, standardCrewSize - crew.members.length)
                        : 1,
                    },
                    (_, index) => (
                      <button
                        aria-label={`Posto libero ${index + 1} equipaggio ${crewIndex + 1}`}
                        className="min-h-12 rounded-2xl border border-dashed bg-muted/40 px-3 text-sm font-bold text-muted-foreground outline-none enabled:border-primary/50 enabled:text-primary focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60"
                        disabled={!selected || saving}
                        key={index}
                        onClick={() => placeInCrew(crew.id)}
                        type="button"
                      >
                        {selected
                          ? `Inserisci ${personLabel(selected)}`
                          : "Posto libero"}
                      </button>
                    ),
                  )}
                </div>
              </article>
            ))}
          </section>

          <section className="rounded-3xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-black">A terra</h2>
              <span className="text-xs font-bold text-muted-foreground">
                {plan.landStudentIds.length}
              </span>
            </div>
            <div className="grid gap-2">
              {plan.landStudentIds.map((studentId) => {
                const person: CrewPersonRef = {
                  personId: studentId,
                  personType: "student",
                }
                return (
                  <PersonButton
                    ariaLabel={`${personLabel(person)}, A terra`}
                    detail="A terra · conta nella completezza"
                    disabled={saving}
                    key={studentId}
                    label={personLabel(person)}
                    onLongPress={() => onOpenStudent(studentId)}
                    onTap={() => tapPerson(person)}
                    person={person}
                    selected={samePerson(selected, person)}
                  />
                )
              })}
              <button
                aria-label="Sposta selezionato A terra"
                className="min-h-12 rounded-2xl border border-dashed bg-muted/40 px-3 text-sm font-bold text-muted-foreground outline-none enabled:border-primary/50 enabled:text-primary focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60"
                disabled={
                  !selected || selected.personType !== "student" || saving
                }
                onClick={placeOnLand}
                type="button"
              >
                {selected?.personType === "student"
                  ? `Porta ${personLabel(selected)} A terra`
                  : "Seleziona un allievo"}
              </button>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-black tracking-wide uppercase">
              Allievi disponibili · {studentPool.length}
            </h2>
            <div
              aria-label="Allievi disponibili"
              className="mt-2 grid gap-2"
              role="region"
            >
              {studentPool.map((student) => {
                const person: CrewPersonRef = {
                  personId: student.id,
                  personType: "student",
                }
                return (
                  <PersonButton
                    detail={personDetail(person)}
                    disabled={saving}
                    key={student.id}
                    label={personLabel(person)}
                    onLongPress={() => onOpenStudent(student.id)}
                    onTap={() => tapPerson(person)}
                    person={person}
                    selected={samePerson(selected, person)}
                  />
                )
              })}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-black tracking-wide uppercase">
              ADV / IS disponibili · {volunteerPool.length}
            </h2>
            <div
              aria-label="ADV e IS disponibili"
              className="mt-2 grid gap-2"
              role="region"
            >
              {volunteerPool.map((volunteer) => {
                const person: CrewPersonRef = {
                  personId: volunteer.id,
                  personType: "volunteer",
                }
                return (
                  <PersonButton
                    detail={personDetail(person)}
                    disabled={saving}
                    key={volunteer.id}
                    label={personLabel(person)}
                    onTap={() => tapPerson(person)}
                    person={person}
                    selected={samePerson(selected, person)}
                  />
                )
              })}
              {volunteerPool.length === 0 && (
                <p className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">
                  Nessun ADV o IS disponibile.
                </p>
              )}
            </div>
          </section>

          <p className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-xs text-muted-foreground">
            <ShipWheel aria-hidden="true" className="size-4 shrink-0" />
            Le barche verranno assegnate separatamente.
          </p>
        </div>
      )}
    </>
  )
}
