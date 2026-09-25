import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useState } from "react"

import { DictatedNoteField } from "@/features/speech/DictatedNoteField"
import type { SpeechTranscribe } from "@/features/speech/useDictation"

class FakeMediaRecorder {
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
    this.ondataavailable?.({ data: new Blob(["voice"]) } as BlobEvent)
    this.onstop?.()
  }
}

function Harness({ transcribe }: { transcribe: SpeechTranscribe }) {
  const [note, setNote] = useState("")
  return (
    <DictatedNoteField
      label="Nota del corso"
      naming={{ start: "Detta nota del corso", subject: "nota del corso" }}
      onChange={setNote}
      transcribe={transcribe}
      unsupportedHint="Dettatura non disponibile in questo browser."
      value={note}
    />
  )
}

describe("DictatedNoteField", () => {
  const stopTrack = vi.fn()
  const originalMediaRecorder = globalThis.MediaRecorder
  const originalMediaDevices = navigator.mediaDevices

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: FakeMediaRecorder,
    })
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrack }],
        }),
      },
    })
  })

  afterEach(() => {
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: originalMediaRecorder,
    })
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    })
  })

  it("appends the transcript directly to the editable field and releases the microphone", async () => {
    const transcribe = vi.fn().mockResolvedValue("vento teso da nord")
    const user = userEvent.setup()
    render(<Harness transcribe={transcribe} />)

    const note = screen.getByLabelText("Nota del corso")
    await user.type(note, "Uscita breve.")
    await user.click(
      screen.getByRole("button", { name: "Detta nota del corso" }),
    )
    await user.click(
      await screen.findByRole("button", {
        name: "Termina dettatura nota del corso",
      }),
    )

    await waitFor(() =>
      expect(note).toHaveValue("Uscita breve. vento teso da nord"),
    )
    expect(stopTrack).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole("button", {
        name: /Scarta trascrizione|Usa trascrizione/,
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Detta nota del corso" }),
    ).toBeEnabled()
  })

  it("keeps the written note when recording is cancelled", async () => {
    const transcribe = vi.fn().mockResolvedValue("non deve comparire")
    const user = userEvent.setup()
    render(<Harness transcribe={transcribe} />)

    const note = screen.getByLabelText("Nota del corso")
    await user.type(note, "Testo mio")
    await user.click(
      screen.getByRole("button", { name: "Detta nota del corso" }),
    )
    await user.click(
      screen.getByRole("button", {
        name: "Annulla dettatura nota del corso",
      }),
    )
    expect(note).toHaveValue("Testo mio")
    expect(transcribe).not.toHaveBeenCalled()
    expect(stopTrack).toHaveBeenCalledOnce()
  })

  it("keeps the note editable when microphone permission is denied", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error("denied")),
      },
    })
    const user = userEvent.setup()
    render(<Harness transcribe={vi.fn()} />)

    const note = screen.getByLabelText("Nota del corso")
    await user.type(note, "Testo digitato")
    await user.click(
      screen.getByRole("button", { name: "Detta nota del corso" }),
    )

    expect(
      await screen.findByText(
        "Permesso microfono non concesso. Il testo è rimasto invariato.",
      ),
    ).toBeVisible()
    expect(note).toHaveValue("Testo digitato")
    await user.type(note, " ancora")
    expect(note).toHaveValue("Testo digitato ancora")
  })

  it("keeps typed text on a failed transcript and lets the user retry", async () => {
    const transcribe = vi
      .fn()
      .mockRejectedValueOnce(new Error("no"))
      .mockResolvedValueOnce("dettato corretto")
    const user = userEvent.setup()
    render(<Harness transcribe={transcribe} />)

    const note = screen.getByLabelText("Nota del corso")
    await user.type(note, "Scritto a mano")
    await user.click(
      screen.getByRole("button", { name: "Detta nota del corso" }),
    )
    await user.click(
      await screen.findByRole("button", {
        name: "Termina dettatura nota del corso",
      }),
    )

    expect(
      await screen.findByText(
        "Dettatura non riuscita. Il testo è rimasto invariato.",
      ),
    ).toBeVisible()
    expect(note).toHaveValue("Scritto a mano")
    expect(
      screen.getByRole("button", {
        name: "Riprovare dettatura nota del corso",
      }),
    ).toBeVisible()

    await user.click(
      screen.getByRole("button", {
        name: "Riprovare dettatura nota del corso",
      }),
    )
    await user.click(
      await screen.findByRole("button", {
        name: "Termina dettatura nota del corso",
      }),
    )

    await waitFor(() =>
      expect(note).toHaveValue("Scritto a mano dettato corretto"),
    )
    expect(
      screen.queryByRole("button", {
        name: /Scarta trascrizione|Usa trascrizione/,
      }),
    ).not.toBeInTheDocument()
  })
})
