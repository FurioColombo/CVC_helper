import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DUTY_DAYS } from "@/domain/config"

vi.mock("@/persistence/duties", () => ({
  readDutyPlan: vi.fn(),
  saveDutyPlan: vi.fn(),
}))

vi.mock("@/persistence/students", () => ({
  listStudents: vi.fn(),
}))

// The page is not laid out in jsdom: what is checked is which element is
// handed to the snapshot and what the button does with the result.
vi.mock("@/lib/pageSnapshot", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pageSnapshot")>()),
  renderElementToPng: vi.fn(),
  waitForImages: vi.fn().mockResolvedValue(undefined),
}))

import { DutyManagement } from "@/features/duties/DutyManagement"
import { renderElementToPng } from "@/lib/pageSnapshot"
import {
  restoreSummaryImageBrowser,
  stubSummaryImageBrowser,
} from "@/test/summaryImageHarness"
import {
  readDutyPlan,
  saveDutyPlan,
  type DutySettingsRecord,
} from "@/persistence/duties"
import { listStudents, type StudentRecord } from "@/persistence/students"

const STUDENTS: StudentRecord[] = Array.from({ length: 8 }, (_, index) => ({
  id: `student-${index + 1}`,
  courseId: "course-1",
  firstName: `Nome${index + 1}`,
  surname: `Cognome${index + 1}`,
  nickname: null,
  dateOfBirth: index === 0 ? "2010-01-01" : "2000-01-01",
  declaredAgeAtCourseStart: null,
  sex: index % 2 === 0 ? "female" : "male",
  phone: null,
  size: null,
  initialNote: null,
  courseNote: null,
  active: 1,
}))

const SETTINGS: DutySettingsRecord = {
  desiredPerDay: 1,
  fewerDayIds: [],
  balanceMinors: true,
  balanceSex: false,
  tieBreaker: "alphabetical",
  stayOverStudentIds: [],
  completedDayIds: [],
  acknowledgedWarningKeys: [],
}

const getStudents = vi.mocked(listStudents)
const getPlan = vi.mocked(readDutyPlan)
const savePlan = vi.mocked(saveDutyPlan)

describe("DutyManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStudents.mockResolvedValue(STUDENTS)
    getPlan.mockResolvedValue({ assignments: [], settings: null })
    savePlan.mockResolvedValue(undefined)
  })

  it("keeps retrying safely after a read failure and can recover", async () => {
    getStudents
      .mockRejectedValueOnce(new Error("storage unavailable"))
      .mockRejectedValueOnce(new Error("still unavailable"))
      .mockResolvedValue(STUDENTS)
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={vi.fn()}
        courseStartDate="2026-08-29"
      />,
    )

    expect(
      await screen.findByRole("heading", { name: "Comandate non disponibili" }),
    ).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Riprova" }))
    expect(
      await screen.findByRole("heading", { name: "Comandate non disponibili" }),
    ).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Riprova" }))
    expect(
      await screen.findByRole("button", { name: "Proponi comandate" }),
    ).toBeVisible()
    expect(getStudents).toHaveBeenCalledTimes(3)
  })

  it("creates a deterministic proposal with the configured Friday preference", async () => {
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={vi.fn()}
        courseStartDate="2026-08-29"
      />,
    )

    await user.click(
      await screen.findByRole("button", { name: "Proponi comandate" }),
    )
    await user.click(screen.getByText("Scegli tra tutti gli allievi"))
    await user.click(screen.getByText("Nome1", { exact: true }))
    expect(savePlan).not.toHaveBeenCalled()
    expect(
      screen.getByRole("region", { name: "Anteprima proposta" }),
    ).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Conferma proposta" }))

    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    const [, assignments, settings] = savePlan.mock.calls[0]!
    expect(assignments).toHaveLength(8)
    expect(assignments).toContainEqual({
      dayId: "friday",
      studentId: "student-1",
    })
    expect(settings.stayOverStudentIds).toEqual(["student-1"])
    const minorDayCard = screen
      .getByText("Nome1", { exact: true })
      .closest("button")
    expect(minorDayCard).not.toBeNull()
    expect(within(minorDayCard!).getByText("M", { exact: true })).toBeVisible()
    expect(
      screen.getByRole("status", { name: "Copertura comandate 8/8" }),
    ).toHaveClass("bg-card")
  })

  it("keeps preview generation non-mutating and gates the exact remainder", async () => {
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={vi.fn()}
        courseStartDate="2026-08-29"
      />,
    )

    await user.click(
      await screen.findByRole("button", { name: "Proponi comandate" }),
    )
    const saturday = screen.getByRole("button", {
      name: "Sabato con più persone",
    })
    expect(saturday).toHaveAttribute("aria-pressed", "true")
    expect(savePlan).not.toHaveBeenCalled()

    await user.click(saturday)
    expect(
      screen.getByRole("button", { name: "Conferma proposta" }),
    ).toBeDisabled()
    expect(savePlan).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole("button", { name: "Venerdì con più persone" }),
    )
    expect(
      screen.getByRole("button", { name: "Conferma proposta" }),
    ).toBeEnabled()
    await user.click(screen.getByRole("button", { name: "Conferma proposta" }))
    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    expect(savePlan.mock.calls[0]![2].extraDayIds).toEqual(["friday"])
  })

  it("derives the base count from students and days without a manual override", async () => {
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={vi.fn()}
        courseStartDate="2026-08-29"
      />,
    )

    await user.click(
      await screen.findByRole("button", { name: "Proponi comandate" }),
    )
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument()
    expect(screen.getByText("1", { exact: true })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Conferma proposta" }))

    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    expect(savePlan.mock.calls[0]![2].desiredPerDay).toBe(1)
    expect(savePlan.mock.calls[0]![2].extraDayIds).toHaveLength(1)
  })

  it("allows assignment from an empty plan without generating a proposal", async () => {
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={vi.fn()}
        courseStartDate="2026-08-29"
      />,
    )

    await user.click(
      await screen.findByRole("button", { name: "Configura manualmente" }),
    )
    await user.click(
      screen.getByRole("button", { name: /Sabato, 0 assegnati/ }),
    )
    await user.click(
      within(
        screen.getByRole("region", { name: "Allievi comandata Sabato" }),
      ).getByRole("button", { name: /^Nome1$/ }),
    )

    await waitFor(() =>
      expect(savePlan).toHaveBeenCalledWith(
        "course-1",
        [{ dayId: "saturday", studentId: "student-1" }],
        expect.objectContaining({
          ...SETTINGS,
          fewerDayIds: expect.any(Array),
          extraDayIds: expect.any(Array),
        }),
      ),
    )
  })

  it("preserves a completed empty day after reload and recalculation", async () => {
    getPlan.mockResolvedValue({
      assignments: [],
      settings: { ...SETTINGS, completedDayIds: ["saturday"] },
    })
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={vi.fn()}
        courseStartDate="2026-08-29"
      />,
    )

    expect(
      await screen.findByRole("button", {
        name: "Sabato, 0 assegnati, completata",
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Proponi comandate" }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Ricalcola" }))
    await user.click(screen.getByRole("button", { name: "Conferma proposta" }))

    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    expect(savePlan.mock.calls[0]![1]).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ dayId: "saturday" })]),
    )
    expect(savePlan.mock.calls[0]![2].completedDayIds).toEqual(["saturday"])
  })

  it("shows only assigned students when inspecting completed history", async () => {
    getPlan.mockResolvedValue({
      assignments: [{ dayId: "saturday", studentId: "student-1" }],
      settings: { ...SETTINGS, completedDayIds: ["saturday"] },
    })
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={vi.fn()}
        courseStartDate="2026-08-29"
      />,
    )

    await user.click(
      await screen.findByRole("button", {
        name: "Sabato, 1 assegnati, completata",
      }),
    )
    const history = screen.getByRole("region", {
      name: "Allievi comandata Sabato",
    })
    expect(within(history).getByText("Nome1", { exact: true })).toBeVisible()
    expect(
      within(history).queryByText("Nome2", { exact: true }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Segna completata" }),
    ).not.toBeInTheDocument()
  })

  it("reports a completion persistence failure and remains editable", async () => {
    getPlan.mockResolvedValue({
      assignments: [{ dayId: "saturday", studentId: "student-1" }],
      settings: SETTINGS,
    })
    savePlan.mockRejectedValueOnce(new Error("storage unavailable"))
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={vi.fn()}
        courseStartDate="2026-08-29"
      />,
    )

    await user.click(
      await screen.findByRole("button", { name: "Sabato, 1 assegnati" }),
    )
    await user.click(screen.getByRole("button", { name: "Segna completata" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Modifica non salvata. Riprova.",
    )
    expect(
      screen.getByRole("button", { name: "Segna completata" }),
    ).toBeEnabled()
  })

  it("allows a manual duplicate assignment and surfaces its major warning", async () => {
    getPlan.mockResolvedValue({
      assignments: [
        { dayId: "saturday", studentId: "student-1" },
        { dayId: "sunday", studentId: "student-2" },
        { dayId: "monday", studentId: "student-3" },
        { dayId: "tuesday", studentId: "student-4" },
        { dayId: "wednesday", studentId: "student-5" },
        { dayId: "thursday", studentId: "student-6" },
        { dayId: "friday", studentId: "student-7" },
        { dayId: "friday", studentId: "student-8" },
      ],
      settings: SETTINGS,
    })
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={vi.fn()}
        courseStartDate="2026-08-29"
      />,
    )

    await user.click(
      await screen.findByRole("button", { name: /Domenica, 1 assegnati/ }),
    )
    const studentButton = within(
      screen.getByRole("region", { name: "Allievi comandata Domenica" }),
    ).getByRole("button", { name: /^Nome1$/ })
    expect(
      within(
        screen.getByRole("region", { name: "Allievi comandata Domenica" }),
      ).getByLabelText("Minorenne"),
    ).toBeVisible()
    await user.click(studentButton)
    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    expect(savePlan.mock.calls[0]![1]).toEqual(
      expect.arrayContaining([
        { dayId: "saturday", studentId: "student-1" },
        { dayId: "sunday", studentId: "student-1" },
      ]),
    )
  })

  it("acknowledges an advisory warning while leaving major warnings visible", async () => {
    getPlan.mockResolvedValue({
      assignments: [
        { dayId: "saturday", studentId: "student-1" },
        { dayId: "sunday", studentId: "student-2" },
        { dayId: "monday", studentId: "student-3" },
        { dayId: "tuesday", studentId: "student-4" },
        { dayId: "wednesday", studentId: "student-5" },
        { dayId: "thursday", studentId: "student-6" },
        { dayId: "friday", studentId: "student-7" },
        { dayId: "friday", studentId: "student-8" },
      ],
      settings: {
        ...SETTINGS,
        extraDayIds: ["friday"],
        fewerDayIds: DUTY_DAYS.map(({ id }) => id).filter(
          (id) => id !== "friday",
        ),
        stayOverStudentIds: ["student-1"],
      },
    })
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={vi.fn()}
        courseStartDate="2026-08-29"
      />,
    )

    const fridayCard = await screen.findByRole("button", {
      name: /Venerdì, 2 assegnati/,
    })
    const advisorySummary = within(fridayCard.closest("article")!).getByText(
      "1 avviso",
    ).parentElement
    expect(advisorySummary).toHaveClass("text-[#996515]")
    expect(advisorySummary).not.toHaveClass("text-[#b42318]")

    await user.click(await screen.findByRole("button", { name: /Avvisi/ }))
    expect(screen.getByText("Preferenza venerdì non soddisfatta")).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Accetta eccezione" }))

    await waitFor(() =>
      expect(savePlan).toHaveBeenCalledWith(
        "course-1",
        expect.any(Array),
        expect.objectContaining({
          acknowledgedWarningKeys: [expect.stringContaining("friday-stayover")],
        }),
      ),
    )

    await user.click(
      screen.getByRole("button", { name: "Indietro da Avvisi comandate" }),
    )
    expect(
      screen.queryByText("Preferenza venerdì non soddisfatta"),
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: /Sabato, 1 assegnati/ }),
    )
    await user.click(
      within(
        screen.getByRole("region", { name: "Allievi comandata Sabato" }),
      ).getByRole("button", { name: /^Nome2$/ }),
    )

    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(2))
    expect(savePlan.mock.calls[1]![2].acknowledgedWarningKeys).toEqual([
      expect.stringContaining("friday-stayover"),
    ])

    await user.click(
      screen.getByRole("button", { name: "Indietro da Comandata sabato" }),
    )
    await user.click(
      screen.getByRole("button", { name: /Venerdì, 2 assegnati/ }),
    )
    const fridayStudent = within(
      screen.getByRole("region", { name: "Allievi comandata Venerdì" }),
    ).getByRole("button", { name: /^Nome1$/ })
    await user.click(fridayStudent)
    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(3))
    expect(savePlan.mock.calls[2]![2].acknowledgedWarningKeys).toEqual([])

    await user.click(
      screen.getByRole("button", { name: "Rimuovi Nome1 da Venerdì" }),
    )
    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(4))
    await user.click(
      screen.getByRole("button", { name: "Indietro da Comandata venerdì" }),
    )
    await user.click(screen.getByRole("button", { name: /Avvisi/ }))
    expect(screen.getByText("Preferenza venerdì non soddisfatta")).toBeVisible()
  })

  it("retains an acknowledgement when recalculation leaves its advisory unchanged", async () => {
    const records = Array.from({ length: 14 }, (_, index): StudentRecord => ({
      id: `student-${index + 1}`,
      courseId: "course-1",
      firstName: `Nome${index + 1}`,
      surname: `Cognome${index + 1}`,
      nickname: null,
      dateOfBirth: index < 2 ? "2010-01-01" : "2000-01-01",
      declaredAgeAtCourseStart: null,
      sex: index % 2 === 0 ? "female" : "male",
      phone: null,
      size: null,
      initialNote: null,
      courseNote: null,
      active: 1,
    }))
    const assignments = [
      ...DUTY_DAYS.slice(0, 6).flatMap(({ id }, dayIndex) => [
        { dayId: id, studentId: records[dayIndex * 2 + 2]!.id },
        { dayId: id, studentId: records[dayIndex * 2 + 3]!.id },
      ]),
      { dayId: "friday" as const, studentId: records[0]!.id },
      { dayId: "friday" as const, studentId: records[1]!.id },
    ]
    getStudents.mockResolvedValue(records)
    getPlan.mockResolvedValue({
      assignments,
      settings: {
        ...SETTINGS,
        desiredPerDay: 2,
        stayOverStudentIds: [records[0]!.id, records[1]!.id],
      },
    })
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={vi.fn()}
        courseStartDate="2026-08-29"
      />,
    )

    await user.click(await screen.findByRole("button", { name: /Avvisi/ }))
    expect(
      screen.getByText("Minori non distribuiti uniformemente"),
    ).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Accetta eccezione" }))
    await user.click(
      screen.getByRole("button", { name: "Indietro da Avvisi comandate" }),
    )
    await user.click(screen.getByRole("button", { name: "Ricalcola" }))
    await user.click(screen.getByRole("button", { name: "Conferma proposta" }))

    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(2))
    expect(savePlan.mock.calls[1]![2].acknowledgedWarningKeys).toEqual([
      expect.stringContaining("minor-balance"),
    ])
    await user.click(screen.getByRole("button", { name: /Avvisi/ }))
    expect(
      screen.queryByText("Minori non distribuiti uniformemente"),
    ).not.toBeInTheDocument()
  })

  it("returns to the day plan on phone Back instead of leaving the area", async () => {
    getPlan.mockResolvedValue({
      assignments: [{ dayId: "saturday", studentId: "student-1" }],
      settings: SETTINGS,
    })
    const onHome = vi.fn()
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={onHome}
        courseStartDate="2026-08-29"
      />,
    )

    await user.click(
      await screen.findByRole("button", { name: /Sabato, 1 assegnati/ }),
    )
    expect(
      screen.getByRole("region", { name: "Allievi comandata Sabato" }),
    ).toBeVisible()

    window.history.back()
    expect(
      await screen.findByRole("heading", { name: "Comandate" }),
    ).toBeVisible()
    expect(onHome).not.toHaveBeenCalled()
  })

  it("reports an acknowledgement persistence failure", async () => {
    getPlan.mockResolvedValue({
      assignments: [
        { dayId: "saturday", studentId: "student-1" },
        { dayId: "sunday", studentId: "student-2" },
        { dayId: "monday", studentId: "student-3" },
        { dayId: "tuesday", studentId: "student-4" },
        { dayId: "wednesday", studentId: "student-5" },
        { dayId: "thursday", studentId: "student-6" },
        { dayId: "friday", studentId: "student-7" },
        { dayId: "friday", studentId: "student-8" },
      ],
      settings: { ...SETTINGS, stayOverStudentIds: ["student-1"] },
    })
    savePlan.mockRejectedValueOnce(new Error("storage unavailable"))
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={vi.fn()}
        courseStartDate="2026-08-29"
      />,
    )

    await user.click(await screen.findByRole("button", { name: /Avvisi/ }))
    await user.click(screen.getByRole("button", { name: "Accetta eccezione" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Eccezione non salvata. Riprova.",
    )
    expect(screen.getByText("Preferenza venerdì non soddisfatta")).toBeVisible()
  })

  it("shows the F3 Comandate summary entry point only once a rota exists", async () => {
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={vi.fn()}
        courseStartDate="2026-08-29"
      />,
    )

    await screen.findByRole("button", { name: "Proponi comandate" })
    expect(
      screen.queryByRole("button", { name: "Apri riepilogo comandate" }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Proponi comandate" }))
    await user.click(screen.getByRole("button", { name: "Conferma proposta" }))

    expect(
      await screen.findByRole("button", { name: "Apri riepilogo comandate" }),
    ).toBeVisible()
  })

  it("renders every day of the F3 Comandate summary in order", async () => {
    getPlan.mockResolvedValue({
      assignments: [
        { dayId: "saturday", studentId: "student-1" },
        { dayId: "sunday", studentId: "student-2" },
        { dayId: "monday", studentId: "student-2" },
        { dayId: "tuesday", studentId: "student-3" },
        { dayId: "wednesday", studentId: "student-4" },
        { dayId: "friday", studentId: "student-6" },
      ],
      settings: { ...SETTINGS, completedDayIds: ["saturday"] },
    })
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={vi.fn()}
        courseStartDate="2026-08-29"
      />,
    )

    await user.click(
      await screen.findByRole("button", { name: "Apri riepilogo comandate" }),
    )
    const view = screen.getByRole("dialog", { name: "Vista lettura comandate" })
    expect(within(view).getAllByRole("listitem")).toHaveLength(7)

    const saturdayCard = within(view).getByRole("listitem", {
      name: "Sabato, 1 assegnati, completata",
    })
    expect(within(saturdayCard).getByText("Nome1")).toBeVisible()
    expect(within(saturdayCard).getByText("M", { exact: true })).toBeVisible()

    // Thursday got no assignment at all in this fixture.
    const thursdayCard = within(view).getByRole("listitem", {
      name: "Giovedì, 0 assegnati",
    })
    expect(within(thursdayCard).getByText("Nessun assegnato")).toBeVisible()

    // Student 2 is assigned twice (Domenica and Lunedì): both days carry a
    // warning, the same "assegnato più volte" rule the ordinary P11 list
    // already enforces.
    for (const name of ["Domenica, 1 assegnati", "Lunedì, 1 assegnati"]) {
      expect(
        within(within(view).getByRole("listitem", { name })).getByRole("img", {
          name: /Avviso comandata/,
        }),
      ).toBeVisible()
    }
  })

  describe("Comandate read view", () => {
    const PLAN: Awaited<ReturnType<typeof readDutyPlan>> = {
      // In this fixture Saturday carries a warning; Sunday and Monday do not.
      assignments: [
        { dayId: "saturday", studentId: "student-2" },
        { dayId: "sunday", studentId: "student-3" },
        { dayId: "monday", studentId: "student-4" },
      ],
      settings: SETTINGS,
    }
    const renderDuties = () =>
      render(
        <DutyManagement
          courseId="course-1"
          onHome={vi.fn()}
          courseStartDate="2026-08-29"
        />,
      )

    afterEach(() => {
      document.documentElement.style.overflow = ""
      document.body.style.overflow = ""
    })

    it("locks the page scroll while it is open and gives back the previous values when it closes by button, by Escape and on unmount", async () => {
      getPlan.mockResolvedValue(PLAN)
      // Values the page had before the view opened, neither of them empty, so
      // "restored" cannot be mistaken for "cleared".
      document.documentElement.style.overflow = "auto"
      document.body.style.overflow = "scroll"
      const user = userEvent.setup()
      const { unmount } = renderDuties()
      const open = () =>
        user.click(
          screen.getByRole("button", { name: "Apri riepilogo comandate" }),
        )
      await screen.findByRole("button", { name: "Apri riepilogo comandate" })

      await open()
      expect(
        screen.getByRole("dialog", { name: "Vista lettura comandate" }),
      ).toBeVisible()
      expect(document.documentElement.style.overflow).toBe("hidden")
      expect(document.body.style.overflow).toBe("hidden")

      // Closed with its own button.
      await user.click(
        screen.getByRole("button", { name: "Chiudi vista lettura" }),
      )
      expect(
        screen.queryByRole("dialog", { name: "Vista lettura comandate" }),
      ).not.toBeInTheDocument()
      expect(document.documentElement.style.overflow).toBe("auto")
      expect(document.body.style.overflow).toBe("scroll")

      // Closed with Escape. The phone's Back is not wired to this overlay: it
      // is a plain boolean on the list screen, closed by its own X/Escape.
      await open()
      expect(document.documentElement.style.overflow).toBe("hidden")
      await user.keyboard("{Escape}")
      expect(
        screen.queryByRole("dialog", { name: "Vista lettura comandate" }),
      ).not.toBeInTheDocument()
      expect(document.documentElement.style.overflow).toBe("auto")
      expect(document.body.style.overflow).toBe("scroll")

      // Left open and unmounted (navigating away from the Comandate screen).
      await open()
      expect(document.body.style.overflow).toBe("hidden")
      unmount()
      expect(document.documentElement.style.overflow).toBe("auto")
      expect(document.body.style.overflow).toBe("scroll")
    })

    it("keeps names clear of the corner warning badge on a card that has one", async () => {
      getPlan.mockResolvedValue(PLAN)
      const user = userEvent.setup()
      renderDuties()
      await user.click(
        await screen.findByRole("button", { name: "Apri riepilogo comandate" }),
      )
      const view = screen.getByRole("dialog", {
        name: "Vista lettura comandate",
      })

      const warned = within(view).getByRole("listitem", {
        name: "Sabato, 1 assegnati",
      })
      expect(
        within(warned).getByRole("img", { name: /Avviso comandata/ }),
      ).toBeVisible()
      expect(within(warned).getByText("Nome2").closest(".grid")).toHaveClass(
        "pr-5",
      )
      const clear = within(view).getByRole("listitem", {
        name: "Domenica, 1 assegnati",
      })
      expect(
        within(clear).queryByRole("img", { name: /Avviso comandata/ }),
      ).not.toBeInTheDocument()
      expect(within(clear).getByText("Nome3").closest(".grid")).not.toHaveClass(
        "pr-5",
      )
    })

    describe("F4 summary image", () => {
      let browser: ReturnType<typeof stubSummaryImageBrowser>
      // userEvent puts a clipboard of its own on the page when it is set up,
      // so the recording one goes on after it.
      const setupUser = () => {
        const user = userEvent.setup()
        browser = stubSummaryImageBrowser()
        return user
      }
      beforeEach(() => {
        vi.mocked(renderElementToPng).mockReset()
        vi.mocked(renderElementToPng).mockResolvedValue(
          new Blob(["png"], { type: "image/png" }),
        )
      })
      afterEach(restoreSummaryImageBrowser)

      it("has one floating button that copies the screenshot of the content, and no download", async () => {
        getPlan.mockResolvedValue(PLAN)
        const user = setupUser()
        renderDuties()
        await user.click(
          await screen.findByRole("button", {
            name: "Apri riepilogo comandate",
          }),
        )
        const view = screen.getByRole("dialog", {
          name: "Vista lettura comandate",
        })
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
        // The seven days under their header, not the dialog: the close button
        // is inside and marked to be left out, the save button is outside.
        expect(view).not.toBe(element)
        expect(view.contains(element)).toBe(true)
        expect(
          within(element).getByRole("heading", { level: 1 }),
        ).toBeInTheDocument()
        expect(within(element).getAllByRole("listitem")).toHaveLength(7)
        expect(
          within(element).getByRole("button", { name: "Chiudi vista lettura" }),
        ).toHaveAttribute("data-snapshot-exclude", "true")
        expect(element.contains(copy)).toBe(false)
        expect(options).toEqual({ background: "#fffdf8" })
        expect(browser.clipboardWrite).toHaveBeenCalledOnce()
      })

      it("says when the image could not be made, and drops that message when it is opened again", async () => {
        getPlan.mockResolvedValue(PLAN)
        vi.mocked(renderElementToPng).mockRejectedValue(
          new Error("canvas too large"),
        )
        const user = setupUser()
        renderDuties()
        await user.click(
          await screen.findByRole("button", {
            name: "Apri riepilogo comandate",
          }),
        )
        await user.click(
          screen.getByRole("button", {
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
          screen.getByRole("button", { name: "Apri riepilogo comandate" }),
        )

        expect(
          within(
            screen.getByRole("dialog", { name: "Vista lettura comandate" }),
          ).queryByRole("alert"),
        ).not.toBeInTheDocument()
      })
    })
  })
})
