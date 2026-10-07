import {
  ChevronLeft,
  ClipboardCheck,
  GraduationCap,
  HandHeart,
  House,
  ListChecks,
  LoaderCircle,
  Sailboat,
  Settings,
  UsersRound,
  Wrench,
} from "lucide-react"
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { Button } from "@/components/ui/button"
import { CourseIdentity } from "@/components/CourseIdentity"
import { CvcMark } from "@/components/CvcMark"
import {
  afterPendingBack,
  historyBack,
  holdBackNavigation,
  requestLeave,
} from "@/navigation/browserHistory"
import { NESTED_SCREEN_KEY_PREFIX } from "@/navigation/nestedScreen"
import {
  COURSE_FAMILIES,
  COURSE_LEVELS,
  type CourseFamily,
  type CourseLevel,
  type SessionId,
} from "@/domain/config"
import { buildCourseDetails } from "@/domain/course"
import { BoatManagement } from "@/features/boats/BoatManagement"
import { FaultManagement } from "@/features/boats/FaultManagement"
import { CrewManagement } from "@/features/crews/CrewManagement"
import {
  getCrewDisplayColumns,
  setCrewDisplayColumns,
} from "@/features/crews/crewDisplayPreference"
import { DutyManagement } from "@/features/duties/DutyManagement"
import {
  EvaluationManagement,
  type EvaluationView,
} from "@/features/evaluations/EvaluationManagement"
import { CourseErase } from "@/features/settings/CourseErase"
import { StudentManagement } from "@/features/students/StudentManagement"
import { VolunteerManagement } from "@/features/volunteers/VolunteerManagement"
import {
  getActiveCourse,
  saveActiveCourse,
  type CourseRecord,
} from "@/persistence/courses"

type AppState =
  | { status: "loading" }
  | { status: "no-course" }
  | { status: "ready"; course: CourseRecord }
  | { status: "error" }

type ShellView =
  | "faults"
  | "home"
  | "crews"
  | "students"
  | "boats"
  | "sessions"
  | "evaluations"
  | "volunteers"
  | "settings"

const SHELL_HISTORY_KEY = "__cvcHelperShell"
const STUDENT_SCREEN_HISTORY_KEY = "__cvcHelperStudentScreen"

type ShellHistoryEntry = {
  view: ShellView
  depth: number
  studentToOpen?: string
  studentReturnView?: ShellView
  /** The course the entry belongs to; entries of an erased course are ignored. */
  courseId?: string
}

function isShellView(value: unknown): value is ShellView {
  return (
    value === "faults" ||
    value === "home" ||
    value === "crews" ||
    value === "students" ||
    value === "boats" ||
    value === "sessions" ||
    value === "evaluations" ||
    value === "volunteers" ||
    value === "settings"
  )
}

function readShellHistoryEntry(state: unknown): ShellHistoryEntry | null {
  if (!state || typeof state !== "object") return null
  const entry = (state as Record<string, unknown>)[SHELL_HISTORY_KEY]
  if (!entry || typeof entry !== "object") return null
  const candidate = entry as Partial<ShellHistoryEntry>
  if (!isShellView(candidate.view)) return null
  return {
    view: candidate.view,
    depth:
      typeof candidate.depth === "number" &&
      Number.isInteger(candidate.depth) &&
      candidate.depth >= 0
        ? candidate.depth
        : 0,
    ...(typeof candidate.studentToOpen === "string"
      ? { studentToOpen: candidate.studentToOpen }
      : {}),
    ...(isShellView(candidate.studentReturnView)
      ? { studentReturnView: candidate.studentReturnView }
      : {}),
    ...(typeof candidate.courseId === "string"
      ? { courseId: candidate.courseId }
      : {}),
  }
}

/**
 * After a course is erased and a new one created, the browser history still
 * holds the old course's screens; those entries open Home instead.
 */
function readCourseHistoryEntry(state: unknown, courseId: string) {
  const entry = readShellHistoryEntry(state)
  return entry?.courseId && entry.courseId !== courseId ? null : entry
}

function pushShellHistoryEntry(entry: ShellHistoryEntry) {
  const current = window.history.state
  const state =
    current && typeof current === "object"
      ? (current as Record<string, unknown>)
      : {}
  const nextState: Record<string, unknown> = {
    ...state,
    [SHELL_HISTORY_KEY]: entry,
  }
  delete nextState[STUDENT_SCREEN_HISTORY_KEY]
  for (const key of Object.keys(nextState)) {
    if (key.startsWith(NESTED_SCREEN_KEY_PREFIX)) delete nextState[key]
  }
  window.history.pushState(nextState, "", window.location.href)
}

const HOME_CARDS = [
  { id: "students", label: "Allievi", icon: GraduationCap },
  { id: "boats", label: "Barche", icon: Sailboat },
  {
    id: "sessions",
    label: "Comandate",
    icon: ClipboardCheck,
  },
  { id: "crews", label: "Equipaggi", icon: UsersRound },
  {
    id: "evaluations",
    label: "Valutazioni",
    icon: ListChecks,
  },
  { id: "volunteers", label: "Volontari", icon: HandHeart },
] as const

function formatDate(date: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`))
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div aria-label="CVC Helper" className="flex items-center">
      <CvcMark compact={compact} />
    </div>
  )
}

function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="text-center text-primary" role="status">
        <LoaderCircle
          aria-hidden="true"
          className="mx-auto size-8 animate-spin"
        />
        <p className="mt-3 text-sm font-semibold">Apertura del corso…</p>
      </div>
    </main>
  )
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-8">
      <Brand />
      <section className="mt-8 rounded-3xl border bg-card p-6 shadow-sm">
        <p className="text-xs font-bold tracking-[0.16em] text-[#b04423] uppercase">
          Archivio non disponibile
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">
          Non riesco ad aprire i dati locali
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Nessun dato è stato cancellato. Riprova ad aprire l’archivio su questo
          dispositivo.
        </p>
        <Button className="mt-6 w-full" onClick={onRetry} size="lg">
          Riprova
        </Button>
      </section>
    </main>
  )
}

/**
 * A screen that throws while rendering would otherwise blank the whole app.
 * Stored data is untouched by a render error, so the fallback says so and
 * reopens Home rather than the screen that failed.
 */
export class ScreenErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-8">
        <Brand />
        <section
          className="mt-8 rounded-3xl border bg-card p-6 shadow-sm"
          role="alert"
        >
          <h1 className="text-2xl font-black tracking-tight">
            Questa schermata non si è aperta
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Nessun dato è stato cancellato. Riapri l’app dalla Home.
          </p>
          <Button
            className="mt-6 w-full"
            onClick={() => {
              window.history.replaceState(null, "", window.location.href)
              window.location.reload()
            }}
            size="lg"
          >
            Torna alla Home
          </Button>
        </section>
      </main>
    )
  }
}

function CourseCreation({
  onCreated,
}: {
  onCreated: (course: CourseRecord) => void
}) {
  const [family, setFamily] = useState<CourseFamily | null>(null)
  const [level, setLevel] = useState<CourseLevel | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(false)
  const today = useMemo(() => new Date(), [])
  const details = useMemo(
    () => (family && level ? buildCourseDetails(family, level, today) : null),
    [family, level, today],
  )

  async function createCourse() {
    if (!details) return
    setSubmitting(true)
    setError(false)
    try {
      onCreated(await saveActiveCourse(details))
    } catch {
      setError(true)
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pt-7 pb-8 sm:pt-10">
      <Brand />

      <section className="mt-8 rounded-3xl border bg-card p-5 shadow-[0_18px_50px_rgb(6_59_82/0.08)] sm:p-6">
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          Crea il corso
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Scegli famiglia e livello. Settimana, anno e date vengono calcolati
          automaticamente.
        </p>

        <fieldset className="mt-7">
          <legend className="text-sm font-bold">Famiglia</legend>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {COURSE_FAMILIES.map((option) => (
              <Button
                aria-pressed={family === option}
                className="h-14 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                key={option}
                onClick={() => setFamily(option)}
                type="button"
                variant="secondary"
              >
                {option}
              </Button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="text-sm font-bold">Livello</legend>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {COURSE_LEVELS.map((option) => (
              <Button
                aria-label={`Livello ${option}`}
                aria-pressed={level === option}
                className="h-14 min-w-0 px-0 text-base aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                key={option}
                onClick={() => setLevel(option)}
                type="button"
                variant="secondary"
              >
                {option}
              </Button>
            ))}
          </div>
        </fieldset>

        <div aria-live="polite" className="course-preview mt-7 min-h-24">
          {details ? (
            <div>
              <p className="text-sm font-semibold text-muted-foreground">
                Il tuo corso
              </p>
              <CourseIdentity {...details} size="compact" />
              <p className="mt-2 text-sm text-muted-foreground">
                {formatDate(details.startDate)} — {formatDate(details.endDate)}
              </p>
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              Seleziona famiglia e livello per vedere il codice del corso.
            </p>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm font-semibold text-[#a2381b]" role="alert">
            Il corso non è stato salvato. Riprova.
          </p>
        )}

        <Button
          className="mt-5 w-full"
          disabled={!details || submitting}
          onClick={createCourse}
          size="lg"
        >
          {submitting && (
            <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
          )}
          {submitting ? "Salvataggio…" : "Crea corso"}
        </Button>
      </section>

      <p className="mt-auto pt-8 text-center text-xs text-muted-foreground">
        I dati operativi restano su questo dispositivo.
      </p>
    </main>
  )
}

function Home({
  course,
  onNavigate,
}: {
  course: CourseRecord
  onNavigate: (view: ShellView) => void
}) {
  return (
    <>
      <section className="home-course" aria-label="Corso attivo">
        <h1>
          <CourseIdentity {...course} />
        </h1>
      </section>

      <section aria-label="Aree del corso">
        <div className="grid grid-cols-2 gap-2.5">
          {HOME_CARDS.map(({ id, label, icon: Icon }) => (
            <button
              className="home-card"
              key={id}
              onClick={() => onNavigate(id)}
              type="button"
            >
              <Icon aria-hidden="true" className="size-6" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  )
}

function SettingsView({
  course,
  onHome,
  onCourseErased,
}: {
  course: CourseRecord
  onHome: () => void
  onCourseErased: () => void
}) {
  const [crewDisplayColumns, setDisplayColumns] = useState<2 | 3>(() =>
    getCrewDisplayColumns(),
  )

  return (
    <section className="rounded-3xl border bg-card p-6 shadow-[0_18px_50px_rgb(6_59_82/0.08)] max-[350px]:p-[12px]">
      <Settings aria-hidden="true" className="size-8 text-primary" />
      <p className="mt-5 break-words text-xs font-bold tracking-[0.16em] text-[#b04423] uppercase [overflow-wrap:anywhere]">
        Configurazione
      </p>
      <h1 className="mt-1 break-words text-3xl font-black tracking-tight [overflow-wrap:anywhere] max-[350px]:text-2xl">
        Impostazioni
      </h1>
      <dl className="mt-6 min-w-0 divide-y rounded-2xl bg-muted px-4 max-[350px]:px-[12px]">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1 py-4">
          <dt className="shrink-0 text-sm text-muted-foreground">Corso</dt>
          <dd className="min-w-0 max-w-full text-right text-sm font-bold [&_.course-identity]:flex-wrap [&_.course-identity]:whitespace-normal">
            <CourseIdentity {...course} size="compact" />
          </dd>
        </div>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1 py-4">
          <dt className="shrink-0 text-sm text-muted-foreground">Tipo</dt>
          <dd className="min-w-0 max-w-full break-words text-right text-sm font-bold [overflow-wrap:anywhere]">
            {course.family} · livello {course.level}
          </dd>
        </div>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1 py-4">
          <dt className="shrink-0 text-sm text-muted-foreground">Archivio</dt>
          <dd className="min-w-0 max-w-full break-words text-right text-sm font-bold [overflow-wrap:anywhere]">
            Locale
          </dd>
        </div>
      </dl>
      <fieldset className="mt-6 rounded-2xl border bg-card p-4">
        <legend className="px-1 text-sm font-bold text-primary">
          Visualizzazione degli equipaggi
        </legend>
        <p className="text-sm leading-5 text-muted-foreground">
          Scegli quanti nomi degli allievi selezionati mostrare per riga.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {([2, 3] as const).map((columns) => (
            <label
              className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm font-semibold has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:text-primary focus-within:ring-3 focus-within:ring-ring"
              key={columns}
            >
              <input
                checked={crewDisplayColumns === columns}
                className="size-4 accent-primary"
                name="crew-display-columns"
                onChange={() => {
                  setDisplayColumns(columns)
                  setCrewDisplayColumns(columns)
                }}
                type="radio"
                value={columns}
              />
              <span>{columns} per riga</span>
            </label>
          ))}
        </div>
      </fieldset>
      <CourseErase course={course} onErased={onCourseErased} />
      <Button className="mt-7" onClick={onHome} variant="secondary">
        <ChevronLeft aria-hidden="true" className="size-4" />
        Torna alla Home
      </Button>
    </section>
  )
}

function AppShell({
  course,
  onCourseErased,
}: {
  course: CourseRecord
  onCourseErased: () => void
}) {
  const [initialHistoryEntry] = useState(() =>
    readCourseHistoryEntry(window.history.state, course.id),
  )
  const [view, setView] = useState<ShellView>(
    initialHistoryEntry?.view ?? "home",
  )
  const [studentToOpen, setStudentToOpen] = useState<string | null>(
    initialHistoryEntry?.studentToOpen ?? null,
  )
  const [studentReturnView, setStudentReturnView] = useState<ShellView>(
    initialHistoryEntry?.studentReturnView ?? "students",
  )
  const [crewSessionId, setCrewSessionId] = useState<SessionId>("sat-pm")
  const [evaluationSessionId, setEvaluationSessionId] = useState<SessionId>()
  const [evaluationView, setEvaluationView] =
    useState<EvaluationView>("students")
  const mainRef = useRef<HTMLElement>(null)
  const historyDepthRef = useRef(initialHistoryEntry?.depth ?? 0)
  const primaryView =
    view === "faults" || view === "home" || view === "crews" ? view : null

  useEffect(() => {
    const currentEntry = readCourseHistoryEntry(window.history.state, course.id)
    if (!currentEntry) {
      const homeEntry: ShellHistoryEntry = {
        view: "home",
        depth: 0,
        courseId: course.id,
      }
      pushShellHistoryEntry(homeEntry)
      historyDepthRef.current = homeEntry.depth
    } else {
      historyDepthRef.current = currentEntry.depth
    }

    function restoreFromHistory(event: PopStateEvent) {
      if (holdBackNavigation(event)) {
        event.stopImmediatePropagation()
        return
      }
      const entry = readCourseHistoryEntry(event.state, course.id)
      if (!entry) {
        historyDepthRef.current = 0
        setStudentToOpen(null)
        setStudentReturnView("students")
        setView("home")
        return
      }
      historyDepthRef.current = entry.depth
      setStudentToOpen(entry.studentToOpen ?? null)
      setStudentReturnView(entry.studentReturnView ?? "students")
      setView(entry.view)
    }

    window.addEventListener("popstate", restoreFromHistory)
    return () => window.removeEventListener("popstate", restoreFromHistory)
  }, [course.id])

  useEffect(() => {
    mainRef.current?.focus()
  }, [view])

  function navigate(
    next: ShellView,
    options: { studentToOpen?: string; studentReturnView?: ShellView } = {},
  ) {
    const currentEntry = readShellHistoryEntry(window.history.state)
    if (
      currentEntry?.view === next &&
      currentEntry.studentToOpen === options.studentToOpen &&
      currentEntry.studentReturnView === options.studentReturnView
    ) {
      return
    }
    // A screen with unsaved work may hold the move and complete it later.
    // After a Back already on its way, or it would undo the new entry.
    requestLeave(() => afterPendingBack(() => pushView(next, options)))
  }

  function pushView(
    next: ShellView,
    options: { studentToOpen?: string; studentReturnView?: ShellView },
  ) {
    const currentEntry = readShellHistoryEntry(window.history.state)
    const entry: ShellHistoryEntry = {
      view: next,
      depth: (currentEntry?.depth ?? historyDepthRef.current) + 1,
      courseId: course.id,
      ...(options.studentToOpen
        ? { studentToOpen: options.studentToOpen }
        : {}),
      ...(options.studentReturnView
        ? { studentReturnView: options.studentReturnView }
        : {}),
    }
    pushShellHistoryEntry(entry)
    historyDepthRef.current = entry.depth
    setStudentToOpen(entry.studentToOpen ?? null)
    setStudentReturnView(entry.studentReturnView ?? "students")
    setView(next)
  }

  function goBack(fallback: ShellView) {
    requestLeave(() => {
      const currentEntry = readShellHistoryEntry(window.history.state)
      if ((currentEntry?.depth ?? historyDepthRef.current) > 0) {
        historyBack()
        return
      }
      if (view !== fallback) navigate(fallback)
    })
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-md pb-28">
      {view === "home" && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <Brand compact />
          <Button
            aria-label="Impostazioni"
            className="settings-button shrink-0 px-0"
            onClick={() => navigate("settings")}
            variant="secondary"
          >
            <Settings aria-hidden="true" className="size-5" />
          </Button>
        </header>
      )}

      <main
        className="px-5 py-3 outline-none max-[350px]:px-[12px]"
        ref={mainRef}
        tabIndex={-1}
      >
        {view === "home" && <Home course={course} onNavigate={navigate} />}
        {view === "settings" && (
          <SettingsView
            course={course}
            onCourseErased={onCourseErased}
            onHome={() => goBack("home")}
          />
        )}
        {view === "students" && (
          <StudentManagement
            course={course}
            focusEvaluationHistory={
              studentToOpen !== null && studentReturnView === "evaluations"
            }
            initialStudentId={studentToOpen}
            key={studentToOpen ?? "student-list"}
            onHome={() => goBack("home")}
            onInitialStudentBack={() => goBack(studentReturnView)}
            onOpenEvaluationSession={(sessionId) => {
              setEvaluationSessionId(sessionId)
              setEvaluationView("students")
              navigate("evaluations")
            }}
          />
        )}
        {view === "volunteers" && (
          <VolunteerManagement
            courseId={course.id}
            onHome={() => goBack("home")}
          />
        )}
        {view === "boats" && (
          <BoatManagement course={course} onHome={() => goBack("home")} />
        )}
        {view === "faults" && (
          <FaultManagement
            courseId={course.id}
            onHome={() => goBack("home")}
            onOpenBoats={() => navigate("boats")}
          />
        )}
        {view === "sessions" && (
          <DutyManagement
            courseId={course.id}
            onHome={() => goBack("home")}
            courseStartDate={course.startDate}
          />
        )}
        {view === "crews" && (
          <CrewManagement
            course={course}
            initialSessionId={crewSessionId}
            onHome={() => goBack("home")}
            onOpenStudent={(studentId) => {
              navigate("students", {
                studentToOpen: studentId,
                studentReturnView: "crews",
              })
            }}
            onSessionChange={setCrewSessionId}
          />
        )}
        {view === "evaluations" && (
          <EvaluationManagement
            course={course}
            initialSessionId={evaluationSessionId}
            initialView={evaluationView}
            onHome={() => goBack("home")}
            onOpenStudent={(studentId) => {
              navigate("students", {
                studentToOpen: studentId,
                studentReturnView: "evaluations",
              })
            }}
            onSessionChange={setEvaluationSessionId}
            onViewChange={setEvaluationView}
          />
        )}
      </main>

      <nav
        aria-label="Navigazione principale"
        className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t bg-card/95 px-4 pt-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] shadow-[0_-10px_35px_rgb(6_59_82/0.1)] backdrop-blur max-[350px]:px-[8px]"
      >
        <div className="grid grid-cols-3 gap-2">
          <button
            aria-current={primaryView === "faults" ? "page" : undefined}
            className="app-nav-button flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl font-bold text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:bg-muted aria-[current=page]:text-primary"
            onClick={() => navigate("faults")}
            type="button"
          >
            <Wrench aria-hidden="true" className="size-5" />
            Avarie
          </button>
          <button
            aria-current={primaryView === "home" ? "page" : undefined}
            className="app-nav-button flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl font-bold text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:bg-muted aria-[current=page]:text-primary"
            onClick={() => navigate("home")}
            type="button"
          >
            <House aria-hidden="true" className="size-6" />
            Home
          </button>
          <button
            aria-current={primaryView === "crews" ? "page" : undefined}
            className="app-nav-button flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl font-bold text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring aria-[current=page]:bg-muted aria-[current=page]:text-primary"
            onClick={() => navigate("crews")}
            type="button"
          >
            <UsersRound aria-hidden="true" className="size-5" />
            Equipaggi
          </button>
        </div>
      </nav>
    </div>
  )
}

export function App() {
  const [appState, setAppState] = useState<AppState>({ status: "loading" })
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let active = true
    getActiveCourse()
      .then((course) => {
        if (!active) return
        setAppState(
          course ? { status: "ready", course } : { status: "no-course" },
        )
      })
      .catch(() => {
        if (active) setAppState({ status: "error" })
      })
    return () => {
      active = false
    }
  }, [loadAttempt])

  if (appState.status === "loading") return <LoadingScreen />
  if (appState.status === "error") {
    return (
      <ErrorScreen
        onRetry={() => {
          setAppState({ status: "loading" })
          setLoadAttempt((attempt) => attempt + 1)
        }}
      />
    )
  }
  if (appState.status === "no-course") {
    return (
      <CourseCreation
        onCreated={(course) => setAppState({ status: "ready", course })}
      />
    )
  }
  return (
    <ScreenErrorBoundary>
      <AppShell
        course={appState.course}
        onCourseErased={() => {
          // The next course starts from Home, not from the erased course's
          // screens that the browser history still remembers.
          window.history.replaceState(null, "", window.location.href)
          setAppState({ status: "no-course" })
        }}
      />
    </ScreenErrorBoundary>
  )
}
