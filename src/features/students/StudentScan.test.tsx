import {
  cleanup,
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

vi.mock("@/features/students/StudentScanImageEditorDocument", () => ({
  StudentScanImageEditorDocument: ({
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

/** Two rows read surname-first, as the printed roster actually prints them. */
const SURNAME_FIRST: StudentScanResult = {
  aggregateConfidence: 93,
  unsuitable: false,
  candidates: [
    {
      sourceId: "line-1",
      firstName: "Altomare",
      surname: "Valeria",
      dateOfBirth: "1986-07-01",
      phone: "",
      sex: null,
      confidence: { firstName: 93, surname: 94, dateOfBirth: 92, phone: 0 },
      nameReading: {
        raw: "Altomare Valeria",
        words: [
          { text: "Altomare", confidence: 93 },
          { text: "Valeria", confidence: 94 },
        ],
        order: "unknown",
        compoundAmbiguity: false,
        acknowledged: false,
      },
    },
    {
      sourceId: "line-2",
      firstName: "Mosca",
      surname: "Caterina",
      dateOfBirth: "2006-12-20",
      phone: "",
      sex: null,
      confidence: { firstName: 92, surname: 93, dateOfBirth: 91, phone: 0 },
      nameReading: {
        raw: "Mosca Caterina",
        words: [
          { text: "Mosca", confidence: 92 },
          { text: "Caterina", confidence: 93 },
        ],
        order: "unknown",
        compoundAmbiguity: false,
        acknowledged: false,
      },
    },
  ],
}

async function openReview(result: StudentScanResult) {
  const user = userEvent.setup()
  render(
    <StudentScan
      courseId="course-1"
      courseStartDate="2026-08-29"
      onBack={vi.fn()}
      onCommitted={vi.fn()}
      scan={vi.fn().mockResolvedValue(result)}
    />,
  )
  await user.upload(
    screen.getByLabelText("Scegli foto dell’elenco allievi dalla galleria"),
    new File(["image"], "elenco.png", { type: "image/png" }),
  )
  await user.click(screen.getByRole("button", { name: "Usa questa area" }))
  await screen.findByRole("heading", { name: "Controlla prima di salvare" })
  return user
}

describe("StudentScan name order", () => {
  beforeEach(() => {
    // The chosen order is remembered per course, so each test starts fresh.
    window.localStorage.clear()
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

  it("asks for the order instead of assuming the first word is a given name", async () => {
    await openReview(SURNAME_FIRST)

    expect(screen.getByLabelText("Ordine dei nomi")).toBeVisible()
    expect(screen.getAllByText("Ordine da decidere")).toHaveLength(2)
    expect(screen.getAllByText("Letto:")).toHaveLength(2)
    expect(screen.getByText("Altomare Valeria")).toBeVisible()
    // Nothing may be committed while the order is still undecided.
    const counters = screen.getByLabelText("Stato revisione scansione")
    expect(within(counters).getByText("0")).toBeVisible()
  })

  it("applies a chosen order across the sheet and unblocks the rows", async () => {
    const user = await openReview(SURNAME_FIRST)

    await user.click(
      screen.getByRole("button", { name: "Applica Cognome · Nome" }),
    )

    expect(screen.getByLabelText(/^Nome riga line-1-1$/)).toHaveValue("Valeria")
    expect(screen.getByLabelText(/^Cognome riga line-1-1$/)).toHaveValue(
      "Altomare",
    )
    expect(screen.getByLabelText(/^Nome riga line-2-2$/)).toHaveValue(
      "Caterina",
    )
    expect(screen.getByLabelText(/^Cognome riga line-2-2$/)).toHaveValue(
      "Mosca",
    )
    // The question is replaced by the remembered answer, not asked again.
    const banner = within(screen.getByLabelText("Ordine dei nomi"))
    expect(
      screen.queryByRole("button", { name: "Applica Cognome · Nome" }),
    ).not.toBeInTheDocument()
    expect(banner.getByText("Cognome · Nome")).toBeVisible()
    expect(
      banner.getByRole("button", { name: "Inverti per tutti" }),
    ).toBeVisible()
  })

  it("remembers the order for the next scan of the same course", async () => {
    const user = await openReview(SURNAME_FIRST)
    await user.click(
      screen.getByRole("button", { name: "Applica Cognome · Nome" }),
    )
    cleanup()

    await openReview(SURNAME_FIRST)
    // Asked once per course: the second scan arrives already the right way up.
    expect(
      screen.queryByRole("button", { name: "Applica Cognome · Nome" }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Nome riga line-1-1$/)).toHaveValue("Valeria")
  })

  it("leaves a row alone once the operator has typed the name themselves", async () => {
    const user = await openReview(SURNAME_FIRST)

    const firstName = screen.getByLabelText(/^Nome riga line-1-1$/)
    await user.clear(firstName)
    await user.type(firstName, "Valeria")

    await user.click(
      screen.getByRole("button", { name: "Applica Cognome · Nome" }),
    )

    // The hand-corrected row keeps what was typed rather than being re-split.
    expect(screen.getByLabelText(/^Nome riga line-1-1$/)).toHaveValue("Valeria")
    expect(screen.getByLabelText(/^Nome riga line-2-2$/)).toHaveValue(
      "Caterina",
    )
  })

  it("swaps a single row without touching the others", async () => {
    const user = await openReview(SURNAME_FIRST)

    await user.click(
      screen.getByRole("button", {
        name: "Scambia nome e cognome riga line-1-1",
      }),
    )

    expect(screen.getByLabelText(/^Nome riga line-1-1$/)).toHaveValue("Valeria")
    expect(screen.getByLabelText(/^Nome riga line-2-2$/)).toHaveValue("Mosca")
  })
})

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
