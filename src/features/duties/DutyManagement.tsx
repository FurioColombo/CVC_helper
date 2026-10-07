import {
  AlertTriangle,
  BookOpenText,
  Check,
  ChevronLeft,
  ClipboardCheck,
  Plus,
  RefreshCw,
  Settings2,
  X,
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
import { MinorBadge } from "@/components/PersonBadges"
import { SummaryImageButton } from "@/components/SummaryImageButton"
import { DUTY_DAYS, type DutyDayId, type DutyTieBreaker } from "@/domain/config"
import {
  generateDutyProposal,
  getDutyCoverage,
  getDutyDistributionRequirement,
  getDutyWarnings,
  getVisibleDutyWarnings,
  groupDutyStudentsForDay,
  ignoreMissingStudentDuties,
  setStudentDutyForDay,
  type DutyAssignment,
  type DutyConfig,
  type DutyProposal,
  type DutyStudent,
  type DutyStudentDayGroupEntry,
  type DutyWarning,
} from "@/domain/duties"
import { blockingIssues, validateDutyRecords } from "@/domain/invariants"
import { getStudentDisplayName, isStudentMinor } from "@/domain/student"
import { makeSummaryFilename } from "@/lib/summaryShare"
import { useNestedScreen } from "@/navigation/nestedScreen"
import {
  readDutyPlan,
  saveDutyPlan,
  type DutySettingsRecord,
} from "@/persistence/duties"
import { listStudents, type StudentRecord } from "@/persistence/students"
import {
  buildDutySummarySections,
  dutySummaryWarning,
  type DutySummaryDayLine,
  type DutySummaryMember,
  type DutySummarySections,
} from "@/features/duties/dutySummaryModel"

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

function parseDutyScreen(value: unknown): DutyScreen | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as {
    kind?: unknown
    recalculate?: unknown
    dayId?: unknown
  }
  if (candidate.kind === "list" || candidate.kind === "warnings") {
    return { kind: candidate.kind }
  }
  if (
    candidate.kind === "configure" &&
    typeof candidate.recalculate === "boolean"
  ) {
    return { kind: "configure", recalculate: candidate.recalculate }
  }
  if (
    candidate.kind === "day" &&
    typeof candidate.dayId === "string" &&
    DAY_IDS.includes(candidate.dayId as DutyDayId)
  ) {
    return { kind: "day", dayId: candidate.dayId as DutyDayId }
  }
  return null
}
// Derived from `DUTY_DAYS`'s own `short` field rather than repeated here:
// `dutySummaryModel.ts` reads the same canonical abbreviations for the F3
// Comandate summary, so a future change to a day's short label only has to
// happen once.
const SHORT_DAY_LABELS: Record<DutyDayId, string> = Object.fromEntries(
  DUTY_DAYS.map(({ id, short }) => [id, short]),
) as Record<DutyDayId, string>

function getDayLabel(dayId: DutyDayId) {
  return DUTY_DAYS.find(({ id }) => id === dayId)?.label ?? dayId
}

function asDutyStudents(students: StudentRecord[]): DutyStudent[] {
  return students.map(
    ({
      id,
      firstName,
      surname,
      nickname,
      dateOfBirth,
      declaredAgeAtCourseStart,
      sex,
      active,
    }) => ({
      id,
      firstName,
      surname,
      nickname,
      dateOfBirth,
      declaredAgeAtCourseStart,
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
  const [students, storedPlan] = await Promise.all([
    listStudents(courseId),
    readDutyPlan(courseId),
  ])
  // A duty for a student the course no longer has is dropped from view (and
  // reported) rather than refusing to open the page that could fix the plan.
  const plan = ignoreMissingStudentDuties(students, storedPlan)
  const settings = plan.settings ?? defaultSettings(students)
  if (
    blockingIssues(
      validateDutyRecords(students, plan.assignments, settings.completedDayIds),
    ).length > 0
  ) {
    throw new Error("Persisted duty state violates invariants")
  }
  return {
    students,
    assignments: plan.assignments,
    settings: settings as DutySettingsWithExtras,
  }
}

function DutyHeader({
  title,
  onBack,
  action,
}: {
  title: string
  onBack: () => void
  /** An optional trailing icon button (F3's "Apri riepilogo comandate"),
   *  balancing the leading Back button the way `CrewHeader`'s own read/boats
   *  buttons do. The other `DutyHeader` call sites pass nothing and keep the
   *  plain spacer. */
  action?: React.ReactNode
}) {
  return (
    // The title shares the row with the two 44 px buttons. When the text is
    // enlarged until the longest word no longer fits beside them (200% text at
    // 320 px: "Comandate" broke in the middle), the title takes a row of its own
    // under the buttons, as the crew header does. The query is on the width of
    // the header in rem, so it only triggers when the text is the problem.
    <div className="@container mb-5 min-w-0">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-1 max-[350px]:items-start">
        <button
          aria-label={`Indietro da ${title}`}
          className="grid size-[44px] shrink-0 place-items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          onClick={onBack}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <h1 className="min-w-0 flex-1 break-words text-center text-2xl font-black tracking-tight [overflow-wrap:anywhere] max-[350px]:text-xl max-[350px]:leading-tight @max-[14rem]:order-last @max-[14rem]:basis-full @max-[14rem]:text-left">
          {title}
        </h1>
        {action ?? (
          <span
            aria-hidden="true"
            className="size-[44px] shrink-0 @max-[14rem]:hidden"
          />
        )}
      </div>
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
    <label className="flex min-h-12 min-w-0 max-w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-2.5 max-[350px]:min-h-[48px] max-[350px]:gap-[8px] max-[350px]:px-[12px] max-[350px]:py-[8px]">
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
  courseStartDate,
  recalculate,
  onCancel,
  onConfirm,
}: {
  students: StudentRecord[]
  settings: CanonicalDutySettings
  assignments: DutyAssignment[]
  courseStartDate: string
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
        { ...draft, courseStartDate },
        recalculate || draft.completedDayIds.length > 0 ? assignments : [],
        draft.completedDayIds.length > 0 ? draft.completedDayIds : [],
      )
    } catch {
      return null
    }
  }, [assignments, courseStartDate, draft, recalculate, students])

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
              {proposalStudentCount === 1
                ? "1 allievo"
                : `${proposalStudentCount} allievi`}{" "}
              ·{" "}
              {remainingDayIds.length === 1
                ? "1 giorno"
                : `${remainingDayIds.length} giorni`}
              {distribution.extraDayCount > 0 &&
                ` · ${distribution.extraDayCount} ${distribution.extraDayCount === 1 ? "posto" : "posti"} extra`}
            </span>
          </span>
        </section>

        {remainingDayIds.length === 0 && (
          <p
            className="break-words rounded-2xl border bg-card p-3 text-sm leading-5 text-muted-foreground"
            role="status"
          >
            Tutte le comandate sono completate: non resta niente da distribuire.
          </p>
        )}

        <fieldset className="min-w-0 max-w-full">
          <legend className="break-words text-sm font-black">
            Giorni con più persone
          </legend>
          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
            Scegli esattamente {distribution.extraDayCount}{" "}
            {distribution.extraDayCount === 1 ? "giorno" : "giorni"}.
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
  courseStartDate,
  current,
  completed,
  saving,
  onAdd,
  onRemove,
}: {
  entry: DutyStudentDayGroupEntry
  allStudents: StudentRecord[]
  completedDayIds: readonly DutyDayId[]
  courseStartDate: string
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
      className={`flex min-w-0 items-center gap-1 rounded-2xl border bg-card p-1.5 shadow-[0_4px_14px_rgb(6_59_82/0.04)] max-[350px]:gap-[2px] max-[350px]:p-[4px] ${hasMultipleDays ? "col-span-2" : ""}`}
    >
      {current ? (
        <span
          className="flex min-h-10 min-w-0 flex-1 items-center truncate px-1 text-left text-sm font-bold max-[350px]:min-h-[40px] max-[350px]:break-words max-[350px]:px-[2px] max-[350px]:whitespace-normal"
          title={name}
        >
          {name}
        </span>
      ) : (
        <button
          aria-label={name}
          className="flex min-h-10 min-w-0 flex-1 items-center gap-1 rounded-xl px-1 text-left text-sm font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/40 max-[350px]:min-h-[40px] max-[350px]:min-w-[40px] max-[350px]:gap-[2px] max-[350px]:rounded-none max-[350px]:px-[2px] max-[350px]:text-primary max-[350px]:shadow-[inset_2px_0_0_#b9d4ec]"
          disabled={completed || saving}
          onClick={onAdd}
          title={name}
          type="button"
        >
          <span className="min-w-0 flex-1 truncate max-[350px]:break-words max-[350px]:whitespace-normal">
            {name}
          </span>
          <Plus
            aria-hidden="true"
            className="size-4 shrink-0 text-primary max-[350px]:hidden"
          />
        </button>
      )}
      {isStudentMinor(student, courseStartDate) && <MinorBadge />}
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
      <div className="flex shrink-0 items-center gap-0.5 max-[350px]:gap-[2px]">
        {dayIds.map((assignedDayId) => (
          <span className="flex items-center gap-0.5" key={assignedDayId}>
            <span
              aria-label={`${getDayLabel(assignedDayId)} assegnato`}
              className="rounded-md bg-muted px-1.5 py-1 text-[10px] font-black text-muted-foreground max-[350px]:px-[4px] max-[350px]:py-[2px]"
              title={getDayLabel(assignedDayId)}
            >
              {SHORT_DAY_LABELS[assignedDayId]}
            </span>
            {!completedDayIds.includes(assignedDayId) ? (
              <button
                aria-label={`Rimuovi ${name} da ${getDayLabel(assignedDayId)}`}
                className="grid size-10 place-items-center rounded-xl text-[#b42318] outline-none hover:bg-[#fff1ed] focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-40 max-[350px]:size-[40px]"
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
  courseStartDate,
  onBack,
  onSave,
  onComplete,
}: {
  dayId: DutyDayId
  students: StudentRecord[]
  assignments: DutyAssignment[]
  completedDayIds: readonly DutyDayId[]
  completed: boolean
  courseStartDate: string
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
      <div className="grid grid-cols-2 items-start gap-2 max-[350px]:gap-[4px]">
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
            courseStartDate={courseStartDate}
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

// The read view's own completed-day green: the same colour
// `border-[#b8dfbf]`/`text-[#176b2c]` the P11 list already uses for a
// completed day card and its check mark, reused here rather than invented.
const SUMMARY_COMPLETED_COLOR = "#176b2c"
const SUMMARY_ACCENT_COLOR = "#0b526b"

/**
 * F3 (owner, 2026-09-28): "the summary of the Comandate in a similar format
 * [to the crew summary]." One card per duty day, same visual language as
 * `AnnouncementCrewCard` in `CrewManagement.tsx` — a 4px class-colour edge, a
 * fixed left column top-aligned with the first name, a corner warning badge —
 * with the day's own short label standing in for a boat number and green
 * standing in for "completata".
 */
function DutySummaryDayCard({
  day,
}: {
  day: DutySummarySections["days"][number]
}) {
  const edgeColor = day.completed
    ? SUMMARY_COMPLETED_COLOR
    : SUMMARY_ACCENT_COLOR
  return (
    <li
      aria-label={`${day.label}, ${day.members.length} assegnati${day.completed ? ", completata" : ""}`}
      className="relative flex min-w-0 overflow-hidden rounded-[10px] border border-[#c8d7db] bg-white"
    >
      <span
        aria-hidden="true"
        className="w-1 shrink-0"
        style={{ backgroundColor: edgeColor }}
      />
      <div className="flex min-w-0 flex-1 gap-2.5 px-3 py-2.5">
        {/* In rem, like the label inside it: a fixed 34px column let the
            label run into the names once the phone enlarged its text. */}
        <span
          className="flex w-[2.25rem] shrink-0 flex-col gap-0.5 pt-px"
          style={{ color: edgeColor }}
        >
          <span className="block text-base leading-none font-black tracking-tight">
            {day.shortLabel}
          </span>
          {day.completed && (
            <Check aria-label="Completata" className="size-3" />
          )}
        </span>
        {/* `pr-5` keeps every name clear of the 16px corner warning badge. */}
        <div
          className={`grid min-w-0 flex-1 content-start gap-px ${day.warning ? "pr-5" : ""}`}
        >
          {day.members.length === 0 ? (
            <span className="text-sm font-bold text-muted-foreground">
              Nessun assegnato
            </span>
          ) : (
            day.members.map((member, index) => (
              <div
                className="flex min-w-0 items-center gap-1"
                key={`${day.dayId}:${index}:${member.label}`}
              >
                <span className="min-w-0 break-words text-[13.5px] leading-4 font-bold [overflow-wrap:anywhere] text-[#102f3b]">
                  {member.label}
                </span>
                {member.isMinor && <MinorBadge />}
              </div>
            ))
          )}
        </div>
      </div>
      {day.warning && (
        <span
          aria-label={`Avviso comandata: ${day.warning.severity === "red" ? "rosso" : "giallo"}`}
          className={`absolute top-2 right-2 grid size-4 shrink-0 place-items-center rounded-[7px] ${day.warning.severity === "red" ? "bg-[#fee4e2] text-[#b42318]" : "bg-[#fff3cd] text-[#8a5a00]"}`}
          role="img"
        >
          <AlertTriangle aria-hidden="true" className="size-2.5" />
        </span>
      )}
    </li>
  )
}

function handleSummaryDialogKeyDown(
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

/**
 * The Comandate counterpart of `AnnouncementView` in `CrewManagement.tsx`:
 * same header grammar (eyebrow, title, close), the same floating "Copia
 * immagine" button (F4: a screenshot of `captureRef`'s content, copied), same
 * text-size-aware column rule
 * (`minmax(min(100%,8.8rem),1fr)`, see that file's own comment for why 8.8rem
 * keeps two columns from 320 CSS px and collapses to one at the 320 px/200%
 * text stress). Reachable only once a rota exists (`DutyManagement`'s own
 * "list" branch gates the opening button on `assignments.length > 0`).
 */
function DutySummaryView({
  summary,
  onClose,
}: {
  summary: DutySummarySections
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLElement>(null)
  // What the saved image is a screenshot of: this content, not the dialog.
  const captureRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previouslyFocused = document.activeElement
    dialogRef.current
      ?.querySelector<HTMLElement>("button:not(:disabled)")
      ?.focus()
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [])
  // The seven-day list underneath keeps its own normal-flow height even
  // while this full-screen overlay covers it, so a plan tall enough to need
  // its own scroll (a real Comandate week at 320 px/200% text) makes the
  // page itself scrollable behind the dialog. That is not just wasted
  // motion: `position: fixed; inset-x-0` elements (the app's bottom nav)
  // then measure their own width against the browser's scrollbar-inclusive
  // viewport instead of `documentElement.clientWidth`, a few CSS px wider
  // than the page — a real R18 violation
  // (docs/post-mvp/06_DESIGN_RULEBOOK.md §2's "no horizontal scroll",
  // measured as `scrollWidth <= clientWidth`). Locking the page's own scroll
  // for as long as this reads-everything-at-once overlay is open — the
  // standard modal pattern — removes the underlying scrollbar entirely, so
  // the quirk never triggers; the dialog's own `overflow-y-auto` remains the
  // only way to reach content past one screen.
  useEffect(() => {
    const html = document.documentElement
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = document.body.style.overflow
    html.style.overflow = "hidden"
    document.body.style.overflow = "hidden"
    return () => {
      html.style.overflow = previousHtmlOverflow
      document.body.style.overflow = previousBodyOverflow
    }
  }, [])

  return (
    <section
      aria-label="Vista lettura comandate"
      aria-modal="true"
      className="fixed inset-0 z-60 overflow-y-auto bg-[#fffdf8] text-[#102f3b]"
      onKeyDown={(event) =>
        handleSummaryDialogKeyDown(event, dialogRef.current, onClose)
      }
      ref={dialogRef}
      role="dialog"
    >
      {/* The bottom padding keeps the last card clear of the floating copy
          button; the image has a plain 16px above and below instead. */}
      <div
        className="mx-auto min-h-full w-full max-w-2xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))]"
        ref={captureRef}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#c8d7db] pb-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-black tracking-[0.14em] uppercase">
              Comandate
            </p>
            <h1
              className="mt-0.5 break-words text-xl font-black leading-tight [overflow-wrap:anywhere]"
              id="duty-summary-title"
            >
              {summary.title}
            </h1>
          </div>
          <button
            aria-label="Chiudi vista lettura"
            className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[#c8d7db] bg-white outline-none focus-visible:ring-3 focus-visible:ring-[#0b526b]/30"
            data-snapshot-exclude="true"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>
        <ul className="mt-1.5 grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,8.8rem),1fr))]">
          {summary.days.map((day) => (
            <DutySummaryDayCard day={day} key={day.dayId} />
          ))}
        </ul>
      </div>
      <SummaryImageButton
        captureRef={captureRef}
        filename={makeSummaryFilename(summary.title, "riepilogo-comandate")}
      />
    </section>
  )
}

export function DutyManagement({
  courseId,
  courseStartDate,
  onHome,
}: {
  courseId: string
  courseStartDate: string
  onHome: () => void
}) {
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [assignments, setAssignments] = useState<DutyAssignment[]>([])
  const [settings, setSettings] = useState<DutySettingsWithExtras | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [screen, openScreen, closeScreen] = useNestedScreen<DutyScreen>(
    "duties",
    { kind: "list" },
    parseDutyScreen,
  )
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  )
  // A plain boolean, not a `DutyScreen` variant: the F3 summary is a
  // read-only overlay atop the list screen, the same architectural choice
  // `CrewManagement.tsx`'s own `readMode` makes for `AnnouncementView`,
  // closed by its own X/Escape rather than the app's Back navigation.
  const [showSummary, setShowSummary] = useState(false)

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
    ? { ...canonicalSettings, courseStartDate }
    : null
  const warnings = config
    ? getDutyWarnings(
        asDutyStudents(students),
        assignments,
        config,
        settings?.completedDayIds,
      )
    : []
  const visibleWarnings = getVisibleDutyWarnings(
    warnings,
    settings?.acknowledgedWarningKeys ?? [],
  )
  const visibleWarningCount = visibleWarnings.length

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
        { ...canonicalNextSettings, courseStartDate },
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

  // The one model the read view renders and the PNG export rasterises
  // (`dutySummaryModel.ts`), built once here from the same `assignments`,
  // `students` and `visibleWarnings` the list screen's own day cards already
  // use above, so a fix to the grouping or the warning rule reaches both the
  // summary and the ordinary P11 list at once. `buildDutySummarySections`
  // places the seven lines in canonical day order and sorts each day's names,
  // so this map does not have to.
  const dutySummary: DutySummarySections = buildDutySummarySections({
    title: "Riepilogo comandate",
    lines: DAY_IDS.map((dayId): DutySummaryDayLine => {
      const dayMembers: DutySummaryMember[] = assignments
        .filter((assignment) => assignment.dayId === dayId)
        .map(({ studentId }) => {
          const student = students.find(({ id }) => id === studentId)
          return {
            label: student
              ? getStudentDisplayName(student, students)
              : "Allievo mancante",
            isMinor: student ? isStudentMinor(student, courseStartDate) : false,
          }
        })
      const dayWarnings = visibleWarnings.filter((warning) =>
        warningDayIds(warning).includes(dayId),
      )
      return {
        dayId,
        members: dayMembers,
        completed: settings.completedDayIds.includes(dayId),
        warning: dutySummaryWarning(dayWarnings),
      }
    }),
  })

  if (screen.kind === "configure") {
    return (
      <DutyConfiguration
        assignments={assignments}
        onCancel={() => closeScreen({ kind: "list" })}
        onConfirm={async (nextSettings, proposal) => {
          await persist(proposal.assignments, nextSettings)
          closeScreen({ kind: "list" })
        }}
        recalculate={screen.recalculate}
        courseStartDate={courseStartDate}
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
        onBack={() => closeScreen({ kind: "list" })}
        onComplete={async () => {
          await persist(assignments, {
            ...settings,
            completedDayIds: [...settings.completedDayIds, screen.dayId],
          })
          closeScreen({ kind: "list" })
        }}
        onSave={(next) => persist(next, settings)}
        courseStartDate={courseStartDate}
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
        onBack={() => closeScreen({ kind: "list" })}
        warnings={warnings}
      />
    )
  }

  return (
    <>
      {showSummary && (
        <DutySummaryView
          onClose={() => setShowSummary(false)}
          summary={dutySummary}
        />
      )}
      <DutyHeader
        action={
          // "Once a rota exists (only then)" (owner): the same condition the
          // screen itself already uses just below to choose the seven-day
          // grid over "Nessuna comandata pianificata" — an assignment or a
          // completed day (even one completed with nobody on it) is a rota;
          // an untouched manual-mode grid with neither is not, so the entry
          // point stays off the plain spacer until there is something to
          // read.
          assignments.length > 0 || settings.completedDayIds.length > 0 ? (
            <button
              aria-label="Apri riepilogo comandate"
              className="grid size-[44px] shrink-0 place-items-center rounded-xl border bg-card text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              onClick={() => setShowSummary(true)}
              type="button"
            >
              <BookOpenText aria-hidden="true" className="size-[20px]" />
            </button>
          ) : undefined
        }
        onBack={onHome}
        title="Comandate"
      />
      {students.length === 0 ? (
        <section className="rounded-3xl border bg-card p-5 text-center max-[350px]:p-[12px]">
          <ClipboardCheck
            aria-hidden="true"
            className="mx-auto size-8 text-primary"
          />
          <h2 className="mt-4 break-words text-xl font-black [overflow-wrap:anywhere]">
            Prima aggiungi gli allievi
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            La proposta usa gli allievi attivi del corso.
          </p>
        </section>
      ) : assignments.length === 0 &&
        settings.completedDayIds.length === 0 &&
        !manualMode ? (
        <section className="rounded-3xl border bg-card p-5 text-center max-[350px]:p-[12px]">
          <ClipboardCheck
            aria-hidden="true"
            className="mx-auto size-9 text-primary"
          />
          <h2 className="mt-4 break-words text-xl font-black [overflow-wrap:anywhere]">
            Nessuna comandata pianificata
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Crea una proposta uniforme, poi modificala liberamente.
          </p>
          {/* A grid track is sized by its widest item's own content, and a
              button will not shrink below its longest word plus its padding. At
              200% text "Configura manualmente" needs more than this card gives
              it, so the row pushed the page sideways. Same treatment as the
              heading above: let it shrink and let the word break. */}
          <div className="mt-6 grid min-w-0 gap-2">
            <Button
              className="w-full min-w-0 break-words [overflow-wrap:anywhere]"
              onClick={() =>
                openScreen({ kind: "configure", recalculate: false })
              }
              size="lg"
            >
              Proponi comandate
            </Button>
            <Button
              className="w-full min-w-0 break-words [overflow-wrap:anywhere]"
              onClick={() => setManualMode(true)}
              size="lg"
              variant="secondary"
            >
              Configura manualmente
            </Button>
          </div>
        </section>
      ) : (
        // The page is the query container, so the Ricalcola / Avvisi / coverage
        // block can stop being sticky when the text is enlarged until it would
        // hold more than half of the screen under the list (rulebook R12).
        <div className="@container">
          <div className="sticky top-2 z-10 mb-4 grid gap-2 @max-[14rem]:static">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2">
              <Button
                className="h-auto min-h-[44px] min-w-0 py-[8px]"
                onClick={() =>
                  openScreen({ kind: "configure", recalculate: true })
                }
                variant="secondary"
              >
                <RefreshCw aria-hidden="true" className="size-4" />
                Ricalcola
              </Button>
              <Button
                className="h-auto min-h-[44px] min-w-0 py-[8px]"
                onClick={() => openScreen({ kind: "warnings" })}
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
                  className={`flex flex-wrap items-center justify-center gap-x-2 rounded-2xl border px-4 py-2.5 text-center text-sm font-black shadow-sm ${coverage.complete ? "bg-card text-foreground" : "border-[#e9d37c] bg-[#fff7df] text-[#78550d]"}`}
                  role="status"
                >
                  <span>
                    {coverage.assigned}/{coverage.total}
                  </span>
                  <span>allievi nelle Comandate</span>
                </div>
              )
            })()}
          </div>
          <section
            aria-label="Piano comandate"
            className="grid grid-cols-[repeat(auto-fill,minmax(max(8.5rem,calc((100%_-_0.625rem)/2_-_0.5px)),1fr))] items-start gap-2.5"
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
              const dayWarnings = visibleWarnings.filter((warning) =>
                warningDayIds(warning).includes(id),
              )
              const dayHasMajorWarning = dayWarnings.some(
                ({ severity }) => severity === "major",
              )
              return (
                <article
                  className={`min-w-0 rounded-2xl border bg-card p-3 shadow-[0_6px_18px_rgb(6_59_82/0.05)] ${completed ? "border-[#b8dfbf]" : ""}`}
                  key={id}
                >
                  <button
                    aria-label={`${label}, ${names.length} assegnati${completed ? ", completata" : ""}`}
                    className="block w-full text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                    onClick={() => openScreen({ kind: "day", dayId: id })}
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
                                  isStudentMinor(student, courseStartDate) && (
                                    <MinorBadge />
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
                        <summary
                          className={`flex min-h-10 cursor-pointer list-none items-center justify-end gap-1 text-xs font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/40 ${dayHasMajorWarning ? "text-[#b42318]" : "text-[#996515]"}`}
                        >
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
                              className={`rounded-xl p-2 text-xs ${warning.severity === "major" ? "bg-[#fff1ed]" : "bg-[#fff7df]"}`}
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
                openScreen({ kind: "configure", recalculate: false })
              }
              variant="secondary"
            >
              <Settings2 aria-hidden="true" className="size-4" />
              Rigenera intera proposta
            </Button>
          )}
        </div>
      )}
    </>
  )
}
