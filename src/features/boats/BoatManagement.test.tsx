import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/boats", () => ({
  createBoat: vi.fn(),
  createBoats: vi.fn(),
  createFault: vi.fn(),
  deleteBoat: vi.fn(),
  listBoats: vi.fn(),
  listFaults: vi.fn(),
  setBoatAvailability: vi.fn(),
  updateFaultDescription: vi.fn(),
  updateFaultState: vi.fn(),
}))

import { BoatManagement } from "@/features/boats/BoatManagement"
import {
  createBoat,
  createBoats,
  deleteBoat,
  listBoats,
  listFaults,
  setBoatAvailability,
  type BoatRecord,
  type CourseFaultRecord,
} from "@/persistence/boats"
import type { CourseRecord } from "@/persistence/courses"

const COURSE: CourseRecord = {
  id: "course-1",
  active: 1,
  family: "Deriva",
  level: 2,
  isoWeek: 35,
  year: 2026,
  startDate: "2026-08-29",
  endDate: "2026-09-05",
  label: "D2 35 2026",
}

const BOAT: BoatRecord = {
  id: "boat-1",
  courseId: COURSE.id,
  type: "RS Quest",
  number: "7",
  availability: "available",
}

const FAULT: CourseFaultRecord = {
  id: "fault-1",
  boatId: BOAT.id,
  boatType: BOAT.type,
  boatNumber: BOAT.number,
  description: "Scotta usurata",
  state: "open",
  createdAt: "2026-08-29T10:00:00.000Z",
  updatedAt: "2026-08-29T10:00:00.000Z",
}

const getBoats = vi.mocked(listBoats)
const getFaults = vi.mocked(listFaults)

describe("BoatManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getBoats.mockResolvedValue([])
    getFaults.mockResolvedValue([])
    vi.mocked(createBoats).mockResolvedValue([])
    vi.mocked(deleteBoat).mockResolvedValue(undefined)
    vi.mocked(setBoatAvailability).mockResolvedValue(undefined)
  })

  it("configures several boats with the canonical course default", async () => {
    const user = userEvent.setup()
    render(<BoatManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(
      await screen.findByRole("button", { name: "Configura barche" }),
    )
    expect(screen.getByLabelText("Tipo")).toHaveValue("RS Quest")
    await user.type(screen.getByLabelText("Numeri barca"), "2, 7\n11")
    await user.click(screen.getByRole("button", { name: "Configura" }))

    await waitFor(() =>
      expect(createBoats).toHaveBeenCalledWith(COURSE.id, [
        { type: "RS Quest", number: "2" },
        { type: "RS Quest", number: "7" },
        { type: "RS Quest", number: "11" },
      ]),
    )
  })

  it("shows existing boats when configuration is reopened and ignores duplicates", async () => {
    getBoats.mockResolvedValue([BOAT])
    const user = userEvent.setup()
    render(<BoatManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(
      await screen.findByRole("button", { name: "Configura numeri barche" }),
    )
    expect(
      screen.getByRole("region", { name: "Barche già configurate" }),
    ).toHaveTextContent("RS Quest 7")
    await user.type(screen.getByLabelText("Numeri barca"), "2 7; 11\n11")
    expect(screen.getByText(/Ignorati i numeri già presenti: 7/)).toBeVisible()
    expect(
      screen.getByRole("button", { name: /^Configura$/ }),
    ).not.toBeDisabled()
    await user.click(screen.getByRole("button", { name: /^Configura$/ }))
    await waitFor(() =>
      expect(createBoats).toHaveBeenCalledWith(COURSE.id, [
        { type: "RS Quest", number: "2" },
        { type: "RS Quest", number: "11" },
      ]),
    )
  })

  it("does not invent a default for out-of-practical-scope C4/C5 courses", async () => {
    const user = userEvent.setup()
    render(
      <BoatManagement
        course={{ ...COURSE, family: "Cabinato", level: 4 }}
        onHome={vi.fn()}
      />,
    )

    await user.click(
      await screen.findByRole("button", { name: "Configura barche" }),
    )
    expect(screen.getByLabelText("Tipo")).toHaveValue("")
    expect(screen.getByRole("button", { name: "Configura" })).toBeDisabled()
  })

  it("rejects multiple identifiers in the single-boat add flow", async () => {
    getBoats.mockResolvedValue([BOAT])
    const user = userEvent.setup()
    render(<BoatManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(
      await screen.findByRole("button", { name: "Aggiungi barca" }),
    )
    await user.type(screen.getByLabelText("Numero barca"), "2 3")

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Inserisci un solo numero di barca, senza separatori.",
    )
    expect(screen.getByRole("button", { name: "Aggiungi" })).toBeDisabled()
    expect(createBoat).not.toHaveBeenCalled()
  })

  it("derives the fault status while availability remains independently editable", async () => {
    getBoats.mockResolvedValue([BOAT])
    getFaults.mockResolvedValue([FAULT])
    const user = userEvent.setup()
    render(<BoatManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(
      await screen.findByRole("button", {
        name: "RS Quest 7, Da controllare, 1 avaria",
      }),
    )
    expect(screen.getByText("Scotta usurata")).toBeVisible()
    await user.click(
      screen.getByRole("button", { name: "Rendi indisponibile" }),
    )

    await waitFor(() =>
      expect(setBoatAvailability).toHaveBeenCalledWith(
        BOAT.id,
        COURSE.id,
        "unavailable",
      ),
    )
    expect(screen.getByText("Scotta usurata")).toBeVisible()
  })

  it("greys the complete boat row when unavailable", async () => {
    getBoats.mockResolvedValue([{ ...BOAT, availability: "unavailable" }])
    const user = userEvent.setup()
    render(<BoatManagement course={COURSE} onHome={vi.fn()} />)

    const row = await screen.findByRole("button", {
      name: "RS Quest 7, Non disponibile",
    })
    expect(row).toHaveClass("bg-muted/70", "text-muted-foreground")
    expect(row).not.toHaveClass("opacity-65")
    await user.click(row)
    expect(screen.getByText("Non disponibile", { exact: true })).toBeVisible()
  })

  it("shows an honest pending state while availability is persisted", async () => {
    getBoats.mockResolvedValue([BOAT])
    let resolveAvailability!: () => void
    vi.mocked(setBoatAvailability).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveAvailability = resolve
        }),
    )
    const user = userEvent.setup()
    render(<BoatManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(
      await screen.findByRole("button", {
        name: "RS Quest 7, Disponibile",
      }),
    )
    await user.click(
      screen.getByRole("button", { name: "Rendi indisponibile" }),
    )

    const pending = screen.getByRole("button", { name: "Salvataggio…" })
    expect(pending).toBeDisabled()
    expect(pending).toHaveAttribute("aria-busy", "true")
    resolveAvailability()
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Rendi indisponibile" }),
      ).toHaveAttribute("aria-busy", "false"),
    )
  })

  it("shows the model mark while exposing the three operational states", async () => {
    const secondBoat: BoatRecord = {
      ...BOAT,
      id: "boat-2",
      type: "Laser Vago",
      number: "14",
      availability: "unavailable",
    }
    const thirdBoat: BoatRecord = {
      ...BOAT,
      id: "boat-3",
      type: "First 27",
      number: "15",
    }
    getBoats.mockResolvedValue([BOAT, secondBoat, thirdBoat])
    getFaults.mockResolvedValue([FAULT])
    render(<BoatManagement course={COURSE} onHome={vi.fn()} />)

    expect(await screen.findByText("Da controllare")).toBeVisible()
    expect(screen.getByText("1 avaria")).toBeVisible()
    expect(screen.getByText("Non disponibile", { exact: true })).toBeVisible()
    expect(screen.getByText("Disponibile", { exact: true })).toBeVisible()
    // The manufacturer marks are shown under the owner's authorisation of
    // 2026-09-18. The model stays in the accessible name, so the boat is
    // identifiable without seeing the picture, and the written model remains
    // the fallback when an asset cannot be decoded.
    expect(screen.getByLabelText("Modello First 27")).toBeVisible()
    expect(screen.getByLabelText("Modello Laser Vago")).toBeVisible()
    expect(screen.getByText("15", { exact: true })).toBeVisible()
  })

  it("falls back to the written model when a mark cannot be shown", async () => {
    getBoats.mockResolvedValue([BOAT])
    getFaults.mockResolvedValue([])
    render(<BoatManagement course={COURSE} onHome={vi.fn()} />)

    const mark = await screen.findByLabelText(`Modello ${BOAT.type}`)
    const logo = mark.querySelector("img")
    expect(logo).not.toBeNull()

    fireEvent.error(logo!)
    expect(mark.querySelector("img")).toBeNull()
    expect(mark.textContent?.replace(/\s+/g, "")).toBe(
      BOAT.type.replace(/[\s.]/g, "").toUpperCase(),
    )
  })

  it("deletes a mistaken boat only after explicit confirmation", async () => {
    getBoats.mockResolvedValue([BOAT])
    const user = userEvent.setup()
    render(<BoatManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(
      await screen.findByRole("button", {
        name: "RS Quest 7, Disponibile",
      }),
    )
    await user.click(
      screen.getByRole("button", {
        name: "Elimina barca inserita per errore",
      }),
    )
    await user.click(screen.getByRole("button", { name: "Elimina" }))

    expect(deleteBoat).toHaveBeenCalledWith(BOAT.id, COURSE.id)
  })
})
