import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/courses", () => ({
  getActiveCourse: vi.fn(),
  saveActiveCourse: vi.fn(),
}))

vi.mock("@/persistence/students", () => ({
  createStudent: vi.fn(),
  createStudents: vi.fn(),
  listStudents: vi.fn().mockResolvedValue([]),
  setStudentActive: vi.fn(),
  updateStudent: vi.fn(),
  updateStudentKnowledge: vi.fn(),
}))

vi.mock("@/persistence/volunteers", () => ({
  createVolunteer: vi.fn(),
  listVolunteers: vi.fn().mockResolvedValue([]),
  updateVolunteer: vi.fn(),
}))

vi.mock("@/persistence/boats", () => ({
  createBoat: vi.fn(),
  createBoats: vi.fn(),
  createFault: vi.fn(),
  deleteBoat: vi.fn(),
  listBoats: vi.fn().mockResolvedValue([]),
  listFaults: vi.fn().mockResolvedValue([]),
  setBoatAvailability: vi.fn(),
  updateFaultDescription: vi.fn(),
  updateFaultState: vi.fn(),
}))

vi.mock("@/persistence/duties", () => ({
  readDutyPlan: vi.fn().mockResolvedValue({ assignments: [], settings: null }),
  saveDutyPlan: vi.fn(),
}))

vi.mock("@/persistence/crews", () => ({
  readCrewPlan: vi.fn().mockResolvedValue({
    crews: [],
    landStudentIds: [],
    landAssignments: [],
  }),
  saveCrewPlan: vi.fn(),
}))

import { App } from "@/App"
import {
  getActiveCourse,
  saveActiveCourse,
  type CourseRecord,
} from "@/persistence/courses"
import { readCrewPlan } from "@/persistence/crews"
import { listStudents } from "@/persistence/students"

const readCourse = vi.mocked(getActiveCourse)
const saveCourse = vi.mocked(saveActiveCourse)
const getCrewPlan = vi.mocked(readCrewPlan)
const getStudents = vi.mocked(listStudents)

const ACTIVE_COURSE: CourseRecord = {
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

describe("course setup and application shell", () => {
  beforeEach(() => {
    readCourse.mockReset().mockResolvedValue(null)
    saveCourse.mockReset().mockResolvedValue(ACTIVE_COURSE)
    getStudents.mockReset().mockResolvedValue([])
    getCrewPlan.mockReset().mockResolvedValue({
      crews: [],
      landStudentIds: [],
      landAssignments: [],
    })
  })

  it("directs first launch to course creation", async () => {
    render(<App />)

    expect(
      await screen.findByRole("heading", { name: "Crea il corso" }),
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Crea corso" })).toBeDisabled()
  })

  it("creates a course from the two required selections", async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole("heading", { name: "Crea il corso" })
    await user.click(screen.getByRole("button", { name: "Deriva" }))
    await user.click(screen.getByRole("button", { name: "Livello 2" }))
    await user.click(screen.getByRole("button", { name: "Crea corso" }))

    await waitFor(() =>
      expect(saveCourse).toHaveBeenCalledWith(
        expect.objectContaining({ family: "Deriva", level: 2 }),
      ),
    )
    expect(
      await screen.findByRole("heading", { name: "D2 35 2026" }),
    ).toBeVisible()
    expect(
      screen.getByRole("heading", { name: "D2 35 2026" }),
    ).toHaveTextContent("D2·35|2026")
  })

  it("restores the active course and exposes the exact primary navigation", async () => {
    readCourse.mockResolvedValue(ACTIVE_COURSE)
    const user = userEvent.setup()
    render(<App />)

    expect(
      await screen.findByRole("heading", { name: "D2 35 2026" }),
    ).toBeVisible()
    expect(screen.queryByText("Corso attivo")).not.toBeInTheDocument()
    expect(screen.queryByText("Operatività")).not.toBeInTheDocument()
    const navigation = screen.getByRole("navigation", {
      name: "Navigazione principale",
    })
    expect(
      within(navigation)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Avarie", "Home", "Equipaggi"])

    await user.click(within(navigation).getByRole("button", { name: "Avarie" }))
    expect(screen.getByRole("heading", { name: "Avarie" })).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Configura barche" }),
    ).toBeVisible()
  })

  it("opens a dedicated volunteer area from Home", async () => {
    readCourse.mockResolvedValue(ACTIVE_COURSE)
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole("heading", { name: "D2 35 2026" })
    await user.click(screen.getByRole("button", { name: "Volontari" }))

    expect(
      await screen.findByRole("heading", { name: "Volontari" }),
    ).toBeVisible()
    expect(screen.getByText(/distinti dagli allievi/)).toBeVisible()
  })

  it("opens the dedicated Comandate area from Home", async () => {
    readCourse.mockResolvedValue(ACTIVE_COURSE)
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole("heading", { name: "D2 35 2026" })
    await user.click(screen.getByRole("button", { name: "Comandate" }))

    expect(
      await screen.findByRole("heading", { name: "Comandate" }),
    ).toBeVisible()
    expect(screen.getByText("Prima aggiungi gli allievi")).toBeVisible()
  })

  it("opens session crew composition from primary navigation", async () => {
    readCourse.mockResolvedValue(ACTIVE_COURSE)
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole("heading", { name: "D2 35 2026" })
    await user.click(
      within(
        screen.getByRole("navigation", { name: "Navigazione principale" }),
      ).getByRole("button", { name: "Equipaggi" }),
    )

    expect(
      await screen.findByRole("heading", { name: "Equipaggi" }),
    ).toBeVisible()
    expect(screen.getByLabelText("Sessione")).toHaveValue("sat-pm")
    expect(
      screen.getByRole("heading", { name: "Prepara la sessione" }),
    ).toBeVisible()
  })

  it("returns from direct student detail to the originating crew session", async () => {
    readCourse.mockResolvedValue(ACTIVE_COURSE)
    getStudents.mockResolvedValue([
      {
        id: "student-1",
        courseId: "course-1",
        firstName: "Mario",
        surname: "Rossi",
        nickname: null,
        dateOfBirth: "2000-01-01",
        sex: "male",
        phone: null,
        size: "M",
        initialNote: null,
        active: 1,
      },
    ])
    getCrewPlan.mockImplementation(async (_courseId, sessionId) => ({
      crews:
        sessionId === "wed-pm"
          ? [
              {
                id: "crew-1",
                sessionId,
                members: [
                  { personId: "student-1", personType: "student" as const },
                ],
              },
            ]
          : [],
      landStudentIds: [],
      landAssignments: [],
    }))
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole("heading", { name: "D2 35 2026" })
    await user.click(
      within(
        screen.getByRole("navigation", { name: "Navigazione principale" }),
      ).getByRole("button", { name: "Equipaggi" }),
    )
    await user.selectOptions(
      await screen.findByRole("combobox", { name: "Sessione" }),
      "wed-pm",
    )
    fireEvent.contextMenu(
      await screen.findByRole("button", { name: "Mario, equipaggio 1" }),
    )

    await screen.findByRole("heading", { name: "Mario" })
    await user.click(
      screen.getByRole("button", { name: "Indietro da Dettaglio" }),
    )
    expect(
      await screen.findByRole("heading", { name: "Equipaggi" }),
    ).toBeVisible()
    expect(screen.getByRole("combobox", { name: "Sessione" })).toHaveValue(
      "wed-pm",
    )
  })
})
