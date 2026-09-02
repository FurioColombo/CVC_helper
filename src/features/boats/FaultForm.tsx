import { Mic, Square } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { transcribeAudio } from "@/capabilities/speech"
import { Button } from "@/components/ui/button"
import {
  createFault,
  type BoatRecord,
  type FaultRecord,
} from "@/persistence/boats"

type VoiceStatus = "idle" | "recording" | "transcribing" | "ready" | "error"

export function FaultForm({
  boats,
  fixedBoatId,
  onCancel,
  onSaved,
  transcribe = transcribeAudio,
}: {
  boats: BoatRecord[]
  fixedBoatId?: string
  onCancel: () => void
  onSaved: (fault: FaultRecord) => void | Promise<void>
  transcribe?: (audio: Blob) => Promise<string>
}) {
  const [boatId, setBoatId] = useState(fixedBoatId ?? boats[0]?.id ?? "")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle")
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  useEffect(
    () => () => {
      const recorder = recorderRef.current
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null
        recorder.stop()
      }
      chunksRef.current = []
      stopStream()
    },
    [],
  )

  async function finishTranscription(recorder: MediaRecorder) {
    const audio = new Blob(chunksRef.current, {
      type: recorder.mimeType || "audio/webm",
    })
    chunksRef.current = []
    stopStream()
    try {
      const transcript = await transcribe(audio)
      if (!transcript.trim()) throw new Error("Empty transcript")
      setDescription((current) =>
        current.trim()
          ? `${current.trim()} ${transcript.trim()}`
          : transcript.trim(),
      )
      setVoiceStatus("ready")
    } catch {
      setVoiceStatus("error")
    } finally {
      recorderRef.current = null
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        void finishTranscription(recorder)
      }
      recorder.start()
      setVoiceStatus("recording")
    } catch {
      stopStream()
      setVoiceStatus("error")
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === "inactive") return
    setVoiceStatus("transcribing")
    recorder.stop()
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = description.trim()
    if (!boatId || !value) return
    setSaving(true)
    setError(false)
    try {
      await onSaved(await createFault(boatId, value))
    } catch {
      setSaving(false)
      setError(true)
    }
  }

  const voiceSupported =
    typeof MediaRecorder !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"

  return (
    <form className="grid gap-5" onSubmit={save}>
      {!fixedBoatId && (
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
              voiceStatus === "recording"
                ? "Termina dettatura avaria"
                : "Detta avaria"
            }
            className={`h-11 px-3 text-xs ${voiceStatus === "recording" ? "border-[#d92d20] text-[#b42318]" : ""}`}
            disabled={!voiceSupported || voiceStatus === "transcribing"}
            onClick={() => {
              if (voiceStatus === "recording") stopRecording()
              else void startRecording()
            }}
            type="button"
            variant="secondary"
          >
            {voiceStatus === "recording" ? (
              <Square aria-hidden="true" className="size-3.5 fill-current" />
            ) : (
              <Mic aria-hidden="true" className="size-4" />
            )}
            {voiceStatus === "recording"
              ? "Termina"
              : voiceStatus === "transcribing"
                ? "Trascrizione…"
                : "Detta"}
          </Button>
        </div>
        <textarea
          className="min-h-28 resize-y rounded-xl border bg-card px-3 py-2.5 text-base font-normal leading-6 outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30"
          id="fault-description"
          onChange={(event) => {
            setDescription(event.target.value)
            if (voiceStatus === "ready") setVoiceStatus("idle")
          }}
          placeholder="Es. scotta randa senza anima"
          required
          value={description}
        />
      </div>

      {voiceStatus === "ready" && (
        <p className="text-xs leading-5 text-muted-foreground">
          Trascrizione pronta: controlla e modifica il testo prima di salvare.
        </p>
      )}
      {voiceStatus === "error" && (
        <p className="text-sm font-semibold text-[#a2381b]" role="alert">
          Dettatura non disponibile. Puoi continuare scrivendo.
        </p>
      )}
      {error && (
        <p className="text-sm font-semibold text-[#a2381b]" role="alert">
          L’avaria non è stata salvata. Riprova.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={onCancel} type="button" variant="secondary">
          Annulla
        </Button>
        <Button
          disabled={!boatId || !description.trim() || saving}
          type="submit"
        >
          {saving ? "Salvataggio…" : "Salva avaria"}
        </Button>
      </div>
    </form>
  )
}
