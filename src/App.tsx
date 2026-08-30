import {
  Anchor,
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
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  COURSE_FAMILIES,
  COURSE_LEVELS,
  type CourseFamily,
  type CourseLevel,
} from "@/domain/config"
import { buildCourseDetails } from "@/domain/course"
import { BoatManagement } from "@/features/boats/BoatManagement"
import { FaultManagement } from "@/features/boats/FaultManagement"
import { DutyManagement } from "@/features/duties/DutyManagement"
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

const HOME_CARDS = [
  { id: "students", label: "Allievi", icon: GraduationCap },
  { id: "boats", label: "Barche", icon: Sailboat },
  { id: "sessions", label: "Comandate", icon: ClipboardCheck },
  { id: "crews", label: "Equipaggi", icon: UsersRound },
  { id: "evaluations", label: "Valutazioni", icon: ListChecks },
  { id: "volunteers", label: "Volontari", icon: HandHeart },
] as const

const PLACEHOLDER_COPY: Record<
  Exclude<
    ShellView,
    | "home"
    | "settings"
    | "students"
    | "volunteers"
    | "boats"
    | "faults"
    | "sessions"
  >,
  string
> = {
  crews: "La gestione degli equipaggi sarà attivata nei prossimi traguardi.",
  evaluations: "Le valutazioni saranno attivate nei prossimi traguardi.",
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`))
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-primary">
      <span
        className={`${compact ? "size-10 rounded-xl" : "size-12 rounded-2xl"} grid shrink-0 place-items-center bg-primary text-primary-foreground shadow-sm`}
      >
        <Sailboat
          aria-hidden="true"
          className={compact ? "size-5" : "size-6"}
        />
      </span>
      <div className="min-w-0">
        <p className="text-[0.65rem] font-bold tracking-[0.17em] uppercase">
          Caprera · modalità locale
        </p>
        <p
          className={`${compact ? "text-lg" : "text-2xl"} font-black tracking-tight`}
        >
          CVC Helper
        </p>
      </div>
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
        <p className="text-xs font-bold tracking-[0.16em] text-[#b04423] uppercase">
          Primo avvio
        </p>
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

        <div
          aria-live="polite"
          className="mt-7 min-h-24 rounded-2xl bg-muted px-4 py-4"
        >
          {details ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                  Corso proposto
                </p>
                <p className="mt-1 text-2xl font-black tracking-tight">
                  {details.label}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(details.startDate)} —{" "}
                  {formatDate(details.endDate)}
                </p>
              </div>
              <Anchor
                aria-hidden="true"
                className="size-7 shrink-0 text-primary"
              />
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
      <section className="overflow-hidden rounded-2xl bg-primary px-4 py-4 text-primary-foreground shadow-[0_12px_32px_rgb(6_59_82/0.18)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1
              aria-label={course.label}
              className="flex items-baseline gap-1.5 text-2xl font-black tracking-tight"
            >
              <span>
                {course.family === "Deriva" ? "D" : "C"}
                {course.level}
              </span>
              <span aria-hidden="true" className="text-white/45">
                ·
              </span>
              <span>{course.isoWeek}</span>
              <span aria-hidden="true" className="text-sm text-[#f6b63f]">
                |
              </span>
              <span>{course.year}</span>
            </h1>
            <p className="mt-1 text-xs text-white/75">
              {formatDate(course.startDate)} — {formatDate(course.endDate)} ·
              Caprera
            </p>
          </div>
          <Sailboat
            aria-hidden="true"
            className="size-8 shrink-0 text-[#f6b63f]"
          />
        </div>
      </section>

      <section className="mt-5" aria-labelledby="course-areas-title">
        <h2 className="text-lg font-black" id="course-areas-title">
          Aree del corso
        </h2>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {HOME_CARDS.map(({ id, label, icon: Icon }) => (
            <button
              className="group flex min-h-24 flex-col justify-between rounded-2xl border bg-card p-3.5 text-left shadow-[0_6px_18px_rgb(6_59_82/0.05)] transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
              key={id}
              onClick={() => onNavigate(id)}
              type="button"
            >
              <Icon aria-hidden="true" className="size-5 text-primary" />
              <span className="text-sm font-bold">{label}</span>
            </button>
          ))}
        </div>
      </section>
    </>
  )
}

function Placeholder({
  view,
  onHome,
}: {
  view: Exclude<
    ShellView,
    | "home"
    | "settings"
    | "students"
    | "volunteers"
    | "boats"
    | "faults"
    | "sessions"
  >
  onHome: () => void
}) {
  const card = HOME_CARDS.find(({ id }) => id === view)
  const title = card?.label ?? "Equipaggi"
  const Icon = card?.icon ?? UsersRound

  return (
    <section className="rounded-3xl border bg-card p-6 shadow-[0_18px_50px_rgb(6_59_82/0.08)]">
      <Icon aria-hidden="true" className="size-8 text-primary" />
      <p className="mt-5 text-xs font-bold tracking-[0.16em] text-[#b04423] uppercase">
        Area del corso
      </p>
      <h1 className="mt-1 text-3xl font-black tracking-tight">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {PLACEHOLDER_COPY[view]}
      </p>
      <Button className="mt-7" onClick={onHome} variant="secondary">
        <ChevronLeft aria-hidden="true" className="size-4" />
        Torna alla Home
      </Button>
    </section>
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
    <section className="rounded-3xl border bg-card p-6 shadow-[0_18px_50px_rgb(6_59_82/0.08)]">
      <Settings aria-hidden="true" className="size-8 text-primary" />
      <p className="mt-5 text-xs font-bold tracking-[0.16em] text-[#b04423] uppercase">
        Configurazione
      </p>
      <h1 className="mt-1 text-3xl font-black tracking-tight">Impostazioni</h1>
      <dl className="mt-6 divide-y rounded-2xl bg-muted px-4">
        <div className="flex justify-between gap-4 py-4">
          <dt className="text-sm text-muted-foreground">Corso</dt>
          <dd className="text-sm font-bold">{course.label}</dd>
        </div>
        <div className="flex justify-between gap-4 py-4">
          <dt className="text-sm text-muted-foreground">Tipo</dt>
          <dd className="text-sm font-bold">
            {course.family} · livello {course.level}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-4">
          <dt className="text-sm text-muted-foreground">Archivio</dt>
          <dd className="text-sm font-bold">Locale</dd>
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
  const [view, setView] = useState<ShellView>("home")
  const primaryView = view === "faults" || view === "crews" ? view : "home"

  return (
    <div className="mx-auto min-h-screen w-full max-w-md pb-28">
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
        <Brand compact />
        <Button
          aria-label="Impostazioni"
          className="size-11 shrink-0 px-0"
          onClick={() => setView("settings")}
          variant="secondary"
        >
          <Settings aria-hidden="true" className="size-5" />
        </Button>
      </header>

      <main className="px-5 py-3">
        {view === "home" && <Home course={course} onNavigate={setView} />}
        {view === "settings" && (
          <SettingsView course={course} onHome={() => setView("home")} />
        )}
        {view === "students" && (
          <StudentManagement course={course} onHome={() => setView("home")} />
        )}
        {view === "volunteers" && (
          <VolunteerManagement
            courseId={course.id}
            onHome={() => setView("home")}
          />
        )}
        {view === "boats" && (
          <BoatManagement course={course} onHome={() => setView("home")} />
        )}
        {view === "faults" && (
          <FaultManagement
            courseId={course.id}
            onHome={() => setView("home")}
            onOpenBoats={() => setView("boats")}
          />
        )}
        {view === "sessions" && (
          <DutyManagement
            courseId={course.id}
            onHome={() => setView("home")}
            referenceDate={course.startDate}
          />
        )}
        {view !== "home" &&
          view !== "settings" &&
          view !== "students" &&
          view !== "volunteers" &&
          view !== "boats" &&
          view !== "faults" &&
          view !== "sessions" && (
            <Placeholder onHome={() => setView("home")} view={view} />
          )}
      </main>

      <nav
        aria-label="Navigazione principale"
        className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t bg-card/95 px-4 pt-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] shadow-[0_-10px_35px_rgb(6_59_82/0.1)] backdrop-blur"
      >
        <div className="grid grid-cols-3 items-end gap-2">
          <button
            aria-current={primaryView === "faults" ? "page" : undefined}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-bold text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 aria-[current=page]:text-primary"
            onClick={() => setView("faults")}
            type="button"
          >
            <Wrench aria-hidden="true" className="size-5" />
            Avarie
          </button>
          <button
            aria-current={primaryView === "home" ? "page" : undefined}
            className="-mt-5 flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-primary text-xs font-bold text-primary-foreground shadow-[0_8px_24px_rgb(6_59_82/0.24)] outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            onClick={() => setView("home")}
            type="button"
          >
            <House aria-hidden="true" className="size-6" />
            Home
          </button>
          <button
            aria-current={primaryView === "crews" ? "page" : undefined}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-bold text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 aria-[current=page]:text-primary"
            onClick={() => setView("crews")}
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
