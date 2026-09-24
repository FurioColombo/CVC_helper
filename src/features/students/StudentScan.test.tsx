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
      firstName: "Veldor",
      surname: "Valeria",
      dateOfBirth: "1986-07-11",
      phone: "",
      sex: null,
      confidence: { firstName: 93, surname: 94, dateOfBirth: 92, phone: 0 },
      nameReading: {
        raw: "Veldor Valeria",
        words: [
          { text: "Veldor", confidence: 93 },
          { text: "Valeria", confidence: 94 },
        ],
        order: "unknown",
        compoundAmbiguity: false,
        acknowledged: false,
      },
    },
    {
      sourceId: "line-2",
      firstName: "Liosca",
      surname: "Caterina",
      dateOfBirth: "2006-12-02",
      phone: "",
      sex: null,
      confidence: { firstName: 92, surname: 93, dateOfBirth: 91, phone: 0 },
      nameReading: {
        raw: "Liosca Caterina",
        words: [
          { text: "Liosca", confidence: 92 },
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

  it("asks when too few rows support a deduction", async () => {
    await openReview({
      ...SURNAME_FIRST,
      candidates: SURNAME_FIRST.candidates.slice(0, 1),
    })

    expect(screen.getByLabelText("Ordine dei nomi")).toBeVisible()
    expect(screen.getAllByText("Ordine da decidere")).toHaveLength(1)
    expect(screen.getAllByText("Letto:")).toHaveLength(1)
    expect(screen.getByText("Veldor Valeria")).toBeVisible()
    // Nothing may be committed while the order is still undecided.
    const counters = screen.getByLabelText("Stato revisione scansione")
    expect(within(counters).getByText("0")).toBeVisible()
  })

  it("deduces one order across the sheet and reports both votes before commit", async () => {
    await openReview(SURNAME_FIRST)
    expect(
      screen.getByText(
        /Dedotto dal foglio:.*prima posizione in 1 righe, in ultima in 2/,
      ),
    ).toBeVisible()
    expect(addStudents).not.toHaveBeenCalled()

    expect(screen.getByLabelText(/^Nome riga line-1-1$/)).toHaveValue("Valeria")
    expect(screen.getByLabelText(/^Cognome riga line-1-1$/)).toHaveValue(
      "Veldor",
    )
    expect(screen.getByLabelText(/^Nome riga line-2-2$/)).toHaveValue(
      "Caterina",
    )
    expect(screen.getByLabelText(/^Cognome riga line-2-2$/)).toHaveValue(
      "Liosca",
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
    await user.click(screen.getByRole("button", { name: "Inverti per tutti" }))
    cleanup()

    await openReview(SURNAME_FIRST)
    // Asked once per course: the second scan arrives already the right way up.
    expect(
      screen.queryByRole("button", { name: "Applica Cognome · Nome" }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Nome riga line-1-1$/)).toHaveValue("Veldor")
    expect(screen.queryByText(/Dedotto dal foglio/)).not.toBeInTheDocument()
  })

  it("keeps the explicit fallback and remembers its answer", async () => {
    const uncertainSheet = {
      ...SURNAME_FIRST,
      candidates: SURNAME_FIRST.candidates.slice(0, 1),
    }
    const user = await openReview(uncertainSheet)
    await user.click(
      screen.getByRole("button", { name: "Applica Cognome · Nome" }),
    )
    cleanup()
    await openReview(uncertainSheet)
    expect(screen.getByLabelText(/^Nome riga/)).toHaveValue("Valeria")
    expect(
      screen.queryByText("Come sono scritti i nomi?"),
    ).not.toBeInTheDocument()
  })

  it("keeps compound text visible and refuses commit until its split is reviewed", async () => {
    const compound = structuredClone(SURNAME_FIRST.candidates[0]!)
    compound.sourceId = "compound"
    compound.firstName = "Rossi"
    compound.surname = "Maria Giulia"
    compound.nameReading = {
      raw: "Rossi Maria Giulia",
      words: ["Rossi", "Maria", "Giulia"].map((text) => ({
        text,
        confidence: 95,
      })),
      order: "unknown",
      compoundAmbiguity: true,
      acknowledged: false,
    }
    const user = await openReview({
      ...SURNAME_FIRST,
      candidates: [...SURNAME_FIRST.candidates, compound],
    })
    expect(screen.getByLabelText(/^Nome riga compound/)).toHaveValue("Rossi")
    expect(screen.getByLabelText(/^Cognome riga compound/)).toHaveValue(
      "Maria Giulia",
    )
    expect(screen.getByText(/Nome o cognome composto/)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Aggiungi 3 allievi" }))
    expect(addStudents).not.toHaveBeenCalled()
  })

  it("leaves a row alone once the operator has typed the name themselves", async () => {
    const user = await openReview(SURNAME_FIRST)

    const firstName = screen.getByLabelText(/^Nome riga line-1-1$/)
    await user.clear(firstName)
    await user.type(firstName, "Valeria")

    await user.click(screen.getByRole("button", { name: "Inverti per tutti" }))

    // The hand-corrected row keeps what was typed rather than being re-split.
    expect(screen.getByLabelText(/^Nome riga line-1-1$/)).toHaveValue("Valeria")
    expect(screen.getByLabelText(/^Nome riga line-2-2$/)).toHaveValue("Liosca")
  })

  it("does not offer a row-level name swap", async () => {
    await openReview(SURNAME_FIRST)

    expect(
      screen.queryByRole("button", { name: /Scambia nome e cognome riga/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Inverti per tutti" }),
    ).toBeVisible()
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
      screen.getByText(
        "Completa nome, cognome, età e sesso. Controlla la data di nascita se è presente.",
      ),
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
          declaredAgeAtCourseStart: null,
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

  it("counter actions focus the first incomplete field and first row to review", async () => {
    const user = await openReview({
      aggregateConfidence: 90,
      unsuitable: false,
      candidates: [
        {
          sourceId: "line-missing",
          firstName: "",
          surname: "Rossi",
          dateOfBirth: "",
          ageReading: { value: 24, confidence: 94 },
          phone: "",
          sex: "male",
          confidence: { firstName: 0, surname: 95, dateOfBirth: 0, phone: 0 },
        },
        {
          sourceId: "line-review",
          firstName: "Luigi",
          surname: "Bianchi",
          dateOfBirth: "",
          ageReading: { value: 24, confidence: 94 },
          phone: "",
          sex: "male",
          confidence: { firstName: 95, surname: 41, dateOfBirth: 0, phone: 0 },
        },
      ],
    })

    await user.click(
      screen.getByRole("button", { name: "Vai al primo campo da completare" }),
    )
    const firstName = screen.getByLabelText("Nome riga line-missing-1")
    await waitFor(() => expect(firstName).toHaveFocus())
    expect(screen.getByRole("status")).toHaveTextContent(
      "Riga 1, campo da completare. nome",
    )

    await user.type(firstName, "Mario")
    const counters = screen.getByLabelText("Stato revisione scansione")
    expect(within(counters).getByText("0")).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Vai al primo campo da completare" }),
    ).toBeDisabled()

    await user.click(
      screen.getByRole("button", {
        name: "Vai alla prima riga da controllare",
      }),
    )
    const secondSurname = screen.getByLabelText("Cognome riga line-review-2")
    await waitFor(() => expect(secondSurname).toHaveFocus())
    expect(screen.getByRole("status")).toHaveTextContent(
      "Riga 2, riga da controllare. cognome",
    )
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

  it("warns about a weak image while keeping its recognized fields editable", async () => {
    await openReview({
      ...EXTRACTED,
      aggregateConfidence: 55,
      candidates: [EXTRACTED.candidates[0]!],
    })

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Immagine poco leggibile",
    )
    expect(screen.getByRole("button", { name: "Rifai la foto" })).toBeVisible()
    expect(screen.getByRole("textbox", { name: /Nome riga/ })).toHaveValue(
      "Mario",
    )
    expect(screen.getByRole("textbox", { name: /Cognome riga/ })).toHaveValue(
      "Rossl",
    )
    expect(addStudents).not.toHaveBeenCalled()
  })
})

describe("StudentScan age-first review", () => {
  const baseCandidate = {
    sourceId: "line-age",
    firstName: "Mario",
    surname: "Rossi",
    dateOfBirth: "2002-02-12",
    phone: "",
    sex: "male" as const,
    confidence: { firstName: 95, surname: 95, dateOfBirth: 44, phone: 0 },
  }

  beforeEach(() => {
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

  it("shows age and accepts an independent matching age as corroboration", async () => {
    await openReview({
      aggregateConfidence: 80,
      unsuitable: false,
      candidates: [
        {
          ...baseCandidate,
          ageReading: { value: 24, confidence: 97 },
        },
      ],
    })

    expect(screen.getByLabelText("Età riga line-age-1")).toHaveValue("24")
    expect(
      screen.getByLabelText("Data di nascita riga line-age-1"),
    ).toHaveValue("2002-02-12")
    expect(screen.getByText("Lettura incerta")).toBeVisible()
    expect(screen.queryByText("Da controllare")).not.toBeInTheDocument()
    const counters = screen.getByLabelText("Stato revisione scansione")
    expect(within(counters).getAllByText("0")).toHaveLength(2)
    expect(within(counters).getByText("1")).toBeVisible()
  })

  it("keeps a doubtful recognized date visible when no printed age corroborates it", async () => {
    await openReview({
      aggregateConfidence: 80,
      unsuitable: false,
      candidates: [baseCandidate],
    })

    expect(screen.getByLabelText("Età riga line-age-1")).toHaveValue("24")
    expect(
      screen.getByLabelText("Data di nascita riga line-age-1"),
    ).toHaveValue("2002-02-12")
    expect(
      screen.getByLabelText("Data di nascita riga line-age-1"),
    ).toHaveClass("border-[#f79009]")
  })

  it("saves age-only rows without inventing a date of birth", async () => {
    const user = await openReview({
      aggregateConfidence: 80,
      unsuitable: false,
      candidates: [
        {
          ...baseCandidate,
          dateOfBirth: "",
          ageReading: { value: 24, confidence: 94 },
          confidence: { ...baseCandidate.confidence, dateOfBirth: 0 },
        },
      ],
    })

    expect(screen.getByLabelText("Età riga line-age-1")).toHaveValue("24")
    expect(
      screen.queryByLabelText(/^Data di nascita riga/),
    ).not.toBeInTheDocument()
    const counters = screen.getByLabelText("Stato revisione scansione")
    expect(within(counters).getAllByText("0")).toHaveLength(2)
    expect(within(counters).getByText("1")).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))
    await waitFor(() =>
      expect(addStudents).toHaveBeenCalledWith("course-1", [
        expect.objectContaining({
          dateOfBirth: "",
          declaredAgeAtCourseStart: 24,
        }),
      ]),
    )
  })

  it.each(["-17", "17.5", "121"])(
    "keeps invalid age draft %s visible and blocks saving it",
    async (invalidAge) => {
      const user = await openReview({
        aggregateConfidence: 80,
        unsuitable: false,
        candidates: [
          {
            ...baseCandidate,
            dateOfBirth: "",
            ageReading: { value: 24, confidence: 94 },
            confidence: { ...baseCandidate.confidence, dateOfBirth: 0 },
          },
        ],
      })

      const age = screen.getByLabelText("Età riga line-age-1")
      fireEvent.change(age, { target: { value: invalidAge } })

      expect(age).toHaveValue(invalidAge)
      const counters = screen.getByLabelText("Stato revisione scansione")
      expect(within(counters).getAllByText("1")).toHaveLength(2)
      expect(within(counters).getByText("0")).toBeVisible()

      await user.click(
        screen.getByRole("button", { name: "Aggiungi 1 allievo" }),
      )
      expect(addStudents).not.toHaveBeenCalled()
    },
  )

  it("reveals the exact date when an age correction conflicts with it", async () => {
    const user = await openReview({
      aggregateConfidence: 95,
      unsuitable: false,
      candidates: [
        {
          ...baseCandidate,
          confidence: { ...baseCandidate.confidence, dateOfBirth: 95 },
        },
      ],
    })

    const age = screen.getByLabelText("Età riga line-age-1")
    expect(
      screen.queryByLabelText(/^Data di nascita riga/),
    ).not.toBeInTheDocument()
    await user.clear(age)
    await user.type(age, "20")
    const exactDate = screen.getByLabelText("Data di nascita riga line-age-1")
    expect(exactDate).toHaveValue("2002-02-12")

    // The recognized DOB remains authoritative until it is corrected or cleared.
    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))
    expect(addStudents).not.toHaveBeenCalled()

    fireEvent.change(exactDate, { target: { value: "2006-02-02" } })
    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))
    await waitFor(() =>
      expect(addStudents).toHaveBeenCalledWith("course-1", [
        expect.objectContaining({ dateOfBirth: "2006-02-02" }),
      ]),
    )
  })
})

/**
 * The telephone is the third column of the roster and the one the course does
 * not need. Left unread it must be absent everywhere: not asked of the scan,
 * not shown, not counted against the operator, not stored.
 */
describe("StudentScan telephone option", () => {
  /** The same row as the sheet gives it, with and without the number read. */
  const WITH_PHONE: StudentScanResult = {
    aggregateConfidence: 92,
    unsuitable: false,
    candidates: [
      {
        sourceId: "line-1",
        firstName: "Mario",
        surname: "Rossi",
        dateOfBirth: "2008-03-12",
        phone: "333 123 456?",
        sex: "male",
        // Only the number is doubtful, so it alone decides whether this row
        // costs the operator a check.
        confidence: { firstName: 96, surname: 95, dateOfBirth: 96, phone: 41 },
      },
    ],
  }
  const WITHOUT_PHONE: StudentScanResult = {
    ...WITH_PHONE,
    candidates: [{ ...WITH_PHONE.candidates[0]!, phone: "" }],
  }

  /** Mirrors the capability: asked for, or blank. */
  function scanHonouringTheOption() {
    return vi.fn(
      async (
        _image: Blob,
        _onProgress?: unknown,
        options?: { readPhone: boolean },
      ) => (options?.readPhone ? WITH_PHONE : WITHOUT_PHONE),
    )
  }

  async function scanWith(
    scan: ReturnType<typeof scanHonouringTheOption>,
    turnThePhoneOn: boolean,
  ) {
    const user = userEvent.setup()
    render(
      <StudentScan
        courseId="course-1"
        courseStartDate="2026-08-29"
        onBack={vi.fn()}
        onCommitted={vi.fn()}
        scan={scan}
      />,
    )
    const option = screen.getByRole("checkbox", {
      name: /Leggi anche il telefono/,
    })
    expect(option).not.toBeChecked()
    if (turnThePhoneOn) await user.click(option)
    await user.upload(
      screen.getByLabelText("Scegli foto dell’elenco allievi dalla galleria"),
      new File(["image"], "elenco.png", { type: "image/png" }),
    )
    await user.click(screen.getByRole("button", { name: "Usa questa area" }))
    await screen.findByRole("heading", { name: "Controlla prima di salvare" })
    return user
  }

  /** The three review counters, read by their captions rather than by value. */
  function counters() {
    const section = screen.getByLabelText("Stato revisione scansione")
    const read = (caption: string) =>
      within(section).getByText(caption).parentElement?.querySelector("strong")
        ?.textContent
    return {
      rowsToReview: read("righe da controllare"),
      missingFields: read("campi da completare"),
      ready: read("allievi pronti"),
    }
  }

  beforeEach(() => {
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

  it("does not ask for, show, count or store a telephone left unread", async () => {
    const scan = scanHonouringTheOption()
    const user = await scanWith(scan, false)

    expect(scan).toHaveBeenCalledWith(expect.anything(), expect.any(Function), {
      readPhone: false,
    })
    expect(screen.queryByLabelText(/^Telefono riga/)).not.toBeInTheDocument()
    // The doubtful number would have been the one thing to check. It is not
    // read, so the row is ready and the counters say so.
    expect(counters()).toEqual({
      rowsToReview: "0",
      missingFields: "0",
      ready: "1",
    })

    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))
    await waitFor(() =>
      expect(addStudents).toHaveBeenCalledWith("course-1", [
        {
          firstName: "Mario",
          surname: "Rossi",
          nickname: null,
          dateOfBirth: "2008-03-12",
          declaredAgeAtCourseStart: null,
          sex: "male",
          phone: null,
        },
      ]),
    )
  })

  it("reads and reviews the telephone when it is asked for", async () => {
    const scan = scanHonouringTheOption()
    await scanWith(scan, true)

    expect(scan).toHaveBeenCalledWith(expect.anything(), expect.any(Function), {
      readPhone: true,
    })
    expect(screen.getByLabelText(/^Telefono riga/)).toHaveValue("333 123 456?")
    // Same row, same photograph: now it costs a check.
    expect(counters()).toEqual({
      rowsToReview: "1",
      missingFields: "0",
      ready: "0",
    })
  })
})
