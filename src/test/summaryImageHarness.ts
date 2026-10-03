import { vi } from "vitest"

/**
 * The browser pieces the summary image's save-and-copy needs and jsdom lacks:
 * the clipboard and its item class, object URLs and an anchor that can be
 * "clicked" to download. `stubSummaryImageBrowser` installs recording fakes;
 * `restoreSummaryImageBrowser` takes them away again.
 */

export class FakeClipboardItem {
  readonly items: Record<string, Blob | Promise<Blob>>
  constructor(items: Record<string, Blob | Promise<Blob>>) {
    this.items = items
  }
  get types() {
    return Object.keys(this.items)
  }
}

export function stubSummaryImageBrowser() {
  const downloads: string[] = []
  const clipboardWrite = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal("ClipboardItem", FakeClipboardItem)
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { write: clipboardWrite },
  })
  URL.createObjectURL = vi.fn(() => "blob:summary")
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download)
  })
  return { downloads, clipboardWrite }
}

export function restoreSummaryImageBrowser() {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  const target = navigator as unknown as Record<string, unknown>
  delete target.clipboard
  delete target.share
  delete target.canShare
  const urls = URL as unknown as Record<string, unknown>
  delete urls.createObjectURL
  delete urls.revokeObjectURL
}
