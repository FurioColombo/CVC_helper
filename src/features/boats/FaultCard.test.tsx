import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/boats", () => ({
  updateFaultDescription: vi.fn(),
  updateFaultState: vi.fn(),
}))

import { FaultCard } from "@/features/boats/FaultCard"
import {
  updateFaultDescription,
  updateFaultState,
  type FaultRecord,
} from "@/persistence/boats"

const FAULT: FaultRecord = {
  id: "fault-1",
  boatId: "boat-1",
  description:
    "Timone molto duro quando la pala è sotto carico, controllare prima dell’uscita e verificare anche la ferramenta sullo specchio di poppa.",
  state: "open",
  createdAt: "2026-08-29T10:00:00.000Z",
  updatedAt: "2026-08-29T10:00:00.000Z",
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

describe("FaultCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(updateFaultState).mockResolvedValue(undefined)
    vi.mocked(updateFaultDescription).mockResolvedValue(undefined)
  })

  it("shows the shared boat identity and opens the full preview in one tap", async () => {
    const user = userEvent.setup()
    render(
      <FaultCard
        boatNumber="12"
        boatType="RS Quest"
        fault={FAULT}
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getByLabelText("Modello RS Quest")).toBeVisible()
    expect(screen.getByLabelText("RS Quest 12")).toBeVisible()
    const preview = screen.getByRole("button", {
      name: `Apri descrizione: ${FAULT.description}`,
    })
    expect(preview).toHaveAttribute("aria-expanded", "false")
    await user.click(preview)
    expect(
      screen.getByRole("button", {
        name: `Riduci descrizione: ${FAULT.description}`,
      }),
    ).toHaveAttribute("aria-expanded", "true")
  })

  it("serializes rapid state taps and persists the latest requested state", async () => {
    let finishFirstSave: (() => void) | undefined
    vi.mocked(updateFaultState)
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishFirstSave = resolve
          }),
      )
      .mockResolvedValueOnce(undefined)
    const onChanged = vi.fn().mockResolvedValue(undefined)
    render(<FaultCard fault={FAULT} onChanged={onChanged} />)

    const communicated = screen.getByRole("button", { name: "Comunicata" })
    const resolved = screen.getByRole("button", { name: "Risolta" })
    fireEvent.click(communicated)
    fireEvent.click(resolved)

    expect(updateFaultState).toHaveBeenCalledOnce()
    expect(updateFaultState).toHaveBeenCalledWith("fault-1", "reported")
    expect(resolved).toBeEnabled()
    expect(screen.getByText("Salvataggio stato…")).toBeVisible()

    finishFirstSave?.()
    await waitFor(() => expect(updateFaultState).toHaveBeenCalledTimes(2))
    expect(updateFaultState).toHaveBeenLastCalledWith("fault-1", "resolved")
    expect(onChanged).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(resolved).toHaveAttribute("aria-pressed", "true"),
    )
  })

  it("does not change sections while a description draft is open", async () => {
    const user = userEvent.setup()
    render(
      <FaultCard
        fault={FAULT}
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.click(
      screen.getByRole("button", {
        name: `Modifica avaria ${FAULT.description}`,
      }),
    )

    expect(screen.getByRole("button", { name: "Aperta" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Comunicata" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Risolta" })).toBeDisabled()
  })

  it("collapses repeated taps on the same pending state", async () => {
    let finishSave: (() => void) | undefined
    vi.mocked(updateFaultState).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve
        }),
    )
    render(
      <FaultCard
        fault={FAULT}
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    const communicated = screen.getByRole("button", { name: "Comunicata" })
    fireEvent.click(communicated)
    fireEvent.click(communicated)

    expect(updateFaultState).toHaveBeenCalledOnce()
    finishSave?.()
    await waitFor(() =>
      expect(communicated).toHaveAttribute("aria-pressed", "true"),
    )
    expect(updateFaultState).toHaveBeenCalledOnce()
  })

  it("keeps a failed state choice retryable without claiming it was saved", async () => {
    vi.mocked(updateFaultState)
      .mockRejectedValueOnce(new Error("disk busy"))
      .mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    render(
      <FaultCard
        fault={FAULT}
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    const communicated = screen.getByRole("button", { name: "Comunicata" })
    const open = screen.getByRole("button", { name: "Aperta" })
    await user.click(communicated)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Modifica non salvata",
    )
    expect(open).toHaveAttribute("aria-pressed", "true")
    expect(communicated).toHaveAttribute("aria-pressed", "false")

    await user.click(screen.getByRole("button", { name: "Riprova" }))
    await waitFor(() => expect(updateFaultState).toHaveBeenCalledTimes(2))
    expect(updateFaultState).toHaveBeenLastCalledWith("fault-1", "reported")
    await waitFor(() =>
      expect(communicated).toHaveAttribute("aria-pressed", "true"),
    )
  })

  it("lets the operator dictate the correction to a description", async () => {
    const transcribe = vi.fn().mockResolvedValue("e cuscinetto da sostituire")
    const stopTrack = vi.fn()
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
    const user = userEvent.setup()
    render(
      <FaultCard
        fault={{ ...FAULT, description: "Timone duro" }}
        onChanged={vi.fn().mockResolvedValue(undefined)}
        transcribe={transcribe}
      />,
    )

    await user.click(
      screen.getByRole("button", { name: "Modifica avaria Timone duro" }),
    )
    await user.click(
      screen.getByRole("button", { name: "Detta descrizione avaria" }),
    )
    await user.click(
      await screen.findByRole("button", {
        name: "Termina dettatura descrizione avaria",
      }),
    )

    const editor = screen.getByLabelText("Modifica descrizione Timone duro")
    await waitFor(() =>
      expect(editor).toHaveValue("Timone duro e cuscinetto da sostituire"),
    )
    // Saving waits for the transcript to be accepted or thrown away, so a
    // half-finished dictation cannot be written to the record.
    expect(
      screen.getByRole("button", {
        name: "Salva descrizione Timone duro",
      }),
    ).toBeDisabled()

    await user.click(
      screen.getByRole("button", {
        name: "Usa trascrizione descrizione avaria",
      }),
    )
    await user.click(
      screen.getByRole("button", { name: "Salva descrizione Timone duro" }),
    )
    await waitFor(() =>
      expect(updateFaultDescription).toHaveBeenCalledWith(
        "fault-1",
        "Timone duro e cuscinetto da sostituire",
      ),
    )
  })
})
