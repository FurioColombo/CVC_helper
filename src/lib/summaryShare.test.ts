import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  FakeClipboardItem,
  restoreSummaryImageBrowser,
  stubSummaryImageBrowser,
} from "@/test/summaryImageHarness"

import {
  canShareFile,
  isIosDevice,
  makeSummaryFilename,
  saveAndCopySummaryImage,
} from "./summaryShare"

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36"

const pngBlob = () => new Blob(["png"], { type: "image/png" })

let browser: ReturnType<typeof stubSummaryImageBrowser>

function setAgent(agent: string) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(agent)
}

/** A browser that can share files, as an iPhone's can. */
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

beforeEach(() => {
  browser = stubSummaryImageBrowser()
  setAgent(ANDROID)
})
afterEach(() => {
  restoreSummaryImageBrowser()
  const target = navigator as unknown as Record<string, unknown>
  delete target.maxTouchPoints
})

describe("saveAndCopySummaryImage", () => {
  it("downloads the file and copies the image on Android and computers", async () => {
    const png = pngBlob()
    const result = await saveAndCopySummaryImage({
      png: Promise.resolve(png),
      filename: "riepilogo.png",
    })

    expect(result).toMatchObject({
      saved: "download",
      copied: true,
      shareBlocked: false,
    })
    expect(result.file?.name).toBe("riepilogo.png")
    expect(result.file?.type).toBe("image/png")
    expect(browser.downloads).toEqual(["riepilogo.png"])
    expect(browser.clipboardWrite).toHaveBeenCalledOnce()
    const [[item]] = browser.clipboardWrite.mock.calls[0] as [
      [FakeClipboardItem],
    ]
    expect(item.types).toEqual(["image/png"])
    expect(await item.items["image/png"]).toBe(png)
  })

  it("starts the clipboard write inside the tap, before the image is even ready", () => {
    // Safari accepts the write only from the gesture, with a promise for the
    // data to be filled in later.
    void saveAndCopySummaryImage({
      png: new Promise(() => undefined),
      filename: "riepilogo.png",
    })
    expect(browser.clipboardWrite).toHaveBeenCalledOnce()
    const [[item]] = browser.clipboardWrite.mock.calls[0] as [
      [FakeClipboardItem],
    ]
    expect(item.items["image/png"]).toBeInstanceOf(Promise)
  })

  it("on an iPhone opens the share sheet instead of downloading (a download goes to Files, not Photos), and copies", async () => {
    setAgent(IPHONE)
    const share = stubSharing()
    const result = await saveAndCopySummaryImage({
      png: Promise.resolve(pngBlob()),
      filename: "riepilogo.png",
    })

    expect(result).toMatchObject({
      saved: "share",
      copied: true,
      shareBlocked: false,
    })
    expect(share).toHaveBeenCalledOnce()
    const [data] = share.mock.calls[0]!
    expect(data.files).toHaveLength(1)
    expect(data.files![0]).toMatchObject({
      name: "riepilogo.png",
      type: "image/png",
    })
    expect(browser.downloads).toEqual([])
    expect(browser.clipboardWrite).toHaveBeenCalledOnce()
  })

  it("treats closing the share sheet as nothing to report", async () => {
    setAgent(IPHONE)
    stubSharing(() =>
      Promise.reject(new DOMException("Share canceled", "AbortError")),
    )
    const result = await saveAndCopySummaryImage({
      png: Promise.resolve(pngBlob()),
      filename: "riepilogo.png",
    })

    expect(result).toMatchObject({
      saved: "share",
      copied: true,
      shareBlocked: false,
    })
    expect(browser.downloads).toEqual([])
  })

  it("reports a share sheet the browser would not open from this tap, so a second tap can", async () => {
    setAgent(IPHONE)
    stubSharing(() =>
      Promise.reject(new DOMException("Too late", "NotAllowedError")),
    )
    const result = await saveAndCopySummaryImage({
      png: Promise.resolve(pngBlob()),
      filename: "riepilogo.png",
    })

    expect(result).toMatchObject({
      saved: "none",
      copied: true,
      shareBlocked: true,
    })
    expect(result.file).not.toBeNull()
    expect(browser.downloads).toEqual([])
  })

  it("downloads when sharing fails for any other reason", async () => {
    setAgent(IPHONE)
    stubSharing(() => Promise.reject(new TypeError("Broken")))
    const result = await saveAndCopySummaryImage({
      png: Promise.resolve(pngBlob()),
      filename: "riepilogo.png",
    })

    expect(result).toMatchObject({ saved: "download", shareBlocked: false })
    expect(browser.downloads).toEqual(["riepilogo.png"])
  })

  it("downloads on an iPhone that cannot share files", async () => {
    setAgent(IPHONE)
    const result = await saveAndCopySummaryImage({
      png: Promise.resolve(pngBlob()),
      filename: "riepilogo.png",
    })

    expect(result.saved).toBe("download")
    expect(browser.downloads).toEqual(["riepilogo.png"])
  })

  it("saves without copying where the browser has no clipboard", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    })
    const result = await saveAndCopySummaryImage({
      png: Promise.resolve(pngBlob()),
      filename: "riepilogo.png",
    })

    expect(result).toMatchObject({ saved: "download", copied: false })
    expect(browser.downloads).toEqual(["riepilogo.png"])
  })

  it("says so when the clipboard refuses the image, and still saves it", async () => {
    browser.clipboardWrite.mockRejectedValue(
      new DOMException("Denied", "NotAllowedError"),
    )
    const result = await saveAndCopySummaryImage({
      png: Promise.resolve(pngBlob()),
      filename: "riepilogo.png",
    })

    expect(result).toMatchObject({ saved: "download", copied: false })
    expect(browser.clipboardWrite).toHaveBeenCalledOnce()
  })

  it("gives a browser that takes no promise for the clipboard data the finished image", async () => {
    const png = pngBlob()
    browser.clipboardWrite.mockRejectedValueOnce(new TypeError("No promises"))
    const result = await saveAndCopySummaryImage({
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

  it("reports nothing saved and nothing copied when the image could not be made", async () => {
    const result = await saveAndCopySummaryImage({
      png: Promise.reject(new Error("canvas too large")),
      filename: "riepilogo.png",
    })

    expect(result).toEqual({
      saved: "none",
      copied: false,
      shareBlocked: false,
      file: null,
    })
    expect(browser.downloads).toEqual([])
  })
})

describe("isIosDevice", () => {
  it("knows an iPhone, an iPad and an iPad that asks for the desktop site", () => {
    setAgent(IPHONE)
    expect(isIosDevice()).toBe(true)

    setAgent(
      "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    )
    expect(isIosDevice()).toBe(true)

    // An iPad in desktop mode says it is a Mac, but a Mac has no touch screen.
    setAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    )
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel")
    expect(isIosDevice()).toBe(false)
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 5,
    })
    expect(isIosDevice()).toBe(true)
  })

  it("is false for Android and computers", () => {
    setAgent(ANDROID)
    expect(isIosDevice()).toBe(false)
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
