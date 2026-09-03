import {
  BookOpenText,
  Check,
  ChevronLeft,
  CircleMinus,
  Copy,
  HandHeart,
  Info,
  ShipWheel,
  TriangleAlert,
  X,
  UsersRound,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  SESSION_DUTY_DAY,
  SESSION_SEQUENCE,
  SESSION_SMONTANTE_DUTY_DAY,
  type SessionId,
} from "@/domain/config"
import {
  assignCrewDestination,
  copyPreviousBoatSelection,
  copyPreviousCrewPlan,
  findPersonLocation,
  formatCrewAnnouncement,
  getCrewCompleteness,
  getEvenCrewTargets,
  getPreviousSessionId,
  getStandardCrewSize,
  movePerson,
  removePerson,
  setBoatGoingOut,
  swapPeople,
  type CrewPersonRef,
  type CrewPlan,
  type CrewCopyRemoval,
} from "@/domain/crews"
import {
  getCrewWarnings,
  getWorstCrewWarningSeverity,
  type CrewHistoryEntry,
  type CrewWarning,
} from "@/domain/crewWarnings"
import {
  validateBoatRecords,
  validateCrewRecords,
  validateDutyRecords,
} from "@/domain/invariants"
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
import { readDutyPlan } from "@/persistence/duties"
import type { DutyAssignment } from "@/domain/duties"
import { listStudents, type StudentRecord } from "@/persistence/students"
import { listVolunteers, type VolunteerRecord } from "@/persistence/volunteers"

function CrewHeader({
  onBack,
  onRead,
  readDisabled,
}: {
  onBack: () => void
  onRead: () => void
  readDisabled: boolean
}) {
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
      <h1 className="min-w-0 flex-1 truncate text-2xl font-black tracking-tight">
        Equipaggi
      </h1>
      <button
        aria-label="Apri vista lettura"
        className="grid size-11 shrink-0 place-items-center rounded-xl border bg-card text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-40"
        disabled={readDisabled}
        onClick={onRead}
        type="button"
      >
        <BookOpenText aria-hidden="true" className="size-5" />
      </button>
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

function handleDialogKeyDown(
  event: ReactKeyboardEvent<HTMLElement>,
  dialog: HTMLElement | null,
  onClose: () => void,
) {
  if (event.key === "Escape") {
    event.preventDefault()
    onClose()
    return
  }
  if (event.key !== "Tab" || !dialog) return
  const controls = Array.from(
    dialog.querySelectorAll<HTMLElement>("button:not(:disabled)"),
  )
  if (controls.length === 0) return
  const first = controls[0]!
  const last = controls.at(-1)!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function useDialogFocus<T extends HTMLElement>(active = true) {
  const dialogRef = useRef<T>(null)
  useEffect(() => {
    if (!active) return
    const previouslyFocused = document.activeElement
    dialogRef.current
      ?.querySelector<HTMLElement>("button:not(:disabled)")
      ?.focus()
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [active])
  return dialogRef
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
  const pointerDownAt = useRef<number | null>(null)
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null)
  const pointerMoved = useRef(false)
  const longPressed = useRef(false)

  function cancelPress() {
    pointerDownAt.current = null
    pointerOrigin.current = null
    pointerMoved.current = false
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
        longPressed.current = true
        cancelPress()
        onLongPress()
      }}
      onPointerCancel={cancelPress}
      onPointerDown={(event) => {
        if (!onLongPress) return
        longPressed.current = false
        pointerDownAt.current = event.timeStamp
        pointerOrigin.current = { x: event.clientX, y: event.clientY }
        pointerMoved.current = false
      }}
      onPointerLeave={cancelPress}
      onPointerMove={(event) => {
        const origin = pointerOrigin.current
        if (!origin) return
        if (
          Math.abs(event.clientX - origin.x) > 10 ||
          Math.abs(event.clientY - origin.y) > 10
        ) {
          pointerMoved.current = true
        }
      }}
      onPointerUp={(event) => {
        const startedAt = pointerDownAt.current
        if (
          onLongPress &&
          startedAt !== null &&
          !pointerMoved.current &&
          event.timeStamp - startedAt >= 600
        ) {
          longPressed.current = true
          onLongPress()
        }
        cancelPress()
      }}
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

function CopyReportDialog({
  removals,
  personLabel,
  onClose,
}: {
  removals: CrewCopyRemoval[]
  personLabel: (person: CrewPersonRef) => string
  onClose: () => void
}) {
  const dialogRef = useDialogFocus<HTMLElement>()
  return (
    <div className="fixed inset-0 z-60 grid place-items-center bg-foreground/35 p-5">
      <section
        aria-labelledby="crew-copy-report-title"
        aria-modal="true"
        className="w-full max-w-sm rounded-3xl border bg-card p-5 shadow-2xl"
        onKeyDown={(event) =>
          handleDialogKeyDown(event, dialogRef.current, onClose)
        }
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black" id="crew-copy-report-title">
              Equipaggi copiati
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Rimossi:</p>
          </div>
          <button
            aria-label="Chiudi riepilogo copia"
            className="grid size-11 shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <ul className="mt-4 grid gap-2 text-sm">
          {removals.map(({ person, reason }) => (
            <li
              className="rounded-2xl bg-muted px-3 py-2.5"
              key={`${person.personType}:${person.personId}`}
            >
              <span className="font-black">{personLabel(person)}</span>
              <span className="text-muted-foreground"> — {reason}</span>
            </li>
          ))}
        </ul>
        <Button className="mt-5 w-full" onClick={onClose}>
          Ho capito
        </Button>
      </section>
    </div>
  )
}

function AnnouncementView({
  sessionId,
  lines,
  onClose,
}: {
  sessionId: SessionId
  lines: string[]
  onClose: () => void
}) {
  const dialogRef = useDialogFocus<HTMLElement>()

  return (
    <section
      aria-label="Vista lettura equipaggi"
      aria-modal="true"
      className="fixed inset-0 z-60 overflow-y-auto bg-[#fffdf8] text-[#102f3b]"
      onKeyDown={(event) =>
        handleDialogKeyDown(event, dialogRef.current, onClose)
      }
      ref={dialogRef}
      role="dialog"
    >
      <div className="mx-auto min-h-full w-full max-w-2xl px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between gap-4 border-b border-[#c8d7db] pb-4">
          <div>
            <p className="text-xs font-black tracking-[0.16em] uppercase">
              Equipaggi
            </p>
            <h1
              className="mt-1 text-2xl font-black"
              id="crew-announcement-title"
            >
              {sessionLabel(sessionId)}
            </h1>
          </div>
          <button
            aria-label="Chiudi vista lettura"
            className="grid size-12 shrink-0 place-items-center rounded-2xl border border-[#c8d7db] bg-white outline-none focus-visible:ring-3 focus-visible:ring-[#0b526b]/30"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-6" />
          </button>
        </header>
        <ol className="mt-3 divide-y divide-[#dbe4e6]">
          {lines.map((line, index) => (
            <li
              className="py-5 text-[1.35rem] leading-8 font-black tracking-tight"
              key={index}
            >
              {line}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

async function readValidCrewState(courseId: string, sessionId: SessionId) {
  const [students, volunteers, boats, faults, stored, history, dutyPlan] =
    await Promise.all([
      listStudents(courseId),
      listVolunteers(courseId),
      listBoats(courseId),
      listFaults(courseId),
      readCrewPlan(courseId, sessionId),
      readCrewHistory(courseId),
      readDutyPlan(courseId),
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
    validateBoatRecords(boats, faults).length > 0 ||
    validateCrewRecords(
      students,
      volunteers,
      invariantCrews,
      stored.landAssignments,
      boats,
      stored.selectedBoatIds.map((boatId, index) => ({
        id: `session-boat-${index}`,
        sessionId,
        boatId,
      })),
    ).length > 0 ||
    hasCrewHistoryIssues(students, volunteers, history) ||
    validateDutyRecords(
      students,
      dutyPlan.assignments,
      dutyPlan.settings?.completedDayIds ?? [],
    ).length > 0
  ) {
    throw new Error("Persisted crew state violates invariants")
  }
  return { students, volunteers, boats, faults, stored, history, dutyPlan }
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
  const [dutyAssignments, setDutyAssignments] = useState<DutyAssignment[]>([])
  const [copyReport, setCopyReport] = useState<CrewCopyRemoval[] | null>(null)
  const [boatCopySelection, setBoatCopySelection] = useState<string[] | null>(
    null,
  )
  const [readMode, setReadMode] = useState(false)
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
  const [copying, setCopying] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const saveInFlight = useRef(false)
  const boatCopyDialogRef = useDialogFocus<HTMLElement>(
    boatCopySelection !== null,
  )

  const applyLoaded = useCallback(
    (data: Awaited<ReturnType<typeof readValidCrewState>>) => {
      setStudents(data.students)
      setVolunteers(data.volunteers)
      setBoats(data.boats)
      setFaults(data.faults)
      setPlan({
        crews: data.stored.crews,
        landStudentIds: data.stored.landStudentIds,
        selectedBoatIds: data.stored.selectedBoatIds,
      })
      setHistory(data.history)
      setDutyAssignments(data.dutyPlan.assignments)
      setCrewCount(Math.max(1, data.stored.crews.length))
      setSelected(null)
      setWarningCrewId(null)
      setDestinationCrewId(null)
      setCopyReport(null)
      setBoatCopySelection(null)
      setReadMode(false)
      setLoadState("ready")
    },
    [],
  )

  async function load(nextSessionId = sessionId) {
    setLoadState("loading")
    try {
      applyLoaded(await readValidCrewState(course.id, nextSessionId))
    } catch (error) {
      console.error("Crew load failed", error)
      setLoadState("error")
    }
  }

  useEffect(() => {
    let active = true
    readValidCrewState(course.id, sessionId)
      .then((data) => {
        if (active) applyLoaded(data)
      })
      .catch((error) => {
        console.error("Crew load failed", error)
        if (active) setLoadState("error")
      })
    return () => {
      active = false
    }
  }, [applyLoaded, course.id, sessionId])

  const activeStudents = students.filter(({ active }) => active === 1)
  const previousSessionId = getPreviousSessionId(sessionId)
  const busy = saving || copying
  const availablePeopleCount = activeStudents.length + volunteers.length
  const maxCrewCount = Math.max(1, availablePeopleCount)
  const standardCrewSize = getStandardCrewSize(course.family, course.level)
  const flexibleCrewTargets = getEvenCrewTargets(
    activeStudents.length + volunteers.length,
    Math.max(1, plan.crews.length),
  )
  const completeness = getCrewCompleteness(
    activeStudents.map(({ id }) => id),
    plan,
  )
  const currentDutyStudentIds = useMemo(
    () =>
      new Set(
        dutyAssignments
          .filter(({ dayId }) => dayId === SESSION_DUTY_DAY[sessionId])
          .map(({ studentId }) => studentId),
      ),
    [dutyAssignments, sessionId],
  )
  const smontanteDutyStudentIds = useMemo(() => {
    const dutyDay = SESSION_SMONTANTE_DUTY_DAY[sessionId]
    return new Set(
      dutyDay
        ? dutyAssignments
            .filter(({ dayId }) => dayId === dutyDay)
            .map(({ studentId }) => studentId)
        : [],
    )
  }, [dutyAssignments, sessionId])
  const d1MorningDutyNotLand =
    course.family === "Deriva" &&
    course.level === 1 &&
    sessionId.endsWith("-am")
      ? activeStudents.filter(
          ({ id }) =>
            currentDutyStudentIds.has(id) && !plan.landStudentIds.includes(id),
        )
      : []
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
    const dutyMarker = currentDutyStudentIds.has(person.personId)
      ? " · C"
      : smontanteDutyStudentIds.has(person.personId)
        ? " · SM"
        : ""
    return `${student?.active === 0 ? "Disabilitato" : "Allievo"}${size}${dutyMarker}`
  }

  const selectedBoatTypes = Array.from(
    new Set(
      plan.selectedBoatIds
        .map((boatId) => boatById.get(boatId)?.type)
        .filter((type): type is BoatRecord["type"] => Boolean(type)),
    ),
  )
  const announcementLines = plan.crews.map((crew) => {
    return formatCrewAnnouncement({
      destination: crew.destination,
      exactBoatLabel: crew.boatId ? boatLabel(crew.boatId) : null,
      inferredBoatType:
        selectedBoatTypes.length === 1 ? selectedBoatTypes[0] : null,
      memberLabels: crew.members.map(personLabel),
    })
  })

  async function commit(next: CrewPlan) {
    if (saveInFlight.current) return false
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
      return true
    } catch {
      setSaveError(true)
      return false
    } finally {
      saveInFlight.current = false
      setSaving(false)
    }
  }

  async function createCrews() {
    if (saveInFlight.current || copying) return
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

  async function copyPreviousCrews() {
    if (!previousSessionId || saveInFlight.current || copying) return
    setCopying(true)
    setSaveError(false)
    try {
      const previousPlan = await readCrewPlan(course.id, previousSessionId)
      const dutyDayId = SESSION_DUTY_DAY[sessionId]
      const { plan: copiedPlan, removals } = copyPreviousCrewPlan({
        previousPlan,
        sessionId,
        activeStudentIds: activeStudents.map(({ id }) => id),
        currentVolunteerIds: volunteers.map(({ id }) => id),
        currentLandStudentIds: plan.landStudentIds,
        dutyStudentIds: dutyAssignments
          .filter(({ dayId }) => dayId === dutyDayId)
          .map(({ studentId }) => studentId),
        selectedBoatIds: plan.selectedBoatIds,
      })
      if (await commit(copiedPlan)) {
        setCrewCount(Math.max(1, copiedPlan.crews.length))
        setCopyReport(removals.length > 0 ? removals : null)
      }
    } catch {
      setSaveError(true)
    } finally {
      setCopying(false)
    }
  }

  async function preparePreviousBoats() {
    if (!previousSessionId || saveInFlight.current || copying) return
    setCopying(true)
    setSaveError(false)
    try {
      const previousPlan = await readCrewPlan(course.id, previousSessionId)
      setBoatCopySelection(
        copyPreviousBoatSelection(
          previousPlan.selectedBoatIds,
          boats
            .filter(({ availability }) => availability === "available")
            .map(({ id }) => id),
          plan.crews
            .filter(
              ({ destination, boatId }) => destination === "boat" && boatId,
            )
            .map(({ boatId }) => boatId!),
        ),
      )
    } catch {
      setSaveError(true)
    } finally {
      setCopying(false)
    }
  }

  function toggleCopiedBoat(boat: BoatRecord) {
    if (!boatCopySelection || busy) return
    const selectedBoat = boatCopySelection.includes(boat.id)
    const assigned = plan.crews.some(({ boatId }) => boatId === boat.id)
    if ((!selectedBoat && boat.availability === "unavailable") || assigned)
      return
    setBoatCopySelection(
      selectedBoat
        ? boatCopySelection.filter((id) => id !== boat.id)
        : [...boatCopySelection, boat.id],
    )
  }

  async function confirmCopiedBoats() {
    if (!boatCopySelection || busy) return
    if (await commit({ ...plan, selectedBoatIds: boatCopySelection })) {
      setBoatCopySelection(null)
    }
  }

  function tapPerson(person: CrewPersonRef) {
    if (saveInFlight.current || copying) return
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
    if (!selected || busy) return
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
    if (!selected || selected.personType !== "student" || busy) return
    void commit(movePerson(plan, selected, { kind: "land" }, 1))
  }

  function toggleBoatGoingOut(boat: BoatRecord) {
    if (
      busy ||
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
    if (!destinationCrewId || busy) return
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
      <p className="py-12 text-center text-sm font-semibold" role="status">
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
      {readMode && (
        <AnnouncementView
          lines={announcementLines}
          onClose={() => setReadMode(false)}
          sessionId={sessionId}
        />
      )}
      {copyReport && (
        <CopyReportDialog
          onClose={() => setCopyReport(null)}
          personLabel={personLabel}
          removals={copyReport}
        />
      )}
      {boatCopySelection && (
        <div className="fixed inset-0 z-60 grid place-items-center bg-foreground/35 p-5">
          <section
            aria-labelledby="boat-copy-title"
            aria-modal="true"
            className="w-full max-w-sm rounded-3xl border bg-card p-5 shadow-2xl"
            onKeyDown={(event) =>
              handleDialogKeyDown(event, boatCopyDialogRef.current, () => {
                if (!busy) setBoatCopySelection(null)
              })
            }
            ref={boatCopyDialogRef}
            role="dialog"
          >
            <h2 className="text-xl font-black" id="boat-copy-title">
              Barche copiate
            </h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Controlla la selezione della sessione precedente, modificala se
              serve e conferma.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {boats.map((boat) => {
                const selectedBoat = boatCopySelection.includes(boat.id)
                const assigned = plan.crews.some(
                  ({ boatId }) => boatId === boat.id,
                )
                const unavailable = boat.availability === "unavailable"
                return (
                  <button
                    aria-label={`${boat.type} ${boat.number} nella copia${assigned ? ", già assegnata" : unavailable ? ", non disponibile" : ""}`}
                    aria-pressed={selectedBoat}
                    className={`min-h-14 rounded-2xl border px-3 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40 ${selectedBoat ? "border-primary bg-primary text-primary-foreground" : unavailable ? "bg-muted text-muted-foreground" : "bg-card"}`}
                    disabled={
                      busy || assigned || (unavailable && !selectedBoat)
                    }
                    key={boat.id}
                    onClick={() => toggleCopiedBoat(boat)}
                    type="button"
                  >
                    <span className="block text-sm font-black">
                      {boat.number}
                    </span>
                    <span className="block truncate text-[0.68rem] opacity-75">
                      {assigned
                        ? "Già assegnata"
                        : unavailable
                          ? "Non disponibile"
                          : boat.type}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button
                disabled={busy}
                onClick={() => setBoatCopySelection(null)}
                variant="secondary"
              >
                Annulla
              </Button>
              <Button disabled={busy} onClick={() => void confirmCopiedBoats()}>
                {saving ? "Salvataggio…" : "Conferma barche"}
              </Button>
            </div>
          </section>
        </div>
      )}
      <CrewHeader
        onBack={onHome}
        onRead={() => setReadMode(true)}
        readDisabled={busy || plan.crews.length === 0}
      />
      <SessionChoice
        disabled={busy || boatCopySelection !== null}
        onChange={(next) => {
          if (
            next === sessionId ||
            saveInFlight.current ||
            copying ||
            boatCopySelection
          )
            return
          setLoadState("loading")
          setSessionId(next)
          onSessionChange?.(next)
          setSelected(null)
          setWarningCrewId(null)
          setDestinationCrewId(null)
        }}
        sessionId={sessionId}
      />

      {previousSessionId && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            aria-label={`Copia equipaggi da ${sessionLabel(previousSessionId)}`}
            className="h-auto min-h-11 px-2 text-xs"
            disabled={busy || boatCopySelection !== null}
            onClick={() => void copyPreviousCrews()}
            variant="secondary"
          >
            <Copy aria-hidden="true" className="size-4" />
            Copia equipaggi
          </Button>
          <Button
            aria-label={`Copia barche da ${sessionLabel(previousSessionId)}`}
            className="h-auto min-h-11 px-2 text-xs"
            disabled={busy || boatCopySelection !== null}
            onClick={() => void preparePreviousBoats()}
            variant="secondary"
          >
            <ShipWheel aria-hidden="true" className="size-4" />
            Copia barche
          </Button>
        </div>
      )}

      {saveError && (
        <p className="mt-3 text-sm font-semibold text-[#a2381b]" role="alert">
          Modifica non valida o non salvata. Riprova.
        </p>
      )}

      {plan.crews.length === 0 ? (
        <section className="mt-5 rounded-3xl border bg-card p-5">
          <span className="grid size-12 place-items-center rounded-2xl bg-muted text-primary">
            <UsersRound aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-4 text-xl font-black">Prepara la sessione</h2>
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
          <div
            className="mt-3 flex gap-2 rounded-2xl bg-[#e8f3f6] px-3 py-3 text-sm text-[#164e63]"
            role="note"
          >
            <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <p className="font-semibold leading-5">
              {availablePeopleCount === 0
                ? "Nessuna persona disponibile: per ora puoi preparare 1 equipaggio vuoto."
                : `Limite attuale: fino a ${maxCrewCount} equipaggi con ${availablePeopleCount} ${availablePeopleCount === 1 ? "persona disponibile" : "persone disponibili"}.`}
            </p>
          </div>
          <Button
            className="mt-5 w-full"
            disabled={busy}
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

          {d1MorningDutyNotLand.length > 0 && (
            <section
              className="rounded-2xl bg-[#fee4e2] px-4 py-3 text-sm text-[#8f1d15]"
              role="alert"
            >
              <h2 className="font-black">Comandata D1 da portare A terra</h2>
              <p className="mt-1 text-xs font-semibold leading-5">
                {d1MorningDutyNotLand
                  .map((student) => getStudentDisplayName(student, students))
                  .join(" · ")}{" "}
                è in comandata questa mattina e non è A terra.
              </p>
            </section>
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
                    disabled={busy || (unavailable && !selectedBoat)}
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
                  className="min-h-11 px-2 text-xs font-bold text-muted-foreground"
                  onClick={() => setDestinationCrewId(null)}
                  type="button"
                >
                  Chiudi
                </button>
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5">
                <Button
                  className="h-11 shrink-0 px-3"
                  disabled={busy}
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
                      className="h-11 shrink-0 px-3"
                      disabled={busy || usedByAnotherCrew}
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
                  className="h-11 shrink-0 px-3"
                  disabled={busy}
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
                    className="h-11 shrink-0 px-3"
                    disabled={busy}
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
                      className="h-11 shrink-0 px-3"
                      disabled={busy || currentCrew || full}
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
                    className="h-11 shrink-0 px-3"
                    disabled={busy || selectedLocation.kind === "land"}
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
                          className={`grid size-11 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40 ${severity === "red" ? "bg-[#fee4e2] text-[#b42318]" : "bg-[#fff3cd] text-[#8a5a00]"}`}
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
                  disabled={busy}
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
                      disabled={busy}
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
                        disabled={!selected || busy}
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
                    disabled={busy}
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
                  !selected || selected.personType !== "student" || busy
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
                    disabled={busy}
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
                    disabled={busy}
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
