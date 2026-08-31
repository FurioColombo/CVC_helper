import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/students", () => ({
  createStudent: vi.fn(),
  createStudents: vi.fn(),
  listStudents: vi.fn(),
  setStudentActive: vi.fn(),
  updateStudent: vi.fn(),
  updateStudentKnowledge: vi.fn(),
}))

import { StudentManagement } from "@/features/students/StudentManagement"
import type { CourseRecord } from "@/persistence/courses"
import {
  createStudent,
  listStudents,
  setStudentActive,
  type StudentRecord,
} from "@/persistence/students"

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

const MARIO: StudentRecord = {
  id: "student-1",
  courseId: "course-1",
  firstName: "Mario",
  surname: "Rossi",
  nickname: null,
  dateOfBirth: "2010-01-01",
  sex: "male",
  phone: null,
  size: null,
  initialNote: null,
  active: 1,
}

const getStudents = vi.mocked(listStudents)
const addStudent = vi.mocked(createStudent)
const changeActive = vi.mocked(setStudentActive)

describe("StudentManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStudents.mockResolvedValue([])
    addStudent.mockResolvedValue(MARIO)
    changeActive.mockResolvedValue(undefined)
  })

  it("creates a student through the manual form", async () => {
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    await screen.findByRole("heading", { name: "Allievi" })
    await user.click(screen.getByRole("button", { name: "Menu allievi" }))
    expect(
      screen.getByRole("button", { name: "Conoscenza allievi" }),
    ).toBeDisabled()
    expect(
      screen.getAllByRole("button", { name: "Scan allievi" }),
    ).toHaveLength(2)
    await user.click(screen.getByRole("button", { name: "Menu allievi" }))
    await user.click(screen.getByRole("button", { name: "Aggiungi allievo" }))
    await user.type(screen.getByLabelText("Nome"), "Mario")
    await user.type(screen.getByLabelText("Cognome"), "Rossi")
    await user.type(screen.getByLabelText(/^Data di nascita/), "2010-01-01")
    expect(screen.getByRole("group", { name: "Sesso" })).toBeVisible()
    expect(screen.getByRole("radio", { name: "F" })).toBeVisible()
    expect(screen.getByRole("radio", { name: "Altro" })).toBeVisible()
    await user.click(screen.getByRole("radio", { name: "Altro" }))
    await user.click(screen.getByRole("button", { name: "Salva allievo" }))

    await waitFor(() =>
      expect(addStudent).toHaveBeenCalledWith(
        "course-1",
        expect.objectContaining({
          firstName: "Mario",
          surname: "Rossi",
          dateOfBirth: "2010-01-01",
          sex: "other",
        }),
      ),
    )
  })

  it("shows a minor marker and reverses disabled state", async () => {
    getStudents
      .mockResolvedValueOnce([MARIO])
      .mockResolvedValueOnce([{ ...MARIO, active: 0 }])
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(
      await screen.findByRole("button", {
        name: /Mario, 16 anni, M, Minorenne/,
      }),
    )
    expect(screen.getByText("Minorenne")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Disabilita allievo" }))

    await waitFor(() =>
      expect(changeActive).toHaveBeenCalledWith("student-1", "course-1", false),
    )
    expect(
      await screen.findByRole("button", { name: "Riattiva allievo" }),
    ).toBeVisible()
  })

  it("refuses structurally invalid persisted student records", async () => {
    getStudents.mockResolvedValue([{ ...MARIO, active: 4 as never }])

    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    expect(
      await screen.findByRole("heading", {
        name: "Allievi non disponibili",
      }),
    ).toBeVisible()
  })

  it("returns direct-detail navigation to its originating workflow", async () => {
    getStudents.mockResolvedValue([MARIO])
    const onInitialStudentBack = vi.fn()
    const user = userEvent.setup()
    render(
      <StudentManagement
        course={COURSE}
        initialStudentId="student-1"
        onHome={vi.fn()}
        onInitialStudentBack={onInitialStudentBack}
      />,
    )

    await screen.findByRole("heading", { name: "Mario" })
    await user.click(
      screen.getByRole("button", { name: "Indietro da Dettaglio" }),
    )

    expect(onInitialStudentBack).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole("heading", { name: "Allievi" }),
    ).not.toBeInTheDocument()
  })
})
