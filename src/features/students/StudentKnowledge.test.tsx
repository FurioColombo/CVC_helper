import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/students", () => ({
  updateStudentKnowledge: vi.fn(),
}))

import { StudentKnowledge } from "@/features/students/StudentKnowledge"
import type {
  SpeechTranscriptionOptions,
  SpeechTranscriptionProgress,
} from "@/capabilities/speech"
import {
  updateStudentKnowledge,
  type StudentRecord,
} from "@/persistence/students"

const MARIO: StudentRecord = {
  id: "student-1",
  courseId: "course-1",
  firstName: "Mario",
  surname: "Rossi",
  nickname: null,
  dateOfBirth: "2010-01-01",
  declaredAgeAtCourseStart: null,
  sex: "male",
  phone: null,
  size: null,
  initialNote: null,
  courseNote: null,
  active: 1,
}

const saveKnowledge = vi.mocked(updateStudentKnowledge)
const originalMediaDevices = navigator.mediaDevices

describe("StudentKnowledge", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saveKnowledge.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    })
  })

  it("autosaves canonical size and the optional initial note", async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(
      <StudentKnowledge
        courseId="course-1"
        onBack={vi.fn()}
        onSaved={onSaved}
        students={[MARIO]}
      />,
    )

    await user.click(
      within(screen.getByRole("group", { name: "Taglia di Mario" })).getByRole(
        "button",
        { name: "L" },
      ),
    )
    await waitFor(() =>
      expect(saveKnowledge).toHaveBeenCalledWith("student-1", "course-1", {
        size: "L",
        initialNote: null,
      }),
    )

    await user.click(screen.getByRole("button", { name: "Nota di Mario" }))
    await user.type(
      screen.getByLabelText("Nota iniziale di Mario"),
      "Esperienza Optimist",
    )
    await waitFor(
      () =>
        expect(saveKnowledge).toHaveBeenLastCalledWith(
          "student-1",
          "course-1",
          {
            size: "L",
            initialNote: "Esperienza Optimist",
          },
        ),
      { timeout: 1_500 },
    )
    expect(onSaved).toHaveBeenLastCalledWith("student-1", {
      size: "L",
      initialNote: "Esperienza Optimist",
    })
  })

  it("keeps keyboard focus inside the note dialog", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    })
    vi.stubGlobal("MediaRecorder", class {})
    const user = userEvent.setup()
    render(
      <StudentKnowledge
        courseId="course-1"
        onBack={vi.fn()}
        onSaved={vi.fn()}
        students={[MARIO]}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Nota di Mario" }))
    const note = screen.getByLabelText("Nota iniziale di Mario")
    const dictate = screen.getByRole("button", { name: "Detta nota di Mario" })
    const done = screen.getByRole("button", { name: "Fine" })
    const close = screen.getByRole("button", { name: "Chiudi nota di Mario" })

    expect(note).toHaveFocus()
    await user.tab()
    expect(dictate).toHaveFocus()
    await user.tab()
    expect(done).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(done).toHaveFocus()
  })

  it("serializes rapid changes so the latest knowledge wins", async () => {
    let resolveFirst: (() => void) | undefined
    saveKnowledge
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => (resolveFirst = resolve)),
      )
      .mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    render(
      <StudentKnowledge
        courseId="course-1"
        onBack={vi.fn()}
        onSaved={vi.fn()}
        students={[MARIO]}
      />,
    )

    await user.click(
      within(screen.getByRole("group", { name: "Taglia di Mario" })).getByRole(
        "button",
        { name: "L" },
      ),
    )
    await waitFor(() => expect(saveKnowledge).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole("button", { name: "Nota di Mario" }))
    await user.type(screen.getByLabelText("Nota iniziale di Mario"), "Ultima")
    await new Promise((resolve) => setTimeout(resolve, 550))
    expect(saveKnowledge).toHaveBeenCalledTimes(1)

    resolveFirst?.()
    await waitFor(() => expect(saveKnowledge).toHaveBeenCalledTimes(2))
    expect(saveKnowledge).toHaveBeenLastCalledWith("student-1", "course-1", {
      size: "L",
      initialNote: "Ultima",
    })
  })

  it("flushes the latest note when the knowledge view closes quickly", async () => {
    const user = userEvent.setup()
    const view = render(
      <StudentKnowledge
        courseId="course-1"
        onBack={vi.fn()}
        onSaved={vi.fn()}
        students={[MARIO]}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Nota di Mario" }))
    await user.type(
      screen.getByLabelText("Nota iniziale di Mario"),
      "Nota prima di uscire",
    )
    view.unmount()

    await waitFor(() =>
      expect(saveKnowledge).toHaveBeenLastCalledWith("student-1", "course-1", {
        size: null,
        initialNote: "Nota prima di uscire",
      }),
    )
  })

  it("keeps failed edits and offers an in-card save retry", async () => {
    saveKnowledge.mockRejectedValueOnce(new Error("offline"))
    const user = userEvent.setup()
    render(
      <StudentKnowledge
        courseId="course-1"
        onBack={vi.fn()}
        onSaved={vi.fn()}
        students={[MARIO]}
      />,
    )

    await user.click(
      within(screen.getByRole("group", { name: "Taglia di Mario" })).getByRole(
        "button",
        { name: "XL" },
      ),
    )
    expect(
      await screen.findByText("Modifica non salvata. Il testo resta qui."),
    ).toBeVisible()

    saveKnowledge.mockResolvedValue(undefined)
    await user.click(
      screen.getByRole("button", { name: "Riprova salvataggio di Mario" }),
    )
    expect(await screen.findByText("Salvato")).toBeInTheDocument()
    expect(saveKnowledge).toHaveBeenLastCalledWith("student-1", "course-1", {
      size: "XL",
      initialNote: null,
    })
  })

  it("keeps a dictated note editable and unsaved until confirmation", async () => {
    const stopTrack = vi.fn()
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrack }],
        }),
      },
    })

    class FakeMediaRecorder {
      mimeType = "audio/webm"
      ondataavailable: ((event: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      state: RecordingState = "inactive"

      start() {
        this.state = "recording"
      }

      stop() {
        this.state = "inactive"
        this.ondataavailable?.({ data: new Blob(["recording"]) })
        this.onstop?.()
      }
    }

    vi.stubGlobal("MediaRecorder", FakeMediaRecorder)
    const transcribe = vi.fn().mockResolvedValue("Buona sensibilità al timone")
    const user = userEvent.setup()
    render(
      <StudentKnowledge
        courseId="course-1"
        onBack={vi.fn()}
        onSaved={vi.fn()}
        students={[MARIO]}
        transcribe={transcribe}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Nota di Mario" }))
    await user.click(
      screen.getByRole("button", { name: "Detta nota di Mario" }),
    )
    await user.type(
      screen.getByLabelText("Nota iniziale di Mario"),
      "Appunto digitato",
    )
    await user.click(
      await screen.findByRole("button", { name: "Termina dettatura di Mario" }),
    )

    const note = await screen.findByLabelText("Nota iniziale di Mario")
    expect(note).toHaveValue("Appunto digitato Buona sensibilità al timone")
    await waitFor(() =>
      expect(saveKnowledge).toHaveBeenCalledWith(
        "student-1",
        "course-1",
        expect.objectContaining({
          initialNote: "Appunto digitato Buona sensibilità al timone",
        }),
      ),
    )
    expect(stopTrack).toHaveBeenCalledOnce()

    await user.type(note, ", ascolta le consegne")
    await waitFor(() =>
      expect(saveKnowledge).toHaveBeenCalledWith("student-1", "course-1", {
        size: null,
        initialNote:
          "Appunto digitato Buona sensibilità al timone, ascolta le consegne",
      }),
    )
    expect(transcribe).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.objectContaining({ onProgress: expect.any(Function) }),
    )
  })

  it("persists completed speech directly and ignores a late result after processing is cancelled", async () => {
    const stopTrack = vi.fn()
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockImplementation(async () => ({
          getTracks: () => [{ stop: stopTrack }],
        })),
      },
    })
    class FakeMediaRecorder {
      mimeType = "audio/webm"
      ondataavailable: ((event: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      state: RecordingState = "inactive"

      start() {
        this.state = "recording"
      }

      stop() {
        this.state = "inactive"
        this.ondataavailable?.({ data: new Blob(["recording"]) })
        this.onstop?.()
      }
    }
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder)
    let resolveLateTranscript: ((text: string) => void) | undefined
    const transcribe = vi
      .fn()
      .mockResolvedValueOnce("prima trascrizione")
      .mockResolvedValueOnce("seconda trascrizione")
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveLateTranscript = resolve
          }),
      )
    const user = userEvent.setup()
    render(
      <StudentKnowledge
        courseId="course-1"
        onBack={vi.fn()}
        onSaved={vi.fn()}
        students={[MARIO]}
        transcribe={transcribe}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Nota di Mario" }))
    const note = screen.getByLabelText("Nota iniziale di Mario")
    await user.type(note, "Testo manuale")
    await user.click(
      screen.getByRole("button", { name: "Detta nota di Mario" }),
    )
    await user.click(
      await screen.findByRole("button", { name: "Termina dettatura di Mario" }),
    )
    expect(note).toHaveValue("Testo manuale prima trascrizione")
    await waitFor(() =>
      expect(saveKnowledge).toHaveBeenCalledWith(
        "student-1",
        "course-1",
        expect.objectContaining({
          initialNote: "Testo manuale prima trascrizione",
        }),
      ),
    )

    await user.click(
      screen.getByRole("button", { name: "Detta nota di Mario" }),
    )
    await user.click(
      await screen.findByRole("button", { name: "Termina dettatura di Mario" }),
    )
    expect(note).toHaveValue(
      "Testo manuale prima trascrizione seconda trascrizione",
    )
    await waitFor(() =>
      expect(saveKnowledge).toHaveBeenCalledWith(
        "student-1",
        "course-1",
        expect.objectContaining({
          initialNote: "Testo manuale prima trascrizione seconda trascrizione",
        }),
      ),
    )
    await user.click(
      screen.getByRole("button", { name: "Chiudi nota di Mario" }),
    )
    await user.click(screen.getByRole("button", { name: "Nota di Mario" }))
    expect(screen.getByLabelText("Nota iniziale di Mario")).toHaveValue(
      "Testo manuale prima trascrizione seconda trascrizione",
    )

    await user.click(
      screen.getByRole("button", { name: "Detta nota di Mario" }),
    )
    await user.click(
      await screen.findByRole("button", { name: "Termina dettatura di Mario" }),
    )
    expect(screen.getByText("Elaborazione locale dell’audio…")).toBeVisible()
    await user.click(
      screen.getByRole("button", { name: "Annulla dettatura di Mario" }),
    )
    await act(async () => resolveLateTranscript?.("risultato tardivo"))

    expect(screen.getByLabelText("Nota iniziale di Mario")).toHaveValue(
      "Testo manuale prima trascrizione seconda trascrizione",
    )
    expect(
      screen.queryByRole("button", {
        name: /Scarta trascrizione|Usa trascrizione/,
      }),
    ).not.toBeInTheDocument()
    expect(saveKnowledge).not.toHaveBeenCalledWith(
      "student-1",
      "course-1",
      expect.objectContaining({
        initialNote: expect.stringContaining("tardivo"),
      }),
    )
    expect(stopTrack).toHaveBeenCalledTimes(3)
  })

  it("asks for microphone permission only after a tap and preserves text on denial", async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(
        new DOMException("Permission denied", "NotAllowedError"),
      )
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    })
    vi.stubGlobal("MediaRecorder", class {})
    const user = userEvent.setup()
    render(
      <StudentKnowledge
        courseId="course-1"
        onBack={vi.fn()}
        onSaved={vi.fn()}
        students={[{ ...MARIO, initialNote: "Testo già scritto" }]}
      />,
    )

    expect(getUserMedia).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Nota di Mario" }))
    expect(getUserMedia).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole("button", { name: "Detta nota di Mario" }),
    )

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(
      await screen.findByText(
        "Permesso microfono non concesso. Il testo è rimasto invariato.",
      ),
    ).toBeVisible()
    expect(screen.getByLabelText("Nota iniziale di Mario")).toHaveValue(
      "Testo già scritto",
    )
  })

  it("cancels a pending permission request and discards its late stream", async () => {
    const stopTrack = vi.fn()
    let resolvePermission: ((stream: unknown) => void) | undefined
    const getUserMedia = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvePermission = resolve
        }),
    )
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    })
    vi.stubGlobal("MediaRecorder", class {})
    const transcribe = vi.fn()
    const user = userEvent.setup()
    render(
      <StudentKnowledge
        courseId="course-1"
        onBack={vi.fn()}
        onSaved={vi.fn()}
        students={[MARIO]}
        transcribe={transcribe}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Nota di Mario" }))
    await user.click(
      screen.getByRole("button", { name: "Detta nota di Mario" }),
    )
    expect(screen.getByText("Attendo il permesso del microfono…")).toBeVisible()
    await user.click(
      screen.getByRole("button", { name: "Annulla dettatura di Mario" }),
    )
    act(() => resolvePermission?.({ getTracks: () => [{ stop: stopTrack }] }))

    await waitFor(() => expect(stopTrack).toHaveBeenCalledOnce())
    expect(transcribe).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", { name: "Detta nota di Mario" }),
    ).toBeEnabled()
  })

  it("cancels asset loading and never starts a late recording", async () => {
    const stopTrack = vi.fn()
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrack }],
        }),
      },
    })
    const constructRecorder = vi.fn()
    class FakeMediaRecorder {
      state: RecordingState = "inactive"
      constructor() {
        constructRecorder()
      }
    }
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder)
    let resolvePreparation: (() => void) | undefined
    const prepareSpeech = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePreparation = resolve
        }),
    )
    const transcribe = vi.fn()
    const user = userEvent.setup()
    render(
      <StudentKnowledge
        courseId="course-1"
        onBack={vi.fn()}
        onSaved={vi.fn()}
        prepareSpeech={prepareSpeech}
        students={[MARIO]}
        transcribe={transcribe}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Nota di Mario" }))
    await user.click(
      screen.getByRole("button", { name: "Detta nota di Mario" }),
    )
    expect(
      await screen.findByText("Caricamento del modello vocale…"),
    ).toBeVisible()
    await user.click(
      screen.getByRole("button", { name: "Annulla dettatura di Mario" }),
    )
    await act(async () => resolvePreparation?.())

    await waitFor(() => expect(stopTrack).toHaveBeenCalledOnce())
    expect(constructRecorder).not.toHaveBeenCalled()
    expect(transcribe).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", { name: "Detta nota di Mario" }),
    ).toBeEnabled()
  })

  it("preserves typed text and retries when speech assets fail to load", async () => {
    const stopTrack = vi.fn()
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrack }],
        }),
      },
    })
    const startRecording = vi.fn()
    class FakeMediaRecorder {
      mimeType = "audio/webm"
      ondataavailable: ((event: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      state: RecordingState = "inactive"

      start() {
        startRecording()
        this.state = "recording"
      }

      stop() {
        this.state = "inactive"
        this.onstop?.()
      }
    }
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder)
    const prepareSpeech = vi
      .fn()
      .mockRejectedValueOnce(new Error("asset unavailable"))
      .mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    render(
      <StudentKnowledge
        courseId="course-1"
        onBack={vi.fn()}
        onSaved={vi.fn()}
        prepareSpeech={prepareSpeech}
        students={[{ ...MARIO, initialNote: "Testo già scritto" }]}
        transcribe={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Nota di Mario" }))
    await user.click(
      screen.getByRole("button", { name: "Detta nota di Mario" }),
    )

    expect(
      await screen.findByText(
        "Dettatura non riuscita. Il testo è rimasto invariato.",
      ),
    ).toBeVisible()
    expect(screen.getByLabelText("Nota iniziale di Mario")).toHaveValue(
      "Testo già scritto",
    )
    expect(startRecording).not.toHaveBeenCalled()
    expect(stopTrack).toHaveBeenCalledOnce()

    await user.click(
      screen.getByRole("button", { name: "Riprovare dettatura di Mario" }),
    )
    expect(await screen.findByText("Registrazione in corso")).toBeVisible()
    expect(prepareSpeech).toHaveBeenCalledTimes(2)
    expect(startRecording).toHaveBeenCalledOnce()
    await user.click(
      screen.getByRole("button", { name: "Annulla dettatura di Mario" }),
    )
  })

  it("shows loading and processing before inserting and saving the transcript", async () => {
    const stopTrack = vi.fn()
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrack }],
        }),
      },
    })

    class FakeMediaRecorder {
      mimeType = "audio/webm"
      ondataavailable: ((event: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      state: RecordingState = "inactive"

      start() {
        this.state = "recording"
      }

      stop() {
        this.state = "inactive"
        this.ondataavailable?.({ data: new Blob(["fixture-audio"]) })
        this.onstop?.()
      }
    }

    vi.stubGlobal("MediaRecorder", FakeMediaRecorder)
    let reportTranscriptionProgress:
      ((progress: SpeechTranscriptionProgress) => void) | undefined
    let resolvePreparation: (() => void) | undefined
    let resolveTranscript: ((text: string) => void) | undefined
    const prepareSpeech = vi.fn((options?: SpeechTranscriptionOptions) => {
      options?.onProgress?.({ phase: "loading", percent: 42 })
      return new Promise<void>((resolve) => {
        resolvePreparation = resolve
      })
    })
    const transcribe = vi.fn(
      (_audio: Blob, options?: SpeechTranscriptionOptions) => {
        reportTranscriptionProgress = options?.onProgress
        reportTranscriptionProgress?.({ phase: "processing" })
        return new Promise<string>((resolve) => {
          resolveTranscript = resolve
        })
      },
    )
    const user = userEvent.setup()
    render(
      <StudentKnowledge
        courseId="course-1"
        onBack={vi.fn()}
        onSaved={vi.fn()}
        students={[MARIO]}
        transcribe={transcribe}
        prepareSpeech={prepareSpeech}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Nota di Mario" }))
    await user.click(
      screen.getByRole("button", { name: "Detta nota di Mario" }),
    )
    expect(
      await screen.findByText("Caricamento del modello vocale 42%…"),
    ).toBeVisible()

    await act(async () => resolvePreparation?.())
    expect(await screen.findByText("Registrazione in corso")).toBeVisible()
    await user.click(
      screen.getByRole("button", { name: "Termina dettatura di Mario" }),
    )
    expect(screen.getByText("Elaborazione locale dell’audio…")).toBeVisible()
    await act(async () => resolveTranscript?.("Testo dalla fixture"))

    expect(
      screen.queryByRole("button", {
        name: /Scarta trascrizione|Usa trascrizione/,
      }),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText("Nota iniziale di Mario")).toHaveValue(
      "Testo dalla fixture",
    )
    expect(stopTrack).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(saveKnowledge).toHaveBeenCalledWith(
        "student-1",
        "course-1",
        expect.objectContaining({ initialNote: "Testo dalla fixture" }),
      ),
    )
    expect(prepareSpeech).toHaveBeenCalledBefore(transcribe)
  })
})
