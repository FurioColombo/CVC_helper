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

vi.mock("@/features/crews/crewSummaryImage", () => ({
  downloadCrewSummaryPng: vi.fn().mockResolvedValue(undefined),
}))

import { CrewManagement } from "@/features/crews/CrewManagement"
import { downloadCrewSummaryPng } from "@/features/crews/crewSummaryImage"
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
  declaredAgeAtCourseStart: null,
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

type CrewInput = Omit<CrewDraft, "destination" | "boatId" | "capacity"> &
  Partial<Pick<CrewDraft, "destination" | "boatId" | "capacity">>

function stored(
  plan: {
    crews: CrewInput[]
    landStudentIds: string[]
    selectedBoatIds?: string[]
  },
  landSessionId = plan.crews[0]?.sessionId ?? "sat-pm",
  defaultCapacity = 2,
) {
  const normalized: CrewPlan = {
    crews: plan.crews.map((crew) => ({
      ...crew,
      capacity: crew.capacity ?? defaultCapacity,
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
    window.localStorage.clear()
    getStudents.mockResolvedValue(STUDENTS)
    getVolunteers.mockResolvedValue(VOLUNTEERS)
    getBoats.mockResolvedValue(BOATS)
    getFaults.mockResolvedValue(FAULTS)
    getPlan.mockResolvedValue(stored({ crews: [], landStudentIds: [] }))
    getHistory.mockResolvedValue([])
    getDutyPlan.mockResolvedValue({ assignments: [], settings: null })
    savePlan.mockResolvedValue(undefined)
  })

  it("marks a minor in the pool and keeps the boat on the crew header row", async () => {
    getStudents.mockResolvedValue([
      { ...STUDENTS[0]!, dateOfBirth: "2010-05-04" },
      ...STUDENTS.slice(1),
    ])
    getPlan.mockResolvedValue(
      stored({
        crews: [{ id: "crew-1", sessionId: "sat-pm", members: [] }],
        landStudentIds: [],
      }),
    )
    render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    const aldo = await screen.findByRole("button", { name: "Aldo" })
    expect(within(aldo).getByLabelText("Minorenne")).toHaveTextContent("M")
    // The name stays the person; the badge reaches assistive technology as a
    // description, which an aria-label would otherwise swallow.
    expect(aldo).toHaveAttribute("aria-description", "minorenne")
    expect(screen.getByRole("button", { name: "Bea" })).not.toHaveAttribute(
      "aria-description",
    )

    // Crew number, destination and headcount share one row, so the header and
    // the boat no longer take a line each.
    const destination = screen.getByRole("button", {
      name: "Destinazione equipaggio 1: Non assegnato",
    })
    const header = destination.parentElement!
    expect(header).toHaveTextContent("Equipaggio 1")
    expect(header).toHaveTextContent("0/2")
  })

  it("uses full two-column member cards with an integrated 44px remove action", async () => {
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
          },
        ],
        landStudentIds: [],
      }),
    )
    render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    const member = await screen.findByRole("button", {
      name: "Aldo, equipaggio 1",
    })
    const memberCard = member.parentElement!
    const memberGrid = memberCard.parentElement!
    const remove = within(memberCard).getByRole("button", {
      name: "Rendi disponibile Aldo",
    })
    expect(memberGrid).toHaveClass("grid-cols-2")
    expect(member).toHaveClass("w-full", "!justify-center", "!px-[40px]")
    expect(memberCard).toHaveClass("relative", "min-w-0")
    expect(remove).toHaveClass("absolute", "size-[44px]")
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

  it("lets an empty crew-count draft become eight and clamps on commit", async () => {
    const manyStudents = Array.from({ length: 8 }, (_, index) => ({
      ...STUDENTS[index % STUDENTS.length]!,
      id: `many-${index + 1}`,
      firstName: `Allievo${index + 1}`,
      surname: "Test",
      active: 1 as const,
    }))
    getStudents.mockResolvedValue(manyStudents)
    getVolunteers.mockResolvedValue([])
    const user = userEvent.setup()
    render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    const input = await screen.findByRole("spinbutton")
    await user.clear(input)
    expect(input).toHaveValue(null)
    await user.type(input, "8")
    expect(input).toHaveValue(8)
    await user.click(
      await screen.findByRole("button", { name: "Crea equipaggi" }),
    )

    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    expect(savePlan.mock.calls[0]![2].crews).toHaveLength(8)
    expect(
      screen.getAllByRole("button", { name: /^Destinazione equipaggio/ }),
    ).toHaveLength(8)
  })

  it("commits an empty count as zero and keeps zero visible", async () => {
    const user = userEvent.setup()
    render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    const input = await screen.findByRole("spinbutton")
    await user.clear(input)
    expect(input).toHaveValue(null)
    await user.click(
      await screen.findByRole("button", { name: "Crea equipaggi" }),
    )

    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    expect(savePlan.mock.calls[0]![2].crews).toEqual([])
    expect(screen.getByRole("spinbutton")).toHaveValue(0)
  })

  it("clamps an oversized crew-count draft to the available-person limit", async () => {
    getStudents.mockResolvedValue(STUDENTS.slice(0, 2))
    getVolunteers.mockResolvedValue([])
    const user = userEvent.setup()
    render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    const input = await screen.findByRole("spinbutton")
    await user.clear(input)
    await user.type(input, "99")
    await user.click(screen.getByRole("button", { name: "Crea equipaggi" }))
    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    expect(savePlan.mock.calls[0]![2].crews).toHaveLength(2)
  })

  it("uses the Settings display preference only for selected crew tiles", async () => {
    getPlan.mockResolvedValue(
      stored({
        crews: [
          {
            id: "crew-1",
            sessionId: "sat-pm",
            members: [
              { personId: "student-1", personType: "student" },
              { personId: "student-2", personType: "student" },
              { personId: "student-3", personType: "student" },
            ],
          },
        ],
        landStudentIds: [],
      }),
    )
    const { unmount } = render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )
    const workspace = await screen.findByRole("region", {
      name: "Equipaggi della sessione",
    })
    expect(workspace.querySelector(".grid-cols-2")).toBeInTheDocument()
    expect(workspace.querySelector(".grid-cols-3")).not.toBeInTheDocument()

    unmount()
    window.localStorage.setItem("cvc-helper.crew-display-columns", "3")
    render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )
    const threeColumnWorkspace = await screen.findByRole("region", {
      name: "Equipaggi della sessione",
    })
    expect(
      threeColumnWorkspace.querySelector(".grid-cols-3"),
    ).toBeInTheDocument()
    expect(
      threeColumnWorkspace.querySelector(".grid-cols-2"),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Mostra .* per riga/)).not.toBeInTheDocument()
  })

  it("sorts available students with current Comandata first and names deterministically", async () => {
    getStudents.mockResolvedValue([
      { ...STUDENTS[0]!, id: "student-z", firstName: "Zoe" },
      { ...STUDENTS[1]!, id: "student-m", firstName: "Marco" },
      { ...STUDENTS[2]!, id: "student-a", firstName: "Alda" },
    ])
    getVolunteers.mockResolvedValue([])
    getDutyPlan.mockResolvedValue({
      assignments: [{ dayId: "saturday", studentId: "student-z" }],
      settings: null,
    })
    const user = userEvent.setup()
    render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    await user.click(
      await screen.findByRole("button", { name: "Crea equipaggi" }),
    )
    const pool = await screen.findByRole("region", {
      name: "Allievi disponibili",
    })
    expect(
      within(pool)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Zoe", "Alda", "Marco"])
  })

  it("previews only crews with room and offers new crew and Mezzi actions", async () => {
    getPlan.mockResolvedValue(
      stored({
        crews: [
          {
            id: "crew-full",
            sessionId: "sat-pm",
            members: [
              { personId: "student-1", personType: "student" },
              { personId: "student-2", personType: "student" },
            ],
          },
          {
            id: "crew-room",
            sessionId: "sat-pm",
            members: [{ personId: "student-3", personType: "student" }],
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

    const volunteers = await screen.findByRole("region", {
      name: "Volontari disponibili",
    })
    await user.click(
      within(volunteers).getByRole("button", { name: "Vera ADV" }),
    )
    const chooser = screen.getByRole("region", {
      name: "Destinazione persona selezionata",
    })
    expect(chooser).toHaveFocus()
    expect(within(chooser).getByText("Carlo · -")).toBeVisible()
    expect(
      within(chooser).queryByRole("button", {
        name: "Sposta Vera ADV in equipaggio 1",
      }),
    ).not.toBeInTheDocument()
    expect(
      within(chooser).getByRole("button", { name: "Nuovo equipaggio" }),
    ).toBeEnabled()
    expect(within(chooser).getByRole("button", { name: "Mezzi" })).toBeEnabled()
    expect(
      within(chooser).queryByRole("button", {
        name: "Sposta Vera ADV A terra",
      }),
    ).not.toBeInTheDocument()

    await user.click(
      within(chooser).getByRole("button", { name: "Nuovo equipaggio" }),
    )
    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    expect(savePlan.mock.calls[0]![2].crews).toHaveLength(3)
    expect(savePlan.mock.calls[0]![2].crews[2]).toMatchObject({
      capacity: 2,
      members: [{ personId: "volunteer-1", personType: "volunteer" }],
      destination: "unassigned",
    })

    const placedVolunteer = screen.getByRole("button", {
      name: "Vera ADV, equipaggio 3",
    })
    expect(
      within(placedVolunteer).getByText("ADV", {
        exact: true,
        selector: 'span[aria-hidden="true"]',
      }),
    ).toBeVisible()
    await user.click(placedVolunteer)
    const secondChooser = screen.getByRole("region", {
      name: "Destinazione persona selezionata",
    })
    await user.click(
      within(secondChooser).getByRole("button", { name: "Mezzi" }),
    )
    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(2))
    expect(savePlan.mock.calls[1]![2].crews).toHaveLength(4)
    expect(savePlan.mock.calls[1]![2].crews[2]!.members).toEqual([])
    expect(savePlan.mock.calls[1]![2].crews[3]).toMatchObject({
      capacity: 2,
      members: [{ personId: "volunteer-1", personType: "volunteer" }],
      destination: "mezzi",
    })
  })

  it("says Equipaggi pieni when no current crew can accept the selected person", async () => {
    getPlan.mockResolvedValue(
      stored({
        crews: [
          {
            id: "crew-full",
            sessionId: "sat-pm",
            members: [
              { personId: "student-1", personType: "student" },
              { personId: "student-2", personType: "student" },
            ],
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

    const volunteers = await screen.findByRole("region", {
      name: "Volontari disponibili",
    })
    await user.click(
      within(volunteers).getByRole("button", { name: "Vera ADV" }),
    )
    expect(
      within(
        screen.getByRole("region", {
          name: "Destinazione persona selezionata",
        }),
      ).getByRole("status"),
    ).toHaveTextContent("Equipaggi pieni")
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
    expect(within(aldoMorning).getByText("Allievo · M")).toBeVisible()
    expect(
      within(aldoMorning).getByLabelText("In comandata"),
    ).toHaveTextContent("C")

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Sessione" }),
      "sun-pm",
    )
    const aldo = await screen.findByRole("button", { name: "Aldo" })
    expect(within(aldo).getByLabelText("Smontante")).toHaveTextContent("SM")
    const bea = screen.getByRole("button", { name: "Bea" })
    expect(within(bea).getByLabelText("In comandata")).toBeVisible()
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
        4,
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

  it("persists adjustable D1 capacity from four and keeps D2 fixed at two", async () => {
    getPlan.mockResolvedValue(
      stored(
        {
          crews: [{ id: "crew-d1", sessionId: "sat-pm", members: [] }],
          landStudentIds: [],
        },
        "sat-pm",
        4,
      ),
    )
    const user = userEvent.setup()
    const { unmount } = render(
      <CrewManagement
        course={{ ...COURSE, level: 1, label: "D1 35 2026" }}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    const capacity = await screen.findByRole("group", {
      name: "Capienza equipaggio 1",
    })
    expect(capacity).toHaveTextContent("0/4")
    await user.click(
      within(capacity).getByRole("button", {
        name: "Aumenta capienza equipaggio 1",
      }),
    )
    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    expect(savePlan.mock.calls[0]![2].crews[0]!.capacity).toBe(5)

    await user.click(
      within(capacity).getByRole("button", {
        name: "Riduci capienza equipaggio 1",
      }),
    )
    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(2))
    expect(savePlan.mock.calls[1]![2].crews[0]!.capacity).toBe(4)

    unmount()
    getPlan.mockResolvedValue(
      stored({
        crews: [{ id: "crew-d2", sessionId: "sat-pm", members: [] }],
        landStudentIds: [],
      }),
    )
    render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )
    await screen.findByRole("button", {
      name: "Destinazione equipaggio 1: Non assegnato",
    })
    expect(
      screen.queryByRole("button", {
        name: "Aumenta capienza equipaggio 1",
      }),
    ).not.toBeInTheDocument()
  })

  it("selects a free slot, scrolls to available students and fills it without a popup", async () => {
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

    const vacancy = await screen.findByRole("button", {
      name: "Posto libero 1 equipaggio 1",
    })
    const pool = screen.getByRole("region", { name: "Allievi disponibili" })
    const scrollIntoView = vi.fn()
    Object.defineProperty(pool.closest("section"), "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    })
    await user.click(vacancy)
    expect(vacancy).toHaveAttribute("aria-pressed", "true")
    const firstStudent = within(pool).getAllByRole("button")[0]!
    expect(document.activeElement).toBe(firstStudent)
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(vacancy).toHaveAttribute("aria-pressed", "false")
    expect(document.activeElement).toBe(vacancy)
    await user.keyboard("{Enter}")
    expect(vacancy).toHaveAttribute("aria-pressed", "true")
    expect(document.activeElement).toBe(firstStudent)
    await user.click(within(pool).getByRole("button", { name: "Bea" }))

    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    expect(savePlan.mock.calls[0]![2].crews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "crew-1",
          members: [{ personId: "student-2", personType: "student" }],
        }),
        expect.objectContaining({ id: "crew-2", members: [] }),
      ]),
    )
  })

  it("assigns a student to the tapped second vacancy and leaves the first one open", async () => {
    getPlan.mockResolvedValue(
      stored({
        crews: [{ id: "crew-1", sessionId: "sat-pm", members: [] }],
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
      await screen.findByRole("button", {
        name: "Posto libero 2 equipaggio 1",
      }),
    )
    await user.click(screen.getByRole("button", { name: "Bea" }))

    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    expect(savePlan.mock.calls[0]![2].crews).toEqual([
      expect.objectContaining({
        id: "crew-1",
        members: [{ personId: "student-2", personType: "student" }],
        memberPositions: [1],
      }),
    ])
    expect(
      await screen.findByRole("button", {
        name: "Posto libero 1 equipaggio 1",
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Posto libero 2 equipaggio 1" }),
    ).not.toBeInTheDocument()
  })

  it("cancels a selected vacancy on a second tap and switches selection to another slot", async () => {
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

    const firstVacancy = await screen.findByRole("button", {
      name: "Posto libero 1 equipaggio 1",
    })
    const secondVacancy = await screen.findByRole("button", {
      name: "Posto libero 2 equipaggio 1",
    })

    await user.click(firstVacancy)
    expect(firstVacancy).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("status")).toHaveTextContent(
      "Toccalo di nuovo per annullare.",
    )
    await user.click(firstVacancy)
    expect(firstVacancy).toHaveAttribute("aria-pressed", "false")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()

    await user.click(firstVacancy)
    await user.click(secondVacancy)
    expect(firstVacancy).toHaveAttribute("aria-pressed", "false")
    expect(secondVacancy).toHaveAttribute("aria-pressed", "true")

    await user.click(screen.getByRole("button", { name: "Aldo" }))
    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    expect(savePlan.mock.calls[0]![2].crews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "crew-1",
          members: [{ personId: "student-1", personType: "student" }],
          memberPositions: [1],
        }),
        expect.objectContaining({ id: "crew-2", members: [] }),
      ]),
    )
  })

  it("preserves student-first assignment to the tapped crew vacancy", async () => {
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

    await user.click(await screen.findByRole("button", { name: "Carlo" }))
    await user.click(
      screen.getByRole("button", {
        name: "Inserisci Carlo nel posto libero 2 equipaggio 2",
      }),
    )

    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    expect(savePlan.mock.calls[0]![2].crews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "crew-1", members: [] }),
        expect.objectContaining({
          id: "crew-2",
          members: [{ personId: "student-3", personType: "student" }],
        }),
      ]),
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
      screen.getByRole("button", {
        name: "Inserisci Aldo nel posto libero 1 equipaggio 1",
      }),
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

  it("pages whole boat sets with touch and mouse pointers without activating a boat", async () => {
    getPlan.mockResolvedValue(
      stored({
        crews: [{ id: "crew-1", sessionId: "sat-pm", members: [] }],
        landStudentIds: [],
      }),
    )
    getBoats.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({
        id: `boat-${index + 1}`,
        courseId: COURSE.id,
        type: "RS Quest" as const,
        number: String(index + 1),
        availability: "available" as const,
      })),
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
      await screen.findByRole("button", { name: "Apri barche della sessione" }),
    )
    const grid = screen.getByTestId("boat-page-grid")
    const firstBoat = within(grid).getByRole("button", {
      name: /RS Quest 1 · Disponibile/,
    })

    fireEvent.pointerDown(firstBoat, {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      clientX: 220,
      clientY: 80,
    })
    fireEvent.pointerMove(grid, {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: 120,
      clientY: 82,
    })
    fireEvent.pointerUp(grid, {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: 120,
      clientY: 82,
    })

    const ninthBoat = within(grid).getByRole("button", {
      name: /RS Quest 9 · Disponibile/,
    })
    expect(screen.getByText("2/2", { exact: true })).toBeVisible()
    fireEvent.click(ninthBoat, { detail: 1 })
    expect(ninthBoat).toHaveAttribute("aria-pressed", "false")
    expect(savePlan).not.toHaveBeenCalled()

    await user.click(ninthBoat)
    await waitFor(() =>
      expect(ninthBoat).toHaveAttribute("aria-pressed", "true"),
    )
    const savesAfterTap = savePlan.mock.calls.length

    fireEvent.pointerDown(ninthBoat, {
      pointerId: 2,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      clientX: 120,
      clientY: 80,
    })
    fireEvent.pointerUp(grid, {
      pointerId: 2,
      pointerType: "mouse",
      isPrimary: true,
      clientX: 220,
      clientY: 81,
    })
    const firstBoatAgain = within(grid).getByRole("button", {
      name: /RS Quest 1 · Disponibile/,
    })
    expect(firstBoatAgain).toBeVisible()
    expect(screen.getByText("1/2", { exact: true })).toBeVisible()
    expect(savePlan).toHaveBeenCalledTimes(savesAfterTap)

    fireEvent.pointerDown(firstBoatAgain, {
      pointerId: 3,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      clientX: 120,
      clientY: 80,
    })
    fireEvent.pointerUp(grid, {
      pointerId: 3,
      pointerType: "mouse",
      isPrimary: true,
      clientX: 125,
      clientY: 160,
    })
    fireEvent.click(firstBoatAgain, { detail: 1 })
    expect(firstBoatAgain).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText("1/2", { exact: true })).toBeVisible()
    expect(savePlan).toHaveBeenCalledTimes(savesAfterTap)

    fireEvent.pointerDown(firstBoatAgain, {
      pointerId: 4,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      clientX: 120,
      clientY: 80,
    })
    fireEvent.pointerUp(grid, {
      pointerId: 4,
      pointerType: "mouse",
      isPrimary: true,
      clientX: 40,
      clientY: 160,
    })
    fireEvent.click(firstBoatAgain, { detail: 1 })
    expect(firstBoatAgain).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText("1/2", { exact: true })).toBeVisible()
    expect(savePlan).toHaveBeenCalledTimes(savesAfterTap)
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

    await user.click(
      await screen.findByRole("button", { name: "Apri barche della sessione" }),
    )
    const boat = screen.getByRole("button", {
      name: /RS Quest 2 · Disponibile non assegnata/,
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
      screen.getByRole("button", { name: "Torna agli equipaggi" }),
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
    const exactBoatCrew = within(view).getByRole("listitem", {
      name: "Equipaggio 1, RS Quest 2",
    })
    expect(within(exactBoatCrew).getByText("Aldo")).toBeVisible()
    expect(within(exactBoatCrew).getByText("Bea")).toBeVisible()
    expect(within(exactBoatCrew).getByText("2")).toBeVisible()
    const noExactBoatCrew = within(view).getByRole("listitem", {
      name: "Equipaggio 2, senza barca",
    })
    expect(within(noExactBoatCrew).getByText("Carlo")).toBeVisible()
    expect(within(noExactBoatCrew).getByText("Vera ADV")).toBeVisible()
    expect(within(noExactBoatCrew).getByText("Senza barca")).toBeVisible()
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

  it("shows duty/minor badges and sends every crew to the image download", async () => {
    getStudents.mockResolvedValue([
      { ...STUDENTS[0]!, dateOfBirth: "2010-05-04" },
      ...STUDENTS.slice(1),
    ])
    getDutyPlan.mockResolvedValue({
      assignments: [{ dayId: "saturday", studentId: "student-1" }],
      settings: null,
    })
    getPlan.mockResolvedValue(
      stored({
        crews: Array.from({ length: 13 }, (_, index) => ({
          id: `crew-${index + 1}`,
          sessionId: "sat-pm",
          members:
            index === 0
              ? [
                  { personId: "student-1", personType: "student" as const },
                  { personId: "student-2", personType: "student" as const },
                ]
              : [],
        })),
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
      await screen.findByRole("button", { name: "Apri vista lettura" }),
    )
    const view = screen.getByRole("dialog", {
      name: "Vista lettura equipaggi",
    })
    const firstCrew = within(view).getByRole("listitem", {
      name: "Equipaggio 1, senza barca",
    })
    expect(within(firstCrew).getByLabelText("Minorenne")).toBeVisible()
    expect(within(firstCrew).getByLabelText("In comandata")).toBeVisible()

    await user.click(
      within(view).getByRole("button", {
        name: "Scarica immagine riepilogo",
      }),
    )
    await waitFor(() => expect(downloadCrewSummaryPng).toHaveBeenCalledOnce())
    const [title, lines] = vi.mocked(downloadCrewSummaryPng).mock.calls[0]!
    expect(title).toBe("Sabato PM")
    expect(lines).toHaveLength(14)
    expect(lines[0]).toMatchObject({
      category: "available",
      members: [
        { label: "Carlo", isMinor: false, duty: null },
        { label: "Vera ADV", role: "ADV" },
      ],
    })
    expect(lines[1]).toMatchObject({
      category: "sailing",
      crewNumber: 1,
      destination: "Senza barca",
      members: [
        { label: "Aldo", isMinor: true, duty: "current" },
        { label: "Bea", isMinor: false, duty: null },
      ],
    })
    expect(lines[13]).toMatchObject({
      category: "empty",
      crewNumber: 13,
      members: [],
    })
  })

  it("includes available people, Mezzi, A terra and an unassigned boat in the PNG summary", async () => {
    getPlan.mockResolvedValue(
      stored({
        crews: [
          {
            id: "crew-mezzi",
            sessionId: "sat-pm",
            members: [{ personId: "student-1", personType: "student" }],
            destination: "mezzi",
          },
        ],
        landStudentIds: ["student-2"],
        selectedBoatIds: ["boat-7"],
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
    await user.click(
      screen.getByRole("button", { name: "Scarica immagine riepilogo" }),
    )
    await waitFor(() => expect(downloadCrewSummaryPng).toHaveBeenCalledOnce())
    const [, lines] = vi.mocked(downloadCrewSummaryPng).mock.calls[0]!
    expect(lines).toMatchObject([
      {
        category: "available",
        members: [{ label: "Carlo" }, { label: "Vera ADV", role: "ADV" }],
      },
      { category: "mezzi", crewNumber: 1, members: [{ label: "Aldo" }] },
      { category: "a-terra", members: [{ label: "Bea" }] },
      { category: "empty", destination: "RS Quest 7", members: [] },
    ])
  })
})
