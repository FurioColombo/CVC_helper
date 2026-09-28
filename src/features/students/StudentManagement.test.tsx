import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const speechMocks = vi.hoisted(() => ({
  prepareSpeechTranscription: vi.fn(),
  transcribeAudio: vi.fn(),
}))

vi.mock("@/capabilities/speech", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/capabilities/speech")>()
  return {
    ...actual,
    prepareSpeechTranscription: speechMocks.prepareSpeechTranscription,
    transcribeAudio: speechMocks.transcribeAudio,
  }
})

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

// F2R-3: a corrupt stored date is normally caught by the domain invariant
// gate before any screen renders at all (a separate, structural check). This
// wraps the real check so one test can bypass it just for its one corrupt
// record, to exercise the edit form's own defense in isolation; every other
// test keeps the real check, since the mock's default delegates to it.
vi.mock("@/domain/invariants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/domain/invariants")>()
  return {
    ...actual,
    validateStudentRecords: vi.fn(actual.validateStudentRecords),
  }
})

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

import { validateStudentRecords } from "@/domain/invariants"
import { StudentManagement } from "@/features/students/StudentManagement"
import { requestLeave } from "@/navigation/browserHistory"
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
const checkStudents = vi.mocked(validateStudentRecords)

describe("StudentManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStudents.mockReset()
    editStudent.mockReset()
    removeStudent.mockReset()
    getStudents.mockResolvedValue([])
    speechMocks.prepareSpeechTranscription.mockReset()
    speechMocks.prepareSpeechTranscription.mockResolvedValue(undefined)
    speechMocks.transcribeAudio.mockReset()
    addStudent.mockResolvedValue(MARIO)
    changeActive.mockResolvedValue(undefined)
    assessDeletion.mockResolvedValue({ canDelete: true, references: [] })
    editStudent.mockResolvedValue(undefined)
    removeStudent.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: originalMediaRecorder,
    })
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    })
  })

  const originalMediaRecorder = globalThis.MediaRecorder
  const originalMediaDevices = navigator.mediaDevices

  it("waits to save a new student until note dictation finishes", async () => {
    let resolveTranscript!: (transcript: string) => void
    speechMocks.transcribeAudio.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveTranscript = resolve
      }),
    )
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: FakeMediaRecorder,
    })
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    })

    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)
    await screen.findByRole("heading", { name: "Allievi" })
    await user.click(screen.getByRole("button", { name: "Menu allievi" }))
    await user.click(
      screen.getAllByRole("button", { name: "Aggiungi allievo" })[0]!,
    )
    await user.type(screen.getByLabelText("Nome"), "Mario")
    await user.type(screen.getByLabelText("Cognome"), "Rossi")
    await user.type(
      screen.getByLabelText("Età compiuta il primo giorno del corso"),
      "16",
    )

    await user.click(
      screen.getByRole("button", { name: "Detta nota iniziale" }),
    )
    await user.click(
      await screen.findByRole("button", {
        name: "Termina dettatura nota iniziale",
      }),
    )
    await waitFor(() => expect(speechMocks.transcribeAudio).toHaveBeenCalled())

    const saveButton = screen.getByRole("button", { name: "Salva allievo" })
    expect(saveButton).toBeDisabled()
    await user.click(saveButton)
    expect(addStudent).not.toHaveBeenCalled()

    resolveTranscript("equipaggio sicuro")
    await waitFor(() => expect(saveButton).toBeEnabled())
    expect(screen.getByLabelText("Nota iniziale")).toHaveValue(
      "equipaggio sicuro",
    )
    await user.click(saveButton)

    await waitFor(() =>
      expect(addStudent).toHaveBeenCalledWith(
        "course-1",
        expect.objectContaining({ initialNote: "equipaggio sicuro" }),
      ),
    )
  })

  it("keeps an edit open when the back action is tapped during dictation", async () => {
    let resolveTranscript!: (transcript: string) => void
    speechMocks.transcribeAudio.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveTranscript = resolve
      }),
    )
    getStudents.mockResolvedValue([MARIO])
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: FakeMediaRecorder,
    })
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    })

    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)
    await user.click(await screen.findByRole("button", { name: /Mario, 16/ }))
    await user.click(screen.getByRole("button", { name: "Modifica allievo" }))
    await user.click(
      screen.getByRole("button", { name: "Detta nota del corso" }),
    )
    await user.click(
      await screen.findByRole("button", {
        name: "Termina dettatura nota del corso",
      }),
    )
    await waitFor(() => expect(speechMocks.transcribeAudio).toHaveBeenCalled())

    await user.click(
      screen.getByRole("button", { name: "Indietro da Modifica allievo" }),
    )
    expect(
      screen.getByText("Attendi la fine della dettatura prima di uscire."),
    ).toBeVisible()
    expect(
      screen.getByRole("heading", { name: "Modifica allievo" }),
    ).toBeVisible()
    expect(editStudent).not.toHaveBeenCalled()

    resolveTranscript("controllare la deriva")
    expect(await screen.findByLabelText("Nota del corso")).toHaveValue(
      "controllare la deriva",
    )
    await waitFor(() =>
      expect(
        screen.queryByText("Attendi la fine della dettatura prima di uscire."),
      ).not.toBeInTheDocument(),
    )
    await user.click(
      screen.getByRole("button", { name: "Indietro da Modifica allievo" }),
    )

    await waitFor(() =>
      expect(editStudent).toHaveBeenCalledWith(
        "student-1",
        "course-1",
        expect.objectContaining({ courseNote: "controllare la deriva" }),
      ),
    )
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
    await user.type(
      screen.getByLabelText("Età compiuta il primo giorno del corso"),
      "16",
    )
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
          dateOfBirth: "",
          declaredAgeAtCourseStart: 16,
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

  // Task 4 (owner, 2026-09-28): the three-dot menu and the empty Allievi page
  // used to offer a different pair of methods; both now list the same three
  // (manual, scan, assistant), in the same order, with the same icons.
  describe("one set of ways to add students", () => {
    function methodButtons(container: HTMLElement) {
      return within(container)
        .getAllByRole("button")
        .filter((button) =>
          ["Aggiungi allievo", "Scan allievi", "Usa un assistente"].includes(
            button.textContent ?? "",
          ),
        )
    }

    it("lists the same methods, in the same order, on the empty page and in the menu", async () => {
      const user = userEvent.setup()
      render(<StudentManagement course={COURSE} onHome={vi.fn()} />)
      await screen.findByRole("heading", { name: "Allievi" })

      const emptyPageMethods = methodButtons(document.body).map(
        (button) => button.textContent,
      )
      expect(emptyPageMethods).toEqual([
        "Aggiungi allievo",
        "Scan allievi",
        "Usa un assistente",
      ])

      await user.click(screen.getByRole("button", { name: "Menu allievi" }))
      const menu = screen.getByLabelText("Azioni allievi")
      const menuMethods = within(menu)
        .getAllByRole("button")
        .filter((button) =>
          ["Aggiungi allievo", "Scan allievi", "Usa un assistente"].includes(
            button.textContent ?? "",
          ),
        )
        .map((button) => button.textContent)
      expect(menuMethods).toEqual(emptyPageMethods)
    })

    it("opens the assistant, already expanded, from the empty page", async () => {
      const user = userEvent.setup()
      render(<StudentManagement course={COURSE} onHome={vi.fn()} />)
      await screen.findByRole("heading", { name: "Allievi" })

      await user.click(
        screen.getByRole("button", { name: "Usa un assistente" }),
      )

      expect(
        await screen.findByRole("heading", { name: "Scan allievi" }),
      ).toBeVisible()
      // Expanded on arrival: the paste box is visible without the operator
      // tapping "Oppure usa un assistente" themselves.
      expect(screen.getByLabelText("Risposta dell’assistente")).toBeVisible()
    })

    it("opens the assistant, already expanded, from the menu", async () => {
      const user = userEvent.setup()
      render(<StudentManagement course={COURSE} onHome={vi.fn()} />)
      await screen.findByRole("heading", { name: "Allievi" })

      await user.click(screen.getByRole("button", { name: "Menu allievi" }))
      await user.click(
        within(screen.getByLabelText("Azioni allievi")).getByRole("button", {
          name: "Usa un assistente",
        }),
      )

      expect(
        await screen.findByRole("heading", { name: "Scan allievi" }),
      ).toBeVisible()
      expect(screen.getByLabelText("Risposta dell’assistente")).toBeVisible()
    })

    it("still opens Scan allievi collapsed, ready for the camera first", async () => {
      const user = userEvent.setup()
      render(<StudentManagement course={COURSE} onHome={vi.fn()} />)
      await screen.findByRole("heading", { name: "Allievi" })

      await user.click(screen.getByRole("button", { name: "Scan allievi" }))

      expect(
        await screen.findByRole("heading", { name: "Scan allievi" }),
      ).toBeVisible()
      expect(screen.getByRole("button", { name: "Fai una foto" })).toBeVisible()
      expect(
        screen.queryByLabelText("Risposta dell’assistente"),
      ).not.toBeInTheDocument()
    })
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
    expect(screen.getByText(/puoi correggerla in seguito/i)).toBeVisible()
  })

  // F2R-3: `calculateStudentAge` throws for a stored date it cannot parse,
  // and the edit form used to call it while computing its very first state
  // (`initialDeclaredAge`), crashing before the form could even open. The
  // domain invariant gate would normally keep a record this corrupt off
  // every screen first (a separate, structural check); `checkStudents` is
  // relaxed for just this one record so the test can reach the edit form
  // directly (via the same history-state deep link a reload restores) and
  // exercise the form's own defense in isolation.
  it("opens the edit form with an empty age field for a corrupt stored date, and saves after an age is typed", async () => {
    getStudents.mockResolvedValue([
      { ...MARIO, dateOfBirth: "not-a-date", declaredAgeAtCourseStart: null },
    ])
    checkStudents.mockReturnValueOnce([])
    window.history.replaceState(
      {
        __cvcHelperShell: { view: "students" },
        __cvcHelperStudentScreen: { kind: "edit", studentId: "student-1" },
      },
      "",
      window.location.href,
    )
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    expect(
      await screen.findByRole("heading", { name: "Modifica allievo" }),
    ).toBeVisible()
    const ageField = screen.getByLabelText(
      "Età compiuta il primo giorno del corso",
    )
    expect(ageField).toHaveValue(null)

    await user.type(ageField, "14")

    await waitFor(() =>
      expect(editStudent).toHaveBeenCalledWith(
        "student-1",
        "course-1",
        expect.objectContaining({
          dateOfBirth: "",
          declaredAgeAtCourseStart: 14,
        }),
      ),
    )
    expect(await screen.findByText("Salvato")).toBeVisible()
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

  it("uses distinguishing surname prefixes in the student selection list", async () => {
    getStudents.mockResolvedValue([
      { ...MARIO, id: "student-rossi", firstName: "Mario", surname: "Rossi" },
      { ...MARIO, id: "student-rocchi", firstName: "Mario", surname: "Rocchi" },
    ])

    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    expect(
      await screen.findByRole("button", {
        name: "Mario Ros., 16 anni, M, Minorenne",
      }),
    ).toBeVisible()
    expect(
      screen.getByRole("button", {
        name: "Mario Roc., 16 anni, M, Minorenne",
      }),
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

  it.each([
    ["the page is hidden or closed", "pagehide"],
    ["the form unmounts", "unmount"],
  ])(
    "writes an edit still waiting for autosave when %s",
    async (_case, trigger) => {
      getStudents.mockResolvedValue([MARIO])
      const user = userEvent.setup()
      const view = render(
        <StudentManagement course={COURSE} onHome={vi.fn()} />,
      )

      await user.click(await screen.findByRole("button", { name: /Mario, 16/ }))
      await user.click(screen.getByRole("button", { name: "Modifica allievo" }))
      await user.type(screen.getByLabelText("Telefono"), "333")
      expect(editStudent).not.toHaveBeenCalled()
      if (trigger === "pagehide") window.dispatchEvent(new Event("pagehide"))
      else view.unmount()

      await waitFor(() =>
        expect(editStudent).toHaveBeenCalledWith(
          "student-1",
          "course-1",
          expect.objectContaining({ phone: "333" }),
        ),
      )
    },
  )

  it("refuses an age over the maximum instead of saving it", async () => {
    getStudents.mockResolvedValue([MARIO])
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: /Mario, 16/ }))
    await user.click(screen.getByRole("button", { name: "Modifica allievo" }))
    const age = screen.getByLabelText("Età compiuta il primo giorno del corso")
    fireEvent.change(age, { target: { value: "500" } })
    expect(await screen.findByText("Non salvato: completa età.")).toBeVisible()
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(editStudent).not.toHaveBeenCalled()
  })

  it("keeps saving visible while a queued edit waits behind an older write", async () => {
    getStudents.mockResolvedValue([MARIO])
    let resolveFirst: (() => void) | undefined
    editStudent.mockImplementationOnce(
      () => new Promise<void>((resolve) => (resolveFirst = resolve)),
    )
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: /Mario, 16/ }))
    await user.click(screen.getByRole("button", { name: "Modifica allievo" }))
    await user.type(screen.getByLabelText("Telefono"), "1")
    await waitFor(() => expect(editStudent).toHaveBeenCalledTimes(1), {
      timeout: 2_000,
    })
    // A newer edit arrives while the first write is still running: the status
    // must keep saying a save is in progress, before and after the debounce.
    await user.type(screen.getByLabelText("Nota del corso"), "Bozza")
    expect(screen.getByRole("status")).toHaveTextContent("Salvataggio…")
    // Past the debounce the newer write is queued behind the first one.
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(editStudent).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("status")).toHaveTextContent("Salvataggio…")
    resolveFirst?.()
    await waitFor(() => expect(editStudent).toHaveBeenCalledTimes(2))
    expect(await screen.findByText("Salvato")).toBeVisible()
  })

  it("explains why Back keeps an edit open while a required field is empty", async () => {
    getStudents.mockResolvedValue([MARIO])
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: /Mario, 16/ }))
    await user.click(screen.getByRole("button", { name: "Modifica allievo" }))
    await user.clear(screen.getByLabelText("Cognome"))
    expect(
      await screen.findByText("Non salvato: completa cognome."),
    ).toBeVisible()
    await user.click(
      screen.getByRole("button", { name: "Indietro da Modifica allievo" }),
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Per uscire completa cognome. Le altre modifiche sono già salvate.",
    )
    expect(
      screen.getByRole("heading", { name: "Modifica allievo" }),
    ).toBeVisible()
    expect(screen.getByLabelText("Cognome")).toHaveFocus()
    expect(editStudent).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText("Cognome"), "Bianchi")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: "Indietro da Modifica allievo" }),
    )
    await waitFor(() =>
      expect(editStudent).toHaveBeenCalledWith(
        "student-1",
        "course-1",
        expect.objectContaining({ surname: "Bianchi" }),
      ),
    )
  })

  it("holds the phone Back and the bottom navigation like the form's Back", async () => {
    getStudents.mockResolvedValue([MARIO])
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)

    await user.click(await screen.findByRole("button", { name: /Mario, 16/ }))
    await user.click(screen.getByRole("button", { name: "Modifica allievo" }))
    await user.clear(screen.getByLabelText("Nome"))
    const leave = vi.fn()
    act(() => requestLeave(leave))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Per uscire completa nome.",
    )
    expect(leave).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText("Nome"), "Marco")
    act(() => requestLeave(leave))
    // The latest edit is written before the held navigation completes.
    await waitFor(() => expect(leave).toHaveBeenCalledTimes(1))
    expect(editStudent).toHaveBeenLastCalledWith(
      "student-1",
      "course-1",
      expect.objectContaining({ firstName: "Marco" }),
    )
  })

  it("does not open the edit form when a long press moved", async () => {
    getStudents.mockResolvedValue([{ ...MARIO, phone: "3331234567" }])
    const user = userEvent.setup()
    render(<StudentManagement course={COURSE} onHome={vi.fn()} />)
    await user.click(await screen.findByRole("button", { name: /Mario, 16/ }))
    const field = screen.getByText("3331234567")

    function press(moveTo: number) {
      const at = (type: "pointerDown" | "pointerMove" | "pointerUp") =>
        createEvent[type](field, {
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          clientX: type === "pointerDown" ? 100 : moveTo,
          clientY: 100,
        })
      const down = at("pointerDown")
      Object.defineProperty(down, "timeStamp", { value: 1_000 })
      const move = at("pointerMove")
      const up = at("pointerUp")
      Object.defineProperty(up, "timeStamp", { value: 1_700 })
      fireEvent(field, down)
      fireEvent(field, move)
      fireEvent(field, up)
    }

    press(140)
    expect(
      screen.queryByRole("heading", { name: "Modifica allievo" }),
    ).not.toBeInTheDocument()

    press(104)
    expect(
      await screen.findByRole("heading", { name: "Modifica allievo" }),
    ).toBeVisible()
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
