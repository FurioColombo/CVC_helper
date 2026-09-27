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
  eraseAllCourseData: vi.fn().mockResolvedValue(undefined),
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
  readCrewHistory: vi.fn().mockResolvedValue([]),
  readCrewPlan: vi.fn().mockResolvedValue({
    crews: [],
    landStudentIds: [],
    selectedBoatIds: [],
    landAssignments: [],
  }),
  saveCrewPlan: vi.fn(),
}))

vi.mock("@/persistence/evaluations", () => ({
  listCourseEvaluations: vi.fn().mockResolvedValue([]),
  listEvaluations: vi.fn().mockResolvedValue([]),
  listStudentEvaluations: vi.fn().mockResolvedValue([]),
  saveEvaluation: vi.fn(),
}))

import { App, ScreenErrorBoundary } from "@/App"
import {
  eraseAllCourseData,
  getActiveCourse,
  saveActiveCourse,
  type CourseRecord,
} from "@/persistence/courses"
import { readCrewPlan } from "@/persistence/crews"
import { saveEvaluation } from "@/persistence/evaluations"
import { listStudents } from "@/persistence/students"

const readCourse = vi.mocked(getActiveCourse)
const saveCourse = vi.mocked(saveActiveCourse)
const getCrewPlan = vi.mocked(readCrewPlan)
const getStudents = vi.mocked(listStudents)
const writeEvaluation = vi.mocked(saveEvaluation)

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
    window.history.replaceState(null, "", window.location.href)
    window.localStorage.clear()
    readCourse.mockReset().mockResolvedValue(null)
    saveCourse.mockReset().mockResolvedValue(ACTIVE_COURSE)
    getStudents.mockReset().mockResolvedValue([])
    getCrewPlan.mockReset().mockResolvedValue({
      crews: [],
      landStudentIds: [],
      selectedBoatIds: [],
      landAssignments: [],
    })
  })

  it("directs first launch to course creation", async () => {
    render(<App />)

    expect(
      await screen.findByRole("heading", { name: "Crea il corso" }),
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Crea corso" })).toBeDisabled()
    expect(
      screen.queryByRole("navigation", { name: "Navigazione principale" }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("img", { name: "CVC" })).toBeVisible()
  })

  it("updates the complete visible identity with family and level", async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole("heading", { name: "Crea il corso" })
    await user.click(screen.getByRole("button", { name: "Cabinato" }))
    await user.click(screen.getByRole("button", { name: "Livello 4" }))

    expect(screen.getByLabelText(/^C4 - \d{1,2} \| \d{4}$/)).toBeVisible()
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
      await screen.findByRole("heading", { name: "D2 - 35 | 2026" }),
    ).toBeVisible()
    expect(
      screen.getByRole("heading", { name: "D2 - 35 | 2026" }),
    ).toHaveTextContent("D2 - 35| 2026")
  })

  it("restores the active course and exposes the exact primary navigation", async () => {
    readCourse.mockResolvedValue(ACTIVE_COURSE)
    const user = userEvent.setup()
    render(<App />)

    expect(
      await screen.findByRole("heading", { name: "D2 - 35 | 2026" }),
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
    expect(screen.getByRole("main")).toHaveFocus()
    expect(
      screen.getByRole("button", { name: "Configura barche" }),
    ).toBeVisible()
  })

  // F1 review round 3, F1R3-7/F1R-13: after a course is erased and a new one
  // created, browser history can still hold a screen entry from the old
  // course. That entry must open Home for the new course rather than the old
  // screen, but nothing exercised this directly.
  it("opens Home instead of a history entry left over from an erased course", async () => {
    window.history.replaceState(
      { __cvcHelperShell: { view: "settings", depth: 1, courseId: "old" } },
      "",
      window.location.href,
    )
    readCourse.mockResolvedValue(ACTIVE_COURSE)
    render(<App />)

    expect(
      await screen.findByRole("heading", { name: "D2 - 35 | 2026" }),
    ).toBeVisible()
    expect(
      screen.queryByRole("heading", { name: "Impostazioni" }),
    ).not.toBeInTheDocument()
  })

  it("keeps the selected-name display density in Settings across visits", async () => {
    readCourse.mockResolvedValue(ACTIVE_COURSE)
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole("heading", { name: "D2 - 35 | 2026" })
    await user.click(screen.getByRole("button", { name: "Impostazioni" }))

    const twoPerRow = await screen.findByRole("radio", { name: "2 per riga" })
    const threePerRow = screen.getByRole("radio", { name: "3 per riga" })
    expect(twoPerRow).toBeChecked()
    expect(
      screen.getByText(
        "Scegli quanti nomi degli allievi selezionati mostrare per riga.",
      ),
    ).toBeVisible()

    await user.click(threePerRow)
    expect(threePerRow).toBeChecked()
    expect(window.localStorage.getItem("cvc-helper.crew-display-columns")).toBe(
      "3",
    )

    await user.click(screen.getByRole("button", { name: "Torna alla Home" }))
    await user.click(screen.getByRole("button", { name: "Impostazioni" }))

    expect(
      await screen.findByRole("radio", { name: "3 per riga" }),
    ).toBeChecked()
    expect(screen.getByRole("radio", { name: "2 per riga" })).not.toBeChecked()
  })

  it("opens a dedicated volunteer area from Home", async () => {
    readCourse.mockResolvedValue(ACTIVE_COURSE)
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole("heading", { name: "D2 - 35 | 2026" })
    await user.click(screen.getByRole("button", { name: "Volontari" }))

    expect(
      await screen.findByRole("heading", { name: "Volontari" }),
    ).toBeVisible()
    await user.click(
      screen.getByRole("button", { name: "Aggiungi volontario" }),
    )
    expect(screen.getByRole("radio", { name: "ADV" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "IS" })).toBeVisible()
    expect(screen.getByRole("radio", { name: "CT" })).toBeVisible()
  })

  it("opens the dedicated Comandate area from Home", async () => {
    readCourse.mockResolvedValue(ACTIVE_COURSE)
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole("heading", { name: "D2 - 35 | 2026" })
    await user.click(screen.getByRole("button", { name: "Comandate" }))

    expect(
      await screen.findByRole("heading", { name: "Comandate" }),
    ).toBeVisible()
    expect(screen.getByText("Prima aggiungi gli allievi")).toBeVisible()
  })

  it("opens the dedicated evaluation area from Home", async () => {
    readCourse.mockResolvedValue(ACTIVE_COURSE)
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole("heading", { name: "D2 - 35 | 2026" })
    await user.click(screen.getByRole("button", { name: "Valutazioni" }))

    expect(
      await screen.findByRole("heading", { name: "Valutazioni" }),
    ).toBeVisible()
    expect(screen.getByLabelText("Sessione valutazioni")).toBeVisible()
  })

  it("opens session crew composition from primary navigation", async () => {
    readCourse.mockResolvedValue(ACTIVE_COURSE)
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole("heading", { name: "D2 - 35 | 2026" })
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
        declaredAgeAtCourseStart: null,
        sex: "male",
        phone: null,
        size: "M",
        initialNote: null,
        courseNote: null,
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
                capacity: 2,
                members: [
                  { personId: "student-1", personType: "student" as const },
                ],
                destination: "unassigned" as const,
                boatId: null,
              },
            ]
          : [],
      landStudentIds: [],
      selectedBoatIds: [],
      landAssignments: [],
    }))
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole("heading", { name: "D2 - 35 | 2026" })
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
      screen.getByRole("button", { name: "Indietro da Profilo" }),
    )
    expect(
      await screen.findByRole("heading", { name: "Equipaggi" }),
    ).toBeVisible()
    expect(screen.getByRole("combobox", { name: "Sessione" })).toHaveValue(
      "wed-pm",
    )
  })

  it("holds the bottom navigation and the phone Back until a failed evaluation is retried or discarded", async () => {
    readCourse.mockResolvedValue(ACTIVE_COURSE)
    getStudents.mockResolvedValue([
      {
        id: "student-1",
        courseId: ACTIVE_COURSE.id,
        firstName: "Aldo",
        surname: "Rossi",
        nickname: null,
        dateOfBirth: "2000-01-01",
        declaredAgeAtCourseStart: null,
        sex: "male",
        phone: null,
        size: null,
        initialNote: null,
        courseNote: null,
        active: 1,
      },
    ])
    writeEvaluation.mockRejectedValueOnce(new Error("offline write failed"))
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole("heading", { name: "D2 - 35 | 2026" })
    await user.click(screen.getByRole("button", { name: "Valutazioni" }))
    await user.click(
      await screen.findByRole("button", { name: "Valutazione di Aldo: +" }),
    )
    const alert = await screen.findByRole("alert")

    const primaryNavigation = screen.getByRole("navigation", {
      name: "Navigazione principale",
    })
    await user.click(
      within(primaryNavigation).getByRole("button", { name: "Home" }),
    )
    expect(screen.getByRole("heading", { name: "Valutazioni" })).toBeVisible()
    expect(alert).toHaveFocus()

    window.history.back()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.getByRole("heading", { name: "Valutazioni" })).toBeVisible()

    await user.click(within(alert).getByRole("button", { name: "Scarta" }))
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    )
    // The same phone Back now leaves, which also shows the held Back above
    // really reached the guard.
    window.history.back()
    expect(
      await screen.findByRole("heading", { name: "D2 - 35 | 2026" }),
    ).toBeVisible()
  })
})

describe("starting a new course from Settings", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", window.location.href)
    vi.mocked(getActiveCourse).mockReset().mockResolvedValue(ACTIVE_COURSE)
    vi.mocked(eraseAllCourseData).mockClear()
  })

  it("erases the course only after an explicit confirmation, then opens course creation", async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole("heading", { name: "D2 - 35 | 2026" })
    await user.click(screen.getByRole("button", { name: "Impostazioni" }))
    await user.click(
      screen.getByRole("button", {
        name: "Elimina il corso e inizia un nuovo corso",
      }),
    )
    const eraseAll = screen.getByRole("button", { name: "Elimina tutto" })
    expect(eraseAll).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Annulla" }))
    expect(eraseAllCourseData).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole("button", {
        name: "Elimina il corso e inizia un nuovo corso",
      }),
    )
    await user.click(
      screen.getByRole("checkbox", {
        name: "Ho capito: i dati non si possono recuperare",
      }),
    )
    await user.click(screen.getByRole("button", { name: "Elimina tutto" }))

    expect(
      await screen.findByRole("heading", { name: "Crea il corso" }),
    ).toBeVisible()
    expect(eraseAllCourseData).toHaveBeenCalledOnce()
    expect(window.history.state).toBeNull()
  })

  it("keeps the course and says so when the erase fails", async () => {
    vi.mocked(eraseAllCourseData).mockRejectedValueOnce(new Error("locked"))
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole("heading", { name: "D2 - 35 | 2026" })
    await user.click(screen.getByRole("button", { name: "Impostazioni" }))
    await user.click(
      screen.getByRole("button", {
        name: "Elimina il corso e inizia un nuovo corso",
      }),
    )
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: "Elimina tutto" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Il corso non è stato eliminato.",
    )
    expect(screen.getByRole("heading", { name: "Impostazioni" })).toBeVisible()
  })
})

describe("screen error boundary", () => {
  it("replaces a screen that fails to render with a way back Home", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)
    function Broken(): never {
      throw new Error("render failed")
    }
    render(
      <ScreenErrorBoundary>
        <Broken />
      </ScreenErrorBoundary>,
    )
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nessun dato è stato cancellato.",
    )
    expect(
      screen.getByRole("button", { name: "Torna alla Home" }),
    ).toBeVisible()
    consoleError.mockRestore()
  })
})
