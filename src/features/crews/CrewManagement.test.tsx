import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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

// The page is not laid out in jsdom: what is checked is which element is
// handed to the snapshot and what the button does with the result.
vi.mock("@/lib/pageSnapshot", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pageSnapshot")>()),
  renderElementToPng: vi.fn(),
  waitForImages: vi.fn().mockResolvedValue(undefined),
}))

import { CrewManagement } from "@/features/crews/CrewManagement"
import { renderElementToPng } from "@/lib/pageSnapshot"
import {
  restoreSummaryImageBrowser,
  stubSummaryImageBrowser,
} from "@/test/summaryImageHarness"
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
            // Two members: the fixed D2 crew capacity is two. The grid class
            // this test checks applies to the slot container regardless of
            // how many slots are filled.
            members: [
              { personId: "student-1", personType: "student" },
              { personId: "student-2", personType: "student" },
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

  it("says Equipaggi pieni when the only crew with room is the selected volunteer's own crew", async () => {
    getPlan.mockResolvedValue(
      stored({
        crews: [
          {
            id: "crew-1",
            sessionId: "sat-pm",
            members: [{ personId: "volunteer-1", personType: "volunteer" }],
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

    // The volunteer's own crew has room (1/2), but it is not a real target:
    // moving them "into" the crew they are already in is a no-op, so it must
    // not hide the fact that there is nowhere else to put them.
    await user.click(
      await screen.findByRole("button", { name: "Vera ADV, equipaggio 1" }),
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

  it("fills a selected vacancy with an available volunteer, like a student", async () => {
    getPlan.mockResolvedValue(
      stored({
        crews: [
          {
            id: "crew-1",
            sessionId: "sat-pm",
            members: [{ personId: "student-1", personType: "student" }],
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
      await screen.findByRole("button", {
        name: "Posto libero 2 equipaggio 1",
      }),
    )
    expect(screen.getByRole("status")).toHaveTextContent(
      "tocca un allievo o un volontario disponibile per inserirlo.",
    )
    const volunteers = screen.getByRole("region", {
      name: "Volontari disponibili",
    })
    await user.click(
      within(volunteers).getByRole("button", { name: "Vera ADV" }),
    )

    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    expect(savePlan.mock.calls[0]![2].crews).toEqual([
      expect.objectContaining({
        id: "crew-1",
        members: [
          { personId: "student-1", personType: "student" },
          { personId: "volunteer-1", personType: "volunteer" },
        ],
      }),
    ])
    expect(
      screen.queryByRole("region", {
        name: "Destinazione persona selezionata",
      }),
    ).not.toBeInTheDocument()
    expect(
      await screen.findByRole("button", { name: "Vera ADV, equipaggio 1" }),
    ).toBeVisible()
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

  it("counts only students toward crew size and repeat warnings, never a volunteer riding along", async () => {
    // D1 is flexible (no fixed crew size), so a volunteer can share the crew
    // with the same two students as the test above without tripping the
    // separate D2-D5 fixed-size rule. The owner's rule (CR-5): a volunteer
    // must never add, remove or change a size or repetition warning.
    const flexibleCourse: CourseRecord = {
      ...COURSE,
      family: "Deriva",
      level: 1,
    }
    getStudents.mockResolvedValue([
      { ...STUDENTS[0]!, size: "XS" },
      { ...STUDENTS[1]!, size: "S" },
    ])
    getPlan.mockResolvedValue(
      stored(
        {
          crews: [
            {
              id: "crew-current",
              sessionId: "wed-pm",
              members: [
                { personId: "student-1", personType: "student" },
                { personId: "student-2", personType: "student" },
                { personId: "volunteer-1", personType: "volunteer" },
              ],
              capacity: 4,
            },
          ],
          landStudentIds: [],
        },
        "wed-pm",
      ),
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
        course={flexibleCourse}
        initialSessionId="wed-pm"
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )

    // Exactly the same "rosso, 2" as the students-only case above: the
    // volunteer does not add a third warning or change the severity.
    const warning = await screen.findByRole("button", {
      name: "Avvisi equipaggio 1: rosso, 2",
    })
    await user.click(warning)

    const detail = screen.getByRole("region", {
      name: "Dettaglio avvisi equipaggio 1",
    })
    expect(within(detail).getByText("Taglie XS + S")).toBeVisible()
    expect(
      within(detail).getByText("Coppia nelle ultime 3 sessioni"),
    ).toBeVisible()
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
        name: /^Assegna equipaggio 1 a RS Quest 2, Disponibile non assegnata, in uscita$/,
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
        name: "Assegna equipaggio 2 a RS Quest 2, Assegnata all’equipaggio 1",
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

  it("moves a crew to a newly chosen boat from Barche in uscita instead of failing silently", async () => {
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
      await screen.findByRole("button", { name: "Apri barche della sessione" }),
    )
    await user.click(
      screen.getByRole("button", { name: "Equipaggio 1, RS Quest 2" }),
    )
    const boat7 = screen.getByRole("button", {
      name: /^RS Quest 7 · Disponibile non assegnata, in uscita/,
    })
    expect(boat7).toBeEnabled()
    await user.click(boat7)

    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    const saved = savePlan.mock.calls[0]![2]
    expect(saved.crews[0]).toEqual(
      expect.objectContaining({
        id: "crew-1",
        destination: "boat",
        boatId: "boat-7",
      }),
    )
    expect(
      screen.queryByText("Modifica non valida o non salvata. Riprova."),
    ).not.toBeInTheDocument()
  })

  it("shows a save error inside Barche in uscita instead of hiding it", async () => {
    savePlan.mockRejectedValueOnce(new Error("boom"))
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
      await screen.findByRole("button", { name: "Apri barche della sessione" }),
    )
    await user.click(
      screen.getByRole("button", {
        name: /^RS Quest 2 · Disponibile non assegnata/,
      }),
    )

    await screen.findByText("Modifica non valida o non salvata. Riprova.")
    expect(
      screen.getByRole("heading", { name: "Barche in uscita" }),
    ).toBeVisible()
  })

  it("labels boats in the compact destination popup the same way as the strip", async () => {
    getBoats.mockResolvedValue([
      { ...BOATS[0]!, availability: "unavailable" },
      BOATS[1]!,
    ])
    getPlan.mockResolvedValue(
      stored({
        crews: [{ id: "crew-1", sessionId: "sat-pm", members: [] }],
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

    await user.click(
      await screen.findByRole("button", {
        name: "Destinazione equipaggio 1: Non assegnato",
      }),
    )

    const popup = screen.getByRole("region", {
      name: "Destinazione equipaggio 1",
    })
    expect(within(popup).getByText("Non disponibile")).toBeVisible()
    expect(within(popup).getByText("Disponibile")).toBeVisible()
    expect(within(popup).getByText("Assegnata")).toBeVisible()
    expect(
      within(popup).getByRole("button", {
        name: "Assegna equipaggio 1 a RS Quest 2, Non disponibile",
      }),
    ).toBeDisabled()
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

  // Owner decision 2026-09-28 (0_3_0_QUESTIONS.md question 3): an open fault on
  // the assigned boat is a yellow crew warning, kept separate from the red
  // unavailable-boat one, and drawn from the same canonical
  // `getBoatCrewWarnings` the domain tests already cover state by state.
  it.each([
    ["open", "Avaria aperta"],
    ["reported", "Avaria comunicata"],
  ] as const)(
    "shows a yellow crew warning naming a %s fault on the assigned boat",
    async (state, expectedTitle) => {
      getFaults.mockResolvedValue([
        {
          id: "fault-1",
          boatId: "boat-2",
          description: "Timone duro",
          state,
          createdAt: "2026-08-29T10:00:00.000Z",
          updatedAt: "2026-08-29T10:00:00.000Z",
          boatType: "RS Quest",
          boatNumber: "2",
        },
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
        name: "Avvisi equipaggio 1: giallo, 1",
      })
      await user.click(warning)
      expect(screen.getByText(expectedTitle)).toBeVisible()
      expect(screen.getByText(/RS Quest 2 · Timone duro/)).toBeVisible()
    },
  )

  it("raises no crew warning for a resolved fault or a boat without faults", async () => {
    getFaults.mockResolvedValue([
      {
        id: "fault-1",
        boatId: "boat-2",
        description: "Timone duro",
        state: "resolved",
        createdAt: "2026-08-29T10:00:00.000Z",
        updatedAt: "2026-08-29T10:00:00.000Z",
        boatType: "RS Quest",
        boatNumber: "2",
      },
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
          {
            id: "crew-2",
            sessionId: "sat-pm",
            members: [],
            destination: "boat",
            boatId: "boat-7",
          },
        ],
        landStudentIds: [],
        selectedBoatIds: ["boat-2", "boat-7"],
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
      name: "Destinazione equipaggio 1: RS Quest 2",
    })
    expect(
      screen.queryByRole("button", { name: /Avvisi equipaggio/ }),
    ).not.toBeInTheDocument()
  })

  it("names every open fault under one yellow warning when a boat has several", async () => {
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
      {
        id: "fault-2",
        boatId: "boat-2",
        description: "Vela strappata",
        state: "reported",
        createdAt: "2026-08-29T11:00:00.000Z",
        updatedAt: "2026-08-29T11:00:00.000Z",
        boatType: "RS Quest",
        boatNumber: "2",
      },
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

    // One badge, not two: `getBoatCrewWarnings` reports one boat-fault reason
    // per boat carrying the unresolved count, same as unavailable never
    // doubling up.
    const warning = await screen.findByRole("button", {
      name: "Avvisi equipaggio 1: giallo, 1",
    })
    await user.click(warning)
    expect(screen.getByText(/Timone duro/)).toBeVisible()
    expect(screen.getByText(/Vela strappata/)).toBeVisible()
  })

  it("shows the fault warning for a crew of only a volunteer, unaffected by composition", async () => {
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
          {
            id: "crew-1",
            sessionId: "sat-pm",
            members: [{ personId: "volunteer-1", personType: "volunteer" }],
            destination: "boat",
            boatId: "boat-2",
            capacity: 4,
          },
        ],
        landStudentIds: [],
        selectedBoatIds: ["boat-2"],
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
      name: "Avvisi equipaggio 1: giallo, 1",
    })
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
    // The current session has only an A terra placement, which the copy keeps,
    // so nothing is replaced and no confirmation is asked.
    expect(
      screen.queryByRole("button", { name: "Sostituisci" }),
    ).not.toBeInTheDocument()
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

  it("asks for confirmation before copying into a session that already has crews composed", async () => {
    const current = stored(
      {
        crews: [
          {
            id: "current-1",
            sessionId: "sun-am",
            members: [{ personId: "student-1", personType: "student" }],
          },
        ],
        landStudentIds: [],
      },
      "sun-am",
    )
    const previous = stored({
      crews: [
        {
          id: "previous-1",
          sessionId: "sat-pm",
          members: [{ personId: "student-2", personType: "student" }],
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

    await screen.findByRole("dialog", {
      name: "Sostituire gli equipaggi di questa sessione?",
    })
    expect(savePlan).not.toHaveBeenCalled()
  })

  it("leaves the current crews unchanged when the copy confirmation is cancelled", async () => {
    const current = stored(
      {
        crews: [
          {
            id: "current-1",
            sessionId: "sun-am",
            members: [{ personId: "student-1", personType: "student" }],
          },
        ],
        landStudentIds: [],
      },
      "sun-am",
    )
    const previous = stored({
      crews: [
        {
          id: "previous-1",
          sessionId: "sat-pm",
          members: [{ personId: "student-2", personType: "student" }],
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
    await user.click(await screen.findByRole("button", { name: "Annulla" }))

    expect(
      screen.queryByRole("dialog", {
        name: "Sostituire gli equipaggi di questa sessione?",
      }),
    ).not.toBeInTheDocument()
    expect(savePlan).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", { name: "Aldo, equipaggio 1" }),
    ).toBeVisible()
  })

  it("replaces the composed session once the copy is confirmed", async () => {
    const current = stored(
      {
        crews: [
          {
            id: "current-1",
            sessionId: "sun-am",
            members: [{ personId: "student-1", personType: "student" }],
          },
        ],
        landStudentIds: [],
      },
      "sun-am",
    )
    const previous = stored({
      crews: [
        {
          id: "previous-1",
          sessionId: "sat-pm",
          members: [{ personId: "student-2", personType: "student" }],
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
    await user.click(await screen.findByRole("button", { name: "Sostituisci" }))

    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    const copied = savePlan.mock.calls[0]![2]
    expect(copied.crews).toHaveLength(1)
    expect(copied.crews[0]!.members).toEqual([
      { personId: "student-2", personType: "student" },
    ])
    expect(
      screen.queryByRole("dialog", {
        name: "Sostituire gli equipaggi di questa sessione?",
      }),
    ).not.toBeInTheDocument()
  })

  // F1 review round 3, F1R3-7: the dialog already ignores Escape while busy
  // (F1R-11-style guard extended here), but nothing exercised it. Holding the
  // save promise open makes the busy window observable.
  it("does not close the copy confirmation on Escape while the copy is being saved", async () => {
    const current = stored(
      {
        crews: [
          {
            id: "current-1",
            sessionId: "sun-am",
            members: [{ personId: "student-1", personType: "student" }],
          },
        ],
        landStudentIds: [],
      },
      "sun-am",
    )
    const previous = stored({
      crews: [
        {
          id: "previous-1",
          sessionId: "sat-pm",
          members: [{ personId: "student-2", personType: "student" }],
        },
      ],
      landStudentIds: [],
    })
    getPlan.mockImplementation(async (_courseId, requestedSessionId) =>
      requestedSessionId === "sat-pm" ? previous : current,
    )
    let resolveSave: (() => void) | undefined
    savePlan.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSave = resolve
      }),
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
    await user.click(await screen.findByRole("button", { name: "Sostituisci" }))

    const dialog = screen.getByRole("dialog", {
      name: "Sostituire gli equipaggi di questa sessione?",
    })
    expect(within(dialog).getByRole("button", { name: "Copia…" })).toBeVisible()

    await user.keyboard("{Escape}")
    expect(
      screen.getByRole("dialog", {
        name: "Sostituire gli equipaggi di questa sessione?",
      }),
    ).toBeVisible()
    expect(savePlan).toHaveBeenCalledOnce()

    resolveSave?.()
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: "Sostituire gli equipaggi di questa sessione?",
        }),
      ).not.toBeInTheDocument(),
    )
  })

  it("changes nothing when copying from a previous session with no crews", async () => {
    const current = stored(
      {
        crews: [
          {
            id: "current-1",
            sessionId: "sun-am",
            members: [{ personId: "student-1", personType: "student" }],
          },
        ],
        landStudentIds: [],
      },
      "sun-am",
    )
    const previous = stored({ crews: [], landStudentIds: [] })
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

    await screen.findByText(
      "Non c’è nulla da copiare: la sessione precedente non ha equipaggi.",
    )
    expect(savePlan).not.toHaveBeenCalled()
    expect(
      screen.queryByRole("dialog", {
        name: "Sostituire gli equipaggi di questa sessione?",
      }),
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
    // Both selected boats are RS Quest, so the crew with people and no boat
    // yet is listed under that one model, as "<model> · Senza barca" with a
    // muted dash where a boat number would be (the "modello senza numero"
    // state, spec §7.5) — in the same group as the exact-boat crew, not in a
    // group of its own.
    const noExactBoatCrew = within(view).getByRole("listitem", {
      name: "Equipaggio 2, RS Quest · Senza barca",
    })
    expect(within(noExactBoatCrew).getByText("Carlo")).toBeVisible()
    expect(within(noExactBoatCrew).getByText("Vera ADV")).toBeVisible()
    expect(
      within(noExactBoatCrew).getByText("RS Quest · Senza barca"),
    ).toBeVisible()
    expect(within(noExactBoatCrew).getByText("–").parentElement).toHaveStyle({
      color: "#6b8790",
    })
    expect(noExactBoatCrew.firstElementChild).toHaveStyle({
      backgroundColor: "#2f9e46",
    })
    expect(noExactBoatCrew.parentElement).toBe(exactBoatCrew.parentElement)
    expect(within(view).getAllByAltText("RS Quest")).toHaveLength(1)
    expect(
      within(view).queryByText("Equipaggi senza barca"),
    ).not.toBeInTheDocument()
    expect(
      within(exactBoatCrew).queryByText(/Senza barca/),
    ).not.toBeInTheDocument()
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

  it("starts the read view with the people still available, and closes it with 'Tutti gli allievi assegnati' only when no student is left", async () => {
    getPlan.mockResolvedValue(
      stored({
        crews: [
          {
            id: "crew-1",
            sessionId: "sat-pm",
            members: [{ personId: "student-1", personType: "student" }],
            destination: "boat",
            boatId: "boat-2",
          },
        ],
        landStudentIds: ["student-2"],
        selectedBoatIds: ["boat-2"],
      }),
    )
    const user = userEvent.setup()
    const { unmount } = render(
      <CrewManagement
        course={COURSE}
        onHome={vi.fn()}
        onOpenStudent={vi.fn()}
      />,
    )
    await user.click(
      await screen.findByRole("button", { name: "Apri vista lettura" }),
    )
    let view = screen.getByRole("dialog", { name: "Vista lettura equipaggi" })
    const isBefore = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

    // Carlo (a student) is still available: his section leads the grid,
    // ahead of the RS Quest group, and there is no closing note. Vera, a
    // volunteer outside every crew, is not announced (owner, 2026-10-04).
    const availableHeading = within(view).getByText("Allievi disponibili")
    expect(within(view).getByText("Carlo")).toBeVisible()
    expect(within(view).queryByText("Vera ADV")).not.toBeInTheDocument()
    expect(
      isBefore(availableHeading, within(view).getByAltText("RS Quest")),
    ).toBe(true)
    expect(
      availableHeading.closest("div.col-span-full")?.previousElementSibling,
    ).toBeNull()
    expect(
      within(view).queryByText("Tutti gli allievi assegnati"),
    ).not.toBeInTheDocument()

    // Seat Carlo: no student is left, so the summary now closes on the
    // note, below everything else.
    unmount()
    getPlan.mockResolvedValue(
      stored({
        crews: [
          {
            id: "crew-1",
            sessionId: "sat-pm",
            members: [
              { personId: "student-1", personType: "student" },
              { personId: "student-3", personType: "student" },
            ],
            destination: "boat",
            boatId: "boat-2",
          },
        ],
        landStudentIds: ["student-2"],
        selectedBoatIds: ["boat-2"],
      }),
    )
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
    view = screen.getByRole("dialog", { name: "Vista lettura equipaggi" })
    const note = within(view).getByText("Tutti gli allievi assegnati")
    expect(note).toHaveClass("text-center")
    expect(note.nextElementSibling).toBeNull()
    expect(isBefore(within(view).getByText("A terra"), note)).toBe(true)
    expect(isBefore(within(view).getByAltText("RS Quest"), note)).toBe(true)
  })

  it("widens a group's boat-number column to its widest number (115, 1234, A12) on every card, and leaves other groups at the 26px floor", async () => {
    const boat = (id: string, type: BoatRecord["type"], number: string) => ({
      id,
      courseId: COURSE.id,
      type,
      number,
      availability: "available" as const,
    })
    getBoats.mockResolvedValue([
      boat("boat-q7", "RS Quest", "7"),
      boat("boat-q115", "RS Quest", "115"),
      boat("boat-q1234", "RS Quest", "1234"),
      boat("boat-qa12", "RS Quest", "A12"),
      boat("boat-t4", "RS Toura", "4"),
    ])
    const crew = (id: string, boatId: string, personId: string) => ({
      id,
      sessionId: "sat-pm" as const,
      members: [{ personId, personType: "student" as const }],
      destination: "boat" as const,
      boatId,
    })
    getVolunteers.mockResolvedValue([
      ...VOLUNTEERS,
      { id: "volunteer-2", courseId: COURSE.id, name: "Dario IS", role: "IS" },
    ])
    getPlan.mockResolvedValue(
      stored({
        crews: [
          crew("crew-1", "boat-q7", "student-1"),
          crew("crew-2", "boat-q115", "student-2"),
          crew("crew-3", "boat-q1234", "student-3"),
          {
            id: "crew-4",
            sessionId: "sat-pm",
            members: [{ personId: "volunteer-1", personType: "volunteer" }],
            destination: "boat",
            boatId: "boat-qa12",
          },
          {
            id: "crew-5",
            sessionId: "sat-pm",
            members: [{ personId: "volunteer-2", personType: "volunteer" }],
            destination: "boat",
            boatId: "boat-t4",
          },
        ],
        landStudentIds: [],
        selectedBoatIds: [
          "boat-q7",
          "boat-q115",
          "boat-q1234",
          "boat-qa12",
          "boat-t4",
        ],
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
    const view = screen.getByRole("dialog", { name: "Vista lettura equipaggi" })

    const widthOf = (cardName: string, number: string) => {
      const card = within(view).getByRole("listitem", { name: cardName })
      const column = within(card).getByText(number).parentElement!
      return column.style.getPropertyValue("--boat-number-width")
    }
    // `ch` of the column's own font: one per digit, a margin per letter,
    // plus 0.2ch for the tight letter spacing (groupNumberWidthCh).
    const widest = "4.2ch"
    // One width for the whole RS Quest group, from its widest number, so the
    // first names still line up; every number is shown in full.
    expect(widthOf("Equipaggio 1, RS Quest 7", "7")).toBe(widest)
    expect(widthOf("Equipaggio 2, RS Quest 115", "115")).toBe(widest)
    expect(widthOf("Equipaggio 3, RS Quest 1234", "1234")).toBe(widest)
    expect(widthOf("Equipaggio 4, RS Quest A12", "A12")).toBe(widest)
    // The column is the wider of the 26px floor and that width.
    expect(within(view).getByText("1234").parentElement!.className).toContain(
      "w-[max(26px,var(--boat-number-width))]",
    )
    // Another group is sized by its own numbers: RS Toura's single digit
    // stays inside the 26px floor, untouched by RS Quest's long ones.
    const touraWidth = "1.2ch"
    expect(widthOf("Equipaggio 5, RS Toura 4", "4")).toBe(touraWidth)
    expect(touraWidth).not.toBe(widest)
  })

  it("keeps every name of a card with a warning clear of the corner badge", async () => {
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
          {
            id: "crew-1",
            sessionId: "sat-pm",
            members: [{ personId: "student-1", personType: "student" }],
            destination: "boat",
            boatId: "boat-2",
          },
          {
            id: "crew-2",
            sessionId: "sat-pm",
            members: [
              { personId: "student-2", personType: "student" },
              { personId: "student-3", personType: "student" },
            ],
            destination: "boat",
            boatId: "boat-7",
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
    const view = screen.getByRole("dialog", { name: "Vista lettura equipaggi" })

    const warned = within(view).getByRole("listitem", {
      name: "Equipaggio 1, RS Quest 2",
    })
    const clear = within(view).getByRole("listitem", {
      name: "Equipaggio 2, RS Quest 7",
    })
    expect(
      within(warned).getByRole("img", { name: "Avviso equipaggio: giallo" }),
    ).toBeVisible()
    expect(within(warned).getByText("Aldo").closest(".grid")).toHaveClass(
      "pr-5",
    )
    expect(within(clear).getByText("Bea").closest(".grid")).not.toHaveClass(
      "pr-5",
    )
  })

  describe("F4 summary image", () => {
    const pngBlob = () => new Blob(["png"], { type: "image/png" })
    const openReadView = async (user: ReturnType<typeof userEvent.setup>) => {
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
      return screen.getByRole("dialog", { name: "Vista lettura equipaggi" })
    }
    const oneCrew = () =>
      getPlan.mockResolvedValue(
        stored({
          crews: [
            {
              id: "crew-1",
              sessionId: "sat-pm",
              members: [{ personId: "student-1", personType: "student" }],
              destination: "boat",
              boatId: "boat-2",
            },
          ],
          landStudentIds: [],
          selectedBoatIds: ["boat-2"],
        }),
      )
    let browser: ReturnType<typeof stubSummaryImageBrowser>
    // userEvent puts a clipboard of its own on the page when it is set up, so
    // the recording one goes on after it.
    const setupUser = () => {
      const user = userEvent.setup()
      browser = stubSummaryImageBrowser()
      return user
    }

    beforeEach(() => {
      vi.mocked(renderElementToPng).mockReset()
      vi.mocked(renderElementToPng).mockResolvedValue(pngBlob())
    })
    afterEach(restoreSummaryImageBrowser)

    it("has one floating button that copies the screenshot of the content, and no download", async () => {
      oneCrew()
      const user = setupUser()
      const view = await openReadView(user)
      expect(
        within(view).queryByRole("button", {
          name: "Scarica immagine riepilogo",
        }),
      ).not.toBeInTheDocument()
      expect(
        within(view).queryByRole("button", { name: /Salva immagine/ }),
      ).not.toBeInTheDocument()

      const copy = within(view).getByRole("button", {
        name: "Copia immagine riepilogo",
      })
      expect(copy).toHaveTextContent("Copia immagine")
      await user.click(copy)

      expect(
        await within(view).findByText(
          "Immagine copiata. Incollala su WhatsApp.",
        ),
      ).toBeVisible()
      expect(renderElementToPng).toHaveBeenCalledOnce()
      const [element, options] = vi.mocked(renderElementToPng).mock.calls[0]!
      // The content with its header, not the whole dialog; the close button is
      // inside it and marked to be left out, the save button is not inside.
      expect(view).not.toBe(element)
      expect(view.contains(element)).toBe(true)
      expect(
        within(element).getByRole("heading", { name: "Sabato PM" }),
      ).toBeInTheDocument()
      expect(within(element).getByText("Aldo")).toBeInTheDocument()
      const close = within(element).getByRole("button", {
        name: "Chiudi vista lettura",
      })
      expect(close).toHaveAttribute("data-snapshot-exclude", "true")
      expect(element.contains(copy)).toBe(false)
      expect(copy.closest("[data-snapshot-exclude]")).toHaveAttribute(
        "data-snapshot-exclude",
        "true",
      )
      expect(options).toEqual({ background: "#fffdf8" })

      expect(browser.clipboardWrite).toHaveBeenCalledOnce()
      const [[item]] = browser.clipboardWrite.mock.calls[0] as [
        [{ items: Record<string, Promise<Blob>> }],
      ]
      expect(Object.keys(item.items)).toEqual(["image/png"])
      expect((await item.items["image/png"]!).type).toBe("image/png")
    })

    it("keeps the content clear of the floating button at the end of the scroll", async () => {
      oneCrew()
      const user = setupUser()
      const view = await openReadView(user)
      const content = within(view)
        .getByRole("heading", { name: "Sabato PM" })
        .closest("div.max-w-2xl")
      expect(content?.className).toMatch(/pb-\[calc\(5rem\+env\(/)
    })

    it("says when the image could not be made, and drops that message when the view is opened again", async () => {
      oneCrew()
      vi.mocked(renderElementToPng).mockRejectedValue(
        new Error("canvas too large"),
      )
      const user = setupUser()
      const view = await openReadView(user)
      await user.click(
        within(view).getByRole("button", {
          name: "Copia immagine riepilogo",
        }),
      )
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Impossibile creare l’immagine. Riprova.",
      )

      await user.click(
        screen.getByRole("button", { name: "Chiudi vista lettura" }),
      )
      await user.click(
        screen.getByRole("button", { name: "Apri vista lettura" }),
      )
      const reopened = screen.getByRole("dialog", {
        name: "Vista lettura equipaggi",
      })
      expect(within(reopened).queryByRole("alert")).not.toBeInTheDocument()
      expect(
        within(reopened).getByRole("button", {
          name: "Copia immagine riepilogo",
        }),
      ).toBeEnabled()
    })
  })

  it("groups the F3 C6 read view by boat model in canonical order, colours cards by class, uses the gommone Mezzi icon and marks an open-fault card", async () => {
    getBoats.mockResolvedValue([
      {
        id: "boat-toura-1",
        courseId: COURSE.id,
        type: "RS Toura",
        number: "1",
        availability: "available",
      },
      BOATS[0]!, // RS Quest 2
      {
        id: "boat-500-5",
        courseId: COURSE.id,
        type: "RS 500",
        number: "5",
        availability: "available",
      },
    ])
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
          {
            id: "crew-toura",
            sessionId: "sat-pm",
            members: [{ personId: "student-1", personType: "student" }],
            destination: "boat",
            boatId: "boat-toura-1",
          },
          {
            id: "crew-quest",
            sessionId: "sat-pm",
            members: [{ personId: "student-2", personType: "student" }],
            destination: "boat",
            boatId: "boat-2",
          },
          {
            id: "crew-500",
            sessionId: "sat-pm",
            members: [{ personId: "student-3", personType: "student" }],
            destination: "boat",
            boatId: "boat-500-5",
          },
          {
            id: "crew-mezzi",
            sessionId: "sat-pm",
            members: [{ personId: "volunteer-1", personType: "volunteer" }],
            destination: "mezzi",
          },
        ],
        landStudentIds: [],
        selectedBoatIds: ["boat-toura-1", "boat-2", "boat-500-5"],
      }),
    )
    const user = userEvent.setup()
    const { container } = render(
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

    // Canonical `BOAT_TYPES` order (RS Toura, RS Quest, Laser Vago, RS 500),
    // Mezzi always last, regardless of crew-plan or boat-creation order.
    const touraLogo = within(view).getByAltText("RS Toura")
    const questLogo = within(view).getByAltText("RS Quest")
    const rs500Logo = within(view).getByAltText("RS 500")
    const mezziHeading = within(view).getByText("Mezzi")
    const isBefore = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(isBefore(touraLogo, questLogo)).toBe(true)
    expect(isBefore(questLogo, rs500Logo)).toBe(true)
    expect(isBefore(rs500Logo, mezziHeading)).toBe(true)

    // Class colour: the owner's table, used only for the number and edge.
    const touraCard = within(view).getByRole("listitem", {
      name: "Equipaggio 1, RS Toura 1",
    })
    expect(within(touraCard).getByText("1")).toHaveStyle({
      color: "#157a73",
    })
    expect(touraCard.firstElementChild).toHaveStyle({
      backgroundColor: "#157a73",
    })
    const rs500Card = within(view).getByRole("listitem", {
      name: "Equipaggio 3, RS 500 5",
    })
    expect(within(rs500Card).getByText("5")).toHaveStyle({
      color: "#d81c82",
    })

    // The owner's gommone icon, not the old placeholder: horizontal in the
    // Mezzi heading, turned bow up in its card's number column.
    const gommoni = Array.from(
      container.querySelectorAll('path[d^="M6.8 5.75H15"]'),
    )
    expect(gommoni.length).toBeGreaterThanOrEqual(2)
    const turns = gommoni.map(
      (path) => path.parentElement?.getAttribute("transform") ?? null,
    )
    expect(turns).toContain(null)
    expect(turns).toContain("rotate(-90 12 12)")
    expect(container.querySelector('path[d="M4 9h20v12H4z"]')).toBeNull()

    // The open fault on RS Quest 2 is a yellow warning on its card, same
    // place and style as an unavailable-boat warning would be.
    const questCard = within(view).getByRole("listitem", {
      name: "Equipaggio 2, RS Quest 2",
    })
    expect(
      within(questCard).getByRole("img", { name: "Avviso equipaggio: giallo" }),
    ).toBeVisible()
    expect(
      within(touraCard).queryByRole("img", { name: /Avviso equipaggio/ }),
    ).not.toBeInTheDocument()
  })

  it("shows duty/minor badges and lists every crew with no boat as such", async () => {
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

    // One occupied crew with no boat, no model and no boat selected: an
    // "Equipaggi senza barca" group; the other twelve crews are empty and
    // read as "Senza barca" labels; Carlo is still available, the
    // volunteer outside every crew is not listed.
    expect(within(view).getByText("Equipaggi senza barca")).toBeVisible()
    expect(within(firstCrew).getByText("Aldo")).toBeVisible()
    expect(within(firstCrew).getByText("Bea")).toBeVisible()
    expect(within(view).getByText("Allievi disponibili")).toBeVisible()
    expect(within(view).getByText("Carlo")).toBeVisible()
    expect(within(view).queryByText("Vera ADV")).not.toBeInTheDocument()
    expect(within(view).getByText("Barche ed equipaggi vuoti")).toBeVisible()
    expect(within(view).getAllByText("Senza barca")).toHaveLength(12)
    expect(within(view).queryByText("A terra")).not.toBeInTheDocument()
  })

  it("shows available people, Mezzi, A terra and an unassigned boat in the read view", async () => {
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
    const view = screen.getByRole("dialog", {
      name: "Vista lettura equipaggi",
    })
    // Aldo sails with the Mezzi, Bea is on land, Carlo and the volunteer are
    // still to place, and the selected boat nobody sails is listed as empty.
    const mezzi = within(view).getByRole("listitem", {
      name: "Equipaggio 1, Mezzi",
    })
    expect(within(mezzi).getByText("Aldo")).toBeVisible()
    expect(within(view).getByText("A terra")).toBeVisible()
    expect(within(view).getByText("Bea")).toBeVisible()
    expect(within(view).getByText("Carlo")).toBeVisible()
    expect(within(view).queryByText("Vera ADV")).not.toBeInTheDocument()
    expect(within(view).getByText("RS Quest 7")).toBeVisible()
  })

  it("labels a selected but unavailable boat as not available in the read view, not as free", async () => {
    getBoats.mockResolvedValue([{ ...BOATS[1]!, availability: "unavailable" }])
    getPlan.mockResolvedValue(
      stored({
        crews: [{ id: "crew-1", sessionId: "sat-pm", members: [] }],
        landStudentIds: [],
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
    expect(
      within(
        screen.getByRole("dialog", { name: "Vista lettura equipaggi" }),
      ).getByText("RS Quest 7 · Non disponibile"),
    ).toBeVisible()
  })
})
