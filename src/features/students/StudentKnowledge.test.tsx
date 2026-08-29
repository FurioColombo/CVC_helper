import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/persistence/students", () => ({
  updateStudentKnowledge: vi.fn(),
}))

import { StudentKnowledge } from "@/features/students/StudentKnowledge"
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
  sex: "male",
  phone: null,
  size: null,
  initialNote: null,
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

    await user.selectOptions(screen.getByLabelText("Taglia di Mario"), "L")
    await waitFor(() =>
      expect(saveKnowledge).toHaveBeenCalledWith("student-1", "course-1", {
        size: "L",
        initialNote: null,
      }),
    )

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

    await user.click(
      screen.getByRole("button", { name: "Detta nota di Mario" }),
    )
    await user.click(
      await screen.findByRole("button", { name: "Termina dettatura di Mario" }),
    )

    const note = await screen.findByLabelText("Nota iniziale di Mario")
    expect(note).toHaveValue("Buona sensibilità al timone")
    expect(saveKnowledge).not.toHaveBeenCalled()
    expect(stopTrack).toHaveBeenCalledOnce()

    await user.type(note, ", ascolta le consegne")
    expect(saveKnowledge).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole("button", { name: "Usa trascrizione di Mario" }),
    )

    await waitFor(() =>
      expect(saveKnowledge).toHaveBeenCalledWith("student-1", "course-1", {
        size: null,
        initialNote: "Buona sensibilità al timone, ascolta le consegne",
      }),
    )
    expect(transcribe).toHaveBeenCalledWith(expect.any(Blob))
  })
})
