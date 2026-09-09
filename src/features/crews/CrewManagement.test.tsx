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

vi.mock("@/persistence/duties", () => ({
  readDutyPlan: vi.fn(),
}))

vi.mock("@/persistence/boats", () => ({
  listBoats: vi.fn(),
  listFaults: vi.fn(),
}))

vi.mock("@/persistence/students", () => ({
  listStudents: vi.fn(),
}))

vi.mock("@/persistence/volunteers", () => ({
  listVolunteers: vi.fn(),
}))

import { CrewManagement } from "@/features/crews/CrewManagement"
import type { CrewDraft, CrewPlan } from "@/domain/crews"
import {
  listBoats,
  listFaults,
  type BoatRecord,
  type CourseFaultRecord,
} from "@/persistence/boats"
import type { CourseRecord } from "@/persistence/courses"
import {
  readCrewHistory,
  readCrewPlan,
  saveCrewPlan,
} from "@/persistence/crews"
import { readDutyPlan } from "@/persistence/duties"
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
  courseNote: null,
  active: active as 0 | 1,
}))

const VOLUNTEERS: VolunteerRecord[] = [
  { id: "volunteer-1", courseId: COURSE.id, name: "Vera ADV", role: "ADV" },
]

const BOATS: BoatRecord[] = [
  {
    id: "boat-2",
    courseId: COURSE.id,
    type: "RS Quest",
    number: "2",
    availability: "available",
  },
  {
    id: "boat-7",
    courseId: COURSE.id,
    type: "RS Quest",
    number: "7",
    availability: "available",
  },
]
const FAULTS: CourseFaultRecord[] = []

const getPlan = vi.mocked(readCrewPlan)
const getHistory = vi.mocked(readCrewHistory)
const savePlan = vi.mocked(saveCrewPlan)
const getStudents = vi.mocked(listStudents)
const getVolunteers = vi.mocked(listVolunteers)
const getBoats = vi.mocked(listBoats)
const getFaults = vi.mocked(listFaults)
const getDutyPlan = vi.mocked(readDutyPlan)

type CrewInput = Omit<CrewDraft, "destination" | "boatId"> &
  Partial<Pick<CrewDraft, "destination" | "boatId">>

function stored(
  plan: {
    crews: CrewInput[]
    landStudentIds: string[]
    selectedBoatIds?: string[]
  },
  landSessionId = plan.crews[0]?.sessionId ?? "sat-pm",
) {
  const normalized: CrewPlan = {
    crews: plan.crews.map((crew) => ({
      ...crew,
      destination: crew.destination ?? "unassigned",
      boatId: crew.boatId ?? null,
    })),
    landStudentIds: plan.landStudentIds,
    selectedBoatIds: plan.selectedBoatIds ?? [],
  }
  return {
    ...normalized,
    landAssignments: normalized.landStudentIds.map((studentId, index) => ({
      id: `land-${index}`,
      sessionId: landSessionId,
      studentId,
    })),
  }
}

describe("CrewManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStudents.mockResolvedValue(STUDENTS)
    getVolunteers.mockResolvedValue(VOLUNTEERS)
    getBoats.mockResolvedValue(BOATS)
    getFaults.mockResolvedValue(FAULTS)
    getPlan.mockResolvedValue(stored({ crews: [], landStudentIds: [] }))
    getHistory.mockResolvedValue([])
    getDutyPlan.mockResolvedValue({ assignments: [], settings: null })
    savePlan.mockResolvedValue(undefined)
  })

  it("explains the one-empty-crew limit when nobody is available", async () => {
    getStudents.mockResolvedValue([])
    getVolunteers.mockResolvedValue([])
    render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    expect(await screen.findByRole("note")).toHaveTextContent(
      "Nessuna persona disponibile: per ora puoi preparare 1 equipaggio vuoto.",
    )
    expect(screen.getByRole("spinbutton")).toHaveAttribute("max", "1")
    expect(
      screen.queryByText(/Persone e barche restano concetti separati/),
    ).not.toBeInTheDocument()
  })

  it("explains the crew limit derived from available people", async () => {
    getStudents.mockResolvedValue(STUDENTS.slice(0, 2))
    getVolunteers.mockResolvedValue([])
    render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    expect(await screen.findByRole("note")).toHaveTextContent(
      "Limite attuale: fino a 2 equipaggi con 2 persone disponibili.",
    )
    expect(screen.getByRole("spinbutton")).toHaveAttribute("max", "2")
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
      name: "Volontari disponibili",
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

  it("shows session-aware current and smontante duty cues", async () => {
    getPlan.mockImplementation(async (_courseId, requestedSessionId) =>
      stored(
        {
          crews: [
            {
              id: `crew-${requestedSessionId}`,
              sessionId: requestedSessionId,
              members: [],
            },
          ],
          landStudentIds: [],
        },
        requestedSessionId,
      ),
    )
    getDutyPlan.mockResolvedValue({
      assignments: [
        { dayId: "saturday", studentId: "student-1" },
        { dayId: "sunday", studentId: "student-2" },
      ],
      settings: null,
    })
    const user = userEvent.setup()
    render(
      <CrewManagement
        course={COURSE}
        initialSessionId="sun-am"
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    const aldoMorning = await screen.findByRole("button", { name: "Aldo" })
    expect(within(aldoMorning).getByText("Allievo · M · C")).toBeVisible()

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Sessione" }),
      "sun-pm",
    )
    const aldo = await screen.findByRole("button", { name: "Aldo" })
    expect(within(aldo).getByText("Allievo · M · SM")).toBeVisible()
    const bea = screen.getByRole("button", { name: "Bea" })
    expect(within(bea).getByText("Allievo · M · C")).toBeVisible()
  })

  it("hides the previous plan while a newly selected session loads", async () => {
    let finishNextLoad: (() => void) | undefined
    getPlan.mockImplementation(async (_courseId, requestedSessionId) => {
      if (requestedSessionId === "sun-am") {
        await new Promise<void>((resolve) => {
          finishNextLoad = resolve
        })
      }
      return stored(
        {
          crews: [
            {
              id: `crew-${requestedSessionId}`,
              sessionId: requestedSessionId,
              members: [],
            },
          ],
          landStudentIds: [],
        },
        requestedSessionId,
      )
    })
    const user = userEvent.setup()
    render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    await screen.findByText("Allievi sistemati 0/3")
    const session = screen.getByRole("combobox", { name: "Sessione" })
    await user.selectOptions(session, "sat-pm")
    expect(screen.getByText("Allievi sistemati 0/3")).toBeVisible()
    await user.selectOptions(session, "sun-am")

    expect(screen.getByRole("status")).toHaveTextContent("Apertura equipaggi")
    expect(screen.queryByText("Allievi sistemati 0/3")).not.toBeInTheDocument()
    finishNextLoad?.()
    expect(await screen.findByText("Allievi sistemati 0/3")).toBeVisible()
  })

  it("warns when a D1 morning-duty student is not A terra", async () => {
    getDutyPlan.mockResolvedValue({
      assignments: [{ dayId: "saturday", studentId: "student-1" }],
      settings: null,
    })
    getPlan.mockResolvedValue(
      stored(
        {
          crews: [{ id: "crew-1", sessionId: "sun-am", members: [] }],
          landStudentIds: [],
        },
        "sun-am",
      ),
    )
    const user = userEvent.setup()
    render(
      <CrewManagement
        course={{ ...COURSE, level: 1, label: "D1 35 2026" }}
        initialSessionId="sun-am"
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    const warning = await screen.findByRole("alert")
    expect(warning).toHaveTextContent("Comandata D1 da portare A terra")
    expect(warning).toHaveTextContent("Aldo")

    await user.click(screen.getByRole("button", { name: "Aldo" }))
    await user.click(
      screen.getByRole("button", { name: "Sposta Aldo A terra" }),
    )
    await waitFor(() =>
      expect(
        screen.queryByText("Comandata D1 da portare A terra"),
      ).not.toBeInTheDocument(),
    )
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

    fireEvent.contextMenu(student)

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

  it("selects outgoing boats separately and prevents duplicate exact assignment", async () => {
    getFaults.mockResolvedValue([
      {
        id: "fault-1",
        boatId: "boat-2",
        description: "Timone duro",
        state: "open",
        createdAt: "2026-08-29T10:00:00.000Z",
        updatedAt: "2026-08-29T10:00:00.000Z",
        boatType: "RS Quest",
        boatNumber: "2",
      },
    ])
    getPlan.mockResolvedValue(
      stored({
        crews: [
          { id: "crew-1", sessionId: "sat-pm", members: [] },
          { id: "crew-2", sessionId: "sat-pm", members: [] },
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

    const boat = await screen.findByRole("button", {
      name: "RS Quest 2, avaria aperta",
    })
    expect(boat).toBeEnabled()
    await user.click(boat)
    await waitFor(() => expect(boat).toHaveAttribute("aria-pressed", "true"))
    expect(savePlan).toHaveBeenLastCalledWith(
      COURSE.id,
      "sat-pm",
      expect.objectContaining({ selectedBoatIds: ["boat-2"] }),
    )

    await user.click(
      screen.getByRole("button", {
        name: "Destinazione equipaggio 1: Non assegnato",
      }),
    )
    await user.click(
      screen.getByRole("button", {
        name: "Assegna equipaggio 1 a RS Quest 2",
      }),
    )
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Destinazione equipaggio 1: RS Quest 2",
        }),
      ).toBeVisible(),
    )

    await user.click(
      screen.getByRole("button", {
        name: "Destinazione equipaggio 2: Non assegnato",
      }),
    )
    expect(
      screen.getByRole("button", {
        name: "Assegna equipaggio 2 a RS Quest 2",
      }),
    ).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Mezzi" }))
    expect(savePlan).toHaveBeenLastCalledWith(
      COURSE.id,
      "sat-pm",
      expect.objectContaining({
        crews: expect.arrayContaining([
          expect.objectContaining({
            id: "crew-2",
            destination: "mezzi",
            boatId: null,
          }),
        ]),
      }),
    )
  })

  it("keeps an unavailable assigned boat and raises one red crew warning", async () => {
    getBoats.mockResolvedValue([
      { ...BOATS[0]!, availability: "unavailable" },
      BOATS[1]!,
    ])
    getPlan.mockResolvedValue(
      stored({
        crews: [
          {
            id: "crew-1",
            sessionId: "sat-pm",
            members: [],
            destination: "boat",
            boatId: "boat-2",
          },
        ],
        landStudentIds: [],
        selectedBoatIds: ["boat-2"],
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

    const warning = await screen.findByRole("button", {
      name: "Avvisi equipaggio 1: rosso, 1",
    })
    expect(
      screen.getByRole("button", {
        name: "Destinazione equipaggio 1: RS Quest 2",
      }),
    ).toHaveClass("border-[#b42318]")
    await user.click(warning)
    expect(screen.getByText("Barca non disponibile")).toBeVisible()
    expect(screen.getByText(/RS Quest 2 resta assegnata/)).toBeVisible()
  })

  it("does not offer previous-session copy in the first canonical session", async () => {
    render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    await screen.findByRole("heading", { name: "Prepara la sessione" })
    expect(
      screen.queryByRole("button", { name: /Copia equipaggi da/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Copia barche da/ }),
    ).not.toBeInTheDocument()
  })

  it("adapts previous crews to duty, A terra and inactive people, then reports only removals", async () => {
    const current = stored(
      {
        crews: [],
        landStudentIds: ["student-2"],
        selectedBoatIds: ["boat-7"],
      },
      "sun-pm",
    )
    const previous = stored({
      crews: [
        {
          id: "previous-1",
          sessionId: "sun-am",
          members: [
            { personId: "student-1", personType: "student" },
            { personId: "student-3", personType: "student" },
          ],
          destination: "boat",
          boatId: "boat-2",
        },
        {
          id: "previous-2",
          sessionId: "sun-am",
          members: [
            { personId: "student-2", personType: "student" },
            { personId: "student-4", personType: "student" },
            { personId: "volunteer-1", personType: "volunteer" },
          ],
          destination: "mezzi",
          boatId: null,
        },
      ],
      landStudentIds: [],
      selectedBoatIds: ["boat-2"],
    })
    getPlan.mockImplementation(async (_courseId, requestedSessionId) =>
      requestedSessionId === "sun-am" ? previous : current,
    )
    getDutyPlan.mockResolvedValue({
      assignments: [{ dayId: "sunday", studentId: "student-1" }],
      settings: null,
    })
    const user = userEvent.setup()
    render(
      <CrewManagement
        course={COURSE}
        initialSessionId="sun-pm"
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    await user.click(
      await screen.findByRole("button", {
        name: "Copia equipaggi da Domenica AM",
      }),
    )
    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    const copied = savePlan.mock.calls[0]![2]
    expect(copied.selectedBoatIds).toEqual(["boat-7"])
    expect(copied.landStudentIds).toEqual(["student-2"])
    expect(copied.crews).toHaveLength(2)
    expect(copied.crews[0]).toEqual(
      expect.objectContaining({
        sessionId: "sun-pm",
        members: [{ personId: "student-3", personType: "student" }],
        destination: "unassigned",
        boatId: null,
      }),
    )
    expect(copied.crews[1]!.members).toEqual([
      { personId: "volunteer-1", personType: "volunteer" },
    ])

    const report = await screen.findByRole("dialog", {
      name: "Equipaggi copiati",
    })
    expect(within(report).getByText("Aldo").closest("li")).toHaveTextContent(
      "Aldo — comandata",
    )
    expect(within(report).getByText("Bea").closest("li")).toHaveTextContent(
      "Bea — A terra",
    )
    expect(within(report).getByText("Dina").closest("li")).toHaveTextContent(
      "Dina — non disponibile",
    )
    expect(within(report).queryByText(/Carlo/)).not.toBeInTheDocument()
    expect(
      within(report).getByRole("button", { name: "Chiudi riepilogo copia" }),
    ).toHaveFocus()
    await user.tab({ shift: true })
    expect(
      within(report).getByRole("button", { name: "Ho capito" }),
    ).toHaveFocus()
    await user.keyboard("{Escape}")
    expect(
      screen.queryByRole("dialog", { name: "Equipaggi copiati" }),
    ).not.toBeInTheDocument()
  })

  it("copies a valid crew silently when no automatic removal occurs", async () => {
    const current = stored({ crews: [], landStudentIds: [] }, "sun-am")
    const previous = stored({
      crews: [
        {
          id: "previous-1",
          sessionId: "sat-pm",
          members: [
            { personId: "student-1", personType: "student" },
            { personId: "student-2", personType: "student" },
          ],
        },
      ],
      landStudentIds: [],
    })
    getPlan.mockImplementation(async (_courseId, requestedSessionId) =>
      requestedSessionId === "sat-pm" ? previous : current,
    )
    const user = userEvent.setup()
    render(
      <CrewManagement
        course={COURSE}
        initialSessionId="sun-am"
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    await user.click(
      await screen.findByRole("button", {
        name: "Copia equipaggi da Sabato PM",
      }),
    )
    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    expect(
      screen.queryByRole("dialog", { name: "Equipaggi copiati" }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Aldo, equipaggio 1" }),
    ).toBeVisible()
  })

  it("previews copied boats, permits edits, and saves only after confirmation", async () => {
    const current = stored(
      {
        crews: [
          {
            id: "current-1",
            sessionId: "sun-am",
            members: [],
            destination: "boat",
            boatId: "boat-2",
          },
        ],
        landStudentIds: [],
        selectedBoatIds: ["boat-2"],
      },
      "sun-am",
    )
    const previous = stored({
      crews: [],
      landStudentIds: [],
      selectedBoatIds: ["boat-7"],
    })
    getPlan.mockImplementation(async (_courseId, requestedSessionId) =>
      requestedSessionId === "sat-pm" ? previous : current,
    )
    const user = userEvent.setup()
    render(
      <CrewManagement
        course={COURSE}
        initialSessionId="sun-am"
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    await user.click(
      await screen.findByRole("button", { name: "Copia barche da Sabato PM" }),
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Barche copiate",
    })
    expect(savePlan).not.toHaveBeenCalled()
    expect(
      within(dialog).getByRole("button", {
        name: "RS Quest 2 nella copia, già assegnata",
      }),
    ).toHaveAttribute("aria-pressed", "true")
    const copiedBoat = within(dialog).getByRole("button", {
      name: "RS Quest 7 nella copia",
    })
    expect(copiedBoat).toHaveAttribute("aria-pressed", "true")
    expect(copiedBoat).toHaveFocus()
    await user.click(copiedBoat)
    await user.click(
      within(dialog).getByRole("button", { name: "Conferma barche" }),
    )

    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    expect(savePlan).toHaveBeenCalledWith(
      COURSE.id,
      "sun-am",
      expect.objectContaining({ selectedBoatIds: ["boat-2"] }),
    )
  })

  it("opens a dedicated read view with exact and inferred clean formats only", async () => {
    getPlan.mockResolvedValue(
      stored({
        crews: [
          {
            id: "crew-1",
            sessionId: "sat-pm",
            members: [
              { personId: "student-1", personType: "student" },
              { personId: "student-2", personType: "student" },
            ],
            destination: "boat",
            boatId: "boat-2",
          },
          {
            id: "crew-2",
            sessionId: "sat-pm",
            members: [
              { personId: "student-3", personType: "student" },
              { personId: "volunteer-1", personType: "volunteer" },
            ],
          },
        ],
        landStudentIds: [],
        selectedBoatIds: ["boat-2", "boat-7"],
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
      await screen.findByRole("button", { name: "Apri vista lettura" }),
    )
    const view = screen.getByRole("dialog", {
      name: "Vista lettura equipaggi",
    })
    expect(within(view).getByText("RS Quest 2 — Aldo / Bea")).toBeVisible()
    expect(within(view).getByText("RS Quest — Carlo / Vera ADV")).toBeVisible()
    expect(
      within(view).queryByText(/Allievi sistemati|Barche in uscita|Avvisi/),
    ).not.toBeInTheDocument()
    expect(
      within(view).getByRole("button", { name: "Chiudi vista lettura" }),
    ).toHaveFocus()
    await user.keyboard("{Escape}")
    expect(
      screen.queryByRole("dialog", { name: "Vista lettura equipaggi" }),
    ).not.toBeInTheDocument()
  })
})
