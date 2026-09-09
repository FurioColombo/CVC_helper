import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/boats", () => ({
  createFault: vi.fn(),
}))

import { FaultForm } from "@/features/boats/FaultForm"
import { createFault, type BoatRecord } from "@/persistence/boats"

const BOAT: BoatRecord = {
  id: "boat-1",
  courseId: "course-1",
  type: "RS Quest",
  number: "7",
  availability: "available",
}

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

describe("FaultForm voice input", () => {
  const stopTrack = vi.fn()
  const originalMediaRecorder = globalThis.MediaRecorder
  const originalMediaDevices = navigator.mediaDevices

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createFault).mockResolvedValue({
      id: "fault-1",
      boatId: BOAT.id,
      description: "Timone molto duro",
      state: "open",
      createdAt: "2026-08-29T10:00:00.000Z",
      updatedAt: "2026-08-29T10:00:00.000Z",
    })
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

  it("combines typed and dictated text, then persists text without audio", async () => {
    const transcribe = vi.fn().mockResolvedValue("Timone duro")
    const user = userEvent.setup()
    render(
      <FaultForm
        boats={[BOAT]}
        fixedBoatId={BOAT.id}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        transcribe={transcribe}
      />,
    )

    await user.type(screen.getByLabelText("Descrizione"), "In navigazione")
    await user.click(screen.getByRole("button", { name: "Detta avaria" }))
    await user.click(
      screen.getByRole("button", { name: "Termina dettatura avaria" }),
    )

    await waitFor(() =>
      expect(screen.getByLabelText("Descrizione")).toHaveValue(
        "In navigazione Timone duro",
      ),
    )
    expect(createFault).not.toHaveBeenCalled()
    expect(stopTrack).toHaveBeenCalledOnce()
    await user.type(screen.getByLabelText("Descrizione"), " molto")
    expect(screen.getByRole("button", { name: "Salva avaria" })).toBeDisabled()
    await user.click(
      screen.getByRole("button", { name: "Usa trascrizione avaria" }),
    )
    await user.click(screen.getByRole("button", { name: "Salva avaria" }))

    expect(transcribe).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.any(Object),
    )
    expect(createFault).toHaveBeenCalledWith(
      BOAT.id,
      "In navigazione Timone duro molto",
    )
    expect(createFault).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Blob),
    )
  })

  it("stops the microphone stream when recorder construction fails", async () => {
    class FailingMediaRecorder {
      constructor() {
        throw new Error("Recorder unavailable")
      }
    }
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: FailingMediaRecorder,
    })
    const user = userEvent.setup()
    render(
      <FaultForm
        boats={[BOAT]}
        fixedBoatId={BOAT.id}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        prepareSpeech={vi.fn().mockResolvedValue(undefined)}
        transcribe={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Detta avaria" }))

    await waitFor(() => expect(stopTrack).toHaveBeenCalledOnce())
    expect(
      screen.getByText("Dettatura non riuscita. Il testo è rimasto invariato."),
    ).toBeVisible()
  })

  it("keeps typed text after denied permission and offers a real retry", async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new Error("denied"))
      .mockResolvedValueOnce({
        getTracks: () => [{ stop: stopTrack }],
      })
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    })
    const user = userEvent.setup()
    render(
      <FaultForm
        boats={[BOAT]}
        fixedBoatId={BOAT.id}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        prepareSpeech={vi.fn().mockResolvedValue(undefined)}
        transcribe={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText("Descrizione"), "Testo già scritto")
    await user.click(screen.getByRole("button", { name: "Detta avaria" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Permesso microfono non concesso",
    )
    expect(screen.getByLabelText("Descrizione")).toHaveValue(
      "Testo già scritto",
    )

    await user.click(
      screen.getByRole("button", { name: "Riprovare dettatura avaria" }),
    )
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2))
    expect(
      screen.getByRole("button", { name: "Termina dettatura avaria" }),
    ).toBeVisible()
  })

  it("keeps the description after a save failure and retries it", async () => {
    vi.mocked(createFault)
      .mockRejectedValueOnce(new Error("disk busy"))
      .mockResolvedValueOnce({
        id: "fault-2",
        boatId: BOAT.id,
        description: "Drizza da sostituire",
        state: "open",
        createdAt: "2026-08-29T10:00:00.000Z",
        updatedAt: "2026-08-29T10:00:00.000Z",
      })
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(
      <FaultForm
        boats={[BOAT]}
        fixedBoatId={BOAT.id}
        onCancel={vi.fn()}
        onSaved={onSaved}
      />,
    )

    const description = screen.getByLabelText("Descrizione")
    await user.type(description, "Drizza da sostituire")
    await user.click(screen.getByRole("button", { name: "Salva avaria" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Il testo resta qui",
    )
    expect(description).toHaveValue("Drizza da sostituire")
    await user.click(
      screen.getByRole("button", { name: "Riprova salvataggio" }),
    )

    await waitFor(() => expect(createFault).toHaveBeenCalledTimes(2))
    expect(onSaved).toHaveBeenCalledOnce()
  })
})
