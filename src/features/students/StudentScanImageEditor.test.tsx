import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const createPreview = vi.fn()
const prepareImage = vi.fn()
const updateCrop = vi.fn((crop: unknown, ...rest: unknown[]) => {
  void rest
  return crop
})

vi.mock("@/features/students/studentImageCrop", () => ({
  DEFAULT_STUDENT_SCAN_CROP: {
    x: 0.08,
    y: 0.08,
    width: 0.84,
    height: 0.84,
  },
  createStudentScanPreview: (file: File, rotation: number) =>
    createPreview(file, rotation),
  prepareStudentScanImage: (file: File, rotation: number, crop: unknown) =>
    prepareImage(file, rotation, crop),
  updateNormalizedCrop: (
    crop: unknown,
    gesture: string,
    dx: number,
    dy: number,
  ) => updateCrop(crop, gesture, dx, dy),
}))

import { StudentScanImageEditor } from "@/features/students/StudentScanImageEditor"

describe("StudentScanImageEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubGlobal("URL", {
      ...URL,
      revokeObjectURL: vi.fn(),
    })
    createPreview.mockResolvedValue({
      url: "blob:adjustment-preview",
      width: 800,
      height: 600,
    })
    prepareImage.mockResolvedValue(
      new Blob(["adjusted"], { type: "image/png" }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    document.body.style.overflow = ""
  })

  it("traps focus, locks page scrolling, and supports free rotation and keyboard crop movement", async () => {
    const onUse = vi.fn()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      <StudentScanImageEditor
        file={new File(["photo"], "roster.jpg", { type: "image/jpeg" })}
        onCancel={vi.fn()}
        onUse={onUse}
        source="camera"
      />,
    )

    expect(
      screen.getByRole("dialog", { name: "Raddrizza e ritaglia foto" }),
    ).toBeVisible()
    expect(document.body.style.overflow).toBe("hidden")
    await vi.advanceTimersByTimeAsync(130)
    expect(
      await screen.findByAltText("Anteprima foto da ritagliare"),
    ).toBeVisible()

    const rotation = screen.getByLabelText(
      "Rotazione foto da meno 180 a 180 gradi",
    )
    fireEvent.change(rotation, { target: { value: "-37" } })
    expect(rotation).toHaveValue("-37")

    const crop = screen.getByRole("group", { name: /Area di ritaglio/ })
    crop.focus()
    await user.keyboard("{ArrowRight}")
    expect(updateCrop).toHaveBeenCalledWith(expect.any(Object), "move", 0.01, 0)

    const close = screen.getByRole("button", {
      name: "Chiudi regolazione foto",
    })
    const useArea = screen.getByRole("button", { name: "Usa questa area" })
    useArea.focus()
    await user.tab()
    expect(close).toHaveFocus()

    await user.click(useArea)
    await waitFor(() => expect(onUse).toHaveBeenCalledOnce())
    expect(prepareImage).toHaveBeenCalledWith(
      expect.any(File),
      -37,
      expect.any(Object),
    )
  })

  it("closes with Escape when processing has not begun", async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      <StudentScanImageEditor
        file={new File(["photo"], "roster.jpg", { type: "image/jpeg" })}
        onCancel={onCancel}
        onUse={vi.fn()}
        source="gallery"
      />,
    )
    await user.keyboard("{Escape}")
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
