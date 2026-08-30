import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/students", () => ({
  createStudents: vi.fn(),
}))

import type { StudentScanResult } from "@/capabilities/studentScan"
import { StudentScan } from "@/features/students/StudentScan"
import { createStudents } from "@/persistence/students"

const addStudents = vi.mocked(createStudents)

const EXTRACTED: StudentScanResult = {
  aggregateConfidence: 94,
  unsuitable: false,
  candidates: [
    {
      sourceId: "line-1",
      firstName: "Mario",
      surname: "Rossl",
      dateOfBirth: "2008-03-12",
      phone: "333 123 4567",
      sex: "male",
      confidence: {
        firstName: 96,
        surname: 61,
        dateOfBirth: 96,
        phone: 95,
      },
    },
    {
      sourceId: "line-2",
      firstName: "Giulia",
      surname: "Bianchi",
      dateOfBirth: "1998-11-24",
      phone: "347 765 4321",
      sex: "female",
      confidence: {
        firstName: 97,
        surname: 97,
        dateOfBirth: 97,
        phone: 96,
      },
    },
  ],
}

describe("StudentScan", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    })
    addStudents.mockResolvedValue([])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("requires review, supports correction/removal, and commits only confirmed rows", async () => {
    const scan = vi.fn().mockResolvedValue(EXTRACTED)
    const onCommitted = vi.fn()
    const user = userEvent.setup()
    render(
      <StudentScan
        courseId="course-1"
        courseStartDate="2026-08-29"
        onBack={vi.fn()}
        onCommitted={onCommitted}
        scan={scan}
      />,
    )

    await user.upload(
      screen.getByLabelText("Foto o screenshot degli allievi"),
      new File(["image"], "elenco.png", { type: "image/png" }),
    )

    expect(
      await screen.findByRole("heading", {
        name: "Controlla prima di salvare",
      }),
    ).toBeVisible()
    expect(addStudents).not.toHaveBeenCalled()
    expect(screen.getByText("Da controllare")).toBeVisible()

    const surname = screen.getByLabelText(/^Cognome riga line-1-1$/)
    await user.clear(surname)
    await user.type(surname, "Rossi")
    await user.click(screen.getByRole("button", { name: "Rimuovi allievo 2" }))
    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))

    await waitFor(() =>
      expect(addStudents).toHaveBeenCalledWith("course-1", [
        {
          firstName: "Mario",
          surname: "Rossi",
          nickname: null,
          dateOfBirth: "2008-03-12",
          sex: "male",
          phone: "333 123 4567",
        },
      ]),
    )
    expect(onCommitted).toHaveBeenCalledOnce()
  })

  it("asks for another image when extraction is unsuitable", async () => {
    const user = userEvent.setup()
    render(
      <StudentScan
        courseId="course-1"
        courseStartDate="2026-08-29"
        onBack={vi.fn()}
        onCommitted={vi.fn()}
        scan={vi.fn().mockResolvedValue({
          aggregateConfidence: 53,
          candidates: [],
          unsuitable: true,
        })}
      />,
    )

    await user.upload(
      screen.getByLabelText("Foto o screenshot degli allievi"),
      new File(["blurred"], "sfocata.png", { type: "image/png" }),
    )

    expect(await screen.findByText("Immagine poco leggibile")).toBeVisible()
    expect(
      screen.queryByText("Controlla prima di salvare"),
    ).not.toBeInTheDocument()
    expect(addStudents).not.toHaveBeenCalled()
  })
})
