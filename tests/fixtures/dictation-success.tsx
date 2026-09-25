import { useState } from "react"
import { createRoot } from "react-dom/client"

import "@/styles.css"
import { DictatedNoteField } from "@/features/speech/DictatedNoteField"

const STORAGE_KEY = "cvc-v03-dictation-fixture-note"
const INITIAL_NOTE = "Nota già digitata"
const TRANSCRIPT = "Vento teso da nord"

class FixtureMediaRecorder {
  mimeType = "audio/webm"
  state: RecordingState = "inactive"
  ondataavailable: ((event: BlobEvent) => void) | null = null
  onstop: (() => void) | null = null

  constructor(stream: MediaStream) {
    void stream
  }

  start() {
    this.state = "recording"
  }

  stop() {
    this.state = "inactive"
    this.ondataavailable?.({ data: new Blob(["synthetic-audio"]) } as BlobEvent)
    this.onstop?.()
  }
}

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
Object.defineProperty(window, "MediaRecorder", {
  configurable: true,
  value: FixtureMediaRecorder,
})
Object.defineProperty(navigator, "mediaDevices", {
  configurable: true,
  value: {
    getUserMedia: async () => ({
      getTracks: () => [{ stop: () => undefined }],
    }),
  },
})

function DictationSuccessFixture() {
  const [note, setNote] = useState(
    () => window.localStorage.getItem(STORAGE_KEY) ?? INITIAL_NOTE,
  )
  const [saved, setSaved] = useState(false)

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    window.localStorage.setItem(STORAGE_KEY, note)
    setSaved(true)
  }

  return (
    <main className="mx-auto grid min-w-0 max-w-lg gap-4 p-4">
      <h1 className="text-xl font-black">Dettatura nota · prova sintetica</h1>
      <form className="grid gap-4" onSubmit={save}>
        <DictatedNoteField
          label="Nota di prova"
          naming={{ start: "Detta nota di prova", subject: "nota di prova" }}
          onChange={(nextNote) => {
            setNote(nextNote)
            setSaved(false)
          }}
          prepareSpeech={async () => undefined}
          transcribe={async () => TRANSCRIPT}
          value={note}
        />
        <button className="min-h-11 rounded-xl border px-4" type="submit">
          Salva nota
        </button>
        {saved && <p role="status">Nota salvata</p>}
      </form>
    </main>
  )
}

createRoot(document.getElementById("root")!).render(<DictationSuccessFixture />)

export default DictationSuccessFixture
