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
  description: "Timone duro",
  state: "open",
  createdAt: "2026-08-29T10:00:00.000Z",
  updatedAt: "2026-08-29T10:00:00.000Z",
}

describe("FaultCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(updateFaultState).mockResolvedValue(undefined)
    vi.mocked(updateFaultDescription).mockResolvedValue(undefined)
  })

  it("serializes state changes until the persisted refresh completes", async () => {
    let finishRefresh: (() => void) | undefined
    const onChanged = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = resolve
        }),
    )
    render(<FaultCard fault={FAULT} onChanged={onChanged} />)

    const communicated = screen.getByRole("button", { name: "Comunicata" })
    const resolved = screen.getByRole("button", { name: "Risolta" })
    fireEvent.click(communicated)
    fireEvent.click(resolved)

    expect(updateFaultState).toHaveBeenCalledOnce()
    expect(updateFaultState).toHaveBeenCalledWith("fault-1", "reported")
    expect(resolved).toBeDisabled()

    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce())
    finishRefresh?.()
    await waitFor(() => expect(resolved).toBeEnabled())
    await userEvent.click(resolved)
    expect(updateFaultState).toHaveBeenCalledTimes(2)
    expect(updateFaultState).toHaveBeenLastCalledWith("fault-1", "resolved")
  })
})
