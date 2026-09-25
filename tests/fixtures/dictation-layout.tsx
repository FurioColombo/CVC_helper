import { useLayoutEffect, useState } from "react"
import { createRoot } from "react-dom/client"

import "@/styles.css"
import {
  DictationPanels,
  DictationTrigger,
} from "@/features/speech/DictationControls"
import type {
  Dictation,
  DictationNaming,
} from "@/features/speech/dictationState"
import type {
  DictationError,
  DictationStatus,
} from "@/features/speech/useDictation"

declare global {
  interface Window {
    setDictationFixtureState?: (
      status: DictationStatus,
      progress?: number,
      error?: DictationError | null,
    ) => void
  }
}

const naming: DictationNaming = {
  start:
    "Detta la nota sintetica di Alessandra Bernardeschi per sabato pomeriggio",
  subject: "nota sintetica di Alessandra Bernardeschi per sabato pomeriggio",
}
const label = "Nota di Alessandra Bernardeschi per sabato pomeriggio"
const host = new URLSearchParams(window.location.search).get("host")
const noteText = "Testo scritto prima della prova di dettatura."
const fakeStream = { getTracks: () => [] } as unknown as MediaStream

class FixtureAnalyser {
  fftSize = 1024
  smoothingTimeConstant = 0

  getByteTimeDomainData(samples: Uint8Array) {
    samples.fill(128)
  }

  connect() {}
  disconnect() {}
}

class FixtureAudioContext {
  createAnalyser() {
    return new FixtureAnalyser()
  }

  createMediaStreamSource() {
    return { connect() {}, disconnect() {} }
  }

  resume() {
    return Promise.resolve()
  }

  close() {
    return Promise.resolve()
  }
}

Object.defineProperty(window, "AudioContext", {
  configurable: true,
  value: FixtureAudioContext,
})

function DictationLayoutFixture() {
  const [status, setStatus] = useState<DictationStatus>("idle")
  const [error, setError] = useState<DictationError | null>(null)
  const [progress, setProgress] = useState<number | undefined>()
  const [note, setNote] = useState(noteText)
  const supported = host !== "unsupported"

  useLayoutEffect(() => {
    window.setDictationFixtureState = (next, nextProgress, nextError) => {
      setStatus(next)
      setProgress(nextProgress)
      setError(nextError ?? null)
    }
    return () => {
      delete window.setDictationFixtureState
    }
  }, [])

  const dictation: Dictation = {
    status,
    error,
    loadPercent: progress,
    supported,
    mediaStream: status === "recording" ? fakeStream : null,
    start: async () => {
      setStatus("permission")
      setError(null)
    },
    stop: () => setStatus("processing"),
    cancel: () => setStatus("idle"),
    syncValue: () => undefined,
  }

  const trigger = <DictationTrigger dictation={dictation} naming={naming} />
  const panels = <DictationPanels dictation={dictation} naming={naming} />
  const textarea = (
    <textarea
      aria-label={label}
      className="min-h-24 w-full resize-y rounded-xl border bg-background px-3 py-2.5 text-base leading-6"
      id="synthetic-note"
      onChange={(event) => setNote(event.target.value)}
      value={note}
    />
  )
  const noteLabel = (
    <label
      className={`min-w-0 ${host === "evaluation" ? "basis-48" : ""}`}
      htmlFor="synthetic-note"
    >
      {host === "evaluation"
        ? `${label} · sessione del corso di sabato pomeriggio`
        : label}
    </label>
  )

  let field
  if (host === "knowledge") {
    field = (
      <>
        {textarea}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {trigger}
          <button className="min-h-11 rounded-xl border px-4" type="button">
            Fine
          </button>
        </div>
        {panels}
      </>
    )
  } else if (host === "fault-form") {
    field = (
      <>
        <div className="grid gap-2 text-sm font-bold">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <label className="min-w-0" htmlFor="synthetic-note">
              Descrizione
            </label>
            {trigger}
          </div>
          {textarea}
        </div>
        {panels}
      </>
    )
  } else if (host === "fault-card-edit") {
    field = (
      <div className="mt-2 grid gap-2">
        {textarea}
        <div className="flex justify-end">{trigger}</div>
        {panels}
      </div>
    )
  } else {
    field = (
      <>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {noteLabel}
          {trigger}
        </div>
        {textarea}
        {panels}
      </>
    )
  }

  return (
    <main className="mx-auto grid min-w-0 max-w-lg gap-4 p-4">
      <h1 className="text-xl font-black">Prova disposizione dettatura</h1>
      <section
        aria-label={`Campo sintetico ${host}`}
        className={`grid min-w-0 gap-2 border bg-card ${host === "fault-card-edit" ? "rounded-2xl border-l-4 p-3 max-[380px]:p-2" : "rounded-xl p-4"}`}
        role="region"
      >
        {field}
      </section>
    </main>
  )
}

createRoot(document.getElementById("root")!).render(<DictationLayoutFixture />)

export default DictationLayoutFixture
