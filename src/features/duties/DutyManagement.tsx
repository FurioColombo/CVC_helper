import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ClipboardCheck,
  RefreshCw,
  Settings2,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DUTY_DAYS, type DutyDayId, type DutyTieBreaker } from "@/domain/config"
import {
  generateDutyProposal,
  getDutyWarnings,
  type DutyAssignment,
  type DutyConfig,
  type DutyStudent,
  type DutyWarning,
} from "@/domain/duties"
import { validateDutyRecords } from "@/domain/invariants"
import { getStudentDisplayName } from "@/domain/student"
import {
  readDutyPlan,
  saveDutyPlan,
  type DutySettingsRecord,
} from "@/persistence/duties"
import { listStudents, type StudentRecord } from "@/persistence/students"

type DutyScreen =
  | { kind: "list" }
  | { kind: "configure"; recalculate: boolean }
  | { kind: "day"; dayId: DutyDayId }
  | { kind: "warnings" }

function defaultSettings(students: StudentRecord[]): DutySettingsRecord {
  const activeCount = students.filter(({ active }) => active === 1).length
  return {
    desiredPerDay: Math.max(1, Math.floor(activeCount / DUTY_DAYS.length)),
    fewerDayIds: [],
    balanceMinors: true,
    balanceSex: false,
    tieBreaker: "alphabetical",
    stayOverStudentIds: [],
    completedDayIds: [],
    acknowledgedWarningKeys: [],
  }
}

async function readValidDutyData(courseId: string) {
  const [students, plan] = await Promise.all([
    listStudents(courseId),
    readDutyPlan(courseId),
  ])
  const settings = plan.settings ?? defaultSettings(students)
  if (
    validateDutyRecords(students, plan.assignments, settings.completedDayIds)
      .length > 0
  ) {
    throw new Error("Persisted duty state violates invariants")
  }
  return { students, assignments: plan.assignments, settings }
}

function asDutyStudents(students: StudentRecord[]): DutyStudent[] {
  return students.map(
    ({ id, firstName, surname, dateOfBirth, sex, active }) => ({
      id,
      firstName,
      surname,
      dateOfBirth,
      sex,
      active,
    }),
  )
}

function DutyHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-5 flex items-center gap-1">
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
  )
}

function ToggleChoice({
  checked,
  label,
  onChange,
  detail,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
  detail?: string
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border bg-card px-4 py-3">
      <input
        checked={checked}
        className="size-5 accent-primary"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="min-w-0">
        <span className="block text-sm font-bold">{label}</span>
        {detail && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {detail}
          </span>
        )}
      </span>
    </label>
  )
}

function DutyConfiguration({
  students,
  settings,
  recalculate,
  onCancel,
  onGenerate,
}: {
  students: StudentRecord[]
  settings: DutySettingsRecord
  recalculate: boolean
  onCancel: () => void
  onGenerate: (settings: DutySettingsRecord) => Promise<void>
}) {
  const [draft, setDraft] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  function toggleDay(dayId: DutyDayId) {
    setDraft((current) => ({
      ...current,
      fewerDayIds: current.fewerDayIds.includes(dayId)
        ? current.fewerDayIds.filter((id) => id !== dayId)
        : [...current.fewerDayIds, dayId],
    }))
  }

  function toggleStayOver(studentId: string) {
    setDraft((current) => ({
      ...current,
      stayOverStudentIds: current.stayOverStudentIds.includes(studentId)
        ? current.stayOverStudentIds.filter((id) => id !== studentId)
        : [...current.stayOverStudentIds, studentId],
    }))
  }

  async function generate() {
    setSaving(true)
    setError(false)
    try {
      await onGenerate(draft)
    } catch {
      setSaving(false)
      setError(true)
    }
  }

  return (
    <>
      <DutyHeader
        onBack={onCancel}
        title={recalculate ? "Ricalcola rimanenti" : "Proposta comandate"}
      />
      <div className="grid gap-5">
        <label className="grid gap-2 text-sm font-bold">
          <span>Numero desiderato al giorno</span>
          <Input
            inputMode="numeric"
            max={students.length || 1}
            min={1}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                desiredPerDay: Math.max(
                  1,
                  Math.floor(Number(event.target.value) || 1),
                ),
              }))
            }
            step={1}
            type="number"
            value={draft.desiredPerDay}
          />
          <span className="text-xs font-normal leading-5 text-muted-foreground">
            La proposta assegna comunque tutti gli allievi, distribuendo gli
            eventuali resti nel modo più uniforme possibile.
          </span>
        </label>

        <fieldset>
          <legend className="text-sm font-bold">
            Giorni da tenere più leggeri
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {DUTY_DAYS.map(({ id, label }) => (
              <Button
                aria-pressed={draft.fewerDayIds.includes(id)}
                className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                key={id}
                onClick={() => toggleDay(id)}
                type="button"
                variant="secondary"
              >
                {label}
              </Button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-2">
          <ToggleChoice
            checked={draft.balanceMinors}
            label="Bilancia minori"
            onChange={(balanceMinors) =>
              setDraft((current) => ({ ...current, balanceMinors }))
            }
          />
          <ToggleChoice
            checked={draft.balanceSex}
            label="Bilancia M/F"
            onChange={(balanceSex) =>
              setDraft((current) => ({ ...current, balanceSex }))
            }
          />
        </div>

        <label className="grid gap-2 text-sm font-bold">
          <span>Spareggio deterministico</span>
          <select
            className="h-12 rounded-xl border bg-card px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                tieBreaker: event.target.value as DutyTieBreaker,
              }))
            }
            value={draft.tieBreaker}
          >
            <option value="alphabetical">Cognome alfabetico</option>
            <option value="similar-age">Età simile</option>
          </select>
        </label>

        <fieldset>
          <legend className="text-sm font-bold">
            Restano la settimana successiva
          </legend>
          <div className="mt-2 grid gap-2">
            {students
              .filter(({ active }) => active === 1)
              .map((student) => (
                <ToggleChoice
                  checked={draft.stayOverStudentIds.includes(student.id)}
                  key={student.id}
                  label={getStudentDisplayName(student, students)}
                  onChange={() => toggleStayOver(student.id)}
                />
              ))}
          </div>
        </fieldset>

        {error && (
          <p className="text-sm font-semibold text-[#a2381b]" role="alert">
            La proposta non è stata salvata. Riprova.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={onCancel} variant="secondary">
            Annulla
          </Button>
          <Button
            disabled={saving || students.length === 0}
            onClick={() => void generate()}
          >
            {saving ? "Calcolo…" : recalculate ? "Ricalcola" : "Genera"}
          </Button>
        </div>
      </div>
    </>
  )
}

function DayEditor({
  dayId,
  students,
  assignments,
  completed,
  onBack,
  onSave,
  onComplete,
}: {
  dayId: DutyDayId
  students: StudentRecord[]
  assignments: DutyAssignment[]
  completed: boolean
  onBack: () => void
  onSave: (assignments: DutyAssignment[]) => Promise<void>
  onComplete: () => Promise<void>
}) {
  const day = DUTY_DAYS.find(({ id }) => id === dayId)!
  const selected = new Set(
    assignments
      .filter((assignment) => assignment.dayId === dayId)
      .map(({ studentId }) => studentId),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const visibleStudents = completed
    ? students.filter(({ id }) => selected.has(id))
    : students

  async function toggle(studentId: string) {
    if (completed || saving) return
    setSaving(true)
    setError(false)
    const next = selected.has(studentId)
      ? assignments.filter(
          (assignment) =>
            !(assignment.dayId === dayId && assignment.studentId === studentId),
        )
      : [...assignments, { dayId, studentId }]
    try {
      await onSave(next)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  async function complete() {
    if (saving) return
    setSaving(true)
    setError(false)
    try {
      await onComplete()
    } catch {
      setError(true)
      setSaving(false)
    }
  }

  return (
    <>
      <DutyHeader
        onBack={onBack}
        title={`Comandata ${day.label.toLowerCase()}`}
      />
      {completed && (
        <p className="mb-4 rounded-2xl bg-[#e9f5eb] px-4 py-3 text-sm font-bold text-[#176b2c]">
          Completata · storico non modificabile dal ricalcolo
        </p>
      )}
      {!completed && (
        <Button
          className="mb-4 w-full"
          disabled={saving}
          onClick={() => void complete()}
          variant="secondary"
        >
          <Check aria-hidden="true" className="size-4" />
          {saving ? "Salvataggio…" : "Segna completata"}
        </Button>
      )}
      <section
        aria-label={`Allievi comandata ${day.label}`}
        className="grid gap-2"
      >
        {visibleStudents.map((student) => {
          const checked = selected.has(student.id)
          return (
            <button
              aria-pressed={checked}
              className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left outline-none aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-100"
              disabled={completed || saving}
              key={student.id}
              onClick={() => void toggle(student.id)}
              type="button"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-md border border-current">
                {checked && <Check aria-hidden="true" className="size-4" />}
              </span>
              <span className="min-w-0 flex-1 font-bold">
                {getStudentDisplayName(student, students)}
              </span>
              {student.active === 0 && (
                <span className="text-xs font-bold">Disabilitato</span>
              )}
            </button>
          )
        })}
        {visibleStudents.length === 0 && (
          <p className="rounded-2xl border bg-card px-4 py-4 text-sm text-muted-foreground">
            Nessun allievo assegnato.
          </p>
        )}
      </section>
      {error && (
        <p className="mt-3 text-sm font-semibold text-[#a2381b]" role="alert">
          Modifica non salvata. Riprova.
        </p>
      )}
    </>
  )
}

function WarningList({
  warnings,
  acknowledged,
  onBack,
  onAcknowledge,
}: {
  warnings: DutyWarning[]
  acknowledged: string[]
  onBack: () => void
  onAcknowledge: (key: string) => Promise<void>
}) {
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const visible = warnings.filter(
    ({ key, severity }) => severity === "major" || !acknowledged.includes(key),
  )

  async function acknowledge(key: string) {
    if (savingKey) return
    setSavingKey(key)
    setError(false)
    try {
      await onAcknowledge(key)
      setSavingKey(null)
    } catch {
      setSavingKey(null)
      setError(true)
    }
  }

  return (
    <>
      <DutyHeader onBack={onBack} title="Avvisi comandate" />
      {visible.length === 0 ? (
        <p className="rounded-2xl bg-[#e9f5eb] px-4 py-4 text-sm font-bold text-[#176b2c]">
          Nessun avviso da gestire.
        </p>
      ) : (
        <div className="grid gap-3">
          {visible.map((warning) => (
            <article
              className={`rounded-2xl border p-4 ${warning.severity === "major" ? "border-[#d92d20]/40 bg-[#fff1ed]" : "bg-[#fff7df]"}`}
              key={warning.key}
            >
              <p className="text-sm font-black">{warning.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {warning.detail}
              </p>
              {warning.severity === "advisory" && (
                <Button
                  className="mt-3"
                  disabled={savingKey !== null}
                  onClick={() => void acknowledge(warning.key)}
                  variant="secondary"
                >
                  {savingKey === warning.key
                    ? "Salvataggio…"
                    : "Accetta eccezione"}
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
      {error && (
        <p className="mt-3 text-sm font-semibold text-[#a2381b]" role="alert">
          Eccezione non salvata. Riprova.
        </p>
      )}
    </>
  )
}

export function DutyManagement({
  courseId,
  referenceDate,
  onHome,
}: {
  courseId: string
  referenceDate: string
  onHome: () => void
}) {
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [assignments, setAssignments] = useState<DutyAssignment[]>([])
  const [settings, setSettings] = useState<DutySettingsRecord | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [screen, setScreen] = useState<DutyScreen>({ kind: "list" })
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  )

  const applyLoaded = useCallback(
    (data: Awaited<ReturnType<typeof readValidDutyData>>) => {
      setStudents(data.students)
      setAssignments(data.assignments)
      setSettings(data.settings)
      setLoadState("ready")
    },
    [],
  )

  async function load() {
    setLoadState("loading")
    try {
      applyLoaded(await readValidDutyData(courseId))
    } catch {
      setLoadState("error")
    }
  }

  useEffect(() => {
    let active = true
    readValidDutyData(courseId)
      .then((data) => {
        if (active) applyLoaded(data)
      })
      .catch(() => {
        if (active) setLoadState("error")
      })
    return () => {
      active = false
    }
  }, [applyLoaded, courseId])

  const config: DutyConfig | null = settings
    ? { ...settings, referenceDate }
    : null
  const warnings = config
    ? getDutyWarnings(
        asDutyStudents(students),
        assignments,
        config,
        settings?.completedDayIds,
      )
    : []
  const visibleWarningCount = warnings.filter(
    ({ key, severity }) =>
      severity === "major" || !settings?.acknowledgedWarningKeys.includes(key),
  ).length

  async function persist(
    nextAssignments: DutyAssignment[],
    nextSettings = settings!,
  ) {
    const activeAdvisoryKeys = new Set(
      getDutyWarnings(
        asDutyStudents(students),
        nextAssignments,
        { ...nextSettings, referenceDate },
        nextSettings.completedDayIds,
      )
        .filter(({ severity }) => severity === "advisory")
        .map(({ key }) => key),
    )
    const normalizedSettings = {
      ...nextSettings,
      acknowledgedWarningKeys: nextSettings.acknowledgedWarningKeys.filter(
        (key) => activeAdvisoryKeys.has(key),
      ),
    }
    await saveDutyPlan(courseId, nextAssignments, normalizedSettings)
    setAssignments(nextAssignments)
    setSettings(normalizedSettings)
  }

  if (loadState === "error") {
    return (
      <section className="rounded-3xl border bg-card p-5">
        <h1 className="text-xl font-black">Comandate non disponibili</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Non riesco a leggere l’archivio locale.
        </p>
        <Button className="mt-5" onClick={() => void load()}>
          Riprova
        </Button>
      </section>
    )
  }
  if (loadState === "loading" || !settings) {
    return (
      <p className="py-12 text-center text-sm font-semibold">
        Apertura comandate…
      </p>
    )
  }

  if (screen.kind === "configure") {
    return (
      <DutyConfiguration
        onCancel={() => setScreen({ kind: "list" })}
        onGenerate={async (nextSettings) => {
          const preserveHistory = nextSettings.completedDayIds.length > 0
          const proposal = generateDutyProposal(
            asDutyStudents(students),
            { ...nextSettings, referenceDate },
            screen.recalculate || preserveHistory ? assignments : [],
            preserveHistory ? nextSettings.completedDayIds : [],
          )
          await persist(proposal.assignments, nextSettings)
          setScreen({ kind: "list" })
        }}
        recalculate={screen.recalculate}
        settings={settings}
        students={students}
      />
    )
  }

  if (screen.kind === "day") {
    return (
      <DayEditor
        assignments={assignments}
        completed={settings.completedDayIds.includes(screen.dayId)}
        dayId={screen.dayId}
        onBack={() => setScreen({ kind: "list" })}
        onComplete={async () => {
          await persist(assignments, {
            ...settings,
            completedDayIds: [...settings.completedDayIds, screen.dayId],
          })
          setScreen({ kind: "list" })
        }}
        onSave={(next) => persist(next, settings)}
        students={students}
      />
    )
  }

  if (screen.kind === "warnings") {
    return (
      <WarningList
        acknowledged={settings.acknowledgedWarningKeys}
        onAcknowledge={(key) =>
          persist(assignments, {
            ...settings,
            acknowledgedWarningKeys: [...settings.acknowledgedWarningKeys, key],
          })
        }
        onBack={() => setScreen({ kind: "list" })}
        warnings={warnings}
      />
    )
  }

  return (
    <>
      <DutyHeader onBack={onHome} title="Comandate" />
      {students.length === 0 ? (
        <section className="rounded-3xl border bg-card p-5 text-center">
          <ClipboardCheck
            aria-hidden="true"
            className="mx-auto size-8 text-primary"
          />
          <h2 className="mt-4 text-xl font-black">
            Prima aggiungi gli allievi
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            La proposta usa gli allievi attivi del corso.
          </p>
        </section>
      ) : assignments.length === 0 &&
        settings.completedDayIds.length === 0 &&
        !manualMode ? (
        <section className="rounded-3xl border bg-card p-5 text-center">
          <ClipboardCheck
            aria-hidden="true"
            className="mx-auto size-9 text-primary"
          />
          <h2 className="mt-4 text-xl font-black">
            Nessuna comandata pianificata
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Crea una proposta uniforme, poi modificala liberamente.
          </p>
          <div className="mt-6 grid gap-2">
            <Button
              className="w-full"
              onClick={() =>
                setScreen({ kind: "configure", recalculate: false })
              }
              size="lg"
            >
              Proponi comandate
            </Button>
            <Button
              className="w-full"
              onClick={() => setManualMode(true)}
              size="lg"
              variant="secondary"
            >
              Configura manualmente
            </Button>
          </div>
        </section>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Button
              onClick={() =>
                setScreen({ kind: "configure", recalculate: true })
              }
              variant="secondary"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Ricalcola
            </Button>
            <Button
              onClick={() => setScreen({ kind: "warnings" })}
              variant={visibleWarningCount > 0 ? "default" : "secondary"}
            >
              <AlertTriangle aria-hidden="true" className="size-4" />
              Avvisi · {visibleWarningCount}
            </Button>
          </div>
          <section aria-label="Piano comandate" className="grid gap-2.5">
            {DUTY_DAYS.map(({ id, label }) => {
              const dayAssignments = assignments.filter(
                ({ dayId }) => dayId === id,
              )
              const names = dayAssignments
                .map(({ studentId }) => {
                  const student = students.find(
                    ({ id: candidateId }) => candidateId === studentId,
                  )
                  return student
                    ? getStudentDisplayName(student, students)
                    : "Allievo mancante"
                })
                .sort((left, right) =>
                  left.localeCompare(right, "it-IT", { sensitivity: "base" }),
                )
              const completed = settings.completedDayIds.includes(id)
              return (
                <button
                  aria-label={`${label}, ${names.length} assegnati${completed ? ", completata" : ""}`}
                  className="rounded-2xl border bg-card p-4 text-left shadow-[0_6px_18px_rgb(6_59_82/0.05)] outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                  key={id}
                  onClick={() => setScreen({ kind: "day", dayId: id })}
                  type="button"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-black">{label}</span>
                    <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                      {completed && (
                        <span className="text-[#176b2c]">Completata</span>
                      )}
                      {names.length}
                    </span>
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                    {names.length > 0 ? names.join(" · ") : "Nessun assegnato"}
                  </span>
                </button>
              )
            })}
          </section>
          {settings.completedDayIds.length === 0 && (
            <Button
              className="mt-4 w-full"
              onClick={() =>
                setScreen({ kind: "configure", recalculate: false })
              }
              variant="secondary"
            >
              <Settings2 aria-hidden="true" className="size-4" />
              Rigenera intera proposta
            </Button>
          )}
        </>
      )}
    </>
  )
}
