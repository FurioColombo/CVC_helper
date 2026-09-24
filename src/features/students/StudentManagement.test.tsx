import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/students", () => ({
  assessStudentDeletion: vi.fn(),
  createStudent: vi.fn(),
  createStudents: vi.fn(),
  deleteUnusedStudent: vi.fn(),
  listStudents: vi.fn(),
  setStudentActive: vi.fn(),
  updateStudent: vi.fn(),
  updateStudentKnowledge: vi.fn(),
}))

vi.mock("@/persistence/evaluations", () => ({
  listCourseEvaluations: vi.fn().mockResolvedValue([]),
  listStudentEvaluations: vi.fn().mockResolvedValue([]),
}))

import { StudentManagement } from "@/features/students/StudentManagement"
import type { CourseRecord } from "@/persistence/courses"
import {
  assessStudentDeletion,
  createStudent,
  deleteUnusedStudent,
  listStudents,
  setStudentActive,
  updateStudent,
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
  declaredAgeAtCourseStart: null,
  sex: "male",
  phone: null,
  size: null,
  initialNote: null,
  courseNote: null,
  active: 1,
}

const getStudents = vi.mocked(listStudents)
const addStudent = vi.mocked(createStudent)
const changeActive = vi.mocked(setStudentActive)
const assessDeletion = vi.mocked(assessStudentDeletion)
const removeStudent = vi.mocked(deleteUnusedStudent)
const editStudent = vi.mocked(updateStudent)

describe("StudentManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStudents.mockReset()
    editStudent.mockReset()
    removeStudent.mockReset()
    getStudents.mockResolvedValue([])
    addStudent.mockResolvedValue(MARIO)
    changeActive.mockResolvedValue(undefined)
    assessDeletion.mockResolvedValue({ canDelete: true, references: [] })
    editStudent.mockResolvedValue(undefined)
    removeStudent.mockResolvedValue(undefined)
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

  it("creates an age-only student without inventing a birth date", async () => {
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    await screen.findByRole("heading", { name: "Allievi" })
    await user.click(screen.getByRole("button", { name: "Menu allievi" }))
    await user.click(
      screen.getAllByRole("button", { name: "Aggiungi allievo" })[0]!,
    )
    await user.type(screen.getByLabelText("Nome"), "Giulia")
    await user.type(screen.getByLabelText("Cognome"), "Bianchi")
    await user.type(
      screen.getByLabelText("Età compiuta il primo giorno del corso"),
      "17",
    )
    await user.click(screen.getByRole("radio", { name: "Altro" }))
    await user.click(screen.getByRole("button", { name: "Salva allievo" }))

    await waitFor(() =>
      expect(addStudent).toHaveBeenCalledWith(
        "course-1",
        expect.objectContaining({
          firstName: "Giulia",
          surname: "Bianchi",
          dateOfBirth: "",
          declaredAgeAtCourseStart: 17,
        }),
      ),
    )
  })

  it("shows declared-age provenance and opens that value for editing", async () => {
    getStudents.mockResolvedValue([
      {
        ...MARIO,
        dateOfBirth: "",
        declaredAgeAtCourseStart: 16,
      },
    ])
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(
      await screen.findByRole("button", {
        name: /Mario, 16 anni, M, Minorenne/,
      }),
    )
    const ageField = screen.getByText("Età dichiarata all’inizio del corso")
    expect(ageField.parentElement).toHaveTextContent("16 anni · dichiarata")
    await user.dblClick(screen.getByText("16 anni · dichiarata"))

    expect(
      await screen.findByRole("heading", { name: "Modifica allievo" }),
    ).toBeVisible()
    expect(
      screen.getByLabelText("Età compiuta il primo giorno del corso"),
    ).toHaveFocus()
    expect(screen.getByText(/non inventa una data di nascita/i)).toBeVisible()
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
    await user.click(
      screen.getByRole("button", { name: "Disponibilità ed eliminazione" }),
    )
    await user.click(screen.getByRole("button", { name: "Disabilita allievo" }))

    await waitFor(() =>
      expect(changeActive).toHaveBeenCalledWith("student-1", "course-1", false),
    )
    expect(
      await screen.findByRole("button", { name: "Riattiva allievo" }),
    ).toBeVisible()
  })

  it("starts a new card on Altro and shows the sex as a figure in the list", async () => {
    getStudents.mockResolvedValue([MARIO])
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    // The list carries the sex as an icon, so the row no longer prints an "M"
    // that could be read as the minor marker or as a size.
    const card = await screen.findByRole("button", {
      name: /Mario, 16 anni, M, Minorenne/,
    })
    expect(within(card).getByLabelText("Minorenne")).toHaveTextContent("M")
    expect(within(card).getAllByText("M")).toHaveLength(1)
    expect(card.querySelector("svg")).not.toBeNull()

    await user.click(screen.getByRole("button", { name: "Menu allievi" }))
    await user.click(
      screen.getAllByRole("button", { name: "Aggiungi allievo" })[0]!,
    )
    expect(screen.getByRole("radio", { name: "Altro" })).toBeChecked()
  })

  it("opens the edit form focused on the field a double click names", async () => {
    getStudents.mockResolvedValue([{ ...MARIO, phone: "3331234567" }])
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(
      await screen.findByRole("button", {
        name: /Mario, 16 anni, M, Minorenne/,
      }),
    )
    await user.dblClick(screen.getByText("3331234567"))

    expect(
      await screen.findByRole("heading", { name: "Modifica allievo" }),
    ).toBeVisible()
    await waitFor(() => expect(screen.getByLabelText("Telefono")).toHaveFocus())
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
        focusEvaluationHistory
        initialStudentId="student-1"
        onHome={vi.fn()}
        onInitialStudentBack={onInitialStudentBack}
      />,
    )

    await screen.findByRole("heading", { name: "Mario" })
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Storico valutazioni" }),
      ).toHaveFocus(),
    )
    await user.click(
      screen.getByRole("button", { name: "Indietro da Profilo" }),
    )

    expect(onInitialStudentBack).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole("heading", { name: "Allievi" }),
    ).not.toBeInTheDocument()
  })

  it("autosaves a complete edit and preserves distinct notes", async () => {
    getStudents.mockResolvedValue([
      {
        ...MARIO,
        size: "M",
        initialNote: "Esperienza Optimist",
        courseNote: "Osservare le virate",
      },
    ])
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: /Mario, 16/ }))
    await user.click(screen.getByRole("button", { name: "Modifica allievo" }))
    const courseNote = screen.getByLabelText("Nota del corso")
    await user.clear(courseNote)
    await user.type(courseNote, "Migliora rapidamente")

    await waitFor(
      () =>
        expect(editStudent).toHaveBeenLastCalledWith(
          "student-1",
          "course-1",
          expect.objectContaining({
            size: "M",
            initialNote: "Esperienza Optimist",
            courseNote: "Migliora rapidamente",
          }),
        ),
      { timeout: 2_000 },
    )
    expect(await screen.findByText("Salvato")).toBeVisible()
  })

  it("offers dictation on both notes of the student card", async () => {
    getStudents.mockResolvedValue([MARIO])
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: /Mario, 16/ }))
    await user.click(screen.getByRole("button", { name: "Modifica allievo" }))

    // Every note in the app can be spoken, not only the ones on the screens
    // that had dictation first.
    expect(
      screen.getByRole("button", { name: "Detta nota iniziale" }),
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Detta nota del corso" }),
    ).toBeVisible()
  })

  it("keeps typed text and offers retry after autosave fails", async () => {
    getStudents.mockResolvedValue([MARIO])
    editStudent.mockRejectedValueOnce(new Error("offline"))
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: /Mario, 16/ }))
    await user.click(screen.getByRole("button", { name: "Modifica allievo" }))
    await user.type(screen.getByLabelText("Nota del corso"), "Testo da tenere")

    expect(
      await screen.findByText("Modifiche non salvate. Il testo resta qui."),
    ).toBeVisible()
    expect(screen.getByLabelText("Nota del corso")).toHaveValue(
      "Testo da tenere",
    )
    editStudent.mockResolvedValue(undefined)
    await user.click(screen.getByRole("button", { name: "Riprova" }))
    expect(await screen.findByText("Salvato")).toBeVisible()
  })

  it("flushes the latest edit when leaving the focused form", async () => {
    getStudents.mockResolvedValue([MARIO])
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: /Mario, 16/ }))
    await user.click(screen.getByRole("button", { name: "Modifica allievo" }))
    await user.type(screen.getByLabelText("Nota del corso"), "Ultimo testo")
    await user.click(
      screen.getByRole("button", { name: "Indietro da Modifica allievo" }),
    )

    await waitFor(() =>
      expect(editStudent).toHaveBeenCalledWith(
        "student-1",
        "course-1",
        expect.objectContaining({ courseNote: "Ultimo testo" }),
      ),
    )
  })

  it("keeps the edit form open when leaving cannot save the latest draft", async () => {
    getStudents.mockResolvedValue([MARIO])
    editStudent.mockRejectedValueOnce(new Error("offline"))
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: /Mario, 16/ }))
    await user.click(screen.getByRole("button", { name: "Modifica allievo" }))
    await user.type(screen.getByLabelText("Nota del corso"), "Bozza protetta")
    await user.click(
      screen.getByRole("button", { name: "Indietro da Modifica allievo" }),
    )

    expect(
      await screen.findByRole("heading", { name: "Modifica allievo" }),
    ).toBeVisible()
    expect(
      screen.getByText("Modifiche non salvate. Il testo resta qui."),
    ).toBeVisible()
    expect(screen.getByLabelText("Nota del corso")).toHaveValue(
      "Bozza protetta",
    )
    expect(screen.getByRole("button", { name: "Riprova" })).toBeVisible()
  })

  it("never reports a newer draft saved when an older write finishes", async () => {
    getStudents.mockResolvedValue([MARIO])
    let resolveFirst: (() => void) | undefined
    let resolveSecond: (() => void) | undefined
    editStudent
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => (resolveFirst = resolve)),
      )
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => (resolveSecond = resolve)),
      )
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: /Mario, 16/ }))
    await user.click(screen.getByRole("button", { name: "Modifica allievo" }))
    await user.type(screen.getByLabelText("Telefono"), "1")
    await waitFor(() => expect(editStudent).toHaveBeenCalledTimes(1), {
      timeout: 2_000,
    })
    await user.type(screen.getByLabelText("Nota del corso"), "Bozza nuova")
    resolveFirst?.()
    expect(screen.queryByText("Salvato")).not.toBeInTheDocument()
    await waitFor(() => expect(editStudent).toHaveBeenCalledTimes(2), {
      timeout: 2_000,
    })
    expect(screen.queryByText("Salvato")).not.toBeInTheDocument()
    resolveSecond?.()
    expect(await screen.findByText("Salvato")).toBeVisible()
  })

  it("confirms and atomically deletes only an unused student", async () => {
    getStudents.mockResolvedValueOnce([MARIO]).mockResolvedValueOnce([])
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: /Mario, 16/ }))
    await user.click(
      screen.getByRole("button", { name: "Disponibilità ed eliminazione" }),
    )
    await user.click(
      await screen.findByRole("button", { name: "Elimina definitivamente" }),
    )
    expect(screen.getByText("Eliminare definitivamente Mario?")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Conferma" }))

    await waitFor(() =>
      expect(removeStudent).toHaveBeenCalledWith("student-1", "course-1"),
    )
    expect(await screen.findByText("Nessun allievo")).toBeVisible()
  })

  it("lists actual blocking history and offers disable instead", async () => {
    getStudents.mockResolvedValue([MARIO])
    assessDeletion.mockResolvedValue({
      canDelete: false,
      references: [
        { kind: "duty", referenceId: "saturday" },
        { kind: "evaluation", referenceId: "wed-am" },
        { kind: "land", referenceId: "corrupt-session" },
      ],
    })
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: /Mario, 16/ }))
    await user.click(
      screen.getByRole("button", { name: "Disponibilità ed eliminazione" }),
    )

    expect(await screen.findByText("Comandata: Sabato")).toBeVisible()
    expect(screen.getByText("Valutazione o nota: Mercoledì AM")).toBeVisible()
    expect(screen.getByText("A terra: sessione non valida")).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Elimina definitivamente" }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Disabilita allievo" }),
    ).toBeVisible()
  })
})
