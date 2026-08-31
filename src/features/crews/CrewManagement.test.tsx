import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/crews", () => ({
  readCrewHistory: vi.fn(),
  readCrewPlan: vi.fn(),
  saveCrewPlan: vi.fn(),
}))

vi.mock("@/persistence/students", () => ({
  listStudents: vi.fn(),
}))

vi.mock("@/persistence/volunteers", () => ({
  listVolunteers: vi.fn(),
}))

import { CrewManagement } from "@/features/crews/CrewManagement"
import type { CrewPlan } from "@/domain/crews"
import type { CourseRecord } from "@/persistence/courses"
import {
  readCrewHistory,
  readCrewPlan,
  saveCrewPlan,
} from "@/persistence/crews"
import { listStudents, type StudentRecord } from "@/persistence/students"
import { listVolunteers, type VolunteerRecord } from "@/persistence/volunteers"

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
  ["student-1", "Aldo", "Rossi", 1],
  ["student-2", "Bea", "Verdi", 1],
  ["student-3", "Carlo", "Neri", 1],
  ["student-4", "Dina", "Blu", 0],
].map(([id, firstName, surname, active]) => ({
  id: id as string,
  courseId: COURSE.id,
  firstName: firstName as string,
  surname: surname as string,
  nickname: null,
  dateOfBirth: "2000-01-01",
  sex: null,
  phone: null,
  size: "M",
  initialNote: null,
  active: active as 0 | 1,
}))

const VOLUNTEERS: VolunteerRecord[] = [
  { id: "volunteer-1", courseId: COURSE.id, name: "Vera ADV", role: "ADV" },
]

const getPlan = vi.mocked(readCrewPlan)
const getHistory = vi.mocked(readCrewHistory)
const savePlan = vi.mocked(saveCrewPlan)
const getStudents = vi.mocked(listStudents)
const getVolunteers = vi.mocked(listVolunteers)

function stored(plan: CrewPlan) {
  return {
    ...plan,
    landAssignments: plan.landStudentIds.map((studentId, index) => ({
      id: `land-${index}`,
      sessionId: "sat-pm" as const,
      studentId,
    })),
  }
}

describe("CrewManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStudents.mockResolvedValue(STUDENTS)
    getVolunteers.mockResolvedValue(VOLUNTEERS)
    getPlan.mockResolvedValue(stored({ crews: [], landStudentIds: [] }))
    getHistory.mockResolvedValue([])
    savePlan.mockResolvedValue(undefined)
  })

  it("keeps student and staff pools separate and accounts for A terra", async () => {
    const user = userEvent.setup()
    render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    await user.clear(await screen.findByRole("spinbutton"))
    await user.type(screen.getByRole("spinbutton"), "2")
    await user.click(screen.getByRole("button", { name: "Crea equipaggi" }))

    const studentPool = screen.getByRole("region", {
      name: "Allievi disponibili",
    })
    const staffPool = screen.getByRole("region", {
      name: "ADV e IS disponibili",
    })
    expect(
      within(studentPool).getByRole("button", { name: "Aldo" }),
    ).toBeVisible()
    expect(
      within(staffPool).getByRole("button", { name: "Vera ADV" }),
    ).toBeVisible()
    expect(screen.getByText("Allievi sistemati 0/3")).toBeVisible()

    await user.click(within(studentPool).getByRole("button", { name: "Aldo" }))
    await user.click(
      screen.getByRole("button", { name: "Sposta Aldo in equipaggio 1" }),
    )
    await waitFor(() =>
      expect(
        within(studentPool).queryByRole("button", { name: "Aldo" }),
      ).not.toBeInTheDocument(),
    )

    await user.click(within(studentPool).getByRole("button", { name: "Bea" }))
    await user.click(screen.getByRole("button", { name: "Sposta Bea A terra" }))
    expect(screen.getByText("Allievi sistemati 2/3")).toBeVisible()

    await user.click(
      within(staffPool).getByRole("button", { name: "Vera ADV" }),
    )
    expect(
      screen.getByRole("button", { name: "Sposta selezionato A terra" }),
    ).toBeDisabled()
    expect(screen.getByText("Allievi sistemati 2/3")).toBeVisible()
  })

  it("directly swaps people between two crews", async () => {
    getPlan.mockResolvedValue(
      stored({
        crews: [
          {
            id: "crew-1",
            sessionId: "sat-pm",
            members: [{ personId: "student-1", personType: "student" }],
          },
          {
            id: "crew-2",
            sessionId: "sat-pm",
            members: [{ personId: "student-2", personType: "student" }],
          },
        ],
        landStudentIds: [],
      }),
    )
    const user = userEvent.setup()
    render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    await user.click(
      await screen.findByRole("button", { name: "Aldo, equipaggio 1" }),
    )
    await user.click(screen.getByRole("button", { name: "Bea, equipaggio 2" }))

    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    const saved = savePlan.mock.calls[0]![2]
    expect(saved.crews[0]!.members[0]!.personId).toBe("student-2")
    expect(saved.crews[1]!.members[0]!.personId).toBe("student-1")
  })

  it("opens student detail after a deliberate long press", async () => {
    getPlan.mockResolvedValue(
      stored({
        crews: [{ id: "crew-1", sessionId: "sat-pm", members: [] }],
        landStudentIds: [],
      }),
    )
    const onOpenStudent = vi.fn()
    render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={onOpenStudent}
      />,
    )
    const student = await screen.findByRole("button", { name: "Aldo" })

    vi.useFakeTimers()
    fireEvent.pointerDown(student)
    vi.advanceTimersByTime(600)
    fireEvent.pointerUp(student)
    vi.useRealTimers()

    expect(onOpenStudent).toHaveBeenCalledWith("student-1")
  })

  it("blocks stale mutations and session changes while a save is pending", async () => {
    getPlan.mockResolvedValue(
      stored({
        crews: [{ id: "crew-1", sessionId: "sat-pm", members: [] }],
        landStudentIds: [],
      }),
    )
    let finishSave: (() => void) | undefined
    savePlan.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve
        }),
    )
    const user = userEvent.setup()
    render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    await user.click(await screen.findByRole("button", { name: "Aldo" }))
    await user.click(
      screen.getByRole("button", { name: "Posto libero 1 equipaggio 1" }),
    )

    const session = screen.getByRole("combobox", { name: "Sessione" })
    expect(session).toBeDisabled()
    expect(screen.getByRole("button", { name: "Bea" })).toBeDisabled()
    fireEvent.change(session, { target: { value: "sun-am" } })
    fireEvent.click(screen.getByRole("button", { name: "Bea" }))
    expect(session).toHaveValue("sat-pm")
    expect(savePlan).toHaveBeenCalledOnce()

    finishSave?.()
    await waitFor(() => expect(session).toBeEnabled())
  })

  it("shows one worst-severity triangle and expands every crew warning", async () => {
    getStudents.mockResolvedValue([
      { ...STUDENTS[0]!, size: "XS" },
      { ...STUDENTS[1]!, size: "S" },
    ])
    getPlan.mockResolvedValue(
      stored({
        crews: [
          {
            id: "crew-current",
            sessionId: "wed-pm",
            members: [
              { personId: "student-1", personType: "student" },
              { personId: "student-2", personType: "student" },
            ],
          },
        ],
        landStudentIds: [],
      }),
    )
    getHistory.mockResolvedValue([
      {
        crewId: "crew-previous",
        sessionId: "tue-am",
        studentIds: ["student-2", "student-1"],
      },
    ])
    const user = userEvent.setup()
    render(
      <CrewManagement
        course={COURSE}
        initialSessionId="wed-pm"
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    const warning = await screen.findByRole("button", {
      name: "Avvisi equipaggio 1: rosso, 2",
    })
    expect(
      screen.getAllByRole("button", { name: /Avvisi equipaggio/ }),
    ).toHaveLength(1)
    await user.click(warning)

    const detail = screen.getByRole("region", {
      name: "Dettaglio avvisi equipaggio 1",
    })
    expect(within(detail).getByText("Taglie XS + S")).toBeVisible()
    expect(
      within(detail).getByText("Coppia nelle ultime 3 sessioni"),
    ).toBeVisible()
    expect(within(detail).getByText(/ultima Martedì AM/)).toBeVisible()
  })

  it("refuses dangling people in persisted crew history", async () => {
    getHistory.mockResolvedValue([
      {
        crewId: "crew-old",
        sessionId: "sat-pm",
        studentIds: ["missing-student"],
      },
    ])

    render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    expect(
      await screen.findByRole("heading", {
        name: "Equipaggi non disponibili",
      }),
    ).toBeVisible()
  })
})
