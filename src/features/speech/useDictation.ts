import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import {
  prepareSpeechTranscription,
  transcribeAudio,
  type SpeechTranscriptionOptions,
} from "@/capabilities/speech"

export type DictationStatus =
  | "idle"
  | "permission"
  | "recording"
  | "loading"
  | "processing"
  | "review"
  | "error"

export type DictationError =
  "unsupported" | "permission" | "recording" | "transcription"

export type SpeechTranscribe = (
  audio: Blob,
  options?: SpeechTranscriptionOptions,
) => Promise<string>

export type SpeechPrepare = (
  options?: SpeechTranscriptionOptions,
) => Promise<void>

export function useDictation({
  value,
  onDraft,
  onAccept,
  transcribe = transcribeAudio,
  prepare,
}: {
  value: string
  onDraft: (value: string) => void
  onAccept: (value: string) => void
  transcribe?: SpeechTranscribe
  prepare?: SpeechPrepare
}) {
  const [status, setStatus] = useState<DictationStatus>("idle")
  const [error, setError] = useState<DictationError | null>(null)
  const [loadPercent, setLoadPercent] = useState<number | undefined>()
  // Exposed so the panel can show a live level while the microphone is open.
  // It is the same stream the recorder uses; the meter only reads from it.
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const stoppedStreamsRef = useRef(new WeakSet<MediaStream>())
  const chunksRef = useRef<Blob[]>([])
  const beforeVoiceRef = useRef("")
  const valueRef = useRef(value)
  const attemptRef = useRef(0)
  const mountedRef = useRef(true)

  const supported = useMemo(
    () =>
      typeof MediaRecorder !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function",
    [],
  )
  const prepareForSpeech =
    prepare ??
    (transcribe === transcribeAudio
      ? prepareSpeechTranscription
      : async () => undefined)

  useLayoutEffect(() => {
    valueRef.current = value
  }, [value])

  function stopStream(stream = streamRef.current) {
    if (!stream) return
    if (!stoppedStreamsRef.current.has(stream)) {
      stream.getTracks().forEach((track) => track.stop())
      stoppedStreamsRef.current.add(stream)
    }
    if (stream === streamRef.current) streamRef.current = null
    setMediaStream((current) => (current === stream ? null : current))
  }

  async function finishTranscription(recorder: MediaRecorder, attempt: number) {
    const audio = new Blob(chunksRef.current, {
      type: recorder.mimeType || "audio/webm",
    })
    chunksRef.current = []
    stopStream()

    try {
      setStatus("processing")
      setLoadPercent(undefined)
      const transcript = await transcribe(audio, {
        onProgress(progress) {
          if (!mountedRef.current || attempt !== attemptRef.current) return
          if (progress.phase === "loading") {
            setStatus("loading")
            setLoadPercent(progress.percent)
          } else {
            setStatus("processing")
            setLoadPercent(undefined)
          }
        },
      })
      if (!mountedRef.current || attempt !== attemptRef.current) return
      const normalized = transcript.trim()
      if (!normalized) throw new Error("Empty transcript")
      const currentText = valueRef.current
      beforeVoiceRef.current = currentText
      const prefix = currentText.trim()
      const nextDraft = prefix ? `${prefix} ${normalized}` : normalized
      valueRef.current = nextDraft
      onDraft(nextDraft)
      setError(null)
      setLoadPercent(undefined)
      setStatus("review")
    } catch {
      if (!mountedRef.current || attempt !== attemptRef.current) return
      setError("transcription")
      setLoadPercent(undefined)
      setStatus("error")
    } finally {
      if (attempt === attemptRef.current) recorderRef.current = null
    }
  }

  async function start() {
    if (!supported) {
      setError("unsupported")
      setStatus("error")
      return
    }

    const attempt = ++attemptRef.current
    setError(null)
    setLoadPercent(undefined)
    setStatus("permission")
    let stream: MediaStream | null = null
    let modelReady = false

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current || attempt !== attemptRef.current) {
        stopStream(stream)
        return
      }

      streamRef.current = stream
      setStatus("loading")
      await prepareForSpeech({
        onProgress(progress) {
          if (!mountedRef.current || attempt !== attemptRef.current) return
          setStatus("loading")
          setLoadPercent(progress.percent)
        },
      })
      modelReady = true
      if (!mountedRef.current || attempt !== attemptRef.current) {
        stopStream(stream)
        return
      }

      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => void finishTranscription(recorder, attempt)
      recorder.start()
      setLoadPercent(undefined)
      setMediaStream(stream)
      setStatus("recording")
    } catch {
      stopStream(stream)
      if (!mountedRef.current || attempt !== attemptRef.current) return
      setError(
        !stream ? "permission" : modelReady ? "recording" : "transcription",
      )
      setStatus("error")
    }
  }

  function stop() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === "inactive") return
    setStatus("processing")
    recorder.stop()
  }

  function cancel() {
    attemptRef.current += 1
    const recorder = recorderRef.current
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.stop()
    }
    recorderRef.current = null
    chunksRef.current = []
    stopStream()
    if (status === "review") {
      valueRef.current = beforeVoiceRef.current
      onDraft(beforeVoiceRef.current)
    }
    setError(null)
    setLoadPercent(undefined)
    setStatus("idle")
  }

  function accept() {
    if (status !== "review") return
    onAccept(valueRef.current)
    setStatus("idle")
  }

  function syncValue(nextValue: string) {
    valueRef.current = nextValue
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      attemptRef.current += 1
      const recorder = recorderRef.current
      if (recorder && recorder.state !== "inactive") {
        recorder.ondataavailable = null
        recorder.onstop = null
        recorder.stop()
      }
      recorderRef.current = null
      chunksRef.current = []
      stopStream()
    }
  }, [])

  return {
    status,
    error,
    loadPercent,
    supported,
    mediaStream,
    start,
    stop,
    cancel,
    accept,
    syncValue,
  }
}
