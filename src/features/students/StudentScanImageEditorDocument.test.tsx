import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const createPreview = vi.fn()
const prepareImage = vi.fn()
const updateCrop = vi.fn((crop: unknown, ...rest: unknown[]) => {
  void rest
  return crop
})

vi.mock("@/features/students/studentImageCrop", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/students/studentImageCrop")
  >("@/features/students/studentImageCrop")
  return {
    ...actual,
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
  }
})

import { StudentScanImageEditorDocument } from "@/features/students/StudentScanImageEditorDocument"

async function openEditor(overrides: {
  onUse?: () => void
  onCancel?: () => void
}) {
  render(
    <StudentScanImageEditorDocument
      file={new File(["photo"], "roster.jpg", { type: "image/jpeg" })}
      onCancel={overrides.onCancel ?? vi.fn()}
      onUse={overrides.onUse ?? vi.fn()}
      source="gallery"
    />,
  )
  // The controls stay disabled until the first preview resolves.
  await vi.advanceTimersByTimeAsync(130)
  await screen.findByAltText("Anteprima foto da ritagliare")
}

describe("StudentScanImageEditorDocument", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubGlobal("URL", { ...URL, revokeObjectURL: vi.fn() })
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

  it("offers the document workspace without a rotation slider", async () => {
    await openEditor({})
    expect(
      await screen.findByAltText("Anteprima foto da ritagliare"),
    ).toBeVisible()

    // The correction replaces the slider outright; it must not come back.
    expect(document.querySelector('input[type="range"]')).toBeNull()
    expect(screen.getByLabelText("Area di lavoro foto")).toBeVisible()
    expect(screen.getByLabelText("Angolo in gradi")).toHaveValue(0)
    for (const name of [
      "Raddrizza con una linea",
      "Aumenta ingrandimento",
      "Riduci ingrandimento",
      "Ruota 90 gradi a sinistra",
      "Ruota di un decimo di grado a destra",
    ]) {
      expect(screen.getByRole("button", { name })).toBeVisible()
    }
  })

  it("adjusts the angle in tenths and by quarter turns", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await openEditor({})
    const angle = screen.getByLabelText("Angolo in gradi")

    await user.click(
      screen.getByRole("button", {
        name: "Ruota di un decimo di grado a destra",
      }),
    )
    expect(angle).toHaveValue(0.1)

    await user.click(
      screen.getByRole("button", {
        name: "Ruota di un decimo di grado a sinistra",
      }),
    )
    expect(angle).toHaveValue(0)

    await user.click(
      screen.getByRole("button", { name: "Ruota 90 gradi a sinistra" }),
    )
    expect(angle).toHaveValue(-90)

    fireEvent.change(angle, { target: { value: "-2.5" } })
    expect(angle).toHaveValue(-2.5)
  })

  it("straightens from a line drawn along a rule on the sheet", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await openEditor({})

    const stage = screen.getByLabelText("Area di lavoro foto")
    stage.setPointerCapture = vi.fn()
    stage.releasePointerCapture = vi.fn()
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 400,
      right: 400,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    await user.click(
      screen.getByRole("button", { name: "Raddrizza con una linea" }),
    )
    expect(
      screen.getByRole("button", { name: "Raddrizza con una linea" }),
    ).toHaveAttribute("aria-pressed", "true")

    // A line sloping down to the right by 45 degrees must rotate back by 45.
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 200, clientY: 200 })
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 200, clientY: 200 })

    expect(screen.getByLabelText("Angolo in gradi")).toHaveValue(-45)
    // The mode releases itself so the next drag crops rather than re-measures.
    expect(
      screen.getByRole("button", { name: "Raddrizza con una linea" }),
    ).toHaveAttribute("aria-pressed", "false")
  })

  it("ignores a tap that is too short to be a line", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await openEditor({})

    const stage = screen.getByLabelText("Area di lavoro foto")
    stage.setPointerCapture = vi.fn()
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 400,
      right: 400,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    await user.click(
      screen.getByRole("button", { name: "Raddrizza con una linea" }),
    )
    fireEvent.pointerDown(stage, { pointerId: 2, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(stage, { pointerId: 2, clientX: 103, clientY: 101 })
    fireEvent.pointerUp(stage, { pointerId: 2, clientX: 103, clientY: 101 })

    expect(screen.getByLabelText("Angolo in gradi")).toHaveValue(0)
  })

  it("zooms within bounds and resets everything together", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await openEditor({})

    expect(
      screen.getByRole("button", { name: "Riduci ingrandimento" }),
    ).toBeDisabled()
    const zoomIn = screen.getByRole("button", { name: "Aumenta ingrandimento" })
    await user.click(zoomIn)
    expect(screen.getByText("125%")).toBeVisible()

    await user.click(
      screen.getByRole("button", {
        name: "Ruota di un decimo di grado a destra",
      }),
    )
    await user.click(screen.getByRole("button", { name: "Ripristina foto" }))
    expect(screen.getByText("100%")).toBeVisible()
    expect(screen.getByLabelText("Angolo in gradi")).toHaveValue(0)
  })

  it("keeps crop keyboard movement, the focus trap and Escape", async () => {
    const onCancel = vi.fn()
    const onUse = vi.fn()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await openEditor({ onCancel, onUse })

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

    await user.keyboard("{Escape}")
    expect(onCancel).toHaveBeenCalledOnce()

    // Committing last: the button disables itself while preparing, which moves
    // focus out of the dialog and would make a later key press meaningless.
    await user.click(useArea)
    await waitFor(() => expect(onUse).toHaveBeenCalledOnce())
  })
})
