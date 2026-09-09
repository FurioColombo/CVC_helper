import {
  Check,
  LoaderCircle,
  Mic,
  RotateCcw,
  Square,
  Trash2,
  X,
} from "lucide-react"
import { useState } from "react"

import { transcribeAudio } from "@/capabilities/speech"
import { Button } from "@/components/ui/button"
import { BoatIdentity } from "@/features/boats/BoatIdentity"
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
    onAccept: () => undefined,
    transcribe,
    prepare: prepareSpeech,
  })
  const dictationBusy = new Set(["permission", "loading", "processing"]).has(
    dictation.status,
  )
  const dictationProgress =
    dictation.status === "loading" && dictation.loadPercent !== undefined
      ? ` ${dictation.loadPercent}%`
      : ""

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = description.trim()
    if (!boatId || !value || dictation.status === "review") return
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
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="fault-description">Descrizione</label>
          <Button
            aria-label={
              dictation.status === "recording"
                ? "Termina dettatura avaria"
                : "Detta avaria"
            }
            className={`h-11 px-3 text-xs ${dictation.status === "recording" ? "border-[#d92d20] text-[#b42318]" : ""}`}
            disabled={
              !dictation.supported ||
              dictationBusy ||
              dictation.status === "review"
            }
            onClick={() =>
              dictation.status === "recording"
                ? dictation.stop()
                : void dictation.start()
            }
            type="button"
            variant="secondary"
          >
            {dictationBusy ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : dictation.status === "recording" ? (
              <Square aria-hidden="true" className="size-3.5 fill-current" />
            ) : (
              <Mic aria-hidden="true" className="size-4" />
            )}
            {dictation.status === "recording"
              ? "Termina"
              : dictation.status === "permission"
                ? "Permesso…"
                : dictation.status === "loading"
                  ? `Caricamento${dictationProgress}`
                  : dictation.status === "processing"
                    ? "Elaborazione…"
                    : "Detta"}
          </Button>
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

      {!dictation.supported && dictation.status === "idle" && (
        <p className="text-xs text-muted-foreground">
          Dettatura non disponibile in questo browser. Puoi scrivere la
          descrizione.
        </p>
      )}

      {(dictation.status === "permission" ||
        dictation.status === "recording" ||
        dictation.status === "loading" ||
        dictation.status === "processing") && (
        <div
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2"
          role="status"
        >
          <p className="text-xs font-semibold text-muted-foreground">
            {dictation.status === "permission"
              ? "Attendo il permesso del microfono…"
              : dictation.status === "recording"
                ? "Registrazione in corso"
                : dictation.status === "loading"
                  ? `Caricamento del modello vocale${dictationProgress}…`
                  : "Elaborazione locale dell’audio…"}
          </p>
          <Button
            aria-label="Annulla dettatura avaria"
            className="size-10 shrink-0 p-0"
            onClick={dictation.cancel}
            type="button"
            variant="secondary"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
      )}

      {dictation.status === "review" && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs leading-5 text-muted-foreground">
            Rileggi la trascrizione. Puoi modificarla prima di usarla.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              aria-label="Scarta trascrizione avaria"
              onClick={dictation.cancel}
              type="button"
              variant="secondary"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Scarta
            </Button>
            <Button
              aria-label="Usa trascrizione avaria"
              onClick={dictation.accept}
              type="button"
            >
              <Check aria-hidden="true" className="size-4" />
              Usa testo
            </Button>
          </div>
        </div>
      )}

      {dictation.status === "error" && (
        <div className="flex items-start justify-between gap-3" role="alert">
          <p className="text-xs font-semibold text-[#a2381b]">
            {dictation.error === "permission"
              ? "Permesso microfono non concesso. Il testo è rimasto invariato."
              : "Dettatura non riuscita. Il testo è rimasto invariato."}
          </p>
          <Button
            aria-label="Riprovare dettatura avaria"
            className="h-10 shrink-0 px-3 text-xs"
            onClick={() => void dictation.start()}
            type="button"
            variant="secondary"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            Riprova
          </Button>
        </div>
      )}

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
            dictationBusy ||
            dictation.status === "recording" ||
            dictation.status === "review"
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
