import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import {
  prepareSpeechTranscription,
  transcribeAudio,
  type SpeechTranscriptionOptions,
} from "@/capabilities/speech"

export type DictationStatus =
  "idle" | "permission" | "recording" | "loading" | "processing" | "error"

export type DictationError =
  | "unsupported"
  | "permission"
  | "device"
  | "offline"
  | "recording"
  | "transcription"

/**
 * `getUserMedia` rejects with a `DOMException` whose `name` says why. Denied
 * or policy-blocked permission is what the existing "permission" message
 * already covers; a missing or already-claimed microphone is a different
 * situation the instructor cannot fix by granting anything, so it gets its
 * own "device" message. Anything else (or a non-DOMException, as fixtures in
 * tests use) falls back to "permission" — the safest guess before this fix,
 * and still a reasonable one.
 */
function mapGetUserMediaError(error: unknown): DictationError {
  const name = error instanceof DOMException ? error.name : undefined
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "permission"
    case "NotFoundError":
    case "NotReadableError":
    case "OverconstrainedError":
      return "device"
    default:
      return "permission"
  }
}

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
  onTranscript,
  transcribe = transcribeAudio,
  prepare,
}: {
  value: string
  onDraft: (value: string) => void
  onTranscript: (value: string) => void
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
      const prefix = currentText.trim()
      const nextDraft = prefix ? `${prefix} ${normalized}` : normalized
      valueRef.current = nextDraft
      onDraft(nextDraft)
      onTranscript(nextDraft)
      setError(null)
      setLoadPercent(undefined)
      setStatus("idle")
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
    // The model is prepared before the microphone is ever requested. On a
    // first use that means the (possibly minutes-long) download runs with no
    // stream open at all, rather than leaving the microphone live — and the
    // browser's own in-use indicator on — for the whole wait. Once the model
    // is cached this resolves immediately, so later uses feel the same as
    // before.
    setStatus("loading")
    try {
      await prepareForSpeech({
        onProgress(progress) {
          if (!mountedRef.current || attempt !== attemptRef.current) return
          setStatus("loading")
          setLoadPercent(progress.percent)
        },
      })
    } catch {
      if (!mountedRef.current || attempt !== attemptRef.current) return
      // The model is downloaded once per device (and again after an update
      // that pins a new revision); offline, that download is what failed.
      setError(navigator.onLine === false ? "offline" : "transcription")
      setLoadPercent(undefined)
      setStatus("error")
      return
    }
    if (!mountedRef.current || attempt !== attemptRef.current) return

    setLoadPercent(undefined)
    setStatus("permission")
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (mediaError) {
      if (!mountedRef.current || attempt !== attemptRef.current) return
      setError(mapGetUserMediaError(mediaError))
      setStatus("error")
      return
    }
    if (!mountedRef.current || attempt !== attemptRef.current) {
      stopStream(stream)
      return
    }

    streamRef.current = stream
    try {
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
      setError("recording")
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
    setError(null)
    setLoadPercent(undefined)
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
    syncValue,
  }
}
