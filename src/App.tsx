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
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { CourseIdentity } from "@/components/CourseIdentity"
import { CvcMark } from "@/components/CvcMark"
import { closeActiveDialogOnBack } from "@/navigation/browserHistory"
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
import { DutyManagement } from "@/features/duties/DutyManagement"
import {
  EvaluationManagement,
  type EvaluationView,
} from "@/features/evaluations/EvaluationManagement"
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
  }
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
  window.history.pushState(nextState, "", window.location.href)
}

const HOME_CARDS = [
  { id: "students", label: "Allievi", icon: GraduationCap, tone: "accent" },
  { id: "boats", label: "Barche", icon: Sailboat, tone: "blue" },
  {
    id: "sessions",
    label: "Comandate",
    icon: ClipboardCheck,
    tone: "blue",
  },
  { id: "crews", label: "Equipaggi", icon: UsersRound, tone: "accent" },
  {
    id: "evaluations",
    label: "Valutazioni",
    icon: ListChecks,
    tone: "accent",
  },
  { id: "volunteers", label: "Volontari", icon: HandHeart, tone: "blue" },
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
          {HOME_CARDS.map(({ id, label, icon: Icon, tone }) => (
            <button
              className={`home-card home-card--${tone}`}
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
}: {
  course: CourseRecord
  onHome: () => void
}) {
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
      <Button className="mt-7" onClick={onHome} variant="secondary">
        <ChevronLeft aria-hidden="true" className="size-4" />
        Torna alla Home
      </Button>
    </section>
  )
}

function AppShell({ course }: { course: CourseRecord }) {
  const [initialHistoryEntry] = useState(() =>
    readShellHistoryEntry(window.history.state),
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
    const currentEntry = readShellHistoryEntry(window.history.state)
    if (!currentEntry) {
      const homeEntry: ShellHistoryEntry = { view: "home", depth: 0 }
      pushShellHistoryEntry(homeEntry)
      historyDepthRef.current = homeEntry.depth
    } else {
      historyDepthRef.current = currentEntry.depth
    }

    function restoreFromHistory(event: PopStateEvent) {
      if (closeActiveDialogOnBack()) {
        event.stopImmediatePropagation()
        return
      }
      const entry = readShellHistoryEntry(event.state)
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
  }, [])

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
    const entry: ShellHistoryEntry = {
      view: next,
      depth: (currentEntry?.depth ?? historyDepthRef.current) + 1,
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
    const currentEntry = readShellHistoryEntry(window.history.state)
    if ((currentEntry?.depth ?? historyDepthRef.current) > 0) {
      window.history.back()
      return
    }
    if (view !== fallback) navigate(fallback)
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
          <SettingsView course={course} onHome={() => goBack("home")} />
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
            className="app-nav-button flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl font-bold text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 aria-[current=page]:bg-muted aria-[current=page]:text-primary"
            onClick={() => navigate("faults")}
            type="button"
          >
            <Wrench aria-hidden="true" className="size-5" />
            Avarie
          </button>
          <button
            aria-current={primaryView === "home" ? "page" : undefined}
            className="app-nav-button flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl font-bold text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 aria-[current=page]:bg-muted aria-[current=page]:text-primary"
            onClick={() => navigate("home")}
            type="button"
          >
            <House aria-hidden="true" className="size-6" />
            Home
          </button>
          <button
            aria-current={primaryView === "crews" ? "page" : undefined}
            className="app-nav-button flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl font-bold text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 aria-[current=page]:bg-muted aria-[current=page]:text-primary"
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
  return <AppShell course={appState.course} />
}
