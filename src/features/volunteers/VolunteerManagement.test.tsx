import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/volunteers", () => ({
  createVolunteer: vi.fn(),
  listVolunteers: vi.fn(),
  updateVolunteer: vi.fn(),
}))

import { VolunteerManagement } from "@/features/volunteers/VolunteerManagement"
import {
  createVolunteer,
  listVolunteers,
  updateVolunteer,
  type VolunteerRecord,
} from "@/persistence/volunteers"

const ANNA: VolunteerRecord = {
  id: "volunteer-1",
  courseId: "course-1",
  name: "Anna Bianchi",
  role: "ADV",
}

const getVolunteers = vi.mocked(listVolunteers)
const addVolunteer = vi.mocked(createVolunteer)
const editVolunteer = vi.mocked(updateVolunteer)

describe("VolunteerManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getVolunteers.mockResolvedValue([])
    addVolunteer.mockResolvedValue(ANNA)
    editVolunteer.mockResolvedValue(undefined)
  })

  it("creates a current-course staff record with direct ADV/IS/CT choices", async () => {
    const user = userEvent.setup()
    render(<VolunteerManagement courseId="course-1" onHome={vi.fn()} />)

    expect(
      await screen.findByRole("heading", { name: "Nessun volontario" }),
    ).toBeVisible()
    await user.click(
      screen.getByRole("button", { name: "Aggiungi volontario" }),
    )
    expect(screen.getByLabelText("Nome completo")).toHaveValue("")
    expect(screen.getByRole("radio", { name: "ADV" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "IS" })).toBeVisible()
    expect(screen.getByRole("radio", { name: "CT" })).toBeVisible()
    await user.type(screen.getByLabelText("Nome completo"), "Luca Verdi")
    expect(screen.getByRole("group", { name: "Ruolo" })).toBeVisible()
    await user.click(screen.getByRole("radio", { name: "CT" }))
    await user.click(screen.getByRole("button", { name: "Salva volontario" }))

    await waitFor(() =>
      expect(addVolunteer).toHaveBeenCalledWith("course-1", {
        name: "Luca Verdi",
        role: "CT",
      }),
    )
  })

  it("names the role on the list row instead of one icon for everyone", async () => {
    getVolunteers.mockResolvedValue([
      ANNA,
      { ...ANNA, id: "volunteer-2", name: "Carlo Verdi", role: "CT" as const },
    ])
    render(<VolunteerManagement courseId="course-1" onHome={vi.fn()} />)

    const anna = await screen.findByRole("button", {
      name: "Anna Bianchi, ruolo ADV",
    })
    expect(anna).toHaveTextContent("ADV")
    expect(
      screen.getByRole("button", { name: "Carlo Verdi, ruolo CT" }),
    ).toHaveTextContent("CT")
  })

  it("edits the name and role while keeping the record course-scoped", async () => {
    getVolunteers.mockResolvedValue([ANNA])
    const user = userEvent.setup()
    render(<VolunteerManagement courseId="course-1" onHome={vi.fn()} />)

    await user.click(
      await screen.findByRole("button", {
        name: "Anna Bianchi, ruolo ADV",
      }),
    )
    await user.clear(screen.getByLabelText("Nome completo"))
    await user.type(screen.getByLabelText("Nome completo"), "Anna Neri")
    await user.click(screen.getByRole("radio", { name: "IS" }))
    await user.click(screen.getByRole("button", { name: "Salva volontario" }))

    await waitFor(() =>
      expect(editVolunteer).toHaveBeenCalledWith("volunteer-1", "course-1", {
        name: "Anna Neri",
        role: "IS",
      }),
    )
  })

  it("refuses structurally invalid persisted volunteer records", async () => {
    getVolunteers.mockResolvedValue([{ ...ANNA, role: "student" as never }])

    render(<VolunteerManagement courseId="course-1" onHome={vi.fn()} />)

    expect(
      await screen.findByRole("heading", {
        name: "Volontari non disponibili",
      }),
    ).toBeVisible()
  })
})
