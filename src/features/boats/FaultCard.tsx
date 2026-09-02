import { Check, Pencil, Wrench } from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  FAULT_STATES,
  FAULT_STATE_LABELS,
  type FaultState,
} from "@/domain/config"
import {
  updateFaultDescription,
  updateFaultState,
  type FaultRecord,
} from "@/persistence/boats"

export function FaultCard({
  fault,
  boatLabel,
  onChanged,
}: {
  fault: FaultRecord
  boatLabel?: string
  onChanged: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [description, setDescription] = useState(fault.description)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const saveInFlight = useRef(false)

  async function changeState(state: FaultState) {
    if (saveInFlight.current) return
    saveInFlight.current = true
    setSaving(true)
    setError(false)
    try {
      await updateFaultState(fault.id, state)
      await onChanged()
    } catch {
      setError(true)
    } finally {
      saveInFlight.current = false
      setSaving(false)
    }
  }

  async function saveDescription() {
    const value = description.trim()
    if (!value || saveInFlight.current) return
    saveInFlight.current = true
    setSaving(true)
    setError(false)
    try {
      await updateFaultDescription(fault.id, value)
      await onChanged()
      setEditing(false)
    } catch {
      setError(true)
    } finally {
      saveInFlight.current = false
      setSaving(false)
    }
  }

  return (
    <article
      className={`rounded-2xl border p-4 shadow-[0_6px_18px_rgb(6_59_82/0.05)] ${fault.state === "resolved" ? "bg-muted/50" : "bg-card"}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl ${fault.state === "resolved" ? "bg-muted text-muted-foreground" : "bg-[#fff1d6] text-[#9a5b00]"}`}
        >
          <Wrench aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          {boatLabel && (
            <p className="text-xs font-black tracking-wide text-primary uppercase">
              {boatLabel}
            </p>
          )}
          {editing ? (
            <textarea
              aria-label={`Modifica descrizione ${fault.description}`}
              className="mt-1 min-h-20 w-full resize-y rounded-xl border bg-card px-3 py-2 text-base leading-6 outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm font-semibold leading-6">
              {fault.description}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {FAULT_STATE_LABELS[fault.state]}
          </p>
        </div>
        <Button
          aria-label={
            editing
              ? `Salva descrizione ${fault.description}`
              : `Modifica avaria ${fault.description}`
          }
          className="size-11 shrink-0 px-0"
          disabled={saving || (editing && !description.trim())}
          onClick={() => {
            if (editing) void saveDescription()
            else setEditing(true)
          }}
          variant="secondary"
        >
          {editing ? (
            <Check aria-hidden="true" className="size-4" />
          ) : (
            <Pencil aria-hidden="true" className="size-4" />
          )}
        </Button>
      </div>

      <div
        className="mt-3 grid grid-cols-3 gap-1.5"
        role="group"
        aria-label={`Stato avaria ${fault.description}`}
      >
        {FAULT_STATES.map((state) => (
          <Button
            aria-pressed={fault.state === state}
            className="min-w-0 px-1 text-xs aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            disabled={saving}
            key={state}
            onClick={() => void changeState(state)}
            variant="secondary"
          >
            {FAULT_STATE_LABELS[state]}
          </Button>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-sm font-semibold text-[#a2381b]" role="alert">
          Modifica non salvata. Riprova.
        </p>
      )}
    </article>
  )
}
