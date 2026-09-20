import {
  Check,
  ChevronDown,
  LoaderCircle,
  Pencil,
  RotateCcw,
  Wrench,
} from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  FAULT_STATES,
  FAULT_STATE_LABELS,
  type BoatType,
  type FaultState,
} from "@/domain/config"
import { BoatIdentity } from "@/features/boats/BoatIdentity"
import {
  DictationPanels,
  DictationTrigger,
} from "@/features/speech/DictationControls"
import {
  isDictationPending,
  type DictationNaming,
} from "@/features/speech/dictationState"
import {
  useDictation,
  type SpeechPrepare,
  type SpeechTranscribe,
} from "@/features/speech/useDictation"
import {
  updateFaultDescription,
  updateFaultState,
  type FaultRecord,
} from "@/persistence/boats"

type SaveFailure =
  { kind: "description" } | { kind: "state"; state: FaultState }

export function FaultCard({
  fault,
  boatType,
  boatNumber,
  onChanged,
  transcribe,
  prepareSpeech,
}: {
  fault: FaultRecord
  boatType?: BoatType
  boatNumber?: string
  onChanged: () => Promise<void>
  transcribe?: SpeechTranscribe
  prepareSpeech?: SpeechPrepare
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [description, setDescription] = useState(fault.description)
  const [descriptionSaving, setDescriptionSaving] = useState(false)
  const [confirmedState, setConfirmedState] = useState(fault.state)
  const [pendingState, setPendingState] = useState<FaultState | null>(null)
  const [refreshingState, setRefreshingState] = useState(false)
  const [failure, setFailure] = useState<SaveFailure | null>(null)
  const stateInFlightRef = useRef(false)
  const refreshingStateRef = useRef(false)
  const queuedStateRef = useRef<FaultState | null>(null)
  const requestedStateRef = useRef(fault.state)
  const dictation = useDictation({
    value: description,
    onDraft: setDescription,
    onAccept: () => undefined,
    transcribe,
    prepare: prepareSpeech,
  })
  const dictationNaming: DictationNaming = {
    start: "Detta descrizione avaria",
    subject: "descrizione avaria",
  }

  async function persistState(firstState: FaultState) {
    if (stateInFlightRef.current) {
      if (refreshingStateRef.current) return
      if (requestedStateRef.current !== firstState) {
        requestedStateRef.current = firstState
        queuedStateRef.current = firstState
        setPendingState(firstState)
      }
      return
    }

    requestedStateRef.current = firstState
    stateInFlightRef.current = true
    setFailure(null)
    let nextState: FaultState | null = firstState

    try {
      while (nextState) {
        setPendingState(nextState)
        try {
          await updateFaultState(fault.id, nextState)
          setConfirmedState(nextState)
        } catch {
          const retryState = queuedStateRef.current ?? nextState
          requestedStateRef.current = retryState
          queuedStateRef.current = null
          setFailure({ kind: "state", state: retryState })
          return
        }
        nextState = queuedStateRef.current
        queuedStateRef.current = null
      }
      refreshingStateRef.current = true
      setRefreshingState(true)
      try {
        await onChanged()
      } catch {
        setFailure({ kind: "state", state: requestedStateRef.current })
      }
    } finally {
      refreshingStateRef.current = false
      stateInFlightRef.current = false
      setRefreshingState(false)
      setPendingState(null)
    }
  }

  async function saveDescription() {
    const value = description.trim()
    if (!value || descriptionSaving) return
    setDescriptionSaving(true)
    setFailure(null)
    try {
      await updateFaultDescription(fault.id, value)
      setDescription(value)
      await onChanged()
      setEditing(false)
    } catch {
      setFailure({ kind: "description" })
    } finally {
      setDescriptionSaving(false)
    }
  }

  const unresolved = confirmedState !== "resolved"

  return (
    <article
      className={`rounded-2xl border border-l-4 p-3 shadow-[0_6px_18px_rgb(6_59_82/0.05)] max-[380px]:p-2 ${unresolved ? "border-l-[#e0a31a] bg-card" : "border-l-[#7b858a] bg-muted/40"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        {boatType && boatNumber ? (
          <BoatIdentity
            className="max-[380px]:basis-full"
            number={boatNumber}
            type={boatType}
          />
        ) : (
          <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Wrench aria-hidden="true" className="size-5" />
          </span>
        )}
        <Button
          aria-label={
            editing
              ? `Salva descrizione ${fault.description}`
              : `Modifica avaria ${fault.description}`
          }
          className="size-10 shrink-0 px-0"
          disabled={
            descriptionSaving ||
            pendingState !== null ||
            (editing && (!description.trim() || isDictationPending(dictation)))
          }
          onClick={() => {
            if (editing) void saveDescription()
            else setEditing(true)
          }}
          variant="secondary"
        >
          {descriptionSaving ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : editing ? (
            <Check aria-hidden="true" className="size-4" />
          ) : (
            <Pencil aria-hidden="true" className="size-4" />
          )}
        </Button>
      </div>

      {editing ? (
        <div className="mt-2 grid gap-2">
          <textarea
            aria-label={`Modifica descrizione ${fault.description}`}
            className="min-h-24 w-full resize-y rounded-xl border bg-card px-3 py-2 text-base font-normal leading-6 outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
            onChange={(event) => {
              dictation.syncValue(event.target.value)
              setDescription(event.target.value)
            }}
            value={description}
          />
          <div className="flex justify-end">
            <DictationTrigger dictation={dictation} naming={dictationNaming} />
          </div>
          <DictationPanels
            dictation={dictation}
            naming={dictationNaming}
            reviewHint="Rileggi la trascrizione prima di salvare la descrizione."
          />
        </div>
      ) : (
        <button
          aria-expanded={expanded}
          aria-label={`${expanded ? "Riduci" : "Apri"} descrizione: ${fault.description}`}
          className="mt-2 flex min-h-11 w-full items-start gap-1 rounded-lg text-left text-sm font-normal leading-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          <span
            className={`min-w-0 flex-1 whitespace-pre-wrap ${expanded ? "" : "line-clamp-3"}`}
          >
            {fault.description}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      )}

      <div
        aria-busy={pendingState !== null}
        aria-label={`Stato avaria ${fault.description}`}
        className="mt-2 grid grid-cols-3 gap-1 max-[380px]:grid-cols-1"
        role="group"
      >
        {FAULT_STATES.map((state) => (
          <Button
            aria-pressed={confirmedState === state}
            className={`h-10 min-w-0 px-1 text-xs aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground ${pendingState === state ? "ring-2 ring-primary/35" : ""}`}
            disabled={descriptionSaving || editing || refreshingState}
            key={state}
            onClick={() => void persistState(state)}
            variant="secondary"
          >
            {pendingState === state && (
              <LoaderCircle
                aria-hidden="true"
                className="size-3.5 animate-spin"
              />
            )}
            {FAULT_STATE_LABELS[state]}
          </Button>
        ))}
      </div>

      {pendingState && (
        <p
          aria-live="polite"
          className="mt-2 text-xs text-muted-foreground"
          role="status"
        >
          Salvataggio stato…
        </p>
      )}

      {failure && (
        <div
          className="mt-2 flex items-center justify-between gap-3"
          role="alert"
        >
          <p className="text-xs font-semibold text-[#a2381b]">
            Modifica non salvata. Il testo e la scelta restano qui.
          </p>
          <Button
            className="h-10 shrink-0 px-3 text-xs"
            onClick={() => {
              if (failure.kind === "state") void persistState(failure.state)
              else void saveDescription()
            }}
            type="button"
            variant="secondary"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            Riprova
          </Button>
        </div>
      )}
    </article>
  )
}
