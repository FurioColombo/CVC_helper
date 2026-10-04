import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  FakeClipboardItem,
  restoreSummaryImageBrowser,
  stubSummaryImageBrowser,
} from "@/test/summaryImageHarness"

import {
  canShareFile,
  copySummaryImage,
  makeSummaryFilename,
  shareImageFile,
} from "./summaryShare"

const pngBlob = () => new Blob(["png"], { type: "image/png" })

let browser: ReturnType<typeof stubSummaryImageBrowser>

/** A browser that can share files, as an Android phone's or an iPhone's can. */
function stubSharing(
  share: (data: ShareData) => Promise<void> = () => Promise.resolve(),
) {
  const shareSpy = vi.fn(share)
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: shareSpy,
  })
  Object.defineProperty(navigator, "canShare", {
    configurable: true,
    value: vi.fn(() => true),
  })
  return shareSpy
}

type TestHook = { __CVC_TEST__?: { summaryImage?: Blob } }

beforeEach(() => {
  browser = stubSummaryImageBrowser()
})
afterEach(() => {
  restoreSummaryImageBrowser()
  delete (window as TestHook).__CVC_TEST__
})

describe("copySummaryImage", () => {
  it("copies the image to the clipboard, as an image, and hands back the file for Condividi", async () => {
    const png = pngBlob()
    const result = await copySummaryImage({
      png: Promise.resolve(png),
      filename: "riepilogo.png",
    })

    expect(result.copied).toBe(true)
    expect(result.file?.name).toBe("riepilogo.png")
    expect(result.file?.type).toBe("image/png")
    expect(browser.clipboardWrite).toHaveBeenCalledOnce()
    const [[item]] = browser.clipboardWrite.mock.calls[0] as [
      [FakeClipboardItem],
    ]
    expect(item.types).toEqual(["image/png"])
    expect(await item.items["image/png"]).toBe(png)
  })

  it("only copies: no file is downloaded and the share sheet is not opened on its own", async () => {
    const share = stubSharing()
    const createObjectURL = vi.fn(() => "blob:summary")
    URL.createObjectURL = createObjectURL
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click")
    try {
      await copySummaryImage({
        png: Promise.resolve(pngBlob()),
        filename: "riepilogo.png",
      })

      expect(share).not.toHaveBeenCalled()
      expect(createObjectURL).not.toHaveBeenCalled()
      expect(click).not.toHaveBeenCalled()
    } finally {
      delete (URL as unknown as Record<string, unknown>).createObjectURL
    }
  })

  it("starts the clipboard write inside the tap, before the image is even ready", () => {
    // Safari accepts the write only from the gesture, with a promise for the
    // data to be filled in later.
    void copySummaryImage({
      png: new Promise(() => undefined),
      filename: "riepilogo.png",
    })
    expect(browser.clipboardWrite).toHaveBeenCalledOnce()
    const [[item]] = browser.clipboardWrite.mock.calls[0] as [
      [FakeClipboardItem],
    ]
    expect(item.items["image/png"]).toBeInstanceOf(Promise)
  })

  it("says the copy failed, and still gives the file, where the browser has no clipboard", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    })
    const result = await copySummaryImage({
      png: Promise.resolve(pngBlob()),
      filename: "riepilogo.png",
    })

    expect(result.copied).toBe(false)
    expect(result.file).not.toBeNull()
  })

  it("says so when the clipboard refuses the image, and still gives the file", async () => {
    browser.clipboardWrite.mockRejectedValue(
      new DOMException("Denied", "NotAllowedError"),
    )
    const result = await copySummaryImage({
      png: Promise.resolve(pngBlob()),
      filename: "riepilogo.png",
    })

    expect(result.copied).toBe(false)
    expect(result.file).not.toBeNull()
    expect(browser.clipboardWrite).toHaveBeenCalledOnce()
  })

  it("gives a browser that takes no promise for the clipboard data the finished image", async () => {
    const png = pngBlob()
    browser.clipboardWrite.mockRejectedValueOnce(new TypeError("No promises"))
    const result = await copySummaryImage({
      png: Promise.resolve(png),
      filename: "riepilogo.png",
    })

    expect(result.copied).toBe(true)
    expect(browser.clipboardWrite).toHaveBeenCalledTimes(2)
    const [[item]] = browser.clipboardWrite.mock.calls[1] as [
      [FakeClipboardItem],
    ]
    expect(item.items["image/png"]).toBe(png)
  })

  it("reports nothing copied and no file when the image could not be made", async () => {
    const result = await copySummaryImage({
      png: Promise.reject(new Error("canvas too large")),
      filename: "riepilogo.png",
    })

    expect(result).toEqual({ copied: false, file: null })
  })

  it("hands the image to a page that asked for it (the browser journeys' test hook), and to no other", async () => {
    const png = pngBlob()
    await copySummaryImage({ png: Promise.resolve(png), filename: "a.png" })
    expect((window as TestHook).__CVC_TEST__).toBeUndefined()

    const hook: { summaryImage?: Blob } = {}
    ;(window as TestHook).__CVC_TEST__ = hook
    await copySummaryImage({ png: Promise.resolve(png), filename: "a.png" })
    expect(hook.summaryImage).toBe(png)
  })
})

describe("canShareFile", () => {
  const file = new File(["png"], "x.png", { type: "image/png" })

  it("needs both share and canShare, and a yes from canShare", () => {
    expect(canShareFile(file)).toBe(false)
    stubSharing()
    expect(canShareFile(file)).toBe(true)
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: vi.fn(() => false),
    })
    expect(canShareFile(file)).toBe(false)
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: vi.fn(() => {
        throw new TypeError("No files")
      }),
    })
    expect(canShareFile(file)).toBe(false)
  })
})

describe("shareImageFile", () => {
  const file = new File(["png"], "riepilogo.png", { type: "image/png" })

  it("opens the share sheet with the file", async () => {
    const share = stubSharing()
    expect(await shareImageFile(file)).toBe("shared")
    expect(share).toHaveBeenCalledWith({ files: [file] })
  })

  it("treats closing the sheet as nothing to report", async () => {
    stubSharing(() =>
      Promise.reject(new DOMException("Share canceled", "AbortError")),
    )
    expect(await shareImageFile(file)).toBe("cancelled")
  })

  it("tells a sheet the browser refused to open from this tap from any other failure", async () => {
    stubSharing(() =>
      Promise.reject(new DOMException("Too late", "NotAllowedError")),
    )
    expect(await shareImageFile(file)).toBe("blocked")
    stubSharing(() => Promise.reject(new TypeError("Broken")))
    expect(await shareImageFile(file)).toBe("failed")
  })
})

describe("makeSummaryFilename", () => {
  it("makes a short lower-case name without accents or symbols", () => {
    expect(makeSummaryFilename("Sabato PM", "riepilogo")).toBe("sabato-pm.png")
    expect(makeSummaryFilename("Riepilogo comandate", "x")).toBe(
      "riepilogo-comandate.png",
    )
    expect(makeSummaryFilename("Lunedì — AM!", "x")).toBe("lunedi-am.png")
  })

  it("falls back when the title has nothing to make a name from", () => {
    expect(makeSummaryFilename("  ?! ", "riepilogo-equipaggi")).toBe(
      "riepilogo-equipaggi.png",
    )
    expect(makeSummaryFilename("", "riepilogo-comandate")).toBe(
      "riepilogo-comandate.png",
    )
  })
})
