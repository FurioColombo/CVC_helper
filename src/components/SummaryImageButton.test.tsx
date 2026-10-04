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
const copyButton = () =>
  screen.getByRole("button", { name: "Copia immagine riepilogo" })

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
  it("is a floating button at the bottom right with a visible label that its accessible name contains, a copy icon, left out of the image", () => {
    render(<Harness />)
    const button = copyButton()
    expect(button).toHaveTextContent("Copia immagine")
    expect(button.getAttribute("aria-label")).toContain("Copia immagine")
    expect(button.querySelector("svg.lucide-copy")).not.toBeNull()
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
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

  it("renders the image ahead of the tap and copies that one", async () => {
    render(<Harness />)
    await vi.waitFor(() => expect(renderElementToPng).toHaveBeenCalledOnce())

    fireEvent.click(copyButton())
    expect(
      await screen.findByText("Immagine copiata. Incollala su WhatsApp."),
    ).toBeVisible()
    expect(renderElementToPng).toHaveBeenCalledOnce()
    expect(browser.clipboardWrite).toHaveBeenCalledOnce()
  })

  it("renders on the tap when it has not been rendered ahead, and shows it is busy meanwhile", async () => {
    let finish: (blob: Blob) => void = () => undefined
    vi.mocked(renderElementToPng).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    render(<Harness />)

    fireEvent.click(copyButton())
    const busy = await screen.findByRole("button", { name: "Preparo…" })
    expect(busy).toHaveAttribute("aria-busy", "true")
    // A second tap while it works does not start a second image.
    fireEvent.click(busy)
    expect(browser.clipboardWrite).toHaveBeenCalledOnce()

    await act(async () => finish(pngBlob()))
    expect(await statusWith(/Immagine copiata/)).toHaveTextContent(
      "Immagine copiata. Incollala su WhatsApp.",
    )
    expect(copyButton()).toHaveAttribute("aria-busy", "false")
    expect(renderElementToPng).toHaveBeenCalledOnce()
  })

  it("never downloads a file, and never opens the share sheet by itself, not even on an iPhone", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE)
    const share = stubSharing()
    const createObjectURL = vi.fn(() => "blob:summary")
    URL.createObjectURL = createObjectURL
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click")
    try {
      render(<Harness />)
      fireEvent.click(copyButton())
      await statusWith(/Immagine copiata/)

      expect(share).not.toHaveBeenCalled()
      expect(createObjectURL).not.toHaveBeenCalled()
      expect(click).not.toHaveBeenCalled()
    } finally {
      delete (URL as unknown as Record<string, unknown>).createObjectURL
    }
  })

  it("offers Condividi after the copy where the phone can share files, and it opens the sheet with the image from its own tap", async () => {
    const share = stubSharing()
    render(<Harness />)
    fireEvent.click(copyButton())

    const note = await statusWith(/Immagine copiata/)
    fireEvent.click(within(note).getByRole("button", { name: "Condividi" }))
    await act(async () => undefined)
    expect(share).toHaveBeenCalledOnce()
    const [data] = share.mock.calls[0]!
    expect(data.files).toHaveLength(1)
    expect(data.files[0]).toMatchObject({
      name: "sabato-pm.png",
      type: "image/png",
    })
    // Shared: nothing left to say.
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })

  it("has no Condividi where the phone cannot share files", async () => {
    render(<Harness />)
    fireEvent.click(copyButton())
    const note = await statusWith(/Immagine copiata/)
    expect(
      within(note).queryByRole("button", { name: "Condividi" }),
    ).not.toBeInTheDocument()
  })

  it("closing the share sheet is not an error, and a share that fails says so", async () => {
    const share = stubSharing(
      vi
        .fn()
        .mockRejectedValueOnce(new DOMException("Cancelled", "AbortError"))
        .mockRejectedValueOnce(new TypeError("Broken")),
    )
    render(<Harness />)
    fireEvent.click(copyButton())
    const note = await statusWith(/Immagine copiata/)

    fireEvent.click(within(note).getByRole("button", { name: "Condividi" }))
    await act(async () => undefined)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()

    fireEvent.click(copyButton())
    const again = await statusWith(/Immagine copiata/)
    fireEvent.click(within(again).getByRole("button", { name: "Condividi" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Condivisione non riuscita. Riprova.",
    )
    expect(share).toHaveBeenCalledTimes(2)
  })

  it("says the copy failed and offers Condividi where the phone can share", async () => {
    stubSharing()
    browser.clipboardWrite.mockRejectedValue(new Error("Denied"))
    render(<Harness />)
    fireEvent.click(copyButton())

    const note = await statusWith(/Copia non riuscita/)
    expect(note).toHaveTextContent("Copia non riuscita.")
    expect(
      within(note).getByRole("button", { name: "Condividi" }),
    ).toBeVisible()
  })

  it("says the copy failed, as an alert, where nothing else can send the image", async () => {
    browser.clipboardWrite.mockRejectedValue(new Error("Denied"))
    render(<Harness />)
    fireEvent.click(copyButton())

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Copia non riuscita.",
    )
    expect(
      screen.queryByRole("button", { name: "Condividi" }),
    ).not.toBeInTheDocument()
  })

  it("says so, as an alert, when the image could not be made, and makes it again on the next tap", async () => {
    vi.mocked(renderElementToPng).mockRejectedValueOnce(
      new Error("canvas too large"),
    )
    render(<Harness />)
    fireEvent.click(copyButton())
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Impossibile creare l’immagine. Riprova.",
    )

    fireEvent.click(copyButton())
    expect(
      await screen.findByText("Immagine copiata. Incollala su WhatsApp."),
    ).toBeVisible()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  describe("the note", () => {
    it("goes away by itself after a few seconds and on the next tap", async () => {
      vi.useFakeTimers()
      render(<Harness />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })
      fireEvent.click(copyButton())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByRole("status")).toHaveTextContent("Immagine copiata")

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5900)
      })
      expect(screen.getByRole("status")).toHaveTextContent("Immagine copiata")
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200)
      })
      expect(screen.getByRole("status")).toBeEmptyDOMElement()

      // A new tap clears an old note at once, before the new one is made.
      fireEvent.click(copyButton())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByRole("status")).toHaveTextContent("Immagine copiata")
      vi.mocked(renderElementToPng).mockReturnValue(
        new Promise(() => undefined),
      )
      fireEvent.click(copyButton())
      expect(screen.getByRole("status")).toBeEmptyDOMElement()
    })

    it("stays while focus is inside it, and counts down again once focus leaves", async () => {
      vi.useFakeTimers()
      stubSharing()
      render(<Harness />)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })
      fireEvent.click(copyButton())
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
      expect(screen.getByRole("status")).toHaveTextContent("Immagine copiata")

      act(() => share.blur())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6100)
      })
      expect(screen.getByRole("status")).toBeEmptyDOMElement()
    })

    it("is announced politely and kept out of the image", async () => {
      render(<Harness />)
      fireEvent.click(copyButton())
      const note = await statusWith(/Immagine copiata/)
      expect(note).toHaveAttribute("aria-live", "polite")
      expect(note.closest("[data-snapshot-exclude]")).toHaveAttribute(
        "data-snapshot-exclude",
        "true",
      )
    })
  })
})
