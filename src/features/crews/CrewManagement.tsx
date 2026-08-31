import {
  Check,
  ChevronLeft,
  CircleMinus,
  HandHeart,
  ShipWheel,
  TriangleAlert,
  UsersRound,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SESSION_SEQUENCE, type SessionId } from "@/domain/config"
import {
  assignCrewDestination,
  findPersonLocation,
  getCrewCompleteness,
  getEvenCrewTargets,
  getStandardCrewSize,
  movePerson,
  removePerson,
  setBoatGoingOut,
  swapPeople,
  type CrewPersonRef,
  type CrewPlan,
} from "@/domain/crews"
import {
  getCrewWarnings,
  getWorstCrewWarningSeverity,
  type CrewHistoryEntry,
  type CrewWarning,
} from "@/domain/crewWarnings"
import { validateBoatRecords, validateCrewRecords } from "@/domain/invariants"
import { getStudentDisplayName } from "@/domain/student"
import {
  listBoats,
  listFaults,
  type BoatRecord,
  type CourseFaultRecord,
} from "@/persistence/boats"
import type { CourseRecord } from "@/persistence/courses"
import {
  readCrewHistory,
  readCrewPlan,
  saveCrewPlan,
} from "@/persistence/crews"
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

function sessionLabel(sessionId: SessionId) {
  const session = SESSION_SEQUENCE.find(({ id }) => id === sessionId)
  return session ? `${session.day} ${session.period}` : sessionId
}

function hasCrewHistoryIssues(
  students: StudentRecord[],
  volunteers: VolunteerRecord[],
  history: CrewHistoryEntry[],
) {
  return (
    validateCrewRecords(
      students,
      volunteers,
      history.map((crew) => ({
        id: crew.crewId,
        sessionId: crew.sessionId,
        studentIds: crew.studentIds,
        volunteerIds: [],
        destination: "unassigned",
      })),
      [],
    ).length > 0
  )
}

function CrewWarningDetail({
  warning,
  personLabel,
}: {
  warning: CrewWarning
  personLabel: (person: CrewPersonRef) => string
}) {
  if (warning.kind === "boat-unavailable") {
    return (
      <article className="flex gap-2 text-sm">
        <span
          aria-hidden="true"
          className="mt-1 size-2.5 shrink-0 rounded-full bg-[#b42318]"
        />
        <div className="min-w-0">
          <h3 className="font-black">Barca non disponibile</h3>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {warning.boatLabel} resta assegnata: scegli se mantenerla o
            cambiarla.
          </p>
        </div>
      </article>
    )
  }
  const names = warning.studentIds
    .map((personId) => personLabel({ personId, personType: "student" }))
    .join(" · ")
  const title =
    warning.kind === "size"
      ? `Taglie ${warning.sizes[0]} + ${warning.sizes[1]}`
      : warning.kind === "pair-recent"
        ? "Coppia nelle ultime 3 sessioni"
        : warning.kind === "pair-older"
          ? "Coppia già vista nel corso"
          : "Equipaggio identico già visto"
  const history =
    warning.kind === "size"
      ? null
      : `${warning.previousCount} ${warning.previousCount === 1 ? "precedente" : "precedenti"} · ultima ${sessionLabel(warning.lastSessionId)}`

  return (
    <article className="flex gap-2 text-sm">
      <span
        aria-hidden="true"
        className={`mt-1 size-2.5 shrink-0 rounded-full ${warning.severity === "red" ? "bg-[#b42318]" : "bg-[#d28a00]"}`}
      />
      <div className="min-w-0">
        <h3 className="font-black">{title}</h3>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {names}
          {history ? ` · ${history}` : ""}
        </p>
      </div>
    </article>
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
  const [boats, setBoats] = useState<BoatRecord[]>([])
  const [faults, setFaults] = useState<CourseFaultRecord[]>([])
  const [plan, setPlan] = useState<CrewPlan>({
    crews: [],
    landStudentIds: [],
    selectedBoatIds: [],
  })
  const [history, setHistory] = useState<CrewHistoryEntry[]>([])
  const [warningCrewId, setWarningCrewId] = useState<string | null>(null)
  const [destinationCrewId, setDestinationCrewId] = useState<string | null>(
    null,
  )
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
      const [
        studentRecords,
        volunteerRecords,
        boatRecords,
        faultRecords,
        stored,
        storedHistory,
      ] = await Promise.all([
        listStudents(course.id),
        listVolunteers(course.id),
        listBoats(course.id),
        listFaults(course.id),
        readCrewPlan(course.id, nextSessionId),
        readCrewHistory(course.id),
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
        destination: crew.destination,
        boatId: crew.boatId ?? undefined,
      }))
      if (
        validateBoatRecords(boatRecords, faultRecords).length > 0 ||
        validateCrewRecords(
          studentRecords,
          volunteerRecords,
          invariantCrews,
          stored.landAssignments,
          boatRecords,
          stored.selectedBoatIds.map((boatId, index) => ({
            id: `session-boat-${index}`,
            sessionId: nextSessionId,
            boatId,
          })),
        ).length > 0 ||
        hasCrewHistoryIssues(studentRecords, volunteerRecords, storedHistory)
      ) {
        throw new Error("Persisted crew state violates invariants")
      }
      setStudents(studentRecords)
      setVolunteers(volunteerRecords)
      setBoats(boatRecords)
      setFaults(faultRecords)
      setPlan({
        crews: stored.crews,
        landStudentIds: stored.landStudentIds,
        selectedBoatIds: stored.selectedBoatIds,
      })
      setHistory(storedHistory)
      setCrewCount(Math.max(1, stored.crews.length))
      setSelected(null)
      setWarningCrewId(null)
      setDestinationCrewId(null)
      setLoadState("ready")
    } catch (error) {
      console.error("Crew load failed", error)
      setLoadState("error")
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([
      listStudents(course.id),
      listVolunteers(course.id),
      listBoats(course.id),
      listFaults(course.id),
      readCrewPlan(course.id, sessionId),
      readCrewHistory(course.id),
    ])
      .then(
        ([
          studentRecords,
          volunteerRecords,
          boatRecords,
          faultRecords,
          stored,
          storedHistory,
        ]) => {
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
            destination: crew.destination,
            boatId: crew.boatId ?? undefined,
          }))
          if (
            validateBoatRecords(boatRecords, faultRecords).length > 0 ||
            validateCrewRecords(
              studentRecords,
              volunteerRecords,
              invariantCrews,
              stored.landAssignments,
              boatRecords,
              stored.selectedBoatIds.map((boatId, index) => ({
                id: `session-boat-${index}`,
                sessionId,
                boatId,
              })),
            ).length > 0 ||
            hasCrewHistoryIssues(
              studentRecords,
              volunteerRecords,
              storedHistory,
            )
          ) {
            throw new Error("Persisted crew state violates invariants")
          }
          setStudents(studentRecords)
          setVolunteers(volunteerRecords)
          setBoats(boatRecords)
          setFaults(faultRecords)
          setPlan({
            crews: stored.crews,
            landStudentIds: stored.landStudentIds,
            selectedBoatIds: stored.selectedBoatIds,
          })
          setHistory(storedHistory)
          setCrewCount(Math.max(1, stored.crews.length))
          setSelected(null)
          setWarningCrewId(null)
          setDestinationCrewId(null)
          setLoadState("ready")
        },
      )
      .catch((error) => {
        console.error("Crew load failed", error)
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
  const boatById = useMemo(
    () => new Map(boats.map((boat) => [boat.id, boat])),
    [boats],
  )
  const unresolvedFaultBoatIds = useMemo(
    () =>
      new Set(
        faults
          .filter(({ state }) => state !== "resolved")
          .map(({ boatId }) => boatId),
      ),
    [faults],
  )
  const warningsByCrew = useMemo(() => {
    const sizes = new Map(students.map(({ id, size }) => [id, size] as const))
    return new Map(
      plan.crews.map((crew) => {
        const warnings = getCrewWarnings(
          {
            crewId: crew.id,
            sessionId,
            studentIds: crew.members
              .filter(({ personType }) => personType === "student")
              .map(({ personId }) => personId),
          },
          history,
          sizes,
        )
        const boat = crew.boatId ? boatById.get(crew.boatId) : undefined
        if (
          crew.destination === "boat" &&
          boat?.availability === "unavailable"
        ) {
          warnings.push({
            key: `boat-unavailable:${boat.id}`,
            kind: "boat-unavailable",
            severity: "red",
            boatId: boat.id,
            boatLabel: `${boat.type} ${boat.number}`,
          })
        }
        return [crew.id, warnings]
      }),
    )
  }, [boatById, history, plan.crews, sessionId, students])

  function boatLabel(boatId: string) {
    const boat = boatById.get(boatId)
    return boat ? `${boat.type} ${boat.number}` : "Barca mancante"
  }

  function destinationLabel(crewId: string) {
    const crew = plan.crews.find(({ id }) => id === crewId)
    if (!crew || crew.destination === "unassigned") return "Non assegnato"
    if (crew.destination === "mezzi") return "Mezzi"
    return crew.boatId ? boatLabel(crew.boatId) : "Barca mancante"
  }

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
      setHistory((current) => [
        ...current.filter((entry) => entry.sessionId !== sessionId),
        ...next.crews.map((crew) => ({
          crewId: crew.id,
          sessionId,
          studentIds: crew.members
            .filter(({ personType }) => personType === "student")
            .map(({ personId }) => personId),
        })),
      ])
      setSelected(null)
      setWarningCrewId(null)
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
        destination: "unassigned",
        boatId: null,
      })),
      landStudentIds: [],
      selectedBoatIds: plan.selectedBoatIds,
    }
    await commit(next)
  }

  function tapPerson(person: CrewPersonRef) {
    if (saveInFlight.current) return
    if (!selected || samePerson(selected, person)) {
      setSelected(samePerson(selected, person) ? null : person)
      setDestinationCrewId(null)
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

  function toggleBoatGoingOut(boat: BoatRecord) {
    if (
      saving ||
      (boat.availability === "unavailable" &&
        !plan.selectedBoatIds.includes(boat.id))
    ) {
      return
    }
    try {
      void commit(
        setBoatGoingOut(plan, boat.id, !plan.selectedBoatIds.includes(boat.id)),
      )
    } catch {
      setSaveError(true)
    }
  }

  function chooseDestination(
    destination:
      | { kind: "unassigned" }
      | { kind: "mezzi" }
      | { kind: "boat"; boatId: string },
  ) {
    if (!destinationCrewId || saving) return
    try {
      void commit(assignCrewDestination(plan, destinationCrewId, destination))
    } catch {
      setSaveError(true)
    }
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
  const destinationCrewIndex = plan.crews.findIndex(
    ({ id }) => id === destinationCrewId,
  )

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
          setWarningCrewId(null)
          setDestinationCrewId(null)
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
        <div
          className={`mt-5 grid gap-5 ${selected || destinationCrewId ? "pb-36" : ""}`}
        >
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

          <section
            aria-label="Barche in uscita"
            className="rounded-3xl border bg-card p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-black">Barche in uscita</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Selezionate {plan.selectedBoatIds.length}/{boats.length}
                </p>
              </div>
              <ShipWheel aria-hidden="true" className="size-5 text-primary" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {boats.map((boat) => {
                const selectedBoat = plan.selectedBoatIds.includes(boat.id)
                const unavailable = boat.availability === "unavailable"
                const hasFault = unresolvedFaultBoatIds.has(boat.id)
                return (
                  <button
                    aria-label={`${boat.type} ${boat.number}${unavailable ? ", non disponibile" : hasFault ? ", avaria aperta" : ""}`}
                    aria-pressed={selectedBoat}
                    className={`min-h-14 rounded-2xl border px-3 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40 ${unavailable && selectedBoat ? "border-[#b42318] bg-[#fee4e2] text-[#8f1d15]" : unavailable ? "bg-muted text-muted-foreground" : selectedBoat ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}
                    disabled={saving || (unavailable && !selectedBoat)}
                    key={boat.id}
                    onClick={() => toggleBoatGoingOut(boat)}
                    type="button"
                  >
                    <span className="block truncate text-sm font-black">
                      {boat.number}
                    </span>
                    <span className="block truncate text-[0.68rem] opacity-75">
                      {unavailable
                        ? "Non disponibile"
                        : hasFault
                          ? "Avaria aperta"
                          : boat.type}
                    </span>
                  </button>
                )
              })}
            </div>
            {boats.length === 0 && (
              <p className="mt-3 rounded-2xl bg-muted px-3 py-3 text-sm text-muted-foreground">
                Nessuna barca configurata. Gli equipaggi possono comunque
                restare non assegnati o andare sui Mezzi.
              </p>
            )}
          </section>

          {destinationCrewId && destinationCrewIndex >= 0 && (
            <section
              aria-label={`Destinazione equipaggio ${destinationCrewIndex + 1}`}
              className="fixed bottom-24 left-1/2 z-30 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-primary/30 bg-card/95 p-3 shadow-xl backdrop-blur"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">
                  Equipaggio {destinationCrewIndex + 1}
                </span>
                <button
                  aria-label="Chiudi destinazioni"
                  className="min-h-10 px-2 text-xs font-bold text-muted-foreground"
                  onClick={() => setDestinationCrewId(null)}
                  type="button"
                >
                  Chiudi
                </button>
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5">
                <Button
                  className="h-10 shrink-0 px-3"
                  disabled={saving}
                  onClick={() => chooseDestination({ kind: "unassigned" })}
                  variant="secondary"
                >
                  Non assegnato
                </Button>
                {plan.selectedBoatIds.map((boatId) => {
                  const usedByAnotherCrew = plan.crews.some(
                    (crew) =>
                      crew.id !== destinationCrewId && crew.boatId === boatId,
                  )
                  return (
                    <Button
                      aria-label={`Assegna equipaggio ${destinationCrewIndex + 1} a ${boatLabel(boatId)}`}
                      className="h-10 shrink-0 px-3"
                      disabled={saving || usedByAnotherCrew}
                      key={boatId}
                      onClick={() =>
                        chooseDestination({ kind: "boat", boatId })
                      }
                      variant="secondary"
                    >
                      {boatLabel(boatId)}
                    </Button>
                  )
                })}
                <Button
                  className="h-10 shrink-0 px-3"
                  disabled={saving}
                  onClick={() => chooseDestination({ kind: "mezzi" })}
                  variant="secondary"
                >
                  Mezzi
                </Button>
              </div>
            </section>
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
                  <div className="flex items-center gap-2">
                    {(() => {
                      const warnings = warningsByCrew.get(crew.id) ?? []
                      const severity = getWorstCrewWarningSeverity(warnings)
                      if (!severity) return null
                      return (
                        <button
                          aria-controls={`crew-warning-detail-${crew.id}`}
                          aria-expanded={warningCrewId === crew.id}
                          aria-label={`Avvisi equipaggio ${crewIndex + 1}: ${severity === "red" ? "rosso" : "giallo"}, ${warnings.length}`}
                          className={`grid size-10 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40 ${severity === "red" ? "bg-[#fee4e2] text-[#b42318]" : "bg-[#fff3cd] text-[#8a5a00]"}`}
                          onClick={() =>
                            setWarningCrewId((current) =>
                              current === crew.id ? null : crew.id,
                            )
                          }
                          type="button"
                        >
                          <TriangleAlert
                            aria-hidden="true"
                            className="size-5"
                          />
                        </button>
                      )
                    })()}
                    <span className="text-xs font-bold text-muted-foreground">
                      {standardCrewSize
                        ? `${crew.members.length}/${standardCrewSize}`
                        : `${crew.members.length} · suggerite ${flexibleCrewTargets[crewIndex]}`}
                    </span>
                  </div>
                </div>
                {warningCrewId === crew.id && (
                  <section
                    aria-label={`Dettaglio avvisi equipaggio ${crewIndex + 1}`}
                    className="mb-3 grid gap-2 rounded-2xl bg-muted p-3"
                    id={`crew-warning-detail-${crew.id}`}
                  >
                    {(warningsByCrew.get(crew.id) ?? []).map((warning) => (
                      <CrewWarningDetail
                        key={warning.key}
                        personLabel={personLabel}
                        warning={warning}
                      />
                    ))}
                  </section>
                )}
                <button
                  aria-label={`Destinazione equipaggio ${crewIndex + 1}: ${destinationLabel(crew.id)}`}
                  className={`mb-3 flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40 ${crew.destination === "boat" && boatById.get(crew.boatId ?? "")?.availability === "unavailable" ? "border-[#b42318] bg-[#fee4e2] text-[#8f1d15]" : "bg-muted/50"}`}
                  disabled={saving}
                  onClick={() => {
                    setSelected(null)
                    setDestinationCrewId((current) =>
                      current === crew.id ? null : crew.id,
                    )
                  }}
                  type="button"
                >
                  <span>
                    <span className="block text-[0.65rem] font-bold tracking-wide text-muted-foreground uppercase">
                      Destinazione
                    </span>
                    <span className="block text-sm font-black">
                      {destinationLabel(crew.id)}
                    </span>
                  </span>
                  <ShipWheel aria-hidden="true" className="size-5 shrink-0" />
                </button>
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
            Barche in uscita e destinazioni vengono salvate automaticamente.
          </p>
        </div>
      )}
    </>
  )
}
