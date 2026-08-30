import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DUTY_DAYS } from "@/domain/config"

vi.mock("@/persistence/duties", () => ({
  readDutyPlan: vi.fn(),
  saveDutyPlan: vi.fn(),
}))

vi.mock("@/persistence/students", () => ({
  listStudents: vi.fn(),
}))

import { DutyManagement } from "@/features/duties/DutyManagement"
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
  sex: index % 2 === 0 ? "female" : "male",
  phone: null,
  size: null,
  initialNote: null,
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

  it("creates a deterministic proposal with the configured Friday preference", async () => {
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={vi.fn()}
        referenceDate="2026-08-29"
      />,
    )

    await user.click(
      await screen.findByRole("button", { name: "Proponi comandate" }),
    )
    await user.click(screen.getByText("Nome1", { exact: true }))
    await user.click(screen.getByRole("button", { name: "Genera" }))

    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    const [, assignments, settings] = savePlan.mock.calls[0]!
    expect(assignments).toHaveLength(8)
    expect(assignments).toContainEqual({
      dayId: "friday",
      studentId: "student-1",
    })
    expect(settings.stayOverStudentIds).toEqual(["student-1"])
  })

  it("normalizes a decimal desired count before saving", async () => {
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={vi.fn()}
        referenceDate="2026-08-29"
      />,
    )

    await user.click(
      await screen.findByRole("button", { name: "Proponi comandate" }),
    )
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "2.5" },
    })
    await user.click(screen.getByRole("button", { name: "Genera" }))

    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    expect(savePlan.mock.calls[0]![2].desiredPerDay).toBe(2)
  })

  it("allows assignment from an empty plan without generating a proposal", async () => {
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={vi.fn()}
        referenceDate="2026-08-29"
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
      ).getByRole("button", { name: /Nome1/ }),
    )

    await waitFor(() =>
      expect(savePlan).toHaveBeenCalledWith(
        "course-1",
        [{ dayId: "saturday", studentId: "student-1" }],
        SETTINGS,
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
        referenceDate="2026-08-29"
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
    await user.click(screen.getByRole("button", { name: "Ricalcola" }))

    await waitFor(() => expect(savePlan).toHaveBeenCalledOnce())
    expect(savePlan.mock.calls[0]![1]).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ dayId: "saturday" })]),
    )
    expect(savePlan.mock.calls[0]![2].completedDayIds).toEqual(["saturday"])
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
        referenceDate="2026-08-29"
      />,
    )

    await user.click(
      await screen.findByRole("button", { name: /Domenica, 1 assegnati/ }),
    )
    const studentButton = within(
      screen.getByRole("region", { name: "Allievi comandata Domenica" }),
    ).getByRole("button", { name: /Nome1/ })
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
      settings: { ...SETTINGS, stayOverStudentIds: ["student-1"] },
    })
    const user = userEvent.setup()
    render(
      <DutyManagement
        courseId="course-1"
        onHome={vi.fn()}
        referenceDate="2026-08-29"
      />,
    )

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
    await user.click(
      screen.getByRole("button", { name: /Sabato, 1 assegnati/ }),
    )
    await user.click(
      within(
        screen.getByRole("region", { name: "Allievi comandata Sabato" }),
      ).getByRole("button", { name: /Nome2/ }),
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
    ).getByRole("button", { name: /Nome1/ })
    await user.click(fridayStudent)
    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(3))
    expect(savePlan.mock.calls[2]![2].acknowledgedWarningKeys).toEqual([])

    await user.click(fridayStudent)
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
      sex: index % 2 === 0 ? "female" : "male",
      phone: null,
      size: null,
      initialNote: null,
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
        referenceDate="2026-08-29"
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
    await user.click(screen.getByRole("button", { name: "Ricalcola" }))

    await waitFor(() => expect(savePlan).toHaveBeenCalledTimes(2))
    expect(savePlan.mock.calls[1]![2].acknowledgedWarningKeys).toEqual([
      expect.stringContaining("minor-balance"),
    ])
    await user.click(screen.getByRole("button", { name: /Avvisi/ }))
    expect(
      screen.queryByText("Minori non distribuiti uniformemente"),
    ).not.toBeInTheDocument()
  })
})
