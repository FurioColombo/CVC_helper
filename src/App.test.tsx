import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/courses", () => ({
  getActiveCourse: vi.fn(),
  saveActiveCourse: vi.fn(),
}))

import { App } from "@/App"
import {
  getActiveCourse,
  saveActiveCourse,
  type CourseRecord,
} from "@/persistence/courses"

const readCourse = vi.mocked(getActiveCourse)
const saveCourse = vi.mocked(saveActiveCourse)

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
    readCourse.mockReset().mockResolvedValue(null)
    saveCourse.mockReset().mockResolvedValue(ACTIVE_COURSE)
  })

  it("directs first launch to course creation", async () => {
    render(<App />)

    expect(
      await screen.findByRole("heading", { name: "Crea il corso" }),
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Crea corso" })).toBeDisabled()
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
      await screen.findByRole("heading", { name: "D2 35 2026" }),
    ).toBeVisible()
    expect(
      screen.getByRole("heading", { name: "D2 35 2026" }),
    ).toHaveTextContent("D2·35|2026")
  })

  it("restores the active course and exposes the exact primary navigation", async () => {
    readCourse.mockResolvedValue(ACTIVE_COURSE)
    const user = userEvent.setup()
    render(<App />)

    expect(
      await screen.findByRole("heading", { name: "D2 35 2026" }),
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
  })
})
