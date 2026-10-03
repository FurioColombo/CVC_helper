import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { useRef } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  restoreSummaryImageBrowser,
  stubSummaryImageBrowser,
} from "@/test/summaryImageHarness"

// Nothing is laid out in jsdom: the snapshot itself has its own tests; here
// it is a promise this suite controls.
vi.mock("@/lib/pageSnapshot", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pageSnapshot")>()),
  renderElementToPng: vi.fn(),
  waitForImages: vi.fn().mockResolvedValue(undefined),
}))

import { renderElementToPng } from "@/lib/pageSnapshot"
import { SummaryImageButton } from "./SummaryImageButton"

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"

function Harness() {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <section>
      <div ref={ref}>
        <h1>Sabato PM</h1>
      </div>
      <SummaryImageButton captureRef={ref} filename="sabato-pm.png" />
    </section>
  )
}

const pngBlob = () => new Blob(["png"], { type: "image/png" })
const saveButton = () =>
  screen.getByRole("button", { name: "Salva immagine riepilogo e copiala" })

/** The status region is always there, empty; this waits for a note in it. */
async function statusWith(text: RegExp) {
  await screen.findByText(text)
  return screen.getByRole("status")
}

let browser: ReturnType<typeof stubSummaryImageBrowser>

function stubSharing(share = vi.fn().mockResolvedValue(undefined)) {
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: share,
  })
  Object.defineProperty(navigator, "canShare", {
    configurable: true,
    value: vi.fn(() => true),
  })
  return share
}

beforeEach(() => {
  browser = stubSummaryImageBrowser()
  vi.mocked(renderElementToPng).mockReset()
  vi.mocked(renderElementToPng).mockResolvedValue(pngBlob())
})
afterEach(() => {
  vi.useRealTimers()
  restoreSummaryImageBrowser()
})

describe("SummaryImageButton", () => {
  it("is a floating button at the bottom right with a visible label that its accessible name contains, left out of the image", () => {
    render(<Harness />)
    const button = saveButton()
    expect(button).toHaveTextContent("Salva immagine")
    expect(button.getAttribute("aria-label")).toContain("Salva immagine")
    const floating = button.parentElement!
    expect(floating).toHaveAttribute("data-snapshot-exclude", "true")
    expect(floating.className).toContain("fixed")
    expect(floating.className).toContain("right-4")
    expect(floating.className).toContain(
      "bottom-[max(1rem,env(safe-area-inset-bottom))]",
    )
    expect(button.className).toContain("min-h-12")
    expect(button.className).toContain("bg-[#0b526b]")
    expect(button).toHaveAttribute("aria-busy", "false")
  })

  it("renders the image ahead of the tap and uses that one", async () => {
    render(<Harness />)
    await vi.waitFor(() => expect(renderElementToPng).toHaveBeenCalledOnce())

    fireEvent.click(saveButton())
    expect(
      await screen.findByText(
        "Immagine salvata e copiata. Incollala su WhatsApp.",
      ),
    ).toBeVisible()
    expect(renderElementToPng).toHaveBeenCalledOnce()
    expect(browser.downloads).toEqual(["sabato-pm.png"])
  })

  it("renders on the tap when it has not been rendered ahead, and shows it is busy meanwhile", async () => {
    let finish: (blob: Blob) => void = () => undefined
    vi.mocked(renderElementToPng).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    render(<Harness />)

    fireEvent.click(saveButton())
    const busy = await screen.findByRole("button", { name: "Preparo…" })
    expect(busy).toHaveAttribute("aria-busy", "true")
    // A second tap while it works does not start a second image.
    fireEvent.click(busy)
    expect(browser.clipboardWrite).toHaveBeenCalledOnce()

    await act(async () => finish(pngBlob()))
    expect(await statusWith(/Immagine salvata e copiata/)).toHaveTextContent(
      "Immagine salvata e copiata",
    )
    expect(saveButton()).toHaveAttribute("aria-busy", "false")
    expect(renderElementToPng).toHaveBeenCalledOnce()
  })

  it("says the image is only saved when the clipboard would not take it, and only copied when nothing could be saved", async () => {
    browser.clipboardWrite.mockRejectedValue(new Error("Denied"))
    render(<Harness />)
    fireEvent.click(saveButton())
    expect(await statusWith(/Copia non riuscita/)).toHaveTextContent(
      "Immagine salvata. Copia non riuscita.",
    )

    browser.clipboardWrite.mockResolvedValue(undefined)
    URL.createObjectURL = vi.fn(() => {
      throw new Error("No downloads")
    })
    fireEvent.click(saveButton())
    await act(async () => undefined)
    expect(await statusWith(/Immagine copiata. Incollala/)).toHaveTextContent(
      "Immagine copiata. Incollala su WhatsApp.",
    )
  })

  it("says so, as an alert, when the image could not be made, and makes it again on the next tap", async () => {
    vi.mocked(renderElementToPng).mockRejectedValueOnce(
      new Error("canvas too large"),
    )
    render(<Harness />)
    fireEvent.click(saveButton())
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Impossibile creare l’immagine. Riprova.",
    )
    expect(browser.downloads).toEqual([])

    fireEvent.click(saveButton())
    expect(
      await screen.findByText(
        "Immagine salvata e copiata. Incollala su WhatsApp.",
      ),
    ).toBeVisible()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(browser.downloads).toEqual(["sabato-pm.png"])
  })

  it("on an iPhone shares instead of downloading and offers Condividi, which opens the sheet again from its own tap", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE)
    const share = stubSharing()
    render(<Harness />)
    fireEvent.click(saveButton())

    const note = await statusWith(/Per la galleria/)
    expect(note).toHaveTextContent(
      "Immagine copiata. Per la galleria scegli Salva immagine.",
    )
    expect(browser.downloads).toEqual([])
    expect(share).toHaveBeenCalledOnce()

    fireEvent.click(within(note).getByRole("button", { name: "Condividi" }))
    await act(async () => undefined)
    expect(share).toHaveBeenCalledTimes(2)
    expect(share.mock.calls[1]![0].files[0].name).toBe("sabato-pm.png")
    // Shared: nothing left to say.
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })

  it("offers Condividi when a browser that can share files downloaded instead (Android)", async () => {
    stubSharing()
    render(<Harness />)
    fireEvent.click(saveButton())
    const note = await statusWith(/Immagine salvata e copiata/)
    expect(note).toHaveTextContent("Immagine salvata e copiata")
    expect(
      within(note).getByRole("button", { name: "Condividi" }),
    ).toBeVisible()
  })

  it("asks for a second tap when the share sheet is refused for the first", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE)
    const share = stubSharing(
      vi
        .fn()
        .mockRejectedValueOnce(new DOMException("Too late", "NotAllowedError"))
        .mockResolvedValue(undefined),
    )
    render(<Harness />)
    fireEvent.click(saveButton())
    const note = await statusWith(/Tocca Condividi/)
    expect(note).toHaveTextContent(
      "Immagine copiata. Tocca Condividi per salvarla.",
    )
    fireEvent.click(within(note).getByRole("button", { name: "Condividi" }))
    await act(async () => undefined)
    expect(share).toHaveBeenCalledTimes(2)
  })

  describe("the note", () => {
    it("goes away by itself after a few seconds and on the next tap", async () => {
      vi.useFakeTimers()
      render(<Harness />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })
      fireEvent.click(saveButton())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByRole("status")).toHaveTextContent(
        "Immagine salvata e copiata",
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5900)
      })
      expect(screen.getByRole("status")).toHaveTextContent("Immagine salvata")
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200)
      })
      expect(screen.getByRole("status")).toBeEmptyDOMElement()

      // A new tap clears an old note at once, before the new one is made.
      fireEvent.click(saveButton())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByRole("status")).toHaveTextContent("Immagine salvata")
      vi.mocked(renderElementToPng).mockReturnValue(
        new Promise(() => undefined),
      )
      fireEvent.click(saveButton())
      expect(screen.getByRole("status")).toBeEmptyDOMElement()
    })

    it("stays while focus is inside it, and counts down again once focus leaves", async () => {
      vi.useFakeTimers()
      stubSharing()
      render(<Harness />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })
      fireEvent.click(saveButton())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      const share = within(screen.getByRole("status")).getByRole("button", {
        name: "Condividi",
      })
      act(() => share.focus())

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000)
      })
      expect(screen.getByRole("status")).toHaveTextContent("Immagine salvata")

      act(() => share.blur())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6100)
      })
      expect(screen.getByRole("status")).toBeEmptyDOMElement()
    })

    it("is announced politely and kept out of the image", async () => {
      render(<Harness />)
      fireEvent.click(saveButton())
      const note = await statusWith(/Immagine salvata/)
      expect(note).toHaveAttribute("aria-live", "polite")
      expect(note.closest("[data-snapshot-exclude]")).toHaveAttribute(
        "data-snapshot-exclude",
        "true",
      )
    })
  })
})
