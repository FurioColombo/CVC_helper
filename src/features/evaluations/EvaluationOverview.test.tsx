import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/evaluations", () => ({
  listCourseEvaluations: vi.fn(),
}))

import { EvaluationOverview } from "@/features/evaluations/EvaluationOverview"
import { listCourseEvaluations } from "@/persistence/evaluations"
import type { StudentRecord } from "@/persistence/students"

const STUDENTS: StudentRecord[] = [
  ["bea", "Bea", "Verdi"],
  ["aldo", "Aldo", "Rossi"],
  ["carlo", "Carlo", "Neri"],
].map(([id, firstName, surname]) => ({
  id: id!,
  courseId: "course-1",
  firstName: firstName!,
  surname: surname!,
  nickname: null,
  dateOfBirth: "2000-01-01",
  declaredAgeAtCourseStart: null,
  sex: null,
  phone: null,
  size: null,
  initialNote: null,
  courseNote: null,
  active: 1,
}))

const getEvaluations = vi.mocked(listCourseEvaluations)

describe("EvaluationOverview", () => {
  beforeEach(() => {
    getEvaluations.mockResolvedValue([
      {
        id: "1",
        studentId: "bea",
        sessionId: "sat-pm",
        value: "++",
        note: "Precisa",
      },
      {
        id: "2",
        studentId: "aldo",
        sessionId: "sat-pm",
        value: "+",
        note: null,
      },
      {
        id: "3",
        studentId: "aldo",
        sessionId: "sun-am",
        value: "+",
        note: null,
      },
      {
        id: "4",
        studentId: "carlo",
        sessionId: "sun-am",
        value: null,
        note: "A terra",
      },
    ])
  })

  it("shows compact sequences, actual counts, note detail and no numeric mean", async () => {
    const onOpenStudent = vi.fn()
    const user = userEvent.setup()
    render(
      <EvaluationOverview
        courseId="course-1"
        onOpenStudent={onOpenStudent}
        students={STUDENTS}
      />,
    )

    await screen.findByRole("heading", { name: "Riepilogo del corso" })
    expect(screen.getByText("Ordinamento")).toBeVisible()
    expect(screen.getByText("Valutazione")).toBeVisible()
    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((node) => node.textContent),
    ).toEqual(["Carlo", "Aldo", "Bea"])
    expect(screen.getByText("2 valutazioni")).toBeVisible()
    expect(screen.getAllByText("1 valutazione")).toHaveLength(1)
    expect(screen.getByText("0 valutazioni")).toBeVisible()
    expect(screen.queryByText("1.5")).not.toBeInTheDocument()
    expect(screen.queryByText("—")).not.toBeInTheDocument()
    expect(screen.getAllByRole("table")).toHaveLength(3)

    await user.click(
      screen.getByRole("button", {
        name: "Bea, Sabato PM: ++, nota presente",
      }),
    )
    const note = screen.getByRole("region", { name: "Nota di Bea" })
    expect(within(note).getByText("Sabato PM")).toBeVisible()
    expect(within(note).getByText("Precisa")).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Valutazione" }))
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("heading", { level: 3 })
          .map((node) => node.textContent),
      ).toEqual(["Bea", "Aldo", "Carlo"]),
    )
    await user.click(
      screen.getByRole("button", {
        name: "Apri dettaglio di Aldo, cognome Rossi",
      }),
    )
    expect(onOpenStudent).toHaveBeenCalledWith("aldo")
  })
})
