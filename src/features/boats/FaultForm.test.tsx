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

  it("transcribes locally into editable text and saves only after confirmation", async () => {
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

    await user.click(screen.getByRole("button", { name: "Detta avaria" }))
    await user.click(
      screen.getByRole("button", { name: "Termina dettatura avaria" }),
    )

    await waitFor(() =>
      expect(screen.getByLabelText("Descrizione")).toHaveValue("Timone duro"),
    )
    expect(createFault).not.toHaveBeenCalled()
    expect(stopTrack).toHaveBeenCalledOnce()
    await user.type(screen.getByLabelText("Descrizione"), " molto")
    await user.click(screen.getByRole("button", { name: "Salva avaria" }))

    expect(createFault).toHaveBeenCalledWith(BOAT.id, "Timone duro molto")
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
      />,
    )

    await user.click(screen.getByRole("button", { name: "Detta avaria" }))

    await waitFor(() => expect(stopTrack).toHaveBeenCalledOnce())
    expect(
      screen.getByText("Dettatura non disponibile. Puoi continuare scrivendo."),
    ).toBeVisible()
  })
})
