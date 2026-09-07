import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { WeeklyEvaluationGrid } from "@/features/evaluations/WeeklyEvaluationGrid"
import type { EvaluationRecord } from "@/persistence/evaluations"

const RECORDS: EvaluationRecord[] = [
  {
    id: "sat-pm",
    studentId: "student-1",
    sessionId: "sat-pm",
    value: "+",
    note: null,
  },
  {
    id: "sun-am",
    studentId: "student-1",
    sessionId: "sun-am",
    value: null,
    note: "Da rivedere la partenza",
  },
  {
    id: "sun-pm",
    studentId: "student-1",
    sessionId: "sun-pm",
    value: "++",
    note: "Ottimo miglioramento",
  },
  {
    id: "mon-am",
    studentId: "student-1",
    sessionId: "mon-am",
    value: "-",
    note: "",
  },
  {
    id: "mon-pm",
    studentId: "student-1",
    sessionId: "mon-pm",
    value: "=",
    note: "Mantenere il ritmo",
  },
]

describe("WeeklyEvaluationGrid", () => {
  it("groups canonical sessions by day and keeps the table phone safe", () => {
    render(
      <WeeklyEvaluationGrid
        records={RECORDS.slice(0, 3)}
        studentName="Mario Rossi"
      />,
    )

    const table = screen.getByRole("table", {
      name: "Valutazioni settimanali di Mario Rossi",
    })
    expect(within(table).getByText("Sabato")).toBeVisible()
    expect(within(table).getByText("Domenica")).toBeVisible()
    expect(within(table).getByText("Venerdì")).toBeVisible()
    expect(within(table).getByLabelText("Sabato PM: +")).toHaveAttribute(
      "data-evaluation",
      "+",
    )
    expect(
      within(table).getByLabelText("Domenica AM: nessuna valutazione")
        .textContent,
    ).toBe("")
    expect(within(table).getByLabelText("Domenica PM: ++")).toHaveClass(
      "bg-[#e4f3e7]",
    )
    expect(table.closest("div")).not.toHaveClass("overflow-x-auto")
  })

  it("shows only the two most recent notes and reveals the rest on demand", async () => {
    const user = userEvent.setup()
    render(<WeeklyEvaluationGrid records={RECORDS} />)

    const notes = await screen.findByRole("region", { name: "Note recenti" })
    expect(within(notes).getByText("Ottimo miglioramento")).toBeVisible()
    expect(within(notes).getByText("Mantenere il ritmo")).toBeVisible()
    expect(
      within(notes).queryByText("Da rivedere la partenza"),
    ).not.toBeInTheDocument()
    expect(
      within(notes).getByRole("button", { name: "Altre note" }),
    ).toBeVisible()

    await user.click(within(notes).getByRole("button", { name: "Altre note" }))
    expect(within(notes).getByText("Da rivedere la partenza")).toBeVisible()
    expect(
      within(notes).getByRole("button", { name: "Mostra meno note" }),
    ).toHaveAttribute("aria-expanded", "true")
  })

  it("keeps an empty course summary compact", () => {
    render(<WeeklyEvaluationGrid records={[]} />)
    const table = screen.getByRole("table", { name: "Valutazioni settimanali" })
    expect(within(table).getAllByRole("row")).toHaveLength(8)
    expect(
      within(table).getByLabelText("Venerdì PM: nessuna valutazione"),
    ).toBeEmptyDOMElement()
  })
})
