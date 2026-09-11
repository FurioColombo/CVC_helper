import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ClipboardCheck,
  Plus,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { DUTY_DAYS, type DutyDayId, type DutyTieBreaker } from "@/domain/config"
import {
  generateDutyProposal,
  getDutyCoverage,
  getDutyDistributionRequirement,
  getDutyWarnings,
  groupDutyStudentsForDay,
  setStudentDutyForDay,
  type DutyAssignment,
  type DutyConfig,
  type DutyProposal,
  type DutyStudent,
  type DutyStudentDayGroupEntry,
  type DutyWarning,
} from "@/domain/duties"
import { validateDutyRecords } from "@/domain/invariants"
import { getStudentDisplayName, isMinor } from "@/domain/student"
import {
  readDutyPlan,
  saveDutyPlan,
  type DutySettingsRecord,
} from "@/persistence/duties"
import { listStudents, type StudentRecord } from "@/persistence/students"

type DutySettingsWithExtras = DutySettingsRecord & {
  extraDayIds?: DutyDayId[]
}
type CanonicalDutySettings = DutySettingsRecord & {
  extraDayIds: DutyDayId[]
}

type DutyScreen =
  | { kind: "list" }
  | { kind: "configure"; recalculate: boolean }
  | { kind: "day"; dayId: DutyDayId }
  | { kind: "warnings" }

const DAY_IDS = DUTY_DAYS.map(({ id }) => id) as DutyDayId[]
const SHORT_DAY_LABELS: Record<DutyDayId, string> = {
  monday: "Lun",
  tuesday: "Mar",
  wednesday: "Mer",
  thursday: "Gio",
  friday: "Ven",
  saturday: "Sab",
  sunday: "Dom",
}

function getDayLabel(dayId: DutyDayId) {
  return DUTY_DAYS.find(({ id }) => id === dayId)?.label ?? dayId
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

function completedStudentIds(
  assignments: DutyAssignment[],
  completedDayIds: readonly DutyDayId[],
) {
  const completed = new Set(completedDayIds)
  return new Set(
    assignments
      .filter(({ dayId }) => completed.has(dayId))
      .map(({ studentId }) => studentId),
  )
}

function getProposalStudentCount(
  students: StudentRecord[],
  assignments: DutyAssignment[],
  completedDayIds: readonly DutyDayId[],
) {
  const completedIds = completedStudentIds(assignments, completedDayIds)
  return students.filter(
    ({ id, active }) => active === 1 && !completedIds.has(id),
  ).length
}

function deriveExtraDayIds(
  studentCount: number,
  remainingDayIds: DutyDayId[],
  settings: DutySettingsWithExtras,
) {
  const extraDayCount = getDutyDistributionRequirement(
    studentCount,
    remainingDayIds,
  ).extraDayCount
  const explicit = settings.extraDayIds ?? []
  const legacy = remainingDayIds.filter(
    (dayId) => !settings.fewerDayIds.includes(dayId),
  )
  const preferred = [...explicit, ...legacy, ...remainingDayIds]
  return [...new Set(preferred)]
    .filter((dayId) => remainingDayIds.includes(dayId))
    .slice(0, extraDayCount)
}

function normalizeProposalSettings(
  settings: DutySettingsWithExtras,
  students: StudentRecord[],
  assignments: DutyAssignment[],
): CanonicalDutySettings {
  const remainingDayIds = DAY_IDS.filter(
    (dayId) => !settings.completedDayIds.includes(dayId),
  )
  const studentCount = getProposalStudentCount(
    students,
    assignments,
    settings.completedDayIds,
  )
  const extraDayIds = deriveExtraDayIds(studentCount, remainingDayIds, settings)
  return {
    ...settings,
    desiredPerDay:
      remainingDayIds.length === 0
        ? 0
        : Math.max(0, Math.floor(studentCount / remainingDayIds.length)),
    extraDayIds,
    fewerDayIds: remainingDayIds.filter(
      (dayId) => !extraDayIds.includes(dayId),
    ),
  }
}

function defaultSettings(students: StudentRecord[]): CanonicalDutySettings {
  const activeCount = students.filter(({ active }) => active === 1).length
  const extraDayIds = deriveExtraDayIds(activeCount, DAY_IDS, {
    desiredPerDay: 0,
    fewerDayIds: [],
    balanceMinors: true,
    balanceSex: false,
    tieBreaker: "alphabetical",
    stayOverStudentIds: [],
    completedDayIds: [],
    acknowledgedWarningKeys: [],
  })
  return {
    desiredPerDay: Math.floor(activeCount / DAY_IDS.length),
    fewerDayIds: DAY_IDS.filter((dayId) => !extraDayIds.includes(dayId)),
    extraDayIds,
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
  return {
    students,
    assignments: plan.assignments,
    settings: settings as DutySettingsWithExtras,
  }
}

function DutyHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-5 flex items-center gap-1 max-[350px]:items-start">
      <button
        aria-label={`Indietro da ${title}`}
        className="grid size-11 shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40 max-[350px]:size-[44px]"
        onClick={onBack}
        type="button"
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-center text-2xl font-black tracking-tight max-[350px]:overflow-visible max-[350px]:whitespace-normal max-[350px]:text-clip max-[350px]:text-xl max-[350px]:leading-tight">
        {title}
      </h1>
      <span
        aria-hidden="true"
        className="size-11 shrink-0 max-[350px]:size-[44px]"
      />
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
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-2.5 max-[350px]:min-h-[48px] max-[350px]:gap-[8px] max-[350px]:px-[12px] max-[350px]:py-[8px]">
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{label}</span>
        {detail && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {detail}
          </span>
        )}
      </span>
      <span className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full bg-muted transition-colors has-[:checked]:bg-primary max-[350px]:h-[28px] max-[350px]:w-[48px]">
        <input
          aria-checked={checked}
          checked={checked}
          className="peer sr-only"
          onChange={(event) => onChange(event.target.checked)}
          role="switch"
          type="checkbox"
        />
        <span className="pointer-events-none absolute left-1 size-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 max-[350px]:left-[4px] max-[350px]:size-[20px] max-[350px]:peer-checked:translate-x-[20px]" />
      </span>
    </label>
  )
}

function PreviewDayCard({
  dayId,
  names,
  capacity,
}: {
  dayId: DutyDayId
  names: string[]
  capacity: number
}) {
  return (
    <article className="min-w-0 rounded-2xl border bg-card p-3 shadow-[0_6px_18px_rgb(6_59_82/0.05)]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-black">{getDayLabel(dayId)}</h3>
        <span className="shrink-0 text-xs font-bold text-muted-foreground">
          {names.length}/{capacity}
        </span>
      </div>
      <div className="my-2 border-t" />
      <p className="break-words text-sm leading-5 text-muted-foreground">
        {names.length > 0 ? names.join(" · ") : "Nessun assegnato"}
      </p>
    </article>
  )
}

function DutyConfiguration({
  students,
  settings,
  assignments,
  referenceDate,
  recalculate,
  onCancel,
  onConfirm,
}: {
  students: StudentRecord[]
  settings: CanonicalDutySettings
  assignments: DutyAssignment[]
  referenceDate: string
  recalculate: boolean
  onCancel: () => void
  onConfirm: (
    settings: CanonicalDutySettings,
    proposal: DutyProposal,
  ) => Promise<void>
}) {
  const [draft, setDraft] = useState<CanonicalDutySettings>(() =>
    normalizeProposalSettings(settings, students, assignments),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const remainingDayIds = useMemo(
    () => DAY_IDS.filter((dayId) => !draft.completedDayIds.includes(dayId)),
    [draft.completedDayIds],
  )
  const proposalStudentCount = getProposalStudentCount(
    students,
    assignments,
    draft.completedDayIds,
  )
  const distribution = getDutyDistributionRequirement(
    proposalStudentCount,
    remainingDayIds,
  )
  const selectedExtraDayIds =
    draft.extraDayIds?.filter((dayId) => remainingDayIds.includes(dayId)) ?? []
  const proposal = useMemo(() => {
    try {
      return generateDutyProposal(
        asDutyStudents(students),
        { ...draft, referenceDate },
        recalculate || draft.completedDayIds.length > 0 ? assignments : [],
        draft.completedDayIds.length > 0 ? draft.completedDayIds : [],
      )
    } catch {
      return null
    }
  }, [assignments, draft, recalculate, referenceDate, students])

  function toggleExtraDay(dayId: DutyDayId) {
    setDraft((current) => {
      const currentSelected = current.extraDayIds ?? []
      const next = currentSelected.includes(dayId)
        ? currentSelected.filter((id) => id !== dayId)
        : [...currentSelected, dayId]
      return {
        ...current,
        extraDayIds: next,
        fewerDayIds: remainingDayIds.filter((id) => !next.includes(id)),
      }
    })
  }

  function toggleStayOver(studentId: string) {
    setDraft((current) => ({
      ...current,
      stayOverStudentIds: current.stayOverStudentIds.includes(studentId)
        ? current.stayOverStudentIds.filter((id) => id !== studentId)
        : [...current.stayOverStudentIds, studentId],
    }))
  }

  async function confirm() {
    if (
      saving ||
      !proposal ||
      selectedExtraDayIds.length !== distribution.extraDayCount
    ) {
      return
    }
    setSaving(true)
    setError(false)
    try {
      await onConfirm(
        {
          ...draft,
          extraDayIds: selectedExtraDayIds,
          fewerDayIds: remainingDayIds.filter(
            (dayId) => !selectedExtraDayIds.includes(dayId),
          ),
        },
        proposal,
      )
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
      <div className="grid min-w-0 max-w-full gap-4 overflow-x-hidden max-[350px]:gap-[16px]">
        <section
          aria-label="Riepilogo distribuzione"
          className="flex min-w-0 max-w-full items-center gap-3 rounded-2xl border bg-card p-4 max-[350px]:items-start max-[350px]:gap-[10px] max-[350px]:p-[12px]"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-xl font-black text-primary max-[350px]:size-[48px]">
            {distribution.base}
          </span>
          <span className="min-w-0">
            <span className="block break-words text-sm font-black">
              Base per giorno
            </span>
            <span className="block break-words text-xs leading-5 text-muted-foreground">
              {proposalStudentCount} allievi · {remainingDayIds.length} giorni
              {distribution.extraDayCount > 0 &&
                ` · ${distribution.extraDayCount} posto${distribution.extraDayCount === 1 ? "" : "i"} extra`}
            </span>
          </span>
        </section>

        <fieldset className="min-w-0 max-w-full">
          <legend className="break-words text-sm font-black">
            Giorni con più persone
          </legend>
          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
            Scegli esattamente {distribution.extraDayCount} giorno
            {distribution.extraDayCount === 1 ? "" : "i"}.
          </p>
          <div className="mt-2 grid min-w-0 max-w-full grid-cols-4 gap-2 max-[350px]:gap-[6px]">
            {remainingDayIds.map((dayId) => {
              const selected = selectedExtraDayIds.includes(dayId)
              const locked =
                !selected &&
                selectedExtraDayIds.length >= distribution.extraDayCount
              return (
                <Button
                  aria-label={`${getDayLabel(dayId)} con più persone`}
                  aria-pressed={selected}
                  className="h-11 min-w-0 px-1 text-xs aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground max-[350px]:h-[44px] max-[350px]:px-[2px]"
                  disabled={locked || distribution.extraDayCount === 0}
                  key={dayId}
                  onClick={() => toggleExtraDay(dayId)}
                  type="button"
                  variant="secondary"
                >
                  {SHORT_DAY_LABELS[dayId]}
                </Button>
              )
            })}
          </div>
          <p className="mt-2 text-center text-xs font-semibold text-muted-foreground">
            {selectedExtraDayIds.length}/{distribution.extraDayCount}{" "}
            selezionati
          </p>
        </fieldset>

        <fieldset className="grid min-w-0 max-w-full gap-2">
          <legend className="mb-2 break-words text-sm font-black">
            Preferenze
          </legend>
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
        </fieldset>

        <label className="grid min-w-0 max-w-full gap-1.5 text-sm font-bold">
          <span className="break-words">Spareggio deterministico</span>
          <select
            className="h-12 min-w-0 max-w-full truncate rounded-xl border bg-card px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/30 max-[350px]:h-[48px] max-[350px]:px-[10px]"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                tieBreaker: event.target.value as DutyTieBreaker,
              }))
            }
            value={draft.tieBreaker}
          >
            <option value="alphabetical">Alfabetico</option>
            <option value="similar-age">Età simile</option>
          </select>
        </label>

        <fieldset className="min-w-0 max-w-full">
          <legend className="break-words text-sm font-black">
            Restano la settimana successiva
          </legend>
          <details className="mt-2 rounded-2xl border bg-card">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/40 max-[350px]:min-h-[48px] max-[350px]:gap-[8px] max-[350px]:px-[12px] max-[350px]:py-[8px]">
              <span className="min-w-0 break-words">
                Scegli tra tutti gli allievi
              </span>
              <span className="shrink-0 text-muted-foreground">
                {draft.stayOverStudentIds.length}
              </span>
            </summary>
            <div className="grid gap-2 border-t p-2 min-[520px]:grid-cols-2">
              {students.map((student) => (
                <ToggleChoice
                  checked={draft.stayOverStudentIds.includes(student.id)}
                  key={student.id}
                  label={getStudentDisplayName(student, students)}
                  onChange={() => toggleStayOver(student.id)}
                />
              ))}
            </div>
          </details>
          <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">
            Saranno preferiti per venerdì, fino ai posti necessari.
          </p>
        </fieldset>

        {proposal && (
          <section aria-label="Anteprima proposta" className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-black">Anteprima</h2>
              <span className="text-xs font-semibold text-muted-foreground">
                Nessun dato salvato
              </span>
            </div>
            <div className="grid gap-2 min-[520px]:grid-cols-2">
              {remainingDayIds.map((dayId) => {
                const dayAssignments = proposal.assignments.filter(
                  ({ dayId: assignedDay }) => assignedDay === dayId,
                )
                const names = dayAssignments
                  .map(({ studentId }) => {
                    const student = students.find(({ id }) => id === studentId)
                    return student
                      ? getStudentDisplayName(student, students)
                      : "Allievo mancante"
                  })
                  .sort((left, right) =>
                    left.localeCompare(right, "it-IT", {
                      sensitivity: "base",
                    }),
                  )
                return (
                  <PreviewDayCard
                    capacity={proposal.capacities[dayId]}
                    dayId={dayId}
                    key={dayId}
                    names={names}
                  />
                )
              })}
            </div>
          </section>
        )}

        {error && (
          <p className="text-sm font-semibold text-[#a2381b]" role="alert">
            La proposta non è stata salvata. Riprova.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 max-[350px]:grid-cols-1 max-[350px]:gap-[8px]">
          <Button
            className="max-[350px]:min-h-[44px]"
            onClick={onCancel}
            variant="secondary"
          >
            Annulla
          </Button>
          <Button
            aria-label="Conferma proposta"
            className="max-[350px]:min-h-[44px]"
            disabled={
              saving ||
              students.length === 0 ||
              !proposal ||
              selectedExtraDayIds.length !== distribution.extraDayCount
            }
            onClick={() => void confirm()}
          >
            {saving ? "Salvataggio…" : "Conferma"}
          </Button>
        </div>
      </div>
    </>
  )
}

function StudentAssignmentCard({
  entry,
  allStudents,
  completedDayIds,
  current,
  completed,
  saving,
  onAdd,
  onRemove,
}: {
  entry: DutyStudentDayGroupEntry
  allStudents: StudentRecord[]
  completedDayIds: readonly DutyDayId[]
  current: boolean
  completed: boolean
  saving: boolean
  onAdd: () => void
  onRemove: (dayId: DutyDayId) => void
}) {
  const { student, dayIds } = entry
  const name = getStudentDisplayName(student, allStudents)
  const hasMultipleDays = dayIds.length > 1
  return (
    <article
      className={`flex min-w-0 items-center gap-1 rounded-2xl border bg-card p-1.5 shadow-[0_4px_14px_rgb(6_59_82/0.04)] ${hasMultipleDays ? "col-span-2" : ""}`}
    >
      {current ? (
        <span
          className="flex min-h-10 min-w-0 flex-1 items-center truncate px-1 text-left text-sm font-bold"
          title={name}
        >
          {name}
        </span>
      ) : (
        <button
          aria-label={name}
          className="flex min-h-10 min-w-0 flex-1 items-center gap-1 rounded-xl px-1 text-left text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/40 max-[350px]:rounded-none max-[350px]:text-primary max-[350px]:shadow-[inset_2px_0_0_#b9d4ec]"
          disabled={completed || saving}
          onClick={onAdd}
          title={name}
          type="button"
        >
          <span className="min-w-0 flex-1 truncate">{name}</span>
          <Plus
            aria-hidden="true"
            className="size-4 shrink-0 text-primary max-[350px]:hidden"
          />
        </button>
      )}
      {student.active === 0 && (
        <span className="hidden shrink-0 text-[10px] font-bold text-muted-foreground min-[520px]:inline">
          Disabilitato
        </span>
      )}
      {hasMultipleDays && (
        <AlertTriangle
          aria-label={`${name} assegnato in più giorni`}
          className="size-4 shrink-0 text-[#b42318]"
          role="img"
        />
      )}
      <div className="flex shrink-0 items-center gap-0.5">
        {dayIds.map((assignedDayId) => (
          <span className="flex items-center gap-0.5" key={assignedDayId}>
            <span
              aria-label={`${getDayLabel(assignedDayId)} assegnato`}
              className="rounded-md bg-muted px-1.5 py-1 text-[10px] font-black text-muted-foreground"
              title={getDayLabel(assignedDayId)}
            >
              {SHORT_DAY_LABELS[assignedDayId]}
            </span>
            {!completedDayIds.includes(assignedDayId) ? (
              <button
                aria-label={`Rimuovi ${name} da ${getDayLabel(assignedDayId)}`}
                className="grid size-10 place-items-center rounded-xl text-[#b42318] outline-none hover:bg-[#fff1ed] focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-40"
                disabled={completed || saving}
                onClick={() => onRemove(assignedDayId)}
                type="button"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
          </span>
        ))}
      </div>
    </article>
  )
}

function DayEditor({
  dayId,
  students,
  assignments,
  completedDayIds,
  completed,
  onBack,
  onSave,
  onComplete,
}: {
  dayId: DutyDayId
  students: StudentRecord[]
  assignments: DutyAssignment[]
  completedDayIds: readonly DutyDayId[]
  completed: boolean
  onBack: () => void
  onSave: (assignments: DutyAssignment[]) => Promise<void>
  onComplete: () => Promise<void>
}) {
  const day = DUTY_DAYS.find(({ id }) => id === dayId)!
  const groups = groupDutyStudentsForDay(
    asDutyStudents(students),
    assignments,
    dayId,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  async function updateAssignment(
    targetDayId: DutyDayId,
    studentId: string,
    assigned: boolean,
  ) {
    if (completed || saving) return
    setSaving(true)
    setError(false)
    try {
      await onSave(
        setStudentDutyForDay(
          assignments,
          completedDayIds,
          targetDayId,
          studentId,
          assigned,
        ),
      )
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

  function renderCards(entries: DutyStudentDayGroupEntry[], current: boolean) {
    return entries.length > 0 ? (
      <div className="grid grid-cols-2 items-start gap-2">
        {entries.map((entry) => (
          <StudentAssignmentCard
            allStudents={students}
            completed={completed}
            completedDayIds={completedDayIds}
            current={current}
            entry={entry}
            key={entry.student.id}
            onAdd={() =>
              void updateAssignment(dayId, entry.student.id, !current)
            }
            onRemove={(targetDayId) =>
              void updateAssignment(targetDayId, entry.student.id, false)
            }
            saving={saving}
          />
        ))}
      </div>
    ) : (
      <p className="rounded-2xl border bg-card px-3 py-3 text-sm text-muted-foreground">
        {current
          ? "Nessuna persona assegnata."
          : "Nessuna persona in questa sezione."}
      </p>
    )
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
          className="mb-5 w-full"
          disabled={saving}
          onClick={() => void complete()}
          variant="secondary"
        >
          <Check aria-hidden="true" className="size-4" />
          {saving ? "Salvataggio…" : "Segna completata"}
        </Button>
      )}
      <section aria-label={`Allievi comandata ${day.label}`}>
        <div className="grid gap-5">
          <section>
            <h2 className="mb-2 text-base font-black">
              In {day.label} · {groups.current.length}
            </h2>
            {renderCards(groups.current, true)}
          </section>
          {!completed && (
            <>
              <section aria-label="Mai assegnati">
                <h2 className="mb-2 text-base font-black">
                  Mai assegnati · {groups.never.length}
                </h2>
                {renderCards(groups.never, false)}
              </section>
              <section aria-label="Assegnati ad altri giorni">
                <h2 className="mb-2 text-base font-black">
                  Assegnati ad altri giorni · {groups.elsewhere.length}
                </h2>
                {renderCards(groups.elsewhere, false)}
              </section>
            </>
          )}
        </div>
      </section>
      {error && (
        <p className="mt-3 text-sm font-semibold text-[#a2381b]" role="alert">
          Modifica non salvata. Riprova.
        </p>
      )}
    </>
  )
}

function warningDayIds(warning: DutyWarning): DutyDayId[] {
  if (warning.dayIds) return warning.dayIds
  if (warning.dayId) return [warning.dayId]
  const fromKey = DAY_IDS.filter((dayId) => warning.key.includes(dayId))
  if (fromKey.length > 0) return fromKey
  const detail = warning.detail.toLocaleLowerCase("it-IT")
  return DAY_IDS.filter((dayId) =>
    detail.includes(getDayLabel(dayId).toLocaleLowerCase("it-IT")),
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
              <div className="flex items-start gap-2">
                <AlertTriangle
                  aria-hidden="true"
                  className={`mt-0.5 size-5 shrink-0 ${warning.severity === "major" ? "text-[#b42318]" : "text-[#996515]"}`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-black">{warning.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {warning.detail}
                  </p>
                </div>
              </div>
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
  const [settings, setSettings] = useState<DutySettingsWithExtras | null>(null)
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

  const canonicalSettings = settings
    ? normalizeProposalSettings(settings, students, assignments)
    : null
  const config: DutyConfig | null = canonicalSettings
    ? { ...canonicalSettings, referenceDate }
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
    const canonicalNextSettings: CanonicalDutySettings =
      nextSettings.extraDayIds
        ? (nextSettings as CanonicalDutySettings)
        : normalizeProposalSettings(nextSettings, students, nextAssignments)
    const activeAdvisoryKeys = new Set(
      getDutyWarnings(
        asDutyStudents(students),
        nextAssignments,
        { ...canonicalNextSettings, referenceDate },
        canonicalNextSettings.completedDayIds,
      )
        .filter(({ severity }) => severity === "advisory")
        .map(({ key }) => key),
    )
    const normalizedSettings: DutySettingsWithExtras = {
      ...canonicalNextSettings,
      acknowledgedWarningKeys:
        canonicalNextSettings.acknowledgedWarningKeys.filter((key) =>
          activeAdvisoryKeys.has(key),
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
        assignments={assignments}
        onCancel={() => setScreen({ kind: "list" })}
        onConfirm={async (nextSettings, proposal) => {
          await persist(proposal.assignments, nextSettings)
          setScreen({ kind: "list" })
        }}
        recalculate={screen.recalculate}
        referenceDate={referenceDate}
        settings={canonicalSettings!}
        students={students}
      />
    )
  }

  if (screen.kind === "day") {
    return (
      <DayEditor
        assignments={assignments}
        completedDayIds={settings.completedDayIds}
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
          <div className="sticky top-2 z-10 mb-4 grid gap-2">
            <div className="grid grid-cols-2 gap-2">
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
            {(() => {
              const coverage = getDutyCoverage(
                asDutyStudents(students),
                assignments,
              )
              return (
                <div
                  aria-label={`Copertura comandate ${coverage.assigned}/${coverage.total}`}
                  className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black shadow-sm ${coverage.complete ? "border-[#b8dfbf] bg-[#e9f5eb] text-[#176b2c]" : "border-[#e9d37c] bg-[#fff7df] text-[#78550d]"}`}
                  role="status"
                >
                  <span>
                    {coverage.assigned}/{coverage.total}
                  </span>
                  <span>allievi nelle Comandate</span>
                  {coverage.complete && (
                    <Check aria-hidden="true" className="size-4" />
                  )}
                </div>
              )
            })()}
          </div>
          <section
            aria-label="Piano comandate"
            className="grid grid-cols-2 items-start gap-2.5"
          >
            {DUTY_DAYS.map(({ id, label }) => {
              const dayAssignments = assignments.filter(
                ({ dayId }) => dayId === id,
              )
              const dayEntries = dayAssignments
                .map(({ studentId }) => {
                  const student = students.find(
                    ({ id: candidateId }) => candidateId === studentId,
                  )
                  return {
                    name: student
                      ? getStudentDisplayName(student, students)
                      : "Allievo mancante",
                    student,
                    studentId,
                  }
                })
                .sort((left, right) =>
                  left.name.localeCompare(right.name, "it-IT", {
                    sensitivity: "base",
                  }),
                )
              const names = dayEntries.map(({ name }) => name)
              const completed = settings.completedDayIds.includes(id)
              const dayWarnings = warnings.filter((warning) =>
                warningDayIds(warning).includes(id),
              )
              return (
                <article
                  className={`min-w-0 rounded-2xl border bg-card p-3 shadow-[0_6px_18px_rgb(6_59_82/0.05)] ${completed ? "border-[#b8dfbf]" : ""}`}
                  key={id}
                >
                  <button
                    aria-label={`${label}, ${names.length} assegnati${completed ? ", completata" : ""}`}
                    className="block w-full text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                    onClick={() => setScreen({ kind: "day", dayId: id })}
                    type="button"
                  >
                    <span className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
                      <span aria-hidden="true" />
                      <span className="min-w-0 truncate text-center font-black">
                        {label}
                      </span>
                      <span className="flex shrink-0 items-center justify-self-end gap-1 text-xs font-bold text-muted-foreground">
                        {names.length}
                        {completed && (
                          <Check
                            aria-label="Completata"
                            className="size-3.5 text-[#176b2c]"
                          />
                        )}
                      </span>
                    </span>
                    <span className="my-2 block border-t" />
                    <span
                      className="grid gap-0.5 break-words text-sm leading-5 text-muted-foreground"
                      data-duty-names
                    >
                      {dayEntries.length > 0
                        ? dayEntries.map(({ name, student, studentId }) => {
                            const personWarning = dayWarnings.some(
                              (warning) => warning.studentId === studentId,
                            )
                            return (
                              <span
                                className="flex min-w-0 items-center gap-1"
                                data-student-name={name}
                                key={studentId}
                              >
                                <span className="min-w-0 break-words">
                                  {name}
                                </span>
                                {student &&
                                  isMinor(
                                    student.dateOfBirth,
                                    referenceDate,
                                  ) && (
                                    <span className="grid size-4 shrink-0 place-items-center rounded-full bg-[#d33a4a] text-[9px] font-black text-white">
                                      M
                                    </span>
                                  )}
                                {personWarning && (
                                  <AlertTriangle
                                    aria-label={`Avviso per ${name}`}
                                    className="size-3.5 shrink-0 text-[#b42318]"
                                    role="img"
                                  />
                                )}
                              </span>
                            )
                          })
                        : "Nessun assegnato"}
                    </span>
                  </button>
                  {dayWarnings.length > 0 && (
                    <div className="mt-2 border-t pt-2">
                      <details>
                        <summary className="flex min-h-9 cursor-pointer list-none items-center justify-end gap-1 text-xs font-bold text-[#b42318] outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
                          <AlertTriangle
                            aria-hidden="true"
                            className="size-4"
                          />
                          <span>
                            {dayWarnings.length} avvis
                            {dayWarnings.length === 1 ? "o" : "i"}
                          </span>
                        </summary>
                        <div className="mt-2 grid gap-2">
                          {dayWarnings.map((warning) => (
                            <div
                              className="rounded-xl bg-[#fff1ed] p-2 text-xs"
                              key={warning.key}
                            >
                              <p className="font-black">{warning.title}</p>
                              <p className="mt-0.5 leading-5 text-muted-foreground">
                                {warning.detail}
                              </p>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </article>
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
