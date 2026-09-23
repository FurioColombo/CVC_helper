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

async function openEditor(
  overrides: { onUse?: () => void; onCancel?: () => void } = {},
) {
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

function stageWithBounds() {
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
  return stage
}

const tiltValue = () =>
  Number(
    screen
      .getByLabelText("Inclinazione in gradi")
      .getAttribute("aria-valuenow"),
  )

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

  it("shows the picture in a workspace with a dial instead of a slider", async () => {
    await openEditor()

    // The correction replaces the slider outright; it must not come back.
    expect(document.querySelector('input[type="range"]')).toBeNull()
    expect(screen.getByLabelText("Area di lavoro foto")).toBeVisible()
    expect(screen.getByAltText("Anteprima foto da ritagliare")).toBeVisible()

    const dial = screen.getByRole("slider", { name: "Inclinazione in gradi" })
    expect(dial).toHaveAttribute("aria-valuenow", "0")
    expect(dial).toHaveAttribute("aria-valuemin", "-45")
    expect(dial).toHaveAttribute("aria-valuemax", "45")
    expect(
      screen.getByRole("button", { name: "Raddrizza con una linea" }),
    ).toBeVisible()
  })

  it("adjusts the inclination by tenths, by whole degrees and back to level", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await openEditor()
    const dial = screen.getByRole("slider", { name: "Inclinazione in gradi" })
    dial.focus()

    await user.keyboard("{ArrowRight}")
    expect(tiltValue()).toBeCloseTo(0.1)

    await user.keyboard("{Shift>}{ArrowRight}{/Shift}")
    expect(tiltValue()).toBeCloseTo(1.1)

    await user.keyboard("{Home}")
    expect(tiltValue()).toBe(0)
  })

  it("straightens from a line drawn along a rule on the sheet", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await openEditor()
    const stage = stageWithBounds()

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

    expect(tiltValue()).toBeCloseTo(-45)
    // The mode releases itself so the next drag crops rather than re-measures.
    expect(
      screen.getByRole("button", { name: "Raddrizza con una linea" }),
    ).toHaveAttribute("aria-pressed", "false")
  })

  it("ignores a tap that is too short to be a line", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await openEditor()
    const stage = stageWithBounds()

    await user.click(
      screen.getByRole("button", { name: "Raddrizza con una linea" }),
    )
    fireEvent.pointerDown(stage, { pointerId: 2, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(stage, { pointerId: 2, clientX: 103, clientY: 101 })
    fireEvent.pointerUp(stage, { pointerId: 2, clientX: 103, clientY: 101 })

    expect(tiltValue()).toBe(0)
  })

  it("returns inclination and quarter turns to their start", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await openEditor()

    screen.getByRole("slider", { name: "Inclinazione in gradi" }).focus()
    await user.keyboard("{ArrowRight}{ArrowRight}")
    await user.click(
      screen.getByRole("button", { name: "Ruota 90 gradi a sinistra" }),
    )
    expect(tiltValue()).toBeCloseTo(0.2)

    await user.click(screen.getByRole("button", { name: "Ripristina foto" }))
    expect(tiltValue()).toBe(0)
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

  it("offers accessible 44px edge handles with keyboard resizing", async () => {
    await openEditor()

    const edgeLabels = [
      "Ridimensiona ritaglio dal bordo superiore",
      "Ridimensiona ritaglio dal bordo destro",
      "Ridimensiona ritaglio dal bordo inferiore",
      "Ridimensiona ritaglio dal bordo sinistro",
    ]
    const handles = edgeLabels.map((label) =>
      screen.getByRole("button", { name: label }),
    )

    for (const handle of handles) {
      expect(handle.className).toContain("size-11")
    }
    expect(handles[0]!.className).toContain("top-0")
    expect(handles[0]!.style.transform).toContain("translate(-50%, 0)")
    expect(handles[1]!.className).toContain("right-0")
    expect(handles[1]!.style.transform).toContain("translate(0, -50%)")
    expect(handles[2]!.className).toContain("bottom-0")
    expect(handles[2]!.style.transform).toContain("translate(-50%, 0)")
    expect(handles[3]!.className).toContain("left-0")
    expect(handles[3]!.style.transform).toContain("translate(0, -50%)")
    expect(handles.map((handle) => handle.style.transformOrigin)).toEqual([
      "50% 0%",
      "100% 50%",
      "50% 100%",
      "0% 50%",
    ])
    const cornerLabels = [
      "Ridimensiona ritaglio dall’angolo in alto a sinistra",
      "Ridimensiona ritaglio dall’angolo in alto a destra",
      "Ridimensiona ritaglio dall’angolo in basso a sinistra",
      "Ridimensiona ritaglio dall’angolo in basso a destra",
    ]
    expect(
      cornerLabels.map(
        (label) =>
          screen.getByRole("button", { name: label }).style.transformOrigin,
      ),
    ).toEqual(["0% 0%", "100% 0%", "0% 100%", "100% 100%"])

    fireEvent.keyDown(handles[1]!, { key: "ArrowRight" })
    expect(updateCrop).toHaveBeenCalledWith(expect.any(Object), "east", 0.01, 0)
  })

  it("moves focus from a keyboard crop handle to the ruler on pointer straightening", async () => {
    await openEditor()
    const edge = screen.getByRole("button", {
      name: "Ridimensiona ritaglio dal bordo destro",
    })
    const corner = screen.getByRole("button", {
      name: "Ridimensiona ritaglio dall’angolo in alto a sinistra",
    })
    const dial = screen.getByRole("slider", { name: "Inclinazione in gradi" })

    edge.focus()
    expect(edge).toHaveFocus()
    expect(edge.className).toContain("focus-visible:ring-2")
    expect(corner.className).toContain("focus-visible:ring-2")
    expect(corner.style.transformOrigin).toBe("0% 0%")
    expect(dial.className).toContain("focus-visible:ring-2")

    fireEvent.pointerDown(dial, {
      pointerId: 12,
      clientX: 200,
      clientY: 20,
    })
    fireEvent.pointerMove(dial, {
      pointerId: 12,
      clientX: 182,
      clientY: 20,
    })
    fireEvent.pointerUp(dial, {
      pointerId: 12,
      clientX: 182,
      clientY: 20,
    })

    expect(dial).toHaveFocus()
    expect(edge).not.toHaveFocus()
    expect(tiltValue()).toBeCloseTo(3)
  })

  it("rotates the image and crop together while deferring preview rendering until release", async () => {
    await openEditor()
    const previewCalls = createPreview.mock.calls.length
    const dial = screen.getByRole("slider", { name: "Inclinazione in gradi" })

    fireEvent.pointerDown(dial, {
      pointerId: 8,
      clientX: 200,
      clientY: 20,
    })
    fireEvent.pointerMove(dial, {
      pointerId: 8,
      clientX: 182,
      clientY: 20,
    })

    const livePreview = screen.getByTestId("student-scan-live-preview")
    const cropFrame = screen.getByTestId("student-scan-crop-frame")
    expect(livePreview.style.transform).toBe("rotate(3deg)")
    expect(livePreview.contains(cropFrame)).toBe(true)

    await vi.advanceTimersByTimeAsync(130)
    expect(createPreview).toHaveBeenCalledTimes(previewCalls)

    fireEvent.pointerUp(dial, {
      pointerId: 8,
      clientX: 182,
      clientY: 20,
    })
    await vi.advanceTimersByTimeAsync(130)
    await waitFor(() =>
      expect(createPreview).toHaveBeenCalledTimes(previewCalls + 1),
    )
    expect(createPreview).toHaveBeenLastCalledWith(expect.any(File), 3)
    expect(livePreview.style.transform).toBe("rotate(0deg)")
  })

  it("inverse-rotates edge drags and preserves the selected output crop when preview settles", async () => {
    const onUse = vi.fn()
    await openEditor({ onUse })
    const stage = stageWithBounds()
    const selectedCrop = { x: 0.1, y: 0.2, width: 0.6, height: 0.5 }
    updateCrop.mockReturnValue(selectedCrop)

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByRole("button", { name: "Ruota 90 gradi a sinistra" }))
    expect(
      screen.getByTestId("student-scan-live-preview").style.transform,
    ).toBe("rotate(-90deg)")

    const east = screen.getByRole("button", {
      name: "Ridimensiona ritaglio dal bordo destro",
    })
    fireEvent.pointerDown(east, {
      pointerId: 9,
      clientX: 200,
      clientY: 200,
    })
    fireEvent.pointerMove(stage, {
      pointerId: 9,
      clientX: 200,
      clientY: 160,
    })
    fireEvent.pointerUp(stage, {
      pointerId: 9,
      clientX: 200,
      clientY: 160,
    })

    expect(updateCrop).toHaveBeenCalledWith(
      expect.any(Object),
      "east",
      expect.closeTo(0.1),
      expect.closeTo(0),
    )
    const frame = screen.getByTestId("student-scan-crop-frame")
    expect(frame.style.left).toBe("10%")
    expect(frame.style.top).toBe("20%")
    expect(frame.style.width).toBe("60%")
    expect(frame.style.height).toBe("50%")

    await vi.advanceTimersByTimeAsync(130)
    await waitFor(() =>
      expect(createPreview).toHaveBeenLastCalledWith(expect.any(File), -90),
    )
    expect(
      screen.getByTestId("student-scan-live-preview").style.transform,
    ).toBe("rotate(0deg)")
    expect(frame.style.left).toBe("10%")
    expect(frame.style.top).toBe("20%")
    expect(frame.style.width).toBe("60%")
    expect(frame.style.height).toBe("50%")

    fireEvent.click(screen.getByRole("button", { name: "Usa questa area" }))
    await waitFor(() => expect(onUse).toHaveBeenCalledOnce())
    expect(prepareImage).toHaveBeenCalledWith(
      expect.any(File),
      -90,
      selectedCrop,
    )
  })
})
