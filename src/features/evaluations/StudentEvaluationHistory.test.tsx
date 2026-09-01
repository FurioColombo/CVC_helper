import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/evaluations", () => ({
  listCourseEvaluations: vi.fn(),
  listStudentEvaluations: vi.fn(),
}))

import { StudentEvaluationHistory } from "@/features/evaluations/StudentEvaluationHistory"
import {
  listCourseEvaluations,
  listStudentEvaluations,
} from "@/persistence/evaluations"

const getHistory = vi.mocked(listStudentEvaluations)
const getCourseHistory = vi.mocked(listCourseEvaluations)

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
    getCourseHistory.mockResolvedValue([
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
    expect(within(history).getByText("Sabato PM")).toBeVisible()
    expect(within(history).getByText("Domenica AM")).toBeVisible()
    expect(within(history).getByText("Lunedì AM")).toBeVisible()
    expect(within(history).getByLabelText("Valutazione +")).toBeVisible()
    expect(within(history).getByLabelText("Valutazione ++")).toBeVisible()
    expect(
      within(history).getAllByLabelText("Valutazione mancante"),
    ).toHaveLength(2)
    expect(within(history).getByText("Ottima virata")).toBeVisible()
    expect(getHistory).toHaveBeenCalledWith("course-1", "student-1")
    expect(getCourseHistory).toHaveBeenCalledWith("course-1")
  })
})
