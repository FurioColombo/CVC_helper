import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/students", () => ({
  createStudents: vi.fn(),
}))

vi.mock("@/features/students/StudentScanImageEditor", () => ({
  StudentScanImageEditor: ({
    file,
    onCancel,
    onUse,
  }: {
    file: File
    onCancel: () => void
    onUse: (image: Blob) => void
  }) => (
    <div role="dialog">
      <button onClick={onCancel}>Chiudi regolazione foto</button>
      <button onClick={() => onUse(file)}>Usa questa area</button>
    </div>
  ),
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

  it("offers separate native camera and gallery paths plus manual fallback", async () => {
    const onManualAdd = vi.fn()
    const user = userEvent.setup()
    render(
      <StudentScan
        courseId="course-1"
        courseStartDate="2026-08-29"
        onBack={vi.fn()}
        onCommitted={vi.fn()}
        onManualAdd={onManualAdd}
      />,
    )

    expect(screen.getByRole("button", { name: "Fai una foto" })).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Scegli dalla galleria" }),
    ).toBeVisible()
    expect(
      screen.getByLabelText("Scatta foto dell’elenco allievi"),
    ).toHaveAttribute("capture", "environment")
    expect(
      screen.getByLabelText("Scegli foto dell’elenco allievi dalla galleria"),
    ).not.toHaveAttribute("capture")

    await user.click(
      screen.getByRole("button", { name: "Inserisci manualmente" }),
    )
    expect(onManualAdd).toHaveBeenCalledOnce()
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
      screen.getByLabelText("Scegli foto dell’elenco allievi dalla galleria"),
      new File(["image"], "elenco.png", { type: "image/png" }),
    )
    await user.click(screen.getByRole("button", { name: "Usa questa area" }))

    expect(
      await screen.findByRole("heading", {
        name: "Controlla prima di salvare",
      }),
    ).toBeVisible()
    expect(addStudents).not.toHaveBeenCalled()
    expect(screen.getByText("Da controllare")).toBeVisible()

    const counters = screen.getByLabelText("Stato revisione scansione")
    expect(within(counters).getAllByText("1")).toHaveLength(2)
    expect(within(counters).getByText("0")).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Aggiungi 2 allievi" }))
    expect(addStudents).not.toHaveBeenCalled()
    expect(
      screen.getByText("Completa nome, cognome, data di nascita e sesso."),
    ).toBeVisible()

    const surname = screen.getByLabelText(/^Cognome riga line-1-1$/)
    await user.clear(surname)
    await user.type(surname, "Rossi")
    await user.click(screen.getByRole("button", { name: "Rimuovi allievo 2" }))
    expect(within(counters).getAllByText("0")).toHaveLength(2)
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
      screen.getByLabelText("Scegli foto dell’elenco allievi dalla galleria"),
      new File(["blurred"], "sfocata.png", { type: "image/png" }),
    )
    await user.click(screen.getByRole("button", { name: "Usa questa area" }))

    expect(await screen.findByText("Immagine poco leggibile")).toBeVisible()
    expect(
      screen.queryByText("Controlla prima di salvare"),
    ).not.toBeInTheDocument()
    expect(addStudents).not.toHaveBeenCalled()
  })

  it("preserves reviewed edits and retries an explicit failed save", async () => {
    addStudents.mockRejectedValueOnce(new Error("write failed"))
    const scan = vi.fn().mockResolvedValue({
      ...EXTRACTED,
      candidates: [EXTRACTED.candidates[1]],
    })
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
      screen.getByLabelText("Scegli foto dell’elenco allievi dalla galleria"),
      new File(["image"], "elenco.png", { type: "image/png" }),
    )
    await user.click(screen.getByRole("button", { name: "Usa questa area" }))
    const surname = await screen.findByLabelText(/^Cognome riga/)
    await user.clear(surname)
    await user.type(surname, "Verdi")
    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))

    expect(
      await screen.findByText(
        "Gli allievi non sono stati aggiunti. Controlla e riprova.",
      ),
    ).toBeVisible()
    expect(surname).toHaveValue("Verdi")
    expect(onCommitted).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole("button", { name: "Riprova inserimento" }),
    )
    await waitFor(() => expect(addStudents).toHaveBeenCalledTimes(2))
    expect(addStudents.mock.calls[1]?.[1][0]?.surname).toBe("Verdi")
    expect(onCommitted).toHaveBeenCalledOnce()
  })

  it("returns focus to the acquisition action after cancelling adjustment", async () => {
    const user = userEvent.setup()
    render(
      <StudentScan
        courseId="course-1"
        courseStartDate="2026-08-29"
        onBack={vi.fn()}
        onCommitted={vi.fn()}
      />,
    )
    const galleryButton = screen.getByRole("button", {
      name: "Scegli dalla galleria",
    })
    galleryButton.focus()
    await user.upload(
      screen.getByLabelText("Scegli foto dell’elenco allievi dalla galleria"),
      new File(["image"], "elenco.png", { type: "image/png" }),
    )
    await user.click(
      screen.getByRole("button", { name: "Chiudi regolazione foto" }),
    )
    await waitFor(() => expect(galleryButton).toHaveFocus())
  })

  it("allows only one in-flight save and locks review controls", async () => {
    let finishSave: ((value: []) => void) | undefined
    addStudents.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSave = resolve
        }),
    )
    const user = userEvent.setup()
    const onCommitted = vi.fn()
    render(
      <StudentScan
        courseId="course-1"
        courseStartDate="2026-08-29"
        onBack={vi.fn()}
        onCommitted={onCommitted}
        scan={vi.fn().mockResolvedValue({
          ...EXTRACTED,
          candidates: [EXTRACTED.candidates[1]],
        })}
      />,
    )
    await user.upload(
      screen.getByLabelText("Scegli foto dell’elenco allievi dalla galleria"),
      new File(["image"], "elenco.png", { type: "image/png" }),
    )
    await user.click(screen.getByRole("button", { name: "Usa questa area" }))
    const submit = await screen.findByRole("button", {
      name: "Aggiungi 1 allievo",
    })
    const form = submit.closest("form")
    expect(form).not.toBeNull()
    fireEvent.submit(form as HTMLFormElement)
    fireEvent.submit(form as HTMLFormElement)

    await waitFor(() => expect(addStudents).toHaveBeenCalledOnce())
    expect(screen.getByLabelText(/^Nome riga/)).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Rimuovi allievo 1" }),
    ).toBeDisabled()
    finishSave?.([])
    await waitFor(() => expect(onCommitted).toHaveBeenCalledOnce())
  })
})
