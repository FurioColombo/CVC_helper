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
    render(
      <StudentEvaluationHistory courseId="course-1" studentId="student-1" />,
    )

    const history = await screen.findByRole("region", {
      name: "Storico valutazioni",
    })
    expect(within(history).getByLabelText("Sabato PM: +")).toBeVisible()
    expect(
      within(history).getByLabelText("Domenica AM: nessuna valutazione"),
    ).toBeEmptyDOMElement()
    expect(within(history).getByLabelText("Lunedì AM: ++")).toBeVisible()
    expect(within(history).getByText("Ottima virata")).toBeVisible()
    expect(
      within(history).getByRole("heading", { name: "Allievo" }).parentElement,
    ).toHaveClass("sticky")
    expect(getHistory).toHaveBeenCalledWith("course-1", "student-1")
  })

  it("groups every canonical day into AM and PM read-only cards", async () => {
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
    const mondayAm = within(monday).getByLabelText(
      "Sessione Lunedì AM; valutazione =",
    )
    expect(within(mondayAm).getByTitle("Valutazione =")).toHaveAttribute(
      "data-evaluation",
      "=",
    )
    const mondayPm = within(monday).getByLabelText(
      "Sessione Lunedì PM; valutazione mancante",
    )
    expect(within(mondayPm).getByTitle("Nessuna valutazione")).toHaveAttribute(
      "data-evaluation",
      "empty",
    )
    expect(within(monday).queryByText("Nessuna nota.")).not.toBeInTheDocument()

    const sunday = within(chronology).getByRole("region", {
      name: "Domenica",
    })
    const blank = within(sunday).getByLabelText(
      "Sessione Domenica AM; valutazione mancante",
    )
    expect(within(blank).getByTitle("Nessuna valutazione")).toHaveAttribute(
      "data-evaluation",
      "empty",
    )
    expect(within(blank).getByTitle("Nessuna valutazione")).toHaveTextContent(
      "",
    )
    expect(within(sunday).getByText("Osservare la partenza")).toBeVisible()
  })

  it("focuses the history region after direct entry and can recover a load error", async () => {
    const user = userEvent.setup()
    getHistory.mockRejectedValueOnce(new Error("offline"))

    render(
      <StudentEvaluationHistory
        courseId="course-1"
        focusOnMount
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
