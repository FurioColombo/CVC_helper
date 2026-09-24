import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/evaluations", () => ({
  listStudentEvaluations: vi.fn(),
}))

import { StudentEvaluationHistory } from "@/features/evaluations/StudentEvaluationHistory"
import { listStudentEvaluations } from "@/persistence/evaluations"

const getHistory = vi.mocked(listStudentEvaluations)

describe("StudentEvaluationHistory", () => {
  beforeEach(() => {
    getHistory.mockResolvedValue([
      {
        id: "1",
        studentId: "student-1",
        sessionId: "sat-pm",
        value: "+",
        note: null,
      },
      {
        id: "2",
        studentId: "student-1",
        sessionId: "mon-am",
        value: "++",
        note: "Ottima virata",
      },
    ])
  })

  it("shows the exact chronological session, symbol and associated note", async () => {
    const onOpenEvaluationSession = vi.fn()
    const user = userEvent.setup()
    render(
      <StudentEvaluationHistory
        courseId="course-1"
        onOpenEvaluationSession={onOpenEvaluationSession}
        studentId="student-1"
      />,
    )

    const history = await screen.findByRole("region", {
      name: "Storico valutazioni",
    })
    expect(
      within(history).getByRole("button", {
        name: "Apri Valutazioni di Sabato PM; valutazione +",
      }),
    ).toBeVisible()
    expect(
      within(history).getByRole("button", {
        name: "Apri Valutazioni di Domenica AM; valutazione mancante",
      }),
    ).toHaveAttribute("data-evaluation", "empty")
    const mondaySession = within(history).getByRole("button", {
      name: "Apri Valutazioni di Lunedì AM; valutazione ++",
    })
    expect(mondaySession).toBeVisible()
    expect(within(history).getByText("Ottima virata")).toBeVisible()
    expect(
      within(history).getByRole("heading", { name: "Allievo" }).parentElement,
    ).toHaveClass("sticky")
    expect(getHistory).toHaveBeenCalledWith("course-1", "student-1")

    await user.click(mondaySession)
    expect(onOpenEvaluationSession).toHaveBeenCalledExactlyOnceWith("mon-am")
  })

  it("links every canonical session while keeping absent half-days static", async () => {
    getHistory.mockResolvedValue([
      {
        id: "neutral",
        studentId: "student-1",
        sessionId: "mon-am",
        value: "=",
        note: null,
      },
      {
        id: "blank-with-note",
        studentId: "student-1",
        sessionId: "sun-am",
        value: null,
        note: "Osservare la partenza",
      },
    ])

    render(
      <StudentEvaluationHistory
        courseId="course-1"
        onOpenEvaluationSession={() => undefined}
        studentId="student-1"
        studentFullName="Mario Rossi"
        studentName="Mario"
      />,
    )

    const history = await screen.findByRole("region", {
      name: "Storico valutazioni",
    })
    expect(
      within(history).getByRole("heading", { name: "Mario Rossi" }),
    ).toBeVisible()
    const chronology = within(history).getByLabelText("Cronologia per giorno")
    expect(within(chronology).getAllByRole("region")).toHaveLength(7)

    const monday = within(chronology).getByRole("region", { name: "Lunedì" })
    expect(within(monday).getByText("AM")).toBeVisible()
    expect(within(monday).getByText("PM")).toBeVisible()
    const mondayAm = within(monday).getByRole("button", {
      name: "Apri Valutazioni di Lunedì AM; valutazione =",
    })
    expect(mondayAm).toHaveAttribute("data-evaluation", "=")
    const mondayPm = within(monday).getByRole("button", {
      name: "Apri Valutazioni di Lunedì PM; valutazione mancante",
    })
    expect(mondayPm).toHaveAttribute("data-evaluation", "empty")
    expect(within(monday).queryByText("Nessuna nota.")).not.toBeInTheDocument()

    const saturday = within(chronology).getByRole("region", {
      name: "Sabato",
    })
    const blank = within(saturday).getByLabelText(
      "Sessione Sabato AM; nessuna sessione",
    )
    expect(within(blank).getByText("Nessuna sessione.")).toBeVisible()
    const sunday = within(chronology).getByRole("region", { name: "Domenica" })
    expect(within(sunday).getByText("Osservare la partenza")).toBeVisible()
  })

  it("focuses the history region after direct entry and can recover a load error", async () => {
    const user = userEvent.setup()
    getHistory.mockRejectedValueOnce(new Error("offline"))

    render(
      <StudentEvaluationHistory
        courseId="course-1"
        focusOnMount
        onOpenEvaluationSession={() => undefined}
        studentId="student-1"
        studentName="Mario Rossi"
      />,
    )

    const history = await screen.findByRole("region", {
      name: "Storico valutazioni",
    })
    expect(within(history).getByRole("alert")).toHaveTextContent(
      "Valutazioni non disponibili.",
    )
    getHistory.mockResolvedValueOnce([])
    await user.click(within(history).getByRole("button", { name: "Riprova" }))

    await within(history).findByRole("table", {
      name: "Valutazioni settimanali di Mario Rossi",
    })
    expect(history).toHaveFocus()
  })
})
