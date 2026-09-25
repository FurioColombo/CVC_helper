import {
  BookOpenText,
  Check,
  ChevronLeft,
  CircleMinus,
  Copy,
  Info,
  Plus,
  ShipWheel,
  Trash2,
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
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DutyBadge,
  MinorBadge,
  VolunteerRoleBadge,
  type DutyMarker,
} from "@/components/PersonBadges"
import { BoatModelMark } from "@/features/boats/BoatIdentity"
import { getCrewDisplayColumns } from "@/features/crews/crewDisplayPreference"
import {
  downloadCrewSummaryPng,
  type CrewSummaryLine,
} from "@/features/crews/crewSummaryImage"
import {
  SESSION_DUTY_DAY,
  SESSION_SEQUENCE,
  SESSION_SMONTANTE_DUTY_DAY,
  type SessionId,
  type VolunteerRole,
} from "@/domain/config"
import {
  addCrew,
  assignAvailableSessionBoat,
  assignCrewDestination,
  copyPreviousBoatSelection,
  copyPreviousCrewPlan,
  findPersonLocation,
  getCrewMemberAtPosition,
  getCrewCompleteness,
  getOpenCrewSlotIndexes,
  getPreviousSessionId,
  getInitialCrewCapacity,
  getStandardCrewSize,
  movePerson,
  removeEmptyCrew,
  removePerson,
  setCrewCapacity,
  MAX_FLEXIBLE_CREW_CAPACITY,
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
import { getStudentDisplayName, isStudentMinor } from "@/domain/student"
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

const studentPoolCollator = new Intl.Collator("it-IT", {
  numeric: true,
  sensitivity: "base",
})

type CrewSlotSelection = { crewId: string; slotIndex: number }

function CrewHeader({
  onBack,
  onBoats,
  onRead,
  sessionId,
  boatsDisabled,
  readDisabled,
}: {
  onBack: () => void
  onBoats: () => void
  onRead: () => void
  sessionId: SessionId
  boatsDisabled: boolean
  readDisabled: boolean
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-1">
      <button
        aria-label="Indietro da Equipaggi"
        className="grid size-[44px] shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        onClick={onBack}
        type="button"
      >
        <ChevronLeft aria-hidden="true" className="size-[20px]" />
      </button>
      <div className="min-w-0 flex-1 max-[350px]:order-2 max-[350px]:basis-full">
        <div className="flex min-w-0 flex-col items-start gap-0.5 min-[400px]:flex-row min-[400px]:items-baseline min-[400px]:gap-2">
          <h1 className="break-words text-2xl font-black tracking-tight">
            Equipaggi
          </h1>
          <span className="shrink-0 text-xs font-bold text-muted-foreground">
            {sessionLabel(sessionId)}
          </span>
        </div>
      </div>
      <button
        aria-label="Apri barche della sessione"
        className="grid size-[44px] shrink-0 place-items-center rounded-xl border bg-card text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-40"
        disabled={boatsDisabled}
        onClick={onBoats}
        type="button"
      >
        <ShipWheel aria-hidden="true" className="size-[20px]" />
      </button>
      <button
        aria-label="Apri vista lettura"
        className="grid size-[44px] shrink-0 place-items-center rounded-xl border bg-card text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-40"
        disabled={readDisabled}
        onClick={onRead}
        type="button"
      >
        <BookOpenText aria-hidden="true" className="size-[20px]" />
      </button>
    </div>
  )
}

function samePerson(left: CrewPersonRef | null, right: CrewPersonRef) {
  return (
    left?.personId === right.personId && left?.personType === right.personType
  )
}

function sessionLabel(sessionId: SessionId) {
  const session = SESSION_SEQUENCE.find(({ id }) => id === sessionId)
  return session ? `${session.day} ${session.period}` : sessionId
}

type AnnouncementLine = {
  crewNumber: number
  destination: CrewPlan["crews"][number]["destination"]
  boat: BoatRecord | null
  inferredBoatType: BoatRecord["type"] | null
  members: CrewSummaryLine["members"]
}

function BoatMark({
  type,
  size = "compact",
  muted = false,
}: {
  type: BoatRecord["type"]
  size?: "compact" | "large"
  muted?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${size === "large" ? "h-[32px] w-[68px] [&>span]:scale-[0.77]" : "h-[24px] w-[60px] [&>span]:scale-[0.66]"}`}
    >
      <BoatModelMark muted={muted} type={type} />
    </span>
  )
}

function BoatSummary({
  boat,
  inferredType,
  destination,
  large = false,
}: {
  boat: BoatRecord | null
  inferredType?: BoatRecord["type"] | null
  destination: CrewPlan["crews"][number]["destination"]
  large?: boolean
}) {
  if (destination === "mezzi") {
    return <span className="font-black">Mezzi</span>
  }
  if (boat) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <BoatMark size={large ? "large" : "compact"} type={boat.type} />
        <span className="shrink-0 text-lg font-black tabular-nums">
          {boat.number}
        </span>
      </span>
    )
  }
  if (inferredType) {
    // The model the session is going out in, with no hull chosen yet — the
    // "modello senza numero" state of the specification. The mark is muted, so
    // a crew that has a boat (full colour, with its number) cannot be confused
    // with one that only knows the model.
    if (large) {
      return (
        <span className="flex min-w-0 flex-col items-center gap-0.5">
          <BoatMark muted size="large" type={inferredType} />
          <span className="text-xs font-black leading-4 whitespace-nowrap text-muted-foreground">
            Senza barca
          </span>
        </span>
      )
    }
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <BoatMark muted size="compact" type={inferredType} />
        <span className="text-sm font-black text-muted-foreground">
          Senza barca
        </span>
      </span>
    )
  }
  return (
    <span className="text-sm font-black text-muted-foreground">
      Senza barca
    </span>
  )
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

function BoatFaultWarningDetail({
  fault,
  boatLabel,
}: {
  fault: CourseFaultRecord
  boatLabel: string
}) {
  return (
    <article className="flex gap-2 text-sm">
      <span
        aria-hidden="true"
        className="mt-1 size-2.5 shrink-0 rounded-full bg-[#d28a00]"
      />
      <div className="min-w-0">
        <h3 className="font-black">
          {fault.state === "reported" ? "Avaria comunicata" : "Avaria aperta"}
        </h3>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {boatLabel} · {fault.description}
        </p>
      </div>
    </article>
  )
}

function PersonButton({
  person,
  label,
  detail,
  markers,
  markerDescription,
  truncateLabel = false,
  role,
  selected,
  disabled,
  onTap,
  onDoubleTap,
  onLongPress,
  ariaLabel,
  compact = false,
  dense = false,
  className = "",
  centered = false,
}: {
  person: CrewPersonRef
  label: string
  detail: string
  markers?: React.ReactNode
  markerDescription?: string
  truncateLabel?: boolean
  role?: VolunteerRole
  selected: boolean
  disabled: boolean
  onTap: () => void
  onDoubleTap?: () => void
  onLongPress?: () => void
  ariaLabel?: string
  compact?: boolean
  dense?: boolean
  className?: string
  centered?: boolean
}) {
  const pointerDownAt = useRef<number | null>(null)
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null)
  const pointerMoved = useRef(false)
  const longPressed = useRef(false)
  const lastTapAt = useRef(0)

  function cancelPress() {
    pointerDownAt.current = null
    pointerOrigin.current = null
    pointerMoved.current = false
  }

  return (
    <button
      aria-label={ariaLabel ?? label}
      // The badges sit inside a button whose aria-label replaces its content,
      // so their meaning would be lost. It goes in the description instead of
      // the name, which stays the person — the same arrangement P17 uses.
      aria-description={markerDescription || undefined}
      aria-pressed={selected}
      className={`flex ${dense ? "min-h-[44px]" : "min-h-14"} min-w-0 w-full items-center rounded-2xl border bg-card text-left outline-none aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60 ${dense ? "gap-0 px-0 py-[6px]" : compact ? "gap-1 px-2 py-1.5" : "gap-3 px-3 py-2.5"} ${className}`}
      disabled={disabled}
      onClick={(event) => {
        if (longPressed.current) {
          longPressed.current = false
          return
        }
        if (
          onDoubleTap &&
          lastTapAt.current > 0 &&
          event.timeStamp - lastTapAt.current < 380
        ) {
          lastTapAt.current = 0
          onDoubleTap()
          return
        }
        lastTapAt.current = event.timeStamp
        onTap()
      }}
      onDoubleClick={() => {
        if (lastTapAt.current !== 0) {
          lastTapAt.current = 0
          onDoubleTap?.()
        }
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
      {person.personType === "volunteer" && role ? (
        <VolunteerRoleBadge
          className={`${compact ? "size-7" : "size-9"} shrink-0 text-xs`}
          role={role}
        />
      ) : (
        !compact && (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-xs font-black text-foreground">
            {label.slice(0, 1).toLocaleUpperCase("it-IT")}
          </span>
        )
      )}
      <span className="min-w-0 flex-1">
        <span
          className={`flex min-w-0 items-center gap-1 text-sm font-bold ${compact ? "leading-4" : "leading-5"} ${centered ? "justify-center text-center" : ""}`}
        >
          <span
            className={`min-w-0 ${truncateLabel ? "truncate" : "break-words"}`}
          >
            {label}
          </span>
          {markers}
        </span>
        <span
          className={`block truncate opacity-75 ${compact ? "text-[0.68rem] leading-4" : "text-xs"}`}
        >
          {detail}
        </span>
      </span>
      {selected && !compact && (
        <Check aria-hidden="true" className="size-4 shrink-0" />
      )}
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
    // A select is sized by its widest option unless it is told otherwise, so
    // without `w-full min-w-0` this one grows past its own label and pushes the
    // page sideways. At 320px and 200% text it fits on this machine by a couple
    // of pixels and overflows on a runner whose fonts are wider, which is how
    // it reached CI unnoticed.
    <label className="grid min-w-0 text-sm font-bold">
      <span className="sr-only">Sessione</span>
      <select
        className="h-11 w-full min-w-0 rounded-xl border bg-card px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
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
  onDownloadImage,
  imageExportState,
}: {
  sessionId: SessionId
  lines: AnnouncementLine[]
  onClose: () => void
  onDownloadImage: () => void
  imageExportState: "idle" | "busy" | "error"
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
        <button
          className="mt-3 min-h-11 rounded-xl border border-[#c8d7db] bg-white px-4 text-sm font-bold text-[#0b526b] outline-none focus-visible:ring-3 focus-visible:ring-[#0b526b]/30"
          disabled={imageExportState === "busy"}
          onClick={onDownloadImage}
          type="button"
        >
          {imageExportState === "busy"
            ? "Preparo immagine…"
            : "Scarica immagine riepilogo"}
        </button>
        {imageExportState === "error" && (
          <p className="mt-2 text-sm font-semibold text-[#a2381b]" role="alert">
            Impossibile scaricare il riepilogo PNG. Riprova.
          </p>
        )}
        <ol className="mt-2 divide-y divide-[#dbe4e6]">
          {lines.map((line) => (
            <li
              aria-label={`Equipaggio ${line.crewNumber}, ${line.boat ? `${line.boat.type} ${line.boat.number}` : line.destination === "mezzi" ? "Mezzi" : "senza barca"}`}
              className="grid min-w-0 grid-cols-[3.25rem_minmax(5.5rem,7rem)_minmax(0,1fr)] items-center gap-3 py-4"
              key={line.crewNumber}
            >
              <div className="grid min-h-14 place-items-center border-r border-[#dbe4e6] pr-3 text-[#487080]">
                <span className="text-[0.65rem] font-bold uppercase">Eq.</span>
                <strong className="text-xl font-black tabular-nums text-[#102f3b]">
                  {line.crewNumber}
                </strong>
              </div>
              <div className="min-w-0 text-center">
                <BoatSummary
                  boat={line.boat}
                  destination={line.destination}
                  inferredType={line.inferredBoatType}
                  large
                />
              </div>
              <div className="min-w-0 text-[1.05rem] leading-6 font-black tracking-tight min-[390px]:text-[1.2rem] min-[390px]:leading-7">
                {line.members.length > 0 ? (
                  line.members.map((member, index) => (
                    <span
                      className="flex min-w-0 flex-wrap items-center gap-x-2 break-words"
                      key={`${line.crewNumber}:${index}:${member.label}`}
                    >
                      <span className="min-w-0">{member.label}</span>
                      {member.isMinor && <MinorBadge />}
                      {member.duty && <DutyBadge kind={member.duty} />}
                    </span>
                  ))
                ) : (
                  <span className="text-base font-bold text-[#6b8790]">
                    Equipaggio vuoto
                  </span>
                )}
              </div>
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
  const [boatMode, setBoatMode] = useState(false)
  const [boatPage, setBoatPage] = useState(0)
  const boatSwipeStart = useRef<{
    pointerId: number
    x: number
    y: number
  } | null>(null)
  const suppressBoatClick = useRef<{
    pointerId: number
    pointerType: string
    expiresAt: number
  } | null>(null)
  const suppressBoatClickTimer = useRef<number | null>(null)
  const [selectedCrewForBoat, setSelectedCrewForBoat] = useState<string | null>(
    null,
  )
  const [warningCrewId, setWarningCrewId] = useState<string | null>(null)
  const [destinationCrewId, setDestinationCrewId] = useState<string | null>(
    null,
  )
  const [selected, setSelected] = useState<CrewPersonRef | null>(null)
  const [selectedCrewSlot, setSelectedCrewSlot] =
    useState<CrewSlotSelection | null>(null)
  const [crewCountDraft, setCrewCountDraft] = useState("1")
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  )
  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [imageExportState, setImageExportState] = useState<
    "idle" | "busy" | "error"
  >("idle")
  const saveInFlight = useRef(false)
  const boatCopyDialogRef = useDialogFocus<HTMLElement>(
    boatCopySelection !== null,
  )
  const personDestinationRef = useRef<HTMLElement>(null)
  const studentPoolRef = useRef<HTMLElement>(null)
  const returnFocusToCrewSlot = useRef<string | null>(null)

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
      setCrewCountDraft(String(Math.max(1, data.stored.crews.length)))
      setSelected(null)
      returnFocusToCrewSlot.current = null
      setSelectedCrewSlot(null)
      setWarningCrewId(null)
      setDestinationCrewId(null)
      setCopyReport(null)
      setBoatCopySelection(null)
      setReadMode(false)
      setBoatMode(false)
      setSelectedCrewForBoat(null)
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
  const crewDisplayColumns = getCrewDisplayColumns()
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
  const sortedBoats = useMemo(() => {
    const collator = new Intl.Collator("it-IT", {
      numeric: true,
      sensitivity: "base",
    })
    return [...boats].sort(
      (left, right) =>
        collator.compare(left.number, right.number) ||
        collator.compare(left.type, right.type),
    )
  }, [boats])
  const boatPageCount = Math.max(1, Math.ceil(sortedBoats.length / 8))
  const visibleBoatPage = Math.min(boatPage, boatPageCount - 1)
  const visibleBoats = sortedBoats.slice(
    visibleBoatPage * 8,
    visibleBoatPage * 8 + 8,
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
  const openFaultsByBoat = useMemo(() => {
    const result = new Map<string, CourseFaultRecord[]>()
    faults
      .filter(({ state }) => state !== "resolved")
      .forEach((fault) => {
        result.set(fault.boatId, [...(result.get(fault.boatId) ?? []), fault])
      })
    return result
  }, [faults])
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
      return volunteerById.get(person.personId)?.role ?? "Volontario"
    }
    const student = studentById.get(person.personId)
    const size = student?.size ? ` · ${student.size}` : ""
    return `${student?.active === 0 ? "Disabilitato" : "Allievo"}${size}`
  }

  /**
   * Minore and comandata as the badges the rulebook names, beside the person
   * they describe. Each badge carries its own meaning, and the same words go
   * into the button's accessible name, which would otherwise hide them.
   */
  function personMarkers(person: CrewPersonRef) {
    const student =
      person.personType === "student"
        ? studentById.get(person.personId)
        : undefined
    if (!student) return { nodes: null, description: "" }
    const minor = isStudentMinor(student, course.startDate)
    const duty: DutyMarker | null = currentDutyStudentIds.has(person.personId)
      ? "current"
      : smontanteDutyStudentIds.has(person.personId)
        ? "smontante"
        : null
    if (!minor && !duty) return { nodes: null, description: "" }
    return {
      nodes: (
        <>
          {minor && <MinorBadge />}
          {duty && <DutyBadge kind={duty} />}
        </>
      ),
      description: [
        minor ? "minorenne" : "",
        duty === "current"
          ? "in comandata"
          : duty === "smontante"
            ? "smontante"
            : "",
      ]
        .filter(Boolean)
        .join(", "),
    }
  }

  function summaryMember(
    person: CrewPersonRef,
  ): CrewSummaryLine["members"][number] {
    if (person.personType === "volunteer") {
      return {
        label: personLabel(person),
        isMinor: false,
        duty: null,
        role: volunteerById.get(person.personId)?.role ?? null,
      }
    }
    const student = studentById.get(person.personId)
    return {
      label: personLabel(person),
      isMinor: student ? isStudentMinor(student, course.startDate) : false,
      duty: currentDutyStudentIds.has(person.personId)
        ? "current"
        : smontanteDutyStudentIds.has(person.personId)
          ? "smontante"
          : null,
    }
  }

  const selectedBoatTypes = Array.from(
    new Set(
      plan.selectedBoatIds
        .map((boatId) => boatById.get(boatId)?.type)
        .filter((type): type is BoatRecord["type"] => Boolean(type)),
    ),
  )
  const announcementLines: AnnouncementLine[] = plan.crews.map(
    (crew, index) => ({
      crewNumber: index + 1,
      destination: crew.destination,
      boat: crew.boatId ? (boatById.get(crew.boatId) ?? null) : null,
      inferredBoatType:
        selectedBoatTypes.length === 1 ? selectedBoatTypes[0]! : null,
      members: crew.members.map(summaryMember),
    }),
  )

  async function downloadAnnouncementImage() {
    if (imageExportState === "busy") return
    const assigned = new Set(
      plan.crews.flatMap((crew) =>
        crew.members.map((person) => `${person.personType}:${person.personId}`),
      ),
    )
    const availableMembers = [
      ...activeStudents
        .filter(
          (student) =>
            !assigned.has(`student:${student.id}`) &&
            !plan.landStudentIds.includes(student.id),
        )
        .map((student) =>
          summaryMember({ personType: "student", personId: student.id }),
        ),
      ...volunteers
        .filter((volunteer) => !assigned.has(`volunteer:${volunteer.id}`))
        .map((volunteer) =>
          summaryMember({ personType: "volunteer", personId: volunteer.id }),
        ),
    ]
    const summaryLines: CrewSummaryLine[] = [
      { category: "available", members: availableMembers },
      ...announcementLines.map((line): CrewSummaryLine => ({
        category:
          line.members.length === 0
            ? "empty"
            : line.destination === "mezzi"
              ? "mezzi"
              : "sailing",
        crewNumber: line.crewNumber,
        destination:
          line.destination === "mezzi"
            ? "Mezzi"
            : line.boat
              ? `${line.boat.type} ${line.boat.number}`
              : line.inferredBoatType
                ? `${line.inferredBoatType} · Senza barca`
                : "Senza barca",
        members: line.members,
      })),
    ]
    const landMembers = plan.landStudentIds
      .filter((id) => studentById.has(id))
      .map((id) => summaryMember({ personType: "student", personId: id }))
    if (landMembers.length > 0) {
      summaryLines.push({ category: "a-terra", members: landMembers })
    }
    const representedBoats = new Set(
      plan.crews.map((crew) => crew.boatId).filter((id) => id !== null),
    )
    for (const boatId of plan.selectedBoatIds) {
      if (representedBoats.has(boatId)) continue
      const boat = boatById.get(boatId)
      if (!boat) continue
      summaryLines.push({
        category: "empty",
        destination: `${boat.type} ${boat.number}`,
        members: [],
      })
    }
    setImageExportState("busy")
    try {
      await downloadCrewSummaryPng(sessionLabel(sessionId), summaryLines)
      setImageExportState("idle")
    } catch {
      setImageExportState("error")
    }
  }

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
      returnFocusToCrewSlot.current = null
      setSelectedCrewSlot(null)
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
    const parsedCount = Number.parseInt(crewCountDraft, 10)
    const committedCount = Math.min(
      maxCrewCount,
      Math.max(0, Number.isFinite(parsedCount) ? parsedCount : 0),
    )
    setCrewCountDraft(String(committedCount))
    const next: CrewPlan = {
      crews: Array.from({ length: committedCount }, () => ({
        id: crypto.randomUUID(),
        sessionId,
        members: [],
        capacity: getInitialCrewCapacity(course.family, course.level),
        destination: "unassigned",
        boatId: null,
      })),
      landStudentIds: plan.landStudentIds,
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
        setCrewCountDraft(String(Math.max(1, copiedPlan.crews.length)))
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
    if (selectedCrewSlot) {
      const location = findPersonLocation(plan, person)
      if (person.personType === "student" && location.kind === "pool") {
        void fillSelectedCrewSlot(person)
        return
      }
      returnFocusToCrewSlot.current = null
      setSelectedCrewSlot(null)
    }
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
      void commit(movePerson(plan, selected, { kind: "crew", crewId }))
    } catch {
      setSaveError(true)
    }
  }

  function fillSelectedCrewSlot(person: CrewPersonRef) {
    if (!selectedCrewSlot || busy) return
    const crew = plan.crews.find(({ id }) => id === selectedCrewSlot.crewId)
    if (
      !crew ||
      !getOpenCrewSlotIndexes(crew).includes(selectedCrewSlot.slotIndex)
    ) {
      return
    }
    try {
      void commit(
        movePerson(plan, person, {
          kind: "crew",
          crewId: selectedCrewSlot.crewId,
          slotIndex: selectedCrewSlot.slotIndex,
        }),
      ).then((saved) => {
        if (!saved) return
        returnFocusToCrewSlot.current = null
        setSelectedCrewSlot(null)
      })
    } catch {
      setSaveError(true)
    }
  }

  function chooseCrewSlot(crewId: string, slotIndex: number) {
    if (busy) return
    if (selected) {
      try {
        void commit(
          movePerson(plan, selected, { kind: "crew", crewId, slotIndex }),
        ).then((saved) => {
          if (!saved) return
          returnFocusToCrewSlot.current = null
          setSelected(null)
          setSelectedCrewSlot(null)
        })
      } catch {
        setSaveError(true)
      }
      return
    }
    if (
      selectedCrewSlot?.crewId === crewId &&
      selectedCrewSlot.slotIndex === slotIndex
    ) {
      returnFocusToCrewSlot.current = null
      setSelectedCrewSlot(null)
      return
    }
    returnFocusToCrewSlot.current = `crew-slot-${crewId}-${slotIndex}`
    setSelectedCrewSlot({ crewId, slotIndex })
    setSelected(null)
    setDestinationCrewId(null)
    setWarningCrewId(null)
  }

  function cancelCrewSlotSelection() {
    if (!selectedCrewSlot) return
    returnFocusToCrewSlot.current = `crew-slot-${selectedCrewSlot.crewId}-${selectedCrewSlot.slotIndex}`
    setSelectedCrewSlot(null)
  }

  function handleStudentPoolKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || !selectedCrewSlot) return
    event.preventDefault()
    cancelCrewSlotSelection()
  }

  function placeOnLand() {
    if (!selected || selected.personType !== "student" || busy) return
    void commit(movePerson(plan, selected, { kind: "land" }))
  }

  function createCrewForSelected(destination: "unassigned" | "mezzi") {
    if (!selected || busy || plan.crews.length >= maxCrewCount) return
    const withCrew = addCrew(
      plan,
      sessionId,
      () => crypto.randomUUID(),
      getInitialCrewCapacity(course.family, course.level),
    )
    const newCrewId = withCrew.crews.at(-1)!.id
    const withDestination =
      destination === "mezzi"
        ? assignCrewDestination(withCrew, newCrewId, { kind: "mezzi" })
        : withCrew
    try {
      void commit(
        movePerson(withDestination, selected, {
          kind: "crew",
          crewId: newCrewId,
        }),
      )
    } catch {
      setSaveError(true)
    }
  }

  function adjustCrewCapacity(crewId: string, amount: -1 | 1) {
    if (busy || standardCrewSize !== null) return
    const crew = plan.crews.find(({ id }) => id === crewId)
    if (!crew) return
    try {
      void commit(
        setCrewCapacity(
          plan,
          crewId,
          crew.capacity + amount,
          course.family,
          course.level,
        ),
      )
    } catch {
      setSaveError(true)
    }
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
      const selectedBoat = plan.selectedBoatIds.includes(boat.id)
      void commit(setBoatGoingOut(plan, boat.id, !selectedBoat))
    } catch {
      setSaveError(true)
    }
  }

  function startBoatSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return
    boatSwipeStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    }
    suppressBoatClick.current = null
    if (suppressBoatClickTimer.current !== null) {
      window.clearTimeout(suppressBoatClickTimer.current)
      suppressBoatClickTimer.current = null
    }
  }

  function finishBoatSwipe(event: ReactPointerEvent<HTMLDivElement>) {
    const start = boatSwipeStart.current
    boatSwipeStart.current = null
    if (!start || start.pointerId !== event.pointerId) return

    const horizontalDistance = event.clientX - start.x
    const verticalDistance = event.clientY - start.y
    const horizontalSwipe =
      Math.abs(horizontalDistance) >= 48 &&
      Math.abs(horizontalDistance) >= Math.abs(verticalDistance) * 1.25
    if (Math.max(Math.abs(horizontalDistance), Math.abs(verticalDistance)) < 48)
      return
    suppressBoatClick.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      expiresAt: Date.now() + 500,
    }
    suppressBoatClickTimer.current = window.setTimeout(() => {
      suppressBoatClick.current = null
      suppressBoatClickTimer.current = null
    }, 500)
    if (!horizontalSwipe) return
    setBoatPage((page) =>
      horizontalDistance < 0
        ? Math.min(boatPageCount - 1, page + 1)
        : Math.max(0, page - 1),
    )
  }

  function cancelBoatSwipe() {
    boatSwipeStart.current = null
    suppressBoatClick.current = null
    if (suppressBoatClickTimer.current !== null) {
      window.clearTimeout(suppressBoatClickTimer.current)
      suppressBoatClickTimer.current = null
    }
  }

  function suppressClickAfterBoatSwipe(event: ReactMouseEvent<HTMLDivElement>) {
    const pending = suppressBoatClick.current
    if (!pending) return
    if (event.detail === 0 || Date.now() > pending.expiresAt) return
    const pointerEvent =
      "pointerType" in event.nativeEvent
        ? (event.nativeEvent as PointerEvent)
        : null
    if (
      pointerEvent &&
      (pointerEvent.pointerType !== pending.pointerType ||
        pointerEvent.pointerId !== pending.pointerId)
    ) {
      return
    }
    suppressBoatClick.current = null
    if (suppressBoatClickTimer.current !== null) {
      window.clearTimeout(suppressBoatClickTimer.current)
      suppressBoatClickTimer.current = null
    }
    event.preventDefault()
    event.stopPropagation()
  }

  function selectCrewForBoat(crewId: string) {
    if (busy) return
    setSelectedCrewForBoat((current) => (current === crewId ? null : crewId))
  }

  function assignSelectedCrewBoat(boat: BoatRecord) {
    if (!selectedCrewForBoat || busy) return
    if (
      boat.availability === "unavailable" ||
      plan.crews.some(
        (crew) =>
          crew.id !== selectedCrewForBoat &&
          crew.destination === "boat" &&
          crew.boatId === boat.id,
      )
    ) {
      return
    }
    try {
      void commit(
        assignAvailableSessionBoat(
          plan,
          selectedCrewForBoat,
          boat.id,
          new Set(
            boats
              .filter(({ availability }) => availability === "available")
              .map(({ id }) => id),
          ),
        ),
      ).then((saved) => {
        if (saved) setSelectedCrewForBoat(null)
      })
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
    if (destination.kind === "boat") {
      const boat = boats.find(({ id }) => id === destination.boatId)
      const currentCrew = plan.crews.find(({ id }) => id === destinationCrewId)
      if (
        !boat ||
        (boat.availability === "unavailable" &&
          currentCrew?.boatId !== destination.boatId)
      ) {
        return
      }
    }
    try {
      void commit(assignCrewDestination(plan, destinationCrewId, destination))
    } catch {
      setSaveError(true)
    }
  }

  const studentPool = activeStudents
    .filter(
      ({ id }) =>
        findPersonLocation(plan, { personId: id, personType: "student" })
          .kind === "pool",
    )
    .sort((left, right) => {
      const leftDuty = currentDutyStudentIds.has(left.id) ? 0 : 1
      const rightDuty = currentDutyStudentIds.has(right.id) ? 0 : 1
      return (
        leftDuty - rightDuty ||
        studentPoolCollator.compare(
          getStudentDisplayName(left, students),
          getStudentDisplayName(right, students),
        ) ||
        studentPoolCollator.compare(left.id, right.id)
      )
    })
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
  const selectedCrewSlotIndex = selectedCrewSlot
    ? plan.crews.findIndex(({ id }) => id === selectedCrewSlot.crewId)
    : -1
  const selectedDestinationOpen = Boolean(
    selected &&
    (selectedLocation.kind === "pool" || selected.personType === "volunteer"),
  )
  const firstCrewWithRoom = plan.crews.find(
    (crew) => crew.members.length < crew.capacity,
  )

  useEffect(() => {
    if (!selectedDestinationOpen) return
    if (firstCrewWithRoom) {
      const crewCard = document.getElementById(
        `crew-card-${firstCrewWithRoom.id}`,
      )
      if (typeof crewCard?.scrollIntoView === "function") {
        crewCard.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }
    personDestinationRef.current?.focus()
  }, [firstCrewWithRoom, selectedDestinationOpen])

  useEffect(() => {
    if (!selectedCrewSlot) {
      const focusTarget = returnFocusToCrewSlot.current
      returnFocusToCrewSlot.current = null
      if (focusTarget) {
        document.getElementById(focusTarget)?.focus({ preventScroll: true })
      }
      return
    }
    if (typeof studentPoolRef.current?.scrollIntoView === "function") {
      studentPoolRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
    studentPoolRef.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus({ preventScroll: true })
  }, [selectedCrewSlot])

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

  const header = (
    <CrewHeader
      boatsDisabled={busy || plan.crews.length === 0}
      onBack={onHome}
      onBoats={() => {
        setBoatMode(true)
        setDestinationCrewId(null)
        setSelected(null)
      }}
      onRead={() => setReadMode(true)}
      sessionId={sessionId}
      readDisabled={busy || plan.crews.length === 0}
    />
  )

  return (
    <>
      {readMode && (
        <AnnouncementView
          imageExportState={imageExportState}
          lines={announcementLines}
          onDownloadImage={downloadAnnouncementImage}
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
      {boatMode ? (
        <div className="min-w-0">
          {header}
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Barche in uscita</h2>
            </div>
            <button
              aria-label="Torna agli equipaggi"
              className="grid size-11 shrink-0 place-items-center rounded-xl border bg-card text-xs font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/40 min-[390px]:flex min-[390px]:w-auto min-[390px]:px-3"
              onClick={() => {
                setBoatMode(false)
                setSelectedCrewForBoat(null)
              }}
              type="button"
            >
              <ChevronLeft
                aria-hidden="true"
                className="size-4 min-[390px]:hidden"
              />
              <span className="hidden min-[390px]:inline">Equipaggi</span>
            </button>
          </div>
          <section
            aria-label="Barche della sessione"
            className="sticky top-0 z-20 -mx-[20px] border-y bg-background/95 px-[20px] py-2 shadow-[0_6px_16px_rgb(6_59_82/0.08)] backdrop-blur max-[350px]:-mx-[12px] max-[350px]:px-[12px]"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-sm font-black">
                Barche nell’uscita
                <span className="ml-1 text-xs font-semibold text-muted-foreground">
                  · {sessionLabel(sessionId)}
                </span>
              </p>
              <span className="text-xs font-semibold text-muted-foreground">
                {plan.selectedBoatIds.length}/{boats.length} selezionate
              </span>
            </div>
            <div
              aria-label="Legenda stato barche"
              className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.68rem] font-bold"
              role="list"
            >
              <span className="flex items-center gap-1" role="listitem">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full bg-[#8b9aa0]"
                />
                Non disponibile
              </span>
              <span className="flex items-center gap-1" role="listitem">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full bg-[#2f80ed]"
                />
                Disponibile
              </span>
              <span className="flex items-center gap-1" role="listitem">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full bg-[#2f8f46]"
                />
                Assegnata
              </span>
            </div>
            <div
              aria-label="Pagina barche"
              className="mt-2 grid grid-cols-4 gap-1.5"
              data-testid="boat-page-grid"
              onClickCapture={suppressClickAfterBoatSwipe}
              onPointerCancel={cancelBoatSwipe}
              onPointerDown={startBoatSwipe}
              onPointerUp={finishBoatSwipe}
              role="group"
              style={{ touchAction: "pan-y" }}
            >
              {visibleBoats.map((boat) => {
                const selectedBoat = plan.selectedBoatIds.includes(boat.id)
                const assignedCrewIndex = plan.crews.findIndex(
                  ({ destination, boatId }) =>
                    destination === "boat" && boatId === boat.id,
                )
                const unavailable = boat.availability === "unavailable"
                const hasFault = unresolvedFaultBoatIds.has(boat.id)
                const state = unavailable
                  ? "unavailable"
                  : assignedCrewIndex >= 0
                    ? "assigned"
                    : "available"
                const stateLabel = unavailable
                  ? "Non disponibile"
                  : assignedCrewIndex >= 0
                    ? `Assegnata all’equipaggio ${assignedCrewIndex + 1}`
                    : selectedBoat
                      ? "Disponibile non assegnata, in uscita"
                      : "Disponibile non assegnata, non in uscita"
                return (
                  <button
                    aria-label={`${boat.type} ${boat.number} · ${stateLabel}${hasFault ? ", avaria da controllare" : ""}`}
                    aria-pressed={selectedBoat}
                    className={`relative flex min-h-[3.75rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-0.5 text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/40 ${unavailable && assignedCrewIndex >= 0 ? "border-[#b42318] bg-[#eef1f2] text-[#5f7075]" : state === "assigned" ? "border-[#2f8f46] bg-[#e9f5eb] text-[#176b2c]" : state === "available" ? (selectedBoat ? "border-[#2f80ed] bg-[#edf5ff] text-[#1356a2]" : "border-[#79a8dd] bg-white text-[#1356a2]") : "border-[#b7c3c7] bg-[#eef1f2] text-[#5f7075]"}`}
                    disabled={
                      busy ||
                      (unavailable && !selectedBoat) ||
                      (Boolean(selectedCrewForBoat) &&
                        (unavailable || assignedCrewIndex >= 0))
                    }
                    key={boat.id}
                    onClick={() =>
                      selectedCrewForBoat
                        ? assignSelectedCrewBoat(boat)
                        : toggleBoatGoingOut(boat)
                    }
                    type="button"
                  >
                    {(hasFault || (unavailable && assignedCrewIndex >= 0)) && (
                      <span
                        aria-hidden="true"
                        className="absolute right-1 top-1 flex gap-0.5"
                      >
                        {unavailable && assignedCrewIndex >= 0 && (
                          <TriangleAlert className="size-3 text-[#b42318]" />
                        )}
                        {hasFault && (
                          <TriangleAlert className="size-3 text-[#9a6700]" />
                        )}
                      </span>
                    )}
                    <BoatMark type={boat.type} />
                    <span className="text-base font-black tabular-nums">
                      {boat.number}
                    </span>
                  </button>
                )
              })}
            </div>
            {boatPageCount > 1 && (
              // The pager holds two word labels and a counter in a
              // justify-between row. At 200% text they no longer fit across
              // 320px, and flex items do not shrink below their own content, so
              // the row pushed the whole document to 323px and the fixed
              // navigation followed it. It wraps now.
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs font-bold">
                <button
                  aria-label="Barche precedenti"
                  className="min-h-10 min-w-0 rounded-lg px-[6px] text-primary disabled:text-muted-foreground"
                  disabled={visibleBoatPage === 0}
                  onClick={() => setBoatPage((page) => Math.max(0, page - 1))}
                  type="button"
                >
                  Precedenti
                </button>
                <span aria-live="polite">
                  {visibleBoatPage + 1}/{boatPageCount}
                </span>
                <button
                  aria-label="Altre barche"
                  className="min-h-10 min-w-0 rounded-lg px-[6px] text-primary disabled:text-muted-foreground"
                  disabled={visibleBoatPage === boatPageCount - 1}
                  onClick={() =>
                    setBoatPage((page) => Math.min(boatPageCount - 1, page + 1))
                  }
                  type="button"
                >
                  Altre
                </button>
              </div>
            )}
            {boats.length === 0 && (
              <p className="mt-3 rounded-xl bg-muted px-3 py-3 text-sm text-muted-foreground">
                Nessuna barca configurata. Puoi usare Mezzi o lasciare gli
                equipaggi senza barca.
              </p>
            )}
          </section>
          <p className="mt-4 text-sm font-semibold text-muted-foreground">
            Seleziona un equipaggio senza barca, poi una barca blu.
          </p>
          {selectedCrewForBoat && (
            <p
              className="mt-2 rounded-xl bg-[#edf5ff] px-3 py-2 text-sm font-bold text-[#1356a2]"
              role="status"
            >
              Equipaggio{" "}
              {plan.crews.findIndex(({ id }) => id === selectedCrewForBoat) + 1}{" "}
              selezionato · scegli una barca blu.
            </p>
          )}
          <section
            aria-label="Equipaggi per assegnazione barche"
            className="mt-4 grid gap-2"
          >
            {plan.crews.map((crew, crewIndex) => {
              const boat = crew.boatId
                ? (boatById.get(crew.boatId) ?? null)
                : null
              const destination = crew.destination
              const selectedCrew = selectedCrewForBoat === crew.id
              return (
                <button
                  aria-label={`Equipaggio ${crewIndex + 1}, ${boat ? `${boat.type} ${boat.number}` : destination === "mezzi" ? "Mezzi" : "senza barca"}`}
                  aria-pressed={selectedCrew}
                  className={`grid min-h-16 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border bg-card px-3 py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40 ${selectedCrew ? "border-primary bg-primary/5" : ""}`}
                  disabled={busy}
                  key={crew.id}
                  onClick={() => selectCrewForBoat(crew.id)}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-black">
                      Equipaggio {crewIndex + 1}
                    </span>
                    <span className="block truncate text-sm font-semibold text-muted-foreground">
                      {crew.members.map(personLabel).join(" · ") ||
                        "Posti da completare"}
                    </span>
                  </span>
                  <BoatSummary boat={boat} destination={destination} large />
                </button>
              )
            })}
          </section>
        </div>
      ) : (
        <div className="flex min-h-[calc(100dvh-7rem)] flex-col">
          {header}
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
            <p
              className="mt-3 text-sm font-semibold text-[#a2381b]"
              role="alert"
            >
              Modifica non valida o non salvata. Riprova.
            </p>
          )}

          {plan.crews.length === 0 ? (
            <section className="mt-5 min-h-0 overflow-y-auto rounded-3xl border bg-card p-5">
              <span className="grid size-12 place-items-center rounded-2xl bg-muted text-primary">
                <UsersRound aria-hidden="true" className="size-6" />
              </span>
              <h2 className="mt-4 text-xl font-black">Prepara la sessione</h2>
              <label className="mt-5 grid gap-2 text-sm font-bold">
                <span>Numero di equipaggi</span>
                <Input
                  inputMode="numeric"
                  max={maxCrewCount}
                  min={0}
                  onChange={(event) => setCrewCountDraft(event.target.value)}
                  step={1}
                  type="number"
                  value={crewCountDraft}
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
            <>
              <div
                aria-label="Composizione equipaggi"
                className={`mt-3 grid min-h-0 flex-1 content-start gap-4 overflow-y-auto pr-1 ${(selected && (selectedLocation.kind === "pool" || selected.personType === "volunteer")) || destinationCrewId ? "pb-[18rem]" : ""}`}
                role="region"
              >
                <section
                  className={`rounded-2xl px-4 py-3 text-sm font-bold ${completeness.complete ? "bg-[#e9f5eb] text-[#176b2c]" : "bg-[#fff1ed] text-[#9d2f18]"}`}
                >
                  <span>
                    Allievi sistemati {completeness.accounted}/
                    {completeness.total}
                  </span>
                  {!completeness.complete && (
                    <span className="ml-2 text-xs font-semibold">
                      · {completeness.missingStudentIds.length} disponibili
                    </span>
                  )}
                </section>

                {d1MorningDutyNotLand.length > 0 && (
                  <section
                    className="rounded-2xl bg-[#fee4e2] px-4 py-3 text-sm text-[#8f1d15]"
                    role="alert"
                  >
                    <h2 className="font-black">
                      Comandata D1 da portare A terra
                    </h2>
                    <p className="mt-1 text-xs font-semibold leading-5">
                      {d1MorningDutyNotLand
                        .map((student) =>
                          getStudentDisplayName(student, students),
                        )
                        .join(" · ")}{" "}
                      è in comandata questa mattina e non è A terra.
                    </p>
                  </section>
                )}

                {(studentPool.length > 0 || selectedCrewSlot) && (
                  <section
                    onKeyDown={handleStudentPoolKeyDown}
                    ref={studentPoolRef}
                  >
                    <h2 className="text-sm font-black tracking-wide uppercase">
                      Disponibili · {studentPool.length}
                    </h2>
                    {selectedCrewSlot && selectedCrewSlotIndex >= 0 && (
                      <p
                        className="mt-2 rounded-xl bg-primary/5 px-3 py-2 text-sm font-semibold text-primary"
                        role="status"
                      >
                        Posto libero {selectedCrewSlot.slotIndex + 1} equipaggio{" "}
                        {selectedCrewSlotIndex + 1} selezionato ·{" "}
                        {studentPool.length > 0
                          ? "tocca un allievo disponibile per inserirlo. "
                          : "nessun allievo disponibile. "}
                        Toccalo di nuovo per annullare.
                      </p>
                    )}
                    <div
                      aria-label="Allievi disponibili"
                      className="mt-2 grid grid-cols-2 gap-2"
                      id="crew-available-students"
                      role="region"
                    >
                      {studentPool.map((student) => {
                        const person: CrewPersonRef = {
                          personId: student.id,
                          personType: "student",
                        }
                        const markers = personMarkers(person)
                        return (
                          <PersonButton
                            ariaLabel={personLabel(person)}
                            compact
                            detail={personDetail(person)}
                            disabled={busy}
                            key={student.id}
                            label={personLabel(person)}
                            markers={markers.nodes}
                            markerDescription={markers.description}
                            onLongPress={() => onOpenStudent(student.id)}
                            onTap={() => tapPerson(person)}
                            person={person}
                            selected={samePerson(selected, person)}
                          />
                        )
                      })}
                    </div>
                  </section>
                )}

                <button
                  aria-label="Gestisci barche in uscita"
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border bg-card px-3 text-left text-sm font-bold text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                  onClick={() => setBoatMode(true)}
                  type="button"
                >
                  <span>Barche nell’uscita</span>
                  <span>
                    {plan.selectedBoatIds.length}/{boats.length}
                  </span>
                </button>

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
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button
                        className="h-auto min-h-14 min-w-0 px-2 text-xs"
                        disabled={busy}
                        onClick={() =>
                          chooseDestination({ kind: "unassigned" })
                        }
                        variant="secondary"
                      >
                        Non assegnato
                      </Button>
                      {sortedBoats
                        .filter(({ id }) => plan.selectedBoatIds.includes(id))
                        .map((boat) => {
                          const boatId = boat.id
                          const usedByAnotherCrew = plan.crews.some(
                            (crew) =>
                              crew.id !== destinationCrewId &&
                              crew.boatId === boatId,
                          )
                          const unavailableForThisCrew =
                            boat.availability === "unavailable" &&
                            plan.crews.find(
                              ({ id }) => id === destinationCrewId,
                            )?.boatId !== boatId
                          return (
                            <Button
                              aria-label={`Assegna equipaggio ${destinationCrewIndex + 1} a ${boatLabel(boatId)}`}
                              className={`h-auto min-h-14 min-w-0 px-2 text-xs ${boat.availability === "unavailable" ? "border-[#b42318] bg-[#fee4e2] text-[#8f1d15]" : usedByAnotherCrew ? "bg-muted text-muted-foreground" : "border-[#2f80ed] bg-[#edf5ff] text-[#1356a2]"}`}
                              disabled={
                                busy ||
                                usedByAnotherCrew ||
                                unavailableForThisCrew
                              }
                              key={boatId}
                              onClick={() =>
                                chooseDestination({ kind: "boat", boatId })
                              }
                              variant="secondary"
                            >
                              <span className="flex min-w-0 items-center justify-center gap-1">
                                <BoatMark type={boat.type} />
                                <span className="tabular-nums">
                                  {boat.number}
                                </span>
                              </span>
                            </Button>
                          )
                        })}
                      <Button
                        className="h-auto min-h-14 min-w-0 px-2 text-xs"
                        disabled={busy}
                        onClick={() => chooseDestination({ kind: "mezzi" })}
                        variant="secondary"
                      >
                        Mezzi
                      </Button>
                    </div>
                  </section>
                )}

                {selected &&
                  (selectedLocation.kind === "pool" ||
                    selected.personType === "volunteer") && (
                    <section
                      aria-label="Destinazione persona selezionata"
                      className="fixed bottom-24 left-1/2 z-30 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-primary/30 bg-card/95 p-3 shadow-xl backdrop-blur"
                      ref={personDestinationRef}
                      tabIndex={-1}
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
                            onClick={() =>
                              void commit(removePerson(plan, selected))
                            }
                            variant="secondary"
                          >
                            <CircleMinus
                              aria-hidden="true"
                              className="size-4"
                            />
                            Rimuovi
                          </Button>
                        )}
                      </div>
                      <div className="mt-2 grid max-h-[24vh] grid-cols-2 gap-2 overflow-y-auto">
                        {plan.crews
                          .filter((crew) => crew.members.length < crew.capacity)
                          .map((crew) => {
                            const crewIndex = plan.crews.findIndex(
                              ({ id }) => id === crew.id,
                            )
                            const currentCrew =
                              selectedLocation.kind === "crew" &&
                              selectedLocation.crewId === crew.id
                            const preview = Array.from(
                              { length: crew.capacity },
                              (_, index) => {
                                const member = getCrewMemberAtPosition(
                                  crew,
                                  index,
                                )
                                return member ? personLabel(member) : "-"
                              },
                            ).join(" · ")
                            return (
                              <Button
                                aria-label={`Sposta ${personLabel(selected)} in equipaggio ${crewIndex + 1}`}
                                aria-description={preview}
                                className="h-auto min-h-14 min-w-0 justify-start px-2 py-1 text-left text-xs"
                                disabled={busy || currentCrew}
                                key={crew.id}
                                onClick={() => placeInCrew(crew.id)}
                                variant="secondary"
                              >
                                <span className="min-w-0">
                                  <span className="block font-black">
                                    Eq. {crewIndex + 1}
                                  </span>
                                  <span className="block break-words text-[0.65rem] leading-4 text-muted-foreground">
                                    {preview}
                                  </span>
                                </span>
                              </Button>
                            )
                          })}
                        {plan.crews.every(
                          (crew) => crew.members.length >= crew.capacity,
                        ) && (
                          <p
                            className="col-span-2 rounded-xl bg-muted px-3 py-2 text-sm font-bold text-muted-foreground"
                            role="status"
                          >
                            Equipaggi pieni
                          </p>
                        )}
                        <Button
                          className="h-11 min-w-0 px-2 text-xs"
                          disabled={busy || plan.crews.length >= maxCrewCount}
                          onClick={() => createCrewForSelected("unassigned")}
                          variant="secondary"
                        >
                          Nuovo equipaggio
                        </Button>
                        {selected.personType === "student" && (
                          <Button
                            aria-label={`Sposta ${personLabel(selected)} A terra`}
                            className="h-11 min-w-0 px-1 text-xs"
                            disabled={busy || selectedLocation.kind === "land"}
                            onClick={placeOnLand}
                            variant="secondary"
                          >
                            A terra
                          </Button>
                        )}
                        <Button
                          className="h-11 min-w-0 px-2 text-xs"
                          disabled={busy || plan.crews.length >= maxCrewCount}
                          onClick={() => createCrewForSelected("mezzi")}
                          variant="secondary"
                        >
                          Mezzi
                        </Button>
                      </div>
                    </section>
                  )}

                <section
                  aria-label="Equipaggi della sessione"
                  className="grid gap-3"
                >
                  {plan.crews.map((crew, crewIndex) => (
                    <article
                      className="rounded-3xl border bg-card p-3 max-[350px]:px-[12px]"
                      id={`crew-card-${crew.id}`}
                      key={crew.id}
                    >
                      {/* Number, boat and headcount share the header row: the
                          destination used to own a line of its own under it,
                          which cost every crew card 3.5rem of the screen. */}
                      <div className="mb-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <h2 className="shrink-0 text-sm font-black">
                          Equipaggio {crewIndex + 1}
                        </h2>
                        <button
                          aria-label={`Destinazione equipaggio ${crewIndex + 1}: ${destinationLabel(crew.id)}`}
                          className={`flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border px-2 py-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40 ${crew.destination === "boat" && boatById.get(crew.boatId ?? "")?.availability === "unavailable" ? "border-[#b42318] bg-[#fee4e2] text-[#8f1d15]" : "bg-muted/50"}`}
                          disabled={busy}
                          onClick={() => {
                            setSelected(null)
                            setDestinationCrewId((current) =>
                              current === crew.id ? null : crew.id,
                            )
                          }}
                          type="button"
                        >
                          <BoatSummary
                            boat={
                              crew.boatId
                                ? (boatById.get(crew.boatId) ?? null)
                                : null
                            }
                            destination={crew.destination}
                            inferredType={
                              selectedBoatTypes.length === 1
                                ? selectedBoatTypes[0]
                                : null
                            }
                          />
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          {(() => {
                            const warnings = warningsByCrew.get(crew.id) ?? []
                            const crewWarnings = warnings.filter(
                              (warning) => warning.kind !== "boat-unavailable",
                            )
                            const boatWarnings = warnings.filter(
                              (warning) => warning.kind === "boat-unavailable",
                            )
                            const faultsForCrew =
                              crew.destination === "boat" && crew.boatId
                                ? (openFaultsByBoat.get(crew.boatId) ?? [])
                                : []
                            const hasRed =
                              getWorstCrewWarningSeverity(crewWarnings) ===
                                "red" || boatWarnings.length > 0
                            const severity = hasRed
                              ? "red"
                              : crewWarnings.length > 0 ||
                                  faultsForCrew.length > 0
                                ? "yellow"
                                : null
                            const count =
                              crewWarnings.length +
                              boatWarnings.length +
                              faultsForCrew.length
                            if (!severity) return null
                            return (
                              <button
                                aria-controls={`crew-warning-detail-${crew.id}`}
                                aria-expanded={warningCrewId === crew.id}
                                aria-label={`Avvisi equipaggio ${crewIndex + 1}: ${severity === "red" ? "rosso" : "giallo"}, ${count}`}
                                className={`grid size-11 shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40 ${severity === "red" ? "bg-[#fee4e2] text-[#b42318]" : "bg-[#fff3cd] text-[#8a5a00]"}`}
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
                          {standardCrewSize !== null ? (
                            <span className="text-xs font-bold text-muted-foreground">
                              {crew.members.length}/{crew.capacity}
                            </span>
                          ) : (
                            <div
                              aria-label={`Capienza equipaggio ${crewIndex + 1}`}
                              className="flex items-center gap-1"
                              role="group"
                            >
                              <button
                                aria-label={`Riduci capienza equipaggio ${crewIndex + 1}`}
                                className="grid size-10 place-items-center rounded-lg text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:text-muted-foreground"
                                disabled={
                                  busy ||
                                  crew.capacity <=
                                    Math.max(1, crew.members.length) ||
                                  !getOpenCrewSlotIndexes(crew).includes(
                                    crew.capacity - 1,
                                  )
                                }
                                onClick={() => adjustCrewCapacity(crew.id, -1)}
                                type="button"
                              >
                                <CircleMinus
                                  aria-hidden="true"
                                  className="size-4"
                                />
                              </button>
                              <span className="text-xs font-bold text-muted-foreground">
                                {crew.members.length}/{crew.capacity}
                              </span>
                              <button
                                aria-label={`Aumenta capienza equipaggio ${crewIndex + 1}`}
                                className="grid size-10 place-items-center rounded-lg text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:text-muted-foreground"
                                disabled={
                                  busy ||
                                  crew.capacity >=
                                    Math.max(
                                      MAX_FLEXIBLE_CREW_CAPACITY,
                                      crew.members.length,
                                    )
                                }
                                onClick={() => adjustCrewCapacity(crew.id, 1)}
                                type="button"
                              >
                                <Plus aria-hidden="true" className="size-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {warningCrewId === crew.id && (
                        <section
                          aria-label={`Dettaglio avvisi equipaggio ${crewIndex + 1}`}
                          className="mb-3 grid gap-2 rounded-2xl bg-muted p-3"
                          id={`crew-warning-detail-${crew.id}`}
                        >
                          {(() => {
                            const warnings = warningsByCrew.get(crew.id) ?? []
                            const crewWarnings = warnings.filter(
                              (warning) => warning.kind !== "boat-unavailable",
                            )
                            const boatWarnings = warnings.filter(
                              (warning) => warning.kind === "boat-unavailable",
                            )
                            const faultsForCrew =
                              crew.destination === "boat" && crew.boatId
                                ? (openFaultsByBoat.get(crew.boatId) ?? [])
                                : []
                            return (
                              <>
                                {crewWarnings.length > 0 && (
                                  <div className="grid gap-2">
                                    <h3 className="text-xs font-black tracking-wide text-muted-foreground uppercase">
                                      Composizione equipaggio
                                    </h3>
                                    {crewWarnings.map((warning) => (
                                      <CrewWarningDetail
                                        key={warning.key}
                                        personLabel={personLabel}
                                        warning={warning}
                                      />
                                    ))}
                                  </div>
                                )}
                                {(boatWarnings.length > 0 ||
                                  faultsForCrew.length > 0) && (
                                  <div className="grid gap-2">
                                    <h3 className="text-xs font-black tracking-wide text-muted-foreground uppercase">
                                      Barca
                                    </h3>
                                    {boatWarnings.map((warning) => (
                                      <CrewWarningDetail
                                        key={warning.key}
                                        personLabel={personLabel}
                                        warning={warning}
                                      />
                                    ))}
                                    {faultsForCrew.map((fault) => (
                                      <BoatFaultWarningDetail
                                        boatLabel={`${fault.boatType} ${fault.boatNumber}`}
                                        fault={fault}
                                        key={fault.id}
                                      />
                                    ))}
                                  </div>
                                )}
                              </>
                            )
                          })()}
                        </section>
                      )}
                      {/* The slots and, on an empty crew only, the control
                          that removes it: the number of crews is chosen before
                          composing and the outing changes shape afterwards. */}
                      <div className="flex min-w-0 items-stretch gap-2">
                        <div
                          className={`grid min-w-0 flex-1 ${crewDisplayColumns === 2 ? "grid-cols-2 gap-2" : "grid-cols-3 gap-1"}`}
                        >
                          {Array.from(
                            { length: crew.capacity },
                            (_, slotIndex) => {
                              const person = getCrewMemberAtPosition(
                                crew,
                                slotIndex,
                              )
                              if (!person) {
                                const isSelectedSlot =
                                  selectedCrewSlot?.crewId === crew.id &&
                                  selectedCrewSlot.slotIndex === slotIndex
                                return (
                                  <button
                                    id={
                                      "crew-slot-" + crew.id + "-" + slotIndex
                                    }
                                    aria-controls={
                                      isSelectedSlot
                                        ? "crew-available-students"
                                        : undefined
                                    }
                                    aria-label={
                                      selected
                                        ? "Inserisci " +
                                          personLabel(selected) +
                                          " nel posto libero " +
                                          (slotIndex + 1) +
                                          " equipaggio " +
                                          (crewIndex + 1)
                                        : "Posto libero " +
                                          (slotIndex + 1) +
                                          " equipaggio " +
                                          (crewIndex + 1)
                                    }
                                    aria-pressed={isSelectedSlot}
                                    className={
                                      "min-h-12 min-w-0 w-full break-words rounded-2xl border border-dashed px-1 text-center text-xs font-bold leading-4 text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60 " +
                                      (isSelectedSlot
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "bg-muted/40 enabled:border-primary/50 enabled:text-primary")
                                    }
                                    disabled={busy}
                                    key={slotIndex}
                                    onKeyDown={(event) => {
                                      if (
                                        event.key === "Escape" &&
                                        isSelectedSlot
                                      ) {
                                        event.preventDefault()
                                        cancelCrewSlotSelection()
                                      }
                                    }}
                                    onClick={() =>
                                      chooseCrewSlot(crew.id, slotIndex)
                                    }
                                    type="button"
                                  >
                                    {selected
                                      ? "Inserisci"
                                      : isSelectedSlot
                                        ? "Selezionato"
                                        : "Posto libero"}
                                  </button>
                                )
                              }
                              return (
                                <div
                                  className="relative min-w-0"
                                  key={`${person.personType}:${person.personId}`}
                                >
                                  <PersonButton
                                    ariaLabel={
                                      personLabel(person) +
                                      ", equipaggio " +
                                      (crewIndex + 1)
                                    }
                                    compact
                                    centered
                                    className="!justify-center !px-[40px] !text-center"
                                    dense
                                    detail={personDetail(person)}
                                    disabled={busy}
                                    label={personLabel(person)}
                                    markers={personMarkers(person).nodes}
                                    markerDescription={
                                      personMarkers(person).description
                                    }
                                    onDoubleTap={() =>
                                      void commit(removePerson(plan, person))
                                    }
                                    role={
                                      person.personType === "volunteer"
                                        ? volunteerById.get(person.personId)
                                            ?.role
                                        : undefined
                                    }
                                    onLongPress={
                                      person.personType === "student"
                                        ? () => onOpenStudent(person.personId)
                                        : undefined
                                    }
                                    onTap={() => tapPerson(person)}
                                    person={person}
                                    selected={samePerson(selected, person)}
                                    truncateLabel
                                  />
                                  <button
                                    aria-label={
                                      "Rendi disponibile " + personLabel(person)
                                    }
                                    className="absolute right-0 top-0 grid size-[44px] place-items-center rounded-xl bg-transparent text-[#b42318] outline-none hover:bg-[#fff1ed] focus-visible:ring-3 focus-visible:ring-ring/40"
                                    disabled={busy}
                                    onClick={() =>
                                      void commit(removePerson(plan, person))
                                    }
                                    title="Rendi disponibile"
                                    type="button"
                                  >
                                    <CircleMinus
                                      aria-hidden="true"
                                      className="size-[18px]"
                                    />
                                  </button>
                                </div>
                              )
                            },
                          )}
                        </div>
                        {crew.members.length === 0 && (
                          <button
                            aria-label={`Elimina equipaggio ${crewIndex + 1}`}
                            className="grid w-11 shrink-0 place-items-center rounded-2xl border border-dashed border-[#d92d20]/45 text-[#b42318] outline-none hover:bg-[#fff1ed] focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60"
                            disabled={busy}
                            onClick={() =>
                              void commit(removeEmptyCrew(plan, crew.id))
                            }
                            title="Elimina equipaggio"
                            type="button"
                          >
                            <Trash2 aria-hidden="true" className="size-4" />
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                  {/* Symmetry with the control above: a crew removed by
                      mistake can be put back without leaving the workspace. */}
                  <button
                    className="min-h-11 rounded-2xl border border-dashed border-primary/50 px-3 text-sm font-bold text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50"
                    disabled={busy || plan.crews.length >= maxCrewCount}
                    onClick={() =>
                      void commit(
                        addCrew(
                          plan,
                          sessionId,
                          () => crypto.randomUUID(),
                          getInitialCrewCapacity(course.family, course.level),
                        ),
                      )
                    }
                    type="button"
                  >
                    <Plus aria-hidden="true" className="mr-1 inline size-4" />
                    Aggiungi equipaggio
                  </button>
                </section>

                <section
                  className="rounded-3xl border bg-card p-4"
                  id="crew-land-section"
                >
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
                        <div
                          className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-1"
                          key={studentId}
                        >
                          <PersonButton
                            ariaLabel={`${personLabel(person)}, A terra`}
                            detail="A terra · conta nella completezza"
                            disabled={busy}
                            label={personLabel(person)}
                            markers={personMarkers(person).nodes}
                            markerDescription={
                              personMarkers(person).description
                            }
                            onDoubleTap={() =>
                              void commit(removePerson(plan, person))
                            }
                            onLongPress={() => onOpenStudent(studentId)}
                            onTap={() => tapPerson(person)}
                            person={person}
                            selected={samePerson(selected, person)}
                          />
                          <button
                            aria-label={`Rendi disponibile ${personLabel(person)}`}
                            className="grid min-h-14 min-w-11 place-items-center rounded-xl text-[#b42318] outline-none hover:bg-[#fff1ed] focus-visible:ring-3 focus-visible:ring-ring/40"
                            disabled={busy}
                            onClick={() =>
                              void commit(removePerson(plan, person))
                            }
                            title="Rendi disponibile"
                            type="button"
                          >
                            <CircleMinus
                              aria-hidden="true"
                              className="size-4"
                            />
                          </button>
                        </div>
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

                <section id="crew-volunteer-section">
                  <h2 className="text-sm font-black tracking-wide uppercase">
                    Volontari disponibili · {volunteerPool.length}
                  </h2>
                  <div
                    aria-label="Volontari disponibili"
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
                          role={volunteer.role}
                          selected={samePerson(selected, person)}
                        />
                      )
                    })}
                    {volunteerPool.length === 0 && (
                      <p className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">
                        Nessun volontario disponibile.
                      </p>
                    )}
                  </div>
                </section>

                <p className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-xs text-muted-foreground">
                  <ShipWheel aria-hidden="true" className="size-4 shrink-0" />
                  Barche in uscita e destinazioni vengono salvate
                  automaticamente.
                </p>
              </div>
              <nav
                aria-label="Accesso rapido equipaggi"
                className="z-20 mt-2 grid shrink-0 grid-cols-3 items-center gap-1 rounded-2xl border bg-card/95 p-1.5 shadow-[0_6px_18px_rgb(6_59_82/0.12)] backdrop-blur"
              >
                <button
                  aria-controls="crew-land-section"
                  className="min-h-11 min-w-0 break-words rounded-xl px-2 text-left text-xs font-black outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                  onClick={() =>
                    document
                      .getElementById("crew-land-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }
                  type="button"
                >
                  A terra
                </button>
                <span
                  aria-live="polite"
                  className="min-w-0 break-words rounded-xl bg-[#e8f3f6] px-2 py-2 text-center text-[0.68rem] font-black text-[#164e63]"
                >
                  Collocati {completeness.accounted}/{completeness.total}
                </span>
                <button
                  aria-controls="crew-volunteer-section"
                  className="min-h-11 min-w-0 break-words rounded-xl px-2 text-right text-xs font-black outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                  onClick={() =>
                    document
                      .getElementById("crew-volunteer-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }
                  type="button"
                >
                  Volontari
                </button>
              </nav>
            </>
          )}
        </div>
      )}
    </>
  )
}
