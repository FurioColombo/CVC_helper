import {
  act,
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

import {
  ROSTER_PASTE_BEGIN,
  ROSTER_PASTE_END,
  ROSTER_PASTE_HEADER,
  ROSTER_PASTE_MAX_ROWS,
  rosterPastePrompt,
} from "@/capabilities/rosterPaste"
import type { StudentScanResult } from "@/capabilities/studentScan"
import { StudentScan } from "@/features/students/StudentScan"
import { requestLeave } from "@/navigation/browserHistory"
import { createStudents } from "@/persistence/students"

const addStudents = vi.mocked(createStudents)
// Every clipboard/prompt test below opens the assistant with the telephone
// option at its default (off), so the prompt they compare against is the one
// for that state.
const ROSTER_PASTE_PROMPT = rosterPastePrompt({ readPhone: false })

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

  it("deduces one order across the sheet without a generic order panel", async () => {
    await openReview(SURNAME_FIRST)
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
    // The inferred correction is applied, while the sheet-wide correction
    // remains available as a compact action rather than a reading banner.
    expect(screen.queryByLabelText("Ordine dei nomi")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Applica Cognome · Nome" }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Letto:")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Inverti per tutti" }),
    ).toBeVisible()
  })

  it("remembers the order for a later scan that cannot vote on its own", async () => {
    const user = await openReview(SURNAME_FIRST)
    // Two flips land back on "surname-given", the sheet's own decisive vote,
    // but the second flip is what turns it into a remembered, explicit
    // choice rather than the silent result of the sheet's own inference.
    await user.click(screen.getByRole("button", { name: "Inverti per tutti" }))
    await user.click(screen.getByRole("button", { name: "Inverti per tutti" }))
    cleanup()

    // A later, smaller scan that cannot decide on its own relies on the
    // remembered order as a tie-breaker instead of asking again.
    await openReview({
      ...SURNAME_FIRST,
      candidates: SURNAME_FIRST.candidates.slice(0, 1),
    })
    expect(screen.queryByLabelText("Ordine dei nomi")).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Nome riga line-1-1$/)).toHaveValue("Valeria")
    expect(screen.getByLabelText(/^Cognome riga line-1-1$/)).toHaveValue(
      "Veldor",
    )
  })

  it("asks again when a remembered order disagrees with the sheet's own decisive vote", async () => {
    const user = await openReview(SURNAME_FIRST)
    // A single flip remembers "given-surname", the opposite of what this very
    // sheet itself decisively votes for.
    await user.click(screen.getByRole("button", { name: "Inverti per tutti" }))
    cleanup()

    // The same sheet, scanned again, still votes "surname-given" on its own:
    // that decisive, disagreeing vote must not be silently overridden by the
    // remembered "given-surname", since that would mangle every name.
    await openReview(SURNAME_FIRST)
    expect(screen.getByLabelText("Ordine dei nomi")).toBeVisible()
    expect(
      screen.getByText(/nome in prima posizione in 1 righe, in ultima in 2/),
    ).toBeVisible()
    // Nothing was silently applied: the raw reading is still on screen.
    expect(screen.getByLabelText(/^Nome riga line-1-1$/)).toHaveValue("Veldor")
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
    // Surname first, so `Rossi` is surname under either split; the unproven
    // boundary is offered, not settled.
    expect(screen.getByLabelText(/^Nome riga compound/)).toHaveValue(
      "Maria Giulia",
    )
    expect(screen.getByLabelText(/^Cognome riga compound/)).toHaveValue("Rossi")
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

  it("offers an accessible per-row swap and acknowledges that row", async () => {
    const candidate: StudentScanResult["candidates"][number] = {
      ...SURNAME_FIRST.candidates[0]!,
      sex: "female" as const,
    }
    const user = await openReview({
      ...SURNAME_FIRST,
      candidates: [candidate],
    })

    await user.click(
      screen.getByRole("button", { name: "Scambia nome e cognome riga 1" }),
    )

    expect(screen.getByLabelText(/^Nome riga line-1-1$/)).toHaveValue("Valeria")
    expect(screen.getByLabelText(/^Cognome riga line-1-1$/)).toHaveValue(
      "Veldor",
    )
    expect(screen.queryByText("Letto:")).not.toBeInTheDocument()
    // The old suggestion was read from "Veldor", which just became the
    // surname: the suggestion is made again from "Valeria", the given name now.
    expect(screen.getByRole("radio", { name: "Donna" })).toBeChecked()
    await user.click(screen.getByRole("radio", { name: "Donna" }))
    const counters = screen.getByLabelText("Stato revisione scansione")
    expect(within(counters).getAllByText("0")).toHaveLength(2)
    expect(within(counters).getByText("1")).toBeVisible()
    // The sheet order question remains available for other or future rows.
    expect(screen.getByLabelText("Ordine dei nomi")).toBeVisible()

    await user.click(
      screen.getByRole("button", { name: "Applica Cognome · Nome" }),
    )
    expect(screen.queryByLabelText("Ordine dei nomi")).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Nome riga line-1-1$/)).toHaveValue("Valeria")
    expect(screen.getByLabelText(/^Cognome riga line-1-1$/)).toHaveValue(
      "Veldor",
    )
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
      screen.getByText("Completa nome, cognome, età e sesso."),
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
          dateOfBirth: "",
          declaredAgeAtCourseStart: 18,
          sex: "male",
          phone: "333 123 4567",
        },
      ]),
    )
    expect(onCommitted).toHaveBeenCalledOnce()
  })

  it("acknowledges a nonempty low-confidence field on focus and blur unchanged", async () => {
    const candidate: StudentScanResult["candidates"][number] = {
      ...EXTRACTED.candidates[0]!,
      confidence: {
        ...EXTRACTED.candidates[0]!.confidence,
        surname: 61,
      },
      nameReading: {
        raw: "Mario Rossl",
        words: [
          { text: "Mario", confidence: 96 },
          { text: "Rossl", confidence: 61 },
        ],
        order: "given-surname",
        compoundAmbiguity: false,
        acknowledged: false,
      },
    }
    const user = await openReview({
      ...EXTRACTED,
      candidates: [candidate],
    })
    const surname = screen.getByLabelText("Cognome riga line-1-1")

    expect(surname).toHaveValue("Rossl")
    expect(surname).toHaveClass("border-[#f79009]")
    expect(screen.getByText("Mario Rossl")).toBeVisible()
    await user.click(surname)
    await user.tab()

    expect(surname).toHaveValue("Rossl")
    const counters = screen.getByLabelText("Stato revisione scansione")
    expect(within(counters).getAllByText("0")).toHaveLength(2)
    expect(within(counters).getByText("1")).toBeVisible()
    expect(surname).not.toHaveClass("border-[#f79009]")
    expect(screen.queryByText("Mario Rossl")).not.toBeInTheDocument()
  })

  it("keeps an empty flagged required field pending after focus and blur", async () => {
    const candidate = {
      ...EXTRACTED.candidates[0]!,
      firstName: "",
      confidence: {
        ...EXTRACTED.candidates[0]!.confidence,
        firstName: 0,
      },
    }
    const user = await openReview({
      ...EXTRACTED,
      candidates: [candidate],
    })
    const firstName = screen.getByLabelText("Nome riga line-1-1")

    await user.click(firstName)
    await user.tab()

    expect(firstName).toHaveValue("")
    const counters = screen.getByLabelText("Stato revisione scansione")
    expect(within(counters).getAllByText("1")).toHaveLength(2)
    expect(within(counters).getByText("0")).toBeVisible()
    expect(firstName).toHaveClass("border-[#f79009]")
  })

  it("shows compact sex choices with the full accessible Altro name", async () => {
    await openReview({
      aggregateConfidence: 90,
      unsuitable: false,
      candidates: [
        {
          ...EXTRACTED.candidates[0]!,
          dateOfBirth: "",
          ageReading: { value: 18, confidence: 90 },
          confidence: {
            ...EXTRACTED.candidates[0]!.confidence,
            dateOfBirth: 0,
          },
          sex: "other",
        },
      ],
    })

    expect(screen.getByText("Alt")).toBeVisible()
    const otherOption = screen.getByRole("radio", { name: "Altro" })
    expect(otherOption).toHaveAttribute("value", "other")
    expect(otherOption).toBeChecked()
    const age = screen.getByLabelText("Età riga line-1-1")
    const ageAndSexRow = age.parentElement?.parentElement
    expect(ageAndSexRow).toContainElement(
      screen.getByRole("radiogroup", { name: "Sesso" }),
    )
  })

  it("acknowledges a nonempty low-confidence age on focus and blur unchanged", async () => {
    const user = await openReview({
      aggregateConfidence: 82,
      unsuitable: false,
      candidates: [
        {
          ...EXTRACTED.candidates[0]!,
          dateOfBirth: "",
          ageReading: { value: 18, confidence: 48 },
          confidence: {
            ...EXTRACTED.candidates[0]!.confidence,
            dateOfBirth: 0,
          },
        },
      ],
    })
    const age = screen.getByLabelText("Età riga line-1-1")

    expect(age).toHaveValue("18")
    expect(age).toHaveAttribute("aria-invalid", "true")
    await user.click(age)
    await user.tab()

    expect(age).toHaveValue("18")
    expect(age).toHaveAttribute("aria-invalid", "false")
    const counters = screen.getByLabelText("Stato revisione scansione")
    expect(within(counters).getAllByText("0")).toHaveLength(2)
    expect(within(counters).getByText("1")).toBeVisible()
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

  it("shows the printed age and never a date field, even with a matching, independent corroboration", async () => {
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
      screen.queryByLabelText(/^Data di nascita riga/),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Da controllare")).not.toBeInTheDocument()
    const counters = screen.getByLabelText("Stato revisione scansione")
    expect(within(counters).getAllByText("0")).toHaveLength(2)
    expect(within(counters).getByText("1")).toBeVisible()
  })

  it("marks a computed age for check, on the age field itself, when the recognized date has low confidence", async () => {
    await openReview({
      aggregateConfidence: 80,
      unsuitable: false,
      candidates: [baseCandidate],
    })

    const age = screen.getByLabelText("Età riga line-age-1")
    expect(age).toHaveValue("24")
    expect(age).toHaveClass("border-[#f79009]")
    expect(screen.getByText("Da controllare")).toBeVisible()
    expect(
      screen.queryByLabelText(/^Data di nascita riga/),
    ).not.toBeInTheDocument()
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

  // The date field and its "Correggi la data" button are gone (owner
  // decision 2026-09-28): the ways out of an age/date conflict are adopting
  // the date's own age, keeping the printed age, or typing a new one — never
  // editing a date field, which the operator never sees.
  describe("age/date conflict: the operator's decision wins (owner decision 2026-09-28)", () => {
    // A printed age (20) that disagrees with the internally read date's own
    // age (24, more than a year off) conflicts until the operator resolves
    // it, one of three ways.
    function conflictingCandidate() {
      return {
        ...baseCandidate,
        ageReading: { value: 20, confidence: 90 },
        confidence: { ...baseCandidate.confidence, dateOfBirth: 95 },
      }
    }

    it("blocks saving until resolved, and never shows a date field", async () => {
      const user = await openReview({
        aggregateConfidence: 95,
        unsuitable: false,
        candidates: [conflictingCandidate()],
      })

      expect(screen.getByLabelText("Età riga line-age-1")).toHaveValue("20")
      expect(
        screen.getByText(
          "Età sul foglio 20, dalla data 24 all’inizio del corso.",
        ),
      ).toBeVisible()
      expect(
        screen.queryByLabelText(/^Data di nascita riga/),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: "Correggi la data" }),
      ).not.toBeInTheDocument()

      await user.click(
        screen.getByRole("button", { name: "Aggiungi 1 allievo" }),
      )
      expect(addStudents).not.toHaveBeenCalled()
    })

    it("Usa l’età dalla data (N) adopts the date’s own age and saves it", async () => {
      const user = await openReview({
        aggregateConfidence: 95,
        unsuitable: false,
        candidates: [conflictingCandidate()],
      })
      const age = screen.getByLabelText("Età riga line-age-1")

      await user.click(
        screen.getByRole("button", { name: "Usa l’età dalla data (24)" }),
      )
      expect(age).toHaveValue("24")
      expect(screen.queryByText(/Età sul foglio/)).not.toBeInTheDocument()

      await user.click(
        screen.getByRole("button", { name: "Aggiungi 1 allievo" }),
      )
      await waitFor(() =>
        expect(addStudents).toHaveBeenCalledWith("course-1", [
          expect.objectContaining({
            dateOfBirth: "",
            declaredAgeAtCourseStart: 24,
          }),
        ]),
      )
    })

    it("Tieni l’età sul foglio (M) keeps the printed age and saves it", async () => {
      const user = await openReview({
        aggregateConfidence: 95,
        unsuitable: false,
        candidates: [conflictingCandidate()],
      })
      const age = screen.getByLabelText("Età riga line-age-1")

      await user.click(
        screen.getByRole("button", { name: "Tieni l’età sul foglio (20)" }),
      )
      expect(age).toHaveValue("20")
      expect(screen.queryByText(/Età sul foglio/)).not.toBeInTheDocument()

      await user.click(
        screen.getByRole("button", { name: "Aggiungi 1 allievo" }),
      )
      await waitFor(() =>
        expect(addStudents).toHaveBeenCalledWith("course-1", [
          expect.objectContaining({
            dateOfBirth: "",
            declaredAgeAtCourseStart: 20,
          }),
        ]),
      )
    })

    it("typing a new age resolves it, with no requirement that it match the date", async () => {
      const user = await openReview({
        aggregateConfidence: 95,
        unsuitable: false,
        candidates: [conflictingCandidate()],
      })
      const age = screen.getByLabelText("Età riga line-age-1")

      await user.clear(age)
      await user.type(age, "30")
      expect(screen.queryByText(/Età sul foglio/)).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: /Usa l’età dalla data/ }),
      ).not.toBeInTheDocument()

      await user.click(
        screen.getByRole("button", { name: "Aggiungi 1 allievo" }),
      )
      await waitFor(() =>
        expect(addStudents).toHaveBeenCalledWith("course-1", [
          expect.objectContaining({
            dateOfBirth: "",
            declaredAgeAtCourseStart: 30,
          }),
        ]),
      )
    })
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
          dateOfBirth: "",
          declaredAgeAtCourseStart: 18,
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

describe("StudentScan per-row swap keeps confidence honest", () => {
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

  it("swaps confidence and acknowledgement with the text instead of clearing both flags", async () => {
    const candidate: StudentScanResult["candidates"][number] = {
      sourceId: "line-1",
      firstName: "Esposito",
      surname: "Giulia",
      dateOfBirth: "2008-03-12",
      phone: "",
      sex: null,
      confidence: { firstName: 92, surname: 50, dateOfBirth: 96, phone: 0 },
    }
    const user = await openReview({
      aggregateConfidence: 90,
      unsuitable: false,
      candidates: [candidate],
    })

    expect(screen.getByLabelText(/^Cognome riga/)).toHaveClass(
      "border-[#f79009]",
    )
    expect(screen.getByLabelText(/^Nome riga/)).not.toHaveClass(
      "border-[#f79009]",
    )

    await user.click(
      screen.getByRole("button", { name: "Scambia nome e cognome riga 1" }),
    )

    expect(screen.getByLabelText(/^Nome riga/)).toHaveValue("Giulia")
    expect(screen.getByLabelText(/^Cognome riga/)).toHaveValue("Esposito")
    // The low-confidence reading moved with its text: it is flagged on the
    // other field now, not silently cleared by the swap.
    expect(screen.getByLabelText(/^Nome riga/)).toHaveClass("border-[#f79009]")
    expect(screen.getByLabelText(/^Cognome riga/)).not.toHaveClass(
      "border-[#f79009]",
    )
  })

  it("keeps an unproven compound split blocked for review after a swap", async () => {
    const compound: StudentScanResult["candidates"][number] = {
      sourceId: "compound",
      firstName: "Rossi",
      surname: "Maria Giulia",
      dateOfBirth: "",
      phone: "",
      sex: null,
      confidence: { firstName: 95, surname: 95, dateOfBirth: 0, phone: 0 },
      nameReading: {
        raw: "Rossi Maria Giulia",
        words: ["Rossi", "Maria", "Giulia"].map((text) => ({
          text,
          confidence: 95,
        })),
        order: "unknown",
        compoundAmbiguity: true,
        acknowledged: false,
      },
    }
    const user = await openReview({
      aggregateConfidence: 90,
      unsuitable: false,
      candidates: [compound],
    })
    expect(screen.getByText(/Nome o cognome composto/)).toBeVisible()

    await user.click(
      screen.getByRole("button", { name: "Scambia nome e cognome riga 1" }),
    )

    // Three words is still an unproven split: a swap only settles a two-word
    // reading, so this row stays blocked.
    expect(screen.getByText(/Nome o cognome composto/)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))
    expect(addStudents).not.toHaveBeenCalled()
  })
})

describe("StudentScan sex suggestion freshness", () => {
  const baseCandidate: StudentScanResult["candidates"][number] = {
    sourceId: "line-1",
    firstName: "Mario",
    surname: "Rossi",
    dateOfBirth: "2008-03-12",
    phone: "",
    sex: "male",
    confidence: { firstName: 95, surname: 95, dateOfBirth: 96, phone: 0 },
  }

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

  it("suggests the sex again from a given name the operator corrects", async () => {
    const user = await openReview({
      aggregateConfidence: 90,
      unsuitable: false,
      candidates: [baseCandidate],
    })
    expect(screen.getByRole("radio", { name: "Uomo" })).toBeChecked()

    const firstName = screen.getByLabelText(/^Nome riga/)
    await user.clear(firstName)
    await user.type(firstName, "Giulia")

    expect(screen.getByRole("radio", { name: "Uomo" })).not.toBeChecked()
    expect(screen.getByRole("radio", { name: "Donna" })).toBeChecked()
  })

  it("clears a stale sex on a per-row swap unless the operator chose it", async () => {
    const user = await openReview({
      aggregateConfidence: 90,
      unsuitable: false,
      candidates: [baseCandidate],
    })
    await user.click(
      screen.getByRole("button", { name: "Scambia nome e cognome riga 1" }),
    )
    expect(screen.getByLabelText(/^Nome riga/)).toHaveValue("Rossi")
    expect(screen.getByRole("radio", { name: "Uomo" })).not.toBeChecked()
  })

  it("never overrides a sex the operator picked, even after editing the name", async () => {
    const user = await openReview({
      aggregateConfidence: 90,
      unsuitable: false,
      candidates: [
        {
          ...baseCandidate,
          sex: null,
          confidence: { ...baseCandidate.confidence, firstName: 40 },
        },
      ],
    })
    await user.click(screen.getByRole("radio", { name: "Altro" }))
    expect(screen.getByRole("radio", { name: "Altro" })).toBeChecked()

    const firstName = screen.getByLabelText(/^Nome riga/)
    await user.clear(firstName)
    await user.type(firstName, "Giulia")

    expect(screen.getByRole("radio", { name: "Altro" })).toBeChecked()
  })

  it("does not clear an existing sex while a blank given name is filled in for the first time", async () => {
    const user = await openReview({
      aggregateConfidence: 90,
      unsuitable: false,
      candidates: [
        {
          ...baseCandidate,
          firstName: "",
          confidence: { ...baseCandidate.confidence, firstName: 0 },
        },
      ],
    })
    const firstName = screen.getByLabelText(/^Nome riga/)
    await user.type(firstName, "Mario")

    expect(screen.getByRole("radio", { name: "Uomo" })).toBeChecked()
  })
})

describe("StudentScan review counter navigation", () => {
  function flaggedRow(id: string): StudentScanResult["candidates"][number] {
    return {
      sourceId: id,
      firstName: "Mario",
      surname: "Rossi",
      dateOfBirth: "2008-03-12",
      phone: "",
      sex: "male",
      confidence: { firstName: 95, surname: 40, dateOfBirth: 96, phone: 0 },
    }
  }

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

  it("never acknowledges a field just by focusing it through the counter", async () => {
    const user = await openReview({
      aggregateConfidence: 90,
      unsuitable: false,
      candidates: [
        flaggedRow("line-1"),
        flaggedRow("line-2"),
        flaggedRow("line-3"),
      ],
    })
    const counters = screen.getByLabelText("Stato revisione scansione")
    const reviewButton = screen.getByRole("button", {
      name: "Vai alla prima riga da controllare",
    })
    expect(within(counters).getByText("3")).toBeVisible()

    for (let tap = 0; tap < 4; tap += 1) {
      await user.click(reviewButton)
      await waitFor(() =>
        expect(screen.getByLabelText(/^Cognome riga line-1-/)).toHaveFocus(),
      )
    }

    expect(within(counters).getByText("3")).toBeVisible()
  })
})

describe("StudentScan unsaved review guard", () => {
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

  it("asks for confirmation before the screen's own Back discards a review in progress", async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(
      <StudentScan
        courseId="course-1"
        courseStartDate="2026-08-29"
        onBack={onBack}
        onCommitted={vi.fn()}
        scan={vi.fn().mockResolvedValue(EXTRACTED)}
      />,
    )
    await user.upload(
      screen.getByLabelText("Scegli foto dell’elenco allievi dalla galleria"),
      new File(["image"], "elenco.png", { type: "image/png" }),
    )
    await user.click(screen.getByRole("button", { name: "Usa questa area" }))
    await screen.findByRole("heading", { name: "Controlla prima di salvare" })

    await user.click(
      screen.getByRole("button", { name: "Indietro da Scan allievi" }),
    )
    expect(onBack).not.toHaveBeenCalled()
    expect(
      screen.getByText("Scartare la revisione di 2 allievi?"),
    ).toBeVisible()

    await user.click(
      screen.getByRole("button", { name: "Continua la revisione" }),
    )
    expect(onBack).not.toHaveBeenCalled()
    expect(
      screen.queryByText("Scartare la revisione di 2 allievi?"),
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: "Indietro da Scan allievi" }),
    )
    await user.click(screen.getByRole("button", { name: "Scarta" }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it("holds a foreign navigation request (bottom nav or phone Back) the same way", async () => {
    const user = userEvent.setup()
    render(
      <StudentScan
        courseId="course-1"
        courseStartDate="2026-08-29"
        onBack={vi.fn()}
        onCommitted={vi.fn()}
        scan={vi.fn().mockResolvedValue(EXTRACTED)}
      />,
    )
    await user.upload(
      screen.getByLabelText("Scegli foto dell’elenco allievi dalla galleria"),
      new File(["image"], "elenco.png", { type: "image/png" }),
    )
    await user.click(screen.getByRole("button", { name: "Usa questa area" }))
    await screen.findByRole("heading", { name: "Controlla prima di salvare" })

    const leave = vi.fn()
    act(() => {
      requestLeave(leave)
    })
    expect(leave).not.toHaveBeenCalled()
    expect(
      screen.getByText("Scartare la revisione di 2 allievi?"),
    ).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Scarta" }))
    expect(leave).toHaveBeenCalledOnce()
  })

  it("asks before replacing rows with another image, and only opens the picker once confirmed", async () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click")
    const user = await openReview(EXTRACTED)
    clickSpy.mockClear()

    await user.click(
      screen.getByRole("button", { name: "Scegli un’altra immagine" }),
    )
    expect(clickSpy).not.toHaveBeenCalled()
    expect(
      screen.getByText("Scartare la revisione di 2 allievi?"),
    ).toBeVisible()

    await user.click(
      screen.getByRole("button", { name: "Continua la revisione" }),
    )
    expect(screen.getByLabelText(/^Nome riga line-1-1$/)).toHaveValue("Mario")

    await user.click(
      screen.getByRole("button", { name: "Scegli un’altra immagine" }),
    )
    await user.click(screen.getByRole("button", { name: "Scarta" }))
    expect(clickSpy).toHaveBeenCalled()

    clickSpy.mockRestore()
  })

  it("does not ask again after a successful save", async () => {
    const onCommitted = vi.fn()
    const user = userEvent.setup()
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
    await user.click(
      await screen.findByRole("button", { name: "Aggiungi 1 allievo" }),
    )
    await waitFor(() => expect(onCommitted).toHaveBeenCalledOnce())

    const leave = vi.fn()
    act(() => {
      requestLeave(leave)
    })
    expect(leave).toHaveBeenCalledOnce()
    expect(screen.queryByText(/Scartare la revisione/)).not.toBeInTheDocument()
  })
})

describe("StudentScan row warnings", () => {
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

  it.each([
    ["possible-staff", "Forse personale e non un allievo"],
    ["possible-merged-rows", "Forse due righe lette insieme"],
  ] as const)(
    "keeps a %s row to review until it is marked checked",
    async (rowWarning, text) => {
      const user = await openReview({
        aggregateConfidence: 90,
        unsuitable: false,
        candidates: [
          {
            sourceId: "line-1",
            firstName: "Marta",
            surname: "Veldor",
            dateOfBirth: "2010-03-12",
            phone: "",
            sex: "female",
            confidence: {
              firstName: 95,
              surname: 95,
              dateOfBirth: 95,
              phone: 0,
            },
            rowWarning,
          },
        ],
      })
      expect(screen.getByText(new RegExp(text))).toBeVisible()
      const counters = screen.getByLabelText("Stato revisione scansione")
      expect(within(counters).getAllByText("1")).not.toHaveLength(0)

      await user.click(
        screen.getByRole("button", {
          name: "Segna controllata la riga di allievo 1",
        }),
      )
      expect(screen.queryByText(new RegExp(text))).not.toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /Aggiungi 1 allievo/ }),
      ).toBeEnabled()
    },
  )
})

/**
 * V05: the assistant path. The idle screen offers a second, non-networked way
 * in; a well-formed answer opens the same review a scan would, a malformed
 * line is reported and fixable in place, and an answer outside the stated
 * format never silently becomes a student.
 */
describe("StudentScan assistant paste", () => {
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
    Reflect.deleteProperty(navigator, "clipboard")
  })

  async function openAssistant() {
    const user = userEvent.setup()
    render(
      <StudentScan
        courseId="course-1"
        courseStartDate="2026-08-29"
        onBack={vi.fn()}
        onCommitted={vi.fn()}
      />,
    )
    await user.click(
      screen.getByRole("button", { name: "Oppure usa un assistente" }),
    )
    return user
  }

  function fillAnswer(text: string) {
    fireEvent.change(screen.getByLabelText("Risposta dell’assistente"), {
      target: { value: text },
    })
  }

  it("shows the camera choice before the assistant section", () => {
    render(
      <StudentScan
        courseId="course-1"
        courseStartDate="2026-08-29"
        onBack={vi.fn()}
        onCommitted={vi.fn()}
      />,
    )
    const buttons = screen.getAllByRole("button")
    const cameraIndex = buttons.findIndex(
      (button) => button.textContent === "Fai una foto",
    )
    const assistantIndex = buttons.findIndex(
      (button) => button.textContent === "Oppure usa un assistente",
    )
    expect(cameraIndex).toBeGreaterThanOrEqual(0)
    expect(assistantIndex).toBeGreaterThan(cameraIndex)
  })

  it("copies the prompt to the clipboard in one tap and reports success", async () => {
    // Set up after userEvent's own setup(): it attaches its own clipboard
    // stub to the shared jsdom window when it runs, which would otherwise
    // shadow a mock installed beforehand.
    const user = await openAssistant()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    expect(
      screen.getByRole("button", { name: "Leggi risposta" }),
    ).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Copia istruzioni" }))

    expect(writeText).toHaveBeenCalledWith(ROSTER_PASTE_PROMPT)
    expect(screen.getByRole("button", { name: "Copiate" })).toBeVisible()
    // The multi-line prompt would otherwise fail this query for an unrelated
    // reason: the library's default normalizer collapses the node's own
    // whitespace before comparing but leaves a string matcher untouched.
    expect(
      screen.queryByDisplayValue(ROSTER_PASTE_PROMPT, {
        normalizer: (text) => text,
      }),
    ).not.toBeInTheDocument()
  })

  // Review fix: the phone copy-button advice is for the operator, so it must
  // appear beside the paste box itself, not inside the text the assistant
  // reads (already covered in rosterPaste.test.ts).
  it("shows the phone copy-button advice beside the paste box, not in the copied prompt", async () => {
    await openAssistant()
    expect(screen.getByText(/tasto copia del blocco di codice/)).toBeVisible()
    expect(ROSTER_PASTE_PROMPT).not.toContain("tasto copia del blocco")
  })

  it("keeps the prompt on screen, selectable, when the clipboard is unavailable", async () => {
    const user = await openAssistant()
    Reflect.deleteProperty(navigator, "clipboard")

    await user.click(screen.getByRole("button", { name: "Copia istruzioni" }))

    expect(
      screen.getByRole("button", { name: "Copia istruzioni" }),
    ).toBeVisible()
    const fallback = screen.getByDisplayValue(ROSTER_PASTE_PROMPT, {
      normalizer: (text) => text,
    })
    expect(fallback).toHaveAttribute("readonly")
  })

  it("reads a well-formed answer into the same review, trusted without a per-row check, and saves", async () => {
    const user = await openAssistant()
    fillAnswer(
      [
        ROSTER_PASTE_BEGIN,
        ROSTER_PASTE_HEADER,
        "Bianchi;Sara;12/04/2011;;",
        "Verdi;Luca;13/03/2010;;",
        ROSTER_PASTE_END,
      ].join("\n"),
    )
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))

    expect(
      await screen.findByRole("heading", {
        name: "Controlla prima di salvare",
      }),
    ).toBeVisible()
    // No name-order question: the columns already say which word is which.
    expect(screen.queryByLabelText("Ordine dei nomi")).not.toBeInTheDocument()
    expect(screen.queryByText("Letto:")).not.toBeInTheDocument()
    // The owner checks the pasted rows (owner decision 2026-09-28): no row
    // needs its own Controlla tap, and both are ready without one.
    expect(
      screen.queryByText(/Riga scritta dall.assistente/),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(
        /Letti 2 allievi dalla risposta: sono tutti quelli del foglio\?/,
      ),
    ).toBeVisible()
    const counters = screen.getByLabelText("Stato revisione scansione")
    // Only the pending completeness confirmation is left to review.
    expect(within(counters).getByText("1")).toBeVisible()
    expect(within(counters).getByText("0")).toBeVisible()
    expect(within(counters).getByText("2")).toBeVisible()
    expect(addStudents).not.toHaveBeenCalled()

    // Nothing but the sheet's completeness confirmation stands between two
    // trusted rows and saving.
    await user.click(screen.getByRole("button", { name: "Aggiungi 2 allievi" }))
    expect(addStudents).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Sono tutti" }))
    await user.click(screen.getByRole("button", { name: "Aggiungi 2 allievi" }))

    await waitFor(() =>
      expect(addStudents).toHaveBeenCalledWith("course-1", [
        expect.objectContaining({ firstName: "Sara", surname: "Bianchi" }),
        expect.objectContaining({ firstName: "Luca", surname: "Verdi" }),
      ]),
    )
  })

  it("reports a malformed line on its own and adds it once fixed in place", async () => {
    const user = await openAssistant()
    fillAnswer(
      [
        ROSTER_PASTE_BEGIN,
        ROSTER_PASTE_HEADER,
        "Bianchi;Sara;12/04/2011;;",
        "Verdi;Luca;31/13/2010;;",
        ROSTER_PASTE_END,
      ].join("\n"),
    )
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))

    expect(
      await screen.findByRole("heading", {
        name: "Controlla prima di salvare",
      }),
    ).toBeVisible()
    expect(
      screen.getByRole("heading", { name: "Righe non lette (1)" }),
    ).toBeVisible()
    expect(
      screen.getByText("data di nascita non valida (GG/MM/AAAA)"),
    ).toBeVisible()

    const lineInput = screen.getByLabelText("Testo riga 4")
    expect(lineInput).toHaveValue("Verdi;Luca;31/13/2010;;")
    await user.clear(lineInput)
    await user.type(lineInput, "Verdi;Luca;13/03/2010;;")
    await user.click(screen.getByRole("button", { name: "Rileggi riga" }))

    expect(
      screen.queryByRole("heading", { name: /Righe non lette/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Nome riga paste-4/)).toHaveValue("Luca")
  })

  it("stays on the paste screen with an error when the answer is not in the requested format", async () => {
    const user = await openAssistant()
    const answer = "Ciao, ecco l'elenco: Mario Rossi, 12 anni"
    fillAnswer(answer)
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))

    expect(screen.getByText(/non è nel formato richiesto/)).toBeVisible()
    expect(
      screen.queryByRole("heading", { name: "Controlla prima di salvare" }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText("Risposta dell’assistente")).toHaveValue(
      answer,
    )
    expect(addStudents).not.toHaveBeenCalled()
  })

  // V05 review V5R2-7: a small header deviation must not leave the operator
  // guessing what the app actually wanted, or what it made of the lines it
  // read instead.
  it("names the expected header and lists the parser's own reasons when no header is found", async () => {
    const user = await openAssistant()
    fillAnswer(["Mario Rossi 12/03/2010", "Anna Bianchi 14/05/2011"].join("\n"))
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))

    const alert = screen.getByRole("alert")
    expect(alert.textContent).toContain(ROSTER_PASTE_HEADER)
    expect(
      screen.getByText(
        "Riga 1: fuori dal formato: manca la riga di intestazione",
      ),
    ).toBeVisible()
    expect(
      screen.getByText(
        "Riga 2: fuori dal formato: manca la riga di intestazione",
      ),
    ).toBeVisible()
    expect(
      screen.queryByRole("heading", { name: "Controlla prima di salvare" }),
    ).not.toBeInTheDocument()
  })

  // V05 review V5R2-10/tooLong: a runaway answer is refused whole, with its
  // own message, rather than either read in part or reported line by line.
  it("keeps the pasted text and names the limit when the answer has too many rows", async () => {
    const user = await openAssistant()
    const rows = Array.from(
      { length: ROSTER_PASTE_MAX_ROWS + 1 },
      (_, index) => `Rossi;Anna${index};12/03/2010;;`,
    )
    const answer = [
      ROSTER_PASTE_BEGIN,
      ROSTER_PASTE_HEADER,
      ...rows,
      ROSTER_PASTE_END,
    ].join("\n")
    fillAnswer(answer)
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))

    expect(
      screen.getByText(
        `Risposta troppo lunga: più di ${ROSTER_PASTE_MAX_ROWS} righe. Controlla l’assistente e incolla di nuovo.`,
      ),
    ).toBeVisible()
    expect(
      screen.queryByRole("heading", { name: "Controlla prima di salvare" }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText("Risposta dell’assistente")).toHaveValue(
      answer,
    )
    expect(addStudents).not.toHaveBeenCalled()
  })

  it("warns when the answer is missing its closing FINE line", async () => {
    const user = await openAssistant()
    fillAnswer(
      [
        ROSTER_PASTE_BEGIN,
        ROSTER_PASTE_HEADER,
        "Bianchi;Sara;12/04/2011;;",
      ].join("\n"),
    )
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))

    // The single row is not trusted without FINE (it moves to the unread
    // lines instead), so nothing has been read yet.
    expect(
      await screen.findByText(
        /La risposta sembra interrotta: manca la riga FINE\. Letti 0 allievi dalla risposta: sono tutti quelli del foglio\?/,
      ),
    ).toBeVisible()
  })

  // V05 review V5-1 (blocker): the phone keyboard's own Invio/Vai key inside
  // an unread line's input must fix that line in place, never submit the
  // whole roster and silently drop every other unread line.
  it("runs Rileggi riga instead of submitting the roster when Enter is pressed in an unread line", async () => {
    const user = await openAssistant()
    fillAnswer(
      [
        ROSTER_PASTE_BEGIN,
        ROSTER_PASTE_HEADER,
        "Veldor;Marta;12/03/2010;16;",
        // No age here (F2R-2): a printed age would otherwise win outright and
        // the bad date would never even be checked, leaving nothing unread
        // for this test to fix.
        "Neri;Paolo;31/02/2011;;",
        ROSTER_PASTE_END,
      ].join("\n"),
    )
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))
    await screen.findByRole("heading", { name: "Controlla prima di salvare" })

    const lineInput = screen.getByLabelText("Testo riga 4")
    await user.clear(lineInput)
    await user.type(lineInput, "Neri;Paolo;28/02/2011;15;{Enter}")

    expect(
      screen.queryByRole("heading", { name: /Righe non lette/ }),
    ).not.toBeInTheDocument()
    // The fix ran and added the second row (its name field is visible)
    // rather than losing it, and neither row needs its own check.
    expect(screen.getByLabelText(/^Nome riga paste-4/)).toHaveValue("Paolo")
    // The fix ran, but nothing was saved: Enter never reached the form.
    expect(addStudents).not.toHaveBeenCalled()
  })

  // Age only, in every mode (owner decision 2026-09-28): the paste is
  // trusted, so a printed age always wins over a disagreeing date, with no
  // conflict banner and no date field ever shown for it.
  it("takes the printed age over the pasted date without ever showing the date", async () => {
    const user = await openAssistant()
    fillAnswer(
      [
        ROSTER_PASTE_BEGIN,
        ROSTER_PASTE_HEADER,
        "Veldor;Marta;12/03/2010;16;",
        ROSTER_PASTE_END,
      ].join("\n"),
    )
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))
    await screen.findByRole("heading", { name: "Controlla prima di salvare" })

    expect(screen.getByLabelText(/^Età riga/)).toHaveValue("16")
    expect(
      screen.queryByLabelText(/^Data di nascita riga/),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Sono tutti" }))
    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))
    await waitFor(() =>
      expect(addStudents).toHaveBeenCalledWith("course-1", [
        expect.objectContaining({
          dateOfBirth: "",
          declaredAgeAtCourseStart: 16,
        }),
      ]),
    )
  })

  // V05 review V5-3: every remaining unread line counts as a row still to
  // review, and once no candidate needs a look the counter sends the
  // operator to the first unread line instead of doing nothing.
  it("counts an unread line and the pending confirmation among rows to review, since the read row needs no check", async () => {
    const user = await openAssistant()
    fillAnswer(
      [
        ROSTER_PASTE_BEGIN,
        ROSTER_PASTE_HEADER,
        "Bianchi;Sara;12/04/2011;;",
        "Verdi;Luca;31/13/2010;;",
        ROSTER_PASTE_END,
      ].join("\n"),
    )
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))
    await screen.findByRole("heading", { name: "Controlla prima di salvare" })

    const reviewButton = screen.getByRole("button", {
      name: "Vai alla prima riga da controllare",
    })
    const rowsToReview = () => reviewButton.querySelector("strong")?.textContent
    // The one row read cleanly is trusted and needs no check of its own: only
    // the unread line and the pending completeness confirmation count here
    // (V05 review V5R2-3).
    expect(rowsToReview()).toBe("2")

    await user.click(reviewButton)
    await waitFor(() =>
      expect(screen.getByLabelText("Testo riga 4")).toHaveFocus(),
    )
  })

  it("blocks saving while an unread line remains, until it is fixed or left out", async () => {
    const user = await openAssistant()
    fillAnswer(
      [
        ROSTER_PASTE_BEGIN,
        ROSTER_PASTE_HEADER,
        "Bianchi;Sara;12/04/2011;;",
        "Verdi;Luca;31/13/2010;;",
        ROSTER_PASTE_END,
      ].join("\n"),
    )
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))
    await screen.findByRole("heading", { name: "Controlla prima di salvare" })

    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))
    expect(addStudents).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Lascia fuori" }))
    expect(
      screen.queryByRole("heading", { name: /Righe non lette/ }),
    ).not.toBeInTheDocument()

    // No unread line remains, but the sheet's completeness is still
    // unconfirmed: saving must stay blocked (V05 review V5R2-3).
    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))
    expect(addStudents).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Sono tutti" }))
    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))
    await waitFor(() => expect(addStudents).toHaveBeenCalled())
  })

  it("requires confirming the sheet's completeness before an interrupted answer can be saved", async () => {
    const user = await openAssistant()
    fillAnswer(
      [
        ROSTER_PASTE_BEGIN,
        ROSTER_PASTE_HEADER,
        "Bianchi;Sara;12/04/2011;;",
        "Verdi;Luca;13/03/2010;;",
      ].join("\n"),
    )
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))
    await screen.findByText(/risposta sembra interrotta/)
    // The truncated last line is moved to the unread lines; leave it out so
    // only the acknowledgement is left standing between here and saving.
    await user.click(screen.getByRole("button", { name: "Lascia fuori" }))

    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))
    expect(addStudents).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Sono tutti" }))
    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))
    await waitFor(() => expect(addStudents).toHaveBeenCalled())
  })

  // V05 review V5F-1: a count given while a line is still unread would cover
  // a number that is about to change, so the confirmation must stay
  // unanswerable until none remain, then become answerable and still
  // required.
  it("disables Sono tutti while an unread line is pending, and enables it once resolved", async () => {
    const user = await openAssistant()
    fillAnswer(
      [
        ROSTER_PASTE_BEGIN,
        ROSTER_PASTE_HEADER,
        "Bianchi;Sara;12/04/2011;;",
        "Verdi;Luca;31/13/2010;;",
        ROSTER_PASTE_END,
      ].join("\n"),
    )
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))
    await screen.findByRole("heading", { name: "Righe non lette (1)" })

    const confirmButton = screen.getByRole("button", { name: "Sono tutti" })
    expect(confirmButton).toBeDisabled()
    expect(screen.getByText("Prima decidi le righe non lette.")).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Lascia fuori" }))

    expect(confirmButton).toBeEnabled()
    expect(
      screen.queryByText("Prima decidi le righe non lette."),
    ).not.toBeInTheDocument()
    // Still required: leaving out the line answers nothing on its own.
    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))
    expect(addStudents).not.toHaveBeenCalled()
  })

  // V05 review V5F-1: a confirmation given for N rows must not silently keep
  // covering a different N once a pasted row is removed from underneath it.
  it("asks again, for the new count, after a pasted row is removed once already confirmed", async () => {
    const user = await openAssistant()
    fillAnswer(
      [
        ROSTER_PASTE_BEGIN,
        ROSTER_PASTE_HEADER,
        "Bianchi;Sara;12/04/2011;;",
        "Verdi;Luca;13/03/2010;;",
        ROSTER_PASTE_END,
      ].join("\n"),
    )
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))
    await screen.findByRole("heading", { name: "Controlla prima di salvare" })

    await user.click(screen.getByRole("button", { name: "Sono tutti" }))
    expect(
      screen.queryByText(/sono tutti quelli del foglio\?/),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Rimuovi allievo 2" }))

    expect(
      screen.getByText(
        "Letti 1 allievo dalla risposta: sono tutti quelli del foglio?",
      ),
    ).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))
    expect(addStudents).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Sono tutti" }))
    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))
    await waitFor(() => expect(addStudents).toHaveBeenCalled())
  })

  // V05 review V5-6: after an import the operator can still get back to
  // exactly what they pasted, through the same discard question as any other
  // way of losing the review in progress.
  it("returns to the pasted answer, unchanged, after the discard question is confirmed", async () => {
    const user = await openAssistant()
    const answer = [
      ROSTER_PASTE_BEGIN,
      ROSTER_PASTE_HEADER,
      "Bianchi;Sara;12/04/2011;;",
      "Verdi;Luca;31/13/2010;;",
      ROSTER_PASTE_END,
    ].join("\n")
    fillAnswer(answer)
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))
    await screen.findByRole("heading", { name: "Righe non lette (1)" })

    await user.click(
      screen.getByRole("button", { name: "Torna alla risposta" }),
    )
    expect(screen.getByText(/^Scartare/)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Scarta" }))

    expect(
      screen.queryByRole("heading", { name: "Controlla prima di salvare" }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText("Risposta dell’assistente")).toHaveValue(
      answer,
    )
  })

  // V05 review V5-11: an import that reads no rows at all must not claim the
  // operator removed them, and a line fixed in place lands at its own
  // position in the sheet rather than at the end.
  it("shows a paste-specific message, not the removed-rows one, when an import reads no rows", async () => {
    const user = await openAssistant()
    fillAnswer(
      [
        ROSTER_PASTE_BEGIN,
        ROSTER_PASTE_HEADER,
        "123;456;;;",
        ROSTER_PASTE_END,
      ].join("\n"),
    )
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))
    await screen.findByRole("heading", { name: "Righe non lette (1)" })

    expect(
      screen.getByText(/Nessun allievo letto dalla risposta/),
    ).toBeVisible()
    expect(
      screen.queryByText(/Hai rimosso tutte le righe/),
    ).not.toBeInTheDocument()
  })

  it("inserts a line fixed in place at its own position in the sheet, not at the end", async () => {
    const user = await openAssistant()
    fillAnswer(
      [
        ROSTER_PASTE_BEGIN,
        ROSTER_PASTE_HEADER,
        "Bianchi;Sara;12/04/2011;;",
        "Verdi;Luca;31/13/2010;;",
        "Neri;Anna;14/05/2012;;",
        ROSTER_PASTE_END,
      ].join("\n"),
    )
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))
    await screen.findByRole("heading", { name: "Righe non lette (1)" })

    const lineInput = screen.getByLabelText("Testo riga 4")
    await user.clear(lineInput)
    await user.type(lineInput, "Verdi;Luca;13/03/2010;;")
    await user.click(screen.getByRole("button", { name: "Rileggi riga" }))

    const surnames = screen
      .getAllByLabelText(/^Cognome riga/)
      .map((input) => (input as HTMLInputElement).value)
    expect(surnames).toEqual(["Bianchi", "Verdi", "Neri"])
  })

  // V05 review V5-5: two rows in the same pasted answer with the same
  // normalized name and the same date/age are almost certainly one student
  // copied twice, not two people who happen to share a name.
  it("flags a repeated row in the same batch as a possible duplicate until it is resolved", async () => {
    const user = await openAssistant()
    fillAnswer(
      [
        ROSTER_PASTE_BEGIN,
        ROSTER_PASTE_HEADER,
        "Veldor;Marta;12/03/2010;16;",
        "Veldor;Marta;12/03/2010;16;",
        ROSTER_PASTE_END,
      ].join("\n"),
    )
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))
    await screen.findByRole("heading", { name: "Controlla prima di salvare" })

    expect(screen.getByText(/Possibile doppione di Marta Veldor/)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Aggiungi 2 allievi" }))
    expect(addStudents).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Tieni entrambi" }))
    // The duplicate is resolved but the sheet's completeness is still
    // unconfirmed: saving must stay blocked (V05 review V5R2-3).
    await user.click(screen.getByRole("button", { name: "Aggiungi 2 allievi" }))
    expect(addStudents).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Sono tutti" }))
    await user.click(screen.getByRole("button", { name: "Aggiungi 2 allievi" }))
    await waitFor(() => expect(addStudents).toHaveBeenCalled())
  })

  // Age only, in every mode (owner decision 2026-09-28): the paste is
  // trusted, so a printed age wins over a disagreeing date outright, with no
  // conflict to explain and no "Correggi la data" button, since the date
  // field itself is gone from the review.
  it("takes the printed age over a disagreeing pasted date, with no conflict shown", async () => {
    const user = await openAssistant()
    fillAnswer(
      [
        ROSTER_PASTE_BEGIN,
        ROSTER_PASTE_HEADER,
        "Veldor;Marta;12/03/2010;15;",
        ROSTER_PASTE_END,
      ].join("\n"),
    )
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))
    await screen.findByRole("heading", { name: "Controlla prima di salvare" })

    expect(screen.queryByText(/Età sul foglio/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Usa l’età dalla data" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Correggi la data" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/^Data di nascita riga/),
    ).not.toBeInTheDocument()
    const age = screen.getByLabelText(/^Età riga/)
    expect(age).toHaveValue("15")

    await user.click(screen.getByRole("button", { name: "Sono tutti" }))
    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))
    await waitFor(() =>
      expect(addStudents).toHaveBeenCalledWith("course-1", [
        expect.objectContaining({
          dateOfBirth: "",
          declaredAgeAtCourseStart: 15,
        }),
      ]),
    )
  })

  // V05 review V5R2-2: a save refused only for a paste reason (an unread line
  // left, or the completeness confirmation not given) must say so, on the
  // element the operator needs to act on, rather than doing nothing visible.
  it("focuses the first unread line and announces the refusal when that is the only reason save is blocked", async () => {
    const user = await openAssistant()
    fillAnswer(
      [
        ROSTER_PASTE_BEGIN,
        ROSTER_PASTE_HEADER,
        "Bianchi;Sara;12/04/2011;;",
        "Verdi;Luca;31/13/2010;;",
        ROSTER_PASTE_END,
      ].join("\n"),
    )
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))
    await screen.findByRole("heading", { name: "Controlla prima di salvare" })

    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))

    await waitFor(() =>
      expect(screen.getByLabelText("Testo riga 4")).toHaveFocus(),
    )
    expect(
      screen.getByText(
        "Salvataggio bloccato: correggi o lascia fuori la riga non letta 4.",
      ),
    ).toBeVisible()
    expect(addStudents).not.toHaveBeenCalled()
  })

  it("focuses the completeness confirmation and announces the refusal when that is the only reason save is blocked", async () => {
    const user = await openAssistant()
    fillAnswer(
      [
        ROSTER_PASTE_BEGIN,
        ROSTER_PASTE_HEADER,
        "Bianchi;Sara;12/04/2011;;",
        ROSTER_PASTE_END,
      ].join("\n"),
    )
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))
    await screen.findByRole("heading", { name: "Controlla prima di salvare" })

    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sono tutti" })).toHaveFocus(),
    )
    expect(
      screen.getByText(
        "Salvataggio bloccato: conferma se sono tutti gli allievi del foglio.",
      ),
    ).toBeVisible()
    expect(addStudents).not.toHaveBeenCalled()
  })

  // V05 review V5R2-5: the way back to the pasted text is always available,
  // the empty message matches what is actually on screen, the discard
  // heading never degrades to "Scartare ?", and Back asks before dropping a
  // review that read nothing at all.
  it("always offers a way back to the pasted answer, and Back asks before dropping an empty paste review", async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(
      <StudentScan
        courseId="course-1"
        courseStartDate="2026-08-29"
        onBack={onBack}
        onCommitted={vi.fn()}
      />,
    )
    await user.click(
      screen.getByRole("button", { name: "Oppure usa un assistente" }),
    )
    const answer = [
      ROSTER_PASTE_BEGIN,
      ROSTER_PASTE_HEADER,
      ROSTER_PASTE_END,
    ].join("\n")
    fireEvent.change(screen.getByLabelText("Risposta dell’assistente"), {
      target: { value: answer },
    })
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))
    await screen.findByRole("heading", { name: "Controlla prima di salvare" })

    expect(
      screen.getByText(
        "Nessun allievo letto dalla risposta. Torna alla risposta per correggerla.",
      ),
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Torna alla risposta" }),
    ).toBeVisible()

    await user.click(
      screen.getByRole("button", { name: "Indietro da Scan allievi" }),
    )
    expect(onBack).not.toHaveBeenCalled()
    expect(
      screen.getByText("Scartare la risposta dell’assistente?"),
    ).toBeVisible()

    await user.click(
      screen.getByRole("button", { name: "Continua la revisione" }),
    )
    expect(onBack).not.toHaveBeenCalled()
    expect(
      screen.getByRole("heading", { name: "Controlla prima di salvare" }),
    ).toBeVisible()

    await user.click(
      screen.getByRole("button", { name: "Indietro da Scan allievi" }),
    )
    await user.click(screen.getByRole("button", { name: "Scarta" }))
    expect(onBack).toHaveBeenCalledOnce()
  })
})

/**
 * V05 review V5-4: leaving the screen, retaking the photo or choosing another
 * image must ask before discarding a review that holds only unread lines and
 * no candidate row yet, and the question must name those unread lines.
 */
describe("StudentScan assistant paste unread-line guard", () => {
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

  async function openWithOnlyUnreadLines(onBack: () => void) {
    const user = userEvent.setup()
    render(
      <StudentScan
        courseId="course-1"
        courseStartDate="2026-08-29"
        onBack={onBack}
        onCommitted={vi.fn()}
      />,
    )
    await user.click(
      screen.getByRole("button", { name: "Oppure usa un assistente" }),
    )
    fireEvent.change(screen.getByLabelText("Risposta dell’assistente"), {
      target: {
        value: [
          ROSTER_PASTE_BEGIN,
          ROSTER_PASTE_HEADER,
          "123;456;;;",
          ROSTER_PASTE_END,
        ].join("\n"),
      },
    })
    await user.click(screen.getByRole("button", { name: "Leggi risposta" }))
    await screen.findByRole("heading", { name: "Righe non lette (1)" })
    return user
  }

  it("guards the screen's own Back when only unread lines remain", async () => {
    const onBack = vi.fn()
    const user = await openWithOnlyUnreadLines(onBack)

    await user.click(
      screen.getByRole("button", { name: "Indietro da Scan allievi" }),
    )
    expect(onBack).not.toHaveBeenCalled()
    expect(screen.getByText(/riga non letta/)).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Scarta" }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it("guards retaking or replacing the image when only unread lines remain", async () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click")
    const user = await openWithOnlyUnreadLines(vi.fn())
    clickSpy.mockClear()

    await user.click(
      screen.getByRole("button", { name: "Scegli un’altra immagine" }),
    )
    expect(clickSpy).not.toHaveBeenCalled()
    expect(screen.getByText(/riga non letta/)).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Scarta" }))
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })
})

/**
 * V05 review V5-5: a scanned or pasted row that matches an existing student
 * of the course by name and date of birth (or age) is flagged the same way as
 * a batch duplicate, from a new `existingStudents` prop `StudentManagement`
 * passes the course's current roster through.
 */
describe("StudentScan existing-student duplicates", () => {
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

  it("flags a scanned row that matches an existing student by name and date of birth", async () => {
    const user = userEvent.setup()
    render(
      <StudentScan
        courseId="course-1"
        courseStartDate="2026-08-29"
        existingStudents={[
          {
            id: "s1",
            courseId: "course-1",
            firstName: "Marta",
            surname: "Veldor",
            nickname: null,
            dateOfBirth: "2010-03-12",
            declaredAgeAtCourseStart: null,
            sex: "female",
            phone: null,
            size: null,
            initialNote: null,
            courseNote: null,
            active: 1,
          },
        ]}
        onBack={vi.fn()}
        onCommitted={vi.fn()}
        scan={vi.fn().mockResolvedValue({
          aggregateConfidence: 92,
          unsuitable: false,
          candidates: [
            {
              sourceId: "line-1",
              firstName: "Marta",
              surname: "Veldor",
              dateOfBirth: "2010-03-12",
              phone: "",
              sex: "female",
              confidence: {
                firstName: 96,
                surname: 96,
                dateOfBirth: 96,
                phone: 0,
              },
            },
          ],
        })}
      />,
    )
    await user.upload(
      screen.getByLabelText("Scegli foto dell’elenco allievi dalla galleria"),
      new File(["image"], "elenco.png", { type: "image/png" }),
    )
    await user.click(screen.getByRole("button", { name: "Usa questa area" }))
    await screen.findByRole("heading", { name: "Controlla prima di salvare" })

    expect(screen.getByText(/Possibile doppione di Marta Veldor/)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))
    expect(addStudents).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Tieni entrambi" }))
    await user.click(screen.getByRole("button", { name: "Aggiungi 1 allievo" }))
    await waitFor(() => expect(addStudents).toHaveBeenCalled())
  })
})
