import { useState } from "react"

import { transcribeAudio } from "@/capabilities/speech"
import { Button } from "@/components/ui/button"
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
  type SpeechPrepare,
  type SpeechTranscribe,
  useDictation,
} from "@/features/speech/useDictation"
import {
  createFault,
  type BoatRecord,
  type FaultRecord,
} from "@/persistence/boats"

export function FaultForm({
  boats,
  fixedBoatId,
  onCancel,
  onSaved,
  transcribe = transcribeAudio,
  prepareSpeech,
}: {
  boats: BoatRecord[]
  fixedBoatId?: string
  onCancel: () => void
  onSaved: (fault: FaultRecord) => void | Promise<void>
  transcribe?: SpeechTranscribe
  prepareSpeech?: SpeechPrepare
}) {
  const [boatId, setBoatId] = useState(fixedBoatId ?? boats[0]?.id ?? "")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const selectedBoat = boats.find((boat) => boat.id === boatId)

  const dictation = useDictation({
    value: description,
    onDraft: setDescription,
    onTranscript: () => undefined,
    transcribe,
    prepare: prepareSpeech,
  })
  const dictationNaming: DictationNaming = {
    start: "Detta avaria",
    subject: "avaria",
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = description.trim()
    if (!boatId || !value) return
    setSaving(true)
    setSaveError(false)
    try {
      await onSaved(await createFault(boatId, value))
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  function cancelForm() {
    if (dictation.status !== "idle") dictation.cancel()
    onCancel()
  }

  return (
    <form
      className="grid gap-4 rounded-2xl border bg-card p-4 shadow-[0_6px_18px_rgb(6_59_82/0.05)]"
      onSubmit={save}
    >
      {fixedBoatId && selectedBoat ? (
        <BoatIdentity number={selectedBoat.number} type={selectedBoat.type} />
      ) : (
        <label className="grid gap-2 text-sm font-bold">
          <span>Barca</span>
          <select
            className="h-12 min-w-0 rounded-xl border bg-card px-3 text-base outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
            onChange={(event) => setBoatId(event.target.value)}
            required
            value={boatId}
          >
            {boats.map((boat) => (
              <option key={boat.id} value={boat.id}>
                {boat.type} {boat.number}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-2 text-sm font-bold">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <label className="min-w-0" htmlFor="fault-description">
            Descrizione
          </label>
          <DictationTrigger dictation={dictation} naming={dictationNaming} />
        </div>
        <textarea
          className="min-h-32 resize-y rounded-xl border bg-card px-3 py-2.5 text-base font-normal leading-6 outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
          id="fault-description"
          onChange={(event) => {
            const nextDescription = event.target.value
            dictation.syncValue(nextDescription)
            setDescription(nextDescription)
          }}
          placeholder="Es. scotta randa senza anima"
          required
          value={description}
        />
      </div>

      <DictationPanels dictation={dictation} naming={dictationNaming} />

      {saveError && (
        <p className="text-sm font-semibold text-[#a2381b]" role="alert">
          L’avaria non è stata salvata. Il testo resta qui; riprova.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={cancelForm} type="button" variant="secondary">
          Annulla
        </Button>
        <Button
          disabled={
            !boatId ||
            !description.trim() ||
            saving ||
            isDictationPending(dictation)
          }
          type="submit"
        >
          {saving
            ? "Salvataggio…"
            : saveError
              ? "Riprova salvataggio"
              : "Salva avaria"}
        </Button>
      </div>
    </form>
  )
}
