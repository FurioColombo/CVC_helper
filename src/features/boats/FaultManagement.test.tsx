import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/boats", () => ({
  createFault: vi.fn(),
  listBoats: vi.fn(),
  listFaults: vi.fn(),
  updateFaultDescription: vi.fn(),
  updateFaultState: vi.fn(),
}))

import { FaultManagement } from "@/features/boats/FaultManagement"
import {
  createFault,
  listBoats,
  listFaults,
  updateFaultState,
  type BoatRecord,
  type CourseFaultRecord,
} from "@/persistence/boats"

const BOATS: BoatRecord[] = [
  {
    id: "boat-1",
    courseId: "course-1",
    type: "RS Quest",
    number: "2",
    availability: "available",
  },
  {
    id: "boat-2",
    courseId: "course-1",
    type: "Laser Vago",
    number: "9",
    availability: "available",
  },
]

const FAULTS: CourseFaultRecord[] = [
  {
    id: "fault-1",
    boatId: "boat-1",
    boatType: "RS Quest",
    boatNumber: "2",
    description: "Timone duro",
    state: "open",
    createdAt: "2026-08-29T10:00:00.000Z",
    updatedAt: "2026-08-29T10:00:00.000Z",
  },
  {
    id: "fault-2",
    boatId: "boat-1",
    boatType: "RS Quest",
    boatNumber: "2",
    description: "Bozzello sostituito",
    state: "resolved",
    createdAt: "2026-08-29T09:00:00.000Z",
    updatedAt: "2026-08-29T11:00:00.000Z",
  },
]

describe("FaultManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listBoats).mockResolvedValue(BOATS)
    vi.mocked(listFaults).mockResolvedValue([])
    vi.mocked(updateFaultState).mockResolvedValue(undefined)
    vi.mocked(createFault).mockResolvedValue({
      ...FAULTS[0]!,
      id: "new-fault",
      boatId: "boat-2",
    })
  })

  it("creates a fault from the global entry point for the selected boat", async () => {
    const user = userEvent.setup()
    render(
      <FaultManagement
        courseId="course-1"
        onHome={vi.fn()}
        onOpenBoats={vi.fn()}
      />,
    )

    await user.click(
      await screen.findByRole("button", { name: "Segnala avaria" }),
    )
    await user.selectOptions(screen.getByLabelText("Barca"), "boat-2")
    await user.type(screen.getByLabelText("Descrizione"), "Drizza usurata")
    await user.click(screen.getByRole("button", { name: "Salva avaria" }))

    await waitFor(() =>
      expect(createFault).toHaveBeenCalledWith("boat-2", "Drizza usurata"),
    )
  })

  it("keeps unresolved faults prominent and resolved faults in history", async () => {
    vi.mocked(listFaults).mockResolvedValue(FAULTS)
    const user = userEvent.setup()
    render(
      <FaultManagement
        courseId="course-1"
        onHome={vi.fn()}
        onOpenBoats={vi.fn()}
      />,
    )

    expect(await screen.findByText("Da gestire · 1")).toBeVisible()
    expect(screen.getByText("Timone duro")).toBeVisible()
    expect(screen.getByText("Storico risolte")).toBeVisible()
    expect(screen.getByText("Bozzello sostituito")).toBeVisible()

    const openFault = screen.getAllByRole("article")[0]!
    await user.click(within(openFault).getByRole("button", { name: "Risolta" }))
    expect(updateFaultState).toHaveBeenCalledWith("fault-1", "resolved")
  })

  it("routes to boat setup when the course has no boats", async () => {
    vi.mocked(listBoats).mockResolvedValue([])
    const onOpenBoats = vi.fn()
    const user = userEvent.setup()
    render(
      <FaultManagement
        courseId="course-1"
        onHome={vi.fn()}
        onOpenBoats={onOpenBoats}
      />,
    )

    await user.click(
      await screen.findByRole("button", { name: "Configura barche" }),
    )
    expect(onOpenBoats).toHaveBeenCalledOnce()
  })
})
