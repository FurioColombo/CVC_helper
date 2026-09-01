import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/students", () => ({ listStudents: vi.fn() }))
vi.mock("@/persistence/crews", () => ({ readCrewPlan: vi.fn() }))
vi.mock("@/persistence/evaluations", () => ({
  listCourseEvaluations: vi.fn().mockResolvedValue([]),
  listEvaluations: vi.fn(),
  saveEvaluation: vi.fn(),
}))

import { EvaluationManagement } from "@/features/evaluations/EvaluationManagement"
import type { CourseRecord } from "@/persistence/courses"
import { readCrewPlan } from "@/persistence/crews"
import { listEvaluations, saveEvaluation } from "@/persistence/evaluations"
import { listStudents, type StudentRecord } from "@/persistence/students"

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

const STUDENTS: StudentRecord[] = [
  ["student-1", "Aldo", "Rossi"],
  ["student-2", "Bea", "Verdi"],
  ["student-3", "Carlo", "Neri"],
].map(([id, firstName, surname]) => ({
  id: id!,
  courseId: COURSE.id,
  firstName: firstName!,
  surname: surname!,
  nickname: null,
  dateOfBirth: "2000-01-01",
  sex: null,
  phone: null,
  size: "M",
  initialNote: null,
  active: 1,
}))

const getStudents = vi.mocked(listStudents)
const getCrewPlan = vi.mocked(readCrewPlan)
const getEvaluations = vi.mocked(listEvaluations)
const save = vi.mocked(saveEvaluation)

function renderScreen(options?: {
  referenceDate?: Date
  transcribe?: (audio: Blob) => Promise<string>
}) {
  return render(
    <EvaluationManagement
      course={COURSE}
      onHome={vi.fn()}
      referenceDate={options?.referenceDate ?? new Date("2026-08-29T18:00:00")}
      transcribe={options?.transcribe}
    />,
  )
}

describe("evaluation management", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStudents.mockResolvedValue(STUDENTS)
    getCrewPlan.mockResolvedValue({
      crews: [
        {
          id: "crew-1",
          sessionId: "sat-pm",
          members: [
            { personId: "student-1", personType: "student" },
            { personId: "student-2", personType: "student" },
          ],
          destination: "unassigned",
          boatId: null,
        },
      ],
      landStudentIds: ["student-3"],
      selectedBoatIds: [],
      landAssignments: [
        { id: "land-1", sessionId: "sat-pm", studentId: "student-3" },
      ],
    })
    getEvaluations.mockResolvedValue([])
    save.mockImplementation(async (_courseId, studentId, sessionId, input) =>
      input.value === null && input.note === null
        ? null
        : {
            id: `evaluation-${studentId}-${sessionId}`,
            studentId,
            sessionId,
            ...input,
          },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("saves a direct mark and note for the exact student and session", async () => {
    const user = userEvent.setup()
    renderScreen()

    await screen.findByRole("heading", { name: "Aldo" })
    await user.click(
      screen.getByRole("button", { name: "Valutazione di Aldo: ++" }),
    )
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith("course-1", "student-1", "sat-pm", {
        value: "++",
        note: null,
      }),
    )
    await user.click(
      screen.getByRole("button", {
        name: "Aggiungi nota valutazione di Aldo",
      }),
    )
    await user.type(
      screen.getByRole("textbox", { name: "Nota valutazione di Aldo" }),
      "Buona conduzione",
    )
    await user.click(screen.getByRole("button", { name: "Salva nota" }))

    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith("course-1", "student-1", "sat-pm", {
        value: "++",
        note: "Buona conduzione",
      }),
    )
  })

  it("shares values between Allievi and Equipaggi and keeps A terra evaluable", async () => {
    const user = userEvent.setup()
    renderScreen()

    await screen.findByRole("heading", { name: "Aldo" })
    await user.click(
      screen.getByRole("button", { name: "Valutazione di Aldo: +" }),
    )
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    await user.click(screen.getByRole("button", { name: "Equipaggi" }))

    const crew = screen.getByRole("region", { name: "Equipaggio 1" })
    expect(
      within(crew).getByRole("button", { name: "Valutazione di Aldo: +" }),
    ).toHaveAttribute("aria-pressed", "true")
    const land = screen.getByRole("region", { name: "A terra" })
    expect(
      within(land).getByText(
        "Valutazione mancante: resta comunque valutabile.",
      ),
    ).toBeVisible()
    await user.click(
      within(land).getByRole("button", {
        name: "Valutazione di Carlo: -",
      }),
    )
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith("course-1", "student-3", "sat-pm", {
        value: "-",
        note: null,
      }),
    )
  })

  it("loads and edits a past session selected explicitly", async () => {
    getEvaluations.mockImplementation(async (_courseId, sessionId) =>
      sessionId === "sat-pm"
        ? [
            {
              id: "evaluation-old",
              studentId: "student-2",
              sessionId,
              value: "=",
              note: null,
            },
          ]
        : [],
    )
    const user = userEvent.setup()
    renderScreen({ referenceDate: new Date("2026-09-04T18:00:00") })

    expect(await screen.findByLabelText("Sessione valutazioni")).toHaveValue(
      "fri-pm",
    )
    await user.selectOptions(
      screen.getByLabelText("Sessione valutazioni"),
      "sat-pm",
    )
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Valutazione di Bea: =" }),
      ).toHaveAttribute("aria-pressed", "true"),
    )
    await user.click(
      screen.getByRole("button", { name: "Valutazione di Bea: +" }),
    )
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith("course-1", "student-2", "sat-pm", {
        value: "+",
        note: null,
      }),
    )
  })

  it("waits for a pending save before opening the overview", async () => {
    let finishSave: (
      value: Awaited<ReturnType<typeof saveEvaluation>>,
    ) => void = () => {
      throw new Error("Pending save was not initialized")
    }
    save.mockReturnValueOnce(
      new Promise((resolve) => {
        finishSave = resolve
      }),
    )
    const user = userEvent.setup()
    renderScreen()

    await screen.findByRole("heading", { name: "Aldo" })
    await user.click(
      screen.getByRole("button", { name: "Valutazione di Aldo: +" }),
    )
    const overviewButton = screen.getByRole("button", { name: "Riepilogo" })
    expect(overviewButton).toBeDisabled()
    expect(
      screen.queryByRole("heading", { name: "Riepilogo del corso" }),
    ).not.toBeInTheDocument()

    finishSave({
      id: "evaluation-student-1-sat-pm",
      studentId: "student-1",
      sessionId: "sat-pm",
      value: "+",
      note: null,
    })
    await waitFor(() => expect(overviewButton).toBeEnabled())
    await user.click(overviewButton)
    expect(
      await screen.findByRole("heading", { name: "Riepilogo del corso" }),
    ).toBeVisible()
  })

  it("keeps dictated text editable and stores no audio", async () => {
    const stopTrack = vi.fn()
    class FakeMediaRecorder {
      state = "inactive"
      mimeType = "audio/webm"
      ondataavailable: ((event: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      start() {
        this.state = "recording"
      }
      stop() {
        this.state = "inactive"
        this.ondataavailable?.({ data: new Blob(["audio"]) })
        this.onstop?.()
      }
    }
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder)
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrack }],
        }),
      },
    })
    const transcribe = vi.fn().mockResolvedValue("Virata precisa")
    const user = userEvent.setup()
    renderScreen({ transcribe })

    await screen.findByRole("heading", { name: "Aldo" })
    await user.click(
      screen.getByRole("button", {
        name: "Aggiungi nota valutazione di Aldo",
      }),
    )
    await user.click(
      screen.getByRole("button", {
        name: "Detta nota valutazione di Aldo",
      }),
    )
    await user.click(
      screen.getByRole("button", {
        name: "Termina dettatura valutazione di Aldo",
      }),
    )
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Nota valutazione di Aldo" }),
      ).toHaveValue("Virata precisa"),
    )
    expect(save).not.toHaveBeenCalled()
    expect(stopTrack).toHaveBeenCalledOnce()
    await user.click(screen.getByRole("button", { name: "Usa testo" }))
    await user.type(
      screen.getByRole("textbox", { name: "Nota valutazione di Aldo" }),
      " e pulita",
    )
    await user.click(screen.getByRole("button", { name: "Salva nota" }))

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith("course-1", "student-1", "sat-pm", {
        value: null,
        note: "Virata precisa e pulita",
      }),
    )
  })
})
